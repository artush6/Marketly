import unittest
from unittest.mock import patch

from app.services.analysis_service import build_stock_score


class AnalysisServiceTests(unittest.TestCase):
    @patch("app.services.analysis_service.score_stock")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_stock_financials")
    def test_build_stock_score_orchestrates_dependencies(
        self,
        mock_fetch_stock_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_stock,
    ):
        mock_fetch_stock_financials.return_value = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple Inc."},
            "financials": {},
        }
        mock_fetch_macro_indicators.return_value = {"GDP (Real)": []}
        mock_get_news.return_value = []
        mock_score_stock.return_value = {
            "score": 80,
            "summary": "Strong profile",
            "positives": ["Growth"],
            "negatives": ["Rich valuation"],
        }

        result = build_stock_score("aapl")

        mock_fetch_stock_financials.assert_called_once_with("AAPL")
        mock_fetch_macro_indicators.assert_called_once_with()
        mock_get_news.assert_called_once_with("AAPL")
        self.assertEqual(result["symbol"], "AAPL")
        self.assertEqual(result["score"], 80)

    @patch("app.services.analysis_service.fetch_stock_financials")
    def test_build_stock_score_raises_on_financials_error(self, mock_fetch_stock_financials):
        mock_fetch_stock_financials.return_value = {"error": "no provider data"}

        with self.assertRaises(ValueError):
            build_stock_score("aapl")

    @patch("app.services.analysis_service.score_stock")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_stock_financials")
    def test_build_stock_score_raises_on_analysis_error(
        self,
        mock_fetch_stock_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_stock,
    ):
        mock_fetch_stock_financials.return_value = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple Inc."},
            "financials": {},
        }
        mock_fetch_macro_indicators.return_value = {}
        mock_get_news.return_value = []
        mock_score_stock.return_value = {"error": "openai timeout"}

        with self.assertRaises(ValueError):
            build_stock_score("aapl")


if __name__ == "__main__":
    unittest.main()
