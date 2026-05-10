import unittest
from unittest.mock import patch

from app.models import TickerData
from app.services.classification.service import classify_business_model
from app.services.events.service import build_event_catalyst_layer
from app.services.facts.service import build_fact_graph
from app.services.history.service import build_history_context
from app.services.interpretation.service import build_interpretation_layer
from app.services.scenarios.service import build_scenarios
from app.services.scoring.metrics import build_scoring_metrics


class AnalysisLayersTests(unittest.TestCase):
    def test_ip_driven_stack_builds_launch_scenarios(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "TTWO",
                "info": {
                    "shortName": "Take-Two Interactive",
                    "sector": "Communication Services",
                    "industry": "Electronic Gaming & Multimedia",
                    "grossMargin": 0.56,
                    "marketCap": 36_000_000_000,
                    "priceToBook": 17.0,
                },
                "quote": {"c": 197.0},
                "financials": {
                    "income_statement": [
                        {"revenue": 5500, "netIncome": 200, "operatingIncome": 280},
                        {"revenue": 5300, "netIncome": 150, "operatingIncome": 240},
                        {"revenue": 4100, "netIncome": 90, "operatingIncome": 160},
                        {"revenue": 3500, "netIncome": 80, "operatingIncome": 130},
                    ],
                    "balance_sheet": [
                        {"totalAssets": 8000, "totalStockholdersEquity": 2500}
                    ],
                },
            }
        )
        news = [{"headline": "GTA VI launch cycle expected to drive online engagement"}]
        fact_graph = build_fact_graph(ticker_data)
        scoring_metrics = build_scoring_metrics(ticker_data)
        business_model = classify_business_model(ticker_data, fact_graph, news)
        interpretation = build_interpretation_layer(ticker_data, fact_graph, scoring_metrics, business_model)
        history_context = build_history_context(ticker_data, business_model)
        events = build_event_catalyst_layer(business_model, interpretation, news)
        scenarios = build_scenarios(business_model, interpretation, events, history_context)

        self.assertEqual(business_model["primaryModel"], "ip_driven")
        self.assertEqual(events["lifecycleModel"]["pattern"], "launch -> hype -> peak -> decay -> stabilization")
        self.assertEqual(len(scenarios["cases"]), 3)
        self.assertEqual(scenarios["cases"][0]["name"], "bull")
        self.assertIn("probabilityRationale", scenarios["cases"][0])
        self.assertIn("keyEvidence", scenarios["cases"][0])
        self.assertIn("watchlistTriggers", scenarios["cases"][0])

    @patch("app.services.scenarios.service.generate_scenarios")
    def test_scenarios_use_valid_gpt_output_and_normalize_probabilities(self, mock_generate_scenarios):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "MOMO",
                "info": {
                    "shortName": "Momentum Example",
                    "sector": "Technology",
                    "industry": "Software",
                    "beta": 1.6,
                    "trailingPE": 45,
                },
                "financials": {},
            }
        )
        mock_generate_scenarios.return_value = {
            "asymmetry": "upside can overshoot before fundamentals catch up",
            "cases": [
                {
                    "name": "momentum melt-up",
                    "probability": 60,
                    "confidence": "medium",
                    "thesis": "Risk-on demand keeps pulling valuation higher despite thin fundamental confirmation.",
                    "mustGoRight": ["Positive catalysts keep arriving."],
                    "breaksIf": ["Growth evidence fails to follow the price move."],
                    "probabilityRationale": "Narrative momentum has the highest near-term weight.",
                    "keyEvidence": ["Positive catalysts are visible."],
                    "watchlistTriggers": ["Analyst tone changes."],
                },
                {
                    "name": "fundamentals catch up",
                    "probability": 30,
                    "confidence": "medium",
                    "thesis": "Revenue growth improves enough to justify the premium multiple.",
                    "mustGoRight": ["Growth acceleration appears in reported data."],
                    "breaksIf": ["Margins weaken as growth returns."],
                    "probabilityRationale": "The setup needs fundamentals to validate the multiple.",
                    "keyEvidence": ["Current growth evidence is weak."],
                    "watchlistTriggers": ["Revenue growth inflects."],
                },
                {
                    "name": "valuation air pocket",
                    "probability": 10,
                    "confidence": "low",
                    "thesis": "The stock derates when narrative momentum fades.",
                    "mustGoRight": ["Investors keep tolerating rich valuation."],
                    "breaksIf": ["Negative news resets expectations."],
                    "probabilityRationale": "Lower probability but material if sentiment reverses.",
                    "keyEvidence": ["Valuation is rich."],
                    "watchlistTriggers": ["Multiple compression begins."],
                },
            ],
        }

        scenarios = build_scenarios(
            {"primaryModel": "saas", "secondaryModels": []},
            {
                "growthDurability": {"label": "weak"},
                "marginQuality": {"label": "mixed"},
                "valuationDependency": {"label": "high"},
                "balanceSheetRisk": {"label": "moderate"},
            },
            {
                "keyCatalysts": [
                    {"tone": "positive"},
                    {"tone": "positive"},
                ],
                "retentionRisk": "medium",
            },
            {"analogTemplates": ["high multiple momentum"]},
            ticker_data=ticker_data,
            scoring_metrics={
                "growth": {"revenueGrowthYoY": -0.02},
                "profitability": {},
                "stability": {},
                "valuation": {"trailingPE": 45},
            },
            news_data=[{"headline": "Shares surge after analyst upgrade"}],
            market_context={"equityRiskSentiment": "risk_on"},
        )

        self.assertEqual(scenarios["source"], "openai")
        self.assertEqual(scenarios["cases"][0]["name"], "momentum melt-up")
        self.assertEqual(
            scenarios["cases"][0]["probabilityRationale"],
            "Narrative momentum has the highest near-term weight.",
        )
        self.assertEqual(scenarios["cases"][0]["keyEvidence"], ["Positive catalysts are visible."])
        self.assertAlmostEqual(
            sum(case["probability"] for case in scenarios["cases"]),
            1.0,
            places=4,
        )
        self.assertIn(
            "bullish market can extend valuation beyond fundamental support",
            scenarios["anomalyFlags"],
        )

    @patch("app.services.scenarios.service.generate_scenarios")
    def test_scenarios_fall_back_when_gpt_output_is_invalid(self, mock_generate_scenarios):
        mock_generate_scenarios.return_value = {"cases": []}
        ticker_data = TickerData.from_raw(
            {
                "symbol": "AAPL",
                "info": {"shortName": "Apple Inc."},
                "financials": {},
            }
        )

        scenarios = build_scenarios(
            {"primaryModel": "hardware_ecosystem"},
            {"valuationDependency": {"label": "moderate"}},
            {"keyCatalysts": [], "retentionRisk": "low"},
            {"analogTemplates": ["premium ecosystem"]},
            ticker_data=ticker_data,
            scoring_metrics={},
            news_data=[],
        )

        self.assertEqual(scenarios["source"], "deterministic_fallback")
        self.assertEqual(len(scenarios["cases"]), 3)
        self.assertEqual(scenarios["cases"][0]["name"], "bull")


if __name__ == "__main__":
    unittest.main()
