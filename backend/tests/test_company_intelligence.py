from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.company_intelligence import build_company_intelligence


def test_intelligence_uses_structured_history_and_preserves_provenance():
    payload = {
        "info": {"shortName": "Example Co", "trailingPE": 18, "dividendYield": 0.02},
        "quote": {"sharesOutstanding": 100},
        "financials": {
            "income_statement": [
                {"date": "2025-12-31", "revenue": 150, "grossProfit": 75, "operatingIncome": 30, "netIncome": 18},
                {"date": "2024-12-31", "revenue": 125, "grossProfit": 60, "operatingIncome": 22, "netIncome": 13},
                {"date": "2022-12-31", "revenue": 100, "grossProfit": 45, "operatingIncome": 15, "netIncome": 8},
            ],
            "balance_sheet": [
                {"date": "2025-12-31", "totalDebt": 80, "commonStockSharesOutstanding": 100},
                {"date": "2022-12-31", "totalDebt": 100, "commonStockSharesOutstanding": 110},
            ],
            "cash_flow": [
                {"date": "2025-12-31", "operatingCashFlow": 35, "capitalExpenditure": -10, "dividendsPaid": -5}
            ],
        },
        "sources": {"income_statement": "fmp+sec_xbrl", "balance_sheet": "fmp", "cash_flow": "fmp", "ratios": "fmp"},
        "_fetchedAt": "2026-01-02T00:00:00+00:00",
        "dataQuality": {"status": "complete"},
    }

    result = build_company_intelligence("EXM", payload)

    assert abs(result["businessQuality"]["revenueGrowthYoY"]["value"] - 0.2) < 1e-9
    assert result["businessQuality"]["revenueCagr3Y"]["availability"] == "available"
    assert result["businessQuality"]["operatingMargin"]["value"] == 0.2
    assert result["capitalAllocation"]["capitalExpenditureToRevenue"]["value"] == 10 / 150
    assert result["capitalAllocation"]["dividendPayoutOfFreeCashFlow"]["value"] == 0.2
    assert result["shareDilution"]["annualizedShareCountChange"]["value"] < 0
    assert result["valuation"]["trailingPE"]["value"] == 18
    assert result["dividends"]["dividendYield"]["value"] == 0.02
    assert result["provenance"]["income_statement"] == "fmp+sec_xbrl"
    assert result["freshness"]["fetchedAt"] == "2026-01-02T00:00:00+00:00"


def test_unavailable_metrics_are_explicit_and_not_inferred():
    result = build_company_intelligence("EMPTY", {})

    assert result["availability"] == "unavailable"
    assert result["businessQuality"]["revenueCagr3Y"]["value"] is None
    assert result["businessQuality"]["revenueCagr3Y"]["availability"] == "unavailable"
    assert result["capitalAllocation"]["dividendPayoutOfFreeCashFlow"]["value"] is None
    assert result["provenance"] == {}


def test_intelligence_route_reuses_financial_snapshot_and_validates_symbol():
    client = TestClient(app)
    payload = {"symbol": "MSFT", "info": {}, "quote": {}, "financials": {}, "sources": {}}
    with patch("app.routes.companies.fetch_ticker_financials", return_value=payload) as fetch:
        response = client.get("/companies/MSFT/intelligence")
        assert response.status_code == 200
        assert response.json()["symbol"] == "MSFT"
        fetch.assert_called_once_with("MSFT", force_refresh=False)
    assert client.get("/companies/../bad/intelligence").status_code in {404, 422}
