# backend/data_engines/binance_stream.py

import asyncio
import websockets
import ujson

from backend.utils.config import BINANCE_WS, STREAMS, RECONNECT_DELAY
from backend.utils.logger import log
from backend.data_engines.trades_engine import TradesEngine
from backend.data_engines.orderbook_engine import OrderbookEngine
from backend.data_engines.klines_engine import KlinesEngine
from backend.data_engines.rest_loader import RestLoader


class BinanceStream:
    """
    Manages a multiplexed WebSocket connection to Binance Futures.

    Streams:
      - aggTrade (for orderflow / delta)
      - depth20@100ms (for DOM / liquidity)
      - kline_1m (for candles / structure)

    Now with REST bootstrap to recover state on startup / reconnect.
    """

    def __init__(self):
        self.url = self._build_url()
        self.trades = TradesEngine()
        self.orderbook = OrderbookEngine()
        self.klines = KlinesEngine()
        self.rest_loader = RestLoader()

    def _build_url(self) -> str:
        """
        Build the combined stream URL for Binance.
        """
        stream_list = "/".join(STREAMS[name] for name in STREAMS)
        return f"{BINANCE_WS}/stream?streams={stream_list}"

    async def connect(self) -> None:
        """
        Main connection loop: bootstrap via REST, then connect WebSocket.
        If anything fails, wait RECONNECT_DELAY seconds and retry.
        """
        while True:
            try:
                # 1) Bootstrap / recover state via REST
                log("Starting REST bootstrap (trades, klines, depth)...")
                await self.rest_loader.bootstrap(self.trades, self.orderbook, self.klines)
                log("REST bootstrap done. Connecting WebSocket...")

                # 2) Connect WS and start streaming
                async with websockets.connect(self.url, ping_interval=20) as ws:
                    log("Connected to Binance WebSocket.")
                    await self._listen(ws)

            except Exception as e:
                log(f"Connection error: {e}. Reconnecting in {RECONNECT_DELAY} seconds...")
                await asyncio.sleep(RECONNECT_DELAY)

    async def _listen(self, ws) -> None:
        """
        Receive messages and route them to the corresponding engine.
        """
        async for message in ws:
            data = ujson.loads(message)

            stream = data.get("stream", "")
            payload = data.get("data", {})

            if "aggTrade" in stream:
                self.trades.process(payload)

            elif "depth" in stream:
                self.orderbook.process(payload)

            elif "kline" in stream:
                self.klines.process(payload)

            # Later you can extend this with more streams and engines.


async def run_stream() -> None:
    """
    Entrypoint helper to launch the BinanceStream.
    """
    stream = BinanceStream()
    await stream.connect()

