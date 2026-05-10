from __future__ import annotations

from typing import Any

from app.integrations.gpt import generate_scenarios
from app.models import TickerData
from app.serialization import sanitize


def _make_scenario(
    name: str,
    probability: float,
    confidence: str,
    thesis: str,
    must_go_right: list[str],
    breaks: list[str],
    probability_rationale: str | None = None,
    key_evidence: list[str] | None = None,
    watchlist_triggers: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "probability": probability,
        "confidence": confidence,
        "thesis": thesis,
        "mustGoRight": must_go_right,
        "breaksIf": breaks,
        "probabilityRationale": probability_rationale
        or "Probability is based on the deterministic scenario template and current structured risk labels.",
        "keyEvidence": key_evidence or [],
        "watchlistTriggers": watchlist_triggers or [],
    }


def _fallback_scenarios(
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    event_layer: dict[str, Any],
    history_context: dict[str, Any],
    signal_summary: dict[str, Any] | None = None,
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
            "Upside is capped below the base case until retention evidence confirms a durable post-launch tail.",
            [
                "Business model classified as IP/live-service driven.",
                f"Retention risk is {retention_risk}.",
            ],
            [
                "Launch/release reception changes materially.",
                "Engagement or monetization commentary confirms a durable online tail.",
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
            "Base case remains highest because event success can be real without becoming a generational platform outcome.",
            [
                "Launch-driven lifecycle model is active.",
                f"Valuation dependency is {valuation_dependency}.",
            ],
            [
                "Launch quality/review data lands above or below expectations.",
                "Market reaction shows whether success was already priced in.",
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
            "Downside probability reflects the risk that launch hype does not convert into durable recurring economics.",
            [
                "IP-driven revenue can be lumpy.",
                f"Retention risk is {retention_risk}.",
            ],
            [
                "Post-launch player retention weakens.",
                "Monetization decays faster than expected.",
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
            "Upside depends on ecosystem durability offsetting hardware cyclicality and preserving premium valuation.",
            [
                "Business model classified as hardware ecosystem.",
                f"Valuation dependency is {valuation_dependency}.",
            ],
            [
                "Refresh-cycle demand changes materially.",
                "Services attach or margin data changes the durability view.",
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
            "Base case is highest because strong ecosystem economics can coexist with slower hardware growth.",
            [
                "Installed-base economics are the main framework.",
                f"Retention risk is {retention_risk}.",
            ],
            [
                "Upgrade cycle resilience becomes clearer.",
                "Services growth materially accelerates or disappoints.",
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
            "Bear case is lower than base because durable cash generation can soften operational disappointment.",
            [
                "Hardware cycles can pressure growth.",
                f"Valuation dependency is {valuation_dependency}.",
            ],
            [
                "Replacement cycles lengthen.",
                "Regulatory or ecosystem pressure damages the moat narrative.",
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
            "Upside probability reflects a broad quality compounder template where execution and valuation both cooperate.",
            [
                f"Valuation dependency is {valuation_dependency}.",
                f"Retention risk is {retention_risk}.",
            ],
            [
                "Growth and margins move in the same direction.",
                "Valuation expands or compresses around earnings updates.",
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
            "Base case is highest when the company has mixed signals but no single dominant catalyst.",
            [
                "Fallback business model template is active.",
                f"Valuation dependency is {valuation_dependency}.",
            ],
            [
                "Revenue growth trend changes.",
                "Margin or multiple pressure becomes visible.",
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
            "Bear case probability reflects the chance that slower growth and valuation pressure arrive together.",
            [
                f"Valuation dependency is {valuation_dependency}.",
                f"Retention risk is {retention_risk}.",
            ],
            [
                "Narrative support fades.",
                "Execution weakens while valuation remains demanding.",
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
        "source": "deterministic_fallback",
        "asymmetry": asymmetry,
        "historicalContextNeeded": history_context.get("analogTemplates", []),
        "signalSummary": signal_summary or {},
        "anomalyFlags": (signal_summary or {}).get("anomalyFlags", []),
        "cases": [bull, base, bear],
    }


def _headline_text(news_data: list[dict[str, Any]]) -> str:
    return " ".join(
        f"{item.get('headline', '')} {item.get('summary', '')}".lower()
        for item in news_data[:12]
    )


def _tone_counts(event_layer: dict[str, Any]) -> dict[str, int]:
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    for catalyst in event_layer.get("keyCatalysts", []):
        tone = catalyst.get("tone", "neutral")
        if tone in counts:
            counts[tone] += 1
    return counts


def _label(value: Any, *, high: float, low: float) -> str:
    if not isinstance(value, (int, float)):
        return "unknown"
    if value >= high:
        return "high"
    if value <= low:
        return "low"
    return "moderate"


def _build_signal_summary(
    ticker_data: TickerData,
    scoring_metrics: dict[str, dict[str, Any]],
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    event_layer: dict[str, Any],
    history_context: dict[str, Any],
    news_data: list[dict[str, Any]],
    economic_data: dict[str, Any] | None,
    market_context: dict[str, Any] | None,
) -> dict[str, Any]:
    info = ticker_data.info
    growth = scoring_metrics.get("growth", {})
    profitability = scoring_metrics.get("profitability", {})
    stability = scoring_metrics.get("stability", {})
    valuation = scoring_metrics.get("valuation", {})
    text = _headline_text(news_data)
    tones = _tone_counts(event_layer)

    revenue_growth = growth.get("revenueGrowthYoY")
    revenue_cagr = growth.get("revenueCagr3Y")
    net_income_growth = growth.get("netIncomeGrowthYoY")
    gross_margin = profitability.get("grossMargin")
    operating_margin = profitability.get("operatingMargin")
    trailing_pe = valuation.get("trailingPE")
    forward_pe = valuation.get("forwardPE")
    price_to_sales = valuation.get("priceToSales")
    debt_to_equity = stability.get("debtToEquity")

    valuation_richness = "normal"
    if (
        isinstance(trailing_pe, (int, float))
        and trailing_pe >= 35
        or isinstance(forward_pe, (int, float))
        and forward_pe >= 30
        or isinstance(price_to_sales, (int, float))
        and price_to_sales >= 8
    ):
        valuation_richness = "rich"
    elif (
        isinstance(trailing_pe, (int, float))
        and 0 < trailing_pe <= 15
        or isinstance(forward_pe, (int, float))
        and 0 < forward_pe <= 15
    ):
        valuation_richness = "cheap"

    catalyst_intensity = "low"
    if len(event_layer.get("keyCatalysts", [])) >= 4 or tones["positive"] >= 3:
        catalyst_intensity = "high"
    elif event_layer.get("keyCatalysts"):
        catalyst_intensity = "medium"

    market_regime = "neutral"
    bullish_terms = ("surge", "record", "rally", "bull", "upgrade", "strong demand", "beat")
    bearish_terms = ("sell-off", "cut", "warning", "delay", "miss", "drop", "weak demand")
    if (
        tones["positive"] > tones["negative"]
        or any(term in text for term in bullish_terms)
        or (market_context or {}).get("equityRiskSentiment") == "risk_on"
    ):
        market_regime = "bullish_or_risk_on"
    if (
        tones["negative"] > tones["positive"]
        or any(term in text for term in bearish_terms)
        or (market_context or {}).get("equityRiskSentiment") == "risk_off"
    ):
        market_regime = "bearish_or_risk_off"

    anomaly_flags: list[str] = []
    if valuation_richness == "rich" and (
        interpretation.get("growthDurability", {}).get("label") == "weak"
        or _label(revenue_growth, high=0.12, low=0.0) == "low"
    ):
        anomaly_flags.append("rich valuation despite weak or slowing growth")
    if market_regime == "bullish_or_risk_on" and valuation_richness == "rich":
        anomaly_flags.append("bullish market can extend valuation beyond fundamental support")
    if tones["positive"] >= 2 and (
        _label(net_income_growth, high=0.12, low=0.0) == "low"
        or _label(revenue_growth, high=0.12, low=0.0) == "low"
    ):
        anomaly_flags.append("positive narrative momentum is stronger than recent fundamentals")
    if isinstance(info.beta, (int, float)) and info.beta >= 1.4 and market_regime == "bullish_or_risk_on":
        anomaly_flags.append("high-beta stock can overshoot in a risk-on tape")
    if business_model.get("primaryModel") in {"ip_driven", "live_services"} and event_layer.get("retentionRisk") == "high":
        anomaly_flags.append("launch outcome may be strong while retention still disappoints")

    return sanitize(
        {
            "company": info.shortName,
            "sector": info.sector,
            "industry": info.industry,
            "primaryModel": business_model.get("primaryModel"),
            "secondaryModels": business_model.get("secondaryModels", []),
            "marketRegime": market_regime,
            "catalystIntensity": catalyst_intensity,
            "newsToneCounts": tones,
            "growthTrend": {
                "revenueGrowthYoY": revenue_growth,
                "revenueCagr3Y": revenue_cagr,
                "netIncomeGrowthYoY": net_income_growth,
                "label": interpretation.get("growthDurability", {}).get("label"),
            },
            "marginTrend": {
                "grossMargin": gross_margin,
                "operatingMargin": operating_margin,
                "label": interpretation.get("marginQuality", {}).get("label"),
            },
            "valuationRisk": {
                "richness": valuation_richness,
                "trailingPE": trailing_pe,
                "forwardPE": forward_pe,
                "priceToSales": price_to_sales,
                "dependency": interpretation.get("valuationDependency", {}).get("label"),
            },
            "balanceSheetRisk": {
                "debtToEquity": debt_to_equity,
                "label": interpretation.get("balanceSheetRisk", {}).get("label"),
            },
            "beta": info.beta,
            "retentionRisk": event_layer.get("retentionRisk"),
            "monetizationDurability": event_layer.get("monetizationDurability"),
            "historicalAnalogTemplates": history_context.get("analogTemplates", []),
            "anomalyFlags": anomaly_flags,
            "economicBackdrop": economic_data or {},
            "marketContext": market_context or {},
        }
    )


def _valid_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:5]


def _normalize_cases(cases: Any) -> list[dict[str, Any]]:
    if not isinstance(cases, list) or len(cases) < 3:
        return []

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(cases[:5]):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or f"case_{index + 1}").strip().lower()
        thesis = str(item.get("thesis") or "").strip()
        if not thesis:
            continue

        probability = item.get("probability")
        if not isinstance(probability, (int, float)) or probability < 0:
            probability = 0.0

        confidence = str(item.get("confidence") or "medium").strip().lower()
        if confidence not in {"low", "medium", "high"}:
            confidence = "medium"

        normalized.append(
            {
                "name": name,
                "probability": float(probability),
                "confidence": confidence,
                "thesis": thesis,
                "mustGoRight": _valid_text_list(item.get("mustGoRight")),
                "breaksIf": _valid_text_list(item.get("breaksIf")),
                "probabilityRationale": str(
                    item.get("probabilityRationale") or ""
                ).strip(),
                "keyEvidence": _valid_text_list(item.get("keyEvidence")),
                "watchlistTriggers": _valid_text_list(item.get("watchlistTriggers")),
            }
        )

    if len(normalized) < 3:
        return []

    total = sum(case["probability"] for case in normalized)
    if total <= 0:
        equal_probability = round(1 / len(normalized), 4)
        for case in normalized:
            case["probability"] = equal_probability
    else:
        for case in normalized:
            case["probability"] = round(case["probability"] / total, 4)

    difference = round(1.0 - sum(case["probability"] for case in normalized), 4)
    normalized[-1]["probability"] = round(normalized[-1]["probability"] + difference, 4)
    return normalized


def _normalize_gpt_scenarios(
    scenarios: dict[str, Any],
    history_context: dict[str, Any],
    signal_summary: dict[str, Any],
) -> dict[str, Any] | None:
    if not isinstance(scenarios, dict) or scenarios.get("error"):
        return None

    cases = _normalize_cases(scenarios.get("cases"))
    if not cases:
        return None

    asymmetry = str(scenarios.get("asymmetry") or "balanced").strip()
    historical_context_needed = _valid_text_list(
        scenarios.get("historicalContextNeeded")
        or history_context.get("analogTemplates", [])
    )

    return {
        "source": "openai",
        "asymmetry": asymmetry,
        "historicalContextNeeded": historical_context_needed,
        "signalSummary": signal_summary,
        "anomalyFlags": signal_summary.get("anomalyFlags", []),
        "cases": cases,
    }


def build_scenarios(
    business_model: dict[str, Any],
    interpretation: dict[str, Any],
    event_layer: dict[str, Any],
    history_context: dict[str, Any],
    ticker_data: TickerData | dict | None = None,
    scoring_metrics: dict[str, dict[str, Any]] | None = None,
    news_data: list[dict[str, Any]] | None = None,
    economic_data: dict[str, Any] | None = None,
    market_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    news_data = news_data or []
    scoring_metrics = scoring_metrics or {}

    if ticker_data is None:
        return _fallback_scenarios(
            business_model,
            interpretation,
            event_layer,
            history_context,
        )
    if not isinstance(ticker_data, TickerData):
        ticker_data = TickerData.from_raw(ticker_data)

    signal_summary = _build_signal_summary(
        ticker_data,
        scoring_metrics,
        business_model,
        interpretation,
        event_layer,
        history_context,
        news_data,
        economic_data,
        market_context,
    )
    gpt_result = generate_scenarios(
        ticker_data=ticker_data,
        scoring_metrics=scoring_metrics,
        business_model=business_model,
        interpretation=interpretation,
        event_layer=event_layer,
        history_context=history_context,
        signal_summary=signal_summary,
        news_data=news_data,
    )
    normalized = _normalize_gpt_scenarios(gpt_result, history_context, signal_summary)
    if normalized:
        return normalized

    return _fallback_scenarios(
        business_model,
        interpretation,
        event_layer,
        history_context,
        signal_summary,
    )
