# [claude-code 2026-04-19] Internal JWT auth. backend-hono signs; sidecar verifies.
from __future__ import annotations

import os
from typing import Any

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt


AUTH_DISABLED = os.environ.get("HERMES_AUTH_DISABLED") == "1"


def _get_secret() -> str:
    secret = os.environ.get("INTERNAL_HERMES_JWT")
    if not secret:
        raise RuntimeError(
            "INTERNAL_HERMES_JWT missing. Set in launchd env or Fly secrets. "
            "For local dev without JWT, set HERMES_AUTH_DISABLED=1."
        )
    return secret


def verify_internal_jwt(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if AUTH_DISABLED:
        return {"sub": "local-dev"}
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
        )
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, _get_secret(), algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid token: {exc}",
        ) from exc
