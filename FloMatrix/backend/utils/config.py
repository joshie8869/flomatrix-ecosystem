# backend/utils/config.py
"""
Unified config for DeltaTrader:

- Frontend CORS settings
- Security (API keys, HMAC, JWT, rate limiting)
- Binance streaming engine settings
- REST bootstrap settings
- Default symbol and kline / trade / depth settings for engines
"""

# ─────────────────────────────────────────────
# CORS / FRONTEND ORIGINS
# ─────────────────────────────────────────────

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://DeltaTrader:3000",
    "http://DeltaTrader",
]

# ─────────────────────────────────────────────
# SECURITY: API KEYS & SECRETS  (CHANGE THESE!)
# ─────────────────────────────────────────────

API_KEYS = {
    # Public key used by your frontend / clients
    "DeltaTraderClient": "PUBLIC_API_KEY_DELTATRADER",
}

API_SECRETS = {
    # Matching private secret for HMAC signing
    "DeltaTraderClient": "SUPER_SECRET_256_BIT_HEX_STRING_CHANGE_ME",
}

# ─────────────────────────────────────────────
# SECURITY: JWT SETTINGS
# ─────────────────────────────────────────────

JWT_SECRET = "CHANGE_THIS_TO_A_LONG_RANDOM_64_CHAR_SECRET"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

# ─────────────────────────────────────────────
# SECURITY: RATE LIMITING
# ─────────────────────────────────────────────

RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 10

# ─────────────────────────────────────────────
# BINANCE WEBSOCKET SETTINGS (binance_stream.py)
# ─────────────────────────────────────────────

# Main Binance websocket endpoint
BINANCE_WS = "wss://stream.binance.com:9443/stream"

# Default streams dictionary. Your engine can modify/extend this,
# but these satisfy imports and give sane defaults.
STREAMS = {
    "aggTrade": "btcusdt@aggTrade",        # aggregated trades
    "depth": "btcusdt@depth@100ms",        # orderbook depth
    "kline_1m": "btcusdt@kline_1m",        # 1-minute candles
}

# How many seconds to wait before reconnecting Binance websockets
RECONNECT_DELAY = 5

# ─────────────────────────────────────────────
# REST LOADER SETTINGS (rest_loader.py)
# ─────────────────────────────────────────────

# Base URL for Binance REST API (used to bootstrap orderbook, klines, etc.)
REST_BASE = "https://api.binance.com"

# Default symbol for REST/bootstrap operations
SYMBOL = "btcusdt"

# Kline settings – many engines/loader variants use these names
KLINE_INTERVAL = "1m"
KLINE_LIMIT = 1000

# Provide generic aliases in case some files import these instead
INTERVAL = KLINE_INTERVAL
LIMIT = KLINE_LIMIT

# ─────────────────────────────────────────────
# TRADES SETTINGS (used by rest_loader / engines)
# ─────────────────────────────────────────────

# How many recent trades to request in bootstrap REST calls
TRADES_LIMIT = 1000

# Optional extra defaults in case old code uses these
TRADES_SYMBOL = SYMBOL
TRADES_INTERVAL = KLINE_INTERVAL

# ─────────────────────────────────────────────
# DEPTH / ORDERBOOK SETTINGS
# ─────────────────────────────────────────────

# Depth size for orderbook REST/bootstrap calls
DEPTH_LIMIT = 1000

# Aliases in case the engine imports different names
ORDERBOOK_LIMIT = DEPTH_LIMIT
DOM_DEPTH = DEPTH_LIMIT
L2_DEPTH = DEPTH_LIMIT
