from __future__ import annotations

import json

from app.core.cache import CacheManager
from app.core.config import settings
from app.core.errors import MisconfigurationError
from app.integrations.economics import fetch_macro_indicators
from app.integrations.financials import (
    fetch_ticker_financials,
    validate_financials_configuration,
)
from app.integrations.gpt import score_ticker
from app.integrations.news import get_news
from app.models import TickerData
from app.serialization import sanitize
from app.services.analysis_fallback import build_fallback_analysis
from app.services.classification import classify_business_model
from app.services.data_quality import build_data_quality
from app.services.events import build_event_catalyst_layer
from app.services.facts import build_fact_graph
from app.services.history import build_history_context
from app.services.interpretation import build_interpretation_layer
from app.services.market_context import build_market_context
from app.services.metadata import (
    ANALYSIS_VERSION,
    build_analysis_id,
    build_provenance,
    build_refresh_policy,
    utc_now_iso,
)
from app.services.scenarios import build_scenarios
from app.services.scoring.metrics import build_scoring_metrics
from app.services.trajectory import build_trajectory_layer


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
    fact_graph = build_fact_graph(ticker_data)
    scoring_metrics = build_scoring_metrics(ticker_data)

    economic_data = fetch_macro_indicators()
    news_data = get_news(symbol)
    market_context = build_market_context(economic_data, news_data, ticker_data)
    business_model = classify_business_model(ticker_data, fact_graph, news_data)
    interpretation = build_interpretation_layer(
        ticker_data,
        fact_graph,
        scoring_metrics,
        business_model,
    )
    data_quality = build_data_quality(
        ticker_data,
        fact_graph,
        scoring_metrics,
        interpretation,
    )
    history_context = build_history_context(ticker_data, business_model)
    event_layer = build_event_catalyst_layer(business_model, interpretation, news_data)
    scenarios = build_scenarios(
        business_model,
        interpretation,
        event_layer,
        history_context,
        ticker_data=ticker_data,
        scoring_metrics=scoring_metrics,
        news_data=news_data,
        economic_data=economic_data,
        market_context=market_context,
    )
    trajectory = build_trajectory_layer(
        ticker_data,
        business_model,
        interpretation,
        event_layer,
        history_context,
        scoring_metrics,
        news_data,
    )

    # Step 2: Score the ticker with GPT
    analysis = score_ticker(
        ticker_data,
        news_data,
        economic_data,
        scoring_metrics=scoring_metrics,
        fact_graph=sanitize(fact_graph.model_dump() if hasattr(fact_graph, "model_dump") else fact_graph.dict()),
        business_model=business_model,
        interpretation=interpretation,
        event_layer=event_layer,
        history_context=history_context,
        scenarios=scenarios,
        trajectory=trajectory,
        market_context=market_context,
        data_quality=data_quality,
    )
    if "error" in analysis:
        analysis = build_fallback_analysis(
            info.shortName if (info := ticker_data.info) else None,
            business_model,
            interpretation,
            scenarios,
            trajectory,
        )

    # Step 3: Return structured response (preserve existing output contract)
    info = ticker_data.info
    analysis_source = analysis.get("source", "openai")
    provenance = build_provenance(
        ticker_data.sources,
        analysis_source=analysis_source,
        scenario_source=scenarios.get("source", "unknown"),
    )
    data_timestamp = utc_now_iso()
    analysis_id = build_analysis_id(
        symbol,
        ANALYSIS_VERSION,
        data_timestamp,
        provenance,
    )
    response = {
        "analysisId": analysis_id,
        "analysisVersion": ANALYSIS_VERSION,
        "dataTimestamp": data_timestamp,
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
        "analysisMetadata": {
            "analysisId": analysis_id,
            "analysisVersion": ANALYSIS_VERSION,
            "dataTimestamp": data_timestamp,
            "factCoverage": fact_graph.coverage.coverage_ratio,
            "factFieldCount": fact_graph.coverage.filled_fields,
            "factFieldTotal": fact_graph.coverage.total_fields,
            "inferredFactCount": fact_graph.coverage.inferred_fields,
            "conflictingFactCount": fact_graph.coverage.conflict_fields,
            "weakFactFields": fact_graph.coverage.weak_fields,
            **data_quality,
            "provenance": provenance,
            "refreshPolicy": build_refresh_policy(),
            "inputPartitions": {
                "facts": ["financialFacts", "macro", "news"],
                "computed": [
                    "profitability",
                    "growth",
                    "stability",
                    "valuation",
                    "businessModel",
                    "interpretation",
                    "eventCatalysts",
                    "historyContext",
                    "marketContext",
                    "trajectory",
                ],
                "generated": ["scenarios", "summary", "positives", "negatives"],
            },
        },
        "businessModel": business_model,
        "interpretation": interpretation,
        "eventCatalysts": event_layer,
        "historyContext": history_context,
        "marketContext": market_context,
        "scenarios": scenarios,
        "trajectory": trajectory,
        "analysisSource": analysis_source,
    }
    CacheManager.set(cache_key, json.dumps(response))
    return response
