# backend/secure_ws.py

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from backend.security import validate_signature_headers

router = APIRouter(
    prefix="/ws",
    tags=["Secure WebSocket"],
)


@router.websocket("/secure-stream")
async def secure_stream(websocket: WebSocket):
    """
    Secure WebSocket endpoint.

    Requires headers:
      - x-api-key
      - x-timestamp
      - x-signature

    If headers or signature are invalid, the socket closes immediately.
    """

    # Validate headers BEFORE accepting the connection
    try:
        validate_signature_headers(websocket.headers)
    except HTTPException as e:
        # Policy violation = 1008
        await websocket.close(code=1008, reason=e.detail)
        return

    await websocket.accept()

    try:
        # For now, just send a heartbeat every 2s so we know it works.
        # Later we can plug this into your AsyncProviderManager / BinanceStream.
        while True:
            await websocket.send_json(
                {
                    "type": "heartbeat",
                    "message": "secure stream alive",
                }
            )
            await asyncio.sleep(2)

    except WebSocketDisconnect:
        # Client disconnected – nothing special to do yet.
        return
