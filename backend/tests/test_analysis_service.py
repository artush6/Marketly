import unittest
from unittest.mock import patch

from app.services.analysis_service import build_ticker_score


class AnalysisServiceTests(unittest.TestCase):
    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_orchestrates_dependencies(
        self,
        mock_fetch_ticker_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_ticker,
    ):
        mock_fetch_ticker_financials.return_value = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple Inc."},
            "financials": {},
        }
        mock_fetch_macro_indicators.return_value = {"GDP (Real)": []}
        mock_get_news.return_value = []
        mock_score_ticker.return_value = {
            "score": 80,
            "summary": "Strong profile",
            "positives": ["Growth"],
            "negatives": ["Rich valuation"],
        }

        result = build_ticker_score("aapl")

        mock_fetch_ticker_financials.assert_called_once_with("AAPL", force_refresh=False)
        mock_fetch_macro_indicators.assert_called_once_with()
        mock_get_news.assert_called_once_with("AAPL")
        self.assertEqual(result["symbol"], "AAPL")
        self.assertEqual(result["score"], 80)
        self.assertIn("profitability", result)
        self.assertIn("growth", result)
        self.assertIn("stability", result)
        self.assertIn("valuation", result)

    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_raises_on_financials_error(self, mock_fetch_ticker_financials):
        mock_fetch_ticker_financials.return_value = {"error": "no provider data"}

        with self.assertRaises(ValueError):
            build_ticker_score("aapl")

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_raises_on_analysis_error(
        self,
        mock_fetch_ticker_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_ticker,
    ):
        mock_fetch_ticker_financials.return_value = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple Inc."},
            "financials": {},
        }
        mock_fetch_macro_indicators.return_value = {}
        mock_get_news.return_value = []
        mock_score_ticker.return_value = {"error": "openai timeout"}

        with self.assertRaises(ValueError):
            build_ticker_score("aapl")

    @patch("app.services.analysis_service.CacheManager")
    def test_build_ticker_score_returns_cached_score_when_available(self, mock_cache):
        mock_cache.make_key.return_value = "marketly:scores:AAPL"
        mock_cache.get.return_value = '{"symbol":"AAPL","score":91,"summary":"Cached","positives":[],"negatives":[],"company":"Apple Inc.","profitability":{"coverage":0.0},"growth":{"coverage":0.0},"stability":{"coverage":0.0},"valuation":{"coverage":0.0}}'

        result = build_ticker_score("aapl")

        self.assertEqual(result["score"], 91)
        mock_cache.get.assert_called_once_with("marketly:scores:AAPL")


if __name__ == "__main__":
    unittest.main()
