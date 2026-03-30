# [claude-code 2026-03-28] S5-T2: FastAPI execution bridge wrapping TopStepX REST API
"""
Fintheon Execution Bridge
FastAPI sidecar for TopStepX order execution via direct REST API calls.

Start: uvicorn main:app --port 8001
Health: GET /health
Execute: POST /execute
Positions: GET /position
Account: GET /account
Cancel: POST /cancel/{order_id}
"""

import os
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

from models import (
    ExecuteRequest, ExecuteResponse, OrderStatus,
    PositionResponse, PositionItem, AccountResponse,
    HealthResponse, Direction,
)
from auth import (
    login, is_authenticated, get_account_id, authenticated_client,
    get_account_balance, get_account_can_trade, refresh_account_info,
)

load_dotenv()
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "info").upper())
logger = logging.getLogger(__name__)

# ── Contract Resolution Cache ──
# Maps friendly symbols (MNQ, ES) to TopStepX contractIds (CON.F.US.ENQ.M25)
_contract_cache: dict[str, str] = {}

# Friendly symbol → TopStepX search text mapping
SYMBOL_SEARCH_MAP: dict[str, str] = {
    "MNQ": "NQ",   # Micro E-mini NASDAQ → search "NQ" then pick micro
    "NQ": "NQ",    # E-mini NASDAQ
    "MES": "ES",   # Micro E-mini S&P → search "ES" then pick micro
    "ES": "ES",    # E-mini S&P
    "RTY": "RTY",  # Russell 2000
    "MYM": "YM",   # Micro Dow
    "YM": "YM",    # Dow
    "MCL": "CL",   # Micro Crude
    "CL": "CL",    # Crude Oil
    "MGC": "GC",   # Micro Gold
    "GC": "GC",    # Gold
}


async def resolve_contract_id(symbol: str) -> str:
    """
    Resolve a friendly symbol (e.g. 'MNQ') to a TopStepX contractId.
    Uses POST /api/Contract/search and caches results.
    """
    if symbol in _contract_cache:
        return _contract_cache[symbol]

    search_text = SYMBOL_SEARCH_MAP.get(symbol, symbol)

    async with await authenticated_client() as client:
        resp = await client.post(
            "/api/Contract/search",
            json={"searchText": search_text, "live": False},
        )
        resp.raise_for_status()
        data = resp.json()

    contracts = data.get("contracts", [])
    if not contracts:
        raise ValueError(f"No contracts found for symbol '{symbol}' (searched: '{search_text}')")

    # Pick the active contract; prefer exact symbol match
    active = [c for c in contracts if c.get("activeContract")]
    if not active:
        active = contracts

    # For micro contracts (MNQ, MES, etc.), the contractId contains
    # the micro prefix. Filter by checking if the name contains the symbol.
    chosen = active[0]
    for c in active:
        name = c.get("name", "").upper()
        if symbol.upper() in name:
            chosen = c
            break

    contract_id = chosen["id"]
    _contract_cache[symbol] = contract_id
    logger.info(f"Resolved {symbol} → {contract_id} ({chosen.get('name')})")
    return contract_id


# ── Lifespan ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: authenticate with ProjectX."""
    logger.info("Execution Bridge starting — authenticating with ProjectX...")
    success = await login()
    if success:
        logger.info("ProjectX authenticated. Bridge ready.")
    else:
        logger.warning("ProjectX auth failed — bridge running in degraded mode.")
    yield
    logger.info("Execution Bridge shutting down.")


app = FastAPI(
    title="Fintheon Execution Bridge",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Endpoints ──

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check — verifies ProjectX API connectivity."""
    connected = is_authenticated()
    account_id = await get_account_id()
    return HealthResponse(
        connected=connected,
        system="TopStepX",
        account=str(account_id or "none"),
        message="Connected" if connected else "Not authenticated",
    )


@app.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest):
    """
    Place an order via TopStepX REST API.
    - entry_price=None → market order (type=2)
    - entry_price set → limit order (type=1)
    - Always attaches bracket SL/TP and FINTHEON-AUTO tag
    """
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated with ProjectX")

    account_id = await get_account_id()
    if not account_id:
        raise HTTPException(status_code=503, detail="No active account")

    tag = f"FINTHEON-AUTO-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    now = datetime.now(timezone.utc).isoformat()

    try:
        contract_id = await resolve_contract_id(req.symbol)

        # Build order payload per TopStepX API: POST /api/Order/place
        order_type = 2 if req.entry_price is None else 1  # 2=Market, 1=Limit
        side = 0 if req.direction == Direction.long else 1  # 0=Buy, 1=Sell

        order_payload: dict = {
            "accountId": account_id,
            "contractId": contract_id,
            "type": order_type,
            "side": side,
            "size": req.position_size,
            "customTag": tag,
        }

        if req.entry_price is not None:
            order_payload["limitPrice"] = req.entry_price

        # Attach bracket orders for SL/TP
        if req.stop_loss_ticks > 0:
            order_payload["stopLossBracket"] = {
                "ticks": req.stop_loss_ticks,
                "type": 4,  # Stop order
            }
        if req.take_profit_ticks > 0:
            order_payload["takeProfitBracket"] = {
                "ticks": req.take_profit_ticks,
                "type": 1,  # Limit order
            }

        async with await authenticated_client() as client:
            resp = await client.post("/api/Order/place", json=order_payload)
            resp.raise_for_status()
            result = resp.json()

        if not result.get("success"):
            error_msg = result.get("errorMessage", "Unknown error")
            logger.error(f"Order rejected: {error_msg} | tag={tag}")
            return ExecuteResponse(
                status=OrderStatus.rejected,
                order_id="",
                fill_price=None,
                timestamp=now,
                message=error_msg,
            )

        order_id = str(result.get("orderId", ""))
        logger.info(
            f"Order placed: {order_id} | {req.direction.value} {req.position_size} "
            f"{req.symbol} ({contract_id}) | tag={tag}"
        )

        return ExecuteResponse(
            status=OrderStatus.filled,
            order_id=order_id,
            fill_price=req.entry_price,
            timestamp=now,
            message=f"Order {order_id} placed via ProjectX",
        )

    except ValueError as e:
        logger.error(f"Contract resolution failed: {e}")
        return ExecuteResponse(
            status=OrderStatus.error,
            order_id="",
            fill_price=None,
            timestamp=now,
            message=str(e),
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"Order HTTP error: {e.response.status_code} — {e.response.text}")
        return ExecuteResponse(
            status=OrderStatus.error,
            order_id="",
            fill_price=None,
            timestamp=now,
            message=f"HTTP {e.response.status_code}: {e.response.text[:200]}",
        )
    except Exception as e:
        logger.error(f"Order execution failed: {e}")
        return ExecuteResponse(
            status=OrderStatus.error,
            order_id="",
            fill_price=None,
            timestamp=now,
            message=str(e),
        )


@app.get("/position", response_model=PositionResponse)
async def get_positions():
    """
    Get current open positions from TopStepX.
    Endpoint: POST /api/Position/searchOpen
    """
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    account_id = await get_account_id()
    if not account_id:
        raise HTTPException(status_code=503, detail="No active account")

    try:
        async with await authenticated_client() as client:
            resp = await client.post(
                "/api/Position/searchOpen",
                json={"accountId": account_id},
            )
            resp.raise_for_status()
            data = resp.json()

        positions = []
        for p in data.get("positions", []):
            pos_type = p.get("type", 0)
            direction = Direction.long if pos_type == 1 else Direction.short

            positions.append(PositionItem(
                contract_id=p.get("contractId", ""),
                symbol=p.get("contractId", ""),  # Best we have without reverse lookup
                direction=direction,
                size=p.get("size", 0),
                average_price=p.get("averagePrice", 0),
                unrealized_pnl=0,  # Not available from REST; requires real-time hub
            ))

        return PositionResponse(
            positions=positions,
            account_id=str(account_id),
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"Position query HTTP error: {e.response.status_code}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Position query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/account", response_model=AccountResponse)
async def get_account():
    """
    Get account balance, buying power, PDPT status.
    Re-syncs account info from the API before returning.
    """
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    account_id = await get_account_id()
    if not account_id:
        raise HTTPException(status_code=503, detail="No active account")

    try:
        await refresh_account_info()
        balance = get_account_balance()

        return AccountResponse(
            account_id=str(account_id),
            balance=balance,
            buying_power=balance,  # TopStep doesn't have margin; balance = buying power
            can_trade=get_account_can_trade(),
            pdpt_remaining=max(0, balance - 1500),  # PDPT floor is $1,500
        )

    except Exception as e:
        logger.error(f"Account query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cancel/{order_id}")
async def cancel_order(order_id: str):
    """
    Cancel an open order via TopStepX.
    Uses POST /api/Order/modify or searches open orders to cancel.
    """
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    account_id = await get_account_id()
    if not account_id:
        raise HTTPException(status_code=503, detail="No active account")

    try:
        # Search open orders to find the one matching order_id
        async with await authenticated_client() as client:
            search_resp = await client.post(
                "/api/Order/searchOpen",
                json={"accountId": account_id},
            )
            search_resp.raise_for_status()
            search_data = search_resp.json()

            target_order = None
            for o in search_data.get("orders", []):
                if str(o.get("id")) == order_id:
                    target_order = o
                    break

            if not target_order:
                raise HTTPException(
                    status_code=404,
                    detail=f"Order {order_id} not found in open orders",
                )

            # Cancel by setting size to 0 via modify
            cancel_resp = await client.post(
                "/api/Order/modify",
                json={
                    "accountId": account_id,
                    "orderId": int(order_id),
                    "size": 0,
                },
            )
            cancel_resp.raise_for_status()
            result = cancel_resp.json()

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("errorMessage", "Cancel failed"),
            )

        logger.info(f"Order {order_id} cancelled")
        return {"success": True, "order_id": order_id, "message": "Cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel failed for {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
