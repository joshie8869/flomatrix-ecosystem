# backend/analytics/imbalance_engine.py

class ImbalanceEngine:
    """
    Detects:
      - Bid/Ask 70/30 imbalances
      - Stacked imbalances
      - Absorption zones
    """

    def detect(self, footprint_rows, threshold=0.7):
        imbalances = []

        for r in footprint_rows:
            bid = r["bid"]
            ask = r["ask"]

            if bid + ask == 0:
                continue

            ratio = ask / (bid + ask)

            if ratio >= threshold or ratio <= (1 - threshold):
                imbalances.append({
                    "price": r["price"],
                    "bid": bid,
                    "ask": ask,
                    "ratio": ratio
                })

        return imbalances
