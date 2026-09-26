from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.routes import market
from app.integrations import company_metadata

client = TestClient(app)


def test_market_uses_cached_quotes_and_keeps_missing_data_explicit(monkeypatch):
    market.cached_quote.cache_clear()
    market.cached_news.cache_clear()
    calls = []
    def provider(path, params):
        calls.append((path, params))
        if path == 'news':
            return [{'headline': 'Market report', 'url': 'https://example.com/news'}]
        if params['symbol'] == 'MISSING':
            return {'c': 0, 'dp': 0}
        return {'c': 100, 'dp': -1.5, 'd': -1.5, 't': 1234}
    monkeypatch.setattr(market, 'provider_get', provider)
    monkeypatch.setattr(market, 'time', lambda: 6000)
    first = client.get('/market/overview', params={'symbols':'AAPL,AAPL,MISSING'}).json()
    quotes = {quote['symbol']: quote for quote in first['quotes']}
    assert set(quotes) == {'SPY','QQQ','DIA','IWM','TIP','IEF','MUB','CWB','HYG','LQD','AAPL','MISSING'}
    assert first['fixedIncome']['TIP'] == 'T.I.P.S.'
    assert quotes['MISSING']['price'] is None
    assert quotes['AAPL']['changePercent'] == -1.5
    assert first['newsStatus'] == 'available'
    client.get('/market/overview', params={'symbols':'AAPL'})
    assert len([c for c in calls if c[0] == 'quote' and c[1]['symbol']=='AAPL']) == 1
    market.cached_quote.cache_clear()
    market.cached_news.cache_clear()


def test_market_rejects_invalid_and_oversized_watchlists():
    assert client.get('/market/overview',params={'symbols':'../bad'}).status_code == 422
    assert client.get('/market/overview',params={'symbols':','.join(f'T{i}' for i in range(13))}).status_code == 422


def test_market_preserves_partial_result_on_provider_failure(monkeypatch):
    market.cached_quote.cache_clear()
    market.cached_news.cache_clear()
    def unavailable(*args):
        raise HTTPException(503, 'Provider unavailable')
    monkeypatch.setattr(market,'provider_get',unavailable)
    data = client.get('/market/overview',params={'symbols':''}).json()
    assert len(data['quotes']) == 10
    assert all(q['price'] is None for q in data['quotes'])
    assert data['newsStatus'] == 'unavailable'


def test_custom_tape_ticker_is_verified_and_persisted(monkeypatch):
    workspace = 'a77c49e6-91a0-4f52-9e50-12dc2b1044ab'
    saved = []
    trackers = ['SPY']
    monkeypatch.setattr(market, 'quote_or_missing', lambda symbol: {'symbol': symbol, 'price': 210.68})
    monkeypatch.setattr(company_metadata, 'get_profile', lambda symbol: {'name': 'SAP SE'})
    monkeypatch.setattr(market.supabase_store, 'get_workspace_trackers', lambda key: list(trackers))
    monkeypatch.setattr(market.supabase_store, 'upsert_market_instrument', lambda instrument: saved.append(instrument))
    monkeypatch.setattr(market.supabase_store, 'set_workspace_trackers', lambda key, symbols: trackers.__setitem__(slice(None), symbols))
    monkeypatch.setattr(market, 'register_symbols', lambda symbols: None)

    response = client.post(f'/market/tape/{workspace}/instruments/sap')

    assert response.status_code == 200
    assert response.json()['name'] == 'SAP SE'
    assert saved[0]['symbol'] == 'SAP'
    assert trackers == ['SPY', 'SAP']
