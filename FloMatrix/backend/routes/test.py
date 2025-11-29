# backend/routes/test.py

from fastapi import APIRouter, Depends

from backend.security import verify_api_key, verify_signature

router = APIRouter(
    prefix="/secure",
    tags=["Secure Test"],
)


@router.get("/ping", dependencies=[Depends(verify_api_key), Depends(verify_signature)])
async def secure_ping():
    """
    Simple secure test endpoint.

    Requires headers:
      - x-api-key
      - x-timestamp (unix seconds)
      - x-signature (HMAC-SHA256(api_key|timestamp, secret))
    """
    return {"message": "secure pong"}
