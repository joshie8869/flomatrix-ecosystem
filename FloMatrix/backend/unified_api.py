# backend/unified_api.py

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import aiohttp
from fastapi import FastAPI, HTTPException, Query

from backend.provider_manager_async import AsyncProviderManager


app = FastAPI(
    title="Unified Trading Backend API",
    description="Unified live market data API for OKX, Binance, and dxFeed",
    version="1.0.0"
)

# Only allow specific trading symbols we support
ALLOWED_SYMBOLS = {"BTCUSDT", "ETHUSDT"}

@app.get("/price/{symbol}")
async def get_price(symbol: str):
    symbol = symbol.upper()

    # Basic input validation (security)
    if symbol not in ALLOWED_SYMBOLS:
        raise HTTPException(status_code=400, detail="Unsupported symbol")

    binance_url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(binance_url, timeout=5) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Upstream error from Binance: {resp.status}",
                    )
                data = await resp.json()
    except aiohttp.ClientError:
        raise HTTPException(status_code=502, detail="Error contacting Binance")

    # extra sanity
    price_str = data.get("price")
    if price_str is None:
        raise HTTPException(status_code=502, detail="Unexpected response from Binance")

    return {"symbol": symbol, "price": float(price_str)}

@app.get("/ping")
async def ping():
    return {"message": "pong"}

origins = [
    "http://localhost:3000",
    "http://DeltaTrader:3000",
    "http://deltatrader:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],   # limit to GET for now
    allow_headers=["*"],
)



@app.on_event("startup")
async def startup_event():
    app.state.pm = AsyncProviderManager()
    await app.state.pm.set_provider("okx")
    print("[UnifiedAPI] Default provider started: OKX")


class ProviderRequest(BaseModel):
    name: str


@app.get("/provider")
async def get_provider():
    pm: AsyncProviderManager = app.state.pm
    return {"current_provider": pm.get_current_name()}


@app.post("/provider")
async def set_provider(req: ProviderRequest):
    pm: AsyncProviderManager = app.state.pm
    name = req.name.lower()
    try:
        await pm.set_provider(name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok", "current_provider": pm.get_current_name()}


# ----------------- L1 / L2 / Trades -----------------

@app.get("/l1")
async def get_l1(
    symbol: Optional[str] = Query(None, description="Required for dxfeed, optional for Binance/OKX")
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")

    if provider == "okx":
        data = pm.get_l1(symbol or "BTC-USDT-SWAP")
    elif provider == "binance":
        data = pm.get_l1("btcusdt")
    elif provider == "dxfeed":
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required for dxfeed")
        data = pm.get_l1(symbol)
    else:
        raise HTTPException(status_code=400, detail=f"L1 not implemented for provider {provider}")

    if data is None:
        raise HTTPException(status_code=404, detail="No L1 data yet.")
    return data


@app.get("/l2")
async def get_l2(
    symbol: Optional[str] = Query(None),
    depth: int = Query(10, ge=1, le=100)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")

    if provider == "okx":
        data = pm.get_l2(symbol or "BTC-USDT-SWAP", depth=depth)
    elif provider == "binance":
        data = pm.get_l2("btcusdt", depth=depth)
    elif provider == "dxfeed":
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required for dxfeed")
        data = pm.get_l2(symbol, depth=depth)
    else:
        raise HTTPException(status_code=400, detail=f"L2 not implemented for provider {provider}")

    if data is None:
        raise HTTPException(status_code=404, detail="No L2 data yet.")
    return data


@app.get("/trades")
async def get_trades(
    symbol: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=1000)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")

    if provider == "okx":
        data = pm.get_trades(symbol or "BTC-USDT-SWAP", limit=limit)
    elif provider == "binance":
        data = pm.get_trades("btcusdt", limit=limit)
    elif provider == "dxfeed":
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required for dxfeed")
        data = pm.get_trades(symbol, limit=limit)
    else:
        raise HTTPException(status_code=400, detail=f"Trades not implemented for provider {provider}")

    if data is None:
        raise HTTPException(status_code=404, detail="No trades yet.")
    return data


# ----------------- Delta / CVD (OKX only) -----------------

@app.get("/delta")
async def get_delta(
    symbol: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=2000)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")

    if provider != "okx":
        raise HTTPException(status_code=400, detail="Delta is currently implemented for OKX only.")

    data = pm.get_delta(symbol or "BTC-USDT-SWAP", limit=limit)
    if data is None or len(data) == 0:
        raise HTTPException(status_code=404, detail="No delta data yet.")

    return {
        "provider": "okx",
        "symbol": (symbol or "BTC-USDT-SWAP"),
        "count": len(data),
        "entries": data,
    }


@app.get("/cvd")
async def get_cvd(
    symbol: Optional[str] = Query(None)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")

    if provider != "okx":
        raise HTTPException(status_code=400, detail="CVD is currently implemented for OKX only.")

    val = pm.get_cvd(symbol or "BTC-USDT-SWAP")
    if val is None:
        raise HTTPException(status_code=404, detail="No CVD data yet.")

    return {
        "provider": "okx",
        "symbol": (symbol or "BTC-USDT-SWAP"),
        "cvd": val,
    }


# ----------------- DOM (OKX only) -----------------

@app.get("/dom")
async def get_dom(
    depth: int = Query(20, ge=1, le=200)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="DOM currently implemented for OKX only.")

    data = pm.get_dom(depth=depth)
    if data is None:
        raise HTTPException(status_code=404, detail="No DOM data yet.")
    return data


# ----------------- MOB (OKX only) -----------------

@app.get("/mob")
async def get_mob(
    limit_trades: int = Query(50, ge=1, le=200)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="MOB currently implemented for OKX only.")

    data = pm.get_mob(limit_trades=limit_trades)
    if data is None:
        raise HTTPException(status_code=404, detail="No MOB data yet.")
    return data


# ----------------- Volume Profile (OKX only) -----------------

@app.get("/volume_profile")
async def get_volume_profile():
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="Volume profile currently implemented for OKX only.")

    rows = pm.get_volume_profile()
    if rows is None or len(rows) == 0:
        raise HTTPException(status_code=404, detail="No volume profile data yet.")
    return {"provider": "okx", "symbol": "BTC-USDT-SWAP", "rows": rows}


# ----------------- Footprint (OKX only) -----------------

@app.get("/footprint/time")
async def get_footprint_time(
    limit: int = Query(10, ge=1, le=200)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="Footprint currently implemented for OKX only.")

    bars = pm.get_footprint(mode="time", limit=limit)
    if bars is None or len(bars) == 0:
        raise HTTPException(status_code=404, detail="No time-based footprint bars yet.")
    return {"provider": "okx", "symbol": "BTC-USDT-SWAP", "bars": bars}


@app.get("/footprint/event")
async def get_footprint_event(
    limit: int = Query(10, ge=1, le=200)
):
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="Footprint currently implemented for OKX only.")

    bars = pm.get_footprint(mode="event", limit=limit)
    if bars is None or len(bars) == 0:
        raise HTTPException(status_code=404, detail="No event-based footprint bars yet.")
    return {"provider": "okx", "symbol": "BTC-USDT-SWAP", "bars": bars}


# ----------------- Imbalances (OKX only) -----------------

@app.get("/imbalances/time")
async def get_imbalances_time():
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="Imbalances currently implemented for OKX only.")

    data = pm.get_imbalances(mode="time")
    if data is None or not data.get("imbalances"):
        raise HTTPException(status_code=404, detail="No time-based imbalances yet.")

    return {"provider": "okx", "symbol": "BTC-USDT-SWAP", **data}


@app.get("/imbalances/event")
async def get_imbalances_event():
    pm: AsyncProviderManager = app.state.pm
    provider = pm.get_current_name()
    if provider is None:
        raise HTTPException(status_code=400, detail="No provider running.")
    if provider != "okx":
        raise HTTPException(status_code=400, detail="Imbalances currently implemented for OKX only.")

    data = pm.get_imbalances(mode="event")
    if data is None or not data.get("imbalances"):
        raise HTTPException(status_code=404, detail="No event-based imbalances yet.")

    return {"provider": "okx", "symbol": "BTC-USDT-SWAP", **data}


@app.get("/")
async def root():
    return {
        "message": "Unified Trading Backend API is running.",
        "providers": ["okx", "binance", "dxfeed"],
        "default": "okx"
    }

