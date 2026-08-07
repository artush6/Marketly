import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.errors import MisconfigurationError
from app.core.symbols import normalize_symbol_input
from app.integrations.financials import fetch_ticker_financials
from app.integrations.gpt import answer_follow_up
from app.integrations.news import get_news
from app.services.analysis_service import build_ticker_score

router = APIRouter(prefix="/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)


class FollowUpRequest(BaseModel):
    symbol: str
    question: str
    analysis_context: dict[str, Any] | None = None


class FollowUpResponse(BaseModel):
    symbol: str
    answer: str


@router.post("/follow-up", response_model=FollowUpResponse)
def follow_up(request: FollowUpRequest):
    try:
        symbol = normalize_symbol_input(request.symbol)
        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=422, detail="Question cannot be empty.")

        # The dashboard already has a complete analysis payload. Reusing it makes
        # follow-ups independent of slow financial/news providers and Redis.
        if request.analysis_context:
            score = request.analysis_context
            financials = {}
            news = []
        else:
            financials = fetch_ticker_financials(symbol)
            score = build_ticker_score(symbol)
            news = get_news(symbol)
        response = answer_follow_up(
            symbol=symbol,
            question=question,
            score_payload=score,
            financial_payload=financials,
            news_payload=news,
        )

        if "error" in response:
            raise ValueError(response["error"])

        return {
            "symbol": symbol,
            "answer": response["answer"],
        }
    except MisconfigurationError as exc:
        logger.exception("Assistant follow-up failed because configuration is missing")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )
    except HTTPException:
        raise
    except ValueError as exc:
        logger.exception("Assistant follow-up failed due to upstream data issue")
        raise HTTPException(
            status_code=502,
            detail=f"Follow-up upstream data is unavailable: {exc}",
        )
    except Exception:
        logger.exception("Unexpected assistant follow-up failure")
        raise HTTPException(
            status_code=500,
            detail="Follow-up failed due to an internal error.",
        )
