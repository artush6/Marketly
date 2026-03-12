from __future__ import annotations

import json

from app.core.cache import CacheManager
from app.core.config import settings
from app.core.errors import MisconfigurationError
from app.models import TickerData
from app.integrations.economics import fetch_macro_indicators
from app.integrations.financials import (
    fetch_ticker_financials,
    validate_financials_configuration,
)
from app.integrations.news import get_news
from app.integrations.gpt import score_ticker
from app.services.scoring.metrics import build_scoring_metrics


def build_ticker_score(symbol: str, force_refresh: bool = False) -> dict:
    """
    Fetch financial, macro, and news data for a ticker symbol,
    and generate an AI-based investment score.

    Returns the same response shape expected by the API routes.
    """
    symbol = symbol.upper()
    cache_key = CacheManager.make_key("scores", symbol)

    if not force_refresh:
        cached = CacheManager.get(cache_key)
        if cached:
            return json.loads(cached)

    if not settings.FRED_API_KEY:
        raise MisconfigurationError("FRED_API_KEY is not configured.")
    if not settings.FINNHUB_API_KEY:
        raise MisconfigurationError("FINNHUB_API_KEY is not configured.")
    if not settings.OPENAI_API_KEY:
        raise MisconfigurationError("OPENAI_API_KEY is not configured.")
    validate_financials_configuration()

    # Step 1: Fetch all raw data
    raw_financials = fetch_ticker_financials(symbol, force_refresh=force_refresh)
    if "error" in raw_financials:
        raise ValueError(raw_financials["error"])
    ticker_data = TickerData.from_raw(raw_financials)
    scoring_metrics = build_scoring_metrics(ticker_data)

    economic_data = fetch_macro_indicators()
    news_data = get_news(symbol)

    # Step 2: Score the ticker with GPT
    analysis = score_ticker(
        ticker_data,
        news_data,
        economic_data,
        scoring_metrics=scoring_metrics,
    )
    if "error" in analysis:
        raise ValueError(analysis["error"])

    # Step 3: Return structured response (preserve existing output contract)
    info = ticker_data.info
    response = {
        "symbol": symbol,
        "score": analysis.get("score"),
        "summary": analysis.get("summary"),
        "positives": analysis.get("positives", []),
        "negatives": analysis.get("negatives", []),
        "company": info.shortName,
        "profitability": scoring_metrics["profitability"],
        "growth": scoring_metrics["growth"],
        "stability": scoring_metrics["stability"],
        "valuation": scoring_metrics["valuation"],
    }
    CacheManager.set(cache_key, json.dumps(response))
    return response
