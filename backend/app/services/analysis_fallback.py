from __future__ import annotations

from typing import Any


def build_fallback_analysis(
    company: str | None,
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    scenarios: dict[str, Any],
    trajectory: dict[str, Any] | None = None,
) -> dict[str, Any]:
    primary_model = business_model.get("primaryModel", "company").replace("_", " ")
    strengths = interpretation.get("strengths", [])[:4]
    risks = interpretation.get("risks", [])[:4]
    asymmetry = scenarios.get("asymmetry", "balanced")

    score = 58
    if "strong" in {
        interpretation.get("marginQuality", {}).get("label"),
        interpretation.get("growthDurability", {}).get("label"),
    }:
        score += 10
    if interpretation.get("valuationDependency", {}).get("label") == "high":
        score -= 7
    if interpretation.get("balanceSheetRisk", {}).get("label") == "high":
        score -= 6

    summary = (
        f"{company or 'This company'} looks most like a {primary_model} business. "
        f"The current read is {interpretation.get('marginQuality', {}).get('label', 'mixed')} margin quality, "
        f"{interpretation.get('growthDurability', {}).get('label', 'mixed')} growth durability, "
        f"and {asymmetry} risk/reward."
    )
    if trajectory and trajectory.get("upcomingDrivers"):
        summary += f" The next phase likely depends on {trajectory['upcomingDrivers'][0].rstrip('.')}."

    if not strengths:
        strengths = ["The business still has identifiable strategic strengths even when data coverage is incomplete."]
    if not risks:
        risks = ["Some important parts of the thesis still rely on incomplete evidence."]

    return {
        "score": max(20, min(90, score)),
        "summary": summary,
        "positives": strengths,
        "negatives": risks,
        "source": "fallback",
    }
