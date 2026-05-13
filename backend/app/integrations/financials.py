from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

import pandas as pd
import requests
import yfinance as yf
from app.core.cache import CacheManager
from app.core.config import settings
from app.integrations import supabase_store

logger = logging.getLogger(__name__)

FINNHUB = "https://finnhub.io/api/v1"
FMP_STABLE = "https://financialmodelingprep.com/stable"
RAPIDAPI_HOST = "yh-finance.p.rapidapi.com"
SEC_DATA = "https://data.sec.gov"
SEC_FILES = "https://www.sec.gov/files"
FMP_STATEMENT_LIMIT = 4
SEC_FORMS = {"10-K", "10-Q", "20-F", "40-F"}
SEC_USER_AGENT = "Marketly backend contact@example.com"

SEC_INCOME_CONCEPTS = {
    "revenue": (
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
    ),
    "netIncome": ("NetIncomeLoss", "ProfitLoss"),
    "operatingIncome": ("OperatingIncomeLoss",),
    "costOfRevenue": ("CostOfRevenue", "CostOfGoodsAndServicesSold"),
    "interestExpense": ("InterestExpenseNonOperating", "InterestExpense"),
    "eps": ("EarningsPerShareDiluted", "EarningsPerShareBasic"),
}
SEC_BALANCE_CONCEPTS = {
    "totalAssets": ("Assets",),
    "totalStockholdersEquity": (
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ),
    "cashAndCashEquivalents": (
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ),
    "totalDebt": (
        "LongTermDebtAndFinanceLeaseObligationsCurrent",
        "LongTermDebtCurrent",
        "ShortTermBorrowings",
        "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
        "LongTermDebtNoncurrent",
    ),
    "sharesOutstanding": ("EntityCommonStockSharesOutstanding",),
}
SEC_CASH_FLOW_CONCEPTS = {
    "operatingCashFlow": ("NetCashProvidedByUsedInOperatingActivities",),
    "capitalExpenditure": ("PaymentsToAcquirePropertyPlantAndEquipment",),
}


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
    # SEC Company Facts is public and keyless for US issuers, so the
    # financials pipeline can still produce core statement data without paid
    # provider credentials. Paid providers enrich the snapshot when present.
    if not _has_financial_provider_config():
        logger.info("No paid financial provider keys configured; using public SEC fallback.")


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


def _normalize_market_cap(value: Any, source: str | None = None) -> Any:
    if not isinstance(value, (int, float)):
        return value

    if source == "finnhub-metric":
        return value * 1_000_000

    return value


def _sec_headers() -> dict[str, str]:
    return {"User-Agent": SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate"}


def _normalize_cik(cik: Any) -> str | None:
    try:
        return str(int(cik)).zfill(10)
    except (TypeError, ValueError):
        return None


def _sec_lookup_cik(symbol: str) -> tuple[str | None, str | None]:
    tickers = safe_get(
        f"{SEC_FILES}/company_tickers.json",
        source_name="SEC company tickers",
        headers=_sec_headers(),
    )
    if not tickers:
        return None, None

    records = tickers.values() if isinstance(tickers, dict) else tickers
    for record in records:
        if not isinstance(record, dict):
            continue
        if str(record.get("ticker", "")).upper() == symbol:
            return _normalize_cik(record.get("cik_str")), record.get("title")

    return None, None


def _sec_company_facts(cik: str) -> dict[str, Any]:
    return (
        safe_get(
            f"{SEC_DATA}/api/xbrl/companyfacts/CIK{cik}.json",
            source_name="SEC company facts",
            headers=_sec_headers(),
        )
        or {}
    )


def _sec_submissions(cik: str) -> dict[str, Any]:
    return (
        safe_get(
            f"{SEC_DATA}/submissions/CIK{cik}.json",
            source_name="SEC submissions",
            headers=_sec_headers(),
        )
        or {}
    )


def _sec_fact_candidates(
    facts: dict[str, Any],
    concepts: tuple[str, ...],
    *,
    units: tuple[str, ...] = ("USD",),
) -> list[dict[str, Any]]:
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    candidates: list[dict[str, Any]] = []

    for concept in concepts:
        unit_blocks = us_gaap.get(concept, {}).get("units", {})
        for unit in units:
            for item in unit_blocks.get(unit, []):
                if item.get("val") is None or item.get("form") not in SEC_FORMS:
                    continue
                enriched = dict(item)
                enriched["concept"] = concept
                enriched["unit"] = unit
                candidates.append(enriched)

    return candidates


def _latest_sec_fact(
    facts: dict[str, Any],
    concepts: tuple[str, ...],
    *,
    units: tuple[str, ...] = ("USD",),
) -> dict[str, Any] | None:
    candidates = _sec_fact_candidates(facts, concepts, units=units)

    if not candidates:
        return None
    return max(
        candidates,
        key=lambda item: (
            item.get("filed") or "",
            item.get("end") or "",
            item.get("fy") or 0,
        ),
    )


def _sec_value(
    facts: dict[str, Any],
    concepts: tuple[str, ...],
    *,
    units: tuple[str, ...] = ("USD",),
) -> tuple[Any, dict[str, Any] | None]:
    fact = _latest_sec_fact(facts, concepts, units=units)
    if not fact:
        return None, None
    return fact.get("val"), fact


def _sec_total_debt(facts: dict[str, Any]) -> tuple[Any, dict[str, Any] | None]:
    current_value, current_fact = _sec_value(
        facts,
        (
            "LongTermDebtAndFinanceLeaseObligationsCurrent",
            "LongTermDebtCurrent",
            "ShortTermBorrowings",
        ),
    )
    noncurrent_value, noncurrent_fact = _sec_value(
        facts,
        (
            "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
            "LongTermDebtNoncurrent",
        ),
    )

    if current_value is None and noncurrent_value is None:
        return _sec_value(facts, ("LongTermDebtAndFinanceLeaseObligations", "LongTermDebt"))

    return (current_value or 0) + (noncurrent_value or 0), noncurrent_fact or current_fact


def _apply_sec_row_metadata(row: dict[str, Any], fact: dict[str, Any] | None) -> None:
    if not fact:
        return
    safe_update(
        row,
        {
            "date": fact.get("end"),
            "fiscalDateEnding": fact.get("end"),
            "filedDate": fact.get("filed"),
            "period": fact.get("fp"),
            "calendarYear": fact.get("fy"),
            "acceptedForm": fact.get("form"),
        },
    )


def _sec_statement_row(
    facts: dict[str, Any],
    concept_map: dict[str, tuple[str, ...]],
    *,
    units: tuple[str, ...] = ("USD",),
) -> dict[str, Any]:
    row: dict[str, Any] = {}
    metadata_fact: dict[str, Any] | None = None

    for field_name, concepts in concept_map.items():
        if field_name == "totalDebt":
            value, fact = _sec_total_debt(facts)
        else:
            value, fact = _sec_value(facts, concepts, units=units)
        if value is not None:
            row[field_name] = value
            metadata_fact = metadata_fact or fact

    _apply_sec_row_metadata(row, metadata_fact)
    return row


def _is_quarterly_sec_fact(fact: dict[str, Any]) -> bool:
    period = str(fact.get("fp") or "").upper()
    frame = str(fact.get("frame") or "").upper()
    return fact.get("form") == "10-Q" and period in {"Q1", "Q2", "Q3", "Q4"} and period in frame


def _sec_statement_rows(
    facts: dict[str, Any],
    concept_map: dict[str, tuple[str, ...]],
    *,
    units: tuple[str, ...] = ("USD",),
    limit: int = FMP_STATEMENT_LIMIT,
) -> list[dict[str, Any]]:
    grouped: dict[tuple[Any, Any, Any, Any], dict[str, Any]] = {}
    metadata: dict[tuple[Any, Any, Any, Any], dict[str, Any]] = {}

    for field_name, concepts in concept_map.items():
        if field_name == "totalDebt":
            continue
        for fact in _sec_fact_candidates(facts, concepts, units=units):
            if not _is_quarterly_sec_fact(fact):
                continue
            key = (fact.get("fp"), fact.get("form"), fact.get("end"))
            existing = grouped.setdefault(key, {})
            current_meta = metadata.get(key)
            if current_meta and (fact.get("filed") or "") < (current_meta.get("filed") or ""):
                continue
            existing[field_name] = fact.get("val")
            metadata[key] = fact

    rows: list[dict[str, Any]] = []
    for key, row in grouped.items():
        _apply_sec_row_metadata(row, metadata.get(key))
        rows.append(row)

    rows.sort(
        key=lambda row: (
            row.get("fiscalDateEnding") or "",
            row.get("filedDate") or "",
            row.get("calendarYear") or 0,
        ),
        reverse=True,
    )
    if rows:
        latest_period = rows[0].get("period")
        comparable_rows = [row for row in rows if row.get("period") == latest_period]
        if len(comparable_rows) >= 2:
            return comparable_rows[:limit]
    return rows[:limit]


def fetch_sec_payload(symbol: str) -> dict[str, Any]:
    symbol = normalize_symbol(symbol)
    cik, title = _sec_lookup_cik(symbol)
    if not cik:
        return {}

    facts = _sec_company_facts(cik)
    if not facts:
        return {}

    submissions = _sec_submissions(cik)
    income_rows = _sec_statement_rows(facts, SEC_INCOME_CONCEPTS)
    income_row = income_rows[0] if income_rows else _sec_statement_row(facts, SEC_INCOME_CONCEPTS)
    balance_row = _sec_statement_row(facts, SEC_BALANCE_CONCEPTS)
    cash_flow_row = _sec_statement_row(facts, SEC_CASH_FLOW_CONCEPTS)

    payload = {"info": {}, "quote": {}, "financials": {}, "sources": {}}
    safe_update(
        payload["info"],
        {
            "shortName": submissions.get("name") or title,
            "industry": submissions.get("sicDescription"),
        },
    )

    if income_rows or income_row:
        payload["financials"]["income_statement"] = income_rows or [income_row]
        payload["sources"]["income_statement"] = "sec_xbrl"
    if balance_row:
        payload["financials"]["balance_sheet"] = [balance_row]
        payload["sources"]["balance_sheet"] = "sec_xbrl"
        if balance_row.get("sharesOutstanding") is not None:
            payload["quote"]["sharesOutstanding"] = balance_row.get("sharesOutstanding")
    if cash_flow_row:
        payload["financials"]["cash_flow"] = [cash_flow_row]
        payload["sources"]["cash_flow"] = "sec_xbrl"
    if payload["info"]:
        payload["sources"]["sec_submissions"] = "sec"

    return payload


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
                "marketCap": _normalize_market_cap(
                    metric_values.get("marketCapitalization"),
                    source="finnhub-metric",
                ),
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
        if not hasattr(dividends, "empty") or dividends.empty:
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
    source_updates = dict(payload.get("sources", {}))

    analyst_data = payload.get("analyst_data")
    if analyst_data:
        target["analyst_data"] = analyst_data

    dividends = payload.get("dividends")
    if dividends:
        target["dividends"] = dividends

    for block_name, block_value in payload.get("financials", {}).items():
        if block_value:
            existing_block = target["financials"].get(block_name)
            if not existing_block:
                target["financials"][block_name] = block_value
            else:
                source_updates.pop(block_name, None)

    target["sources"].update(source_updates)


def fetch_ticker_financials(symbol: str, force_refresh: bool = False) -> dict:
    validate_financials_configuration()
    symbol = normalize_symbol(symbol)
    cache_key = CacheManager.make_key("tickers", symbol)

    if not force_refresh:
        cached, cache_source = CacheManager.get_with_source(cache_key)
        if cached:
            try:
                logger.debug("Loaded %s from cache", symbol)
                payload = json.loads(cached)
                payload["_dataSource"] = cache_source or "cache"
                return payload
            except Exception:
                pass
        snapshot = supabase_store.get_latest_snapshot("financials", symbol)
        if snapshot and isinstance(snapshot.get("payload"), dict):
            logger.info("%s: loaded financial snapshot from Supabase", symbol)
            payload = dict(snapshot["payload"])
            payload["_dataSource"] = "supabase"
            CacheManager.set(cache_key, json.dumps(make_json_safe(payload)))
            return payload

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
        fetch_sec_payload(symbol),
        fetch_yfinance_dividends(symbol),
        fetch_yahoo_summary(symbol),
    ):
        merge_provider_payload(merged, provider_payload)

    filled_fields = sum(1 for value in merged["info"].values() if value is not None)
    logger.info("%s: fetched with %s info fields filled", symbol, filled_fields)
    if not merged["financials"]:
        logger.info("%s: no statement history available from configured providers", symbol)

    period_end = None
    income_statement = merged.get("financials", {}).get("income_statement") or []
    if income_statement:
        latest_income = income_statement[0]
        period_end = latest_income.get("fiscalDateEnding") or latest_income.get("date")

    supabase_store.save_snapshot(
        "financials",
        symbol,
        make_json_safe(merged),
        provenance=merged.get("sources", {}),
        period_end=period_end,
    )
    supabase_store.save_financial_payload(symbol, make_json_safe(merged))
    merged["_dataSource"] = "fresh"
    CacheManager.set(cache_key, json.dumps(make_json_safe(merged)))
    return merged
