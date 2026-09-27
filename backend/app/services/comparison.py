"""One metric contract for ticker comparisons and cached small-cap screening."""
from app.services.financial_trends import build_financial_trends, number


def comparison_metrics(payload, trends=None):
    trends = trends or build_financial_trends(payload)
    info = payload.get("info") or {}
    sources = payload.get("sources") or {}
    stamp = (payload.get("dataQuality") or {}).get("fetchedAt") or payload.get("_fetchedAt")
    annual = [o for o in trends["observations"] if o["frequency"] == "annual"]
    latest = annual[-1] if annual else None
    result = {}
    def put(key, value, unit, basis, period=None, currency=None, source=None, note=None):
        result[key] = {"value": number(value), "unit": unit, "basis": basis, "period": period,
                       "currency": currency, "source": source, "asOf": stamp, "note": note}
    for key, field in [("forwardPE", "forwardPE"), ("trailingPE", "trailingPE"), ("evEbitda", "enterpriseToEbitda"), ("evSales", "enterpriseToRevenue"), ("priceSales", "priceToSalesTrailing12Months"), ("priceBook", "priceToBook")]:
        value = number(info.get(field))
        put(key, value if value is not None and value > 0 else None, "multiple", "Forward" if key == "forwardPE" else "Provider current", source=sources.get("info"), note="Provider multiple; estimate/TTM basis may vary between issuers.")
    put("marketCap", info.get("marketCap"), "money", "Current", currency=info.get("currency"), source=sources.get("info"))
    for key in ["revenue", "ebitda", "operatingIncome", "netIncome", "freeCashFlow", "cash", "debt", "netDebt", "totalAssets", "equity", "eps", "operatingCashFlow", "capex", "grossProfit"]:
        point = (latest or {}).get("metrics", {}).get(key) or {}
        put(key, point.get("value"), "number" if key == "eps" else "money", "FY", (latest or {}).get("date"), (latest or {}).get("currency"), point.get("source"))
    for key, numerator in [("grossMargin", "grossProfit"), ("ebitdaMargin", "ebitda"), ("operatingMargin", "operatingIncome"), ("netMargin", "netIncome"), ("fcfMargin", "freeCashFlow")]:
        n, d = result[numerator]["value"], result["revenue"]["value"]
        put(key, n / d * 100 if n is not None and d is not None and d > 0 else None, "percent", "FY", (latest or {}).get("date"), source=result[numerator]["source"], note="Same fiscal period and currency; numerator / revenue.")
    for key, field in [("revenueGrowth", "revenue"), ("epsGrowth", "eps"), ("ebitdaGrowth", "ebitda"), ("fcfGrowth", "freeCashFlow")]:
        point = (latest or {}).get("metrics", {}).get(field) or {}
        growth = number(point.get("yoyChange"))
        put(key, growth * 100 if growth is not None else None, "percent", "FY YoY", (latest or {}).get("date"), source=point.get("source"))
    point = (latest or {}).get("metrics", {}).get("revenue") or {}
    cagr = (point.get("cagr") or {}).get("3")
    put("revenueCagr", cagr * 100 if cagr is not None else None, "percent", "3Y annual CAGR", (latest or {}).get("date"), source=point.get("source"))
    fcf, cap = result["freeCashFlow"], result["marketCap"]
    compatible = fcf["currency"] and fcf["currency"] == cap["currency"]
    put("fcfYield", fcf["value"] / cap["value"] * 100 if compatible and fcf["value"] is not None and cap["value"] and cap["value"] > 0 else None, "percent", "FY FCF / current cap", fcf["period"], source=fcf["source"], note="Annual FCF divided by current market cap; not TTM.")
    debt, ebitda = result["netDebt"]["value"], result["ebitda"]["value"]
    put("netDebtEbitda", debt / ebitda if debt is not None and ebitda is not None and ebitda > 0 else None, "multiple", "FY", (latest or {}).get("date"), source=result["debt"]["source"])
    return result
