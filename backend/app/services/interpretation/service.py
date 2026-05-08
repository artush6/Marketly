from __future__ import annotations

from typing import Any

from app.models import TickerData
from app.services.facts.models import CompanyFactGraph


def _label_from_score(value: float, *, high_threshold: float, low_threshold: float) -> str:
    if value >= high_threshold:
        return "strong"
    if value <= low_threshold:
        return "weak"
    return "mixed"


def build_interpretation_layer(
    ticker_data: TickerData,
    fact_graph: CompanyFactGraph,
    scoring_metrics: dict[str, dict[str, Any]],
    business_model: dict[str, Any],
) -> dict[str, Any]:
    profitability = scoring_metrics.get("profitability", {})
    growth = scoring_metrics.get("growth", {})
    stability = scoring_metrics.get("stability", {})
    valuation = scoring_metrics.get("valuation", {})
    primary_model = business_model.get("primaryModel")

    gross_margin = profitability.get("grossMargin")
    operating_margin = profitability.get("operatingMargin")
    revenue_growth = growth.get("revenueGrowthYoY")
    debt_to_equity = stability.get("debtToEquity")
    debt_ratio = stability.get("debtRatio")
    trailing_pe = valuation.get("trailingPE")
    price_to_sales = valuation.get("priceToSales")
    coverage = fact_graph.coverage.coverage_ratio
    cash_flow_rows = ticker_data.financials.cash_flow or []
    latest_cash_flow = cash_flow_rows[0] if cash_flow_rows else {}
    operating_cash_flow = latest_cash_flow.get("operatingCashFlow") or latest_cash_flow.get("netCashProvidedByOperatingActivities")
    free_cash_flow = latest_cash_flow.get("freeCashFlow")
    company_name = (ticker_data.info.shortName or "").lower()

    margin_quality = "mixed"
    margin_detail = "Margin visibility is partial, so quality assessment should remain provisional."
    if isinstance(gross_margin, (int, float)):
        if primary_model == "ip_driven":
            margin_quality = _label_from_score(gross_margin, high_threshold=0.5, low_threshold=0.3)
            margin_detail = (
                "Gross margin is the more useful lens here than quarter-to-quarter earnings, "
                "because IP-driven businesses can look optically weak between major launches."
            )
        elif primary_model == "hardware_ecosystem":
            margin_quality = _label_from_score(gross_margin, high_threshold=0.4, low_threshold=0.22)
            margin_detail = (
                "For hardware ecosystems, gross margin mainly reflects brand power, services mix, and pricing discipline rather than pure software economics."
            )
        elif primary_model == "manufacturing":
            margin_quality = _label_from_score(gross_margin, high_threshold=0.3, low_threshold=0.15)
            margin_detail = "For manufacturing-heavy names, the question is less absolute margin level and more stability through the cycle."
        else:
            margin_quality = _label_from_score(gross_margin, high_threshold=0.6, low_threshold=0.3)
            margin_detail = "Gross margin provides a reasonable first-pass read on pricing power and economic quality."
    if isinstance(operating_margin, (int, float)) and operating_margin >= 0.25 and primary_model in {"hardware_ecosystem", "saas", "cloud"}:
        margin_quality = "strong"
        margin_detail = "Operating margin confirms that the company converts scale and pricing power into real earnings strength."

    growth_quality = "mixed"
    growth_detail = "Growth durability remains uncertain because reported historical coverage is incomplete."
    if isinstance(revenue_growth, (int, float)):
        growth_quality = _label_from_score(revenue_growth, high_threshold=0.12, low_threshold=0.0)
        if primary_model == "ip_driven":
            growth_detail = (
                "Top-line growth should be interpreted through release timing and content cadence rather than as a smooth compounding series."
            )
        elif primary_model == "hardware_ecosystem":
            growth_detail = (
                "Growth durability depends on installed-base monetization, upgrade timing, and services mix more than on a single smooth revenue trend."
            )
        else:
            growth_detail = "Top-line momentum is a reasonable proxy for current demand durability."
    if isinstance(revenue_growth, (int, float)) and isinstance(gross_margin, (int, float)) and revenue_growth > 0 and gross_margin > 0.4 and primary_model == "hardware_ecosystem":
        growth_quality = "strong"

    balance_sheet_risk = "mixed"
    balance_sheet_detail = "Balance-sheet visibility is partial."
    if isinstance(debt_to_equity, (int, float)):
        if (
            isinstance(debt_ratio, (int, float))
            and debt_ratio <= 0.4
            and isinstance(operating_cash_flow, (int, float))
            and operating_cash_flow > 0
        ):
            balance_sheet_risk = "moderate"
            balance_sheet_detail = "Leverage exists, but cash generation meaningfully offsets balance-sheet stress."
        elif debt_to_equity <= 0.5:
            balance_sheet_risk = "low"
            balance_sheet_detail = "Leverage looks manageable relative to equity."
        elif debt_to_equity >= 1.5:
            balance_sheet_risk = "high"
            balance_sheet_detail = "Leverage is high enough to matter if execution weakens."
        else:
            balance_sheet_risk = "moderate"
            balance_sheet_detail = "Leverage is not alarming, but it limits flexibility in a downturn."

    valuation_dependency = "moderate"
    valuation_detail = "Valuation pressure depends on whether execution confirms the current narrative."
    if isinstance(trailing_pe, (int, float)) and trailing_pe >= 35:
        valuation_dependency = "high"
        valuation_detail = "The stock already discounts a strong future, so misses can compress the multiple quickly."
    elif isinstance(price_to_sales, (int, float)) and price_to_sales >= 8:
        valuation_dependency = "high"
        valuation_detail = "Revenue multiple implies strong execution must continue for upside to remain attractive."

    strengths: list[str] = []
    risks: list[str] = []

    if margin_quality == "strong":
        strengths.append("Margin structure suggests attractive underlying economics.")
    if growth_quality == "strong":
        strengths.append("Growth profile supports a durable demand narrative rather than a one-off blip.")
    if balance_sheet_risk == "low":
        strengths.append("Balance-sheet flexibility improves survivability and strategic optionality.")
    if balance_sheet_risk == "moderate" and isinstance(operating_cash_flow, (int, float)) and operating_cash_flow > 0:
        strengths.append("Cash-generation strength softens the practical risk of leverage.")
    if coverage < 0.7:
        risks.append("Evidence coverage is still thin, so conviction should be discounted.")
    if valuation_dependency == "high":
        risks.append("Valuation leaves less room for execution mistakes.")
    if primary_model == "ip_driven":
        risks.append("The real risk is not just launch size, but how quickly engagement fades after launch.")
        strengths.append("Franchise economics can become much stronger if a release creates a long-tail online spend loop.")
    if primary_model == "hardware_ecosystem":
        strengths.append("Installed-base economics can support durable monetization beyond the core hardware cycle.")
        risks.append("Returns still depend on keeping the ecosystem sticky enough to justify a premium multiple.")
    if "apple" in company_name and isinstance(free_cash_flow, (int, float)) and free_cash_flow > 0:
        strengths.append("Free cash flow gives management room to defend the narrative through buybacks and ecosystem reinvestment.")

    critical_unknowns: list[str] = []
    if coverage < 0.7:
        critical_unknowns.append("Some core financial fields are still sparse or low-confidence.")
    if primary_model in {"ip_driven", "live_services"}:
        critical_unknowns.append("Engagement retention and post-launch monetization durability are not directly measured yet.")
    if primary_model == "hardware_ecosystem":
        critical_unknowns.append("Installed-base retention and services attach are not yet modeled directly.")
    if primary_model == "biotech":
        critical_unknowns.append("Catalyst timing and probability of success require external event data beyond current fundamentals.")

    return {
        "summary": (
            f"{primary_model.replace('_', ' ')} economics suggest a {margin_quality} margin profile, "
            f"{growth_quality} growth durability, and {valuation_dependency} valuation sensitivity."
        ),
        "marginQuality": {"label": margin_quality, "detail": margin_detail},
        "growthDurability": {"label": growth_quality, "detail": growth_detail},
        "balanceSheetRisk": {"label": balance_sheet_risk, "detail": balance_sheet_detail},
        "valuationDependency": {"label": valuation_dependency, "detail": valuation_detail},
        "criticalUnknowns": critical_unknowns,
        "strengths": strengths[:4],
        "risks": risks[:5],
    }
