import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.errors import MisconfigurationError
from app.schemas.analysis import TickerScoreResponse
from app.services.analysis_service import build_ticker_score

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/score/{symbol}", response_model=TickerScoreResponse)
def ticker_score(
    symbol: str,
    refresh: bool = Query(False, description="Bypass cached score and rebuild analysis"),
):
    """Build an AI-based ticker score response for a single ticker symbol."""

    try:
        return build_ticker_score(symbol, force_refresh=refresh)

    except MisconfigurationError:
        logger.exception("Analysis failed because configuration is missing")
        raise HTTPException(
            status_code=503,
            detail="Analysis service is not configured correctly.",
        )
    except ValueError:
        logger.exception("Analysis failed due to upstream data issue")
        raise HTTPException(
            status_code=502,
            detail="Analysis failed because upstream data is unavailable.",
        )
    except Exception:
        logger.exception("Unexpected analysis failure")
        raise HTTPException(
            status_code=500,
            detail="Analysis failed due to an internal error.",
        )
