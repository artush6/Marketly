import unittest

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


if __name__ == "__main__":
    unittest.main()
