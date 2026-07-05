# Marketly Reliability Hardening Design

## Objective

Make Marketly trustworthy under cold caches, partial provider outages, slow upstreams, and repeated requests. The application must never present a normal numeric investment score when the financial evidence is insufficient, and a failed financial stage must remain visible and retryable instead of being silently converted into a polished result.

## Product Behavior

Marketly will preserve useful company, news, and macro context when financial evidence is incomplete. The result will be explicitly classified as `complete`, `partial`, `insufficient`, or `stale`. `partial` results may carry a score only when minimum scoring coverage is met; `insufficient` results have `score: null`, a clear explanation, and a financial retry action.

The frontend will distinguish transport failure, upstream failure, stale data, and insufficient coverage. A result object existing is not proof that financial data loaded. Empty financial responses will not enter the normal browser, Redis, or Supabase cache paths.

## Root Cause Being Addressed

On a cold request the frontend currently starts `/financials/{symbol}` and `/score/{symbol}` concurrently. The score endpoint independently performs another financial fetch. Both backend calls can miss the cache, run the same slow providers, finish with different coverage, and overwrite the same cache. The browser aborts earlier than the proxy, silently maps failures to `null`, and may render a final analysis while the backend continues and later fills the cache. A second run then appears instant and complete.

The persistence layer compounds this behavior by rehydrating the latest Supabase snapshot without a freshness or quality check. Missing metrics are assigned neutral score points, allowing an empty financial payload to produce a plausible score.

## Backend Architecture

### Financial data quality

Introduce a small financial-quality module that inspects statement rows, profile/quote fields, sources, and period timestamps. It returns:

- status: `complete`, `partial`, `insufficient`, or `stale`
- coverage score and statement coverage
- missing critical fields
- fetched timestamp and maximum data age
- whether the payload is eligible for normal caching and scoring

Financial responses expose this metadata under `dataQuality`. The quality calculation is deterministic and independent of GPT.

### Provider reconciliation

Provider statement blocks will be reconciled by reporting period and field coverage. A merely non-empty FMP block cannot suppress a richer SEC block. Valid numeric zero values are preserved through explicit `None` checks. Provider timing and failure reasons are logged without credentials.

### Fetch coalescing and cache policy

Concurrent financial requests for the same normalized symbol share one in-process fetch through a keyed single-flight coordinator. Cache writes compare the incoming quality rank with the cached quality rank; an insufficient payload cannot replace a partial or complete payload.

Normal cache TTLs apply only to eligible payloads. Insufficient results may receive a short negative-cache TTL to prevent provider hammering, but they are never stored as durable evidence snapshots. Supabase snapshots must satisfy both maximum age and minimum quality before reuse. Force refresh bypasses every cache tier.

### Scoring

Composite scoring becomes coverage-aware. Missing values contribute no positive evidence. If required financial coverage is below the scoring threshold, the composite score is unavailable rather than neutral. The public score schema therefore accepts `score: null` and exposes a reason.

GPT synthesis may still summarize available context, but it is told that the result is degraded and cannot imply an investment rating. Cached score responses are accepted only when their embedded input-quality metadata remains eligible.

### Request deadlines

The browser, Next.js proxy, and backend use a coherent deadline budget. Provider requests use shorter per-provider timeouts so the backend has time to reconcile results and respond before the outer deadline. The frontend performs one bounded retry of the financial stage when score generation succeeds but financial retrieval encounters a transient transport failure.

## API Contract

Financial and score payloads expose stable status metadata:

```json
{
  "status": "complete | partial | insufficient | stale",
  "coverage": 0.0,
  "statementCoverage": 0.0,
  "missingCriticalFields": [],
  "fetchedAt": "ISO-8601 timestamp",
  "cacheEligible": true,
  "reason": null
}
```

Score responses support a nullable score and retain both the deterministic score and the model's original suggestion in the typed response schema. Per-stage source metadata remains request-local; mutable module globals are not used for provenance.

## Frontend Behavior

The progressive loader retains a structured outcome for each stage instead of swallowing errors. It derives financial availability from quality metadata and actual statement coverage. The dashboard renders:

- normal analysis for complete data
- a visible partial-data banner for usable but incomplete data
- a degraded analysis with no numeric score for insufficient data
- a retry action that bypasses browser and backend caches

Requests are scoped to an analysis ID and abort controller. Resetting or replacing an analysis prevents late completions from repopulating old state. Strict Mode mount cleanup cannot permanently disable completion handling.

Scenario cards preserve backend names and ordering semantics. The UI does not relabel arbitrary cases as bull/base/bear and does not fabricate price targets. If the backend does not provide a target, the card shows probability and thesis only.

## Security and Configuration

- SEC requests use a configurable, real contact-bearing user agent.
- Rich tracebacks do not include local variables in production.
- Proxy failures do not disclose the backend URL to clients.
- Response schemas retain intended audit metadata.
- Pytest configuration makes the documented test command work without a manual `PYTHONPATH`.

## Testing Strategy

All behavior changes use red-green TDD. Regression coverage includes:

- completely empty financial data produces no score
- partial FMP statements are enriched by SEC facts
- valid zero ratios remain present
- stale or insufficient snapshots are rejected
- lower-quality concurrent results cannot overwrite higher-quality cache data
- two cold concurrent requests execute one provider fetch
- force refresh bypasses cached and snapshot data
- score and financial response schemas serialize degraded states correctly
- frontend financial status depends on evidence, not object truthiness
- progressive stage failures remain visible and retry once when appropriate
- reset/Strict Mode lifecycle prevents stale request completion
- arbitrary scenario names are not relabeled and targets are not invented

The final verification gate is the complete backend suite, frontend lint, TypeScript/production build, and focused cold-cache concurrency tests.

## Scope Boundaries

This change hardens the current FastAPI, Next.js, Redis, and Supabase architecture. It does not introduce a job queue, replace providers, redesign the visual system, or create a new database migration unless the existing snapshot payload cannot carry the new metadata.
