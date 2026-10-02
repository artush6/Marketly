"""Deterministic small-cap discovery and future-potential ranking.

This module is intentionally usable from both HTTP routes and background workers.
Provider screening narrows the universe; Marketly's own financial pipeline performs
the deeper evaluation. Probability outputs are heuristic signals, not calibrated
forecast probabilities.
"""
from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import requests

from app.core.config import settings
from app.integrations import supabase_store
from app.integrations.financials import fetch_ticker_financials
from app.services.company_intelligence import build_company_intelligence

DEFAULT_MIN_MARKET_CAP = 50_000_000
DEFAULT_MAX_MARKET_CAP = 2_000_000_000
DEFAULT_MIN_AVG_VOLUME = 100_000
MAX_DEEP_CANDIDATES = 16
FMP_SCREENER_URL = "https://financialmodelingprep.com/stable/company-screener"


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _point_value(section: dict[str, Any], key: str) -> float | None:
    point = section.get(key)
    if not isinstance(point, dict):
        return None
    return _number(point.get("value"))


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _linear(value: float | None, low: float, high: float) -> float | None:
    if value is None or high == low:
        return None
    return _clamp((value - low) / (high - low))


def _reverse(value: float | None, low: float, high: float) -> float | None:
    result = _linear(value, low, high)
    return None if result is None else 1.0 - result


def _weighted(values: list[tuple[float | None, float]]) -> tuple[float, float]:
    observed = [(value, weight) for value, weight in values if value is not None]
    if not observed:
        return 0.0, 0.0
    weight_sum = sum(weight for _, weight in observed)
    score = sum(value * weight for value, weight in observed) / weight_sum
    coverage = weight_sum / sum(weight for _, weight in values)
    return score, coverage


def classify_market_cap(market_cap: float | None) -> str:
    if market_cap is None:
        return "unknown"
    if market_cap < 50_000_000:
        return "nano"
    if market_cap < 300_000_000:
        return "micro"
    if market_cap < 2_000_000_000:
        return "small"
    if market_cap < 10_000_000_000:
        return "mid"
    return "large"


def _relationship_summary(symbol: str) -> dict[str, Any]:
    if not supabase_store.is_configured():
        return {"verifiedCount": 0, "types": [], "available": False}
    try:
        rows = supabase_store.get_company_relationships(symbol)
    except Exception:
        return {"verifiedCount": 0, "types": [], "available": False}
    types = sorted({str(row.get("relationship_type")) for row in rows if row.get("relationship_type")})
    high_confidence = [
        row for row in rows
        if (_number(row.get("confidence")) or 0) >= 0.8
    ]
    return {
        "verifiedCount": len(rows),
        "highConfidenceCount": len(high_confidence),
        "types": types,
        "available": True,
    }


def score_small_cap_candidate(
    symbol: str,
    payload: dict[str, Any],
    *,
    screener_row: dict[str, Any] | None = None,
    relationship_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build an explainable future-potential score from structured evidence."""
    intelligence = build_company_intelligence(symbol, payload)
    quality = intelligence.get("businessQuality", {})
    capital = intelligence.get("capitalAllocation", {})
    valuation = intelligence.get("valuation", {})
    dilution = intelligence.get("shareDilution", {})
    company = intelligence.get("company", {})

    revenue_growth = _point_value(quality, "revenueGrowthYoY")
    revenue_cagr = _point_value(quality, "revenueCagr3Y")
    operating_margin = _point_value(quality, "operatingMargin")
    net_margin = _point_value(quality, "netMargin")
    fcf_margin = _point_value(quality, "freeCashFlowMargin")
    debt_change = _point_value(capital, "totalDebtChangeAnnualized")
    share_change = _point_value(dilution, "annualizedShareCountChange")
    trailing_pe = _point_value(valuation, "trailingPE")
    price_to_sales = _point_value(valuation, "priceToSales")

    growth_score, growth_coverage = _weighted([
        (_linear(revenue_growth, -0.10, 0.35), 0.60),
        (_linear(revenue_cagr, -0.05, 0.25), 0.40),
    ])
    quality_score, quality_coverage = _weighted([
        (_linear(operating_margin, -0.10, 0.25), 0.40),
        (_linear(net_margin, -0.10, 0.20), 0.25),
        (_linear(fcf_margin, -0.10, 0.20), 0.35),
    ])
    balance_score, balance_coverage = _weighted([
        (_reverse(debt_change, -0.15, 0.35), 0.45),
        (_reverse(share_change, -0.05, 0.20), 0.55),
    ])
    valuation_score, valuation_coverage = _weighted([
        (_reverse(trailing_pe, 10, 60), 0.45),
        (_reverse(price_to_sales, 1, 12), 0.55),
    ])

    relationship_summary = relationship_summary or _relationship_summary(symbol)
    relationship_count = int(relationship_summary.get("verifiedCount") or 0)
    high_confidence_count = int(relationship_summary.get("highConfidenceCount") or 0)
    # Known, well-sourced relationships are positive evidence about how well the
    # business can be understood. Missing relationship research is not a penalty.
    network_score = min(1.0, 0.15 * relationship_count + 0.10 * high_confidence_count)
    network_coverage = 1.0 if relationship_summary.get("available") else 0.0

    components = {
        "growth": {"score": round(growth_score * 100), "weight": 0.30, "coverage": growth_coverage},
        "businessQuality": {"score": round(quality_score * 100), "weight": 0.25, "coverage": quality_coverage},
        "balanceAndDilution": {"score": round(balance_score * 100), "weight": 0.20, "coverage": balance_coverage},
        "valuation": {"score": round(valuation_score * 100), "weight": 0.15, "coverage": valuation_coverage},
        "networkEvidence": {"score": round(network_score * 100), "weight": 0.10, "coverage": network_coverage},
    }

    observed_components = [
        (block["score"] / 100, block["weight"], block["coverage"])
        for block in components.values()
        if block["coverage"] > 0
    ]
    if observed_components:
        effective_weight = sum(weight * coverage for _, weight, coverage in observed_components)
        potential = sum(score * weight * coverage for score, weight, coverage in observed_components) / effective_weight
        evidence_coverage = effective_weight / sum(block["weight"] for block in components.values())
    else:
        potential = 0.0
        evidence_coverage = 0.0

    potential_score = round(_clamp(potential) * 100)
    # Shrink the heuristic forecast toward 50% when evidence is sparse.
    raw_probability = _clamp(0.50 + (potential_score - 50) * 0.006, 0.20, 0.80)
    probability = 0.50 + (raw_probability - 0.50) * evidence_coverage
    confidence = "high" if evidence_coverage >= 0.78 else "medium" if evidence_coverage >= 0.52 else "low"

    risk_flags: list[str] = []
    if revenue_growth is not None and revenue_growth < -0.10:
        risk_flags.append("revenue_contracting")
    if fcf_margin is not None and fcf_margin < 0:
        risk_flags.append("negative_free_cash_flow")
    if share_change is not None and share_change > 0.10:
        risk_flags.append("heavy_share_dilution")
    if debt_change is not None and debt_change > 0.25:
        risk_flags.append("rapid_debt_growth")
    if evidence_coverage < 0.45:
        risk_flags.append("thin_evidence")

    positives: list[str] = []
    if revenue_growth is not None and revenue_growth >= 0.15:
        positives.append("Revenue growth is strong for the current evidence window.")
    if revenue_cagr is not None and revenue_cagr >= 0.12:
        positives.append("Multi-year revenue growth is supportive.")
    if fcf_margin is not None and fcf_margin >= 0.08:
        positives.append("Free-cash-flow conversion is already meaningful.")
    if share_change is not None and share_change <= 0.02:
        positives.append("Share dilution is currently contained.")
    if relationship_count >= 3:
        positives.append("Marketly has multiple verified company relationships for network/context analysis.")

    market_cap = _number(company.get("marketCap"))
    if market_cap is None and screener_row:
        market_cap = _number(screener_row.get("marketCap"))

    return {
        "symbol": symbol,
        "name": company.get("name") or (screener_row or {}).get("companyName") or (screener_row or {}).get("name") or symbol,
        "sector": company.get("sector") or (screener_row or {}).get("sector"),
        "industry": company.get("industry") or (screener_row or {}).get("industry"),
        "marketCap": market_cap,
        "marketCapClass": classify_market_cap(market_cap),
        "potentialScore": potential_score,
        "components": components,
        "evidenceCoverage": round(evidence_coverage, 3),
        "futurePotential": {
            "estimated12mOutperformanceProbability": round(probability, 3),
            "benchmark": "broad US equity market",
            "method": "heuristic_signal_v1",
            "calibrated": False,
            "confidence": confidence,
            "note": "Signal-derived estimate for ranking research candidates; it is not a statistically calibrated forecast.",
        },
        "relationships": relationship_summary,
        "positives": positives[:6],
        "riskFlags": risk_flags,
        "dataAvailability": intelligence.get("availability"),
    }


def fetch_small_cap_universe(
    *,
    min_market_cap: int = DEFAULT_MIN_MARKET_CAP,
    max_market_cap: int = DEFAULT_MAX_MARKET_CAP,
    min_avg_volume: int = DEFAULT_MIN_AVG_VOLUME,
    sector: str | None = None,
    country: str = "US",
) -> list[dict[str, Any]]:
    if not settings.FMP_API_KEY:
        raise RuntimeError("Small-cap screening requires FMP_API_KEY.")

    params: dict[str, Any] = {
        "marketCapMoreThan": min_market_cap,
        "marketCapLowerThan": max_market_cap,
        "avgVolumeMoreThan": min_avg_volume,
        "country": country,
        "isEtf": "false",
        "isFund": "false",
        "isActivelyTrading": "true",
        "apikey": settings.FMP_API_KEY,
    }
    if sector:
        params["sector"] = sector

    response = requests.get(FMP_SCREENER_URL, params=params, timeout=12)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("Invalid FMP screener response")

    rows = [row for row in payload if isinstance(row, dict) and row.get("symbol")]
    # Prefer liquid names first for the expensive deep-analysis pass. Market cap
    # is a secondary tie breaker so the list does not simply become "largest small caps".
    rows.sort(
        key=lambda row: (
            _number(row.get("avgVolume")) or _number(row.get("volume")) or 0,
            _number(row.get("marketCap")) or 0,
        ),
        reverse=True,
    )
    return rows


def scan_small_caps(
    *,
    min_market_cap: int = DEFAULT_MIN_MARKET_CAP,
    max_market_cap: int = DEFAULT_MAX_MARKET_CAP,
    min_avg_volume: int = DEFAULT_MIN_AVG_VOLUME,
    sector: str | None = None,
    deep_limit: int = 10,
    country: str = "US",
) -> dict[str, Any]:
    universe = fetch_small_cap_universe(
        min_market_cap=min_market_cap,
        max_market_cap=max_market_cap,
        min_avg_volume=min_avg_volume,
        sector=sector,
        country=country,
    )
    deep_limit = max(1, min(int(deep_limit), MAX_DEEP_CANDIDATES))
    shortlist = universe[: max(deep_limit * 3, deep_limit)]
    candidates: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    def enrich(row: dict[str, Any]) -> dict[str, Any]:
        symbol = str(row["symbol"]).upper()
        payload = fetch_ticker_financials(symbol)
        return score_small_cap_candidate(symbol, payload, screener_row=row)

    with ThreadPoolExecutor(max_workers=min(4, deep_limit)) as executor:
        futures = {executor.submit(enrich, row): row for row in shortlist[:deep_limit]}
        for future in as_completed(futures):
            row = futures[future]
            try:
                candidates.append(future.result())
            except Exception as exc:
                failures.append({"symbol": str(row.get("symbol")), "error": type(exc).__name__})

    candidates.sort(
        key=lambda item: (
            item.get("potentialScore") or 0,
            item.get("evidenceCoverage") or 0,
        ),
        reverse=True,
    )
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "criteria": {
            "minMarketCap": min_market_cap,
            "maxMarketCap": max_market_cap,
            "minAverageVolume": min_avg_volume,
            "sector": sector,
            "country": country,
        },
        "universeCount": len(universe),
        "deepAnalyzedCount": len(candidates),
        "candidates": candidates,
        "failures": failures,
        "method": {
            "ranking": "deterministic_small_cap_potential_v1",
            "probability": "heuristic_signal_v1",
            "probabilityCalibrated": False,
        },
    }


def persist_small_cap_scan(scan: dict[str, Any]) -> None:
    if not supabase_store.is_configured():
        return
    rows = []
    timestamp = scan.get("generatedAt") or datetime.now(timezone.utc).isoformat()
    for candidate in scan.get("candidates", []):
        if not isinstance(candidate, dict) or not candidate.get("symbol"):
            continue
        future = candidate.get("futurePotential") if isinstance(candidate.get("futurePotential"), dict) else {}
        relationships = candidate.get("relationships") if isinstance(candidate.get("relationships"), dict) else {}
        rows.append({
            "symbol": candidate["symbol"],
            "company_name": candidate.get("name"),
            "sector": candidate.get("sector"),
            "industry": candidate.get("industry"),
            "market_cap": candidate.get("marketCap"),
            "market_cap_class": candidate.get("marketCapClass"),
            "potential_score": candidate.get("potentialScore"),
            "estimated_outperformance_probability": future.get("estimated12mOutperformanceProbability"),
            "probability_method": future.get("method"),
            "confidence": future.get("confidence"),
            "evidence_coverage": candidate.get("evidenceCoverage"),
            "relationship_count": relationships.get("verifiedCount", 0),
            "risk_flags": candidate.get("riskFlags", []),
            "positives": candidate.get("positives", []),
            "payload": candidate,
            "last_scanned_at": timestamp,
        })
    if rows:
        supabase_store._upsert_rows("small_cap_candidates", rows, on_conflict="symbol", strict=True)


def load_persisted_small_caps(*, limit: int = 30, min_score: int = 0) -> list[dict[str, Any]]:
    if not supabase_store.is_configured():
        return []
    try:
        rows = supabase_store._select_rows(
            "small_cap_candidates",
            {
                "potential_score": f"gte.{max(0, min(100, min_score))}",
                "select": "*",
                "order": "potential_score.desc,last_scanned_at.desc",
                "limit": str(max(1, min(100, limit))),
            },
        )
    except Exception:
        return []
    return rows
