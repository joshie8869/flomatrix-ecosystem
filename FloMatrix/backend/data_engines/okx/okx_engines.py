# backend/data_engines/okx/okx_engines.py

from collections import deque
from backend.utils.logger import log


class OKXTradesEngine:
    """
    Stores OKX trade events from WS or REST.
    Unified format:
       { "price": float, "size": float, "side": "buy"/"sell", "ts": int }
    """

    def __init__(self, max_cache: int = 2000):
        self.cache = deque(maxlen=max_cache)

    def add_trade(self, price, size, side, ts):
        self.cache.append({
            "price": float(price),
            "size": float(size),
            "side": side,
            "ts": int(ts),
        })

    def load_initial(self, trades):
        for t in trades:
            self.cache.append(t)


class OKXOrderbookEngine:
    """
    Stores OKX orderbook data.
    Format:
       bids = { price: size }
       asks = { price: size }
    """

    def __init__(self):
        self.bids = {}
        self.asks = {}

    def set_snapshot(self, bids, asks):
        """
        bids / asks are lists like [price, size, ...] from OKX.
        """
        self.bids = {float(p): float(s) for p, s, *_ in bids}
        self.asks = {float(p): float(s) for p, s, *_ in asks}
        log("[OKX] Orderbook snapshot loaded.")

    def update_level(self, bids=None, asks=None):
        """
        Apply incremental updates: lists of [price, size, ...].
        Size 0 means remove the level.
        """
        if bids:
            for entry in bids:
                p, s = float(entry[0]), float(entry[1])
                if s == 0:
                    self.bids.pop(p, None)
                else:
                    self.bids[p] = s

        if asks:
            for entry in asks:
                p, s = float(entry[0]), float(entry[1])
                if s == 0:
                    self.asks.pop(p, None)
                else:
                    self.asks[p] = s


class OKXKlinesEngine:
    """
    Stores 1m klines for OKX in unified format.
    """

    def __init__(self, max_cache: int = 2000):
        self.cache = deque(maxlen=max_cache)

    def add_candle(self, candle: dict):
        self.cache.append(candle)

    def load_initial(self, candles):
        for c in candles:
            self.cache.append(c)
