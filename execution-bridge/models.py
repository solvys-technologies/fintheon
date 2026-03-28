# [claude-code 2026-03-28] S5-T2: Pydantic models matching T1 TypeScript contracts
"""
Execution Bridge — Pydantic Models
Mirror of backend-hono/src/types/execution-bridge.ts
"""

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
