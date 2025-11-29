# backend/rate_limit.py

import time
from fastapi import HTTPException

# FIXED: use backend.utils.config
from backend.utils.config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS

_rate_cache = {}


def rate_limit(identifier: str) -> None:
    """
    Basic sliding-window rate limiter.

    identifier: usually client IP or (IP + API key)
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    if identifier not in _rate_cache:
        _rate_cache[identifier] = []

    # Drop old timestamps
    _rate_cache[identifier] = [t for t in _rate_cache[identifier] if t > window_start]

    if len(_rate_cache[identifier]) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Limit: {RATE_LIMIT_REQUESTS} per {RATE_LIMIT_WINDOW_SECONDS}s.",
        )

    _rate_cache[identifier].append(now)
