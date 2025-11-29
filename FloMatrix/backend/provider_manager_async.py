# backend/provider_manager_async.py

import asyncio
from typing import Optional

from backend.utils.logger import log

from backend.data_engines.binance_stream import BinanceStream
from backend.data_engines.dxfeed.dxfeed_stream import DxFeedStream
from backend.data_engines.okx.okx_stream import OKXStream


class AsyncProviderManager:
    """
    Async provider manager for use INSIDE the API process.

    Supports:
      - okx     (BTC-USDT-SWAP futures + full analytics)
      - binance (BTCUSDT futures)
      - dxfeed  (multi-asset)

    Exposes:
      - L1 / L2 / Trades
      - Delta / CVD
      - DOM
      - MOB (aggressive order flow)
      - Footprint (time & event)
      - Volume profile
      - Imbalances (derived from footprint)
    """

    def __init__(self):
        self.current_name: Optional[str] = None
        self.current_task: Optional[asyncio.Task] = None
        self.stream = None

    async def _stop_current(self):
        if self.current_task is not None and not self.current_task.done():
            log(f"AsyncProviderManager: cancelling provider {self.current_name}")
            self.current_task.cancel()
            try:
                await self.current_task
            except asyncio.CancelledError:
                pass

        self.current_name = None
        self.current_task = None
        self.stream = None

    async def set_provider(self, name: str):
        name = name.lower()

        if self.current_task is not None:
            await self._stop_current()

        if name == "okx":
            self.stream = OKXStream()
        elif name == "binance":
            self.stream = BinanceStream()
        elif name == "dxfeed":
            self.stream = DxFeedStream(symbols=["AAPL", "MSFT", "ESZ24"])
        else:
            raise ValueError(f"Unknown provider: {name}")

        self.current_task = asyncio.create_task(self.stream.connect())
        self.current_name = name
        log(f"AsyncProviderManager: started provider {name}")

    def get_current_name(self) -> Optional[str]:
        return self.current_name

    # ----------------- L1 -----------------
    def get_l1(self, symbol: str):
        if self.stream is None or self.current_name is None:
            return None

        if self.current_name == "okx":
            sym = symbol or "BTC-USDT-SWAP"
            ob = self.stream.orderbook
            bids = ob.bids
            asks = ob.asks
            if not bids or not asks:
                return None
            best_bid = max(bids.keys())
            best_ask = min(asks.keys())
            last_trade = self.stream.trades.cache[-1] if self.stream.trades.cache else None
            last_price = float(last_trade["price"]) if last_trade else None
            return {
                "provider": "okx",
                "symbol": sym,
                "best_bid": best_bid,
                "best_bid_size": bids[best_bid],
                "best_ask": best_ask,
                "best_ask_size": asks[best_ask],
                "last_price": last_price,
            }

        if self.current_name == "binance":
            ob = self.stream.orderbook
            bids = ob.bids
            asks = ob.asks
            if not bids or not asks:
                return None
            best_bid = max(bids.keys())
            best_ask = min(asks.keys())
            last_trade = self.stream.trades.cache[-1] if self.stream.trades.cache else None
            last_price = float(last_trade["price"]) if last_trade else None
            return {
                "provider": "binance",
                "symbol": "btcusdt",
                "best_bid": best_bid,
                "best_bid_size": bids[best_bid],
                "best_ask": best_ask,
                "best_ask_size": asks[best_ask],
                "last_price": last_price,
            }

        if self.current_name == "dxfeed":
            sym = symbol.upper()
            quote_engine = self.stream.quotes
            depth_engine = self.stream.depth
            quote = quote_engine.last_quotes.get(sym)
            bids = depth_engine.bids.get(sym, {})
            asks = depth_engine.asks.get(sym, {})
            best_bid = max(bids.keys()) if bids else None
            best_ask = min(asks.keys()) if asks else None
            return {
                "provider": "dxfeed",
                "symbol": sym,
                "best_bid": best_bid,
                "best_bid_size": bids.get(best_bid) if best_bid is not None else None,
                "best_ask": best_ask,
                "best_ask_size": asks.get(best_ask) if best_ask is not None else None,
                "raw_quote": quote,
            }

        return None

    # ----------------- L2 -----------------
    def get_l2(self, symbol: str, depth: int = 10):
        if self.stream is None or self.current_name is None:
            return None

        depth = max(1, depth)

        if self.current_name == "okx":
            sym = symbol or "BTC-USDT-SWAP"
            ob = self.stream.orderbook
            bids = sorted(ob.bids.items(), key=lambda x: x[0], reverse=True)[:depth]
            asks = sorted(ob.asks.items(), key=lambda x: x[0])[:depth]
            return {
                "provider": "okx",
                "symbol": sym,
                "bids": bids,
                "asks": asks,
            }

        if self.current_name == "binance":
            ob = self.stream.orderbook
            bids = sorted(ob.bids.items(), key=lambda x: x[0], reverse=True)[:depth]
            asks = sorted(ob.asks.items(), key=lambda x: x[0])[:depth]
            return {
                "provider": "binance",
                "symbol": "btcusdt",
                "bids": bids,
                "asks": asks,
            }

        if self.current_name == "dxfeed":
            sym = symbol.upper()
            depth_engine = self.stream.depth
            bids_dict = depth_engine.bids.get(sym, {})
            asks_dict = depth_engine.asks.get(sym, {})
            bids = sorted(bids_dict.items(), key=lambda x: x[0], reverse=True)[:depth]
            asks = sorted(asks_dict.items(), key=lambda x: x[0])[:depth]
            return {
                "provider": "dxfeed",
                "symbol": sym,
                "bids": bids,
                "asks": asks,
            }

        return None

    # ----------------- Trades -----------------
    def get_trades(self, symbol: str, limit: int = 50):
        if self.stream is None or self.current_name is None:
            return None

        limit = max(1, limit)

        if self.current_name == "okx":
            sym = symbol or "BTC-USDT-SWAP"
            trades = list(self.stream.trades.cache)[-limit:]
            return {
                "provider": "okx",
                "symbol": sym,
                "trades": trades,
            }

        if self.current_name == "binance":
            trades = list(self.stream.trades.cache)[-limit:]
            return {
                "provider": "binance",
                "symbol": "btcusdt",
                "trades": trades,
            }

        if self.current_name == "dxfeed":
            sym = symbol.upper()
            trades_engine = self.stream.trades
            trades_list = trades_engine.trades.get(sym, [])
            trades = trades_list[-limit:]
            return {
                "provider": "dxfeed",
                "symbol": sym,
                "trades": trades,
            }

        return None

    # ----------------- Delta / CVD (OKX only) -----------------
    def get_delta(self, symbol: str, limit: int = 100):
        if self.stream is None or self.current_name is None:
            return None

        if self.current_name == "okx":
            sym = symbol or "BTC-USDT-SWAP"
            return self.stream.delta.get_series(sym, limit=limit)

        return None

    def get_cvd(self, symbol: str):
        if self.stream is None or self.current_name is None:
            return None

        if self.current_name == "okx":
            sym = symbol or "BTC-USDT-SWAP"
            return self.stream.delta.get_cvd(sym)

        return None

    # ----------------- DOM (OKX only) -----------------
    def get_dom(self, depth: int = 20):
        if self.stream is None or self.current_name is None:
            return None
        if self.current_name != "okx":
            return None

        return self.stream.dom.export_ladder(depth=depth)

    # ----------------- MOB (OKX only) -----------------
    def get_mob(self, limit_trades: int = 50):
        if self.stream is None or self.current_name is None:
            return None
        if self.current_name != "okx":
            return None

        trades = list(self.stream.mob.trades)[-limit_trades:]
        return {
            "metrics": self.stream.mob.metrics,
            "recent_trades": trades,
        }

    # ----------------- Volume profile (OKX only) -----------------
    def get_volume_profile(self):
        if self.stream is None or self.current_name is None:
            return None
        if self.current_name != "okx":
            return None

        rows = self.stream.vprofile.export()
        return rows

    # ----------------- Footprint (OKX only) -----------------
    def get_footprint(self, mode: str = "time", limit: int = 10):
        if self.stream is None or self.current_name is None:
            return None
        if self.current_name != "okx":
            return None

        if mode == "time":
            return self.stream.footprint.get_time_bars(limit=limit)
        else:
            return self.stream.footprint.get_event_bars(limit=limit)

    # ----------------- Imbalances (OKX only) -----------------
    def get_imbalances(self, mode: str = "time"):
        """
        Imbalances for the latest footprint bar of given mode.
        """
        if self.stream is None or self.current_name is None:
            return None
        if self.current_name != "okx":
            return None

        if mode == "time":
            bars = self.stream.footprint.get_time_bars(limit=1)
        else:
            bars = self.stream.footprint.get_event_bars(limit=1)

        if not bars:
            return []

        last_bar = bars[-1]
        rows = last_bar.get("rows", [])
        imbalances = self.stream.imbalance.detect(rows)
        return {
            "bar": last_bar,
            "imbalances": imbalances,
        }
