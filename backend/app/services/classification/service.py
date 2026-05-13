from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.models import TickerData
from app.services.facts.models import CompanyFactGraph


MODEL_FRAMEWORKS = {
    "life_sciences_tools": [
        "installed base strength",
        "consumables pull-through",
        "biotech funding cycle",
        "instrument replacement cadence",
        "service and workflow stickiness",
    ],
    "saas": [
        "recurring revenue durability",
        "gross margin quality",
        "operating leverage",
        "retention and expansion economics",
    ],
    "cloud": [
        "infrastructure demand durability",
        "workload growth",
        "gross margin and capex balance",
        "enterprise stickiness",
    ],
    "hardware_ecosystem": [
        "installed base strength",
        "upgrade cycle durability",
        "services attach",
        "pricing power",
    ],
    "manufacturing": [
        "utilization and volume leverage",
        "capex intensity",
        "input-cost sensitivity",
        "balance-sheet resilience",
    ],
    "ip_driven": [
        "release cadence",
        "franchise durability",
        "launch monetization",
        "valuation versus hit-dependency",
    ],
    "live_services": [
        "engagement retention",
        "content cadence",
        "recurrent user spend",
        "post-launch decay curve",
    ],
    "consumer_platform": [
        "engagement network effects",
        "ad or transaction monetization",
        "retention durability",
        "competitive attention risk",
    ],
    "biotech": [
        "clinical catalyst path",
        "cash runway",
        "binary event risk",
        "regulatory dependency",
    ],
    "cyclical": [
        "macro sensitivity",
        "inventory and demand swings",
        "pricing power through cycle",
        "downturn survivability",
    ],
}

GAMING_KEYWORDS = (
    "game",
    "gaming",
    "interactive",
    "franchise",
    "publisher",
    "entertainment",
    "rockstar",
    "gta",
    "grand theft auto",
    "red dead",
    "nba 2k",
    "borderlands",
)

SAAS_KEYWORDS = (
    "saas",
    "subscription",
    "crm",
    "erp",
    "workflow",
    "productivity suite",
    "collaboration software",
    "seat-based",
)

LIFE_SCIENCES_TOOLS_KEYWORDS = (
    "life sciences tools",
    "life science tools",
    "laboratory",
    "lab equipment",
    "instrument",
    "instruments",
    "consumables",
    "diagnostics",
    "analytical instruments",
    "bioprocessing",
    "cell therapy manufacturing",
    "thermo fisher",
    "measuring & controlling devices",
)

CLINICAL_BIOTECH_KEYWORDS = (
    "clinical trial",
    "clinical-stage",
    "phase 1",
    "phase 2",
    "phase 3",
    "fda approval",
    "drug candidate",
    "pipeline candidate",
    "therapeutic candidate",
)


def _normalized_text(*values: Any) -> str:
    return " ".join(str(value).lower() for value in values if value)


def _revenue_volatility(income_statement: list[dict[str, Any]]) -> float | None:
    revenues = [
        row.get("revenue") or row.get("totalRevenue")
        for row in income_statement
        if isinstance(row.get("revenue") or row.get("totalRevenue"), (int, float))
    ]
    if len(revenues) < 3:
        return None

    avg = sum(revenues) / len(revenues)
    if avg == 0:
        return None

    spread = max(revenues) - min(revenues)
    return spread / avg


def classify_business_model(
    ticker_data: TickerData,
    fact_graph: CompanyFactGraph,
    news_data: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    news_data = news_data or []
    info = ticker_data.info
    income_statement = ticker_data.financials.income_statement or []
    text = _normalized_text(
        info.shortName,
        info.sector,
        info.industry,
        " ".join(item.get("headline", "") for item in news_data[:10]),
        " ".join(item.get("summary", "") for item in news_data[:10]),
    )

    scores: dict[str, float] = defaultdict(float)
    evidence: dict[str, list[str]] = defaultdict(list)

    gross_margin_fact = fact_graph.facts.get("profitability.gross_margin")
    gross_margin = gross_margin_fact.value if gross_margin_fact else None
    revenue_volatility = _revenue_volatility(income_statement)
    gaming_signal = any(keyword in text for keyword in GAMING_KEYWORDS)
    saas_signal = any(keyword in text for keyword in SAAS_KEYWORDS)
    life_sciences_tools_signal = any(keyword in text for keyword in LIFE_SCIENCES_TOOLS_KEYWORDS)
    clinical_biotech_signal = any(keyword in text for keyword in CLINICAL_BIOTECH_KEYWORDS)
    launch_signal = any(keyword in text for keyword in ("launch", "release", "title", "trailer", "online"))

    def add(model: str, weight: float, reason: str) -> None:
        scores[model] += weight
        evidence[model].append(reason)

    if saas_signal:
        add("saas", 2.0, "Industry and text signals point to software/subscription economics.")
    if life_sciences_tools_signal:
        add(
            "life_sciences_tools",
            4.2,
            "Life-sciences tools and laboratory infrastructure language points to equipment, consumables, and services economics.",
        )
        add("hardware_ecosystem", 1.8, "Instrumentation and installed-base language suggests hardware ecosystem economics.")
        add("manufacturing", 1.5, "Bioprocessing/manufacturing language suggests utilization and services leverage.")
    if any(keyword in text for keyword in ("cloud", "azure", "infrastructure", "data center")):
        add("cloud", 2.0, "Company description/news flow points to cloud infrastructure exposure.")
    if any(keyword in text for keyword in ("iphone", "device", "consumer electronics", "wearables", "hardware")):
        add("hardware_ecosystem", 2.0, "Hardware and installed-base keywords suggest ecosystem economics.")
    if any(keyword in text for keyword in ("automotive", "vehicle", "factory", "industrial", "manufactur")):
        add("manufacturing", 2.0, "Text signals indicate volume-driven manufacturing economics.")
    if gaming_signal:
        add("ip_driven", 3.2, "Industry/news language points to franchise and content-cycle dependence.")
    if any(keyword in text for keyword in ("online", "live service", "season", "engagement", "multiplayer")) or (
        gaming_signal and launch_signal
    ):
        add("live_services", 1.7, "News or description references persistent online/service engagement.")
    if any(keyword in text for keyword in ("platform", "marketplace", "network", "social", "ads")):
        add("consumer_platform", 1.8, "Platform/network language suggests user engagement flywheel economics.")
    if clinical_biotech_signal or (
        any(keyword in text for keyword in ("biotech", "clinical", "trial", "fda", "drug"))
        and not life_sciences_tools_signal
    ):
        add("biotech", 2.5, "Clinical/regulatory keywords imply event-driven biotech economics.")

    if isinstance(gross_margin, (int, float)) and gross_margin >= 0.65:
        add("saas", 0.8, "Very high gross margins are consistent with software-like economics.")
        add("cloud", 0.5, "High gross margins support software/infrastructure-style economics.")
    if isinstance(gross_margin, (int, float)) and 0.45 <= gross_margin <= 0.65:
        add("ip_driven", 0.7, "Mid-to-high gross margins fit digital content/IP publishing economics.")
    if revenue_volatility is not None and revenue_volatility >= 0.25:
        add("ip_driven", 0.9, "Revenue volatility suggests launch/event-driven monetization.")
        add("cyclical", 0.4, "Uneven top-line pattern may indicate demand cyclicality or release lumpiness.")
    if gaming_signal and launch_signal:
        add("ip_driven", 1.0, "Launch-specific gaming coverage is a strong sign of event-driven IP economics.")
    if gaming_signal and saas_signal:
        scores["saas"] = max(0.0, scores["saas"] - 1.25)
        evidence["ip_driven"].append("Gaming/franchise evidence outweighs generic software wording in the company description.")
    if life_sciences_tools_signal:
        scores["saas"] = max(0.0, scores["saas"] - 1.0)
        scores["biotech"] = max(0.0, scores["biotech"] - 1.75)
        evidence["life_sciences_tools"].append(
            "Tools/services evidence outweighs clinical-stage biotech catalyst language."
        )

    if not scores:
        add("cyclical", 1.0, "Default fallback classification due to sparse evidence.")

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    primary_model, primary_score = ranked[0]
    secondary_models = [model for model, score in ranked[1:3] if score >= 1.5]
    total_score = sum(scores.values()) or 1.0
    confidence = round(min(0.95, primary_score / total_score + 0.35), 2)

    framework_focus = list(MODEL_FRAMEWORKS.get(primary_model, []))
    for model in secondary_models:
        for item in MODEL_FRAMEWORKS.get(model, []):
            if item not in framework_focus:
                framework_focus.append(item)

    return {
        "primaryModel": primary_model,
        "secondaryModels": secondary_models,
        "confidence": confidence,
        "evidence": evidence[primary_model][:5],
        "frameworkFocus": framework_focus[:6],
        "revenueVolatility": revenue_volatility,
    }
