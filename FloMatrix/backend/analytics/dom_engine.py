# backend/analytics/dom_engine.py

from collections import defaultdict
import time


class DOMEngine:
    """
    Institutional DOM engine (price-level).
    
    Features:
      - Live price-level depth for bids/asks
      - Pulling / stacking detection
      - DOM pressure metrics
      - Liquidity heat (resting volume)
      - Last update timestamps
    """

    def __init__(self):
        # { price: size }
        self.bids = {}
        self.asks = {}

        # Liquidity tracking for pulling/stacking
        self.prev_bids = {}
        self.prev_asks = {}

        # Metrics
        self.metrics = {
            "bid_pressure": 0.0,
            "ask_pressure": 0.0,
            "stacking_bids": 0.0,
            "stacking_asks": 0.0,
            "pulling_bids": 0.0,
            "pulling_asks": 0.0,
        }

    # ===============================
    # SNAPSHOT
    # ===============================
    def set_snapshot(self, bids, asks):
        """
        bids/asks = list of [price, size, ...] from OKX
        """
        self.prev_bids = self.bids
        self.prev_asks = self.asks

        self.bids = {float(p): float(s) for p, s, *_ in bids}
        self.asks = {float(p): float(s) for p, s, *_ in asks}

        self.compute_metrics()

    # ===============================
    # INCREMENTS
    # ===============================
    def update_levels(self, bids=None, asks=None):
        self.prev_bids = self.bids.copy()
        self.prev_asks = self.asks.copy()

        if bids:
            for p, s, *_ in bids:
                p, s = float(p), float(s)
                if s == 0:
                    self.bids.pop(p, None)
                else:
                    self.bids[p] = s

        if asks:
            for p, s, *_ in asks:
                p, s = float(p), float(s)
                if s == 0:
                    self.asks.pop(p, None)
                else:
                    self.asks[p] = s

        self.compute_metrics()

    # ===============================
    # METRICS
    # ===============================
    def compute_metrics(self):
        """
        Pulling = liquidity removed
        Stacking = liquidity added
        Pressure = net difference in best levels
        """

        # Pulling/stacking
        bid_stack = 0
        bid_pull = 0
        ask_stack = 0
        ask_pull = 0

        # Bids
        for p, size in self.bids.items():
            ps = self.prev_bids.get(p, 0)
            diff = size - ps
            if diff > 0:
                bid_stack += diff
            elif diff < 0:
                bid_pull += abs(diff)

        # Asks
        for p, size in self.asks.items():
            ps = self.prev_asks.get(p, 0)
            diff = size - ps
            if diff > 0:
                ask_stack += diff
            elif diff < 0:
                ask_pull += abs(diff)

        # Pressure (difference between best bid/ask size)
        best_bid = max(self.bids.keys()) if self.bids else None
        best_ask = min(self.asks.keys()) if self.asks else None

        bid_pressure = self.bids.get(best_bid, 0)
        ask_pressure = self.asks.get(best_ask, 0)

        self.metrics = {
            "bid_pressure": bid_pressure,
            "ask_pressure": ask_pressure,
            "stacking_bids": bid_stack,
            "stacking_asks": ask_stack,
            "pulling_bids": bid_pull,
            "pulling_asks": ask_pull,
        }

    # ===============================
    # EXPORT DOM LADDER (for UI)
    # ===============================
    def export_ladder(self, depth=20):
        bids_sorted = sorted(self.bids.items(), key=lambda x: x[0], reverse=True)[:depth]
        asks_sorted = sorted(self.asks.items(), key=lambda x: x[0])[:depth]

        return {
            "bids": bids_sorted,
            "asks": asks_sorted,
            "metrics": self.metrics
        }
