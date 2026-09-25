# Adaptive data implementation plan / handoff

## Scope and constraints

User expanded scope on 2026-09-25. Work only on `codex/background-market-refresh`;
never modify/merge main. Supabase is `gffskqucpyujimxaqzrp`. Preserve financial evidence,
minimize storage/egress, prioritize relevant companies, remain functional at checkpoints.
Full requested scope includes market calendars/holidays/multiple exchanges, priority and
budget scheduling, per-user decaying interest and sector affinity, financial-event refresh,
stale-while-revalidate, deduplication, reusable metadata/logos, observability and production
execution independent of the user's laptop. Do not mistake partial completion for all scope.

## Verified baseline (7ea099d)

- Python FastAPI with Next.js frontend and device-local watchlists; no authenticated user
  identity flow currently used for watchlists. Do not invent private server-side identities.
- Supabase REST through service-role credentials; Redis optional/unreachable locally.
- market_data_cache UPSERT namespace/key; financial snapshots are append-only JSON;
  normalized statement rows contain provenance in payload. Repeated financial snapshots
  and mixed-provider field-level provenance need further work.
- Worker is a single daemon thread per API process, optionally standalone. Jobs have
  `(kind,symbol)` uniqueness, SKIP LOCKED claims, fenced 15-minute leases, bounded retry.
  Queue currently orders due time; no priority, market calendars or per-user interest.
- quotes 5m, news 15m, calendar daily, financials weekly or 6h for seven days after release.
  Not exchange-aware. 30-day tracking expiry. ETF benchmarks only get quote jobs.
- Latest quotes UPSERT, not append. Score keys invalidated after financial job success.
- Financial requests share in-process Futures, but foreground requests and jobs do NOT
  yet share cross-process deduplication. Financial cache max usable age is 90 days and
  does not offer general stale-while-revalidate. Persistent snapshot fallback recaches.
- Frontend preload queue: two concurrent requests, watchlists and limited visible search
  results, uses the same request/cache as manual opening. Speculation uses track=false
  and filters unsupported exchange suffixes. Watchlist tracking occurs via earnings route.
- Full-market map is a single Finviz response (~5,543 stocks), cached only in memory.
- Seven-day reminders computed from durable calendars; device-local dismissal. No email/push.
- Original SEC accession links and FMP source URLs displayed on both financial pages;
  supporting row links are not yet comprehensive per-value provenance.
- Root cause of recent complete-market failures: localhost frontend was proxying old
  Render deployment returning 404 for all three /market routes. Local frontend now uses
  http://127.0.0.1:8000; production deployment still needs updating.
- Live local /market/overview, /market/earnings, /market/heatmap return 200. Browser shows
  watchlist quotes without selecting companies and logs confirm financial preloads.
- 88 baseline backend tests; TypeScript and targeted lint passed before expanded scope.
- Existing applied migration: 20260925093816_background_market_refresh.sql. No other
  schema changes applied yet. All new queue tables/functions are service-role only.

## Phases and complexity estimate

1. **Stabilize + metadata/logos (medium, ~6–9k tokens)**: finish runtime verification;
   compact centralized company metadata with bounded memory + durable cache; reuse Finnhub
   profile/logo references; shared frontend provider/component, missing/broken fallback;
   tests, lint/types/build and commit. No image binaries in DB.
2. **Central freshness + storage (large, ~12–18k tokens)**: one dataset service; separate
   data_as_of/fetched_at; serve stale snapshots, enqueue refresh, cross-process foreground/
   worker dedup; version/hash financial snapshots and field-level source attribution;
   invalidate only when underlying evidence changes; persistent heatmap cache; metrics.
3. **Adaptive scheduler (large, ~15–25k tokens)**: choose/test maintained exchange-calendar
   library; map listings to exchanges; session-aware policy incl holidays and DST; priority
   with explicit > watchlist > speculative; rate budgets; fair aging; per-user aggregated
   interest/sector affinity with decay and retention. Resolve authentication before storing
   private interest remotely; browser-local aggregation is an acceptable early stage.
4. **Production + end-to-end (medium, ~5–10k tokens)**: inspect available Render deployment
   access, add/configure always-on worker, securely set env, migrate and verify live job
   progress with browser closed. Do not claim local process is production execution.

Estimates are rough planning bounds, not a goal/token budget. Finish and commit coherent
phases before context exhaustion. Remaining phases should not be superficially implemented.

## Phase 1 completed checkpoint

Added `backend/app/integrations/company_metadata.py`: shared compact Finnhub profiles
used by financial aggregation and `GET /companies/metadata?symbols=...` (max 12).
Profiles use existing cache-table UPSERTs under `company_profiles`, 30-day positive /
one-day missing TTL, bounded 512-entry/10-minute memory cache, per-symbol Futures,
and at most two concurrent profile calls per process. Batch requests prime memory
with one compact persistent read. No new migration, image binaries or user behavior
stored. Per-symbol failure isolation and process-wide deduplication.

Added `frontend/src/lib/company-metadata.ts` and reusable `company-logo.tsx`. Metadata
requests batch 12 symbols with two batches in flight, deduplicated across components.
Six-hour browser lifetime for available profiles, short negative/error lifetime.
Logos appear in market watchlists, sidebar, Watchlist/Saved cards, company header,
search results and earnings reminders. Fixed dimensions, HTTPS references, initials
fallback and broken-image handling. No thousands of heatmap logo downloads.
Do not claim full financial dataset freshness was centralized by this change.

Verification:
- 99 backend tests passed, including 11 new metadata/preload cases.
- 4 frontend Node tests passed (`node --test tests/company-data.test.mjs` from frontend):
  bounded preload concurrency, opening during preload/cache reuse, failure retry,
  speculative-listing filtering, missing/broken-logo fallback and URL replacement.
- TypeScript and targeted frontend lint passed.
- `npm run build` passed with sandbox escalation. Initial sandboxed build failed
  because Turbopack could not bind its CSS helper port, not because of application code.
- Live API returned available logos for AAPL, MSFT, NVDA, GOOGL. Browser DOM confirmed
  all four images loaded at fixed 29px dimensions, Watchlist navigation and MSFT view
  with other sidebar prices visible. One third-party chart iframe console error appeared
  in company view; no hydration error observed in this verification.
- Speculative test tracking for TSLA.TO, TSLA.NE, TSLA.L, TSLA.AS was expired using
  active_until. No evidence deleted. New speculative loads use track=false.

Runtime/configuration:
- Local backend/frontend restarted on 127.0.0.1:8000 / 127.0.0.1:3000.
- frontend/.env.local (ignored) points BACKEND_API_URL to local port 8000.
- Local background loop is running, but cannot survive laptop sleep/shutdown.
- Hosted Render was not changed. No production always-on worker configured.
- Only migration applied is 20260925093816_background_market_refresh.sql on
  gffskqucpyujimxaqzrp. Metadata reuses the existing server-only cache table.

## Exact next step (phase 2)

Read this handoff, `backend/app/services/market_refresh.py`,
`backend/app/integrations/financials.py` (fetch/snapshot paths),
`backend/app/core/cache.py`, `backend/app/integrations/supabase_store.py`,
`backend/app/services/analysis_service.py`, and the existing migration.
Design a company dataset service that returns usable snapshots immediately and queues
refreshes. Add a Postgres claim/lease shared by foreground and background fetches;
preserve provider aggregation as the cold-load implementation. Add concurrent/stale-
provider tests before replacing route/worker callers. Use content fingerprints to avoid
unchanged financial snapshot accumulation and invalidate score cache only on relevant
changes. Preserve filing provenance. Finish/test/commit before calendar/interest work.

Not completed: general stale-while-revalidate; cross-process API/worker dedup;
content-addressed financial history; unambiguous field-level evidence; durable/background
heatmap refresh; exchange mappings/calendars/holidays/DST; priority budgets and explicit-
request precedence; per-user interest/sector affinity with decay; prefetch effectiveness
metrics; production deployment. No authentication foundation exists for private remote
interest storage—make that design decision explicitly before adding user-interest tables.
