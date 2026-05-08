import json
import logging
from functools import lru_cache
from typing import Any, Optional, Union

from openai import OpenAI

# internal helpers
from app.core.config import settings
from app.core.errors import MisconfigurationError
from app.models import TickerData
from app.serialization import sanitize

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_client() -> OpenAI:
    """Create and cache the OpenAI client for the process lifetime."""

    if not settings.OPENAI_API_KEY:
        raise MisconfigurationError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def score_ticker(
    ticker_data: Union[TickerData, dict],
    news_data: Union[dict, list],
    economic_data: dict,
    scoring_metrics: Optional[dict[str, Any]] = None,
    fact_graph: Optional[dict[str, Any]] = None,
    business_model: Optional[dict[str, Any]] = None,
    interpretation: Optional[dict[str, Any]] = None,
    event_layer: Optional[dict[str, Any]] = None,
    history_context: Optional[dict[str, Any]] = None,
    scenarios: Optional[dict[str, Any]] = None,
    trajectory: Optional[dict[str, Any]] = None,
) -> dict:
    """
    Evaluate a ticker using financial, macroeconomic, and news data via GPT model.
    Returns a structured score with summary, positives, and negatives.
    """

    if not isinstance(ticker_data, TickerData):
        ticker_data = TickerData.from_raw(ticker_data)

    info = ticker_data.info
    financials = ticker_data.financials
    scoring_metrics = scoring_metrics or {}

    # --- Safe, minimal payload ---
    safe_payload = {
        "company_overview": {
            "name": info.shortName,
            "sector": info.sector,
            "industry": info.industry,
            "country": info.country,
            "currency": info.currency,
            "market_cap": info.marketCap,
        },
        "valuation_metrics": scoring_metrics.get("valuation", {}),
        "profitability_metrics": scoring_metrics.get("profitability", {}),
        "growth_metrics": scoring_metrics.get("growth", {}),
        "stability_metrics": scoring_metrics.get("stability", {}),
        "market_metrics": {
            "beta": info.beta,
        },
        "financials": {
            "income_statement": financials.income_statement,
            "balance_sheet": financials.balance_sheet,
            "cash_flow": financials.cash_flow,
        },
        "analyst_data": ticker_data.analyst_data,
        "fact_graph": fact_graph or {},
        "business_model": business_model or {},
        "interpretation": interpretation or {},
        "event_layer": event_layer or {},
        "history_context": history_context or {},
        "scenarios": scenarios or {},
        "trajectory": trajectory or {},
        # limit for safety
        "news_data": news_data[:20] if isinstance(news_data, list) else news_data,
        "economic_data": economic_data,
    }

    # --- Truncate for token safety ---
    safe_payload_json = json.dumps(safe_payload, ensure_ascii=False)[:20000]

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        """You are a world-class equity analyst and quant strategist.
                        Evaluate the investment quality of a ticker from 0 to 100 using 
                        fundamentals, macroeconomic data, recent news, business-model context,
                        catalysts, scenario structure, and multi-horizon business trajectory.

                        Use the provided precomputed metric blocks directly when available.
                        Treat raw financial statements as fallback context, not the primary source.
                        Use the business model, interpretation, event layer, history context,
                        scenarios, and trajectory layer as the main reasoning scaffold.

                        Rules:
                        - Do not treat all companies with the same framework.
                        - Distinguish between observed facts and inference-backed interpretation.
                        - Never reduce the answer to "data missing" if structured inference exists.
                        - Express a clear view on asymmetry, what must go right, and what could make the business meaningfully different over 6 months to 10 years.

                        Follow this rubric strictly:

                        1. Profitability & Margins (0–17)
                        2. Growth & Stability (0–17)
                        3. Valuation (0–17)
                        4. Balance Sheet & Risk (0–17)
                        5. Market & News Signals (0–16)
                        6. Macro & Market Conditions (0–16)

                        Scoring scale:
                        0–20 = Extremely weak, avoid
                        21–40 = Weak, speculative
                        41–60 = Average, mixed signals
                        61–80 = Strong, attractive
                        81–100 = Exceptional, top-tier

                        Output concise, data-backed insights only.
                        JSON schema:
                        {
                            "score": integer,
                            "summary": string,
                            "positives": [string],
                            "negatives": [string]
                        }
                        """
                    )
                },
                {
                    "role": "user",
                    "content": f"Ticker data (financials, macro, news): {safe_payload_json}"
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "ticker_score",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "integer"},
                            "summary": {"type": "string"},
                            "positives": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "negatives": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                        },
                        "required": ["score", "summary"]
                    },
                },
            },
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)

        # Ensure keys always exist
        parsed.setdefault("positives", [])
        parsed.setdefault("negatives", [])

        return sanitize(parsed)
    except MisconfigurationError:
        raise
    except Exception as e:
        logger.exception("GPT scoring failed")
        return {"error": str(e)}


def answer_follow_up(
    symbol: str,
    question: str,
    score_payload: dict[str, Any],
    financial_payload: dict[str, Any],
    news_payload: list[dict[str, Any]],
) -> dict:
    """
    Answer a follow-up question about a ticker using the same backend OpenAI setup.
    """

    safe_payload = {
        "symbol": symbol.upper(),
        "score_payload": score_payload,
        "financial_payload": financial_payload,
        "news_payload": news_payload[:12],
        "question": question,
    }
    safe_payload_json = json.dumps(safe_payload, ensure_ascii=False)[:20000]

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        """You are a buy-side equity research assistant.
                        Answer follow-up questions using the supplied scoring output,
                        financial data, structured business-model/context layers, and recent news.
                        Stay grounded in the provided data, but reason from the structured
                        interpretation and scenarios when direct fields are sparse.

                        Rules:
                        - Do not invent direct metrics or external events not present in the payload.
                        - Reference the scoring output as the primary interpretation layer.
                        - Use business model and scenario context to answer decisively.
                        - Keep the answer concise but specific.
                        - If the needed data is missing, state that clearly and then reason from the available structured evidence.

                        JSON schema:
                        {
                            "answer": string
                        }
                        """
                    ),
                },
                {
                    "role": "user",
                    "content": f"Follow-up payload: {safe_payload_json}",
                },
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "follow_up_answer",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "answer": {"type": "string"},
                        },
                        "required": ["answer"],
                    },
                },
            },
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)
        return sanitize(parsed)
    except MisconfigurationError:
        raise
    except Exception as exc:
        logger.exception("Follow-up answer generation failed")
        return {"error": str(exc)}
