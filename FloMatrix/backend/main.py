# ==========================================
# backend/main.py  (FULL + MERGED + FIXED)
# ==========================================

"""
DeltaTrader Secure Backend (Phase 2 – using backend.utils.config)

- CORS locked to localhost + DeltaTrader
- Rate limiting
- API keys + HMAC signatures
- JWT auth
- Secure REST endpoints (/secure/*)
- Secure WebSocket endpoint (/ws/secure-stream)
- Unified API mounted at /legacy
- FRONTEND UI + charting integrated
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

# SECURITY + CONFIG
from backend.utils.config import ALLOWED_ORIGINS
from backend.middleware import security_middleware

# ROUTERS
from backend.auth import router as auth_router
from backend.routes.secure_price import router as secure_price_router
from backend.routes.test import router as secure_test_router
from backend.secure_ws import router as ws_router

# UNIFIED API + CHART API
from backend import unified_api
from backend import chart_api


# ==========================================
# FASTAPI APP
# ==========================================
app = FastAPI(
    title="DeltaTrader Secure Backend",
    description="Secure backend with HMAC, API keys, JWT, rate limiting, frontend UI, charting, and legacy trading API.",
    version="2.0",
)


# ==========================================
# FRONTEND UI SETUP
# ==========================================

# Serve static assets (CSS, JS, IMG)
app.mount(
    "/static",
    StaticFiles(directory="frontend/static"),
    name="static",
)

# Templates directory
templates = Jinja2Templates(directory="frontend/templates")


# ---- UI HOMEPAGE ----
@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    """
    Loads the Trading UI dashboard (index.html)
    """
    return templates.TemplateResponse("index.html", {"request": request})


# ==========================================
# CORS LOCKDOWN
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# GLOBAL SECURITY MIDDLEWARE
# ==========================================
app.middleware("http")(security_middleware)


# ==========================================
# ROUTERS
# ==========================================

app.include_router(auth_router)              # /auth/*
app.include_router(secure_price_router)      # /secure/price/*
app.include_router(secure_test_router)       # /secure/ping
app.include_router(ws_router)                # /ws/secure-stream

# Chart API (for candlestick data used in frontend chart)
app.include_router(chart_api.router)

# Mount your "old" unified API under /legacy
app.mount("/legacy", unified_api.app)


# ==========================================
# HEALTH CHECK (NEW SAFE VERSION)
# ==========================================

@app.get("/health")
async def health():
    """
    NON-UI health check. Does NOT override /
    """
    return {
        "DeltaTrader": "Secure backend running",
        "security": {
            "CORS": "Locked",
            "API Keys": "Enabled",
            "HMAC": "Enabled",
            "JWT": "Enabled",
            "Rate Limit": "Enabled",
        },
        "modules": {
            "Legacy Unified API": "/legacy",
            "Secure REST": "/secure",
            "Auth": "/auth",
            "Secure WebSocket": "/ws/secure-stream",
            "Chart Data": "/api/candles",
        },
    }

# ==========================================
# END OF FILE
# ==========================================
