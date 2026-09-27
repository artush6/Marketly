from fastapi import APIRouter, HTTPException, Query

from app.integrations.company_metadata import get_metadata
from app.integrations.financials import fetch_ticker_financials
from app.routes.discovery import SYMBOL
from app.core.symbols import normalize_symbol_input
from app.schemas.company_intelligence import CompanyIntelligenceResponse
from app.services.company_intelligence import build_company_intelligence

router = APIRouter(prefix='/companies', tags=['companies'])


@router.get('/metadata')
def metadata(symbols: str = Query(max_length=260)):
    values = list(dict.fromkeys(value.strip().upper() for value in symbols.split(',') if value.strip()))
    if len(values) > 12 or any(not SYMBOL.fullmatch(value) for value in values):
        raise HTTPException(422, 'Provide up to 12 valid symbols.')
    return {'companies': get_metadata(values)}


@router.get('/{symbol}/intelligence', response_model=CompanyIntelligenceResponse)
def company_intelligence(symbol: str, refresh: bool = False):
    """Return an objective, provenance-aware long-term company profile."""
    try:
        symbol = normalize_symbol_input(symbol)
        if not SYMBOL.fullmatch(symbol):
            raise HTTPException(422, 'Invalid ticker symbol.')
        payload = fetch_ticker_financials(symbol, force_refresh=refresh)
        return build_company_intelligence(symbol, payload)
    except HTTPException:
        raise
    except Exception as exc:
        # Preserve the existing financial pipeline's client-safe error boundary.
        from app.core.errors import MisconfigurationError

        if isinstance(exc, MisconfigurationError):
            raise HTTPException(503, str(exc)) from exc
        raise HTTPException(502, 'Company financial data is currently unavailable.') from exc


@router.get('/{symbol}/performance')
def company_performance(symbol: str):
    import json
    from datetime import datetime, timedelta, timezone
    from app.core.cache import CacheManager
    from app.routes.discovery import provider_get
    from app.services.market_history import price_performance
    symbol = normalize_symbol_input(symbol)
    if not SYMBOL.fullmatch(symbol): raise HTTPException(422, 'Invalid ticker symbol.')
    key = CacheManager.make_key('price_performance', symbol)
    cached = CacheManager.get(key)
    if cached: return json.loads(cached)
    end = datetime.now(timezone.utc)
    candles = provider_get('stock/candle', {'symbol':symbol,'resolution':'D','from':int((end-timedelta(days=366*5+10)).timestamp()),'to':int(end.timestamp())})
    if not isinstance(candles,dict) or candles.get('s') != 'ok': raise HTTPException(503, 'Verified daily price history is unavailable for this company.')
    result = {'symbol':symbol,'periods':price_performance(candles),'source':'Finnhub daily candles','fetchedAt':end.isoformat(),'methodology':'Close-to-close price change, using the last available trading day on or before each boundary (maximum seven days). Not a total return; dividends excluded. Provider adjustment policy applies.'}
    CacheManager.set(key,json.dumps(result),ttl=3600)
    return result


@router.get('/{symbol}/expectations')
def company_expectations(symbol: str):
    import json
    from datetime import datetime, timezone
    from app.core.cache import CacheManager
    from app.routes.discovery import provider_get
    from app.services.market_history import earnings_expectations
    symbol = normalize_symbol_input(symbol)
    if not SYMBOL.fullmatch(symbol): raise HTTPException(422, 'Invalid ticker symbol.')
    key = CacheManager.make_key('earnings_expectations',symbol)
    cached = CacheManager.get(key)
    if cached: return json.loads(cached)
    rows = provider_get('stock/earnings',{'symbol':symbol,'limit':20})
    result={'symbol':symbol,'earnings':earnings_expectations(rows),'source':'Finnhub earnings surprises','fetchedAt':datetime.now(timezone.utc).isoformat(),
            'note':'Actual and consensus EPS are paired by the provider. Do not compare them with GAAP statement EPS without verifying basis. Historical estimate vintages, revenue estimates and revisions are not supplied by this endpoint.'}
    CacheManager.set(key,json.dumps(result),ttl=6*3600)
    return result
