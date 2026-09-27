# Implementation report — foundation increment

## Completed

- Created `codex/investor-intelligence-foundation` from clean `master`.
- Audited all 43 requested areas; see [audit and provider matrix](audit.md).
- Added a deterministic financial trend service with 19 reported series and six derived series. Covers income, balance sheet, cash generation, capital allocation, weighted-average diluted shares and payout/margins where inputs exist.
- Added like-period, like-currency YoY and actual 3/5/10-year annual CAGR endpoints. Missing years, zero/negative bases and missing fields produce unavailable values rather than estimates. Quarterly and annual rows remain separate. Duplicate period rows prefer the latest filing.
- Extended existing `/financials/{symbol}` and `/companies/{symbol}/intelligence` responses with the same `financialTrends` object. The financial route does not attach derived data to the cached provider object.
- Added the trend explorer inside the existing company Financials tab, also reused by the standalone financials page. Includes metric/frequency/currency/range controls, chart, comparison values, table, source links and methodology.
- Fixed older intelligence summary calculations that could mix fiscal periods/currencies, combine unmatched cash flow and income periods, or label a longer history as a three-year CAGR.
- Fixed the existing frontend test loader to resolve project-local `@/` imports.

## Architecture, persistence and refresh

No new database tables, migrations, provider keys, subscriptions or background workers. The existing statement pipeline and Redis/Supabase cache remain the source. The existing worker refreshes statements after earnings and on its safety schedule; this branch calculates lightweight derived trends when the financial/intelligence API serves the cached snapshot. It does not increase provider call counts or create another cache namespace.

The new contract carries per-value source, filing link/date where supplied, currency, fiscal period, retrieval time, reported/calculated kind and derived formula/input names. Source labels remain as granular as the existing adapter supplies: merged provider sources are not equivalent to independently verified per-field provenance. Historical restatements are explicitly not represented as point-in-time vintages. Snapshot retrieval is not represented as a fresh financial reporting date.

Future mobile/iPad clients can consume the same API response. No browser-only financial calculation pipeline, native app, authentication change or private user-data feature was introduced. Old saved snapshots without `financialTrends` continue to render without the new explorer.

## Feature boundaries

- **Company profile and management:** existing description, identity, headquarters, employees, CEO and officers reused. No invented biographies, tenure, board independence, pay or founder status.
- **Financial analysis and quality:** new trends implemented; complete annual/quarterly backfill and ROIC/ROA/ROE trends remain pending. The registry uses current provider field aliases and must expand with tested adapters when new sources arrive.
- **Valuation:** existing current multiples retained; historical medians, ranges and peer adjustments remain pending.
- **Ownership and insiders:** not implemented; transaction coding and licensed/official ingestion still needed.
- **Expectations, revisions, guidance and surprises:** not implemented. Account entitlements, measurement basis and immutable vintages are prerequisites.
- **Documents and research:** existing SEC source links retained; searchable text, transcript ingestion, cited Q&A and passage comparisons remain pending.
- **What Changed and thesis:** not implemented; needs authenticated private data, visit cursors, structured assumptions and sourced event differences.
- **Watchlists/portfolio:** existing watchlists/news/earnings preserved. No holdings model, portfolio analytics or fundamental personalized feed added.

## Verification

- Backend: `backend/.venv/bin/python -m pytest -q` — **131 passed**, including six new financial trend tests. Three existing Pydantic deprecation warnings.
- Frontend: `npx tsc --noEmit` — passed.
- Frontend: ESLint for both edited financial components — passed.
- Frontend: `node --test tests/company-data.test.mjs` — **4 passed** after correcting the pre-existing alias resolver.
- `git diff --check` — passed.
- Default Turbopack production build stalled without diagnostic output and was interrupted. `npx next build --webpack` — passed compilation, TypeScript, static generation and build tracing.
- No live provider entitlement, production migration or browser interaction verification claimed.

## Files changed

- `backend/app/services/financial_trends.py` — new deterministic trend builder.
- `backend/app/services/company_intelligence.py` — period alignment and correct three-year comparison; exposes trends.
- `backend/app/schemas/company_intelligence.py` — additive contract fields.
- `backend/app/routes/financials.py` — attaches trends to existing response.
- `backend/tests/test_financial_trends.py` — calculation and route regressions.
- `frontend/src/lib/api.ts` — reusable typed trend response.
- `frontend/src/components/research/financial-trends.tsx` — new explorer.
- `frontend/src/components/research/company-financials.tsx` — existing page integration.
- `frontend/src/components/research/research.css` — responsive controls and evidence table.
- `frontend/tests/company-data.test.mjs` — local alias resolution.
- `docs/investor-intelligence/audit.md` and this report.

## In progress / not started / next steps

The broader foundation phase remains in progress; this increment is at an API/UI boundary. The remaining four major product phases are not started by this branch. Exact ordered follow-ups and the availability matrix are in the audit.

Production still needs existing provider/Supabase/Redis configuration, sufficient statement coverage and the normal application deployment. This branch adds no configuration requirements. Before calling the full foundation complete, verify provider duration/basis metadata and history depth, run desktop/mobile browser QA, and add official ownership/insider/management evidence. Do not purchase or enable a paid dataset based only on a public endpoint catalog.

Remaining risks include provider-specific aliases, partial SEC/FMP histories, legacy source granularity, annual/quarter/YTD classification inherited from upstream normalization, and restated values. A selected 10-year range does not imply ten years of available data. Negative-base growth is deliberately unavailable. Chart values use compact formatting; the table shows expanded numeric values and raw numbers remain available in the API.
