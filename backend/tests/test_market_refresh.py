from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import BackgroundTasks

from app.services import market_refresh as refresh
from app.routes import market


def test_release_window_and_unknown_calendar():
    event = {'date': '2026-10-01'}
    assert refresh.financial_interval([event], date(2026, 9, 30)) == 7 * 86400
    assert refresh.financial_interval([event], date(2026, 10, 1)) == 6 * 3600
    assert refresh.financial_interval([event], date(2026, 10, 8)) == 6 * 3600
    assert refresh.financial_interval([event], date(2026, 10, 9)) == 7 * 86400
    assert refresh.financial_interval([{'date': 'bad'}, {}]) == 7 * 86400


def test_failed_job_backoff_preserves_fencing_token_and_redacts_error():
    job = {'kind': 'financials', 'symbol': 'AAPL', 'attempts': 2, 'lease_token': 'lease'}
    with patch.object(refresh, 'rpc', side_effect=[[job], None]) as rpc, \
         patch.object(refresh, 'execute_job', side_effect=ValueError('secret-token')):
        assert refresh.tick()
    name, payload = rpc.call_args.args
    assert name == 'finish_market_refresh'
    assert payload['p_token'] == 'lease'
    assert payload['p_error'] == 'ValueError'
    assert 235 < (datetime.fromisoformat(payload['p_next']) - datetime.now(timezone.utc)).total_seconds() <= 240


def test_empty_queue_does_no_work():
    with patch.object(refresh, 'rpc', return_value=[]) as rpc:
        assert refresh.tick() is False
    rpc.assert_called_once_with('claim_market_refresh', {})


def test_registration_is_batched():
    with patch.object(refresh.store, 'is_configured', return_value=True), patch.object(refresh, 'rpc') as rpc:
        refresh.register_symbols(['AAPL', 'MSFT'])
    rpc.assert_called_once_with('register_market_symbols', {'p_symbols': ['AAPL', 'MSFT']})


def test_insufficient_financials_retry_instead_of_success():
    with patch('app.integrations.financials.fetch_ticker_financials', return_value={'dataQuality': {'cacheEligible': False}}):
        with pytest.raises(ValueError):
            refresh.execute_job({'kind': 'financials', 'symbol': 'NEW'})


def test_reminders_only_in_next_week():
    today = datetime.now(timezone.utc).date()
    events = [{'symbol': 'AAPL', 'date': (today + timedelta(days=n)).isoformat()} for n in (-1, 0, 7, 8)]
    with patch.object(market.supabase_store, 'get_json_many', return_value={'AAPL': {'events': events}}):
        result = market.earnings(BackgroundTasks(), 'AAPL')
    assert [e['daysUntil'] for e in result['notifications']] == [0, 7]
    assert len({e['id'] for e in result['notifications']}) == 2


def test_cached_quote_served_without_provider_and_marked_stale():
    import json
    quote = {'price': 100, 'fetchedAt': (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
    market.cached_quote.cache_clear()
    with patch.object(market.CacheManager, 'get', return_value=json.dumps(quote)), \
         patch.object(market, 'provider_get') as provider:
        result = market.cached_quote('AAPL', 1)
    assert result['price'] == 100 and result['stale']
    provider.assert_not_called()
    market.cached_quote.cache_clear()


def test_calendar_rejects_invalid_payload_without_overwriting_good_data():
    with patch('app.routes.discovery.provider_get', return_value={}), \
         patch.object(refresh.store, 'set_json') as write:
        with pytest.raises(ValueError):
            refresh.refresh_calendar('AAPL')
    write.assert_not_called()


def test_calendar_updates_schedule_for_release():
    today = datetime.now(timezone.utc).date().isoformat()
    with patch('app.routes.discovery.provider_get', return_value={'earningsCalendar': [
        {'symbol': 'AAPL', 'date': today}, {'symbol': 'OTHER', 'date': today},
        {'symbol': 'AAPL', 'date': 'invalid'},
    ]}), patch.object(refresh.store, 'set_json') as write, patch.object(refresh.requests, 'patch') as update:
        refresh.refresh_calendar('AAPL')
    assert len(write.call_args.args[2]['events']) == 1
    assert update.call_args.kwargs['params']['kind'] == 'eq.financials'


def test_provider_failure_does_not_discard_other_financials():
    from app.integrations import financials
    with patch.object(financials, 'fetch_finnhub_payload', side_effect=RuntimeError), \
         patch.object(financials, 'fetch_fmp_payload', return_value={'financials': {'income_statement': [{'revenue': 42}]}}), \
         patch.object(financials, 'fetch_sec_payload', return_value={}), \
         patch.object(financials, 'fetch_yfinance_dividends', return_value={}), \
         patch.object(financials, 'fetch_yahoo_summary', return_value={}):
        assert any(p.get('financials') for p in financials._collect_provider_payloads('NEW'))


def test_sec_document_matches_accession():
    from app.integrations import financials
    row = {'accessionNumber': '0000000001-26-000001', 'revenue': 42}
    with patch.object(financials, '_sec_lookup_cik', return_value=('0000000001', 'Company')), \
         patch.object(financials, '_sec_company_facts', return_value={'facts': True}), \
         patch.object(financials, '_sec_submissions', return_value={'filings': {'recent': {
             'accessionNumber': ['0000000001-26-000001'], 'primaryDocument': ['report.htm']}}}), \
         patch.object(financials, '_sec_statement_rows', return_value=[row]), \
         patch.object(financials, '_sec_statement_row', return_value={}):
        payload = financials.fetch_sec_payload('NEW')
    result = payload['financials']['income_statement'][0]
    assert result['sourceUrl'] == 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/report.htm'
    assert result['sourceDocumentType'] == 'filing'


def test_company_quote_overlay_never_replaces_a_newer_fetch():
    import json
    from app.routes.financials import get_financials
    payload = {'symbol': 'NEW', '_fetchedAt': '2026-09-25T10:00:00+00:00', 'quote': {'c': 200}}
    quote = {'price': 100, 'fetchedAt': '2026-09-24T10:00:00+00:00'}
    with patch('app.routes.financials.fetch_ticker_financials', return_value=payload), \
         patch('app.routes.financials.CacheManager.get', return_value=json.dumps(quote)):
        assert get_financials('NEW', BackgroundTasks())['quote']['c'] == 200


def test_company_first_load_calls_provider_and_schedules_tracking():
    from app.routes.financials import get_financials
    tasks = BackgroundTasks()
    with patch('app.routes.financials.fetch_ticker_financials', return_value={'symbol': 'NEW'}) as fetch, \
         patch('app.routes.financials.CacheManager.get', return_value=None):
        assert get_financials('new', tasks)['symbol'] == 'NEW'
    fetch.assert_called_once_with('NEW', force_refresh=False)
    assert tasks.tasks[0].args == (['NEW'],)


def test_durable_cache_failure_is_retried_not_marked_success():
    with patch('app.routes.market.provider_get', return_value={'c': 100}), \
         patch('app.routes.market.CacheManager.set', side_effect=RuntimeError('database unavailable')):
        with pytest.raises(RuntimeError):
            refresh.execute_job({'kind': 'quote', 'symbol': 'AAPL'})


def test_calendar_failure_is_visible_to_client():
    from fastapi import HTTPException
    with patch.object(market.supabase_store, 'get_json_many', side_effect=RuntimeError):
        with pytest.raises(HTTPException) as error:
            market.earnings(BackgroundTasks(), 'AAPL')
    assert error.value.status_code == 503


def test_score_invalidation_works_without_redis():
    from app.core.cache import CacheManager
    with patch('app.core.cache.r', None), \
         patch('app.core.cache.supabase_store.delete_json') as delete:
        CacheManager.delete_key(CacheManager.make_key('scores', 'NEW'))
    delete.assert_called_once_with('scores', 'NEW')
