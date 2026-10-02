# Financial intelligence platform audit and delivery plan

Audit snapshot from 2026-10-02. Branch references describe the source state at
the time; do not use this plan as the current account/deployment guide. See
[Account and deployment setup](account-and-deployment.md) for current operations.

## Current architecture

Marketly is a Next.js 16 / React 19 research UI backed by FastAPI. API routes
group company analysis, financial statements, market/news, economics, discovery,
relationships, notifications and heatmap data. Provider code is mostly in
`backend/app/integrations/` (FMP/financial statements, Finnhub discovery, FRED,
news, OpenAI, Supabase). The backend service layers include fact normalization
and coverage, deterministic financial quality/scoring, company classification,
interpretation, event/catalyst summaries, history context, scenario fallback,
trajectory, comparables and relationship research. Redis/Upstash is an optional
fast cache with Supabase JSON snapshots as the durable cache path.

The main company analysis remains `/score/{symbol}`. It composes normalized
provider facts and deterministic layers, then uses the OpenAI integration for
bounded narrative synthesis. `/financials/{symbol}` exposes statements, source
aware financial trends and comparison metrics. `/discovery/search` and
`/discovery/peers/{symbol}` are provider-backed lookup routes. Market overview,
movers, earnings, news, relationships, macro/economic context and health routes
are also available. Frontend API types live in `frontend/src/lib/api.ts`;
comparison shaping is in `frontend/src/lib/comparison.ts`; discovery and
relationship components already exist. Small-cap candidate scans are now
connected to the durable queue and candidate history.

The recurring refresh path is `RefreshWorker` in
`backend/app/services/market_refresh.py`, started from FastAPI lifespan when
Supabase is configured. Durable `market_refresh_jobs` rows use claim/finish RPCs
with fenced leases and backoff. It refreshes quotes, news, calendars,
financials, and researched relationships. API and worker are still deployed as
one process. Redis/Upstash is optional; Supabase remains the fallback cache and
job store. The bounded small-cap scan runs as a weekly durable job and stores
candidate score history; its probabilities remain heuristic and uncalibrated.

## Persistence audit

The SQL baseline defines cache, company, financial statement/metric, news,
analysis run/snapshot, fact, event, catalyst, analog, computed metric, scenario,
horizon, research job, and tracked company data. The application wires the
company/profile and financial statement/metric writes, cache snapshots, news,
analysis-run persistence, relationship records, market instruments, workspace
trackers, and refresh jobs. The application does **not** currently read/write
the normalized `company_aliases`, `source_documents`, `fact_snapshots`,
`fact_values`, `company_events`, `catalyst_watch`, `historical_analogs`,
`analysis_snapshots`, `computed_metrics`, `analysis_scenarios`,
`analysis_horizons`, `research_jobs`, or `tracked_companies` tables through the
main analysis flow. The schema’s `research_jobs` table is separate from the
operational `market_refresh_jobs` queue, which is the active worker queue.
Authenticated Next.js routes persist `user_research_state`; alert preferences,
push subscriptions and inbox items are persisted through the backend. Presence
in SQL alone does not prove that a migration was applied to a particular
project; check [the current migration status](../supabase/README.md).

Existing intelligence that should be extended rather than replaced:

- `facts/`, `financial_trends.py`, and `comparison.py` provide normalized
  evidence and compatible period-aware metrics.
- `company_intelligence.py`, `financial_quality.py`, and `scoring/` provide
  deterministic quality signals; potential should stay a separate score.
- `events/`, `news_intelligence.py`, and `news_briefing.py` classify and rank
  news, but do not yet deduplicate articles into a durable canonical event
  ledger.
- `history/`, `market_history.py`, scenarios, and trajectory provide analysis
  context, not a point-in-time historical analog database or calibrated
  outcomes.
- `relationship_research.py` and `company_relationships` preserve dated,
  sourced relationship evidence. Regex news matches remain hints, not confirmed
  graph edges. Exposure percentages are not reliably available.
- `discovery_screen.py` and `comparison_metrics` support a shallow peer screen;
  distinct peer classes and historical analog matching are still missing.
- The small-cap service already has deterministic potential scoring and
  heuristic probabilities. It should not be described as an investment return
  forecast, and the heuristic must remain visibly uncalibrated.

## Assumptions and limits in the request

Market-cap bands vary by market, date and data vendor; configurable profile
limits are preferable to treating nano/micro/small labels as universal facts.
FMP country coverage and access depend on the configured account. A current
provider screener is not a complete point-in-time universe and cannot by itself
support unbiased backtests. Forecast calibration requires timestamped feature
vintages, survivorship-aware delisted securities, benchmark returns, corporate
actions and explicit outcome definitions. The existing schema suggests several
of these concepts, but does not yet supply those guarantees. Relationship
evidence is useful only when its source and temporal status are retained; it
does not establish revenue dependency without disclosed data. The proposed
multi-week platform cannot be delivered honestly as one all-at-once feature.

## Phased implementation

1. **Audit and first connected slice (complete):** document actual reuse and
   schema gaps; run configurable bounded small-cap scans through the durable
   refresh worker and store immutable score observations.
2. **Discovery foundation (partially complete):** cap-band presets, evidence
   quality controls and a user-facing discovery dashboard exist; richer
   decomposition and broad provider coverage remain future work.
3. **Comparable engine:** define comparable classes and compatible-metric
   summaries on top of `comparison_metrics`; do not conflate provider industry
   peers with business-model, valuation, or supply-chain peers.
4. **Persistence wiring:** choose and implement the existing fact, event,
   analysis snapshot and research-job schema contracts. Add idempotency,
   provenance, policy, and migration tests before claiming durable analysis
   history.
5. **Relationship and event graph:** normalize confirmed edges and canonical
   events with dated evidence, explicit direction/status/confidence, and
   second-order traversal safeguards.
6. **Historical analogs and predictions:** store as-of feature vintages and
   outcomes, define survivorship/corporate-action treatment, then calculate
   empirical calibration only after adequate observations exist.
7. **Research workflow and terminal modules:** move expensive discovery stages
   to durable queued work, independently deploy worker processes when useful,
   and add alerts, ownership, filings, transcripts and macro modules as their
   source/licensing contracts are established.

Each phase should preserve existing endpoints and attach source, retrieval or
effective date, method version, and evidence coverage to new outputs. Model
probabilities remain heuristic until a versioned historical calibration
demonstrates otherwise.
