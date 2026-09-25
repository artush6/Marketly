from fastapi import APIRouter, HTTPException, Query

from app.integrations.company_metadata import get_metadata
from app.routes.discovery import SYMBOL

router = APIRouter(prefix='/companies', tags=['companies'])


@router.get('/metadata')
def metadata(symbols: str = Query(max_length=260)):
    values = list(dict.fromkeys(value.strip().upper() for value in symbols.split(',') if value.strip()))
    if len(values) > 12 or any(not SYMBOL.fullmatch(value) for value in values):
        raise HTTPException(422, 'Provide up to 12 valid symbols.')
    return {'companies': get_metadata(values)}
