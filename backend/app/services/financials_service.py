from app.domain.models import StockFinancials
from app.integrations.financials import fetch_stock_financials


def get_financials(symbol: str, refresh: bool = False) -> dict:
    return fetch_stock_financials(symbol, force_refresh=refresh)


def get_financials_model(symbol: str, refresh: bool = False) -> StockFinancials:
    raw = fetch_stock_financials(symbol, force_refresh=refresh)
    if "error" in raw:
        raise ValueError(raw["error"])
    return StockFinancials.from_raw(raw)
