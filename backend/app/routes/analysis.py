import logging

from fastapi import APIRouter, HTTPException

from app.core.errors import MisconfigurationError
from app.services.analysis_service import build_stock_score
from app.schemas.analysis import StockScoreResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/score/{symbol}", response_model=StockScoreResponse)
def stock_score(symbol: str):
    """Build an AI-based stock score response for a single ticker symbol."""

    try:
        return build_stock_score(symbol)

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
