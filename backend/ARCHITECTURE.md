## Backend Architecture

This backend is intentionally small. The live request flow is:

`route -> integration` for simple endpoints
`route -> service -> integrations` only when multiple sources need to be combined

### Live Entry Points

- `app/main.py` mounts the active routers.
- `app/routes/financials.py` exposes `/financials/{symbol}`.
- `app/routes/news.py` exposes `/news/*`.
- `app/routes/econ_situation.py` exposes `/economics`.
- `app/routes/analysis.py` exposes `/score/{symbol}`.

### Where Logic Lives

- `app/integrations/financials.py` aggregates stock data from external providers.
- `app/integrations/news.py` fetches and caches company news.
- `app/integrations/economics.py` fetches macro indicators from FRED.
- `app/integrations/gpt.py` turns collected data into an AI score.
- `app/services/analysis_service.py` is the only remaining service layer because it combines financials, news, macro data, and GPT output into one response.

### Shared Infrastructure

- `app/core/config.py` loads environment variables.
- `app/core/cache.py` provides optional Redis-backed caching. If `REDIS_URL` is unset or Redis is unavailable, caching is skipped and the app still runs.
- `app/models.py` holds the typed financial data model used by analysis.
- `app/serialization.py` provides a small JSON-safe cleanup helper used before returning AI output.
- `app/schemas/analysis.py` defines the public response model for `/score/{symbol}`.

### Current Product Surface

- The frontend currently calls the financials endpoint.
- News, economics, and score endpoints are available directly from the API.
- There is no active portfolio ingestion flow in the current app.

### Keep It Simple

- Add a new `service` only when logic combines multiple integrations or owns a business rule.
- Put provider-specific code in `integrations`.
- Remove placeholder files instead of keeping speculative scaffolding.
