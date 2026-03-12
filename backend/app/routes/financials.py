import logging

from fastapi import APIRouter, HTTPException

from app.core.errors import MisconfigurationError
from app.integrations.financials import fetch_ticker_financials

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/financials/{symbol}")
def get_financials(symbol: str, refresh: bool = False):
    """Return aggregated financial market data for a ticker symbol."""

    try:
        return fetch_ticker_financials(symbol, force_refresh=refresh)
    except MisconfigurationError as exc:
        logger.exception("Financials endpoint is misconfigured")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Unexpected financials failure")
        raise HTTPException(
            status_code=502,
            detail="Financials provider is currently unavailable.",
        )
