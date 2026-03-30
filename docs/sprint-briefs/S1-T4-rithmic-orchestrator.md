# Sprint 1 — Track 4: Rithmic Tick Stream + Engine Orchestrator

**Branch:** `v.8.25.4` (same branch as T1, merge after T1 completes)
**Depends on:** T1 must be complete (types.ts, tick-consolidator.ts, indicators.ts exist)
**Scope:** Extend the Rithmic Python sidecar for tick streaming, add WS consumer to Hono backend, create the engine orchestrator that wires everything together.

---

## CONTEXT

Read these files FIRST:
- `backend-hono/src/services/rithmic-service.ts` — EXISTING Rithmic HTTP bridge. EXTEND this, don't replace it.
- `backend-hono/src/services/algo-engine/types.ts` — T1's types (Tick, Bar, etc.)
- `backend-hono/src/services/algo-engine/tick-consolidator.ts` — T1's consolidator
- `backend-hono/src/services/algo-engine/indicators.ts` — T1's EMA, RSI, ATR
- `backend-hono/src/services/autopilot/autopilot-scheduler.ts` — RTH detection (reuse, don't rebuild)
- `CLAUDE.md` — project rules, changelog protocol

Check if a Rithmic Python sidecar already exists:
```bash
ls backend-hono/scripts/
ls -la *rithmic* *sidecar* *python*
```

If it doesn't exist yet, create the scaffolding. If it does, extend it.

---

## PART 1: Rithmic Python Sidecar Extension

### What it does
The sidecar connects to Rithmic's Protocol Buffer API (via `async_rithmic` Python library), subscribes to /MNQ and /ES tick data, and streams it over WebSocket to the Hono backend.

### File: `backend-hono/scripts/rithmic-tick-sidecar.py`

```python
# Dependencies: async_rithmic, websockets, asyncio, json

# WebSocket server on port 3002
# Endpoint: ws://localhost:3002/ws/ticks

# Tick event format (JSON):
{
    "type": "tick",
    "instrument": "MNQ",  // or "ES"
    "price": 24150.25,
    "volume": 1,
    "bid": 24150.00,
    "ask": 24150.50,
    "timestamp": 1711497600000  // unix ms
}

# Heartbeat every 5s:
{
    "type": "heartbeat",
    "timestamp": 1711497600000
}

# Connection status:
{
    "type": "status",
    "connected": true,
    "instruments": ["MNQ", "ES"]
}

# Error:
{
    "type": "error",
    "message": "Rithmic disconnected",
    "code": "RITHMIC_DISCONNECT"
}
```

**Requirements:**
- Subscribe to both /MNQ and /ES tick data
- Stream all ticks as JSON over WebSocket
- Heartbeat every 5 seconds (so the consumer knows the connection is alive)
- Reconnect logic: if Rithmic disconnects, attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Graceful shutdown on SIGINT/SIGTERM
- Log connection status changes

**async_rithmic usage:**
```python
import async_rithmic

# Connect
client = async_rithmic.RithmicClient(
    server_name="TopStepX",
    credentials_path="./rithmic_credentials.json"  # or env vars
)

# Subscribe to tick data
await client.subscribe_to_market_data(
    symbols=["MNQ", "ES"],
    data_type="tick"
)

# Stream ticks
async for tick in client.tick_stream():
    # Forward to WebSocket clients
    await ws.send(json.dumps({
        "type": "tick",
        "instrument": tick.symbol,
        "price": tick.price,
        "volume": tick.volume,
        "bid": tick.bid,
        "ask": tick.ask,
        "timestamp": int(tick.timestamp.timestamp() * 1000)
    }))
```

Note: The exact `async_rithmic` API may differ. Check the library docs. If it doesn't exist as a pip package, check if there's a local implementation or if we need to use the raw Rithmic Protocol Buffer API.

### `backend-hono/scripts/requirements.txt`
```
async_rithmic>=0.1.0
websockets>=12.0
```

---

## PART 2: Hono Backend WS Consumer

### Modify: `backend-hono/src/services/rithmic-service.ts`

Add a WebSocket consumer that connects to the sidecar and routes ticks to consolidators.

```typescript
import { Tick } from './algo-engine/types';
import { TickConsolidator } from './algo-engine/tick-consolidator';

class RithmicTickConsumer {
  private ws: WebSocket | null = null;
  private nqConsolidator: TickConsolidator;
  private esConsolidator: TickConsolidator;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000;
  private heartbeatTimeout: NodeJS.Timeout | null = null;

  constructor(
    private sidecarUrl: string = 'ws://localhost:3002/ws/ticks',
    onNqBar: (bar: Bar) => void,
    onEsBar: (bar: Bar) => void
  ) {
    this.nqConsolidator = new TickConsolidator(1000, onNqBar);  // 1000T for NQ
    this.esConsolidator = new TickConsolidator(500, onEsBar);   // 500T for ES
  }

  async connect(): Promise<void>;
  private handleMessage(data: string): void;
  private routeTick(tick: Tick): void;        // NQ → nqConsolidator, ES → esConsolidator
  private handleHeartbeat(): void;            // reset heartbeat timeout
  private handleDisconnect(): void;           // attempt reconnect
  private reconnect(): Promise<void>;         // exponential backoff
  async disconnect(): Promise<void>;

  get isConnected(): boolean;
  get ticksReceived(): { nq: number; es: number };
}
```

---

## PART 3: Engine Orchestrator

### Create: `backend-hono/src/services/algo-engine/index.ts`

This is the main entry point that wires everything together. It receives consolidated bars and routes them through the intelligence layer and model.

```typescript
import { Bar, Position, EntrySignal, ExitSignal } from './types';
import { EMA, RSI, ATR } from './indicators';
import { RollingWindow } from './rolling-window';

// These will be imported from T2 and T3 when they're done
// For now, define the interfaces they'll implement
import type { FortyFortyClub } from './forty-forty-club';
import type { AntilagDetector } from './antilag';
import type { FibEngine } from './fib-engine';
import type { ConfluenceScorer } from './confluence';
import type { TrailingStop } from './trailing-stop';
import type { AccessDeniedDetector } from './access-denied';
import type { ScaleInManager } from './scale-in';
import type { ExitLogic } from './exit-logic';
import type { PDPTTracker } from './pdpt-tracker';

interface AlgoEngineConfig {
  mode: 'paper' | 'live';
  pdptMode: 'combine' | 'funded';
  autoExecuteThreshold: number;  // confluence score >= this → auto-execute
}

class AlgoEngine {
  // Indicators (one set per instrument)
  private nqEma20: EMA;
  private nqEma100: EMA;
  private nqRsi: RSI;
  private nqAtr: ATR;
  private esEma20: EMA;
  private esEma100: EMA;

  // Recent bars
  private nqBars: RollingWindow<Bar>;
  private esBars: RollingWindow<Bar>;

  // Modules (from T2 and T3)
  private antilag: AntilagDetector;
  private fibEngine: FibEngine;
  private confluence: ConfluenceScorer;
  private model: FortyFortyClub;
  private trailingStop: TrailingStop | null = null;
  private accessDenied: AccessDeniedDetector;
  private scaleIn: ScaleInManager | null = null;
  private exitLogic: ExitLogic;
  private pdpt: PDPTTracker;

  // State
  private position: Position | null = null;
  private enabled: boolean = false;

  // Event emitters
  private onSignal: (signal: EntrySignal) => void;
  private onExit: (signal: ExitSignal) => void;
  private onStateChange: (state: EngineState) => void;

  constructor(config: AlgoEngineConfig);

  // Called by RithmicTickConsumer via consolidator callbacks
  onNqBar(bar: Bar): void {
    // 1. Update NQ indicators (EMA20, EMA100, RSI, ATR)
    // 2. Update Antilag detector
    // 3. Update Fib engine
    // 4. If no position → check entry (model.checkEntry)
    // 5. If position → check:
    //    a. Access Denied pattern
    //    b. Scale-in opportunity
    //    c. Trailing stop update
    //    d. Exit conditions
    // 6. Emit signals
  }

  onEsBar(bar: Bar): void {
    // 1. Update ES indicators
    // 2. Update Antilag detector (ES side)
    // 3. (ES doesn't trigger entries directly — just updates state for NQ to read)
  }

  // Control
  start(): void;
  stop(): void;
  get state(): EngineState;

  // Daily reset (called at RTH open)
  resetDaily(): void;
}

interface EngineState {
  enabled: boolean;
  connected: boolean;
  position: Position | null;
  dailyPnL: number;
  pdptRemaining: number;
  lastSignal: EntrySignal | ExitSignal | null;
  indicatorState: {
    nqEma20: number;
    nqEma100: number;
    nqRsi: number;
    nqAtr: number;
    esEma20: number;
    esEma100: number;
  };
  barsProcessed: { nq: number; es: number };
}

export { AlgoEngine, AlgoEngineConfig, EngineState };
```

**The key flow:**
```
Raw ticks (from sidecar WS)
  → TickConsolidator (1000T NQ / 500T ES)
    → AlgoEngine.onNqBar() / onEsBar()
      → Update indicators
      → Check Antilag
      → Check entry / manage position
        → Emit signals to proposal pipeline
```

---

## VERIFICATION

1. Sidecar Python file exists and has correct structure
2. `backend-hono/src/services/rithmic-service.ts` has the WS consumer added
3. `backend-hono/src/services/algo-engine/index.ts` imports resolve (may need type-only imports until T2/T3 complete)
4. `npx tsc --noEmit` passes
5. The orchestrator's `onNqBar` flow matches the strategy doc sequence

## CHANGELOG

```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: '[S1-T4] Rithmic tick sidecar + WS consumer + engine orchestrator', files: ['backend-hono/scripts/rithmic-tick-sidecar.py', 'backend-hono/scripts/requirements.txt', 'backend-hono/src/services/rithmic-service.ts', 'backend-hono/src/services/algo-engine/index.ts'] }
```

## DO NOT

- Implement Antilag, Fib, or model logic (that's T2/T3) — import their types only
- Create test files (Sprint 2)
- Touch frontend files
- Modify the existing HTTP bridge in rithmic-service.ts — ADD the WS consumer alongside it
- Delete the QC Python files (that's Sprint 3)
- Wire to agent pipeline or proposals (Sprint 3)
