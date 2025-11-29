# backend/data_engines/dxfeed/dxfeed_stream.py

import asyncio
import json
import websockets

from backend.utils.logger import log
from backend.data_engines.dxfeed.dxfeed_engines import (
    DxQuoteEngine,
    DxTradeEngine,
    DxDepthEngine
)

# ⬇⬇⬇ IMPORTANT: replace this with your REAL dxFeed WebSocket URL ⬇⬇⬇
DXFEED_WS_URL = "wss://demo.dxfeed.com/dxlink-ws"


class DxFeedStream:
    def __init__(self, symbols=None):
        if symbols is None:
            symbols = ["AAPL", "MSFT", "ESZ24", "ZNZ24"]

        self.symbols = symbols

        self.quotes = DxQuoteEngine()
        self.trades = DxTradeEngine()
        self.depth = DxDepthEngine()

    async def _subscribe(self, ws):
        # dxFeed subscriptions use topic="symbol:eventType"
        topics = []
        for sym in self.symbols:
            topics.append(f"{sym}:Quote")
            topics.append(f"{sym}:Trade")
            topics.append(f"{sym}:MarketDepth")

        sub_msg = {"type": "subscribe", "topic": ",".join(topics)}
        await ws.send(json.dumps(sub_msg))

        log(f"DXFEED SUBSCRIBED: {topics}")

    async def _dispatch(self, msg):
        data = msg.get("data", [])
        for tick in data:
            event_type = tick.get("eventType")

            if event_type == "Quote":
                self.quotes.on_quote(tick)

            elif event_type == "Trade":
                self.trades.on_trade(tick)

            elif event_type == "MarketDepth":
                self.depth.on_depth(tick)

    async def _listen(self, ws):
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except:
                continue

            if msg.get("type") == "data":
                await self._dispatch(msg)

    async def connect(self):
        while True:
            try:
                log(f"DXFEED: connecting to {DXFEED_WS_URL}")
                async with websockets.connect(DXFEED_WS_URL, ping_interval=20) as ws:
                    log("DXFEED: WebSocket connected.")
                    await self._subscribe(ws)
                    await self._listen(ws)

            except Exception as e:
                log(f"DXFEED error {e}, reconnecting in 3 seconds...")
                await asyncio.sleep(3)


def run_dxfeed(symbols=None):
    stream = DxFeedStream(symbols)
    asyncio.run(stream.connect())
