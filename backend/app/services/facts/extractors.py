from __future__ import annotations

from typing import Any

from app.models import TickerData
from app.services.facts.models import FactCandidate


def _candidate(
    key: str,
    value: Any,
    source: str | None,
    *,
    quality_score: float,
    inferred: bool = False,
    notes: str | None = None,
) -> FactCandidate | None:
    if value is None:
        return None

    normalized_source = (
        source
        if source
        in {"finnhub", "fmp", "sec_xbrl", "sec", "rapidapi", "yfinance", "derived"}
        else "unknown"
    )

    return FactCandidate(
        key=key,
        value=value,
        source=normalized_source,
        quality_score=quality_score,
        inferred=inferred,
        notes=notes,
    )


def _statement_value(row: dict[str, Any] | None, *keys: str) -> Any:
    if not row:
        return None
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


def _source_for(ticker_data: TickerData, field_name: str, fallback: str | None = None) -> str | None:
    return ticker_data.sources.get(field_name) or fallback


def extract_fact_candidates(ticker_data: TickerData) -> list[FactCandidate]:
    info = ticker_data.info
    quote = ticker_data.quote or {}
    income_statement = ticker_data.financials.income_statement or []
    balance_sheet = ticker_data.financials.balance_sheet or []

    latest_income = income_statement[0] if income_statement else {}
    latest_balance = balance_sheet[0] if balance_sheet else {}

    candidates: list[FactCandidate | None] = [
        _candidate(
            "company.name",
            info.shortName,
            _source_for(ticker_data, "profile"),
            quality_score=0.85,
        ),
        _candidate(
            "company.sector",
            info.sector,
            _source_for(ticker_data, "profile", "rapidapi"),
            quality_score=0.75,
        ),
        _candidate(
            "company.industry",
            info.industry,
            _source_for(ticker_data, "yahoo", "rapidapi"),
            quality_score=0.7,
        ),
        _candidate(
            "market.market_cap",
            info.marketCap,
            _source_for(ticker_data, "metrics", "unknown"),
            quality_score=0.85,
        ),
        _candidate(
            "market.beta",
            info.beta,
            _source_for(ticker_data, "yahoo", "rapidapi"),
            quality_score=0.65,
        ),
        _candidate(
            "valuation.trailing_pe",
            info.trailingPE,
            _source_for(ticker_data, "metrics", "unknown"),
            quality_score=0.75,
        ),
        _candidate(
            "valuation.forward_pe",
            info.forwardPE,
            _source_for(ticker_data, "yahoo", "rapidapi"),
            quality_score=0.7,
        ),
        _candidate(
            "valuation.price_to_book",
            info.priceToBook,
            _source_for(ticker_data, "metrics", "unknown"),
            quality_score=0.75,
        ),
        _candidate(
            "profitability.gross_margin",
            info.grossMargin,
            _source_for(ticker_data, "metrics", "unknown"),
            quality_score=0.8,
        ),
        _candidate(
            "profitability.roe",
            info.roe,
            _source_for(ticker_data, "metrics", "unknown"),
            quality_score=0.65,
        ),
        _candidate(
            "financials.revenue.latest",
            _statement_value(latest_income, "revenue", "totalRevenue"),
            _source_for(ticker_data, "income_statement", "fmp"),
            quality_score=0.92,
        ),
        _candidate(
            "financials.net_income.latest",
            _statement_value(latest_income, "netIncome"),
            _source_for(ticker_data, "income_statement", "fmp"),
            quality_score=0.92,
        ),
        _candidate(
            "financials.operating_income.latest",
            _statement_value(latest_income, "operatingIncome", "incomeFromOperations"),
            _source_for(ticker_data, "income_statement", "fmp"),
            quality_score=0.88,
        ),
        _candidate(
            "financials.total_assets.latest",
            _statement_value(latest_balance, "totalAssets"),
            _source_for(ticker_data, "balance_sheet", "fmp"),
            quality_score=0.9,
        ),
        _candidate(
            "financials.total_equity.latest",
            _statement_value(
                latest_balance,
                "totalStockholdersEquity",
                "totalShareholderEquity",
                "stockholdersEquity",
                "shareholdersEquity",
            ),
            _source_for(ticker_data, "balance_sheet", "fmp"),
            quality_score=0.86,
        ),
        _candidate(
            "quote.current_price",
            quote.get("currentPrice") or quote.get("c"),
            _source_for(ticker_data, "quote"),
            quality_score=0.95,
        ),
    ]

    return [candidate for candidate in candidates if candidate is not None]
