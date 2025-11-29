# services/ai-builder/aibuilder/security.py
# Security + Mode C enforcement for FloMatrix AI Builder.

from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException
from starlette.requests import Request


class Security:
    """
    Mode C (dual-mode) rules:

    - Execution / risk / backend code cannot be modified in AUTO mode.
    - For now, auth is a simple shared header key (can be expanded later).
    """

    # In a real deployment, set this via environment variable.
    API_KEY_HEADER = "x-aibuilder-key"
    API_KEY_VALUE = None  # if None, auth is effectively disabled

    # Paths where AUTO mode is NOT allowed
    PROTECTED_PREFIXES: Iterable[str] = (
        "app/engine/execution",
        "backend",
        "app/backend",
        "services/trading",
    )

    @staticmethod
    async def enforce_auth(request: Request) -> None:
        """
        Simple header-based auth stub.
        If API_KEY_VALUE is None, we skip auth (dev mode).
        """
        if Security.API_KEY_VALUE is None:
            # Dev mode: allow everything
            return

        header_value = request.headers.get(Security.API_KEY_HEADER)
        if header_value != Security.API_KEY_VALUE:
            raise HTTPException(status_code=401, detail="Unauthorized AI Builder request")

    @staticmethod
    def enforce_target_mode(path: str, mode: str) -> None:
        """
        Block AUTO mode for protected paths.
        """
        if mode == "auto":
            for prefix in Security.PROTECTED_PREFIXES:
                if path.startswith(prefix):
                    raise HTTPException(
                        status_code=403,
                        detail=f"AUTO mode not allowed for protected path: {path}",
                    )
