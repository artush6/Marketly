from __future__ import annotations

from typing import Any

from app.models import TickerData


def _series_values(economic_data: dict[str, Any], label: str) -> list[float]:
    rows = economic_data.get(label, [])
    if not isinstance(rows, list):
        return []
    return [
        row["value"]
        for row in rows
        if isinstance(row, dict) and isinstance(row.get("value"), (int, float))
    ]


def _direction(values: list[float], lookback: int = 6, threshold: float = 0.01) -> str:
    if len(values) < 2:
        return "unknown"
    recent = values[-1]
    prior = values[-min(len(values), lookback)]
    if prior == 0:
        return "unknown"
    change = (recent - prior) / abs(prior)
    if change > threshold:
        return "rising"
    if change < -threshold:
        return "falling"
    return "stable"


def _news_sentiment(news_data: list[dict[str, Any]]) -> str:
    text = " ".join(
        f"{item.get('headline', '')} {item.get('summary', '')}".lower()
        for item in news_data[:12]
    )
    positive_terms = ("surge", "rally", "upgrade", "beat", "record", "strong", "boost")
    negative_terms = ("drop", "miss", "delay", "warning", "downgrade", "weak", "risk")
    positive = sum(1 for term in positive_terms if term in text)
    negative = sum(1 for term in negative_terms if term in text)
    if positive > negative:
        return "positive"
    if negative > positive:
        return "negative"
    return "neutral"


def build_market_context(
    economic_data: dict[str, Any] | None,
    news_data: list[dict[str, Any]] | None,
    ticker_data: TickerData,
) -> dict[str, Any]:
    economic_data = economic_data or {}
    news_data = news_data or []

    sp500 = _series_values(economic_data, "S&P 500")
    fed_funds = _series_values(economic_data, "Fed Funds Rate")
    treasury_10y = _series_values(economic_data, "10Y Treasury Yield")
    cpi = _series_values(economic_data, "CPI (All Items)")

    index_trend = _direction(sp500, threshold=0.03)
    rate_direction = _direction(fed_funds, threshold=0.02)
    treasury_direction = _direction(treasury_10y, threshold=0.03)
    inflation_direction = _direction(cpi, threshold=0.005)
    company_news_sentiment = _news_sentiment(news_data)

    risk_on_score = 0
    if index_trend == "rising":
        risk_on_score += 2
    elif index_trend == "falling":
        risk_on_score -= 2
    if rate_direction == "falling":
        risk_on_score += 1
    elif rate_direction == "rising":
        risk_on_score -= 1
    if treasury_direction == "falling":
        risk_on_score += 1
    elif treasury_direction == "rising":
        risk_on_score -= 1
    if inflation_direction == "falling":
        risk_on_score += 1
    elif inflation_direction == "rising":
        risk_on_score -= 1
    if company_news_sentiment == "positive":
        risk_on_score += 1
    elif company_news_sentiment == "negative":
        risk_on_score -= 1

    equity_risk_sentiment = "neutral"
    if risk_on_score >= 2:
        equity_risk_sentiment = "risk_on"
    elif risk_on_score <= -2:
        equity_risk_sentiment = "risk_off"

    liquidity_flag = "neutral"
    if rate_direction == "falling" and treasury_direction != "rising":
        liquidity_flag = "easing"
    elif rate_direction == "rising" or treasury_direction == "rising":
        liquidity_flag = "tightening"

    beta = ticker_data.info.beta
    beta_sensitivity = "unknown"
    if isinstance(beta, (int, float)):
        if beta >= 1.3:
            beta_sensitivity = "high"
        elif beta <= 0.8:
            beta_sensitivity = "low"
        else:
            beta_sensitivity = "moderate"

    return {
        "equityRiskSentiment": equity_risk_sentiment,
        "liquidityFlag": liquidity_flag,
        "indexTrend": index_trend,
        "rateDirection": rate_direction,
        "treasuryYieldDirection": treasury_direction,
        "inflationDirection": inflation_direction,
        "companyNewsSentiment": company_news_sentiment,
        "betaSensitivity": beta_sensitivity,
        "riskOnScore": risk_on_score,
        "sector": ticker_data.info.sector,
    }
