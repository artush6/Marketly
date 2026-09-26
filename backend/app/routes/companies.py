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
