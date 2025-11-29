# backend/data_engines/delta_engine.py

from collections import defaultdict, deque
from typing import Dict, Deque, List


class DeltaEngine:
    """
    Per-symbol delta & cumulative volume delta (CVD).

    For each symbol we store a bounded deque of trade entries:
        {
            "symbol": str,
            "price": float,
            "size": float,
            "side": "buy" | "sell",
            "delta": float,
            "cvd": float,
            "ts": int
        }
    """

    def __init__(self, max_cache: int = 5000):
        self.max_cache = max_cache
        self.cvd: Dict[str, float] = defaultdict(float)
        self.trades: Dict[str, Deque[dict]] = defaultdict(
            lambda: deque(maxlen=self.max_cache)
        )

    def on_trade(self, symbol: str, price: float, size: float, side: str, ts: int):
        """
        Update delta and CVD with a new trade.
        side: "buy" or "sell" (anything else treated as sell)
        """
        symbol = symbol.upper()
        side = side.lower()

        delta = size if side == "buy" else -size
        self.cvd[symbol] += delta

        entry = {
            "symbol": symbol,
            "price": float(price),
            "size": float(size),
            "side": side,
            "delta": delta,
            "cvd": self.cvd[symbol],
            "ts": int(ts),
        }
        self.trades[symbol].append(entry)

    def get_series(self, symbol: str, limit: int = 100) -> List[dict]:
        """
        Return the last N delta entries for a symbol.
        """
        symbol = symbol.upper()
        if symbol not in self.trades:
            return []
        limit = max(1, limit)
        buf = list(self.trades[symbol])
        return buf[-limit:]

    def get_cvd(self, symbol: str) -> float:
        """
        Return the latest cumulative volume delta for a symbol.
        """
        symbol = symbol.upper()
        return self.cvd.get(symbol, 0.0)
