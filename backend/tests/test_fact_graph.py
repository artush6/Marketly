import unittest

from app.models import TickerData
from app.services.facts.service import build_fact_graph


class FactGraphTests(unittest.TestCase):
    def test_build_fact_graph_extracts_coverage_and_sources(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "AAPL",
                "info": {
                    "shortName": "Apple Inc.",
                    "sector": "Technology",
                    "marketCap": 1_000_000,
                    "trailingPE": 30.0,
                    "grossMargin": 0.45,
                    "roe": 0.2,
                },
                "quote": {"c": 190.0},
                "financials": {
                    "income_statement": [
                        {
                            "revenue": 100,
                            "netIncome": 20,
                            "operatingIncome": 25,
                        }
                    ],
                    "balance_sheet": [
                        {
                            "totalAssets": 300,
                            "totalStockholdersEquity": 150,
                        }
                    ],
                },
                "sources": {
                    "profile": "finnhub",
                    "metrics": "fmp",
                    "quote": "finnhub",
                    "income_statement": "fmp",
                    "balance_sheet": "fmp",
                },
            }
        )

        fact_graph = build_fact_graph(ticker_data)

        self.assertEqual(fact_graph.symbol, "AAPL")
        self.assertEqual(fact_graph.facts["company.name"].source, "finnhub")
        self.assertEqual(fact_graph.facts["financials.revenue.latest"].value, 100)
        self.assertGreater(fact_graph.coverage.coverage_ratio, 0.5)
        self.assertEqual(fact_graph.coverage.conflict_fields, 0)


if __name__ == "__main__":
    unittest.main()
