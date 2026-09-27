"""Objective trends over existing snapshots; no provider requests or inferred history."""
from __future__ import annotations

from datetime import date
from math import isfinite
from typing import Any

# One registry serves all clients; no ticker-specific assumptions.
FIELDS = {
    "revenue": ("income_statement", ("revenue", "totalRevenue"), "currency"),
    "grossProfit": ("income_statement", ("grossProfit",), "currency"),
    "operatingIncome": ("income_statement", ("operatingIncome", "operatingIncomeLoss"), "currency"),
    "ebitda": ("income_statement", ("ebitda",), "currency"),
    "netIncome": ("income_statement", ("netIncome", "netIncomeLoss"), "currency"),
    "eps": ("income_statement", ("epsDiluted", "eps"), "currency_per_share"),
    "dilutedShares": ("income_statement", ("weightedAverageShsOutDil", "weightedAverageNumberOfDilutedSharesOutstanding"), "shares"),
    "cash": ("balance_sheet", ("cashAndCashEquivalents", "cashAndCashEquivalentsAtCarryingValue"), "currency"),
    "totalAssets": ("balance_sheet", ("totalAssets", "assets"), "currency"),
    "debt": ("balance_sheet", ("totalDebt", "shortLongTermDebtTotal"), "currency"),
    "equity": ("balance_sheet", ("totalStockholdersEquity", "totalShareholderEquity", "stockholdersEquity"), "currency"),
    "operatingCashFlow": ("cash_flow", ("operatingCashFlow", "netCashProvidedByOperatingActivities"), "currency"),
    "capex": ("cash_flow", ("capitalExpenditure", "capitalExpenditures", "capitalExpenditureReported"), "currency"),
    "stockBasedCompensation": ("cash_flow", ("stockBasedCompensation", "shareBasedCompensation"), "currency"),
    "dividendsPaid": ("cash_flow", ("dividendsPaid", "commonDividendsPaid", "commonStockDividendsPaid"), "currency"),
    "buybacks": ("cash_flow", ("commonStockRepurchased", "repurchaseOfCapitalStock"), "currency"),
    "acquisitions": ("cash_flow", ("acquisitionsNet",), "currency"),
    "debtRepayment": ("cash_flow", ("debtRepayment",), "currency"),
    "stockIssuance": ("cash_flow", ("commonStockIssuance",), "currency"),
}


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if isfinite(value) else None
    except (ValueError, TypeError, OverflowError):
        return None


def _date(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _point(value, unit, row, source, currency, fetched_at, methodology=None):
    return {
        "value": value, "unit": unit,
        "availability": "available" if value is not None else "unavailable",
        "kind": "calculated" if methodology else "reported",
        "source": source, "sourceUrl": row.get("sourceUrl") or row.get("finalLink") or row.get("link"),
        "period": str(row.get("fiscalDateEnding") or row.get("date") or "")[:10] or None,
        "currency": currency, "updatedAt": fetched_at,
        "filedAt": row.get("filedDate") or row.get("fillingDate"),
        "methodology": methodology,
    }


def build_financial_trends(payload: dict[str, Any]) -> dict[str, Any]:
    statements = payload.get("financials") or {}
    sources = payload.get("sources") or {}
    currency = (payload.get("info") or {}).get("currency")
    fetched_at = payload.get("_fetchedAt") or (payload.get("dataQuality") or {}).get("fetchedAt")
    indexed = {}
    skipped = 0
    for section in {entry[0] for entry in FIELDS.values()}:
        indexed[section] = {}
        for row in statements.get(section) or []:
            if not isinstance(row, dict):
                continue
            end = _date(row.get("fiscalDateEnding") or row.get("date"))
            period = str(row.get("period") or "").upper()
            if not end or period not in {"FY", "Q1", "Q2", "Q3", "Q4"}:
                skipped += 1
                continue
            key = (end.isoformat(), period, row.get("reportedCurrency") or currency)
            old = indexed[section].get(key)
            # Prefer the latest filing of a restated period. This is NOT a PIT dataset.
            if old is None or str(row.get("filedDate") or row.get("acceptedDate") or "") > str(old.get("filedDate") or old.get("acceptedDate") or ""):
                indexed[section][key] = row
    keys = sorted({key for rows in indexed.values() for key in rows}, key=lambda key: (key[0], key[1], key[2] or ""))
    observations = []
    for end, period, row_currency in keys:
        key = (end, period, row_currency)
        metrics = {}
        for name, (section, aliases, unit) in FIELDS.items():
            row = indexed[section].get(key, {})
            value = next((v for alias in aliases if (v := number(row.get(alias))) is not None), None)
            metrics[name] = _point(value, unit, row, sources.get(section), row_currency, fetched_at)
        def derived(name, dependencies, formula, unit, methodology):
            points = [metrics[d] for d in dependencies]
            values = [p["value"] for p in points]
            value = formula(*values) if all(v is not None for v in values) else None
            metrics[name] = {
                **_point(number(value), unit, {"date": end}, "+".join(dict.fromkeys(p["source"] for p in points if p["source"])) or None, row_currency, fetched_at, methodology),
                "inputs": dependencies,
            }
        derived("freeCashFlow", ["operatingCashFlow", "capex"], lambda ocf, capex: ocf - abs(capex), "currency", "Operating cash flow minus absolute capital expenditure, same fiscal period and currency.")
        derived("netDebt", ["debt", "cash"], lambda debt, cash: debt - cash, "currency", "Total debt minus cash and cash equivalents; excludes other investments.")
        for name, numerator in (("grossMargin", "grossProfit"), ("operatingMargin", "operatingIncome"), ("fcfMargin", "freeCashFlow")):
            derived(name, [numerator, "revenue"], lambda n, d: n / d if d > 0 else None, "ratio", f"{numerator} divided by positive revenue, same fiscal period and currency.")
        derived("fcfPayout", ["dividendsPaid", "freeCashFlow"], lambda n, d: abs(n) / d if d > 0 else None, "ratio", "Absolute cash dividends divided by positive free cash flow.")
        observations.append({"date": end, "period": period, "frequency": "annual" if period == "FY" else "quarterly", "currency": row_currency, "metrics": metrics})
    for observation in observations:
        end = _date(observation["date"])
        comparable = [o for o in observations if o["period"] == observation["period"] and o["currency"] == observation["currency"]]
        prior = min((o for o in comparable if 330 <= (end - _date(o["date"])).days <= 400), key=lambda o: abs((end - _date(o["date"])).days - 365), default=None)
        for name, point in observation["metrics"].items():
            old = prior["metrics"][name]["value"] if prior else None
            value = point["value"]
            # Positive base only: loss-to-profit transitions must not produce misleading growth.
            point["yoyChange"] = value / old - 1 if value is not None and old is not None and old > 0 and point["unit"] != "ratio" else None
            point["yoyBasePeriod"] = prior["date"] if prior else None
            point["cagr"] = {}
            if observation["frequency"] == "annual" and point["unit"] != "ratio":
                for years in (3, 5, 10):
                    base = min((o for o in comparable if abs((end - _date(o["date"])).days / 365.25 - years) < 0.15), key=lambda o: abs((end - _date(o["date"])).days / 365.25 - years), default=None)
                    old = base["metrics"][name]["value"] if base else None
                    elapsed = (end - _date(base["date"])).days / 365.25 if base else None
                    point["cagr"][str(years)] = (value / old) ** (1 / elapsed) - 1 if value is not None and value > 0 and old is not None and old > 0 else None
    return {
        "observations": observations, "updatedAt": fetched_at, "excludedRows": skipped,
        "methodology": "Annual and quarterly observations are separate. YoY requires the same fiscal quarter or FY, currency and a positive base. CAGR uses positive annual endpoints within 0.15 years of the requested horizon. Latest restatements are used; this is not point-in-time history. Cash flow signs are preserved except in explicit formulas.",
    }
