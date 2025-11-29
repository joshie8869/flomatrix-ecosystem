# backend/analytics/mob_engine.py

from collections import deque, defaultdict


class MOBEngine:
    """
    Market Order Burst (MOB) engine.
    
    Detects:
      - Market buy bursts
      - Market sell bursts
      - Sweeps
      - Aggression imbalance
      - Delta pressure
    """

    def __init__(self, max_cache=3000):
        self.max_cache = max_cache
        self.trades = deque(maxlen=max_cache)

        self.buy_volume = 0.0
        self.sell_volume = 0.0

        self.metrics = {
            "buy_burst": 0.0,
            "sell_burst": 0.0,
            "aggression_ratio": 0.0,
            "sweep_signal": False
        }

    def on_trade(self, price, size, side, ts):
        self.trades.append({
            "price": price,
            "size": size,
            "side": side,
            "ts": ts,
        })

        if side == "buy":
            self.buy_volume += size
        else:
            self.sell_volume += size

        self.compute_metrics()

    def compute_metrics(self):
        """
        Burst = total volume in last X trades > threshold
        Sweep = consecutive trades in same direction + large delta
        """

        last20 = list(self.trades)[-20:]

        buy = sum(t["size"] for t in last20 if t["side"] == "buy")
        sell = sum(t["size"] for t in last20 if t["side"] == "sell")

        self.metrics["buy_burst"] = buy
        self.metrics["sell_burst"] = sell

        total = buy + sell
        if total > 0:
            self.metrics["aggression_ratio"] = (buy - sell) / total
        else:
            self.metrics["aggression_ratio"] = 0

        # Sweep detection
        buy_cnt = sum(1 for t in last20 if t["side"] == "buy")
        sell_cnt = sum(1 for t in last20 if t["side"] == "sell")

        self.metrics["sweep_signal"] = buy_cnt >= 18 or sell_cnt >= 18
