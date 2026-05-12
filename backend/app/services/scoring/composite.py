from __future__ import annotations

from typing import Any


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _score_ratio(
    value: Any,
    *,
    low: float,
    high: float,
    max_points: float,
    reverse: bool = False,
    missing_points: float | None = None,
) -> float:
    if not isinstance(value, (int, float)):
        return max_points * 0.45 if missing_points is None else missing_points
    ratio = _clamp((value - low) / (high - low), 0.0, 1.0)
    if reverse:
        ratio = 1.0 - ratio
    return ratio * max_points


def _average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _label_adjustment(label: str | None, adjustments: dict[str, float]) -> float:
    return adjustments.get(label or "", 0.0)


def _tone_counts(event_layer: dict[str, Any]) -> dict[str, int]:
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    for catalyst in event_layer.get("keyCatalysts", []):
        tone = catalyst.get("tone", "neutral")
        if tone in counts:
            counts[tone] += 1
    return counts


def _profitability_subscore(
    metrics: dict[str, Any],
    interpretation: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    components = [
        _score_ratio(metrics.get("grossMargin"), low=0.15, high=0.65, max_points=5),
        _score_ratio(metrics.get("operatingMargin"), low=0.0, high=0.35, max_points=5),
        _score_ratio(metrics.get("netMargin"), low=0.0, high=0.25, max_points=4),
        _score_ratio(metrics.get("roe"), low=0.0, high=0.35, max_points=3),
    ]
    score = _average(components) * 4
    notes: list[str] = []
    penalties: list[str] = []
    margin_label = interpretation.get("marginQuality", {}).get("label")
    score += _label_adjustment(
        margin_label,
        {"strong": 1.0, "weak": -1.5, "mixed": 0.0},
    )
    if margin_label == "strong":
        notes.append("Margin quality supports the score.")
    if margin_label == "weak":
        penalties.append("Weak margin quality limits profitability score.")
    return round(_clamp(score, 0, 17)), notes, penalties


def _growth_subscore(
    metrics: dict[str, Any],
    interpretation: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    components = [
        _score_ratio(metrics.get("revenueGrowthYoY"), low=-0.1, high=0.25, max_points=6),
        _score_ratio(metrics.get("revenueCagr3Y"), low=-0.05, high=0.18, max_points=4),
        _score_ratio(metrics.get("epsGrowthYoY"), low=-0.15, high=0.25, max_points=4),
        _score_ratio(metrics.get("netIncomeGrowthYoY"), low=-0.15, high=0.25, max_points=3),
    ]
    score = _average(components) * 4
    notes: list[str] = []
    penalties: list[str] = []
    growth_label = interpretation.get("growthDurability", {}).get("label")
    score += _label_adjustment(
        growth_label,
        {"strong": 1.0, "weak": -1.5, "mixed": 0.0},
    )
    if growth_label == "strong":
        notes.append("Growth durability improves the score.")
    if growth_label == "weak":
        penalties.append("Weak growth durability pressures the score.")
    return round(_clamp(score, 0, 17)), notes, penalties


def _valuation_subscore(
    metrics: dict[str, Any],
    interpretation: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    components = [
        _score_ratio(metrics.get("trailingPE"), low=8, high=45, max_points=5, reverse=True),
        _score_ratio(metrics.get("forwardPE"), low=8, high=40, max_points=5, reverse=True),
        _score_ratio(metrics.get("priceToSales"), low=1, high=12, max_points=4, reverse=True),
        _score_ratio(metrics.get("pegRatio"), low=0.5, high=3.0, max_points=3, reverse=True),
    ]
    score = _average(components) * 4
    notes: list[str] = []
    penalties: list[str] = []
    valuation_label = interpretation.get("valuationDependency", {}).get("label")
    score += _label_adjustment(
        valuation_label,
        {"high": -2.0, "moderate": 0.0, "low": 1.0},
    )
    if valuation_label == "high":
        penalties.append("High valuation dependency reduces the valuation score.")
    if valuation_label == "low":
        notes.append("Lower valuation dependency supports the score.")
    return round(_clamp(score, 0, 17)), notes, penalties


def _balance_sheet_subscore(
    metrics: dict[str, Any],
    interpretation: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    components = [
        _score_ratio(metrics.get("debtToEquity"), low=0.0, high=2.0, max_points=7, reverse=True),
        _score_ratio(metrics.get("debtRatio"), low=0.0, high=0.8, max_points=5, reverse=True),
        _score_ratio(metrics.get("interestCoverage"), low=0.0, high=12.0, max_points=5),
    ]
    score = _average(components) * 3
    notes: list[str] = []
    penalties: list[str] = []
    risk_label = interpretation.get("balanceSheetRisk", {}).get("label")
    score += _label_adjustment(
        risk_label,
        {"low": 1.0, "moderate": 0.0, "high": -2.0, "mixed": -0.5},
    )
    if risk_label == "low":
        notes.append("Balance-sheet risk looks low.")
    if risk_label == "high":
        penalties.append("High balance-sheet risk reduces the score.")
    return round(_clamp(score, 0, 17)), notes, penalties


def _market_news_subscore(
    event_layer: dict[str, Any],
    market_context: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    score = 8.0
    notes: list[str] = []
    penalties: list[str] = []
    tones = _tone_counts(event_layer)

    score += min(3, tones["positive"])
    score -= min(3, tones["negative"])

    if event_layer.get("retentionRisk") == "high":
        score -= 1.5
        penalties.append("High retention risk weakens the catalyst setup.")
    if event_layer.get("keyCatalysts"):
        notes.append("Visible catalysts improve near-term signal quality.")

    sentiment = market_context.get("equityRiskSentiment")
    if sentiment == "risk_on":
        score += 1.5
        notes.append("Risk-on market context supports sentiment-sensitive upside.")
    elif sentiment == "risk_off":
        score -= 1.5
        penalties.append("Risk-off market context pressures the setup.")

    return round(_clamp(score, 0, 16)), notes, penalties


def _macro_subscore(market_context: dict[str, Any]) -> tuple[int, list[str], list[str]]:
    score = 8.0
    notes: list[str] = []
    penalties: list[str] = []

    if market_context.get("liquidityFlag") == "easing":
        score += 2
        notes.append("Easing liquidity improves the macro backdrop.")
    elif market_context.get("liquidityFlag") == "tightening":
        score -= 2
        penalties.append("Tightening liquidity weakens the macro backdrop.")

    if market_context.get("indexTrend") == "rising":
        score += 1.5
    elif market_context.get("indexTrend") == "falling":
        score -= 1.5

    if market_context.get("inflationDirection") == "falling":
        score += 1
    elif market_context.get("inflationDirection") == "rising":
        score -= 1

    if market_context.get("rateDirection") == "falling":
        score += 1
    elif market_context.get("rateDirection") == "rising":
        score -= 1

    return round(_clamp(score, 0, 16)), notes, penalties


def build_composite_score(
    scoring_metrics: dict[str, dict[str, Any]],
    interpretation: dict[str, Any],
    market_context: dict[str, Any],
    event_layer: dict[str, Any],
    data_quality: dict[str, Any],
) -> dict[str, Any]:
    profitability, profitability_notes, profitability_penalties = _profitability_subscore(
        scoring_metrics.get("profitability", {}),
        interpretation,
    )
    growth, growth_notes, growth_penalties = _growth_subscore(
        scoring_metrics.get("growth", {}),
        interpretation,
    )
    valuation, valuation_notes, valuation_penalties = _valuation_subscore(
        scoring_metrics.get("valuation", {}),
        interpretation,
    )
    balance_sheet, balance_notes, balance_penalties = _balance_sheet_subscore(
        scoring_metrics.get("stability", {}),
        interpretation,
    )
    market_news, market_notes, market_penalties = _market_news_subscore(
        event_layer,
        market_context,
    )
    macro, macro_notes, macro_penalties = _macro_subscore(market_context)

    raw_score = profitability + growth + valuation + balance_sheet + market_news + macro
    confidence_adjustment = 0
    confidence_level = data_quality.get("confidenceLevel")
    if confidence_level == "low":
        confidence_adjustment = -5
    elif confidence_level == "medium":
        confidence_adjustment = -2

    final_score = round(_clamp(raw_score + confidence_adjustment, 0, 100))

    return {
        "score": final_score,
        "rawScore": raw_score,
        "confidenceAdjustment": confidence_adjustment,
        "subscores": {
            "profitability": profitability,
            "growth": growth,
            "valuation": valuation,
            "balanceSheet": balance_sheet,
            "marketNews": market_news,
            "macro": macro,
        },
        "maxSubscores": {
            "profitability": 17,
            "growth": 17,
            "valuation": 17,
            "balanceSheet": 17,
            "marketNews": 16,
            "macro": 16,
        },
        "bonuses": (
            profitability_notes
            + growth_notes
            + valuation_notes
            + balance_notes
            + market_notes
            + macro_notes
        )[:8],
        "penalties": (
            profitability_penalties
            + growth_penalties
            + valuation_penalties
            + balance_penalties
            + market_penalties
            + macro_penalties
        )[:8],
        "method": "deterministic_v1",
    }
