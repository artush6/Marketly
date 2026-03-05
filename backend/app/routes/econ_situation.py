import logging
import time

from fastapi import APIRouter, HTTPException

from app.core.errors import MisconfigurationError
from app.integrations.economics import fetch_macro_indicators

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/economics")
def macro_indicators():
    """
    Fetch macroeconomic indicators from FRED.
    If resample_freq is provided (e.g. 'M' for monthly), each series
    will be resampled (via .last()) to that freq and aligned.
    """
    start_time = time.time()
    try:
        result = fetch_macro_indicators()
        elapsed_time = time.time() - start_time
        logger.debug("Macro indicators fetched in %.2fs", elapsed_time)
        return result
    except MisconfigurationError:
        logger.exception("Economics endpoint is misconfigured")
        raise HTTPException(
            status_code=503,
            detail="Economics service is not configured correctly.",
        )
    except Exception:
        logger.exception("Unexpected economics failure")
        raise HTTPException(
            status_code=502,
            detail="Economics provider is currently unavailable.",
        )
