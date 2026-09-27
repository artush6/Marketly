# Research workspace upgrade

## Scope and starting point

Branch: `codex/research-workspace-upgrade`, based on `codex/investor-intelligence-foundation`, preserving its uncommitted work. No implementation from this request is yet complete. Existing implementation reports describe earlier work and must be revalidated.

The September 27 PDF and pasted checklist are requirements/reference material for the user's request. Example numbers are illustrative, not datasets. Future mobile apps, subscription billing and autonomous trading are architecture considerations, not current deliverables.

Initial inspection: Next.js 16/React 19 frontend, FastAPI backend, Recharts/lightweight-charts, existing provider adapters and Redis/Supabase persistence. Compact comparison is embedded in `frontend/src/components/research/dashboard.tsx`; peers use `backend/app/routes/discovery.py`. Chat renders narrative before all visuals in `rich-chat-message.tsx`. Several private preferences/conversations currently use localStorage. Existing financial-trend and news work is uncommitted.

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

## Current status

- Completed: initial repository inspection, attachment text extraction and screenshot review, new branch, ordered plan.
- Partially completed: architecture/data audit; inherited work has not been revalidated in this chat.
- Not started: implementation steps 2–9.
- Next step: complete baseline verification and data/auth availability audit, then implement the identity/private-data slice.
