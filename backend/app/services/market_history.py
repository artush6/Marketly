"""Deterministic returns and provider-paired earnings expectations."""
from datetime import date, datetime, timedelta, timezone
from app.services.financial_trends import number


def price_performance(candles):
    points = sorted({int(t): v for t, c in zip(candles.get("t", []), candles.get("c", [])) if (v := number(c)) is not None and v > 0}.items())
    if not points: return []
    end_t, end_value = points[-1]
    end = datetime.fromtimestamp(end_t, timezone.utc).date()
    result = []
    for label, days in [("1D", 1), ("1M", 30), ("3M", 90), ("6M", 180), ("YTD", None), ("1Y", 365), ("3Y", 365*3), ("5Y", 365*5)]:
        target = date(end.year-1,12,31) if days is None else end-timedelta(days=days)
        candidates = [(t,v) for t,v in points[:-1] if datetime.fromtimestamp(t,timezone.utc).date() <= target]
        base = candidates[-1] if candidates else None
        if base and (target-datetime.fromtimestamp(base[0],timezone.utc).date()).days > 7: base = None
        result.append({"period":label,"changePercent":(end_value/base[1]-1)*100 if base else None,
                       "change":end_value-base[1] if base else None, "startDate":datetime.fromtimestamp(base[0],timezone.utc).date().isoformat() if base else None,
                       "endDate":end.isoformat(),"startPrice":base[1] if base else None,"endPrice":end_value})
    return result


def earnings_expectations(rows):
    output = []
    for row in rows if isinstance(rows,list) else []:
        if not isinstance(row,dict): continue
        try: period=date.fromisoformat(str(row.get("period")))
        except ValueError: continue
        actual, estimate = number(row.get("actual")), number(row.get("estimate"))
        output.append({"period":period.isoformat(),"quarter":row.get("quarter"),"year":row.get("year"),
                       "actual":actual,"estimate":estimate,"surprise":number(row.get("surprise")),
                       "surprisePercent":number(row.get("surprisePercent")),"currency":row.get("currency"),
                       "basis":"Finnhub paired EPS; GAAP/adjusted basis not specified", "estimateAsOf":None})
    return sorted(output,key=lambda r:r["period"],reverse=True)
