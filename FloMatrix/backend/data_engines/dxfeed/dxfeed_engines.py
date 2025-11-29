# backend/data_engines/dxfeed/dxfeed_engines.py

from collections import defaultdict
from backend.utils.logger import log


class DxQuoteEngine:
    """
    Handles dxFeed Quote events (L1 market data).
    """
    def __init__(self):
        self.last_quotes = {}

    def on_quote(self, tick):
        symbol = tick["eventSymbol"]
        self.last_quotes[symbol] = tick
        log(f"DXFEED QUOTE {symbol} | bid={tick['bidPrice']} ask={tick['askPrice']}")


class DxTradeEngine:
    """
    Handles dxFeed Trade events (Time&Sales).
    """
    def __init__(self):
        self.trades = defaultdict(list)

    def on_trade(self, tick):
        symbol = tick["eventSymbol"]
        self.trades[symbol].append(tick)
        log(f"DXFEED TRADE {symbol} | price={tick['price']} size={tick['size']}")


class DxDepthEngine:
    """
    Handles dxFeed MarketDepth events (full depth L2).
    Maintains per-symbol order books.
    """
    def __init__(self):
        # symbol -> { price : size }
        self.bids = defaultdict(dict)
        self.asks = defaultdict(dict)

    def on_depth(self, tick):
        symbol = tick["eventSymbol"]
        side = tick["side"]  # 0=bid, 1=ask
        price = float(tick["price"])
        size = float(tick["size"])

        if side == 0:  # bid
            if size == 0:
                self.bids[symbol].pop(price, None)
            else:
                self.bids[symbol][price] = size

        else:  # ask
            if size == 0:
                self.asks[symbol].pop(price, None)
            else:
                self.asks[symbol][price] = size

        log(f"DXFEED DEPTH {symbol} | side={'BID' if side==0 else 'ASK'} price={price} size={size}")
