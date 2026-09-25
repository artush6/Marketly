"""Bounded background I/O; durable jobs and fenced leases live in Supabase."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from threading import Event, Thread

import requests

from app.integrations import supabase_store as store

logger = logging.getLogger(__name__)
DEFAULT_SYMBOLS = ('SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL')


def rpc(name, payload):
    response = requests.post(store._rest_url('rpc/' + name), headers=store._headers(),
                             json=payload, timeout=10)
    response.raise_for_status()
    return response.json() if response.content else None


def register_symbols(symbols):
    if not store.is_configured():
        return
    if symbols:
        rpc('register_market_symbols', {'p_symbols': list(symbols)})


def earnings_events(symbol):
    payload = store.get_json('earnings_calendar', symbol)
    return payload.get('events', []) if isinstance(payload, dict) else []


def financial_interval(events, today=None):
    today = today or datetime.now(timezone.utc).date()
    for event in events:
        try:
            days_after = (today - date.fromisoformat(event['date'])).days
        except (KeyError, TypeError, ValueError):
            continue
        # Earnings release dates and filing dates differ; retry for a week.
        if 0 <= days_after <= 7:
            return 6 * 3600
    return 7 * 86400  # safety sweep for unknown dates, amendments and calendar gaps


def refresh_calendar(symbol):
    from app.routes.discovery import provider_get
    today = datetime.now(timezone.utc).date()
    payload = provider_get('calendar/earnings', {
        'symbol': symbol, 'from': (today - timedelta(days=7)).isoformat(),
        'to': (today + timedelta(days=90)).isoformat(),
    })
    if not isinstance(payload, dict) or not isinstance(payload.get('earningsCalendar'), list):
        raise ValueError('Invalid earnings calendar')
    events = []
    for item in payload['earningsCalendar']:
        if not isinstance(item, dict) or item.get('symbol') != symbol:
            continue
        try:
            date.fromisoformat(item['date'])
        except (KeyError, TypeError, ValueError):
            continue
        events.append({key: item.get(key) for key in ('symbol', 'date', 'hour', 'year', 'quarter')})
    store.set_json('earnings_calendar', symbol, {
        'events': events, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'source': 'Finnhub',
    }, 2 * 86400, strict=True)
    # Bring the next financial check forward to a newly discovered release date.
    dates = [date.fromisoformat(e['date']) for e in events]
    upcoming = [d for d in dates if d >= today - timedelta(days=7)]
    if upcoming:
        due = datetime.combine(max(today, min(upcoming)), datetime.min.time(), tzinfo=timezone.utc)
        response = requests.patch(store._rest_url('market_refresh_jobs'), headers=store._headers(),
            params={'kind': 'eq.financials', 'symbol': 'eq.' + symbol,
                    'next_run_at': 'gt.' + due.isoformat()},
            json={'next_run_at': due.isoformat()}, timeout=10)
        response.raise_for_status()


def execute_job(job):
    from app.routes.market import refresh_quote, refresh_news
    from app.integrations.financials import fetch_ticker_financials, make_json_safe
    kind, symbol = job['kind'], job['symbol']
    if kind == 'quote':
        refresh_quote(symbol, durable=True)
        # A modest cadence avoids exhausting the provider's per-minute quota.
        return 300
    if kind == 'news':
        refresh_news(durable=True)
        return 900
    if kind == 'calendar':
        refresh_calendar(symbol)
        return 86400
    if kind == 'financials':
        payload = fetch_ticker_financials(symbol, force_refresh=True)
        if not payload.get('dataQuality', {}).get('cacheEligible'):
            raise ValueError('Financial provider returned insufficient data')
        # Do not mark the job successful unless its durable cache is written.
        store.set_json('tickers', symbol, make_json_safe(payload), 86400, strict=True)
        from app.core.cache import CacheManager
        CacheManager.delete_key(CacheManager.make_key('scores', symbol))
        return financial_interval(earnings_events(symbol))
    raise ValueError('Unknown refresh job')


def tick():
    jobs = rpc('claim_market_refresh', {}) or []
    if not jobs:
        return False
    job = jobs[0]
    error = None
    try:
        seconds = execute_job(job)
    except Exception as exc:
        # Store only the exception type: provider exceptions can contain API keys.
        error = type(exc).__name__
        seconds = min(6 * 3600, 60 * 2 ** min(job['attempts'], 8))
        logger.warning('Refresh failed for %s/%s: %s', job['kind'], job['symbol'], error)
    rpc('finish_market_refresh', {
        'p_kind': job['kind'], 'p_symbol': job['symbol'], 'p_token': job['lease_token'],
        'p_next': (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat(),
        'p_error': error,
    })
    return True


class RefreshWorker:
    def __init__(self):
        self.stop_event = Event()
        self.thread = Thread(target=self.run, daemon=True, name='market-refresh')

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=2)

    def run(self):
        initialized = False
        while not self.stop_event.is_set():
            try:
                if not initialized:
                    register_symbols(DEFAULT_SYMBOLS)
                    rpc('enqueue_market_refresh', {'p_kind': 'news', 'p_symbol': 'MARKET'})
                    initialized = True
                tick()
            except Exception as exc:
                logger.warning('Refresh queue unavailable: %s', type(exc).__name__)
            self.stop_event.wait(5)


if __name__ == '__main__':
    if not store.is_configured():
        raise SystemExit('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    worker = RefreshWorker()
    try:
        worker.run()
    except KeyboardInterrupt:
        worker.stop_event.set()
