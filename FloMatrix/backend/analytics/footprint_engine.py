# backend/analytics/footprint_engine.py

from collections import defaultdict, deque

# Event-based footprint thresholds (tuned for BTC perp)
EVENT_TRADES_THRESHOLD = 300       # trades per event bar
EVENT_VOLUME_THRESHOLD = 75.0      # total size per event bar
EVENT_TICK_THRESHOLD = 50.0        # price move from bar start
EVENT_DELTA_THRESHOLD = 30.0       # |delta| per event bar


class FootprintEngine:
    """
    Dual-mode footprint engine:
      - Time-based bars (e.g. 1m)
      - Event-based bars (orderflow-defined)

    Each bar contains:
      - start_ts, end_ts
      - high, low, open, close
      - total_volume, total_delta
      - rows: [{price, bid, ask, delta, total}, ...]
    """

    def __init__(self, time_interval_sec: int = 60, max_bars: int = 500):
        self.time_interval = time_interval_sec
        self.time_bars = deque(maxlen=max_bars)
        self.event_bars = deque(maxlen=max_bars)

        self._reset_time_bar()
        self._reset_event_bar()

    # --------------------------------------------------
    # Internal state helpers
    # --------------------------------------------------
    def _reset_time_bar(self):
        self.time_start_ts = None
        self.time_end_ts = None
        self.time_open = None
        self.time_high = None
        self.time_low = None
        self.time_close = None
        self.time_volume = 0.0
        self.time_delta = 0.0
        self.time_rows = defaultdict(lambda: {"bid": 0.0, "ask": 0.0})

    def _reset_event_bar(self):
        self.event_start_ts = None
        self.event_end_ts = None
        self.event_open = None
        self.event_high = None
        self.event_low = None
        self.event_close = None
        self.event_volume = 0.0
        self.event_delta = 0.0
        self.event_rows = defaultdict(lambda: {"bid": 0.0, "ask": 0.0})
        self.event_trade_count = 0
        self.event_start_price = None

    # --------------------------------------------------
    # Public: process trade (drives both bar types)
    # --------------------------------------------------
    def process_trade(self, price: float, size: float, side: str, ts_ms: int):
        """
        Process a single trade:
          - price: float
          - size: float
          - side: "buy" or "sell"
          - ts_ms: timestamp in milliseconds

        Returns:
          (closed_time_bar, closed_event_bar)
          Each bar may be None if not closed this call.
        """
        ts_sec = ts_ms / 1000.0
        side = side.lower()

        closed_time_bar = self._update_time_bar(price, size, side, ts_sec)
        closed_event_bar = self._update_event_bar(price, size, side, ts_sec)

        return closed_time_bar, closed_event_bar

    # --------------------------------------------------
    # Time-based bar logic
    # --------------------------------------------------
    def _update_time_bar(self, price, size, side, ts_sec):
        # Initialize first bar start
        if self.time_start_ts is None:
            # Align bar start to interval boundary
            bucket_start = ts_sec - (ts_sec % self.time_interval)
            self.time_start_ts = bucket_start
            self.time_end_ts = bucket_start + self.time_interval

        # If trade is beyond current bar end -> close current & start new
        if ts_sec >= self.time_end_ts:
            closed = self._finalize_time_bar()
            # Start new bar period
            bucket_start = ts_sec - (ts_sec % self.time_interval)
            self.time_start_ts = bucket_start
            self.time_end_ts = bucket_start + self.time_interval

        else:
            closed = None

        # Update current bar with new trade
        self._accumulate_time_trade(price, size, side)

        return closed

    def _accumulate_time_trade(self, price, size, side):
        if self.time_open is None:
            self.time_open = price
        self.time_close = price
        self.time_high = price if self.time_high is None else max(self.time_high, price)
        self.time_low = price if self.time_low is None else min(self.time_low, price)

        self.time_volume += size
        if side == "buy":
            self.time_delta += size
            self.time_rows[price]["ask"] += size
        else:
            self.time_delta -= size
            self.time_rows[price]["bid"] += size

    def _finalize_time_bar(self):
        if not self.time_rows:
            self._reset_time_bar()
            return None

        rows_out = []
        poc_price = None
        poc_vol = -1

        for price, vol in self.time_rows.items():
            bid = vol["bid"]
            ask = vol["ask"]
            total = bid + ask
            delta = ask - bid

            if total > poc_vol:
                poc_vol = total
                poc_price = price

            rows_out.append({
                "price": price,
                "bid": bid,
                "ask": ask,
                "delta": delta,
                "total": total,
            })

        bar = {
            "type": "time",
            "start_ts": self.time_start_ts,
            "end_ts": self.time_end_ts,
            "open": self.time_open,
            "high": self.time_high,
            "low": self.time_low,
            "close": self.time_close,
            "volume": self.time_volume,
            "delta": self.time_delta,
            "poc": poc_price,
            "rows": sorted(rows_out, key=lambda x: x["price"]),
        }

        self.time_bars.append(bar)
        self._reset_time_bar()
        return bar

    # --------------------------------------------------
    # Event-based bar logic
    # --------------------------------------------------
    def _update_event_bar(self, price, size, side, ts_sec):
        # Initialize first event bar
        if self.event_start_ts is None:
            self.event_start_ts = ts_sec
            self.event_start_price = price

        # Update state with trade
        self._accumulate_event_trade(price, size, side, ts_sec)

        # Check event thresholds
        cond_trades = self.event_trade_count >= EVENT_TRADES_THRESHOLD
        cond_volume = self.event_volume >= EVENT_VOLUME_THRESHOLD
        cond_tick = abs(price - self.event_start_price) >= EVENT_TICK_THRESHOLD
        cond_delta = abs(self.event_delta) >= EVENT_DELTA_THRESHOLD

        if cond_trades or cond_volume or cond_tick or cond_delta:
            return self._finalize_event_bar()

        return None

    def _accumulate_event_trade(self, price, size, side, ts_sec):
        if self.event_open is None:
            self.event_open = price
        self.event_close = price
        self.event_high = price if self.event_high is None else max(self.event_high, price)
        self.event_low = price if self.event_low is None else min(self.event_low, price)

        self.event_end_ts = ts_sec
        self.event_volume += size
        self.event_trade_count += 1

        if side == "buy":
            self.event_delta += size
            self.event_rows[price]["ask"] += size
        else:
            self.event_delta -= size
            self.event_rows[price]["bid"] += size

    def _finalize_event_bar(self):
        if not self.event_rows:
            self._reset_event_bar()
            return None

        rows_out = []
        poc_price = None
        poc_vol = -1

        for price, vol in self.event_rows.items():
            bid = vol["bid"]
            ask = vol["ask"]
            total = bid + ask
            delta = ask - bid

            if total > poc_vol:
                poc_vol = total
                poc_price = price

            rows_out.append({
                "price": price,
                "bid": bid,
                "ask": ask,
                "delta": delta,
                "total": total,
            })

        bar = {
            "type": "event",
            "start_ts": self.event_start_ts,
            "end_ts": self.event_end_ts,
            "open": self.event_open,
            "high": self.event_high,
            "low": self.event_low,
            "close": self.event_close,
            "volume": self.event_volume,
            "delta": self.event_delta,
            "poc": poc_price,
            "rows": sorted(rows_out, key=lambda x: x["price"]),
        }

        self.event_bars.append(bar)
        self._reset_event_bar()
        return bar

    # --------------------------------------------------
    # Public accessors
    # --------------------------------------------------
    def get_time_bars(self, limit: int = 50):
        limit = max(1, limit)
        bars = list(self.time_bars)
        return bars[-limit:]

    def get_event_bars(self, limit: int = 50):
        limit = max(1, limit)
        bars = list(self.event_bars)
        return bars[-limit:]
