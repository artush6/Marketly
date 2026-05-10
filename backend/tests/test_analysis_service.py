import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.analysis_service import build_ticker_score


class AnalysisServiceTests(unittest.TestCase):
    def setUp(self):
        settings_patcher = patch(
            "app.services.analysis_service.settings",
            SimpleNamespace(
                FRED_API_KEY="fred-key",
                FINNHUB_API_KEY="finnhub-key",
                FMP_API_KEY="fmp-key",
                OPENAI_API_KEY="openai-key",
                FMPSDK_API_KEY="fmp-key",
                RAPIDAPI_KEY=None,
            ),
        )
        validator_patcher = patch(
            "app.services.analysis_service.validate_financials_configuration"
        )
        scenarios_patcher = patch(
            "app.services.scenarios.service.generate_scenarios",
            return_value={"error": "skip network in unit tests"},
        )
        self.addCleanup(settings_patcher.stop)
        self.addCleanup(validator_patcher.stop)
        self.addCleanup(scenarios_patcher.stop)
        settings_patcher.start()
        validator_patcher.start()
        scenarios_patcher.start()

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
        self.assertIn("analysisId", result)
        self.assertIn("analysisVersion", result)
        self.assertIn("dataTimestamp", result)
        self.assertIn("profitability", result)
        self.assertIn("growth", result)
        self.assertIn("stability", result)
        self.assertIn("valuation", result)
        self.assertIn("analysisMetadata", result)
        self.assertIn("factCoverage", result["analysisMetadata"])
        self.assertIn("dataQualityScore", result["analysisMetadata"])
        self.assertIn("confidenceLevel", result["analysisMetadata"])
        self.assertIn("provenance", result["analysisMetadata"])
        self.assertIn("refreshPolicy", result["analysisMetadata"])
        self.assertIn("inputPartitions", result["analysisMetadata"])
        self.assertIn("businessModel", result)
        self.assertIn("interpretation", result)
        self.assertIn("eventCatalysts", result)
        self.assertIn("historyContext", result)
        self.assertIn("marketContext", result)
        self.assertIn("scenarios", result)
        self.assertEqual(result["analysisSource"], "openai")

    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_raises_on_financials_error(self, mock_fetch_ticker_financials):
        mock_fetch_ticker_financials.return_value = {"error": "no provider data"}

        with self.assertRaises(ValueError):
            build_ticker_score("aapl")

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_falls_back_on_analysis_error(
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

        result = build_ticker_score("aapl")

        self.assertEqual(result["analysisSource"], "fallback")
        self.assertIsInstance(result["score"], int)

    @patch("app.services.analysis_service.CacheManager")
    def test_build_ticker_score_returns_cached_score_when_available(self, mock_cache):
        mock_cache.make_key.return_value = "marketly:scores:AAPL"
        mock_cache.get.return_value = '{"symbol":"AAPL","score":91,"summary":"Cached","positives":[],"negatives":[],"company":"Apple Inc.","profitability":{"coverage":0.0},"growth":{"coverage":0.0},"stability":{"coverage":0.0},"valuation":{"coverage":0.0}}'

        result = build_ticker_score("aapl")

        self.assertEqual(result["score"], 91)
        mock_cache.get.assert_called_once_with("marketly:scores:AAPL")


if __name__ == "__main__":
    unittest.main()
