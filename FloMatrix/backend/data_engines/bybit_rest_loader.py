# backend/data_engines/bybit_rest_loader.py

import aiohttp

from backend.utils.logger import log

# --- BYBIT FUTURES (USDT PERP) REST CONFIG ---

REST_BASE = "https://api.bybit.com"
SYMBOL = "BTCUSDT"
CATEGORY = "linear"          # USDT perpetual
KLINE_INTERVAL = "1"         # 1-minute candles for /v5/market/kline
KLINE_LIMIT = 500
TRADES_LIMIT = 1000
DEPTH_LIMIT = 50             # levels in orderbook snapshot


class BybitRestLoader:
    """
    REST bootstrap for Bybit futures (V5 API):
      - recent public trades
      - recent klines
      - current orderbook snapshot
    """

    def __init__(self):
        self.symbol = SYMBOL

    async def _get(self, session: aiohttp.ClientSession, path: str, params: dict = None):
        url = f"{REST_BASE}{path}"
        async with session.get(url, params=params, timeout=10) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data.get("result", data)  # v5 wraps payload in "result"

    async def bootstrap(self, trades_engine, orderbook_engine, klines_engine) -> None:
        log("Bybit REST bootstrap: starting...")

        async with aiohttp.ClientSession() as session:
            # 1) Recent public trades
            # GET /v5/market/recent-trade :contentReference[oaicite:0]{index=0}
            trades_raw = await self._get(
                session,
                "/v5/market/recent-trade",
                {
                    "category": CATEGORY,
                    "symbol": self.symbol,
                    "limit": TRADES_LIMIT,
                },
            )

            trades_list = trades_raw.get("list", [])
            trades = [
                {
                    "price": float(t["price"]),
                    "qty": float(t["size"]),
                    "ts": int(t["time"]),
                    "isBuyerMaker": (t["side"] == "Sell"),  # taker sell == maker buy
                }
                for t in trades_list
            ]
            trades_engine.load_initial(trades)

            # 2) Recent klines
            # GET /v5/market/kline :contentReference[oaicite:1]{index=1}
            klines_raw = await self._get(
                session,
                "/v5/market/kline",
                {
                    "category": CATEGORY,
                    "symbol": self.symbol,
                    "interval": KLINE_INTERVAL,
                    "limit": KLINE_LIMIT,
                },
            )

            kline_list = klines_raw.get("list", [])
            candles = []
            for k in kline_list:
                # per docs: [ start, open, high, low, close, volume, turnover, ... ]
                candles.append(
                    {
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5]),
                        "isClosed": True,
                        "start": int(k[0]),
                        "end": int(k[0]),   # Bybit doesn't give explicit close here, OK for now
                        "interval": KLINE_INTERVAL,
                    }
                )
            klines_engine.load_initial(candles)

            # 3) Orderbook snapshot
            # GET /v5/market/orderbook :contentReference[oaicite:2]{index=2}
            depth_raw = await self._get(
                session,
                "/v5/market/orderbook",
                {
                    "category": CATEGORY,
                    "symbol": self.symbol,
                    "limit": DEPTH_LIMIT,
                },
            )

            bids = depth_raw.get("b", [])
            asks = depth_raw.get("a", [])

            # engines expect raw [price, size] pairs as strings or floats
            orderbook_engine.set_from_snapshot(bids, asks)

        log("Bybit REST bootstrap: completed.")
