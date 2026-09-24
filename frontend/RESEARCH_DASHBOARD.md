# Research dashboard experiment

Branch: `codex/research-dashboard`.

The home page is now a market overview in a dark terminal-inspired interface. Select a watchlist company or use search to open company research. The existing conversational workspace remains at `/assistant`; financial drill-downs remain at `/financials/[symbol]`.

## Included

- Global market overview with cached benchmark ETF quotes (SPY/QQQ/DIA/IWM), general market news, a watchlist daily-change map with an optional TradingView S&P 500 heatmap, and up to 12 watchlist quotes. ETF proxies are labeled explicitly.
- Bottom chat dock on market and company views using the existing backend OpenAI configuration. It sends the displayed context and up to ten previous conversation messages, supports minimize/clear/error recovery, and makes no AI call until submitted. Conversations are held in memory and reset when the research context changes.

- Debounced company/ticker search through Finnhub, with an explicitly labeled small local catalog/direct-ticker fallback when discovery is unavailable.
- Embedded TradingView chart and existing backend financial/news data. AI brief generation is on demand.
- Local watchlist and up to 30 saved research snapshots (financials, up to 12 news articles, optional generated analysis).
- Price conditions checked against the selected company's fetched quote on opening/refreshing. They are in-app conditions, not background/email/push notifications.
- Up to six manually selected competitors or four Finnhub-suggested peers. Comparison shows P/E, net margin, reporting dates, and unweighted selected-peer means. Missing values are excluded and sample counts are shown. This is not an industry-wide average.
- Evidence tab identifying statement inputs, calculations, and available provider provenance. Generated narrative does not yet have filing-passage citations.
- Publisher images in news cards and HTTPS article-link previews using Open Graph/Twitter metadata. Private-network targets, unsafe schemes, excessive redirects, oversized pages, and timeouts are rejected. Paywalled/blocked publishers may not expose previews.
- Responsive layouts, keyboard search, error states, and reduced-motion support.

## Local development

Run the backend from `backend`:

```sh
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8012
```

Run the frontend from `frontend`:

```sh
BACKEND_API_URL=http://127.0.0.1:8012 npm run dev -- --port 3012
```

Search and suggested peers need the existing backend `FINNHUB_API_KEY`. The new market/discovery routes and updated assistant route must be deployed alongside the frontend if using the hosted API. This branch does not modify credentials or database schemas.

## Intentionally deferred

Accounts/cloud sync, background monitoring, full industry aggregates, historical comparison snapshots, document retrieval and claim-level AI citations. Saved data belongs to this browser/device; clearing site data removes it. Watchlists start with four example companies, not sample prices.

## Checks

- Discovery route tests cover distinct listings, de-duplication, invalid input, absent configuration, and provider errors.
- Browser checks cover live search/data, saved snapshots surviving reload, peer means with missing values, article previews, alerts, and narrow-screen layout.
- Production build now checks the full repository. Missing dependencies in the older UI components and their stale window/calendar types have been repaired.
- The external TradingView embed may be blocked by the in-app browser; the local watchlist map works independently and a direct TradingView link remains available.
