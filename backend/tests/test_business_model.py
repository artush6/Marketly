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

    def test_classifies_life_sciences_tools_apparatus_as_infrastructure_not_biotech(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "TMO",
                "info": {
                    "shortName": "Thermo Fisher Scientific Inc.",
                    "sector": "Life Sciences Tools & Services",
                    "industry": "Measuring & Controlling Devices, NEC",
                    "grossMargin": 0.41,
                },
                "financials": {
                    "income_statement": [
                        {"revenue": 44_000},
                        {"revenue": 43_000},
                        {"revenue": 40_000},
                    ]
                },
            }
        )
        fact_graph = build_fact_graph(ticker_data)
        business_model = classify_business_model(
            ticker_data,
            fact_graph,
            news_data=[
                {
                    "headline": "Thermo Fisher expands cell therapy manufacturing tools",
                    "summary": "New bioprocessing platform supports lab equipment, instruments, and consumables workflows.",
                }
            ],
        )

        self.assertEqual(business_model["primaryModel"], "life_sciences_tools")
        self.assertIn("hardware_ecosystem", business_model["secondaryModels"])
        self.assertNotIn("clinical catalyst path", business_model["frameworkFocus"])
        self.assertNotIn("binary event risk", business_model["frameworkFocus"])


if __name__ == "__main__":
    unittest.main()
