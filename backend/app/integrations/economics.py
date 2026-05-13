import json
import logging
from datetime import datetime, timedelta
from functools import lru_cache

from fredapi import Fred

from app.core.cache import CacheManager
from app.core.config import settings
from app.core.errors import MisconfigurationError
from app.integrations import supabase_store

LAST_DATA_SOURCE = "unknown"


@lru_cache(maxsize=1)
def _get_fred_client() -> Fred:
    """Create and cache the FRED API client."""
    if not settings.FRED_API_KEY:
        raise MisconfigurationError("FRED_API_KEY is not configured")
    return Fred(api_key=settings.FRED_API_KEY)


def fetch_macro_indicators(years: int = 20):
    """
    Fetch selected macroeconomic indicators from FRED.
    Returns last `years` of data, resampled to monthly (last value).
    """
    cache_key = CacheManager.make_key("macro", f"indicators_{years}")
    global LAST_DATA_SOURCE
    cached, cache_source = CacheManager.get_with_source(cache_key)

    logger = logging.getLogger(__name__)
    if cached:
        logger.debug("Loaded macro data from cache")
        LAST_DATA_SOURCE = cache_source or "cache"
        payload = json.loads(cached)
        if isinstance(payload, dict):
            payload["_dataSource"] = LAST_DATA_SOURCE
        return payload

    snapshot_key = f"indicators_{years}"
    snapshot = supabase_store.get_latest_snapshot("macro", snapshot_key)
    if snapshot and isinstance(snapshot.get("payload"), dict):
        logger.info("Loaded macro data from Supabase snapshot")
        LAST_DATA_SOURCE = "supabase"
        payload = dict(snapshot["payload"])
        payload["_dataSource"] = LAST_DATA_SOURCE
        CacheManager.set(cache_key, json.dumps(payload))
        return payload

    logger.info("Fetching macro data from FRED API...")
    fred = _get_fred_client()

    indicators = {
        "GDP (Real)": "GDPC1",
        "CPI (All Items)": "CPIAUCSL",
        "Unemployment Rate": "UNRATE",
        "Fed Funds Rate": "FEDFUNDS",
        "10Y Treasury Yield": "DGS10",
        "Oil Prices": "DCOILWTICO",
        "S&P 500": "SP500",
    }

    cutoff = datetime.today() - timedelta(days=years * 365)
    data = {}

    for label, code in indicators.items():
        try:
            series = fred.get_series(code)
            series = series[series.index >= cutoff]
            series = series.resample("ME").last()

            records = [
                {"date": d.strftime("%Y-%m-%d"), "value": float(v) if v == v else None}
                for d, v in series.items()
            ]
            data[label] = records
        except Exception as exc:
            logger.warning("Failed %s: %s", label, exc)

    logger.debug("Macro data keys: %s", list(data.keys()))
    supabase_store.save_snapshot(
        "macro",
        snapshot_key,
        data,
        provenance={"provider": "fred", "years": years},
    )
    supabase_store.save_macro_observations(data)
    LAST_DATA_SOURCE = "fresh"
    data["_dataSource"] = LAST_DATA_SOURCE
    CacheManager.set(cache_key, json.dumps(data))
    return data


def get_last_data_source() -> str:
    return LAST_DATA_SOURCE
