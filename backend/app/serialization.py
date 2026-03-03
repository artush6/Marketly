import math
import datetime
import pandas as pd


def sanitize(obj):
    """Recursively clean data for JSON serialization (NaN, Inf, Timestamps, Dates)."""
    if isinstance(obj, dict):
        clean = {}
        for k, v in obj.items():
            # ensure key is string
            if isinstance(k, (datetime.date, datetime.datetime, pd.Timestamp)):
                k = k.isoformat()
            else:
                k = str(k)
            clean[k] = sanitize(v)
        return clean

    elif isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]

    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None

    elif isinstance(obj, (datetime.date, datetime.datetime, pd.Timestamp)):
        return obj.isoformat()

    return obj
