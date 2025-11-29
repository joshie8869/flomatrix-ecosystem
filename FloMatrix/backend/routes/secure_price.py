# backend/routes/secure_price.py

import aiohttp
from fastapi import APIRouter, Depends, HTTPException

from backend.security import verify_api_key, verify_signature

router = APIRouter(prefix="/secure", tags=["secure-price"])

ALLOWED_SYMBOLS = {"BTCUSDT", "ETHUSDT"}


@router.get("/price/{symbol}")
async def get_secure_price(
    symbol: str,
    api_key: str = Depends(verify_api_key),
    _sig_ok: bool = Depends(verify_signature),
):
    symbol = symbol.upper()
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(status_code=400, detail="Unsupported symbol")

    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=5) as resp:
            if resp.status != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Binance error: {resp.status}",
                )
            data = await resp.json()

    return {"symbol": symbol, "price": float(data["price"])}
