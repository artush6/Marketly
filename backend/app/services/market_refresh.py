"""Bounded background I/O; durable jobs and fenced leases live in Supabase."""
from __future__ import annotations

import logging
from time import monotonic
from datetime import date, datetime, timedelta, timezone
from threading import Event, Thread
from zoneinfo import ZoneInfo

import requests

from app.integrations import supabase_store as store

logger = logging.getLogger(__name__)
DEFAULT_SYMBOLS = ('SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'GOOGL')
NEW_YORK = ZoneInfo('America/New_York')


def is_current_us_session_quote(quote, *, now=None):
    """Avoid attributing stale after-hours or prior-session quotes to today."""
    stamp = quote.get('timestamp') if isinstance(quote, dict) else None
    if not isinstance(stamp, (int, float)) or stamp <= 0:
        return False
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(NEW_YORK)
    if local.weekday() >= 5 or not (9 * 60 + 30 <= local.hour * 60 + local.minute < 16 * 60):
        return False
    return abs(now.timestamp() - stamp) <= 15 * 60


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
        'symbol': symbol, 'from': (today - timedelta(days=90)).isoformat(),
        'to': (today + timedelta(days=365)).isoformat(),
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
        quote = refresh_quote(symbol, durable=True)
        try:
            from app.services.alert_delivery import notify_price_drop, notify_symbol_rules
            if is_current_us_session_quote(quote):
                change = quote.get('changePercent')
                articles = []
                if isinstance(change, (int, float)) and change <= -3:
                    from app.integrations.news import get_news
                    try:
                        articles = get_news(symbol, days=2, max_items=5)
                    except Exception:
                        articles = []
                explanation = {
                    'priceMovePercent': quote.get('changePercent'),
                    'price': quote.get('price'),
                    'observedAt': quote.get('fetchedAt'),
                    'recentArticles': [
                        {key: item.get(key) for key in ('headline', 'summary', 'url', 'source', 'datetime')}
                        for item in articles[:5] if isinstance(item, dict)
                    ],
                    'causeAttribution': 'A nearby headline is not proof of causation. Review the cited source.',
                    'note': 'Daily percentage comes from the quote provider and can be delayed. It is measured against the prior close, not a live intraday high.',
                }
                if isinstance(change, (int, float)) and change <= -3:
                    notify_price_drop(symbol, quote, explanation)
                notify_symbol_rules(symbol, quote, explanation)
        except Exception as exc:
            logger.warning('Price alert evaluation failed for %s: %s', symbol, type(exc).__name__)
        # A modest cadence avoids exhausting the provider's per-minute quota.
        return 300
    if kind == 'news':
        if symbol == 'MARKET':
            refresh_news(durable=True)
            return 900
        from app.integrations.news import get_news
        articles = get_news(symbol, days=2, max_items=12, force_refresh=True)
        from app.services.alert_delivery import notify_important_news
        notify_important_news(symbol, articles)
        return 1800
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
    if kind == 'relationships':
        from app.services.relationship_research import research_relationships
        research_relationships(symbol)
        return 14 * 86400
    if kind == 'small_caps':
        from app.services.small_cap_discovery import (
            SmallCapDiscoveryProfile,
            persist_small_cap_scan,
            scan_small_caps,
        )
        profile_data = job.get('input_payload') or {}
        profile = SmallCapDiscoveryProfile(**profile_data).validate()
        scan = scan_small_caps(profile=profile)
        persist_small_cap_scan(scan)
        from app.services.alert_delivery import notify_discovery_candidates
        notify_discovery_candidates(scan)
        return 7 * 86400
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
        next_watchlist_sync = 0.0
        while not self.stop_event.is_set():
            try:
                if not initialized:
                    register_symbols(DEFAULT_SYMBOLS)
                    rpc('enqueue_market_refresh', {'p_kind': 'news', 'p_symbol': 'MARKET'})
                    initialized = True
                if monotonic() >= next_watchlist_sync:
                    try:
                        from app.services.alert_delivery import symbols_to_refresh
                        symbols = sorted(symbols_to_refresh())
                        register_symbols(symbols[:500])
                    except Exception as exc:
                        response = getattr(exc, 'response', None)
                        status = getattr(response, 'status_code', None)
                        try:
                            detail = (response.json().get('message') or response.json().get('error') or '')[:180]
                        except Exception:
                            detail = ''
                        logger.warning('Alert watchlist sync failed: %s%s',
                                       f'HTTP {status}' if status else type(exc).__name__,
                                       f' — {detail}' if detail else '')
                    next_watchlist_sync = monotonic() + 300
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
