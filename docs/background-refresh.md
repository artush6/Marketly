# Background market data

The API starts a Supabase-backed refresh worker in its FastAPI lifespan. It makes
no LLM calls. Apply `supabase/migrations/20260925093816_background_market_refresh.sql`
and `supabase/migrations/20260926094653_relationship_news_intelligence.sql` to the
same project as the backend's `SUPABASE_URL`, then deploy/restart this branch.
The existing cache, snapshots and financial tables from `supabase/schema.sql` are
prerequisites. Only the backend service role can access the queue or its functions.

## Schedule

- Quotes: every five minutes; benchmarks plus watched/opened tickers.
- General market news: every fifteen minutes.
- Earnings calendar: daily, looking back seven days and ahead ninety days.
- Financials: immediately for newly tracked companies; every six hours during the
  seven days beginning on an expected earnings date; otherwise a weekly safety check.
  Release dates can change and a release is not necessarily the SEC filing date.
- Relationship intelligence: every fourteen days for active companies. The job
  skims the latest thirty days of company news and upserts dated partnership,
  customer, and supplier evidence. Normal company-news reads do the same immediately.
- Inactive symbols stop after thirty days without visits. Opening the watchlist
  renews tracking. Funds used as benchmarks only receive quote jobs.

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

All watchlist symbols (up to 100) are registered by `/market/earnings`. Existing
watchlists remain device-local; the shared registry stores ticker symbols, never
private lists or user identifiers. `/financials/{symbol}` still performs an initial
provider fetch when there is no usable snapshot, so previously unseen companies work.
Watching a company queues that fetch before its page is opened. Unsupported symbols
may still have no provider financials; missing values are not invented.

Earnings reminders appear in the app from seven days before the calendar date
through the release day, with stable IDs and device-local dismissal. They are based
on durable calendar data and do not require the site to be open when the calendar
is refreshed. No email/push delivery is configured. Existing price alerts remain
checked in the browser. The app polls reminders and quotes once a minute while
visible. A missing calendar is unknown, not a confirmed absence of earnings.

Quotes are cached separately in Redis and Supabase. Last good prices survive a
provider outage and are labeled when old. Cached company responses overlay these
prices without refetching financial statements. Cache reads no longer extend the
financial cache TTL or rewrite normalized financial tables. Successful financial
refreshes invalidate the derived score cache in both Redis and Supabase; they do not
regenerate paid AI analysis in the background. SEC rows include their
accession and a document URL, falling back to a clearly labeled filing index for
older submissions; provider-supplied FMP document links are also displayed.
