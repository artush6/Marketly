from __future__ import annotations

from app.integrations.economics import fetch_macro_indicators
from app.integrations.news import get_news
from app.integrations.gpt import score_stock
from app.services.financials_service import get_financials_model


def build_stock_score(symbol: str) -> dict:
    """
    Fetch financial, macro, and news data for a stock symbol,
    and generate an AI-based investment score.

    Returns the same response shape expected by the API routes.
    """
    symbol = symbol.upper()

    # Step 1: Fetch all raw data
    financial_data = get_financials_model(symbol)

    economical_data = fetch_macro_indicators()
    news_data = get_news(symbol)

    # Step 2: Score the stock with GPT
    analysis = score_stock(financial_data, news_data, economical_data)
    if "error" in analysis:
        raise ValueError(analysis["error"])

    # Step 3: Return structured response (preserve existing output contract)
    info = financial_data.info
    return {
        "symbol": symbol,
        "score": analysis.get("score"),
        "summary": analysis.get("summary"),
        "positives": analysis.get("positives", []),
        "negatives": analysis.get("negatives", []),
        "company": info.shortName,
        "valuation": {
            "trailingPE": info.trailingPE,
            "forwardPE": info.forwardPE,
            "priceToBook": info.priceToBook,
            "priceToSales": info.priceToSalesTrailing12Months,
            "dividendYield": info.dividendYield,
            "marketCap": info.marketCap,
        },
    }
