import unittest

from app.models import TickerData
from app.services.classification.service import classify_business_model
from app.services.events.service import build_event_catalyst_layer
from app.services.facts.service import build_fact_graph
from app.services.history.service import build_history_context
from app.services.interpretation.service import build_interpretation_layer
from app.services.scoring.metrics import build_scoring_metrics
from app.services.trajectory.service import build_trajectory_layer


class TrajectoryLayerTests(unittest.TestCase):
    def test_ttwo_trajectory_focuses_on_launch_and_retention(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "TTWO",
                "info": {
                    "shortName": "Take-Two Interactive Software Inc",
                    "sector": "Communication Services",
                    "industry": "Electronic Gaming & Multimedia",
                    "grossMargin": 0.56,
                    "marketCap": 40_000_000_000,
                    "priceToBook": 17.0,
                },
                "quote": {"c": 197.0},
                "financials": {
                    "income_statement": [
                        {"revenue": 5500, "netIncome": 200, "operatingIncome": 280},
                        {"revenue": 5300, "netIncome": 150, "operatingIncome": 240},
                        {"revenue": 4100, "netIncome": 90, "operatingIncome": 160},
                    ]
                },
            }
        )
        news = [{"headline": "GTA VI launch cycle and pricing are in focus"}]
        fact_graph = build_fact_graph(ticker_data)
        scoring_metrics = build_scoring_metrics(ticker_data)
        business_model = classify_business_model(ticker_data, fact_graph, news)
        interpretation = build_interpretation_layer(ticker_data, fact_graph, scoring_metrics, business_model)
        history_context = build_history_context(ticker_data, business_model)
        event_layer = build_event_catalyst_layer(business_model, interpretation, news)
        trajectory = build_trajectory_layer(
            ticker_data,
            business_model,
            interpretation,
            event_layer,
            history_context,
            scoring_metrics,
            news,
        )

        self.assertEqual(business_model["primaryModel"], "ip_driven")
        self.assertIn("GTA VI launch timing", trajectory["upcomingDrivers"][0])
        self.assertEqual(trajectory["horizons"][0]["horizon"], "6M")
        self.assertIn("launch date certainty", " ".join(trajectory["horizons"][0]["drivers"]))


if __name__ == "__main__":
    unittest.main()
