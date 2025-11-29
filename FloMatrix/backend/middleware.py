# backend/middleware.py

from fastapi import Request
from fastapi.responses import JSONResponse

from backend.rate_limit import rate_limit
from backend.security import validate_signature_headers


async def security_middleware(request: Request, call_next):
    client_ip = request.client.host
    path = request.url.path

    identifier = f"{client_ip}:{path}"
    try:
        # Basic rate limit for ALL requests
        rate_limit(identifier)

        # Enforce HMAC security on secure endpoints
        if path.startswith("/secure"):
            validate_signature_headers(request.headers)

        response = await call_next(request)
        return response

    except Exception as e:
        status = getattr(e, "status_code", 400)
        return JSONResponse(
            status_code=status,
            content={"error": str(e)},
        )
