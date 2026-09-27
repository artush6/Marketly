from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.financial_trends import build_financial_trends
from app.services.company_intelligence import build_company_intelligence


def row(year, period="FY", **values):
    return {"date": f"{year}-12-31", "period": period, "reportedCurrency": "USD", **values}


def test_frequency_currency_and_matching_cash_period():
    payload = {"financials": {
        "income_statement": [row(2025, revenue=120), row(2024, revenue=100), row(2025, "Q4", revenue=40)],
        "cash_flow": [row(2024, operatingCashFlow=30, capitalExpenditure=-10), row(2025, reportedCurrency="EUR", operatingCashFlow=40, capitalExpenditure=-10)],
    }, "sources": {"income_statement": "fmp", "cash_flow": "sec_xbrl"}}
    data = build_financial_trends(payload)["observations"]
    annual = next(o for o in data if o["date"] == "2025-12-31" and o["period"] == "FY" and o["currency"] == "USD")
    assert annual["metrics"]["revenue"]["yoyChange"] == pytest.approx(.2)
    assert annual["metrics"]["fcfMargin"]["value"] is None
    quarter = next(o for o in data if o["period"] == "Q4")
    assert quarter["metrics"]["revenue"]["yoyChange"] is None
    assert quarter["metrics"]["revenue"]["cagr"] == {}


def test_actual_horizons_and_missing_values():
    payload = {"financials": {"income_statement": [row(2025, revenue=200), row(2022, revenue=100), row(2015, revenue=50), row(2024, revenue=0)]}}
    point = build_financial_trends(payload)["observations"][-1]["metrics"]["revenue"]
    assert point["cagr"]["3"] == pytest.approx(2 ** (1 / (1096 / 365.25)) - 1)
    assert point["cagr"]["5"] is None
    assert point["cagr"]["10"] is not None
    assert point["yoyChange"] is None
    assert build_company_intelligence("TEST", payload)["businessQuality"]["revenueCagr3Y"]["value"] == pytest.approx(point["cagr"]["3"])


def test_restatement_provenance_signs_and_no_zero_fill():
    payload = {"_fetchedAt": "2026-01-10T00:00:00Z", "sources": {"cash_flow": "fmp"}, "financials": {
        "income_statement": [row(2025, revenue=100)],
        "cash_flow": [row(2025, operatingCashFlow=30, capitalExpenditure=-10, filedDate="2026-01-01"), row(2025, operatingCashFlow=40, capitalExpenditure=-10, filedDate="2026-01-05", sourceUrl="https://www.sec.gov/example")],
    }}
    metrics = build_financial_trends(payload)["observations"][0]["metrics"]
    assert metrics["freeCashFlow"]["value"] == 30
    assert metrics["fcfMargin"]["value"] == .3
    assert metrics["freeCashFlow"]["kind"] == "calculated"
    assert metrics["freeCashFlow"]["inputs"] == ["operatingCashFlow", "capex"]
    assert metrics["capex"]["value"] == -10
    assert metrics["capex"]["sourceUrl"] == "https://www.sec.gov/example"
    assert metrics["capex"]["updatedAt"] == payload["_fetchedAt"]
    assert metrics["dilutedShares"]["value"] is None


def test_invalid_values_unknown_periods_and_negative_base():
    payload = {"financials": {"income_statement": [row(2025, revenue=True, eps=2), row(2024, revenue="NaN", eps=-1), {"date": "2023-12-31", "revenue": 50}, {"date": "bad", "period": "FY"}]}}
    data = build_financial_trends(payload)
    assert data["excludedRows"] == 2
    assert data["observations"][-1]["metrics"]["revenue"]["value"] is None
    assert data["observations"][-1]["metrics"]["eps"]["yoyChange"] is None
    assert build_financial_trends({})["observations"] == []


def test_summary_rejects_misaligned_cash_flow():
    payload = {"financials": {"income_statement": [row(2025, revenue=100)], "cash_flow": [row(2024, operatingCashFlow=50, capitalExpenditure=-10)]}}
    result = build_company_intelligence("TEST", payload)
    assert result["businessQuality"]["freeCashFlowMargin"]["value"] is None
    assert result["capitalAllocation"]["capitalExpenditureToRevenue"]["value"] is None


def test_routes_share_trends_without_mutating_cached_snapshot():
    payload = {"symbol": "TEST", "financials": {"income_statement": [row(2025, revenue=100)]}}
    with patch("app.routes.financials.fetch_ticker_financials", return_value=payload), patch("app.routes.financials.CacheManager.get", return_value=None):
        response = TestClient(app).get("/financials/TEST?track=false")
    assert response.status_code == 200
    assert response.json()["financialTrends"]["observations"][0]["metrics"]["revenue"]["value"] == 100
    assert "financialTrends" not in payload
    with patch("app.routes.companies.fetch_ticker_financials", return_value=payload):
        intelligence = TestClient(app).get("/companies/TEST/intelligence").json()
    assert intelligence["financialTrends"] == response.json()["financialTrends"]
