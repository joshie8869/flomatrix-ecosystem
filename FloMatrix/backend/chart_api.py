# backend/chart_api.py

from datetime import datetime
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/candles")
async def get_candles():
    """
    Demo OHLC data for the chart.
    Later you can plug in real exchange / DB data here.
    """
    candles = []

    base_price = 50000.0
    ts = int(datetime(2024, 1, 1, 0, 0).timestamp())

    for i in range(80):
        open_price = base_price
        high_price = base_price + 250
        low_price = base_price - 250
        close_price = base_price + (120 if i % 2 == 0 else -90)

        candles.append(
            {
                "time": ts,          # unix timestamp in seconds
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
            }
        )

        ts += 60 * 60  # +1 hour
        base_price = close_price

    return candles
