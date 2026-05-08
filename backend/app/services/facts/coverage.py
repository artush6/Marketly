from __future__ import annotations

from app.services.facts.models import CanonicalFact, CoverageReport


REQUIRED_FACT_KEYS = [
    "company.name",
    "company.sector",
    "market.market_cap",
    "quote.current_price",
    "valuation.trailing_pe",
    "profitability.gross_margin",
    "profitability.roe",
    "financials.revenue.latest",
    "financials.net_income.latest",
]


def build_coverage_report(facts: dict[str, CanonicalFact]) -> CoverageReport:
    filled = 0
    inferred = 0
    conflicts = 0
    weak_fields: list[str] = []

    for key in REQUIRED_FACT_KEYS:
        fact = facts.get(key)
        if fact is None or fact.value is None:
            continue

        filled += 1
        if fact.inferred:
            inferred += 1
        if fact.alternatives:
            conflicts += 1
        if fact.confidence < 0.6:
            weak_fields.append(key)

    total = len(REQUIRED_FACT_KEYS)
    return CoverageReport(
        total_fields=total,
        filled_fields=filled,
        inferred_fields=inferred,
        conflict_fields=conflicts,
        weak_fields=weak_fields,
        coverage_ratio=(filled / total) if total else 0.0,
    )
