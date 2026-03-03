from fastapi import APIRouter, Query

from app.integrations.news import get_news, get_news_grouped, get_news_mixed

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/grouped")
def grouped_news(
    symbols: str = Query(..., description="Comma-separated list of tickers"),
    days: int = Query(7, description="How many days back to fetch news"),
    max_items: int = Query(
        50, description="Max number of articles per company"),
):
    symbol_list = [s.strip() for s in symbols.split(",")]
    grouped = get_news_grouped(symbol_list, max_items=max_items, days=days)
    return grouped  # FastAPI will JSON-encode automatically


@router.get("/mixed")
def mixed_news(
    symbols: str = Query(..., description="Comma-separated list of tickers"),
    days: int = Query(3, description="How many days back to fetch news"),
    max_items: int = Query(10, description="Max number of articles total"),
):
    """
    Fetch combined news across all companies.
    Example: /news/mixed?symbols=AAPL,NVDA
    """
    symbol_list = [s.strip() for s in symbols.split(",")]
    return get_news_mixed(symbol_list, max_items=max_items, days=days)


@router.get("/{symbol}")
def company_news(
    symbol: str,
    days: int = Query(3, description="How many days back to fetch news"),
    max_items: int = Query(8, description="Max number of articles to return"),
):
    """
    Fetch latest news for a single company.
    Example: /news/AAPL?days=5&max_items=12
    """
    return get_news(symbol, days=days, max_items=max_items)
