from __future__ import annotations

from datetime import date
from math import isfinite
from typing import Any

from app.services.financial_trends import build_financial_trends


def _rows(financials: dict[str, Any], key: str) -> list[dict[str, Any]]:
    rows = financials.get(key)
    if not isinstance(rows, list):
        return []
    valid = [row for row in rows if isinstance(row, dict)]
    valid = sorted(valid, key=lambda row: _period(row) or "", reverse=True)
    # Compare only like fiscal periods; never combine FY totals and quarters.
    if valid:
        period = valid[0].get("period")
        currency = valid[0].get("reportedCurrency")
        valid = [row for row in valid if row.get("period") == period and row.get("reportedCurrency") == currency]
    return valid


def _period(row: dict[str, Any]) -> str | None:
    value = row.get("fiscalDateEnding") or row.get("date")
    return str(value)[:10] if value else None


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) else None


def _ratio_value(value: Any) -> float | None:
    result = _number(value)
    if result is not None and abs(result) > 1 and abs(result) <= 100:
        return result / 100
    return result


def _value(row: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        result = _number(row.get(key))
        if result is not None:
            return result
    return None


def _point(
    value: float | None,
    unit: str,
    source: Any = None,
    period: str | None = None,
) -> dict[str, Any]:
    return {
        "value": value,
        "unit": unit,
        "availability": "available" if value is not None else "unavailable",
        "source": str(source) if source else None,
        "period": period,
        "asOf": period,
    }


def _latest_metric(
    row: dict[str, Any], fields: tuple[str, ...], unit: str, source: Any
) -> dict[str, Any]:
    return _point(_value(row, *fields), unit, source, _period(row))


def _growth(rows: list[dict[str, Any]], fields: tuple[str, ...], source: Any):
    if len(rows) < 2:
        return _point(None, "ratio", source)
    latest = _value(rows[0], *fields)
    # Prefer an observation roughly a year old; otherwise leave YoY unavailable.
    latest_date = _parse_period(_period(rows[0]))
    prior = None
    prior_period = None
    if latest_date:
        for row in rows[1:]:
            row_date = _parse_period(_period(row))
            if row_date and 300 <= (latest_date - row_date).days <= 430:
                prior = _value(row, *fields)
                prior_period = _period(row)
                break
    if latest is None or prior is None or prior == 0:
        return _point(None, "ratio", source)
    return _point(latest / prior - 1, "ratio", source, prior_period)


def _cagr(rows: list[dict[str, Any]], fields: tuple[str, ...], source: Any):
    if len(rows) < 2:
        return _point(None, "ratio", source)
    latest_row = rows[0]
    latest_date = _parse_period(_period(latest_row))
    candidates = [row for row in rows[1:] if latest_date and _parse_period(_period(row)) and abs((latest_date - _parse_period(_period(row))).days / 365.25 - 3) < 0.15]
    if not candidates:
        return _point(None, "ratio", source)
    oldest_row = min(candidates, key=lambda row: abs((latest_date - _parse_period(_period(row))).days / 365.25 - 3))
    latest = _value(latest_row, *fields)
    oldest = _value(oldest_row, *fields)
    latest_date, oldest_date = _parse_period(_period(latest_row)), _parse_period(_period(oldest_row))
    if latest is None or oldest is None or latest <= 0 or oldest <= 0 or not latest_date or not oldest_date:
        return _point(None, "ratio", source)
    years = (latest_date - oldest_date).days / 365.25
    if years < 2.5:
        return _point(None, "ratio", source)
    return _point((latest / oldest) ** (1 / years) - 1, "ratio", source, _period(oldest_row))


def _parse_period(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _annualized_change(rows: list[dict[str, Any]], fields: tuple[str, ...], source: Any):
    if len(rows) < 2:
        return _point(None, "ratio", source)
    newest, oldest = rows[0], rows[-1]
    start, end = _value(newest, *fields), _value(oldest, *fields)
    start_date, end_date = _parse_period(_period(newest)), _parse_period(_period(oldest))
    if start is None or end is None or start <= 0 or end <= 0 or not start_date or not end_date:
        return _point(None, "ratio", source)
    years = (start_date - end_date).days / 365.25
    if years <= 0:
        return _point(None, "ratio", source)
    return _point((start / end) ** (1 / years) - 1, "ratio", source, _period(oldest))


def build_company_intelligence(symbol: str, payload: dict[str, Any]) -> dict[str, Any]:
    info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
    quote = payload.get("quote") if isinstance(payload.get("quote"), dict) else {}
    financials = payload.get("financials") if isinstance(payload.get("financials"), dict) else {}
    sources = payload.get("sources") if isinstance(payload.get("sources"), dict) else {}
    income = _rows(financials, "income_statement")
    balance = _rows(financials, "balance_sheet")
    cash = _rows(financials, "cash_flow")
    income_source, balance_source, cash_source = (
        sources.get("income_statement"), sources.get("balance_sheet"), sources.get("cash_flow")
    )
    latest_income = income[0] if income else {}
    latest_balance = balance[0] if balance else {}
    latest_cash = cash[0] if cash else {}
    revenue = _value(latest_income, "revenue", "totalRevenue")
    op_income = _value(latest_income, "operatingIncome", "operatingIncomeLoss")
    net_income = _value(latest_income, "netIncome", "netIncomeLoss")
    gross_profit = _value(latest_income, "grossProfit")
    cost_of_revenue = _value(latest_income, "costOfRevenue", "costOfGoodsAndServicesSold")
    if gross_profit is None and revenue is not None and cost_of_revenue is not None:
        gross_profit = revenue - cost_of_revenue
    operating_cash = _value(latest_cash, "operatingCashFlow", "netCashProvidedByOperatingActivities")
    capex = _value(latest_cash, "capitalExpenditure", "capitalExpenditures", "capitalExpenditureReported")
    free_cash_flow = operating_cash - abs(capex) if operating_cash is not None and capex is not None else None
    dividends_paid = _value(latest_cash, "dividendsPaid", "commonDividendsPaid", "commonStockDividendsPaid")
    fcf_payout = abs(dividends_paid) / free_cash_flow if dividends_paid is not None and free_cash_flow and free_cash_flow > 0 else None

    market_cap = _value(info, "marketCap") or _value(quote, "marketCap")
    def info_point(field: str, unit: str) -> dict[str, Any]:
        source = sources.get("metrics") or sources.get("ratios") or sources.get("yahoo")
        return _point(_value(info, field), unit, source)

    fields_shares = ("commonStockSharesOutstanding", "sharesOutstanding")
    debt_change = _annualized_change(balance, ("totalDebt", "shortLongTermDebtTotal"), balance_source)
    share_change = _annualized_change(balance, fields_shares, balance_source)
    buyback = _point(-share_change["value"] if share_change["value"] is not None else None,
                     "ratio", share_change["source"], share_change["period"])
    revenue_row_period = _period(latest_income)
    aligned = bool(_period(latest_income)) and all(latest_income.get(key) == latest_cash.get(key) for key in ("period", "reportedCurrency")) and _period(latest_income) == _period(latest_cash)
    capex_ratio = abs(capex) / revenue if aligned and capex is not None and revenue and revenue > 0 else None
    fcf_margin = free_cash_flow / revenue if aligned and free_cash_flow is not None and revenue and revenue > 0 else None

    dividend_yield = _ratio_value(info.get("dividendYield"))
    if dividend_yield is None:
        dividend_yield = _ratio_value(quote.get("dividendYield"))
    dividend_source = sources.get("metrics") or sources.get("ratios") or sources.get("yahoo")

    fetched_at = payload.get("_fetchedAt") or (payload.get("dataQuality") or {}).get("fetchedAt")
    freshness = {
        "fetchedAt": fetched_at,
        "financialDataQuality": (payload.get("dataQuality") or {}).get("status"),
        "latestIncomePeriod": _period(latest_income) if latest_income else None,
        "latestBalancePeriod": _period(latest_balance) if latest_balance else None,
        "latestCashFlowPeriod": _period(latest_cash) if latest_cash else None,
    }
    available_count = 0
    total_count = 0
    result: dict[str, Any] = {
        "symbol": symbol,
        "financialTrends": build_financial_trends(payload),
        "company": {
            "name": info.get("shortName") or info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "currency": info.get("currency"),
            "marketCap": market_cap,
        },
        "freshness": freshness,
        "provenance": sources,
        "businessQuality": {
            "revenueGrowthYoY": _growth(income, ("revenue", "totalRevenue"), income_source),
            "revenueCagr3Y": _cagr(income, ("revenue", "totalRevenue"), income_source),
            "grossMargin": _point(gross_profit / revenue if gross_profit is not None and revenue else None, "ratio", income_source, revenue_row_period),
            "operatingMargin": _point(op_income / revenue if op_income is not None and revenue else None, "ratio", income_source, revenue_row_period),
            "netMargin": _point(net_income / revenue if net_income is not None and revenue else None, "ratio", income_source, revenue_row_period),
            "returnOnEquity": _point(_ratio_value(info.get("roe")), "ratio", sources.get("metrics") or sources.get("ratios")),
            "freeCashFlowMargin": _point(fcf_margin, "ratio", cash_source, _period(latest_cash) or revenue_row_period),
        },
        "capitalAllocation": {
            "capitalExpenditureToRevenue": _point(capex_ratio, "ratio", cash_source, _period(latest_cash) or revenue_row_period),
            "shareholderReturnFromShareCountChange": buyback,
            "totalDebtChangeAnnualized": debt_change,
            "dividendPayoutOfFreeCashFlow": _point(fcf_payout, "ratio", cash_source, _period(latest_cash)),
        },
        "valuation": {
            "marketCap": _point(market_cap, "currency", sources.get("metrics") or sources.get("quote")),
            "trailingPE": info_point("trailingPE", "multiple"),
            "forwardPE": info_point("forwardPE", "multiple"),
            "priceToBook": info_point("priceToBook", "multiple"),
            "priceToSales": _point(_value(info, "priceToSales", "priceToSalesTrailing12Months"), "multiple", sources.get("ratios") or sources.get("yahoo")),
        },
        "shareDilution": {
            "annualizedShareCountChange": share_change,
            "currentSharesOutstanding": _point(_value(quote, "sharesOutstanding") or _value(latest_balance, *fields_shares), "shares", sources.get("quote") or balance_source, _period(latest_balance)),
        },
        "dividends": {
            "dividendYield": _point(dividend_yield, "ratio", dividend_source),
            "annualDividendPerShare": _point(_value(quote, "dividendRate"), "currency_per_share", sources.get("yahoo")),
            "cashDividendsPaid": _point(abs(dividends_paid) if dividends_paid is not None else None, "currency", cash_source, _period(latest_cash)),
        },
    }
    for section in ("businessQuality", "capitalAllocation", "valuation", "shareDilution", "dividends"):
        for metric in result[section].values():
            total_count += 1
            available_count += metric["availability"] == "available"
    result["availability"] = "available" if available_count == total_count else "partial" if available_count else "unavailable"
    return result
