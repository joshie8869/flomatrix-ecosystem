# backend/utils/config.py

# WebSocket base URL for Binance USDT-margined FUTURES (live feed)
BINANCE_WS = "wss://fstream.binance.com"

# REST base URL for Binance SPOT (bootstrap / backfill)
REST_BASE = "https://api.binance.com"

# Trading symbol
SYMBOL = "btcusdt"  # lowercase for WS, REST will use upper()

# Streams we want to subscribe to over WebSocket (FUTURES)
STREAMS = {
    "trades": f"{SYMBOL}@aggTrade",        # aggregated trades
    "depth": f"{SYMBOL}@depth20@100ms",    # depth 20, 100ms updates
    "kline_1m": f"{SYMBOL}@kline_1m",      # 1-minute candles
}

# Seconds to wait before reconnecting if connection drops
RECONNECT_DELAY = 3

# --- REST bootstrap settings using SPOT ---

KLINE_INTERVAL = "1m"
KLINE_LIMIT = 500
TRADES_LIMIT = 1000
DEPTH_LIMIT = 100

