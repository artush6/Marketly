# Background market data

The FastAPI service starts the Supabase-backed refresh worker in its lifespan
when `BACKGROUND_REFRESH_ENABLED=true` and Supabase is configured. The production
project has the ordered migrations listed in [the Supabase guide](../supabase/README.md).
Use the same project URL for the backend and frontend Auth. Only the backend
service role can access the queue or its functions. Render keeps the API and
worker in one web service; a separate worker service is optional, not required.

## Schedule

- Quotes: every five minutes; benchmarks plus watched/opened tickers.
- General market news: every fifteen minutes.
- Earnings calendar: daily, looking back seven days and ahead ninety days.
- Financials: immediately for newly tracked companies; every six hours during the
  seven days beginning on an expected earnings date; otherwise a weekly safety check.
  Release dates can change and a release is not necessarily the SEC filing date.
- Relationship intelligence: every fourteen days for active companies, using three
  web research passes (supply chain, partnerships, ownership/competition). These use
  the configured OpenAI model with high reasoning effort and search historical
  filings and issuer disclosures without a recent-news cutoff. Requires OPENAI_API_KEY
  and incurs model/search usage. Manual Deep research queues the same durable job,
  with a fifteen-minute cooldown after success. The UI polls its progress.
  Validated dated evidence is upserted into company_relationships; citations must
  appear in retrieved web results, self-links are rejected, and old evidence is
  preserved. Each record labels current/historical/uncertain status. The research
  report (including partial failures and coverage gaps) is saved in market_data_cache.
  News regexes remain discovery hints and no longer create verified graph edges.
- Inactive symbols stop after thirty days without visits. Opening the watchlist
  renews tracking. Funds used as benchmarks only receive quote jobs.
- Small-cap discovery runs a bounded weekly scan and records candidate history.
  Discovery scores/probabilities are heuristic and not calibrated forecasts.

The worker processes one job at a time and pauses five seconds between jobs. These
are target intervals: large lists, provider latency and rate limits can delay runs.
Errors retain the previous good cache and retry with exponential backoff. Supabase
row locks and fifteen-minute fenced leases prevent concurrent workers claiming the
same job; interrupted jobs become eligible after the lease expires. Job state exposes
`last_success_at`, `last_error`, `attempts` and `next_run_at` for operational inspection.

## Running continuously

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FINNHUB_API_KEY` and a real
`SEC_USER_AGENT` on the backend. Existing FMP credentials improve financial coverage.
`BACKGROUND_REFRESH_ENABLED=true` is the default when Supabase is configured.
For a separate always-on worker, disable the API loop and run from `backend/`:

```sh
BACKGROUND_REFRESH_ENABLED=false uvicorn app.main:app --host 0.0.0.0 --port 8000
python -m app.services.market_refresh
```

A sleeping or stopped Render web service cannot execute a Python worker. Use an
always-on service or dedicated worker for continuous refreshes. Database migrations
alone do not deploy the application or keep its hosting process awake.

## User behavior

Signed-in watchlists are stored in `user_research_state`; the worker syncs watched
symbols from those account records into a shared bounded refresh queue. The queue
contains tickers and job state, not private theses or preferences. `/financials/{symbol}` still performs an initial
provider fetch when there is no usable snapshot, so previously unseen companies work.
Watching a company queues that fetch before its page is opened. Unsupported symbols
may still have no provider financials; missing values are not invented.

Earnings reminders appear in the app from seven days before the calendar date
through the release day, with stable IDs and device-local dismissal. They are based
on durable calendar data. Optional Web Push alerts cover followed-stock daily drops
(3%, 5%, 10%), relevant important ticker news, custom price/daily-move crossings,
and high-scoring small-cap discovery candidates. Custom-rule symbols remain in
the refresh queue even when they are not on the user's watchlist. Alerts are saved
to the account inbox; push delivery requires VAPID keys in the Render backend
environment. The site need not stay open after a device is subscribed. The bounded
small-cap scan is not a complete scan of every listed company or a calibrated return
forecast.
For iPhone, use the Home Screen web app on iOS 16.4 or later. See
[Account and deployment setup](account-and-deployment.md). A missing calendar is
unknown, not a confirmed absence of earnings.

Quotes are cached separately in Redis and Supabase. Last good prices survive a
provider outage and are labeled when old. Cached company responses overlay these
prices without refetching financial statements. Cache reads no longer extend the
financial cache TTL or rewrite normalized financial tables. Successful financial
refreshes invalidate the derived score cache in both Redis and Supabase; they do not
regenerate paid AI analysis in the background. SEC rows include their
accession and a document URL, falling back to a clearly labeled filing index for
older submissions; provider-supplied FMP document links are also displayed.
