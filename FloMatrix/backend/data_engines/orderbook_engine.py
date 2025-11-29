# backend/data_engines/orderbook_engine.py

from backend.utils.logger import log


class OrderbookEngine:
    """
    Maintains a local level-2 orderbook (bids and asks) from depth updates.
    This will later feed liquidity maps, DOM, and imbalance detection.
    """

    def __init__(self):
        self.bids = {}  # price -> qty
        self.asks = {}  # price -> qty

    def set_from_snapshot(self, bids_list, asks_list) -> None:
        """
        Initialize the orderbook from a REST depth snapshot.
        bids_list / asks_list are lists of [price, qty].
        """
        self.bids = {float(p): float(q) for p, q in bids_list}
        self.asks = {float(p): float(q) for p, q in asks_list}
        log(f"Orderbook snapshot loaded | bids: {len(self.bids)} asks: {len(self.asks)}")

    def process(self, msg: dict) -> None:
        """
        Process a single depth update message from WebSocket.
        msg["b"] = list of [price, qty] for bids
        msg["a"] = list of [price, qty] for asks
        """
        # Update bids
        for p, q in msg.get("b", []):
            px = float(p)
            qty = float(q)
            if qty == 0:
                self.bids.pop(px, None)
            else:
                self.bids[px] = qty

        # Update asks
        for p, q in msg.get("a", []):
            px = float(p)
            qty = float(q)
            if qty == 0:
                self.asks.pop(px, None)
            else:
                self.asks[px] = qty

        log(f"DEPTH UPDATE | bids: {len(self.bids)} levels, asks: {len(self.asks)} levels")
