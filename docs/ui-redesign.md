# Desktop and mobile redesign

This branch includes the desktop redesign plus mobile and tablet navigation, editorial layouts, and a modal assistant sheet. It branches from committed baseline `0112ae0`; pre-existing uncommitted changes in the original checkout were deliberately left untouched and are not included.

## Implementation

- `redesign.css`: desktop sidebar, reserved right assistant column, compact benchmark cards, editorial briefing, watchlist/map placement, restrained surface tokens and laptop adaptation.
- `market-overview.tsx`: source-based briefing thumbnails and metadata, introductory context. Existing data fetching and actions retained; missing values stay missing.
- `chat-dock.tsx`: collapsible dock, suggestion buttons, compact history; mobile uses the existing Vaul dependency for a focus-managed, swipe-dismissible modal sheet. Existing conversation state, strategy, horizon, web search, separate window and full workspace remain available.
- `mobile-navigation.tsx`: Markets/Search/News/Watchlist/More navigation and secondary destination drawer.
- `mobile-redesign.css`: safe-area-aware fixed controls, two-column cards, tablet layout, touch targets and editorial images.
- `layout.tsx` and `dashboard.tsx`: stylesheet/component wiring and safe-area viewport configuration.

The original redesign preserved backend contracts. The follow-up adds the authenticated alert summary endpoint described below.

## Validation

- TypeScript and ESLint on changed TSX files passed.
- Production build passed.
- All 13 existing frontend tests passed.
- Full repository lint reports pre-existing errors: two explicit-any errors in portfolio-panel.tsx and the forbidden `module` variable in workspace-upgrade.test.mjs; two existing toast warnings.
- Browser inspected at phone (390×844), tablet (820×1180), laptop (1280×900), and desktop dimensions. Checked assistant opening/dismissal, history layout, More menu, and contained service-error states. Tablet/laptop document widths did not overflow.
- Market backend unavailable in isolated previews, so populated news/heatmap, authenticated persistence, and successful assistant responses are not end-to-end verified. The default development launcher also requires the original backend Python environment; frontend previews used Next directly with development-only local workspace mode.

## Deliberate limits

The map retains its actual daily data and existing sector/search/expand/refresh controls. Historical timeframe buttons, benchmark sparklines, and watchlist market caps were not fabricated because these modules do not supply the required data. The assistant uses a fixed desktop width and one mobile sheet height; resize handles and multiple snap heights remain optional follow-up enhancements. No new topic taxonomy was invented for the editorial feed. Branches are committed locally, not merged or deployed.


## October 3 UX revision

- Rebuilt assistant presentation using `assistant.css`: bounded viewport height (960px maximum on desktop), separate Chat/History views, a single close action, secondary window actions under an options menu, suggestions anchored near the composer, multiline drafting, Enter to send / Shift+Enter for a newline, compact settings below the input, and truthful context chips.
- Preserved message delivery, saved conversations, source rendering, strategy, horizon, and web search. Browser verified a suggestion populates the draft, the draft survives History switching, web search toggles, and the header bell opens Alerts. Desktop assistant bounds were 46–990px in a 1000px viewport; Saved research icon measured 16px and visible.
- Replaced SVG, ICO (16/32/48px), and Apple touch icon with the mint three-bar brand mark.
- Header alert bell counts unread `critical` alerts only. `/notifications/summary` authenticates the user and requests an exact filtered count, independent of the inbox's 50-item page. Zero or unavailable counts show no badge. Mark-read success triggers a refresh; foreground polling runs every minute. No schema changes or deployment performed.
- Four backend tests cover exact totals beyond one inbox page, zero, missing count, filtering/user scoping, and authentication. Live authenticated badge data remains unverified without backend credentials/services in the preview.
- Mobile has only the bottom navigation: Markets, Small CAP, News, Watchlist, More. Alerts moved to the top-right bell; search remains in the header.
