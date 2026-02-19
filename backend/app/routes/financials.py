from fastapi import APIRouter
from app.services.financials_service import get_financials as fetch_financials

router = APIRouter()


@router.get("/financials/{symbol}")
def get_financials(symbol: str, refresh: bool = False):
    return fetch_financials(symbol, refresh=refresh)
