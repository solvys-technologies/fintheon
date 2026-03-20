"""
Rithmic Gateway — Python sidecar for Pulse
Wraps async_rithmic to expose a simple HTTP API for the Hono backend.

Start: uvicorn gateway:app --host 0.0.0.0 --port 3002
Env:
  RITHMIC_USER         Rithmic username
  RITHMIC_PASSWORD     Rithmic password
  RITHMIC_SYSTEM_NAME  e.g. "Rithmic Paper Trading" or "TopstepX"
  RITHMIC_URI          wss://rituz00100.rithmic.com:443/... (from Rithmic)
  GATEWAY_PORT         default 3002
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from async_rithmic import (
    RithmicClient,
    InfraType,
    RequestNewOrder,
    SideType,
    OrderType,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rithmic-gateway")

# ─── State ────────────────────────────────────────────────────────────────────

client: Optional[RithmicClient] = None
connected: bool = False
_reconnect_task: Optional[asyncio.Task] = None

RITHMIC_USER = os.getenv("RITHMIC_USER", "")
RITHMIC_PASSWORD = os.getenv("RITHMIC_PASSWORD", "")
RITHMIC_SYSTEM_NAME = os.getenv("RITHMIC_SYSTEM_NAME", "Rithmic Paper Trading")
RITHMIC_URI = os.getenv("RITHMIC_URI", "")


async def connect_rithmic():
    """Connect (or reconnect) to Rithmic ORDER_PLANT."""
    global client, connected

    if not RITHMIC_USER or not RITHMIC_PASSWORD or not RITHMIC_URI:
        log.warning("Rithmic credentials not set — gateway running in offline mode")
        return

    try:
        log.info("Connecting to Rithmic ORDER_PLANT...")
        client = RithmicClient(
            user=RITHMIC_USER,
            password=RITHMIC_PASSWORD,
            system_name=RITHMIC_SYSTEM_NAME,
            uri=RITHMIC_URI,
        )
        await client.connect(InfraType.ORDER_PLANT)
        connected = True
        log.info("Rithmic ORDER_PLANT connected ✓")
    except Exception as exc:
        connected = False
        log.error("Rithmic connection failed: %s", exc)


async def reconnect_loop():
    """Reconnect every 30 seconds while disconnected."""
    while True:
        if not connected:
            await connect_rithmic()
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _reconnect_task
    await connect_rithmic()
    _reconnect_task = asyncio.create_task(reconnect_loop())
    yield
    if _reconnect_task:
        _reconnect_task.cancel()
    if client:
        try:
            await client.disconnect()
        except Exception:
            pass


app = FastAPI(title="Rithmic Gateway", version="1.0.0", lifespan=lifespan)


# ─── Request / Response models ─────────────────────────────────────────────────

class PlaceOrderRequest(BaseModel):
    symbol: str            # e.g. "MNQ" or "ES"
    exchange: str = "CME"  # default CME Globex
    side: str              # "buy" or "sell"
    quantity: int = 1
    order_type: str = "market"   # "market" | "limit"
    limit_price: Optional[float] = None
    account_id: Optional[str] = None
    tag: Optional[str] = None    # custom tag for tracking


class PlaceOrderResponse(BaseModel):
    success: bool
    order_id: Optional[str] = None
    message: str
    ts: float = 0.0


class StatusResponse(BaseModel):
    connected: bool
    system_name: str
    user: str
    message: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/status", response_model=StatusResponse)
async def get_status():
    return StatusResponse(
        connected=connected,
        system_name=RITHMIC_SYSTEM_NAME,
        user=RITHMIC_USER or "(not set)",
        message="Connected to Rithmic ORDER_PLANT" if connected else "Disconnected — check credentials/URI",
    )


@app.post("/order/place", response_model=PlaceOrderResponse)
async def place_order(req: PlaceOrderRequest):
    if not connected or client is None:
        raise HTTPException(status_code=503, detail="Rithmic not connected")

    side = SideType.BUY if req.side.lower() == "buy" else SideType.SELL
    o_type = OrderType.MARKET if req.order_type == "market" else OrderType.LIMIT

    try:
        order_req = RequestNewOrder(
            symbol=req.symbol,
            exchange=req.exchange,
            quantity=req.quantity,
            side=side,
            order_type=o_type,
            limit_price=req.limit_price,
            account_id=req.account_id,
            user_tag=req.tag or f"PULSE-{int(time.time())}",
        )
        response = await client.send_and_recv_plant(InfraType.ORDER_PLANT, order_req)

        order_id = getattr(response, "basket_id", None) or getattr(response, "order_id", None)
        log.info("Order placed: %s %s %s x%d → id=%s", req.side, req.quantity, req.symbol, req.quantity, order_id)

        return PlaceOrderResponse(
            success=True,
            order_id=str(order_id) if order_id else None,
            message=f"Order accepted — {req.quantity} {req.symbol} {req.side.upper()} @ {'Market' if o_type == OrderType.MARKET else req.limit_price}",
            ts=time.time(),
        )

    except Exception as exc:
        log.error("Order placement error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/reconnect")
async def reconnect():
    """Force a reconnect — useful after credential changes."""
    global connected
    connected = False
    await connect_rithmic()
    return {"connected": connected}


# ─── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("GATEWAY_PORT", "3002"))
    uvicorn.run("gateway:app", host="0.0.0.0", port=port, reload=False)
