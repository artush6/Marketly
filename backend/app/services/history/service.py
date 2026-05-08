from __future__ import annotations

from typing import Any

from app.models import TickerData


def _statement_value(row: dict[str, Any] | None, *keys: str) -> Any:
    if not row:
        return None
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


def build_history_context(
    ticker_data: TickerData,
    business_model: dict[str, Any],
) -> dict[str, Any]:
    income_statement = ticker_data.financials.income_statement or []
    revenues = [
        _statement_value(row, "revenue", "totalRevenue")
        for row in income_statement
        if isinstance(_statement_value(row, "revenue", "totalRevenue"), (int, float))
    ]
    trend_summary = "Historical statement coverage is limited."
    if len(revenues) >= 2:
        if revenues[0] > revenues[-1]:
            trend_summary = "Recent reported revenue is above older periods, indicating the business has expanded across the sampled history."
        elif revenues[0] < revenues[-1]:
            trend_summary = "Recent reported revenue is below older periods, indicating recent pressure versus the sampled history."
        else:
            trend_summary = "Reported revenue is broadly flat across the sampled history."

    primary_model = business_model.get("primaryModel")
    analog_templates: list[str] = []
    gaps: list[str] = []

    if primary_model == "ip_driven":
        analog_templates = [
            "prior franchise launch versus post-launch monetization tail",
            "premium launch spike versus recurring online spend conversion",
            "engagement retention after peak launch attention fades",
        ]
        gaps.append("Historical event-linked price reaction data is not yet connected.")
        gaps.append("Direct DAU/MAU or online spending proxies are not yet linked.")
    elif primary_model == "hardware_ecosystem":
        analog_templates = [
            "upgrade-cycle demand versus installed-base resilience",
            "services mix expansion versus hardware cyclicality",
            "premium multiple durability through product refresh cycles",
        ]
        gaps.append("Historical product-cycle tagging is not yet connected.")
    elif primary_model == "saas":
        analog_templates = [
            "prior periods of growth deceleration versus multiple compression",
            "margin expansion versus recurring revenue durability",
        ]

    return {
        "trendSummary": trend_summary,
        "analogTemplates": analog_templates,
        "dataGaps": gaps,
        "hasUsefulHistory": bool(revenues),
    }
