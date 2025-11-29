# backend/data_engines/okx/okx_rest.py

import aiohttp
from backend.utils.logger import log

SYMBOL = "BTC-USDT-SWAP"
REST = "https://www.okx.com"


class OKXRest:
    """
    Loads:
      - historical trades
      - historical candles
      - orderbook snapshot

    Optionally seeds:
      - DeltaEngine
      - VolumeProfileEngine
    """

    async def _get(self, session, path, params=None):
        url = f"{REST}{path}"
        async with session.get(url, params=params, timeout=10) as r:
            r.raise_for_status()
            out = await r.json()
            return out

    async def bootstrap(self,
                        trades_engine,
                        orderbook_engine,
                        klines_engine,
                        delta_engine=None,
                        volume_profile_engine=None):
        log("[OKX REST] starting bootstrap...")

        async with aiohttp.ClientSession() as session:

            # 1) Trades
            trades_raw = await self._get(
                session,
                "/api/v5/market/trades",
                {"instId": SYMBOL, "limit": 100}
            )

            trades = []
            for t in trades_raw.get("data", []):
                price = float(t["px"])
                size = float(t["sz"])
                side = t["side"]
                ts = int(t["ts"])

                trades.append({
                    "price": price,
                    "size": size,
                    "side": side,
                    "ts": ts
                })

                if delta_engine is not None:
                    delta_engine.on_trade(SYMBOL, price, size, side, ts)
                if volume_profile_engine is not None:
                    volume_profile_engine.on_trade(price, size, side)

            trades_engine.load_initial(trades)

            # 2) 1-minute candles
            candles_raw = await self._get(
                session,
                "/api/v5/market/candles",
                {"instId": SYMBOL, "bar": "1m", "limit": "200"}
            )

            candles = []
            for c in candles_raw.get("data", []):
                candles.append({
                    "start": int(c[0]),
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": float(c[5]),
                    "isClosed": True,
                    "interval": "1m"
                })
            klines_engine.load_initial(candles)

            # 3) Orderbook snapshot
            depth_raw = await self._get(
                session,
                "/api/v5/market/books",
                {"instId": SYMBOL}
            )

            data = depth_raw.get("data", [{}])[0]
            bids = data.get("bids", [])
            asks = data.get("asks", [])
            orderbook_engine.set_snapshot(bids, asks)

        log("[OKX REST] bootstrap complete.")
