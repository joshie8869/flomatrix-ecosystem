# backend/data_engines/okx/okx_stream.py

import asyncio
import json
import websockets

from backend.utils.logger import log
from backend.data_engines.okx.okx_engines import (
    OKXTradesEngine,
    OKXOrderbookEngine,
    OKXKlinesEngine
)
from backend.data_engines.okx.okx_rest import OKXRest, SYMBOL
from backend.data_engines.delta_engine import DeltaEngine

from backend.analytics.dom_engine import DOMEngine
from backend.analytics.mob_engine import MOBEngine
from backend.analytics.footprint_engine import FootprintEngine
from backend.analytics.volume_profile_engine import VolumeProfileEngine
from backend.analytics.imbalance_engine import ImbalanceEngine

WS = "wss://ws.okx.com:8443/ws/v5/public"
RECONNECT_DELAY = 3


class OKXStream:
    """
    High-performance OKX stream with full analytics stack.

    Exposed engines:
      - trades: OKXTradesEngine
      - orderbook: OKXOrderbookEngine
      - klines: OKXKlinesEngine
      - delta: DeltaEngine
      - dom: DOMEngine
      - mob: MOBEngine
      - footprint: FootprintEngine (time + event)
      - vprofile: VolumeProfileEngine
      - imbalance: ImbalanceEngine
    """

    def __init__(self):
        # Core data engines
        self.trades = OKXTradesEngine()
        self.orderbook = OKXOrderbookEngine()
        self.klines = OKXKlinesEngine()
        self.delta = DeltaEngine()

        # Analytics engines
        self.dom = DOMEngine()
        self.mob = MOBEngine()
        self.footprint = FootprintEngine(time_interval_sec=60)
        self.vprofile = VolumeProfileEngine()
        self.imbalance = ImbalanceEngine()

        self.rest = OKXRest()

    async def subscribe(self, ws):
        subs = {
            "op": "subscribe",
            "args": [
                {"channel": "trades", "instId": SYMBOL},
                {"channel": "books",  "instId": SYMBOL},
                {"channel": "candle1m", "instId": SYMBOL}
            ]
        }
        await ws.send(json.dumps(subs))
        log("[OKX] subscribed to trades, books, candle1m")

    async def handle(self, msg):
        if "arg" not in msg or "data" not in msg:
            return

        channel = msg["arg"]["channel"]
        data = msg["data"]

        if channel == "trades":
            for t in data:
                price = float(t["px"])
                size = float(t["sz"])
                side = t["side"]
                ts = int(t["ts"])

                # Core
                self.trades.add_trade(price, size, side, ts)
                self.delta.on_trade(SYMBOL, price, size, side, ts)

                # Analytics
                self.mob.on_trade(price, size, side, ts)
                self.vprofile.on_trade(price, size, side)

                closed_time_bar, closed_event_bar = self.footprint.process_trade(
                    price, size, side, ts
                )

                # You can hook imbalance detection on closed bars if needed
                if closed_time_bar is not None:
                    # rows = closed_time_bar["rows"]
                    # time_imbalances = self.imbalance.detect(rows)
                    # store or log if you want
                    pass

                if closed_event_bar is not None:
                    # rows = closed_event_bar["rows"]
                    # event_imbalances = self.imbalance.detect(rows)
                    # store or log if you want
                    pass

        elif channel == "books":
            bids = data[0].get("bids", [])
            asks = data[0].get("asks", [])

            # Core orderbook
            self.orderbook.set_snapshot(bids, asks)

            # DOM mirror
            self.dom.set_snapshot(bids, asks)

        elif channel == "candle1m":
            for c in data:
                self.klines.add_candle({
                    "start": int(c[0]),
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": float(c[5]),
                    "isClosed": True,
                    "interval": "1m"
                })

    async def connect(self):
        # REST bootstrap (with delta + volume profile seeding)
        await self.rest.bootstrap(
            self.trades,
            self.orderbook,
            self.klines,
            delta_engine=self.delta,
            volume_profile_engine=self.vprofile,
        )

        while True:
            try:
                log("[OKX] connecting to WebSocket...")
                async with websockets.connect(WS, ping_interval=20) as ws:
                    log("[OKX] WebSocket connected")
                    await self.subscribe(ws)

                    async for raw in ws:
                        msg = json.loads(raw)
                        await self.handle(msg)

            except Exception as e:
                log(f"[OKX] error: {e}, reconnecting in {RECONNECT_DELAY}s...")
                await asyncio.sleep(RECONNECT_DELAY)


def run_okx_stream():
    stream = OKXStream()
    asyncio.run(stream.connect())
