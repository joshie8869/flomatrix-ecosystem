# backend/data_engines/trades_engine.py

from backend.utils.logger import log


class TradesEngine:
    """
    Handles incoming trade messages from Binance and keeps a rolling cache.
    This will be the foundation for delta, CVD, and orderflow stats.
    """

    def __init__(self, max_cache_size: int = 5000):
        self.cache = []
        self.max_cache_size = max_cache_size

    def load_initial(self, trades) -> None:
        """
        Load an initial batch of trades (from REST) on startup / reconnect.
        """
        if not trades:
            return

        # Keep only the most recent trades up to max_cache_size
        if len(trades) > self.max_cache_size:
            trades = trades[-self.max_cache_size :]

        self.cache = trades
        log(f"TradesEngine bootstrapped with {len(self.cache)} trades")

    def process(self, msg: dict) -> None:
        """
        Process a single aggTrade message from Binance WebSocket.
        """
        trade = {
            "price": float(msg["p"]),
            "qty": float(msg["q"]),
            "ts": msg["T"],              # trade time (ms)
            "isBuyerMaker": msg["m"],    # True = sell-initiated trade
        }

        self.cache.append(trade)

        # Prevent unbounded growth
        if len(self.cache) > self.max_cache_size:
            keep = int(self.max_cache_size * 0.6)
            self.cache = self.cache[-keep:]

        side = "SELL" if trade["isBuyerMaker"] else "BUY"
        log(f"TRADE {side}: {trade['price']} x {trade['qty']}")

