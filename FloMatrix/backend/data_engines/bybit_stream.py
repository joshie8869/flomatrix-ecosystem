# backend/data_engines/bybit_stream.py

import asyncio
import json
import websockets

from backend.utils.logger import log
from backend.data_engines.bybit_rest_loader import BybitRestLoader
from backend.data_engines.trades_engine import TradesEngine
from backend.data_engines.orderbook_engine import OrderbookEngine
from backend.data_engines.klines_engine import KlinesEngine

# Public linear WS endpoint (USDT perp) :contentReference[oaicite:3]{index=3}
BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/linear"

SYMBOL = "BTCUSDT"
CATEGORY = "linear"

# topics per docs:
#   publicTrade.{symbol}
#   orderbook.{depth}.{symbol}
#   kline.{interval}.{symbol}  (interval '1' = 1 minute) :contentReference[oaicite:4]{index=4}
WS_TOPICS = [
    f"publicTrade.{SYMBOL}",
    f"orderbook.50.{SYMBOL}",
    f"kline.1.{SYMBOL}",
]

RECONNECT_DELAY = 3


class BybitStream:
    """
    WebSocket + REST wrapper for Bybit USDT perpetual.
    Creates its own engines and feeds them from REST bootstrap + WS stream.
    """

    def __init__(self):
        self.url = BYBIT_WS_URL
        self.rest_loader = BybitRestLoader()

        # Engines for trades / book / klines
        self.trades = TradesEngine("BYBIT")
        self.orderbook = OrderbookEngine("BYBIT")
        self.klines = KlinesEngine("BYBIT", interval="1m")

    async def _subscribe(self, ws):
        sub_msg = {
            "op": "subscribe",
            "args": WS_TOPICS,
        }
        await ws.send(json.dumps(sub_msg))
        log(f"Bybit WS subscribe: {WS_TOPICS}")

    async def _handle_public_trade(self, data):
        # "data" is an array of trade objects
        for t in data:
            trade = {
                "price": float(t["p"]),
                "qty": float(t["v"]),
                "ts": int(t["T"]),
                "isBuyerMaker": (t["S"] == "Sell"),
            }
            self.trades.on_trade(trade)

    async def _handle_orderbook(self, payload):
        # payload structure: { "b": [[price, size], ...], "a": [[price, size], ...], ... }
        bids = payload.get("b", [])
        asks = payload.get("a", [])
        msg_type = payload.get("type", "snapshot")

        if msg_type == "snapshot":
            self.orderbook.set_from_snapshot(bids, asks)
        else:
            # treat everything else as delta
            self.orderbook.apply_delta(bids, asks)

    async def _handle_kline(self, data):
        # "data" is array; we handle each kline
        for k in data:
            candle = {
                "open": float(k["open"]),
                "high": float(k["high"]),
                "low": float(k["low"]),
                "close": float(k["close"]),
                "volume": float(k["volume"]),
                "isClosed": bool(k["confirm"]),
                "start": int(k["start"]),
                "end": int(k["end"]),
                "interval": k["interval"],
            }
            self.klines.on_kline(candle)

    async def _listen(self, ws):
        await self._subscribe(ws)

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            topic = msg.get("topic")
            ttype = msg.get("type")
            data = msg.get("data")

            if not topic or data is None:
                continue

            if topic.startswith("publicTrade."):
                await self._handle_public_trade(data)
            elif topic.startswith("orderbook."):
                await self._handle_orderbook(msg)
            elif topic.startswith("kline."):
                await self._handle_kline(data)

    async def connect(self):
        """
        Loop:
          - REST bootstrap (for history / snapshot)
          - connect WS and stream live
          - on error, sleep and reconnect
        """
        while True:
            try:
                # REST bootstrap first
                try:
                    log("Bybit: starting REST bootstrap (trades, klines, depth)...")
                    await self.rest_loader.bootstrap(self.trades, self.orderbook, self.klines)
                    log("Bybit: REST bootstrap done.")
                except Exception as e:
                    log(f"Bybit REST bootstrap FAILED ({e}); continuing with WS only.")

                # WebSocket stream
                log(f"Bybit: connecting WebSocket {self.url} ...")
                async with websockets.connect(self.url, ping_interval=20) as ws:
                    log("Bybit: WebSocket connected.")
                    await self._listen(ws)

            except Exception as e:
                log(f"Bybit stream error: {e}. Reconnecting in {RECONNECT_DELAY} seconds...")
                await asyncio.sleep(RECONNECT_DELAY)


def run_bybit_stream():
    """
    Entry point helper so we can run:
        python -m backend.bybit_main
    """
    stream = BybitStream()
    asyncio.run(stream.connect())
