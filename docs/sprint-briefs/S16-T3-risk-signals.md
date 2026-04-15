# Task Brief: S16-T3 — Risk Signals Implementation

**Date:** 2026-04-15
**Scope:** Build AI-refined Risk Signal cards from bulletins + catalyst watches. Backend generator + frontend component + Proposals panel integration. Do NOT touch Sanctum.tsx — wiring handled by T6 unification.
**Estimated files:** 4
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, no gradients/colored emojis).
- Build frontend: `cd ~/Documents/Codebases/fintheon && bun run build`
- Build backend: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`
- Backend is launchd-managed: restart with `launchctl unload/load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
- This track does NOT touch Sanctum.tsx — T6 unification handles all Sanctum wiring after all tracks land.

## Context

The Aquarium has no dedicated Risk Signal cards. "Live Risk Signals" on Page 2 currently shows raw `riskflowItems` via `SanctumRiskAssessment`. We need a new system: take Human Analysts Bulletins (from `peer_bulletin` table) and high-severity catalysts, AI-refine them, score them, and display as expandable cards in TWO locations: (1) the Agent Performance section on Sanctum Page 2, and (2) the existing Proposals pop-out panel in ConsiliumHub.

## Files to Read First

- `backend-hono/src/services/bulletin/bulletin-store.ts` — How bulletins are stored/fetched. In-memory fallback, Supabase `peer_bulletin` table.
- `backend-hono/src/types/bulletin.ts` — `BulletinPost` type, `BulletinVote` type.
- `backend-hono/src/services/systemic/risk-detector.ts` — `assessSystemicRisk()` — existing risk assessment infrastructure.
- `backend-hono/src/services/riskflow/aquarium-scheduler.ts` — Pattern for AI agent invocation + in-memory caching + scheduled generation.
- `backend-hono/src/services/strands/invoke-helper.ts` — `invokeAgent()` function for calling Strands agents.
- `backend-hono/src/config/catalyst-levels.ts` — Catalyst level definitions (1-4, with IV thresholds).
- `frontend/components/narrative/Sanctum.tsx` — Page 2 layout, Agent Performance section at lines 490-502.
- `frontend/components/proposals/ProposalWidget.tsx` — Existing proposals panel. Has toggle between "Proposals" and "Scorecards" views.
- `frontend/components/consilium/ConsiliumHub.tsx` — Line 818: `toggleProposals()` trigger for the panel.
- `frontend/components/narrative/AquariumPredictionCards.tsx` — Reference pattern for fetch/poll/cache/render lifecycle.

## What to Build/Change

### 1. Risk Signal Generator (Backend)

- **Path:** `backend-hono/src/services/riskflow/risk-signal-generator.ts`
- **Action:** Create
- **Spec:**
  - Define `RiskSignal` interface:
    ```typescript
    interface RiskSignal {
      id: string;
      title: string;
      summary: string; // AI-refined one-liner
      analysis: string; // Full AI analysis (shown on expand)
      score: number; // 0-10
      severity: "critical" | "high" | "medium" | "low";
      source: "bulletin" | "catalyst-watch" | "risk-detector";
      relatedHeadlines: string[];
      narrativeThreads: string[];
      generatedAt: string;
    }
    ```
  - `generateRiskSignals(): Promise<RiskSignal[]>`:
    - Fetch recent bulletins from `peer_bulletin` (last 24h) via bulletin-store
    - Fetch high-severity catalysts from `scored_riskflow_items` where `macro_level >= 3` (last 12h)
    - Fetch systemic risk assessment from `assessSystemicRisk()`
    - Combine and deduplicate source material
    - Run through `invokeAgent()` with a system prompt that instructs Herald to:
      - Refine each signal into a clear title + one-liner summary + full analysis
      - Score 0-10 based on market impact potential
      - Classify severity from score (>=8 critical, >=6 high, >=4 medium, else low)
      - Tag related narrative threads
    - Parse the AI response (expect JSON array)
  - 10-minute in-memory cache (`cachedSignals` + `cachedAt`)
  - `getRiskSignals(): Promise<RiskSignal[]>` — returns cached or generates fresh
  - **Max lines:** 200

### 2. Risk Signals API Route

- **Path:** `backend-hono/src/routes/riskflow/handlers.ts`
- **Action:** Modify
- **Spec:**
  - Add `handleGetRiskSignals(c: Context)` handler
  - Calls `getRiskSignals()` from risk-signal-generator
  - Returns `{ signals: RiskSignal[], generatedAt: string }`
  - Wire route in `backend-hono/src/routes/riskflow/index.ts` as `GET /api/riskflow/risk-signals`

### 3. RiskSignalCards Frontend Component

- **Path:** `frontend/components/narrative/RiskSignalCards.tsx`
- **Action:** Create
- **Spec:**
  - Fetch from `GET /api/riskflow/risk-signals` with 120s polling (visibility-gated via IntersectionObserver — set `root` to scroll container ref, NOT viewport default per memory rule)
  - localStorage cache key: `fintheon:risk-signals`
  - Render cards in a vertical stack
  - **Collapsed card**: severity-colored left border (2px), title, score badge (right-justified), source tag
  - **Expanded card** (click to toggle): full AI analysis, related headlines list, narrative thread tags
  - Score badge colors: >=8 red, >=6 orange, >=4 gold/accent, <4 muted
  - All colors via `var(--fintheon-*)` CSS vars
  - Accept optional `compact` prop for panel rendering (smaller text, tighter spacing)
  - **Max lines:** 250

### 4. Place in Proposals Panel (Sanctum.tsx placement handled by T6)

- **Path:** `frontend/components/proposals/ProposalWidget.tsx`
- **Action:** Modify
- **Spec:**
  - The ProposalWidget currently toggles between "Proposals" and "Scorecards" views
  - Add a third toggle option: "Risk Signals"
  - When "Risk Signals" is selected, render `<RiskSignalCards compact />`
  - Keep existing toggle UI pattern — just add one more option button

## Key Rules

- Follow the AquariumPredictionCards pattern for fetch/cache lifecycle
- IntersectionObserver must set `root` to scroll container ref (NOT viewport default — see memory rule `feedback_intersection_observer_root.md`)
- All colors via `var(--fintheon-*)` CSS variables, no hardcoded hex
- No gradients, no colored emojis
- The AI invocation in the generator should use the Herald agent (news & sentiment) for refining signals
- Backend must handle the case where no bulletins or catalysts exist gracefully (return empty array)

## DO NOT

- Touch `Sanctum.tsx` — T6 handles placing RiskSignalCards in Agent Performance section
- Replace or remove the existing `SanctumRiskAssessment` component in the "Live Risk Signals" panel — that stays as-is
- Modify the bulletin system or scoring system
- Add new npm dependencies
- Touch files outside the listed scope

## Verification

```bash
# Backend
cd ~/Documents/Codebases/fintheon/backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/riskflow/risk-signals | head -c 500

# Frontend
cd ~/Documents/Codebases/fintheon && bun run build
# Open ConsiliumHub → Proposals panel → verify "Risk Signals" toggle + cards
# Sanctum Page 2 placement verified in T6 unification
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T3: Risk Signals — AI-refined expandable cards from bulletins + catalyst watches. Backend generator with 10min cache, Herald AI scoring. Frontend cards in Agent Performance section (Page 2) and Proposals pop-out panel.',
  files: [
    'backend-hono/src/services/riskflow/risk-signal-generator.ts',
    'backend-hono/src/routes/riskflow/handlers.ts',
    'frontend/components/narrative/RiskSignalCards.tsx',
    'frontend/components/proposals/ProposalWidget.tsx'
  ]
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
