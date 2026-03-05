from __future__ import annotations

from app.models import TickerData
from app.integrations.economics import fetch_macro_indicators
from app.integrations.financials import fetch_ticker_financials
from app.integrations.news import get_news
from app.integrations.gpt import score_ticker
from app.services.scoring.profitability import compute_profitability_metrics


def build_ticker_score(symbol: str) -> dict:
    """
    Fetch financial, macro, and news data for a ticker symbol,
    and generate an AI-based investment score.

    Returns the same response shape expected by the API routes.
    """
    symbol = symbol.upper()

    # Step 1: Fetch all raw data
    raw_financials = fetch_ticker_financials(symbol)
    if "error" in raw_financials:
        raise ValueError(raw_financials["error"])
    ticker_data = TickerData.from_raw(raw_financials)

    economic_data = fetch_macro_indicators()
    news_data = get_news(symbol)
    profitability = compute_profitability_metrics(
        ticker_data.financials.income_statement
    )

    # Step 2: Score the ticker with GPT
    analysis = score_ticker(
        ticker_data,
        news_data,
        economic_data,
        profitability_metrics=profitability,
    )
    if "error" in analysis:
        raise ValueError(analysis["error"])

    # Step 3: Return structured response (preserve existing output contract)
    info = ticker_data.info
    return {
        "symbol": symbol,
        "score": analysis.get("score"),
        "summary": analysis.get("summary"),
        "positives": analysis.get("positives", []),
        "negatives": analysis.get("negatives", []),
        "company": info.shortName,
        "profitability": profitability,
        "valuation": {
            "trailingPE": info.trailingPE,
            "forwardPE": info.forwardPE,
            "priceToBook": info.priceToBook,
            "priceToSales": info.priceToSalesTrailing12Months,
            "dividendYield": info.dividendYield,
            "marketCap": info.marketCap,
        },
    }
