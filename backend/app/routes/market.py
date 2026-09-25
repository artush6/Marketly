"""Small cached market snapshot, independent of expensive company analysis."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from time import time

import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from app.core.cache import CacheManager
from app.services.market_refresh import register_symbols
from app.integrations import supabase_store

from app.routes.discovery import SYMBOL, provider_get

router = APIRouter(prefix="/market", tags=["market"])
BENCHMARKS = {"SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow Jones", "IWM": "Russell 2000"}
FIXED_INCOME = {
    "TIP": "T.I.P.S.",
    "IEF": "U.S. Treasuries",
    "MUB": "Municipals",
    "CWB": "Convertibles",
    "HYG": "High Yield",
    "LQD": "High Grade",
}


def refresh_quote(symbol: str, *, durable: bool = False):
    data = provider_get("quote", {"symbol": symbol})
    if not isinstance(data, dict) or not isinstance(data.get("c"), (int, float)) or data["c"] <= 0:
        raise ValueError("No quote")
    result = {"symbol": symbol, "price": data["c"], "changePercent": data.get("dp"),
              "change": data.get("d"), "timestamp": data.get("t"), "source": "Finnhub",
              "fetchedAt": datetime.now(timezone.utc).isoformat()}
    CacheManager.set(CacheManager.make_key("quotes", symbol), json.dumps(result), ttl=7 * 86400, durable=durable)
    return result


@lru_cache(maxsize=256)
def cached_quote(symbol: str, bucket: int):
    cached = CacheManager.get(CacheManager.make_key("quotes", symbol))
    if cached:
        result = json.loads(cached)
        result["stale"] = (datetime.now(timezone.utc) - datetime.fromisoformat(result["fetchedAt"])).total_seconds() > 600
        return result
    return refresh_quote(symbol)


def quote_or_missing(symbol: str):
    try:
        return cached_quote(symbol, int(time() // 60))
    except (HTTPException, ValueError):
        return {"symbol": symbol, "price": None, "changePercent": None, "timestamp": None, "source": "unavailable"}


def refresh_news(*, durable: bool = False):
    data = provider_get("news", {"category": "general"})
    if not isinstance(data, list):
        raise ValueError("Invalid news response")
    result = [{key: item.get(key) for key in ("headline", "summary", "url", "image", "source", "datetime")}
            for item in data if isinstance(item, dict) and item.get("headline") and item.get("url")][:18]
    CacheManager.set(CacheManager.make_key("market_news", "general"), json.dumps(result), ttl=86400, durable=durable)
    return result


@lru_cache(maxsize=4)
def cached_news(bucket: int):
    cached = CacheManager.get(CacheManager.make_key("market_news", "general"))
    return json.loads(cached) if cached else refresh_news()


def track_symbols(symbols):
    try:
        register_symbols(symbols)
    except Exception as exc:
        logging.getLogger(__name__).warning("Tracking unavailable: %s", type(exc).__name__)


def parse_symbols(symbols, limit=100):
    values = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if len(values) > limit or any(not SYMBOL.fullmatch(s) for s in values):
        raise HTTPException(422, f"Provide up to {limit} valid ticker symbols.")
    return values


@router.get("/earnings")
def earnings(background_tasks: BackgroundTasks, symbols: str = Query(default="", max_length=2100)):
    watchlist = parse_symbols(symbols)
    background_tasks.add_task(track_symbols, watchlist)
    today = datetime.now(timezone.utc).date()
    notifications = []
    try:
        calendars = supabase_store.get_json_many("earnings_calendar", watchlist)
    except Exception:
        raise HTTPException(503, "Earnings calendar temporarily unavailable.")
    for symbol in watchlist:
        for event in calendars.get(symbol, {}).get("events", []):
            days = (datetime.fromisoformat(event["date"]).date() - today).days
            if 0 <= days <= 7:
                notifications.append({**event, "id": f"earnings:{symbol}:{event['date']}",
                    "daysUntil": days,
                    "message": f"{symbol} earnings expected on {event['date']} "
                               f"({'today' if days == 0 else 'in ' + str(days) + ' days'}).",
                    "source": "Finnhub", "estimated": True})
    return {"notifications": sorted(notifications, key=lambda e: e["date"]),
            "pendingSymbols": [s for s in watchlist if s not in calendars],
            "note": "Provider calendar dates may change; no date means no reminder."}



@router.get("/overview")
def overview(background_tasks: BackgroundTasks, symbols: str = Query(default="AAPL,MSFT,NVDA,GOOGL", max_length=260)):
    watchlist = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if len(watchlist) > 12 or any(not SYMBOL.fullmatch(s) for s in watchlist):
        raise HTTPException(422, "Provide up to 12 valid ticker symbols.")
    tickers = list(dict.fromkeys([*BENCHMARKS, *FIXED_INCOME, *watchlist]))
    background_tasks.add_task(track_symbols, tickers)
    with ThreadPoolExecutor(max_workers=6) as pool:
        quotes = list(pool.map(quote_or_missing, tickers))
    try:
        news = cached_news(int(time() // 120))
        news_status = "available"
    except (HTTPException, ValueError):
        news, news_status = [], "unavailable"
    return {"quotes": quotes, "news": news, "newsStatus": news_status,
            "benchmarks": BENCHMARKS, "fixedIncome": FIXED_INCOME,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "quoteBasis": "ETF proxies; quotes may be delayed", "source": "Finnhub"}
