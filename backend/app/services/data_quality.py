from __future__ import annotations

from typing import Any

from app.models import TickerData
from app.services.facts.models import CompanyFactGraph


CRITICAL_FACTS = {
    "company.name": "Company name",
    "market.market_cap": "Market capitalization",
    "quote.current_price": "Current price",
    "valuation.trailing_pe": "Trailing P/E",
    "profitability.gross_margin": "Gross margin",
    "financials.revenue.latest": "Latest revenue",
    "financials.net_income.latest": "Latest net income",
}


def _coverage(values: list[Any]) -> float:
    if not values:
        return 0.0
    return len([value for value in values if value is not None]) / len(values)


def _metric_coverage(scoring_metrics: dict[str, dict[str, Any]]) -> float:
    metric_blocks = ["profitability", "growth", "stability", "valuation"]
    values = [
        scoring_metrics.get(block, {}).get("coverage")
        for block in metric_blocks
        if isinstance(scoring_metrics.get(block, {}).get("coverage"), (int, float))
    ]
    if not values:
        return 0.0
    return sum(values) / len(values)


def _statement_coverage(ticker_data: TickerData) -> float:
    financials = ticker_data.financials
    return _coverage(
        [
            financials.income_statement if financials.income_statement else None,
            financials.balance_sheet if financials.balance_sheet else None,
            financials.cash_flow if financials.cash_flow else None,
        ]
    )


def build_data_quality(
    ticker_data: TickerData,
    fact_graph: CompanyFactGraph,
    scoring_metrics: dict[str, dict[str, Any]],
    interpretation: dict[str, Any],
) -> dict[str, Any]:
    missing_critical_fields = [
        label
        for key, label in CRITICAL_FACTS.items()
        if fact_graph.facts.get(key) is None or fact_graph.facts[key].value is None
    ]
    fact_coverage = fact_graph.coverage.coverage_ratio
    metric_coverage = _metric_coverage(scoring_metrics)
    statement_coverage = _statement_coverage(ticker_data)
    conflict_penalty = min(0.15, fact_graph.coverage.conflict_fields * 0.03)
    inferred_penalty = min(0.15, fact_graph.coverage.inferred_fields * 0.02)
    missing_penalty = min(0.25, len(missing_critical_fields) * 0.035)

    score = (
        fact_coverage * 0.45
        + metric_coverage * 0.3
        + statement_coverage * 0.25
        - conflict_penalty
        - inferred_penalty
        - missing_penalty
    )
    data_quality_score = round(max(0.0, min(1.0, score)), 3)

    confidence_level = "high"
    if data_quality_score < 0.45:
        confidence_level = "low"
    elif data_quality_score < 0.72:
        confidence_level = "medium"

    limitations: list[str] = []
    if missing_critical_fields:
        limitations.append(
            "Critical fields are missing: " + ", ".join(missing_critical_fields[:5])
        )
    if fact_graph.coverage.inferred_fields:
        limitations.append("Some facts are inferred rather than directly observed.")
    if fact_graph.coverage.conflict_fields:
        limitations.append("Some fields have conflicting provider candidates.")
    limitations.extend(interpretation.get("criticalUnknowns", [])[:3])

    return {
        "dataQualityScore": data_quality_score,
        "confidenceLevel": confidence_level,
        "missingCriticalFields": missing_critical_fields,
        "analysisLimitations": limitations[:6],
        "coverageBreakdown": {
            "factCoverage": round(fact_coverage, 3),
            "metricCoverage": round(metric_coverage, 3),
            "statementCoverage": round(statement_coverage, 3),
        },
    }
