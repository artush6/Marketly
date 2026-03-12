import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.errors import MisconfigurationError
from app.main import app


class AnalysisRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @patch("app.routes.analysis.build_ticker_score")
    def test_score_success(self, mock_build_ticker_score):
        mock_build_ticker_score.return_value = {
            "symbol": "AAPL",
            "score": 75,
            "summary": "Solid fundamentals",
            "positives": ["Margins"],
            "negatives": ["Valuation"],
            "company": "Apple Inc.",
            "profitability": {
                "grossMargin": 0.55,
                "operatingMargin": 0.22,
                "netMargin": 0.15,
                "ebitdaMargin": 0.30,
                "roe": 0.28,
                "profitabilityScore": 68.5,
                "coverage": 1.0,
            },
            "growth": {
                "revenueGrowthYoY": 0.08,
                "revenueCagr3Y": 0.11,
                "epsGrowthYoY": 0.12,
                "netIncomeGrowthYoY": 0.10,
                "coverage": 1.0,
            },
            "stability": {
                "debtToEquity": 1.5,
                "debtRatio": 0.4,
                "interestCoverage": 12.0,
                "coverage": 1.0,
            },
            "valuation": {
                "trailingPE": 30.0,
                "forwardPE": 28.0,
                "pegRatio": 1.8,
                "priceToBook": 40.0,
                "priceToSales": 7.0,
                "dividendYield": 0.005,
                "marketCap": 1_000_000,
                "coverage": 1.0,
            },
        }

        response = self.client.get("/score/AAPL")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["symbol"], "AAPL")

    @patch("app.routes.analysis.build_ticker_score", side_effect=MisconfigurationError)
    def test_score_misconfigured(self, _):
        response = self.client.get("/score/AAPL")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Analysis service is not configured correctly.",
        )

    @patch("app.routes.analysis.build_ticker_score", side_effect=ValueError("upstream"))
    def test_score_upstream_failure(self, _):
        response = self.client.get("/score/AAPL")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json()["detail"],
            "Analysis failed because upstream data is unavailable.",
        )

    @patch("app.routes.analysis.build_ticker_score", side_effect=RuntimeError("boom"))
    def test_score_internal_failure(self, _):
        response = self.client.get("/score/AAPL")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "Analysis failed due to an internal error.",
        )


if __name__ == "__main__":
    unittest.main()
