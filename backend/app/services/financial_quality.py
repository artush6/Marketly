from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


QUALITY_RANKS = {
    "insufficient": 0,
    "stale": 1,
    "partial": 2,
    "complete": 3,
}


def _nonempty_rows(financials: dict[str, Any], name: str) -> list[dict[str, Any]]:
    rows = financials.get(name)
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict) and row]


def _first_value(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value is not None:
            return value
    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def assess_financial_quality(
    payload: dict[str, Any],
    *,
    fetched_at: str | None = None,
    max_age_seconds: int | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
    quote = payload.get("quote") if isinstance(payload.get("quote"), dict) else {}
    financials = (
        payload.get("financials")
        if isinstance(payload.get("financials"), dict)
        else {}
    )
    sources = payload.get("sources") if isinstance(payload.get("sources"), dict) else {}

    income_rows = _nonempty_rows(financials, "income_statement")
    balance_rows = _nonempty_rows(financials, "balance_sheet")
    cash_flow_rows = _nonempty_rows(financials, "cash_flow")
    latest_income = income_rows[0] if income_rows else {}

    checks = {
        "company_name": _first_value(info, "shortName", "longName") is not None,
        "market_cap": _first_value(info, "marketCap") is not None
        or _first_value(quote, "marketCap") is not None,
        "current_price": _first_value(quote, "currentPrice", "c") is not None,
        "income_statement": bool(income_rows),
        "income_history": len(income_rows) >= 2,
        "latest_revenue": _first_value(latest_income, "revenue", "totalRevenue")
        is not None,
        "latest_net_income": _first_value(latest_income, "netIncome") is not None,
        "balance_sheet": bool(balance_rows),
        "cash_flow": bool(cash_flow_rows),
        "provenance": bool(sources),
    }
    coverage = round(sum(checks.values()) / len(checks), 3)
    statement_coverage = round(
        sum([bool(income_rows), bool(balance_rows), bool(cash_flow_rows)]) / 3,
        3,
    )

    missing_critical_fields = [
        field
        for field in (
            "income_statement",
            "latest_revenue",
            "latest_net_income",
        )
        if not checks[field]
    ]

    observed_at = fetched_at or payload.get("_fetchedAt")
    fetched = _parse_datetime(observed_at)
    current_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    is_stale = bool(
        fetched
        and max_age_seconds is not None
        and (current_time - fetched).total_seconds() > max_age_seconds
    )

    score_eligible = bool(
        checks["income_history"]
        and checks["latest_revenue"]
        and checks["latest_net_income"]
    )
    cache_eligible = bool(checks["income_statement"] and coverage >= 0.35)

    if is_stale:
        status = "stale"
        score_eligible = False
        cache_eligible = False
        reason = "financial_data_stale"
    elif statement_coverage == 1.0 and coverage >= 0.7:
        status = "complete"
        reason = None
    elif cache_eligible:
        status = "partial"
        reason = "financial_data_partial"
    else:
        status = "insufficient"
        score_eligible = False
        cache_eligible = False
        reason = "insufficient_financial_data"

    return {
        "status": status,
        "coverage": coverage,
        "statementCoverage": statement_coverage,
        "missingCriticalFields": missing_critical_fields,
        "fetchedAt": (fetched or current_time).isoformat(),
        "cacheEligible": cache_eligible,
        "scoreEligible": score_eligible,
        "reason": reason,
    }


def attach_financial_quality(
    payload: dict[str, Any],
    *,
    fetched_at: str | None = None,
    max_age_seconds: int | None = None,
) -> dict[str, Any]:
    payload["dataQuality"] = assess_financial_quality(
        payload,
        fetched_at=fetched_at,
        max_age_seconds=max_age_seconds,
    )
    payload["_fetchedAt"] = payload["dataQuality"]["fetchedAt"]
    return payload


def quality_rank(quality_or_payload: dict[str, Any] | None) -> int:
    value = quality_or_payload or {}
    quality = value.get("dataQuality") if isinstance(value.get("dataQuality"), dict) else value
    return QUALITY_RANKS.get(str(quality.get("status") or "insufficient"), 0)
