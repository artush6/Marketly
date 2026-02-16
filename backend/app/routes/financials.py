from fastapi import APIRouter
from app.integrations.financials import fetch_stock_financials
from app.utils.sanitizer_util import sanitize
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/financials/{symbol}")
def get_financials(symbol: str, refresh: bool = False):
    data = fetch_stock_financials(symbol, force_refresh=refresh)
    return data
