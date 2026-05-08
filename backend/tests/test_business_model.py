import unittest

from app.models import TickerData
from app.services.classification.service import classify_business_model
from app.services.facts.service import build_fact_graph


class BusinessModelTests(unittest.TestCase):
    def test_classifies_take_two_like_name_as_ip_driven(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "TTWO",
                "info": {
                    "shortName": "Take-Two Interactive Software Inc",
                    "sector": "Communication Services",
                    "industry": "Electronic Gaming & Multimedia",
                    "grossMargin": 0.56,
                },
                "financials": {
                    "income_statement": [
                        {"revenue": 5500},
                        {"revenue": 5300},
                        {"revenue": 4100},
                        {"revenue": 3500},
                    ]
                },
            }
        )
        fact_graph = build_fact_graph(ticker_data)
        business_model = classify_business_model(
            ticker_data,
            fact_graph,
            news_data=[{"headline": "GTA VI release cycle could reshape engagement"}],
        )

        self.assertEqual(business_model["primaryModel"], "ip_driven")
        self.assertIn("release cadence", " ".join(business_model["frameworkFocus"]))


if __name__ == "__main__":
    unittest.main()
