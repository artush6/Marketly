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


def _headline_bundle(news_data: list[dict[str, Any]]) -> str:
    return " ".join(
        f"{item.get('headline', '')} {item.get('summary', '')}".lower()
        for item in news_data[:10]
    )


def _build_horizon(horizon: str, outlook: str, drivers: list[str], risks: list[str], focus: str) -> dict[str, Any]:
    return {
        "horizon": horizon,
        "outlook": outlook,
        "drivers": drivers,
        "risks": risks,
        "focus": focus,
    }


def build_trajectory_layer(
    ticker_data: TickerData,
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    event_layer: dict[str, Any],
    history_context: dict[str, Any],
    scoring_metrics: dict[str, dict[str, Any]],
    news_data: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    news_data = news_data or []
    primary_model = business_model.get("primaryModel", "unknown")
    income_statement = ticker_data.financials.income_statement or []
    text = _headline_bundle(news_data)

    revenues = [
        _statement_value(row, "revenue", "totalRevenue")
        for row in income_statement
        if isinstance(_statement_value(row, "revenue", "totalRevenue"), (int, float))
    ]
    past_drivers: list[str] = []
    upcoming_drivers: list[str] = []

    if len(revenues) >= 2 and revenues[0] > revenues[-1]:
        past_drivers.append("Reported revenue expansion across sampled periods likely supported prior narrative improvement.")
    elif len(revenues) >= 2 and revenues[0] < revenues[-1]:
        past_drivers.append("Recent revenue pressure suggests the previous stock narrative depended on expectations staying ahead of current fundamentals.")

    if primary_model == "ip_driven":
        past_drivers.extend(
            [
                "Prior appreciation likely depended on belief in franchise durability rather than smooth recurring growth.",
                "The market historically rewards hit franchises when investors expect a launch to extend into a multi-year monetization tail.",
            ]
        )
        upcoming_drivers.extend(
            [
                "GTA VI launch timing and reception can dominate the next 6-12 month narrative.",
                "The key medium-term question is whether online engagement becomes durable enough to resemble a platform rather than a one-off title.",
                "Over 3-5 years, the company can rerate if it proves it can compound franchise value across multiple major releases and live-service layers.",
            ]
        )
    elif primary_model == "hardware_ecosystem":
        past_drivers.extend(
            [
                "Historical stock strength was likely tied to installed-base expansion, pricing power, and services mix improvement.",
                "Capital returns and per-share earnings durability often mattered as much as raw top-line growth.",
            ]
        )
        upcoming_drivers.extend(
            [
                "The next 6-12 months depend on refresh-cycle resilience, services attach, and AI/product narrative credibility.",
                "The 3-5 year story depends on keeping the ecosystem sticky enough to defend premium economics.",
            ]
        )
    else:
        past_drivers.append("Prior stock performance likely reflected a mix of business execution, multiple expansion, and narrative support.")
        upcoming_drivers.append("Future returns will depend on whether operating execution remains strong enough to justify the current narrative.")

    if "delay" in text:
        upcoming_drivers.append("Delay risk is material because timing matters disproportionately for event-driven narratives.")
    if "price" in text and "gta" in text:
        upcoming_drivers.append("Pricing acceptance is part of the thesis, especially if management is trying to expand premium monetization.")

    growth_quality = interpretation.get("growthDurability", {}).get("label", "mixed")
    valuation_dependency = interpretation.get("valuationDependency", {}).get("label", "moderate")
    lifecycle_model = event_layer.get("lifecycleModel") or {}
    lifecycle_focus = lifecycle_model.get("focus")

    if primary_model == "ip_driven":
        horizons = [
            _build_horizon(
                "6M",
                "catalyst-driven",
                [
                    "launch date certainty",
                    "trailer/reception momentum",
                    "pre-release sentiment and pricing acceptance",
                ],
                [
                    "delay risk",
                    "controversy around pricing or launch quality expectations",
                ],
                "Watch whether excitement converts into credible launch-readiness rather than just hype.",
            ),
            _build_horizon(
                "12M",
                "event-resolution",
                [
                    "launch demand",
                    "review quality",
                    "initial online conversion",
                ],
                [
                    "front-loaded sales with weak retention",
                    "valuation disappointment if launch is big but not durable",
                ],
                lifecycle_focus or "Track whether the first year proves a durable post-launch engagement loop.",
            ),
            _build_horizon(
                "3Y",
                "franchise-compounding",
                [
                    "live-service monetization",
                    "content cadence",
                    "catalog resilience around flagship IP",
                ],
                [
                    "drop-off after launch peak",
                    "overdependence on one franchise",
                ],
                "The business starts to look stronger only if launch success becomes durable recurring spend.",
            ),
            _build_horizon(
                "5Y",
                "portfolio-quality",
                [
                    "proof that management can turn flagship launches into multi-year ecosystems",
                    "broader release bench beyond one title",
                ],
                [
                    "hit-driven volatility remains the core identity",
                ],
                "At five years, the question is whether TTWO is still just a release-cycle bet or a durable entertainment platform.",
            ),
            _build_horizon(
                "10Y",
                "franchise-longevity",
                [
                    "multi-cycle IP durability",
                    "ability to refresh franchises across console generations and monetization models",
                ],
                [
                    "consumer attention shifts faster than franchise renewal can keep up",
                ],
                "Ten-year upside comes from owning enduring entertainment IP, not just shipping one huge game.",
            ),
        ]
    else:
        horizons = [
            _build_horizon(
                "6M",
                "narrative-sensitive",
                ["near-term execution", "catalyst follow-through"],
                ["expectation reset", "multiple compression"],
                "Focus on whether recent catalysts reinforce or weaken the current narrative.",
            ),
            _build_horizon(
                "12M",
                "execution-sensitive",
                ["margin and demand resilience", "capital allocation"],
                ["growth slippage", "premium valuation pressure"],
                "The next year usually decides whether the current story is strengthening or fading.",
            ),
            _build_horizon(
                "3Y",
                "business-quality",
                ["durable economics", "reinvestment quality"],
                ["thesis drift", "competitive erosion"],
                "Three years should reveal whether this is a genuine compounding story.",
            ),
            _build_horizon(
                "5Y",
                "moat-test",
                ["moat durability", "earnings power"],
                ["narrative decay", "structural slowdown"],
                "Five years tests whether the company keeps earning a premium framework.",
            ),
            _build_horizon(
                "10Y",
                "structural",
                ["long-run market position", "capital allocation quality"],
                ["platform erosion", "business-model obsolescence"],
                "Ten years is about whether the company becomes structurally stronger, not just cyclical stronger.",
            ),
        ]

    return {
        "pastDrivers": past_drivers[:4],
        "upcomingDrivers": upcoming_drivers[:5],
        "horizons": horizons,
        "growthLens": growth_quality,
        "valuationLens": valuation_dependency,
        "historyLink": history_context.get("trendSummary"),
    }
