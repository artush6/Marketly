import json
import logging
from datetime import datetime
from typing import Any, Optional

import pandas as pd
import requests
import yfinance as yf
from app.core.cache import CacheManager
from app.core.config import settings
from app.core.errors import MisconfigurationError

logger = logging.getLogger(__name__)

FINNHUB = "https://finnhub.io/api/v1"
FMP_STABLE = "https://financialmodelingprep.com/stable"
RAPIDAPI_HOST = "yh-finance.p.rapidapi.com"
FMP_STATEMENT_LIMIT = 4


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def get_fmp_api_key() -> Optional[str]:
    # Prefer the new generic env name while preserving the legacy one.
    return getattr(settings, "FMP_API_KEY", None) or getattr(settings, "FMPSDK_API_KEY", None)


def _has_financial_provider_config() -> bool:
    return any(
        [
            settings.FINNHUB_API_KEY,
            get_fmp_api_key(),
            settings.RAPIDAPI_KEY,
        ]
    )


def validate_financials_configuration() -> None:
    if _has_financial_provider_config():
        return
    raise MisconfigurationError(
        "Financial data requires at least one provider key: "
        "FINNHUB_API_KEY, FMP_API_KEY (or legacy FMPSDK_API_KEY), or RAPIDAPI_KEY."
    )


def safe_get(
    url: str,
    params: Optional[dict[str, Any]] = None,
    source_name: str = "",
    headers: Optional[dict[str, str]] = None,
):
    try:
        response = requests.get(url, params=params or {}, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict) and data.get("status") == "error":
            logger.warning("%s: %s", source_name, data.get("message"))
            return None
        return data
    except Exception as exc:
        logger.warning("%s failed: %s", source_name, exc)
        return None


def safe_update(target: dict, source: dict):
    """Only overwrite when value is not None."""
    for key, value in source.items():
        if value is not None:
            target[key] = value


def make_json_safe(obj):
    """Recursively make object JSON-serializable."""
    if isinstance(obj, dict):
        return {str(k): make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    return obj


def _safe_list(data: Any) -> list[dict[str, Any]]:
    return data if isinstance(data, list) else []


def _pick_latest_statement(data: list[dict[str, Any]]) -> dict[str, Any]:
    return data[0] if data else {}


def _extract_quote_value(quote: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = quote.get(key)
        if value is not None:
            return value
    return None


def fetch_finnhub_payload(symbol: str) -> dict[str, Any]:
    if not settings.FINNHUB_API_KEY:
        return {}

    token = settings.FINNHUB_API_KEY
    profile = safe_get(
        f"{FINNHUB}/stock/profile2",
        {"symbol": symbol, "token": token},
        "Finnhub profile",
    )
    metrics = safe_get(
        f"{FINNHUB}/stock/metric",
        {"symbol": symbol, "token": token},
        "Finnhub metrics",
    )
    quote = safe_get(
        f"{FINNHUB}/quote",
        {"symbol": symbol, "token": token},
        "Finnhub quote",
    )
    recs = safe_get(
        f"{FINNHUB}/stock/recommendation",
        {"symbol": symbol, "token": token},
        "Finnhub recs",
    )

    payload = {"info": {}, "quote": {}, "financials": {}, "sources": {}}
    if profile:
        safe_update(
            payload["info"],
            {
                "shortName": profile.get("name"),
                "sector": profile.get("finnhubIndustry"),
                "country": profile.get("country"),
                "currency": profile.get("currency"),
            },
        )
        payload["sources"]["profile"] = "finnhub"

    if metrics:
        metric_values = metrics.get("metric", {})
        safe_update(
            payload["info"],
            {
                "marketCap": metric_values.get("marketCapitalization"),
                "trailingPE": metric_values.get("peBasicExclExtraTTM"),
                "priceToBook": metric_values.get("pbAnnual"),
                "roe": metric_values.get("roeTTM"),
                "grossMargin": metric_values.get("grossMarginTTM"),
            },
        )
        payload["sources"]["metrics"] = "finnhub"

    if quote:
        payload["quote"] = quote
        payload["sources"]["quote"] = "finnhub"

    if recs:
        payload["analyst_data"] = recs
        payload["sources"]["analyst_data"] = "finnhub"

    return payload


def fetch_fmp_payload(symbol: str) -> dict[str, Any]:
    api_key = get_fmp_api_key()
    if not api_key:
        return {}

    base_params = {"symbol": symbol, "apikey": api_key}
    ratios = safe_get(
        f"{FMP_STABLE}/ratios-ttm",
        base_params,
        "FMP ratios",
    )
    income_statement = safe_get(
        f"{FMP_STABLE}/income-statement",
        {**base_params, "limit": FMP_STATEMENT_LIMIT},
        "FMP income statement",
    )
    balance_sheet = safe_get(
        f"{FMP_STABLE}/balance-sheet-statement",
        {**base_params, "limit": FMP_STATEMENT_LIMIT},
        "FMP balance sheet",
    )
    cash_flow = safe_get(
        f"{FMP_STABLE}/cash-flow-statement",
        {**base_params, "limit": FMP_STATEMENT_LIMIT},
        "FMP cash flow",
    )
    as_reported_income = safe_get(
        f"{FMP_STABLE}/as-reported-income-statements",
        {**base_params, "limit": FMP_STATEMENT_LIMIT},
        "FMP as reported income statement",
    )

    income_statement = _safe_list(income_statement)
    balance_sheet = _safe_list(balance_sheet)
    cash_flow = _safe_list(cash_flow)
    as_reported_income = _safe_list(as_reported_income)

    latest_ratios = _pick_latest_statement(_safe_list(ratios))
    latest_balance_sheet = _pick_latest_statement(balance_sheet)
    latest_income_statement = _pick_latest_statement(income_statement)

    payload = {"info": {}, "quote": {}, "financials": {}, "sources": {}}
    if latest_ratios:
        safe_update(
            payload["info"],
            {
                "priceToSales": latest_ratios.get("priceToSalesRatioTTM")
                or latest_ratios.get("priceToSalesRatio"),
                "debtToEquity": latest_ratios.get("debtEquityRatioTTM")
                or latest_ratios.get("debtEquityRatio"),
                "dividendYield": latest_ratios.get("dividendYieldTTM")
                or latest_ratios.get("dividendYield"),
                "roe": latest_ratios.get("returnOnEquityTTM")
                or latest_ratios.get("returnOnEquity"),
                "grossMargin": latest_ratios.get("grossProfitMarginTTM")
                or latest_ratios.get("grossProfitMargin"),
            },
        )
        payload["sources"]["ratios"] = "fmp"

    if income_statement:
        payload["financials"]["income_statement"] = income_statement
        payload["sources"]["income_statement"] = "fmp"

    if balance_sheet:
        payload["financials"]["balance_sheet"] = balance_sheet
        payload["sources"]["balance_sheet"] = "fmp"

    if cash_flow:
        payload["financials"]["cash_flow"] = cash_flow
        payload["sources"]["cash_flow"] = "fmp"

    if as_reported_income:
        payload["financials"]["as_reported_income_statement"] = as_reported_income
        payload["sources"]["as_reported_income_statement"] = "fmp"

    safe_update(
        payload["info"],
        {
            "currency": latest_income_statement.get("reportedCurrency"),
        },
    )
    safe_update(
        payload["quote"],
        {
            "marketCap": latest_balance_sheet.get("marketCap"),
            "sharesOutstanding": latest_balance_sheet.get("commonStockSharesOutstanding"),
        },
    )

    return payload


def fetch_yfinance_dividends(symbol: str) -> dict[str, Any]:
    try:
        ticker = yf.Ticker(symbol)
        dividends = ticker.dividends
        if dividends.empty:
            return {}
        return {
            "dividends": make_json_safe(dividends.tail(10).to_dict()),
            "sources": {"dividends": "yfinance"},
        }
    except Exception as exc:
        logger.warning("yfinance failed: %s", exc)
        return {}


def fetch_yahoo_summary(symbol: str) -> dict[str, Any]:
    if not settings.RAPIDAPI_KEY:
        return {}

    headers = {
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }

    try:
        profile_response = safe_get(
            f"https://{RAPIDAPI_HOST}/v1/stock/profile",
            {"symbol": symbol},
            "Yahoo profile",
            headers=headers,
        ) or {}
        financial_response = safe_get(
            f"https://{RAPIDAPI_HOST}/v1/stock/financial-data",
            {"symbol": symbol},
            "Yahoo financial data",
            headers=headers,
        ) or {}
        statistics_response = safe_get(
            f"https://{RAPIDAPI_HOST}/v1/stock/statistics",
            {"symbol": symbol},
            "Yahoo statistics",
            headers=headers,
        ) or {}

        profile = (
            profile_response.get("quoteSummary", {})
            .get("result", [{}])[0]
            .get("assetProfile", {})
        )
        financial = (
            financial_response.get("quoteSummary", {})
            .get("result", [{}])[0]
            .get("financialData", {})
        )
        stats = (
            statistics_response.get("quoteSummary", {})
            .get("result", [{}])[0]
            .get("defaultKeyStatistics", {})
        )

        return {
            "info": {
                "sector": profile.get("sector"),
                "industry": profile.get("industry"),
                "country": profile.get("country"),
                "marketCap": financial.get("marketCap", {}).get("raw")
                or financial.get("enterpriseValue", {}).get("raw"),
                "beta": financial.get("beta", {}).get("raw") or stats.get("beta", {}).get("raw"),
                "trailingPE": stats.get("trailingPE", {}).get("raw"),
                "forwardPE": stats.get("forwardPE", {}).get("raw"),
                "priceToBook": stats.get("priceToBook", {}).get("raw"),
                "dividendYield": financial.get("dividendYield", {}).get("raw"),
            },
            "quote": {
                "currentPrice": financial.get("currentPrice", {}).get("raw"),
                "targetMeanPrice": financial.get("targetMeanPrice", {}).get("raw"),
                "recommendationMean": financial.get("recommendationMean", {}).get("raw"),
                "forwardEps": financial.get("forwardEps", {}).get("raw"),
                "dividendRate": financial.get("dividendRate", {}).get("raw"),
            },
            "sources": {"yahoo": "rapidapi"},
        }
    except Exception as exc:
        logger.warning("Yahoo RapidAPI failed: %s", exc)
        return {}


def merge_provider_payload(target: dict[str, Any], payload: dict[str, Any]) -> None:
    safe_update(target["info"], payload.get("info", {}))
    safe_update(target["quote"], payload.get("quote", {}))

    analyst_data = payload.get("analyst_data")
    if analyst_data:
        target["analyst_data"] = analyst_data

    dividends = payload.get("dividends")
    if dividends:
        target["dividends"] = dividends

    for block_name, block_value in payload.get("financials", {}).items():
        if block_value:
            target["financials"][block_name] = block_value

    target["sources"].update(payload.get("sources", {}))


def fetch_ticker_financials(symbol: str, force_refresh: bool = False) -> dict:
    validate_financials_configuration()
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

    for provider_payload in (
        fetch_finnhub_payload(symbol),
        fetch_fmp_payload(symbol),
        fetch_yfinance_dividends(symbol),
        fetch_yahoo_summary(symbol),
    ):
        merge_provider_payload(merged, provider_payload)

    filled_fields = sum(1 for value in merged["info"].values() if value is not None)
    logger.info("%s: fetched with %s info fields filled", symbol, filled_fields)

    CacheManager.set(cache_key, json.dumps(make_json_safe(merged)))
    return merged
