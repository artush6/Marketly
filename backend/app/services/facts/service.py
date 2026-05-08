from __future__ import annotations

from app.models import TickerData
from app.services.facts.coverage import build_coverage_report
from app.services.facts.extractors import extract_fact_candidates
from app.services.facts.models import CompanyFactGraph, FactCandidate
from app.services.facts.reconciliation import reconcile_candidates


def build_fact_graph(
    ticker_data: TickerData,
    extra_candidates: list[FactCandidate] | None = None,
) -> CompanyFactGraph:
    candidates = extract_fact_candidates(ticker_data)
    if extra_candidates:
        candidates.extend(extra_candidates)

    facts = reconcile_candidates(candidates)
    coverage = build_coverage_report(facts)

    return CompanyFactGraph(
        symbol=(ticker_data.symbol or "").upper(),
        company_name=ticker_data.info.shortName,
        facts=facts,
        coverage=coverage,
    )
