import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.errors import MisconfigurationError
from app.integrations.news import get_news, get_news_grouped, get_news_mixed

router = APIRouter(prefix="/news", tags=["news"])
logger = logging.getLogger(__name__)


@router.get("/grouped")
def grouped_news(
    symbols: str = Query(..., description="Comma-separated list of tickers"),
    days: int = Query(7, description="How many days back to fetch news"),
    max_items: int = Query(
        50, description="Max number of articles per company"),
):
    """Return news grouped by ticker for a comma-separated symbol list."""

    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        grouped = get_news_grouped(symbol_list, max_items=max_items, days=days)
        return grouped  # FastAPI will JSON-encode automatically
    except MisconfigurationError as exc:
        logger.exception("News endpoint is misconfigured")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Unexpected news failure")
        raise HTTPException(
            status_code=502,
            detail="News provider is currently unavailable.",
        )


@router.get("/mixed")
def mixed_news(
    symbols: str = Query(..., description="Comma-separated list of tickers"),
    days: int = Query(3, description="How many days back to fetch news"),
    max_items: int = Query(10, description="Max number of articles total"),
):
    """
    Return one combined news feed across all requested companies.
    Example: `/news/mixed?symbols=AAPL,NVDA`.
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        return get_news_mixed(symbol_list, max_items=max_items, days=days)
    except MisconfigurationError as exc:
        logger.exception("News endpoint is misconfigured")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Unexpected news failure")
        raise HTTPException(
            status_code=502,
            detail="News provider is currently unavailable.",
        )


@router.get("/{symbol}")
def company_news(
    symbol: str,
    days: int = Query(3, description="How many days back to fetch news"),
    max_items: int = Query(8, description="Max number of articles to return"),
):
    """
    Return latest news for a single company.
    Example: `/news/AAPL?days=5&max_items=12`.
    """
    try:
        return get_news(symbol, days=days, max_items=max_items)
    except MisconfigurationError as exc:
        logger.exception("News endpoint is misconfigured")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Unexpected news failure")
        raise HTTPException(
            status_code=502,
            detail="News provider is currently unavailable.",
        )
