# Research workspace upgrade

## Scope and starting point

Branch: `codex/research-workspace-upgrade`, based on `codex/investor-intelligence-foundation`, preserving its uncommitted work. The foundation is preserved in `59bc0e5`; the research and account implementation is in `a3ad062`. The subsequent visual corrections are on `codex/terminal-ui-refinement`, branched directly from that commit.

The September 27 PDF and pasted checklist are requirements/reference material for the user's request. Example numbers are illustrative, not datasets. Future mobile apps, subscription billing and autonomous trading are architecture considerations, not current deliverables.

Initial inspection: Next.js 16/React 19 frontend, FastAPI backend, Recharts/lightweight-charts, existing provider adapters and Redis/Supabase persistence. Compact comparison is embedded in `frontend/src/components/research/dashboard.tsx`; peers use `backend/app/routes/discovery.py`. Chat renders narrative before all visuals in `rich-chat-message.tsx`. Several private preferences/conversations currently use localStorage. Inherited financial-trend and news work is included in the baseline commit.

## Ordered delivery plan

1. **Baseline and data audit.** Inventory inherited changes; verify tests; map fields, reporting bases, currencies, sources, provider entitlements and refresh paths. Produce a precise availability matrix before implementing dependent calculations.
2. **Identity and private data.** Supabase authentication, session persistence, backend token validation, per-user ownership/RLS, safe migration of existing local state, onboarding, editable profile/preferences, and synchronized watchlists/chat/settings. Verify cross-user isolation. Google/Apple sign-in requires actual provider configuration; do not label it working until callback/session tests pass.
3. **Shared metrics and expectations.** Reuse financial history/cache; consistent metric definitions, price-period changes, peer statistics and separately labelled sector benchmarks. Add estimates-versus-actuals with matching fiscal periods, currency and GAAP/adjusted basis; preserve estimate timestamps. Expose unavailable coverage honestly. Historical valuation depends on genuine historical observations.
4. **Complete comparison experience.** Compact category tabs and peer management; `/compare` URL selection, new-tab flow, 2–6 companies, stable chart identities, snapshots, valuation/growth/profitability, financial history, balance sheet, scatter plots and expandable responsive panels. Reuse one shared dataset. Test URL roundtrips, missing data, medians, units and request deduplication.
5. **Small-cap discovery.** Enrich cards with four supported metrics, readable market caps, factual tags, search/sector/industry/cap/quick filters and correct whole-result sorting/pagination. Improve each attention-list category and connect comparison selection. Reuse cached/batched data; verify no per-card provider fan-out.
6. **Relationship research coverage.** Inspect caps, research passes, entity resolution, aliases and evidence extraction. Expand sourced supplier/customer discovery with provenance, dates and deduplication. Test known evidence-backed examples; never imply exhaustive coverage or hardcode relationships to inflate counts.
7. **Chat and news analysis.** Ordered narrative/chart/table blocks, real accessible tables, backwards-compatible saved messages, and cited single-article/multi-news summaries. Distinguish retrieved article text from headlines/excerpts. Verify failed/partial retrieval and streaming rendering.
8. **Personal portfolio and context.** User-owned holdings input/editing, synchronized storage, profile-aware analysis and explicit data coverage. Verify authorization and account switching end-to-end. Keep APIs suitable for future native clients; brokerage execution and billing remain future work.
9. **Ticker layout and visual finish.** Consolidate duplicate company metrics, compact identity line, two-decimal prices, price/period performance, subdued correctly labelled benchmarks, larger readable blocks and consistent spacing. Review comparison/discovery/chat/ticker layouts at desktop, laptop and tablet widths; fix overlaps.

## Completion and model handoff

Finish each vertical slice through API, persistence where relevant, UI, meaningful tests and browser verification before marking it complete. Compilation alone is insufficient. Check provider/OAuth prerequisites early, continue independent work if blocked, and record exact unresolved external configuration.

Use Astra for difficult architecture, authorization, financial semantics and research/chat contracts. Recheck account usage at major milestones and report when the difficult work is finished so the user can switch models for remaining polish. Initial account snapshot: 96% of five-hour allowance and 76% of weekly allowance remaining; shared account limits, not guaranteed task budget or model-specific quota.

Every handoff must include completed, partially completed, not started, blocked, exact files, commands/results, and the next concrete step. Do not treat an unavailable feature placeholder as completed data integration.

## Current status — September 27, latest UI revision

### Implemented

- Shared sourced comparison metric registry, compact peer comparison and full `/compare` workspace with URL selections (up to six), history, scatter, valuation, margins and balance-sheet views. Client request deduplication reuses financial payloads. Medians reject incompatible currencies/reporting years. Missing data remains missing.
- EPS expectations API and grouped actual/consensus graph, with exact figures and source notes in a disclosure. It now lives on the ticker page.
- Continuous ticker sections with hash links: financials, expectations, profile, network, comparison, evidence and news. Expensive expectations/network sections mount near the viewport. Comparison asks for peers before displaying an empty median table.
- Small-cap search, industry/sector/cap filters, sorting and comparison selection. Latest user correction removes unsupported card metrics and fundamental filter controls and uses the existing heatmap feed without per-card provider calls. Attention list now occupies a right sidebar, stacked below on small screens.
- Financial trend controls reuse StyledSelect. Available history determines range choices; actual dates are visible. Unsupported CAGR tiles are omitted. More compact charts and headings.
- Comparison, profile and portfolio dropdowns use the shared styled component. Empty selectors are safely disabled.
- News company labels occupy their own wider column; badges wrap within the copy column. GOOGL overlap checked at desktop and 768px widths.
- Shared monospace typography, dark surfaces and muted green accent across research pages, derived from comparison. Welcome page has matching visual treatment.
- Extra period-return bar removed. TradingView has its own price/percentage legend enabled. External quote remains explicitly daily; there is no unsupported cross-origin synchronization claim.
- Chat supports Markdown tables and interleaved metric charts, saved-message compatibility, and news-analysis prompts. New-window conversations flush pending saves before opening their saved URL.
- Relationship research expanded from three to five evidence-based passes, preserving source/date/deduplication validation.
- Account code includes email/password and conditional Google/Apple OAuth, verified sessions, backend bearer validation, user-scoped records with RLS migration, optimistic concurrency and local recovery of unsynced edits. Settings/onboarding, opt-in profile context and manual holdings are implemented. Server-rendered financials now forward the verified access token.

### Verification

- Backend: `.venv/bin/pytest -q` — 145 passed; three existing Pydantic deprecation warnings.
- Frontend: `node --test tests/*.test.mjs` — 8 passed, including private-storage isolation/conflicts, comparison semantics and chat block ordering.
- TypeScript, final targeted ESLint, `git diff --check` and production `npx next build --webpack` all passed.
- Browser: AAPL expectations anchor loads real paired EPS bars; news GOOGL labels no longer overlap at desktop/tablet; small-cap sidebar and simplified cards render; comparison StyledSelect opens, changes a metric and restores the prior selection; welcome page renders its honest unconfigured state.
- TradingView script creates an iframe with the intended legend configuration, but its cross-origin content stays blank in this preview browser. Its date-button interaction is NOT verified. The provider link remains available.

### Blocked or incomplete — do not describe as finished

1. **Live authentication and cloud persistence.** Backend-configured Supabase project `gffskqucpyujimxaqzrp` returns HTTP 404 for auth settings. The connected Supabase tool exposes a different project, `sepsnltskwtbmhqnywkd`. Awaiting the user's project choice; no migration or configuration was applied to an unrelated project. Frontend public auth configuration is absent. Local workspace is explicitly development-only; production remains fail-closed. Live two-user RLS/session, email confirmation, Google/Apple callbacks and synced portfolio tests must follow project restoration/selection and migration application.
2. **TradingView date selection.** Verify the actual embedded widget in a browser where the provider renders. No claim that the external price header follows its date range.
3. **Provider coverage.** No connected small-cap earnings/revisions feed, historical valuation series, reliable ROIC or sector-wide benchmark. Original richer small-cap metric cards were intentionally superseded by the user's affordability request. Historical estimate vintages/revenue expectations are not supplied by the earnings endpoint. No fabricated substitutes.
4. **Live AI verification.** Expanded relationship discovery and news-analysis paths have code/tests but no new paid end-to-end research run was performed in this task. Verify real citations/coverage and streaming before calling those integrations fully validated.
5. **Broader product QA.** Six-company responsive comparison, full account switching/recovery and persisted holdings workflows still need end-to-end verification; no production deployment/push performed. Native apps, billing and brokerage execution are future scope.

### Next concrete steps

Confirm/restore the intended Supabase project, configure its public URL/key, apply `supabase/migrations/20260927161755_user_research_state.sql`, configure authorized callback URLs/providers, then test two users for isolation and persistence. Verify TradingView's native period controls in a working provider embed. Keep any remaining coverage-dependent requirements explicit rather than treating empty placeholders as completion.

Latest usage check during UI work: 69% of the five-hour account allowance and 57% of weekly allowance remaining. Architecture work is ready for model handoff; live auth remains externally blocked.
