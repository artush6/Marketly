"""Small cached market snapshot, independent of expensive company analysis."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from time import time

from fastapi import APIRouter, HTTPException, Query

from app.routes.discovery import SYMBOL, provider_get

router = APIRouter(prefix="/market", tags=["market"])
BENCHMARKS = {"SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow Jones", "IWM": "Russell 2000"}


@lru_cache(maxsize=256)
def cached_quote(symbol: str, bucket: int):
    data = provider_get("quote", {"symbol": symbol})
    if not isinstance(data, dict) or not isinstance(data.get("c"), (int, float)) or data["c"] <= 0:
        raise ValueError("No quote")
    return {"symbol": symbol, "price": data["c"], "changePercent": data.get("dp"),
            "change": data.get("d"), "timestamp": data.get("t"), "source": "Finnhub"}


def quote_or_missing(symbol: str):
    try:
        return cached_quote(symbol, int(time() // 60))
    except (HTTPException, ValueError):
        return {"symbol": symbol, "price": None, "changePercent": None, "timestamp": None, "source": "unavailable"}


@lru_cache(maxsize=4)
def cached_news(bucket: int):
    data = provider_get("news", {"category": "general"})
    if not isinstance(data, list):
        raise ValueError("Invalid news response")
    return [{key: item.get(key) for key in ("headline", "summary", "url", "image", "source", "datetime")}
            for item in data if isinstance(item, dict) and item.get("headline") and item.get("url")][:18]


@router.get("/overview")
def overview(symbols: str = Query(default="AAPL,MSFT,NVDA,GOOGL", max_length=260)):
    watchlist = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if len(watchlist) > 12 or any(not SYMBOL.fullmatch(s) for s in watchlist):
        raise HTTPException(422, "Provide up to 12 valid ticker symbols.")
    tickers = list(dict.fromkeys([*BENCHMARKS, *watchlist]))
    with ThreadPoolExecutor(max_workers=6) as pool:
        quotes = list(pool.map(quote_or_missing, tickers))
    try:
        news = cached_news(int(time() // 120))
        news_status = "available"
    except (HTTPException, ValueError):
        news, news_status = [], "unavailable"
    return {"quotes": quotes, "news": news, "newsStatus": news_status,
            "benchmarks": BENCHMARKS, "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "quoteBasis": "ETF proxies; quotes may be delayed", "source": "Finnhub"}
