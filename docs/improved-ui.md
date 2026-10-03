# Marketly UI refinement

Based on the combined desktop/mobile redesign. Shared header, sidebar, mobile navigation and company search now cover the dashboard, comparison, portfolio, settings and financial statement routes.

## Delivered
- Dense Small Cap screener with sticky company column, real market-cap/performance and available fundamentals, compare selection, saved filter set and collapsible scan panel.
- Calendar agenda with earnings dates, periods, timing, provenance and estimated status; original month navigation retained.
- Searchable saved snapshots with a master/detail reading pane, original reopen/delete behavior and saved conversations.
- Watchlist table with company search and research links, preserving existing alerts.
- Alerts inbox category and unread filters; existing notification preferences, permissions and delivery unchanged.
- Market breadth summary cards, daily participation and sector bars using the covered universe.
- Shared compact charts/tables/panels across company research, financial statements, news, comparison and portfolio.
- Two-column settings with local table-density and text-size preferences; original profile and privacy controls retained.
- Company-specific assistant starter questions; existing assistant transport and conversations retained.
- Single mobile bottom navigation, Small CAP shortcut, top critical-alert bell and the mint bar logo inherited from the combined branch.

## Data boundaries
No fabricated data was introduced. Calendar currently supports provider earnings only, not macro actual/forecast values. Breadth is a daily snapshot; intraday advance/decline history is not supplied. Small Cap fundamentals depend on cache coverage; missing values remain dashes. Discovery worker failures remain visible. Private alerts require an authenticated session. Theme stays within Marketly's existing appearance system; the new controls only change table readability.

## Verification
- Production build and TypeScript passed.
- All 13 frontend Node tests passed.
- Changed component lint passed. Whole-project lint retains three existing errors (two explicit-any declarations in portfolio-panel.tsx and the test variable named module) plus two existing toast warnings.
- Browser checked at 1440x900 and 390x844: screener, single mobile navigation, settings, earnings agenda, real market overview/breadth. Fixed narrow screener filter overflow found during verification.
- No end-to-end authenticated notification delivery or paid AI request was performed.

## Next backend improvements
Add a licensed economic-events feed for actual/forecast/previous fields, historical breadth series, and wider verified screener fundamental coverage. These should arrive through existing provider/service boundaries rather than UI fixtures.
