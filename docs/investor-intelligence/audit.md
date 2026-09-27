# Investor intelligence expansion — audit and delivery plan

Audited 2026-09-27 against the supplied 43-section brief. Branch: `codex/investor-intelligence-foundation`.

## Scope and architecture

This is a multi-release product expansion, not a single UI patch. A planning estimate is 8–16 engineering weeks for the core platform, plus provider procurement, historical backfill and document-quality work. This is an estimate, not a delivery commitment; licensing and source coverage can materially change it. This branch completes one bounded foundation slice.

The current stack is Next.js 16 / React 19, a Next backend proxy, FastAPI, provider integrations, deterministic scoring/fact services and an OpenAI narrative layer. `dashboard.tsx` owns company research and local watchlists; `CompanyFinancials` already charts statements; `CompanyResearchSnapshot` already provides condensed signals. `companies/{symbol}/intelligence` already supplies objective summary metrics. Finnhub supplies profiles/quotes/discovery, FMP supplies statements/ratios, SEC supplies XBRL and filing evidence, and RapidAPI supplies additional profile fields. Relationship research and news triage already exist.

Redis fronts a durable Supabase cache. Supabase also defines company, statement, fact, document, event, analysis and snapshot entities. Background refresh uses durable jobs, fenced leases, tracked symbols and earnings-aware financial cadence. Tables in schema files do not establish that every feature is implemented or every migration is deployed. Watchlists, saved reports and price alerts use browser local storage; a production authenticated user model is a prerequisite for private cross-device theses and visit cursors.

## Requirements checklist

“Partial” means useful implementation exists but does not fulfill the entire requested section. Nothing in this table implies account entitlement or complete international coverage.

| # | Area | Existing status / missing work | This branch |
|---|---|---|---|
| 1 | Identity | Partial: names, sector, country, logo, description, website, employees, HQ; no reliable founding/segment coverage | Reuse |
| 2 | Leadership | Partial: CEO and officer names/titles; no board, tenure, biographies, compensation evidence | Reuse; enrichment pending |
| 3 | Alignment | Missing dedicated ownership/compensation/turnover view | Pending |
| 4 | Financials | Partial: statements, annual/quarter filters, charts, filing links | Added period-aware YoY and exact-horizon CAGR API/UI |
| 5 | Quality | Partial: scoring and current margin/growth metrics; no complete 3/5/10Y series | Added reported/derived trend explorer; ROIC and full return ratios pending |
| 6 | Consensus | Missing normalized multi-period consensus; target prices are not consensus earnings | Pending |
| 7 | Revisions | Missing immutable estimate vintages and revision comparisons | Pending |
| 8 | Surprises | Missing comparable actual/consensus series and generic KPI framework | Pending |
| 9 | Guidance | Missing structured guidance ledger | Pending |
| 10 | Valuation | Partial: current multiples/scoring; no historical medians/ranges | Reuse; historical comparison pending |
| 11 | Peers | Partial: Finnhub peer discovery and selected comparisons | Editable groups and broader comparison pending |
| 12 | Segments | Missing normalized segment history | Pending |
| 13 | Geography | Country/HQ exists; geographic revenue is missing | Pending |
| 14 | Relationships | Partial: researched relationship evidence, graph UI and news signals | Reuse; exposure completeness unverified |
| 15 | Ownership | Missing shareholder/time-series ownership feed | Pending |
| 16 | Insiders | Missing transaction feed and transaction-code interpretation | Pending |
| 17 | Capital allocation | Partial: basic cash-flow charts and summary ratios | Added SBC, repurchases, acquisition, repayment and issuance series when supplied |
| 18 | Dilution | Partial: outstanding-share annualized change; not diluted-share history | Added weighted-average diluted-share series; explicit 5/10Y total changes pending |
| 19 | Dividends | Partial: yield/rate/cash dividends | Added historical paid dividends and FCF payout; payment calendar/growth streak pending |
| 20 | Events | Partial: earnings reminders/calendar and analysis events | Broader sourced company/watchlist events pending |
| 21 | Documents | Partial: original SEC filing links; source-document schema | Searchable document center/transcripts pending |
| 22 | AI documents | Chat/narrative exists; no passage-indexed company-document Q&A | Pending |
| 23 | Language changes | Missing cited transcript comparisons | Pending |
| 24 | News | Partial: deterministic importance/categories, relationship signals, durable news | Full underlying-event clustering/personalization pending |
| 25 | What Changed | Missing per-user visit cursor and fundamental event diff | Pending |
| 26 | Thesis | Analysis contains thesis prose; private structured user thesis missing | Pending |
| 27 | Thesis detection | Missing assumption registry and sourced violations | Pending |
| 28 | Watchlists | Partial: browser-local list, news and earnings | Fundamental change rollup and account sync pending |
| 29 | Portfolio | No production holdings/transactions/exposure model | Pending |
| 30 | Portfolio feed | Missing owned-company event feed | Pending |
| 31 | Home | Existing market/news workspace | Personalized fundamental-priority home pending |
| 32 | Screener | Partial: company discovery/small-cap UI | Validated structured filter API and advanced filters pending |
| 33 | Point-in-time | Snapshot storage exists; insufficient estimate vintages/backtesting semantics | No PIT claim; pending |
| 34 | Provenance | Partial: source maps, facts, SEC links | Added per-trend source, currency, filing/retrieval dates, reported/calculated kind and formulas |
| 35 | Freshness | Partial: data-quality and retrieval times | Snapshot retrieval displayed separately from fiscal period |
| 36 | Summary | Existing company research snapshot | Reuse; consensus/management/thesis fields pending |
| 37 | Mobile/iPad | Reusable HTTP API and responsive web exist | Same trend response available to future clients; no native apps |
| 38 | UI | Existing calm research UI | One trend explorer with controls, chart and expandable evidence table |
| 39 | Navigation | Overview, company details, financials, relationships already exist | Extended Financials; no empty placeholder tabs |
| 40 | Availability audit | Provider code and persisted schema inspected | Matrix below |
| 41 | Phasing | Existing relationships are ahead of proposed order | Updated phases below |
| 42 | Signal over volume | Existing summaries/scoring | One selected metric and evidence at a time |
| 43 | Delivery report | — | This audit plus implementation report |

## Data availability matrix

The existing integrations establish what is currently ingested. Provider catalogs establish possible sources, not account permissions. Paid endpoints, redistribution/display rights, numeric quotas and historical coverage must be verified with the actual account before enabling them. No new paid requests were made.

| Feature | Data required | Current / proposed source | Available now? | Refresh plan | Cost / API limitation | Fallback |
|---|---|---|---|---|---|---|
| Profile/management | Identity and officer fields | Finnhub profile + RapidAPI profile | Partial | Existing statement/profile cadence | RapidAPI subscription can reject profile requests | Missing field, source filing link |
| Board/compensation | Proxy tables, role dates, pay currency/period | SEC DEF 14A / issuer proxy | Not ingested | Annual + event updates | Extraction/reconciliation required; non-US coverage varies | Linked proxy, no inferred pay/tenure |
| Financials/quality | Classified period statements | FMP + SEC | Partial histories | Existing earnings-aware refresh | History length and FMP access; SEC normalization selects limited quarterly rows | Only returned history; no synthetic annual totals |
| Consensus | Metric/target period/distribution/count/basis | FMP analyst estimates or Finnhub estimate APIs | Not ingested | Daily / post earnings | Account entitlement and display rights unverified; median/counts vary | Explicit unavailable |
| Revisions | Immutable timestamped consensus vintages | Same source + existing snapshot infrastructure | Missing | Daily capture | Historical vintages cannot be reconstructed from today's estimates | Start collecting prospectively |
| Surprises | Pre-release consensus and comparable reported actual | Provider earnings + issuer releases | Missing normalized dataset | Earnings release | Adjusted vs GAAP and period alignment | No comparison until basis matches |
| Guidance | Dated metric/range/currency/basis/source passages | Official earnings releases and transcripts | Not ingested | Each release/update | Extraction cost; withdrawal/raised status requires prior guidance | Linked original release |
| Insider activity | Forms 3/4/5 and transaction codes | SEC / Finnhub insider transactions | Not ingested | Daily | Account entitlement, amendments and derivative transactions | Official form; no inferred open-market label |
| Ownership | Shareholders, shares, denominator, filing dates | SEC 13F/13D/13G / provider ownership | Not ingested | Filing-driven, quarterly | Reporting lag; duplicate manager/fund holdings; non-US gaps | Show coverage limits; no invented retail residual |
| Segments/geography | Issuer segment labels and comparable history | Issuer filings / FMP segment endpoints | Not ingested | Quarterly/annual | Segment restatements and provider plan limits | Source filing; no HQ-as-revenue proxy |
| Supply chain | Named relationships, direction and evidence | Existing researched relationships | Partial | Existing research/news refresh | Search/LLM cost; evidence does not ensure quantitative exposure | Show evidence and missing exposure |
| Transcripts/doc research | Licensed text, timestamps, passage IDs | Finnhub/FMP or issuer IR | Not ingested | Each call | Licensing, coverage, extraction/index cost | Official IR links; no uncited generated answers |
| Historical valuation | As-of prices, shares, denominators and currencies | Existing market/fundamentals + backfill | Not assembled | Daily snapshots | Restatements, splits and look-ahead bias | Current multiples only |
| Private thesis/visits | Auth identity, assumptions, cursor | Authenticated user tables with RLS | Missing | User action / event update | Requires auth and migrations, not localStorage alone | No cross-device/private persistence claim |

Provider references checked during audit: [FMP catalog](https://site.financialmodelingprep.com/developer/docs), [Finnhub official client/API inventory](https://github.com/Finnhub-Stock-API/finnhub-python), [Finnhub](https://finnhub.io/). These list candidate endpoints; they do not verify Marketly's account entitlements.

## Phases and next exact steps

1. **Foundation slice (this branch):** period/currency-aware trends, cash allocation/dilution, provenance and regression tests. No duplicate storage or provider pipeline.
2. **Complete foundation:** verify statement depth and duration metadata; add safe annual/quarterly backfill through the existing adapter; enrich issuer identity/board/compensation with dated evidence; integrate ownership and coded insider activity. Fix any older summary calculations that still use mixed or incompletely classified source rows.
3. **Expectations:** run entitlement checks without persisting keys; define metric/period/basis schema; reuse snapshot storage with observation timestamps and idempotency; capture consensus daily; expose revisions only when baseline vintages exist; add surprises and guidance separately. Add worker job kinds and freshness policies to the existing scheduler.
4. **Research:** populate existing source-document entities, passage indexing, search and citation validation; then transcript comparisons and document Q&A.
5. **Personal intelligence:** authenticated user/RLS model, private thesis/assumption tables, visit cursors, event ledger, fundamental watchlist/home feed; then real portfolio holdings and look-through exposure.
6. **Advanced:** segment/geographic history, structured screener, expanded exposure graph and genuinely point-in-time backtesting datasets.

Every phase needs API contracts, provider coverage fixtures, missing-data behavior, migration/RLS tests where applicable, and end-to-end UI validation before claiming completion.
