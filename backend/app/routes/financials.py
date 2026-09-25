import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core.errors import MisconfigurationError
from app.core.symbols import normalize_symbol_input
from app.integrations.financials import fetch_ticker_financials
from app.routes.market import track_symbols
from app.routes.discovery import SYMBOL
from app.core.cache import CacheManager
import json

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/financials/{symbol}")
def get_financials(symbol: str, background_tasks: BackgroundTasks, refresh: bool = False, track: bool = True):
    """Return aggregated financial market data for a ticker symbol."""

    try:
        symbol = normalize_symbol_input(symbol)
        if not SYMBOL.fullmatch(symbol):
            raise HTTPException(422, "Invalid ticker symbol.")
        if track:
            background_tasks.add_task(track_symbols, [symbol])
        payload = fetch_ticker_financials(symbol, force_refresh=refresh)
        # A statement snapshot is long-lived; overlay independently refreshed prices.
        cached_quote = CacheManager.get(CacheManager.make_key("quotes", symbol))
        if cached_quote:
            try:
                quote = json.loads(cached_quote)
                quote_time = datetime.fromisoformat(quote["fetchedAt"])
                financial_time = datetime.fromisoformat(payload["_fetchedAt"])
                if quote_time > financial_time:
                    payload.setdefault("quote", {}).update({
                        "c": quote["price"], "currentPrice": quote["price"],
                        "dp": quote.get("changePercent"), "d": quote.get("change"),
                        "t": quote.get("timestamp"), "fetchedAt": quote.get("fetchedAt"),
                    })
            except (ValueError, TypeError, KeyError):
                logger.warning("Ignored malformed cached quote for %s", symbol)
        return payload
    except HTTPException:
        raise
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
