from __future__ import annotations

from typing import Any


def _make_scenario(
    name: str,
    probability: float,
    confidence: str,
    thesis: str,
    must_go_right: list[str],
    breaks: list[str],
) -> dict[str, Any]:
    return {
        "name": name,
        "probability": probability,
        "confidence": confidence,
        "thesis": thesis,
        "mustGoRight": must_go_right,
        "breaksIf": breaks,
    }


def build_scenarios(
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    event_layer: dict[str, Any],
    history_context: dict[str, Any],
) -> dict[str, Any]:
    primary_model = business_model.get("primaryModel")
    valuation_dependency = interpretation.get("valuationDependency", {}).get("label", "moderate")
    retention_risk = event_layer.get("retentionRisk", "medium")

    if primary_model in {"ip_driven", "live_services"}:
        bull = _make_scenario(
            "bull",
            0.25,
            "medium",
            "A major release becomes a multi-year monetization platform rather than a one-off premium sales event.",
            [
                "Launch quality exceeds expectations.",
                "Online engagement remains sticky after initial peak.",
                "Content cadence extends recurrent spend.",
            ],
            [
                "The online/live-service tail fails to hold players.",
                "Post-launch monetization decays faster than expected.",
            ],
        )
        base = _make_scenario(
            "base",
            0.5,
            "medium",
            "Launch demand is strong, but the long tail is good rather than generational.",
            [
                "The franchise converts launch hype into a meaningful but normal live-services tail.",
                "Execution remains solid enough to justify expectations.",
            ],
            [
                "Valuation had already priced in a stronger outcome.",
            ],
        )
        bear = _make_scenario(
            "bear",
            0.25,
            "medium",
            "The title launches well but fails to maintain durable engagement, leaving the stock over-dependent on short-lived hype.",
            [
                "Management would need to rebuild interest through updates and community retention.",
            ],
            [
                "Engagement collapses after the first wave.",
                "Market reprices the company as hit-driven rather than platform-like.",
            ],
        )
    elif primary_model == "hardware_ecosystem":
        bull = _make_scenario(
            "bull",
            0.28,
            "medium",
            "The installed base keeps spending inside the ecosystem, so services growth and pricing power sustain a premium multiple.",
            [
                "Product refreshes hold demand better than feared.",
                "Services/attach revenue expands faster than hardware cyclicality hurts.",
                "Capital returns keep per-share growth resilient.",
            ],
            [
                "Consumers lengthen replacement cycles.",
                "Services monetization disappoints relative to expectations.",
            ],
        )
        base = _make_scenario(
            "base",
            0.5,
            "medium",
            "The company remains strong operationally, but returns depend on whether the current premium multiple can survive slower hardware growth.",
            [
                "The ecosystem remains sticky.",
                "Margins stay healthy even if growth moderates.",
            ],
            [
                "A slowing upgrade cycle collides with an already rich valuation.",
            ],
        )
        bear = _make_scenario(
            "bear",
            0.22,
            "medium",
            "The brand stays powerful, but weaker demand and multiple compression produce underwhelming stock returns despite solid fundamentals.",
            [
                "Management protects cash generation and capital returns.",
            ],
            [
                "Hardware demand weakens faster than services can offset.",
                "Regulation or ecosystem pressure weakens the moat narrative.",
            ],
        )
    else:
        bull = _make_scenario(
            "bull",
            0.3,
            "medium",
            "Demand, margins, and capital allocation all reinforce the quality narrative at once.",
            [
                "Growth persists without margin erosion.",
                "The company protects pricing power.",
            ],
            [
                "Execution slips while valuation remains elevated.",
            ],
        )
        base = _make_scenario(
            "base",
            0.5,
            "medium",
            "The company performs reasonably well, but returns depend on whether the current multiple remains justified.",
            [
                "Operational execution stays solid.",
            ],
            [
                "Growth slows just enough to pressure the multiple.",
            ],
        )
        bear = _make_scenario(
            "bear",
            0.2,
            "medium",
            "A combination of slower growth and multiple compression erodes the thesis.",
            [
                "Management needs to stabilize demand and protect margins.",
            ],
            [
                "Narrative weakens before fundamentals can recover.",
            ],
        )

    asymmetry = "balanced"
    if valuation_dependency == "high":
        asymmetry = "skewed by valuation risk"
    elif retention_risk == "high":
        asymmetry = "skewed by retention risk"
    elif bull["probability"] > bear["probability"]:
        asymmetry = "positively skewed if execution holds"

    return {
        "asymmetry": asymmetry,
        "historicalContextNeeded": history_context.get("analogTemplates", []),
        "cases": [bull, base, bear],
    }
