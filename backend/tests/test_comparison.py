from app.services.comparison import comparison_metrics
from app.services.market_history import price_performance, earnings_expectations
from datetime import datetime, timezone
import pytest


def payload():
    return {"info":{"currency":"USD","marketCap":1000,"forwardPE":20,"trailingPE":-3},"financials":{
        "income_statement":[{"date":"2025-12-31","period":"FY","reportedCurrency":"USD","revenue":200,"netIncome":20,"ebitda":30}],
        "cash_flow":[{"date":"2025-12-31","period":"FY","reportedCurrency":"USD","operatingCashFlow":40,"capitalExpenditure":-10}],
        "balance_sheet":[{"date":"2025-12-31","period":"FY","reportedCurrency":"USD","totalDebt":50,"cashAndCashEquivalents":80}]}}


def test_shared_metrics_preserve_basis_and_negative_multiples():
    values=comparison_metrics(payload())
    assert values['netMargin']['value']==10
    assert values['netMargin']['basis']=='FY'
    assert values['trailingPE']['value'] is None
    assert values['forwardPE']['value']==20
    assert values['fcfYield']['value']==3


def test_currency_and_period_mismatch_do_not_generate_yield_or_margin():
    data=payload();data['financials']['cash_flow'][0]['reportedCurrency']='EUR'
    values=comparison_metrics(data)
    assert values['fcfYield']['value'] is None
    assert values['fcfMargin']['value'] is None


def test_unknowns_are_not_zero():
    assert all(v['value'] is None for v in comparison_metrics({}).values())


def test_returns_use_trading_boundary_and_no_fabricated_history():
    ts=lambda d:int(datetime.fromisoformat(d).replace(tzinfo=timezone.utc).timestamp())
    values=price_performance({'t':[ts('2025-01-02'),ts('2025-12-31'),ts('2026-01-02')],'c':[100,110,121]})
    assert next(r for r in values if r['period']=='YTD')['changePercent']==pytest.approx(10)
    assert next(r for r in values if r['period']=='5Y')['changePercent'] is None


def test_earnings_keep_provider_pairs_and_zero_estimates():
    result=earnings_expectations([{'period':'2026-06-30','actual':0.2,'estimate':0,'surprisePercent':None},{'period':'bad','actual':2}])
    assert len(result)==1 and result[0]['estimate']==0
    assert result[0]['surprisePercent'] is None
    assert result[0]['estimateAsOf'] is None
