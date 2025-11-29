# backend/data_engines/klines_engine.py

from backend.utils.logger import log


class KlinesEngine:
    """
    Tracks the latest kline (candle) for a given interval, e.g. 1m.
    """

    def __init__(self):
        self.last_candle = None
        self.history = []  # optional: keep a small rolling history

    def load_initial(self, candles) -> None:
        """
        Load an initial batch of candles (from REST) on startup / reconnect.
        candles is a list of candle dicts in our internal format.
        """
        if not candles:
            return

        self.history = candles
        self.last_candle = candles[-1]
        log(
            f"KlinesEngine bootstrapped with {len(candles)} candles; "
            f"last close={self.last_candle['close']}"
        )

    def process(self, msg: dict) -> None:
        """
        Process a kline message (msg["k"] structure from Binance WebSocket).
        """
        k = msg["k"]

        candle = {
            "open": float(k["o"]),
            "high": float(k["h"]),
            "low": float(k["l"]),
            "close": float(k["c"]),
            "volume": float(k["v"]),
            "isClosed": k["x"],
            "start": k["t"],
            "end": k["T"],
            "interval": k["i"],
        }

        self.last_candle = candle
        self.history.append(candle)

        # keep recent history only (e.g., last 1000 candles)
        if len(self.history) > 1000:
            self.history = self.history[-800:]

        log(
            f"CANDLE {k['i']} | O:{k['o']} H:{k['h']} L:{k['l']} C:{k['c']} "
            f"V:{k['v']} closed={k['x']}"
        )
