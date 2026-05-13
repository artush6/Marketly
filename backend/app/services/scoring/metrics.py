from __future__ import annotations

from typing import Any

from app.models import TickerData
from app.services.scoring.growth import (
    calculate_eps_growth,
    calculate_net_income_growth,
    calculate_revenue_cagr,
    calculate_revenue_growth_yoy,
)
from app.services.scoring.profitability import calculate_roe, compute_profitability_metrics
from app.services.scoring.stability import (
    calculate_debt_ratio,
    calculate_interest_coverage,
)
from app.services.scoring.valuation import (
    calculate_forward_pe,
    calculate_pe_ratio,
    calculate_peg_ratio,
    calculate_price_to_book,
    calculate_price_to_sales,
)


def _statement_value(row: dict[str, Any] | None, *keys: str) -> Any:
    if not row:
        return None
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


def _company_value(info: Any, *names: str) -> Any:
    for name in names:
        value = getattr(info, name, None)
        if value is not None:
            return value
    return None


def _quote_value(quote: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = quote.get(key)
        if value is not None:
            return value
    return None


def _normalize_percent_like(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (int, float)) and abs(value) > 1 and abs(value) <= 100:
        return value / 100
    return value


def _normalize_ratio_metric(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (int, float)) and value > 10:
        return value / 100
    return value


def _period_multiplier(row: dict[str, Any] | None) -> int:
    if not row:
        return 1

    form = str(row.get("acceptedForm") or row.get("form") or "").upper()
    period = str(row.get("period") or row.get("fp") or "").upper()

    if form == "10-Q" or period in {"Q1", "Q2", "Q3", "Q4"}:
        return 4
    if period in {"H1", "H2"}:
        return 2
    return 1


def _ttm_or_annualized_revenue(
    latest: dict[str, Any] | None,
    income_statement: list[dict[str, Any]],
) -> Any:
    revenues = [
        _statement_value(row, "revenue", "totalRevenue")
        for row in income_statement[:4]
    ]
    if len(revenues) == 4 and all(isinstance(value, (int, float)) for value in revenues):
        return sum(revenues)

    revenue = _statement_value(latest, "revenue", "totalRevenue")
    if isinstance(revenue, (int, float)):
        return revenue * _period_multiplier(latest)
    return revenue


def _is_plausible_peg_ratio(value: Any) -> bool:
    return isinstance(value, (int, float)) and 0 < value <= 50


def build_scoring_metrics(ticker_data: TickerData | dict) -> dict[str, dict[str, Any]]:
    if not isinstance(ticker_data, TickerData):
        ticker_data = TickerData.from_raw(ticker_data)

    info = ticker_data.info
    quote = ticker_data.quote or {}
    income_statement = ticker_data.financials.income_statement or []
    balance_sheet = ticker_data.financials.balance_sheet or []
    latest = income_statement[0] if income_statement else {}
    previous = income_statement[1] if len(income_statement) > 1 else {}
    oldest = income_statement[-1] if len(income_statement) > 1 else {}
    latest_balance_sheet = balance_sheet[0] if balance_sheet else {}

    share_price = _quote_value(quote, "currentPrice", "c")
    market_cap = info.marketCap

    revenue = _statement_value(latest, "revenue", "totalRevenue")
    previous_revenue = _statement_value(previous, "revenue", "totalRevenue")
    oldest_revenue = _statement_value(oldest, "revenue", "totalRevenue")

    net_income = _statement_value(latest, "netIncome")
    previous_net_income = _statement_value(previous, "netIncome")

    eps = _statement_value(latest, "eps", "epsdiluted", "epsDiluted", "reportedEPS")
    previous_eps = _statement_value(previous, "eps", "epsdiluted", "epsDiluted", "reportedEPS")
    expected_eps = _quote_value(quote, "forwardEps")

    shareholders_equity = _statement_value(
        latest_balance_sheet,
        "totalStockholdersEquity",
        "totalShareholderEquity",
        "stockholdersEquity",
        "shareholdersEquity",
    )
    if shareholders_equity is None:
        shareholders_equity = _statement_value(
            latest,
            "totalStockholdersEquity",
            "totalShareholderEquity",
            "stockholdersEquity",
            "shareholdersEquity",
        )

    total_debt = _statement_value(latest_balance_sheet, "totalDebt", "netDebt")
    if total_debt is None:
        total_debt = _statement_value(latest, "totalDebt", "netDebt")

    total_assets = _statement_value(latest_balance_sheet, "totalAssets")
    if total_assets is None:
        total_assets = _statement_value(latest, "totalAssets")
    operating_income = _statement_value(latest, "operatingIncome", "incomeFromOperations")
    interest_expense = _statement_value(latest, "interestExpense")

    profitability = compute_profitability_metrics(income_statement)
    api_gross_margin = _normalize_percent_like(_company_value(info, "grossMargin"))
    if api_gross_margin is not None:
        profitability["grossMargin"] = api_gross_margin

    api_roe = _normalize_percent_like(_company_value(info, "roe"))
    profitability["roe"] = api_roe if api_roe is not None else calculate_roe(net_income, shareholders_equity)

    revenue_growth_yoy = calculate_revenue_growth_yoy(revenue, previous_revenue)
    revenue_cagr = calculate_revenue_cagr(revenue, oldest_revenue) if len(income_statement) >= 4 else None
    eps_growth = calculate_eps_growth(eps, previous_eps)
    net_income_growth = calculate_net_income_growth(net_income, previous_net_income)

    trailing_pe = _company_value(info, "trailingPE")
    if trailing_pe is None:
        trailing_pe = calculate_pe_ratio(share_price, eps)

    forward_pe = _company_value(info, "forwardPE")
    if forward_pe is None:
        forward_pe = calculate_forward_pe(share_price, expected_eps)

    price_to_book = _company_value(info, "priceToBook")
    if price_to_book is None:
        price_to_book = calculate_price_to_book(market_cap, shareholders_equity)

    price_to_sales = _company_value(info, "priceToSalesTrailing12Months", "priceToSales")
    if price_to_sales is None:
        price_to_sales = calculate_price_to_sales(
            market_cap,
            _ttm_or_annualized_revenue(latest, income_statement),
        )

    dividend_yield = _normalize_percent_like(_company_value(info, "dividendYield"))
    if dividend_yield is None:
        dividend_per_share = _quote_value(quote, "dividendRate")
        dividend_yield = (
            dividend_per_share / share_price
            if dividend_per_share not in (None, 0) and share_price not in (None, 0)
            else None
        )

    peg_ratio = _company_value(info, "pegRatio")
    if not _is_plausible_peg_ratio(peg_ratio):
        peg_ratio = calculate_peg_ratio(trailing_pe, eps_growth)

    debt_to_equity = _normalize_ratio_metric(_company_value(info, "debtToEquity"))
    if debt_to_equity is None and total_debt is not None and shareholders_equity not in (None, 0):
        debt_to_equity = total_debt / shareholders_equity

    stability = {
        "debtToEquity": debt_to_equity,
        "debtRatio": calculate_debt_ratio(total_debt, total_assets),
        "interestCoverage": calculate_interest_coverage(operating_income, interest_expense),
    }
    stability["coverage"] = len([value for value in stability.values() if value is not None]) / 3

    growth = {
        "revenueGrowthYoY": revenue_growth_yoy,
        "revenueCagr3Y": revenue_cagr,
        "epsGrowthYoY": eps_growth,
        "netIncomeGrowthYoY": net_income_growth,
    }
    growth["coverage"] = len([value for value in growth.values() if value is not None]) / 4

    valuation = {
        "trailingPE": trailing_pe,
        "forwardPE": forward_pe,
        "pegRatio": peg_ratio,
        "priceToBook": price_to_book,
        "priceToSales": price_to_sales,
        "dividendYield": dividend_yield,
        "marketCap": market_cap,
    }
    valuation["coverage"] = len(
        [
            value
            for key, value in valuation.items()
            if key != "marketCap" and value is not None
        ]
    ) / 6

    return {
        "profitability": profitability,
        "growth": growth,
        "stability": stability,
        "valuation": valuation,
    }
