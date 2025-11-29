# backend/data_engines/rest_loader.py

import aiohttp

from backend.utils.logger import log
from backend.utils.config import (
    REST_BASE,
    SYMBOL,
    KLINE_INTERVAL,
    KLINE_LIMIT,
    TRADES_LIMIT,
    DEPTH_LIMIT,
)


class RestLoader:
    """
    Handles REST calls to Binance SPOT to bootstrap / recover state:
      - recent trades
      - recent candles
      - a fresh depth snapshot

    WebSocket remains connected to Binance FUTURES.
    """

    def __init__(self):
        self.symbol = SYMBOL.upper()

    async def _get(self, session: aiohttp.ClientSession, path: str, params: dict = None):
        url = f"{REST_BASE}{path}"
        async with session.get(url, params=params, timeout=10) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def bootstrap(self, trades_engine, orderbook_engine, klines_engine) -> None:
        log("REST bootstrap (SPOT): starting...")

        async with aiohttp.ClientSession() as session:
            # 1) Recent aggTrades from SPOT
            trades_raw = await self._get(
                session,
                "/api/v3/aggTrades",
                {"symbol": self.symbol, "limit": TRADES_LIMIT},
            )

            trades = [
                {
                    "price": float(t["p"]),
                    "qty": float(t["q"]),
                    "ts": t["T"],
                    "isBuyerMaker": t["m"],
                }
                for t in trades_raw
            ]
            trades_engine.load_initial(trades)

            # 2) Recent klines from SPOT
            klines_raw = await self._get(
                session,
                "/api/v3/klines",
                {
                    "symbol": self.symbol,
                    "interval": KLINE_INTERVAL,
                    "limit": KLINE_LIMIT,
                },
            )

            candles = []
            for k in klines_raw:
                candles.append(
                    {
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5]),
                        "isClosed": True,
                        "start": k[0],
                        "end": k[6],
                        "interval": KLINE_INTERVAL,
                    }
                )
            klines_engine.load_initial(candles)

            # 3) Depth snapshot from SPOT
            depth_raw = await self._get(
                session,
                "/api/v3/depth",
                {"symbol": self.symbol, "limit": DEPTH_LIMIT},
            )

            bids = depth_raw.get("bids", [])
            asks = depth_raw.get("asks", [])
            orderbook_engine.set_from_snapshot(bids, asks)

        log("REST bootstrap (SPOT): completed.")

