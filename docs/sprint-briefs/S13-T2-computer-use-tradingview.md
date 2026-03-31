# S13-T2: Claude Computer Use + TradingView Trade Plan Skill

> **Sprint:** S13 | **Track:** T2 of 3 | **Depends on:** S12 (Sprint 2) complete | **Branch:** `v.8.28.1`

## Objective

When a bulletin post gets voted into a proposal (Sprint 2 auto-promotion), AI generates entry points, stop loss, and take profit levels by using Claude Computer Use to view the instrument on TradingView, analyze the chart, and produce a structured trade plan. This is implemented as a skill file that the Claude CLI session manager can invoke.

---

## Files to Read First

- `backend-hono/src/services/autopilot/proposal-service.ts` — `StoredProposal`, `createProposalFromBulletin()` (from Sprint 2). The trade plan enriches an existing proposal.
- `backend-hono/src/services/claude-sdk/session-manager.ts` — `sendPromptSync()` — how to invoke Claude CLI with prompts
- `backend-hono/src/services/claude-sdk/process-manager.ts` — `spawnClaudeProcess()`, `ClaudeSDKConfig` — model selection, tool permissions
- `backend-hono/src/types/agents.ts` — `TradingProposal` type with entry/stop/TP fields
- `backend-hono/src/types/bulletin.ts` — `BulletinPost` (from Sprint 2)
- `backend-hono/src/services/bulletin/vote-counter.ts` — `promoteBulletinToProposal()` — the trigger point

---

## Backend: New Files

### `backend-hono/src/services/skills/tradingview-trade-plan.ts` (~200 lines)

This service orchestrates Claude Computer Use to analyze a TradingView chart and produce a trade plan.

```typescript
interface TradePlan {
  instrument: string
  direction: 'long' | 'short'
  entryPrice: number
  stopLoss: number
  takeProfitLevels: number[]     // up to 3 TP levels
  riskRewardRatio: number
  timeframe: string              // e.g., '4H', '1D', '15m'
  keyLevels: Array<{ label: string; price: number }>
  chartAnalysis: string          // Claude's written analysis
  confidence: number             // 0-100
  screenshotBase64?: string      // optional chart screenshot
}
```

Exports:
- `generateTradePlan(instrument: string, direction: 'long' | 'short', context?: string): Promise<TradePlan | null>`
  1. Build prompt for Claude CLI with Computer Use enabled:
     - "Open TradingView, navigate to [instrument] on the [timeframe] chart"
     - "Identify key support/resistance levels, trend direction, and volume profile"
     - "Generate entry price, stop loss, and up to 3 take profit levels"
     - "Return structured JSON with your analysis"
  2. Invoke via `getSessionManager().sendPromptSync(prompt, { model: 'claude-sonnet-4-5-20250514', allowedTools: ['computer'] })`
  3. Parse response for structured TradePlan JSON
  4. Return null if Computer Use unavailable or parsing fails (graceful degradation)

- `enrichProposalWithTradePlan(proposalId: string, plan: TradePlan): Promise<StoredProposal | null>`
  - Updates the existing StoredProposal with entry, stop, TP, keyLevels from the plan
  - Updates confidence score
  - Stores chart analysis in `analystInputs`

- `isComputerUseAvailable(): boolean`
  - Checks if Claude CLI supports computer use (version check + env `ENABLE_COMPUTER_USE=true`)

### `backend-hono/src/routes/skills/index.ts` (~60 lines)

```
POST   /api/skills/trade-plan           — generate trade plan (body: { instrument, direction, context? })
POST   /api/skills/trade-plan/enrich    — enrich existing proposal (body: { proposalId })
GET    /api/skills/trade-plan/status    — check if Computer Use is available
```

---

## Backend: Files to Modify

### `backend-hono/src/services/bulletin/vote-counter.ts` (Sprint 2 file)

After `promoteBulletinToProposal()` succeeds, optionally trigger trade plan generation:
```typescript
import { generateTradePlan, enrichProposalWithTradePlan, isComputerUseAvailable } from '../skills/tradingview-trade-plan.js'

// After promotion:
if (isComputerUseAvailable() && proposal.instrument !== 'UNKNOWN') {
  // Fire-and-forget — don't block the promotion
  generateTradePlan(proposal.instrument, proposal.direction as 'long' | 'short', bulletin.content)
    .then(plan => {
      if (plan) enrichProposalWithTradePlan(proposal.id, plan)
    })
    .catch(err => log.warn('Trade plan generation failed (non-fatal)', { error: String(err) }))
}
```

### `backend-hono/src/routes/index.ts`

Mount skills routes:
```typescript
import { createSkillsRoutes } from './skills/index.js'
app.route('/api/skills', createSkillsRoutes())
```

### `backend-hono/src/boot/index.ts`

Log Computer Use availability on boot:
```typescript
import { isComputerUseAvailable } from '../services/skills/tradingview-trade-plan.js'
log.info(`Computer Use: ${isComputerUseAvailable() ? 'available' : 'not configured (set ENABLE_COMPUTER_USE=true)'}`)
```

---

## Frontend: New Files

### `frontend/components/proposals/TradePlanCard.tsx` (~120 lines)

Displays the generated trade plan for a proposal:
- Instrument + direction header
- Entry, Stop Loss, TP1/TP2/TP3 as a vertical level list
- Risk:Reward ratio badge
- Key levels table
- Chart analysis text (collapsible)
- Confidence meter (0-100 bar)
- "Regenerate Plan" button → POST `/api/skills/trade-plan/enrich`
- Chart screenshot (if available, displayed as image)
- Solvys Gold theme

### `frontend/components/proposals/TradePlanStatus.tsx` (~40 lines)

Small status indicator shown on proposal cards:
- "Trade Plan: Generating..." (spinner)
- "Trade Plan: Ready" (gold checkmark)
- "Trade Plan: Unavailable" (gray, Computer Use not configured)

---

## Frontend: Files to Modify

### Wherever proposals are displayed (Strategium/proposals panel)

Add TradePlanCard below the existing proposal details when a trade plan exists. Show TradePlanStatus on proposal list cards.

### `frontend/lib/services.ts` — ADD to existing services

```typescript
// Skills/Trade Plan
async generateTradePlan(data: { instrument: string; direction: string; context?: string }): Promise<{ plan: TradePlan | null }>
async enrichProposal(proposalId: string): Promise<{ proposal: StoredProposal }>
async getTradePlanStatus(): Promise<{ available: boolean }>
```

---

## Environment Variables

```
ENABLE_COMPUTER_USE=true    # Enable Claude Computer Use for trade plan generation
```

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. GET `/api/skills/trade-plan/status` returns `{ available: true/false }`
4. POST `/api/skills/trade-plan` with `{ instrument: 'AAPL', direction: 'long' }` returns a TradePlan (if Computer Use available)
5. When Computer Use unavailable, returns graceful null (no crash)
6. TradePlanCard renders entry/stop/TP levels
7. After bulletin promotion, trade plan auto-generates (fire-and-forget)
8. Proposal in Strategium shows TradePlanStatus badge

## Changelog

```typescript
{ date: '2026-04-01T...', agent: 'claude-code', summary: 'S13-T2: Claude Computer Use + TradingView trade plan skill — auto-generates entry/stop/TP for voted proposals', files: ['backend-hono/src/services/skills/tradingview-trade-plan.ts', 'backend-hono/src/routes/skills/', 'frontend/components/proposals/TradePlanCard.tsx', 'frontend/components/proposals/TradePlanStatus.tsx'] }
```

## DO NOT

- Do NOT modify existing proposal display — only ADD TradePlanCard alongside it
- Do NOT make Computer Use required — always graceful degradation
- Do NOT create scoring/rotation or doc editor files
- Do NOT modify the Claude CLI session manager — use it as-is via `sendPromptSync()`
- Do NOT install Playwright or browser automation — Claude Computer Use handles the browser
