from __future__ import annotations

from typing import Any


def _classify_catalyst_type(text: str, primary_model: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in ("launch", "release", "gta", "trailer", "title")):
        return "product_cycle"
    if any(keyword in lowered for keyword in ("online", "engagement", "multiplayer", "live service")):
        return "engagement"
    if any(keyword in lowered for keyword in ("iphone", "device", "services", "wearable", "chip", "manufactur", "ai")):
        return "platform_cycle" if primary_model == "hardware_ecosystem" else "company_specific"
    if any(keyword in lowered for keyword in ("regulator", "approval", "fda", "court")):
        return "regulatory"
    if any(keyword in lowered for keyword in ("macro", "rate", "inflation", "consumer")):
        return "macro"
    if primary_model == "ip_driven":
        return "content_cycle"
    return "company_specific"


def build_event_catalyst_layer(
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    news_data: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    news_data = news_data or []
    primary_model = business_model.get("primaryModel", "unknown")

    catalysts: list[dict[str, Any]] = []
    for item in news_data[:6]:
        headline = (item.get("headline") or "").strip()
        if not headline:
            continue
        summary = (item.get("summary") or "").strip()
        joined = f"{headline} {summary}"
        catalyst_type = _classify_catalyst_type(joined, primary_model)
        tone = "neutral"
        if any(word in joined.lower() for word in ("buy", "strong", "upgrade", "boost", "approval", "surge")):
            tone = "positive"
        elif any(word in joined.lower() for word in ("risk", "delay", "sell-off", "concern", "drop")):
            tone = "negative"

        catalysts.append(
            {
                "title": headline,
                "type": catalyst_type,
                "tone": tone,
                "importance": "high" if catalyst_type in {"product_cycle", "content_cycle", "regulatory"} else "medium",
                "rationale": summary[:180] if summary else "Recent news flow points to a potentially material operating catalyst.",
            }
        )

    lifecycle = None
    retention_risk = "medium"
    monetization_durability = "uncertain"
    if primary_model in {"ip_driven", "live_services"}:
        lifecycle = {
            "pattern": "launch -> hype -> peak -> decay -> stabilization",
            "focus": "Measure whether launch demand converts into durable recurrent engagement.",
        }
        retention_risk = "high" if not catalysts else "medium"
        monetization_durability = "potentially strong if live-service engagement persists"

    if primary_model == "saas":
        monetization_durability = "generally durable if retention and expansion remain healthy"
        retention_risk = "low"
    elif primary_model == "hardware_ecosystem":
        lifecycle = {
            "pattern": "launch/refresh -> upgrade wave -> services attach -> replacement cycle",
            "focus": "Measure how well hardware demand converts into durable ecosystem revenue and recurring monetization.",
        }
        retention_risk = "low"
        monetization_durability = "strong if installed-base loyalty and services attach remain intact"

    return {
        "keyCatalysts": catalysts,
        "lifecycleModel": lifecycle,
        "retentionRisk": retention_risk,
        "monetizationDurability": monetization_durability,
        "interpretationLink": interpretation.get("summary"),
    }
