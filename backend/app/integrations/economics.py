from fredapi import Fred
import json
import os
from datetime import datetime, timedelta
from app.core.cache import CacheManager


def fetch_macro_indicators(years: int = 20):
    """
    Fetch selected macroeconomic indicators from FRED.
    Returns last `years` of data, resampled to monthly (last value).
    """

    cache_key = CacheManager.make_key("macro", f"indicators_{years}")
    cached = CacheManager.get(cache_key)

    if cached:
        print("✅ Loaded macro data from cache")
        return json.loads(cached)

    print("🌀 Fetching macro data from FRED API...")
    api_key = os.getenv("FRED_API_KEY")
    if not api_key:
        raise RuntimeError("FRED_API_KEY not set in environment")

    fred = Fred(api_key=api_key)

    # Core set of indicators (keep it small + meaningful)
    indicators = {
        "GDP (Real)": "GDPC1",
        "CPI (All Items)": "CPIAUCSL",
        "Unemployment Rate": "UNRATE",
        "Fed Funds Rate": "FEDFUNDS",
        "10Y Treasury Yield": "DGS10",
        "Oil Prices": "DCOILWTICO",
        "S&P 500": "SP500"
    }

    cutoff = datetime.today() - timedelta(days=years*365)
    data = {}

    for label, code in indicators.items():
        try:
            series = fred.get_series(code)
            # restrict to last N years
            series = series[series.index >= cutoff]

            # resample everything monthly (latest value each month)
            series = series.resample("ME").last()

            records = [
                {"date": d.strftime("%Y-%m-%d"),
                 "value": float(v) if v == v else None}
                for d, v in series.items()
            ]
            data[label] = records
        except Exception as e:
            print(f"❌ Failed {label}: {e}")

    print(data)
    CacheManager.set(cache_key, json.dumps(data))
    return data
