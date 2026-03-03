from fastapi import APIRouter

from app.integrations.financials import fetch_stock_financials

router = APIRouter()


@router.get("/financials/{symbol}")
def get_financials(symbol: str, refresh: bool = False):
    return fetch_stock_financials(symbol, force_refresh=refresh)
