# S5-T2: Execution Bridge — Python FastAPI Service

**Sprint:** S5 (Execution Bridge — Safety-Critical Path)
**Track:** T2 — Python Sidecar
**Dependencies:** T1 complete (type contracts to honor)

---

## Objective
Build a Python FastAPI microservice at `execution-bridge/` that wraps the `project-x-py` SDK (v3.5.9) to provide HTTP endpoints for order placement, position queries, account info, and order cancellation. This mirrors the existing rithmic-gateway pattern (localhost:3002) but for TopStepX on port 8001.

---

## Files to Read First
- `backend-hono/src/services/rithmic-service.ts` — The exact sidecar HTTP pattern to replicate. Note: JSON in/out, `/status` for health, `/order/place` for execution. Your endpoints should feel identical from the TypeScript caller's perspective.
- `backend-hono/src/types/execution-bridge.ts` — (created by T1) The request/response contracts your endpoints must honor: `BridgeExecuteRequest`, `BridgeExecuteResponse`, `BridgePositionResponse`, `BridgeAccountResponse`, `BridgeHealthResponse`
- `backend-hono/src/types/projectx.ts` — ProjectX domain types (OrderStatus, OrderType, OrderSide, etc.)

**External reference:** `project-x-py` SDK documentation — read the README/docs for:
- Authentication flow (login with API key + username)
- Order placement API
- Position query API
- Account balance API
- WebSocket vs REST availability

---

## Files to Create

All files go in a new `execution-bridge/` directory at the project root.

### 1. `execution-bridge/requirements.txt`

```
project-x-py>=3.5.9
fastapi>=0.115.0
uvicorn>=0.34.0
pydantic>=2.10.0
python-dotenv>=1.0.0
```

### 2. `execution-bridge/.env.example`

```bash
PROJECTX_API_KEY=
PROJECTX_USERNAME=
BRIDGE_PORT=8001
LOG_LEVEL=info
```

### 3. `execution-bridge/models.py`

Pydantic models matching the TypeScript types from T1. These are the HTTP contracts.

```python
from pydantic import BaseModel
from typing import Optional
from enum import Enum


class Direction(str, Enum):
    long = "long"
    short = "short"


class OrderStatus(str, Enum):
    filled = "filled"
    rejected = "rejected"
    pending = "pending"
    error = "error"


class HourFibContext(BaseModel):
    hour: int
    sweep_occurred: str  # "high" | "low" | "none"
    fib_1_41_probability: float
    fib_1_68_probability: float
    post_sweep_retrace_probability: float


class SignalMetadata(BaseModel):
    pmi_chain_active: bool
    narrative_bias: str  # "bullish" | "bearish" | "neutral"
    session: str  # "premarket" | "NY_open" | "lunch" | "PM" | "after_hours"


class ExecuteRequest(BaseModel):
    model: str  # "flush" | "ripper" | "40_40_club"
    direction: Direction
    symbol: str
    confluence_score: int
    position_size: int
    entry_price: Optional[float] = None  # None = market order
    stop_loss_ticks: int
    take_profit_ticks: int
    hour_fib_context: Optional[HourFibContext] = None
    signal_metadata: Optional[SignalMetadata] = None


class ExecuteResponse(BaseModel):
    status: OrderStatus
    order_id: str
    fill_price: Optional[float] = None
    timestamp: str
    message: str


class PositionItem(BaseModel):
    contract_id: str
    symbol: str
    direction: Direction
    size: int
    average_price: float
    unrealized_pnl: float


class PositionResponse(BaseModel):
    positions: list[PositionItem]
    account_id: str


class AccountResponse(BaseModel):
    account_id: str
    balance: float
    buying_power: float
    can_trade: bool
    pdpt_remaining: float


class HealthResponse(BaseModel):
    connected: bool
    system: str
    account: str
    message: str
```

### 4. `execution-bridge/auth.py`

Handles ProjectX authentication — login, token storage, refresh.

```python
"""
ProjectX Authentication
Manages login, token lifecycle, and session state.
Uses project-x-py SDK for the actual API calls.
"""

import os
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Token state
_token: Optional[str] = None
_token_expiry: float = 0
_account_id: Optional[int] = None


async def login() -> bool:
    """
    Authenticate with ProjectX API using credentials from env.
    Store token for subsequent requests.

    Uses project-x-py SDK — read the SDK docs for the actual
    authentication method signature. This is a scaffold.
    """
    api_key = os.environ.get("PROJECTX_API_KEY")
    username = os.environ.get("PROJECTX_USERNAME")

    if not api_key or not username:
        logger.error("PROJECTX_API_KEY and PROJECTX_USERNAME required")
        return False

    try:
        # TODO: Replace with actual project-x-py auth call
        # from projectx import ProjectXClient
        # client = ProjectXClient()
        # result = await client.login(username=username, api_key=api_key)
        # _token = result.token
        # _account_id = result.accounts[0].id
        logger.info(f"ProjectX login successful for {username}")
        return True
    except Exception as e:
        logger.error(f"ProjectX login failed: {e}")
        return False


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


def is_authenticated() -> bool:
    """Check if we have a valid token."""
    return _token is not None and time.time() < _token_expiry
```

### 5. `execution-bridge/main.py`

The FastAPI application. **This is the core file.**

```python
"""
Fintheon Execution Bridge
FastAPI sidecar wrapping project-x-py for TopStepX order execution.

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

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

from models import (
    ExecuteRequest, ExecuteResponse, OrderStatus,
    PositionResponse, PositionItem, AccountResponse,
    HealthResponse, Direction,
)
from auth import login, is_authenticated, get_account_id

load_dotenv()
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "info").upper())
logger = logging.getLogger(__name__)


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
    Place an order via ProjectX.

    - entry_price=None → market order
    - entry_price set → limit order
    - Always tags orders with FINTHEON-AUTO-{timestamp}
    """
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated with ProjectX")

    account_id = await get_account_id()
    if not account_id:
        raise HTTPException(status_code=503, detail="No active account")

    tag = f"FINTHEON-AUTO-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    now = datetime.now(timezone.utc).isoformat()

    try:
        # TODO: Replace with actual project-x-py order placement
        # from projectx import ProjectXClient
        # client = ProjectXClient(token=get_token())
        #
        # If market order (entry_price is None):
        #   result = await client.place_market_order(
        #       account_id=account_id,
        #       symbol=req.symbol,
        #       side="Buy" if req.direction == Direction.long else "Sell",
        #       size=req.position_size,
        #       custom_tag=tag,
        #   )
        #
        # If limit order:
        #   result = await client.place_limit_order(
        #       account_id=account_id,
        #       symbol=req.symbol,
        #       side="Buy" if req.direction == Direction.long else "Sell",
        #       size=req.position_size,
        #       limit_price=req.entry_price,
        #       custom_tag=tag,
        #   )
        #
        # Also place bracket (SL/TP) if stop_loss_ticks or take_profit_ticks provided.

        # Scaffold response — replace with real SDK result
        order_id = f"PX-{tag.split('-')[-1]}"
        logger.info(f"Order placed: {order_id} | {req.direction.value} {req.position_size} {req.symbol} | tag={tag}")

        return ExecuteResponse(
            status=OrderStatus.filled,
            order_id=order_id,
            fill_price=req.entry_price,
            timestamp=now,
            message=f"Order {order_id} placed via ProjectX",
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
    """Get current open positions from ProjectX."""
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    account_id = await get_account_id()

    try:
        # TODO: Replace with actual project-x-py position query
        # client = ProjectXClient(token=get_token())
        # positions = await client.get_positions(account_id)
        # return PositionResponse(
        #     positions=[PositionItem(
        #         contract_id=p.contractId,
        #         symbol=p.contractId,  # map from contract to symbol
        #         direction=Direction.long if p.type == 1 else Direction.short,
        #         size=p.size,
        #         average_price=p.averagePrice,
        #         unrealized_pnl=0,  # calculate from current price
        #     ) for p in positions],
        #     account_id=str(account_id),
        # )

        return PositionResponse(positions=[], account_id=str(account_id or 0))
    except Exception as e:
        logger.error(f"Position query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/account", response_model=AccountResponse)
async def get_account():
    """Get account balance, buying power, PDPT status."""
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    account_id = await get_account_id()

    try:
        # TODO: Replace with actual project-x-py account query
        # client = ProjectXClient(token=get_token())
        # account = await client.get_account(account_id)
        # return AccountResponse(
        #     account_id=str(account.id),
        #     balance=account.balance,
        #     buying_power=account.balance,  # TopStep doesn't have margin concept
        #     can_trade=account.canTrade,
        #     pdpt_remaining=account.balance - 1500,  # PDPT floor
        # )

        return AccountResponse(
            account_id=str(account_id or 0),
            balance=0,
            buying_power=0,
            can_trade=False,
            pdpt_remaining=0,
        )
    except Exception as e:
        logger.error(f"Account query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cancel/{order_id}")
async def cancel_order(order_id: str):
    """Cancel an open order."""
    if not is_authenticated():
        raise HTTPException(status_code=503, detail="Bridge not authenticated")

    try:
        # TODO: Replace with actual project-x-py cancel
        # client = ProjectXClient(token=get_token())
        # await client.cancel_order(order_id)
        logger.info(f"Order {order_id} cancelled")
        return {"success": True, "order_id": order_id, "message": "Cancelled"}
    except Exception as e:
        logger.error(f"Cancel failed for {order_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Key Rules

1. **Read the project-x-py SDK docs before filling in the TODOs.** The scaffold above marks every SDK call with `# TODO: Replace with actual project-x-py ...`. Do NOT guess the SDK API — read the actual package.
2. **Tag every order** with `FINTHEON-AUTO-{timestamp}` so Fintheon orders are identifiable in the TopStepX account.
3. **Endpoint shapes must match the TypeScript types from T1** — `BridgeExecuteRequest`, `BridgeExecuteResponse`, etc. The Pydantic models in `models.py` mirror those exactly. Don't deviate.
4. **Auth on startup** — the `lifespan` handler authenticates on boot. If auth fails, the bridge runs in degraded mode (all endpoints return 503).
5. **Follow the rithmic-gateway convention** — JSON in/out, descriptive error messages, health endpoint that reflects real connectivity.

---

## Verification
1. `cd execution-bridge && pip install -r requirements.txt`
2. `cp .env.example .env` and fill in credentials
3. `uvicorn main:app --port 8001 --reload`
4. `curl localhost:8001/health` → returns JSON with connected status
5. `curl -X POST localhost:8001/execute -H 'Content-Type: application/json' -d '{"model":"40_40_club","direction":"long","symbol":"MNQ","confluence_score":9,"position_size":2,"entry_price":null,"stop_loss_ticks":12,"take_profit_ticks":24}'` → returns order response
6. `curl localhost:8001/position` → returns positions array
7. `curl localhost:8001/account` → returns account info

---

## Changelog Entry
```typescript
{ date: '2026-03-28T14:00:00', agent: 'claude-code', summary: 'S5-T2: Python FastAPI execution bridge wrapping project-x-py for TopStepX', files: ['execution-bridge/main.py', 'execution-bridge/auth.py', 'execution-bridge/models.py', 'execution-bridge/requirements.txt', 'execution-bridge/.env.example'] }
```

---

## DO NOT
- Do NOT modify any backend-hono TypeScript files (T1/T3/T4 own those)
- Do NOT implement the reconciler (T3 owns that)
- Do NOT create route handlers in the Hono backend (T4 owns that)
- Do NOT add database connections — the bridge is stateless; all state lives in the Hono backend
- Do NOT add WebSocket connections — REST only for now
