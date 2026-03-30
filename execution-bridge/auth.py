# [claude-code 2026-03-28] S5-T2: TopStepX authentication via direct REST API
"""
ProjectX Authentication
Manages login, token lifecycle, and session state.
Uses direct HTTP calls to https://api.topstepx.com/api.
"""

import os
import time
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Module State ──
_token: Optional[str] = None
_token_expiry: float = 0
_account_id: Optional[int] = None
_account_balance: float = 0
_account_can_trade: bool = False

# Token lifetime: TopStepX JWTs typically expire in ~24h.
# Refresh proactively at 20h to avoid mid-trade expiry.
TOKEN_LIFETIME_SEC = 20 * 3600


def _base_url() -> str:
    return os.environ.get("PROJECTX_BASE_URL", "https://api.topstepx.com")


async def login() -> bool:
    """
    Authenticate with TopStepX API and store the JWT + first account ID.
    Endpoint: POST /api/Auth/loginKey
    Body: { "userName": str, "apiKey": str }
    Returns: { token, success, errorCode, errorMessage }
    """
    global _token, _token_expiry, _account_id, _account_balance, _account_can_trade

    api_key = os.environ.get("PROJECTX_API_KEY")
    username = os.environ.get("PROJECTX_USERNAME")

    if not api_key or not username:
        logger.error("PROJECTX_API_KEY and PROJECTX_USERNAME required")
        return False

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Step 1: Authenticate
            resp = await client.post(
                f"{_base_url()}/api/Auth/loginKey",
                json={"userName": username, "apiKey": api_key},
            )
            resp.raise_for_status()
            data = resp.json()

            if not data.get("success"):
                logger.error(f"ProjectX auth failed: {data.get('errorMessage')}")
                return False

            _token = data["token"]
            _token_expiry = time.time() + TOKEN_LIFETIME_SEC
            logger.info(f"ProjectX login successful for {username}")

            # Step 2: Fetch accounts to grab the first tradeable account
            await _sync_accounts(client)

        return True

    except httpx.HTTPStatusError as e:
        logger.error(f"ProjectX login HTTP error: {e.response.status_code} — {e.response.text}")
        return False
    except Exception as e:
        logger.error(f"ProjectX login failed: {e}")
        return False


async def _sync_accounts(client: httpx.AsyncClient) -> None:
    """Fetch accounts and cache the first visible, tradeable one."""
    global _account_id, _account_balance, _account_can_trade

    resp = await client.post(
        f"{_base_url()}/api/Account/search",
        json={"onlyActiveAccounts": True},
        headers=_auth_headers(),
    )
    resp.raise_for_status()
    data = resp.json()

    accounts = data.get("accounts", [])
    if not accounts:
        logger.warning("No accounts returned from ProjectX")
        return

    # Pick the first visible, tradeable account
    for acct in accounts:
        if acct.get("canTrade") and acct.get("isVisible", True):
            _account_id = acct["id"]
            _account_balance = acct.get("balance", 0)
            _account_can_trade = acct.get("canTrade", False)
            logger.info(f"Active account: {_account_id} (balance: {_account_balance})")
            return

    # Fallback to first account
    first = accounts[0]
    _account_id = first["id"]
    _account_balance = first.get("balance", 0)
    _account_can_trade = first.get("canTrade", False)
    logger.info(f"Fallback account: {_account_id}")


def _auth_headers() -> dict[str, str]:
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {_token}", "Content-Type": "application/json"}


async def get_token() -> Optional[str]:
    """Get current auth token, refreshing if expired."""
    global _token, _token_expiry
    if _token and time.time() < _token_expiry:
        return _token

    success = await login()
    return _token if success else None


async def get_account_id() -> Optional[int]:
    """Get the active TopStep account ID."""
    return _account_id


def get_account_balance() -> float:
    return _account_balance


def get_account_can_trade() -> bool:
    return _account_can_trade


def is_authenticated() -> bool:
    """Check if we have a valid, non-expired token."""
    return _token is not None and time.time() < _token_expiry


async def authenticated_client() -> httpx.AsyncClient:
    """Return an httpx client with auth headers set."""
    token = await get_token()
    if not token:
        raise RuntimeError("Not authenticated with ProjectX")
    return httpx.AsyncClient(
        base_url=_base_url(),
        headers=_auth_headers(),
        timeout=15,
    )


async def refresh_account_info() -> None:
    """Re-sync account data (balance, canTrade) from the API."""
    token = await get_token()
    if not token:
        return
    async with httpx.AsyncClient(timeout=15) as client:
        await _sync_accounts(client)
