from fastapi import APIRouter, HTTPException
from app.services.analysis_service import build_stock_score
from app.schemas.analysis import StockScoreResponse

router = APIRouter()


@router.get("/score/{symbol}", response_model=StockScoreResponse)
def stock_score(symbol: str):
    try:
        return build_stock_score(symbol)

    except ValueError as ve:
        raise HTTPException(status_code=502, detail=f"Data error: {ve}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
