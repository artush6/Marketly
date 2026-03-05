import json
import logging
from datetime import datetime

import pandas as pd
import requests
import yfinance as yf
from app.core.cache import CacheManager
from app.core.config import settings

logger = logging.getLogger(__name__)

# === API Base URLs ===
FINNHUB = "https://finnhub.io/api/v1"
FMP = "https://financialmodelingprep.com/api/v3"
RAPIDAPI_HOST = "yh-finance.p.rapidapi.com"


# =====================================================================
# 🧩 Utilities
# =====================================================================
def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def safe_get(url, params=None, source_name=""):
    try:
        r = requests.get(url, params=params or {}, timeout=10)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("status") == "error":
            logger.warning("%s: %s", source_name, data.get("message"))
            return None
        return data
    except Exception as e:
        logger.warning("%s failed: %s", source_name, e)
        return None


def safe_update(target: dict, source: dict):
    """Only overwrite when value is not None."""
    for k, v in source.items():
        if v is not None:
            target[k] = v


def make_json_safe(obj):
    """Recursively make object JSON-serializable."""
    if isinstance(obj, dict):
        return {str(k): make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    return obj


# =====================================================================
# 🧩 Yahoo Finance (RapidAPI)
# =====================================================================
def fetch_yahoo_summary(symbol: str) -> dict:
    if not settings.RAPIDAPI_KEY:
        return {}

    headers = {
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }

    try:
        prof = requests.get(
            f"https://{RAPIDAPI_HOST}/v1/stock/profile",
            headers=headers,
            params={"symbol": symbol},
            timeout=10,
        ).json()

        fin = requests.get(
            f"https://{RAPIDAPI_HOST}/v1/stock/financial-data",
            headers=headers,
            params={"symbol": symbol},
            timeout=10,
        ).json()

        stat = requests.get(
            f"https://{RAPIDAPI_HOST}/v1/stock/statistics",
            headers=headers,
            params={"symbol": symbol},
            timeout=10,
        ).json()

        profile = prof.get("quoteSummary", {}).get(
            "result", [{}])[0].get("assetProfile", {})
        financial = fin.get("quoteSummary", {}).get(
            "result", [{}])[0].get("financialData", {})
        stats = stat.get("quoteSummary", {}).get("result", [{}])[
            0].get("defaultKeyStatistics", {})

        return {
            "info": {
                "sector": profile.get("sector"),
                "industry": profile.get("industry"),
                "country": profile.get("country"),
                "marketCap": financial.get("marketCap", {}).get("raw"),
                "beta": stats.get("beta", {}).get("raw"),
                "trailingPE": stats.get("trailingPE", {}).get("raw"),
                "forwardPE": stats.get("forwardPE", {}).get("raw"),
                "priceToBook": stats.get("priceToBook", {}).get("raw"),
                "dividendYield": financial.get("dividendYield", {}).get("raw"),
            },
            "quote": {
                "currentPrice": financial.get("currentPrice", {}).get("raw"),
                "targetMeanPrice": financial.get("targetMeanPrice", {}).get("raw"),
                "recommendationMean": financial.get("recommendationMean", {}).get("raw"),
            },
        }
    except Exception as e:
        logger.warning("Yahoo RapidAPI failed: %s", e)
        return {}


# =====================================================================
# 🧩 Main Aggregator
# =====================================================================
def fetch_ticker_financials(symbol: str, force_refresh: bool = False) -> dict:
    symbol = normalize_symbol(symbol)
    cache_key = CacheManager.make_key("tickers", symbol)

    if not force_refresh:
        cached = CacheManager.get(cache_key)
        if cached:
            try:
                logger.debug("Loaded %s from cache", symbol)
                return json.loads(cached)
            except Exception:
                pass

    merged = {
        "symbol": symbol,
        "info": {},
        "quote": {},
        "analyst_data": None,
        "financials": {},
        "dividends": {},
        "sources": {},
    }

    # ---------------- Finnhub ----------------
    if settings.FINNHUB_API_KEY:
        profile = safe_get(f"{FINNHUB}/stock/profile2",
                           {"symbol": symbol, "token": settings.FINNHUB_API_KEY}, "Finnhub profile")
        metrics = safe_get(f"{FINNHUB}/stock/metric",
                           {"symbol": symbol, "token": settings.FINNHUB_API_KEY}, "Finnhub metrics")
        quote = safe_get(f"{FINNHUB}/quote", {"symbol": symbol,
                         "token": settings.FINNHUB_API_KEY}, "Finnhub quote")
        recs = safe_get(f"{FINNHUB}/stock/recommendation",
                        {"symbol": symbol, "token": settings.FINNHUB_API_KEY}, "Finnhub recs")

        if profile:
            safe_update(merged["info"], {
                "shortName": profile.get("name"),
                "sector": profile.get("finnhubIndustry"),
                "country": profile.get("country"),
                "currency": profile.get("currency"),
            })
            merged["sources"]["profile"] = "finnhub"

        if metrics:
            m = metrics.get("metric", {})
            safe_update(merged["info"], {
                "marketCap": m.get("marketCapitalization"),
                "trailingPE": m.get("peBasicExclExtraTTM"),
                "priceToBook": m.get("pbAnnual"),
                "roe": m.get("roeTTM"),
                "grossMargin": m.get("grossMarginTTM"),
            })
            merged["sources"]["metrics"] = "finnhub"

        if quote:
            merged["quote"] = quote
            merged["sources"]["quote"] = "finnhub"

        if recs:
            merged["analyst_data"] = recs
            merged["sources"]["analyst_data"] = "finnhub"

    # ---------------- FMP ----------------
    if settings.FMPSDK_API_KEY:
        ratios = safe_get(f"{FMP}/ratios/{symbol}",
                          {"apikey": settings.FMPSDK_API_KEY}, "FMP ratios")
        if ratios and isinstance(ratios, list):
            r = ratios[0]
            safe_update(merged["info"], {
                "priceToSales": r.get("priceToSalesRatio"),
                "debtToEquity": r.get("debtEquityRatio"),
                "dividendYield": r.get("dividendYield"),
            })
            merged["sources"]["ratios"] = "fmp"

        income = safe_get(
            f"{FMP}/income-statement/{symbol}",
            {"limit": 4, "apikey": settings.FMPSDK_API_KEY},
            "FMP income"
        )

        if income and isinstance(income, list) and len(income) >= 4:
            merged["financials"]["income_statement"] = income
            merged["sources"]["income_statement"] = "fmp"

    # ---------------- yfinance dividends ----------------
    try:
        ticker = yf.Ticker(symbol)
        divs = ticker.dividends
        if not divs.empty:
            merged["dividends"] = make_json_safe(divs.tail(10).to_dict())
            merged["sources"]["dividends"] = "yfinance"
    except Exception as e:
        logger.warning("yfinance failed: %s", e)

    # ---------------- Yahoo fallback ----------------
    yahoo = fetch_yahoo_summary(symbol)
    if yahoo:
        safe_update(merged["info"], yahoo.get("info", {}))
        safe_update(merged["quote"], yahoo.get("quote", {}))
        merged["sources"]["yahoo"] = "rapidapi"

    filled_fields = sum(1 for v in merged["info"].values() if v is not None)
    logger.info("%s: fetched with %s info fields filled",
                symbol, filled_fields)

    CacheManager.set(cache_key, json.dumps(make_json_safe(merged)))
    return merged
