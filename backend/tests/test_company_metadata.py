from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from app.integrations import company_metadata as metadata
from app.main import app


@pytest.fixture(autouse=True)
def clear_metadata():
    metadata._memory.clear()
    metadata._inflight.clear()
    yield
    metadata._memory.clear()
    metadata._inflight.clear()


def test_profile_persisted_once_and_shared_with_ui():
    profile = {'ticker': 'MSFT', 'name': 'Microsoft', 'logo': 'https://example.com/msft.png', 'exchange': 'NASDAQ', 'unused': 'omit'}
    with patch.object(metadata.supabase_store, 'get_json', return_value=None), \
         patch.object(metadata.supabase_store, 'set_json') as save, \
         patch('app.routes.discovery.provider_get', return_value=profile) as provider:
        first = metadata.get_profile('MSFT')
        assert metadata.get_metadata(['MSFT'])[0]['logoUrl'] == profile['logo']
        assert metadata.get_profile('MSFT') == first
    provider.assert_called_once()
    save.assert_called_once()
    assert 'unused' not in save.call_args.args[2]
    assert save.call_args.args[3] == metadata.PROFILE_TTL


def test_parallel_ui_and_financial_discovery_singleflight():
    entered, release = Event(), Event()
    def provider(*args):
        entered.set()
        assert release.wait(2)
        return {'ticker': 'MSFT', 'name': 'Microsoft'}
    with patch.object(metadata.supabase_store, 'get_json', return_value=None), \
         patch.object(metadata.supabase_store, 'set_json'), \
         patch('app.routes.discovery.provider_get', side_effect=provider) as fetch, \
         ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(metadata.get_profile, 'MSFT')
        assert entered.wait(2)
        second = pool.submit(metadata.get_profile, 'MSFT')
        release.set()
        assert first.result() == second.result()
    fetch.assert_called_once()


def test_batch_reuses_persisted_profiles_without_provider():
    profiles = {'MSFT': {'name': 'Microsoft', 'logo': None}, 'AAPL': {'name': 'Apple'}}
    with patch.object(metadata.supabase_store, 'get_json_many', return_value=profiles) as read, \
         patch('app.routes.discovery.provider_get') as provider:
        result = metadata.get_metadata(['MSFT', 'AAPL'])
    assert [item['name'] for item in result] == ['Microsoft', 'Apple']
    read.assert_called_once()
    provider.assert_not_called()


@pytest.mark.parametrize('url', ['javascript:alert(1)', 'http://example.com/a.png', None, 123])
def test_invalid_logo_is_omitted(url):
    with patch.object(metadata.supabase_store, 'get_json', return_value=None), \
         patch.object(metadata.supabase_store, 'set_json'), \
         patch('app.routes.discovery.provider_get', return_value={'name': 'Example', 'logo': url}):
        assert metadata.get_profile('TEST')['logo'] is None


def test_one_company_failure_does_not_abort_batch():
    def provider(path, params):
        if params['symbol'] == 'BAD':
            raise ValueError('Provider unavailable')
        return {'name': 'Microsoft', 'ticker': 'MSFT'}
    with patch.object(metadata.supabase_store, 'get_json_many', return_value={}), \
         patch.object(metadata.supabase_store, 'set_json'), \
         patch('app.routes.discovery.provider_get', side_effect=provider):
        result = metadata.get_metadata(['BAD', 'MSFT'])
    assert [item['status'] for item in result] == ['unavailable', 'available']


def test_empty_profile_negative_cache():
    with patch.object(metadata.supabase_store, 'get_json', return_value=None), \
         patch.object(metadata.supabase_store, 'set_json') as save, \
         patch('app.routes.discovery.provider_get', return_value={}) as provider:
        metadata.get_profile('UNKNOWN')
        metadata.get_profile('UNKNOWN')
    provider.assert_called_once()
    assert save.call_args.args[3] == 86400


def test_metadata_route_validates_symbols():
    client = TestClient(app)
    assert client.get('/companies/metadata', params={'symbols': '../bad'}).status_code == 422
    assert client.get('/companies/metadata', params={'symbols': ','.join('S'+str(n) for n in range(13))}).status_code == 422


def test_speculative_financial_request_does_not_track_company():
    from app.routes.financials import get_financials
    from fastapi import BackgroundTasks
    tasks = BackgroundTasks()
    with patch('app.routes.financials.fetch_ticker_financials', return_value={'symbol': 'MSFT'}), \
         patch('app.routes.financials.CacheManager.get', return_value=None):
        get_financials('MSFT', tasks, track=False)
    assert tasks.tasks == []
