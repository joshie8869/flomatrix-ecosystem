# backend/analytics/volume_profile_engine.py

from collections import defaultdict


class VolumeProfileEngine:
    """
    High-performance price-level session volume profile.
    """

    def __init__(self):
        self.profile = defaultdict(lambda: {"bid": 0.0, "ask": 0.0})

    def on_trade(self, price, size, side):
        row = self.profile[price]
        if side == "buy":
            row["ask"] += size
        else:
            row["bid"] += size

    def export(self):
        out = []
        for price, vol in self.profile.items():
            total = vol["bid"] + vol["ask"]
            delta = vol["ask"] - vol["bid"]
            out.append({
                "price": price,
                "bid": vol["bid"],
                "ask": vol["ask"],
                "delta": delta,
                "total": total
            })

        out_sorted = sorted(out, key=lambda x: x["price"])
        return out_sorted
