# S15-T2: Fintheon Polymarket Service + Context Bank

**Sprint:** S15 — Polymarket Integration  
**Track:** T2 of 2 (parallel with T1)  
**Scope:** Create read-only Polymarket service, wire context bank, register API routes  
**Depends on:** Nothing — runs independently

---

## Context

The Fintheon backend at `~/Documents/Codebases/fintheon/backend-hono/` has a fully-built Kalshi prediction market service but the Polymarket side is stub-only:

- Context bank returns `markets: []` for Polymarket (lines 223-227 of context-bank-service.ts)
- Types exist but are minimal (`PolymarketMarketSummary` has only 5 fields)
- Routes are documented in ENDPOINT-PARITY-MATRIX.md but NOT registered in routes/index.ts
- Migration `010_polymarket_predictions.sql` created the `polymarket_predictions` table — it exists in Supabase already

This track fills those stubs with a **read-only** Polymarket service using the public Gamma/CLOB/Data APIs (no auth needed). Polymarket data enriches the context bank for all agents.

**CRITICAL: This service is READ-ONLY. No wallet auth, no order placement, no trading. Polymarket data = research signal source for Kalshi trading decisions.**

---

## Files to Read First

Read these carefully — understand the patterns before writing code:

1. `backend-hono/src/services/kalshi-service.ts` — **YOUR TEMPLATE**. Mirror this pattern exactly. Factory function, normalize helpers, whale detection.
2. `backend-hono/src/services/context-bank/context-bank-service.ts` — The stub at lines 223-227 you're wiring up. Read the full file to understand the snapshot assembly pattern.
3. `backend-hono/src/types/context-bank.ts` — Existing `PolymarketContext` and `PolymarketMarketSummary` types (lines 151-162). You'll expand these.
4. `backend-hono/src/types/kalshi.ts` — Kalshi type definitions. Model your Polymarket types after this structure.
5. `backend-hono/src/routes/index.ts` — Route registration. You'll add your routes here.
6. `backend-hono/src/routes/context-bank/index.ts` — How context bank routes are structured.
7. `backend-hono/migrations/010_polymarket_predictions.sql` — Existing prediction tracking table schema.

---

## Task 1: Create Polymarket Types

**File to create:** `backend-hono/src/types/polymarket.ts`

Define the raw API response types and normalized types. Polymarket has 3 public APIs:

### Gamma API (gamma-api.polymarket.com) — Discovery/Search

```typescript
// Raw response from GET /events?closed=false&limit=20
export interface GammaRawEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  markets: GammaRawMarket[];
  start_date: string;
  end_date: string;
  created_at: string;
  active: boolean;
  closed: boolean;
  liquidity: string; // numeric string
  volume: string; // numeric string
  competitive: string; // numeric string, number of markets
}

export interface GammaRawMarket {
  id: string; // conditionId
  question: string;
  slug: string;
  conditionId: string;
  outcomes: string; // JSON-encoded: '["Yes","No"]'
  outcomePrices: string; // JSON-encoded: '["0.65","0.35"]'
  clobTokenIds: string; // JSON-encoded: '["token1","token2"]'
  volume: string; // numeric string (USDC)
  liquidity: string; // numeric string
  active: boolean;
  closed: boolean;
  end_date_iso: string;
  created_at: string;
  category: string; // e.g. "politics", "crypto", "sports"
}
```

### Normalized types

```typescript
export interface PolymarketMarket {
  conditionId: string;
  slug: string;
  question: string;
  category: string;
  status: "active" | "closed";
  yesPrice: number; // 0.00-1.00
  noPrice: number; // 0.00-1.00
  volume: number; // USDC
  liquidity: number; // USDC
  closeTime: string; // ISO
  clobTokenIds: [string, string]; // [yesToken, noToken]
  url: string;
}

export interface PolymarketTrade {
  id: string;
  conditionId: string;
  side: "YES" | "NO";
  size: number; // USDC
  price: number;
  createdAt: string;
}

export interface PolymarketWhaleAlert {
  id: string;
  conditionId: string;
  marketQuestion: string;
  category: string;
  side: "YES" | "NO";
  size: number;
  price: number;
  alertType: "absolute" | "notional";
  detectedAt: string;
}

export interface PolymarketMarketsResponse {
  markets: PolymarketMarket[];
  fetchedAt: string;
}

export interface PolymarketWhaleResponse {
  alerts: PolymarketWhaleAlert[];
  fetchedAt: string;
}
```

---

## Task 2: Create Polymarket Service

**File to create:** `backend-hono/src/services/polymarket-service.ts`

Mirror the `kalshi-service.ts` factory pattern exactly. Key differences:

- **No auth needed** — all Polymarket public APIs are unauthenticated
- **Double-encoded JSON fields** — `outcomePrices`, `outcomes`, `clobTokenIds` are JSON strings inside JSON responses. Must `JSON.parse()` them.
- **Three API bases** instead of one

```typescript
// Polymarket API bases (all public, no auth)
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

const WHALE_THRESHOLD_SIZE = 5000; // USDC
```

### Service methods to implement:

**`getMarkets(category?: string, limit?: number)`** — Fetch trending/active markets

- Endpoint: `GET ${GAMMA_API}/events?closed=false&limit=${limit}&active=true`
- If category: add `&tag=${category}` to filter
- Parse nested markets from events, normalize each via `normalizeMarket()`
- Sort by volume descending
- Return `PolymarketMarketsResponse`

**`getMarketBySlug(slug: string)`** — Single market detail

- Endpoint: `GET ${GAMMA_API}/markets?slug=${slug}`
- Returns array, take first match
- Normalize and return single `PolymarketMarket | null`

**`searchMarkets(query: string, limit?: number)`** — Text search

- Endpoint: `GET ${GAMMA_API}/markets?_q=${encodeURIComponent(query)}&closed=false&limit=${limit || 20}`
- Normalize results

**`getRecentTrades(conditionId: string, limit?: number)`** — Trade history

- Endpoint: `GET ${DATA_API}/trades?market=${conditionId}&limit=${limit || 100}`
- Normalize trades

**`getWhaleAlerts()`** — Large trade detection

- Fetch recent trades across top markets
- Filter trades where size >= WHALE_THRESHOLD_SIZE
- Cluster trades within 60s window (same as Kalshi pattern)
- Return `PolymarketWhaleResponse`

### Normalize helper:

```typescript
function normalizeMarket(raw: GammaRawMarket): PolymarketMarket {
  // CRITICAL: These fields are double-encoded JSON strings
  const prices = JSON.parse(raw.outcomePrices) as string[];
  const tokenIds = JSON.parse(raw.clobTokenIds) as string[];

  return {
    conditionId: raw.conditionId,
    slug: raw.slug,
    question: raw.question,
    category: raw.category || "unknown",
    status: raw.closed ? "closed" : "active",
    yesPrice: parseFloat(prices[0]),
    noPrice: parseFloat(prices[1]),
    volume: parseFloat(raw.volume),
    liquidity: parseFloat(raw.liquidity),
    closeTime: raw.end_date_iso,
    clobTokenIds: [tokenIds[0], tokenIds[1]],
    url: `https://polymarket.com/event/${raw.slug}`,
  };
}
```

### Fetch helper (simpler than Kalshi — no auth):

```typescript
async function polyFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[Polymarket] ${url} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[Polymarket] ${url} error:`, err);
    return null;
  }
}
```

Export the service as a factory function:

```typescript
export function createPolymarketService() {
  return {
    getMarkets,
    getMarketBySlug,
    searchMarkets,
    getRecentTrades,
    getWhaleAlerts,
  };
}
```

---

## Task 3: Expand Context Bank Types

**File to modify:** `backend-hono/src/types/context-bank.ts`

Expand `PolymarketMarketSummary` (lines 156-162):

```typescript
export interface PolymarketMarketSummary {
  id: string; // conditionId
  title: string; // market question
  probability: number; // yesPrice (0.00-1.00)
  outcome: string; // "Yes"
  closeTime?: string;
  // NEW FIELDS:
  volume24h?: number; // USDC
  liquidity?: number; // USDC
  category?: string; // e.g. "politics", "crypto"
  slug?: string; // URL slug for linking
}
```

---

## Task 4: Wire Context Bank

**File to modify:** `backend-hono/src/services/context-bank/context-bank-service.ts`

Replace the stub at lines 223-227:

```typescript
// BEFORE (stub):
// Polymarket / Kalshi removed (integrations not set up)
const polymarket: PolymarketContext = {
  markets: [],
  fetchedAt: now.toISOString(),
};
```

```typescript
// AFTER:
import { createPolymarketService } from "../polymarket-service.js";

// In the snapshot assembly function, replace the polymarket stub:
let polymarket: PolymarketContext;
try {
  const polyService = createPolymarketService();
  const polyData = await polyService.getMarkets(undefined, 10);
  polymarket = {
    markets: polyData.markets.map((m) => ({
      id: m.conditionId,
      title: m.question,
      probability: m.yesPrice,
      outcome: "Yes",
      closeTime: m.closeTime,
      volume24h: m.volume,
      liquidity: m.liquidity,
      category: m.category,
      slug: m.slug,
    })),
    fetchedAt: polyData.fetchedAt,
  };
} catch (err) {
  console.error("[ContextBank] Polymarket fetch failed:", err);
  polymarket = { markets: [], fetchedAt: now.toISOString() };
}
```

**Important:** Keep the Kalshi stub as-is (it already has its own service). Only replace the Polymarket stub.

Add the import at the top of the file with the other service imports.

---

## Task 5: Create Polymarket Routes

**File to create:** `backend-hono/src/routes/polymarket/index.ts`

```typescript
import { Hono } from "hono";
import { createPolymarketService } from "../../services/polymarket-service.js";

export function createPolymarketRoutes() {
  const app = new Hono();
  const polyService = createPolymarketService();

  // GET /api/polymarket/markets — trending/filtered markets
  app.get("/markets", async (c) => {
    const category = c.req.query("category");
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const data = await polyService.getMarkets(category, limit);
    return c.json(data);
  });

  // GET /api/polymarket/search — text search
  app.get("/search", async (c) => {
    const q = c.req.query("q");
    if (!q) return c.json({ error: "query parameter 'q' required" }, 400);
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const markets = await polyService.searchMarkets(q, limit);
    return c.json({ markets, fetchedAt: new Date().toISOString() });
  });

  // GET /api/polymarket/market/:slug — single market detail
  app.get("/market/:slug", async (c) => {
    const slug = c.req.param("slug");
    const market = await polyService.getMarketBySlug(slug);
    if (!market) return c.json({ error: "Market not found" }, 404);
    return c.json(market);
  });

  // GET /api/polymarket/whale-alerts — large trade detection
  app.get("/whale-alerts", async (c) => {
    const data = await polyService.getWhaleAlerts();
    return c.json(data);
  });

  return app;
}
```

---

## Task 6: Register Routes

**File to modify:** `backend-hono/src/routes/index.ts`

### 6a. Add import (with the other route imports at the top):

```typescript
import { createPolymarketRoutes } from "./polymarket/index.js";
```

### 6b. Add route registration in `registerRoutes()` function

Add in the public routes section (around line 109, near the predictions route):

```typescript
// Polymarket — read-only public market data, whale alerts, search (S15-T2)
app.route("/api/polymarket", createPolymarketRoutes());
```

---

## Task 7: Changelog Entry

**File to modify:** `src/lib/changelog.ts`

Add entry:

```typescript
{
  date: '2026-04-12T12:00:00',
  agent: 'claude-code',
  summary: 'S15-T2: Polymarket read-only service + context bank wiring. New /api/polymarket/* routes (markets, search, whale-alerts). Context bank now returns live Polymarket data instead of empty stub.',
  files: [
    'backend-hono/src/types/polymarket.ts',
    'backend-hono/src/services/polymarket-service.ts',
    'backend-hono/src/services/context-bank/context-bank-service.ts',
    'backend-hono/src/types/context-bank.ts',
    'backend-hono/src/routes/polymarket/index.ts',
    'backend-hono/src/routes/index.ts',
  ]
}
```

Also add comment at top of new files:

```typescript
// [claude-code 2026-04-12] S15-T2: Polymarket read-only service — public API data for research/signal enrichment
```

---

## Verification

1. **TypeScript check:**

   ```bash
   cd ~/Documents/Codebases/fintheon && npx tsc --noEmit 2>&1 | head -20
   ```

2. **Build:**

   ```bash
   cd ~/Documents/Codebases/fintheon && bun run build
   ```

3. **Backend restart + smoke test:**

   ```bash
   # Restart backend (launchd-managed)
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
   cd ~/Documents/Codebases/fintheon/backend-hono && bun run dev &

   # Wait for startup, then test
   sleep 3
   curl -s http://localhost:8080/api/polymarket/markets | head -200
   curl -s http://localhost:8080/api/polymarket/search?q=bitcoin | head -200
   curl -s http://localhost:8080/api/polymarket/whale-alerts | head -100

   # Context bank should now include polymarket data
   curl -s http://localhost:8080/api/context-bank/snapshot | jq '.polymarket'
   ```

4. **Verify context bank has data (not empty):**
   ```bash
   curl -s http://localhost:8080/api/context-bank/snapshot | jq '.polymarket.markets | length'
   # Should return > 0
   ```

---

## DO NOT

- Do NOT add any authentication/wallet/trading capabilities — this is READ-ONLY
- Do NOT modify kalshi-service.ts or any Kalshi types — leave those untouched
- Do NOT modify any Hermes files (~/.hermes/\*) — that's T1's scope
- Do NOT modify the Autopilot system (signal-processor, proposal-service) — that's Sprint S15-S3
- Do NOT modify frontend files (AquariumPredictionCards, etc.) — that's Sprint S15-S3
- Do NOT add Polymarket-specific env vars to .env — the APIs are public, no keys needed
- Do NOT create migrations — the polymarket_predictions table already exists
