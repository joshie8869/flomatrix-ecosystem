# backend/security.py

import time
import hmac
import hashlib
from typing import Mapping

from fastapi import Header, HTTPException

# FIXED: use backend.utils.config
from backend.utils.config import API_SECRETS


def _validate_signature(api_key: str, timestamp: str, signature: str) -> None:
    """Core HMAC check used by HTTP deps and WebSocket."""
    if api_key not in API_SECRETS:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        ts_int = int(timestamp)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp")

    now = int(time.time())
    if abs(now - ts_int) > 5:
        raise HTTPException(status_code=408, detail="Expired signature timestamp")

    secret = API_SECRETS[api_key].encode("utf-8")
    msg = f"{api_key}|{timestamp}".encode("utf-8")

    expected = hmac.new(secret, msg, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")


# ───────── HTTP dependencies for secure routes ─────────

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key not in API_SECRETS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


def verify_signature(
    x_api_key: str = Header(...),
    x_timestamp: str = Header(...),
    x_signature: str = Header(...),
):
    _validate_signature(x_api_key, x_timestamp, x_signature)
    return True


# ───────── Header validator for middleware / WebSockets ─────────

def validate_signature_headers(headers: Mapping[str, str]) -> str:
    api_key = headers.get("x-api-key")
    ts = headers.get("x-timestamp")
    sig = headers.get("x-signature")

    if not api_key or not ts or not sig:
        raise HTTPException(status_code=401, detail="Missing security headers")

    _validate_signature(api_key, ts, sig)
    return api_key
