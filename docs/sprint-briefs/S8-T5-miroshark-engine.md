# S8-T5: MiroShark Engine (Gov Officials + Deliberation Pipeline)

**Sprint**: S8 — The Mega Sprint
**Track**: T5 (after T1)
**Branch**: `v.8.28.1`

## Context
MiroFish is being fully replaced by MiroShark. Not just a rename — the 5 debate agents (Oracle, Feucht, Consul, Herald, Contrarian) are replaced by government official personas (Fed Chair, Trump, Bessent, Rubio, Lutnick, Witkoff, Greer, Navarro). MiroShark output then gets deliberated by Hermes agents, and finally scored/decided by Harper-Opus (Claude CLI). A new slide-out panel shows the full debate/deliberation/scoring chain.

## Files to Read First
- `backend-hono/src/services/mirofish/mirofish-service.ts` (446 lines) — simulation lifecycle, `startPrediction()`
- `backend-hono/src/services/mirofish/mirofish-client.ts` (424 lines) — 5-agent debate engine, weighted consensus
- `backend-hono/src/services/mirofish/mirofish-briefing.ts` (170 lines) — deterministic text gen
- `backend-hono/src/services/mirofish/mirofish-context.ts` (133 lines) — live context assembly (VIX, FRED, RiskFlow)
- `backend-hono/src/services/mirofish/mirofish-types.ts` (257 lines) — all types
- `backend-hono/src/services/mirofish/mirofish-seed.ts` (190 lines) — narrative conversion
- `backend-hono/src/services/mirofish/mirofish-reactive.ts` (148 lines) — running state
- `backend-hono/src/routes/mirofish/` — all route handlers
- `backend-hono/src/routes/index.ts` (line 83) — route mount
- `backend-hono/src/services/hermes-service.ts` — Hermes agent definitions, model routing
- `backend-hono/src/services/hermes-handler.ts` — chat handling
- `frontend/lib/services.ts` — MiroFish service references
- `frontend/components/consilium/ConsiliumHub.tsx` — `handleRunMiroFish()`
- `frontend/components/proposals/ProposalWidget.tsx` — slide-out panel architecture reference
- `frontend/lib/apiClient.ts` (line 149) — public endpoint exemption `/api/mirofish/`

## Files to Rename
- `backend-hono/src/services/mirofish/` → `backend-hono/src/services/miroshark/`
- Every file inside: `mirofish-*.ts` → `miroshark-*.ts`
- `backend-hono/src/routes/mirofish/` → `backend-hono/src/routes/miroshark/`

## Files to Create
- `frontend/components/miroshark/MiroSharkDebatePanel.tsx` (<250 lines) — slide-out debate summary

## Files to Modify
- All renamed backend files (internal references)
- `backend-hono/src/routes/index.ts` — mount `/api/miroshark`
- `frontend/lib/services.ts` — rename service references
- `frontend/lib/apiClient.ts` — update exemption path
- `frontend/components/consilium/ConsiliumHub.tsx` — rename handler + wire slide-out
- `frontend/components/narrative/Sanctum.tsx` — update references
- `frontend/components/narrative/SanctumHeader.tsx` — update labels

## Implementation

### 1. Full Rename (MiroFish → MiroShark)
Rename every file, every import, every route, every UI label. Grep for `mirofish` (case-insensitive) across the entire codebase and replace. Key locations:
- Backend routes: `/api/mirofish/*` → `/api/miroshark/*`
- Feature flag: `FINTHEON_FEATURE_FLAGS` key `mirofish` → `miroshark`
- Frontend services: `MirofishService` → `MirosharkService`
- UI labels: "MiroFish" → "MiroShark" wherever displayed
- Supabase table `mirofish_runs`: keep the table name but update code references (avoid migration)
- apiClient exemption: `/api/mirofish/` → `/api/miroshark/`

### 2. Government Official Agents
Replace the 5 debate agents in `miroshark-client.ts` with:

| Agent | Role | Weight | Worldview |
|-------|------|--------|-----------|
| Fed Chair | Data-dependent central banker | 1.0 | Dual mandate, forward guidance, dot plot messaging |
| Trump | Executive, dealmaker | 1.0 | Tariff hawk, unpredictable escalation, "art of the deal" |
| Bessent | Treasury Secretary | 1.0 | Fiscal discipline, bond market stability, deficit awareness |
| Rubio | Foreign policy, Senator | 0.8 | China hawk, human rights, geopolitical hardliner |
| Lutnick | Commerce Secretary | 0.8 | Trade enforcement, domestic manufacturing |
| Witkoff | Middle East envoy | 0.7 | De-escalation, diplomatic channels, ceasefire broker |
| Greer | US Trade Rep | 0.8 | Tariff implementation, trade deal execution |
| Navarro | Trade advisor | 0.7 | Protectionist, manufacturing onshoring, anti-China |

**Hybrid worldview system:**
- Each agent has a baked-in base system prompt reflecting their known position
- On simulation start, augment with latest 14-day RiskFlow headlines tagged to that official (fetch from `scored_riskflow_items` where headline mentions the official's name)
- Headlines older than 14 days are excluded (14d decay)
- If no recent headlines, fall back to baked-in worldview only

### 3. Deliberation Pipeline
Three-phase auto-with-interrupt flow:

**Phase 1 — MiroShark Simulation:**
- All gov official agents run in parallel (existing `Promise.allSettled` pattern)
- Each produces: assessment text, confidence score, key concern, recommended action
- Output: `MiroSharkSimulationResult` with per-agent responses

**Phase 2 — Hermes Deliberation:**
- Pass MiroShark results to existing Hermes agents (Oracle, Feucht, Consul, Herald)
- Each Hermes agent evaluates the gov officials' outputs and provides their take
- Consensus detection: if Hermes agents agree with MiroShark majority → high confidence
- Divergence: if Hermes agents disagree → flag as "contested thesis"

**Phase 3 — Harper-Opus Scoring:**
- Claude CLI (Opus) receives: MiroShark results + Hermes deliberation
- Scores the combined output: composite IV, regime shift probability, category scores
- Decides: which theses to surface, which to downgrade, final briefing text
- Places results on backend (Supabase) + frontend (via WebSocket/SSE push)

**Interrupt mechanism:**
- After each phase, results are visible in the debate slide-out panel
- User can click "Inject Take" button to add their own assessment before next phase proceeds
- Flow pauses until user submits or clicks "Continue"
- Interrupt only available in the slide-out panel, NOT in the main Aquarium view

### 4. Scoring Model Improvements
In Phase 3 (Harper-Opus scoring):
- **Confidence-weighted consensus**: Agents expressing higher confidence get more weight
- **Divergence detection**: When agents strongly disagree, flag as "contested thesis" instead of averaging
- **Actionability score**: How tradeable is this insight (time horizon, instrument specificity, entry/exit clarity)
- **Regime awareness**: Scoring adjusts based on current market regime from regime tracker

### 5. MiroShark Debate Slide-Out Panel
Same architecture as `ProposalWidget.tsx` (slide-out from right side):
- **Header**: "MiroShark Deliberation" with status indicator (running/complete)
- **Phase 1 section**: Each gov official's assessment as expandable cards (name, role, key quote, confidence)
- **Phase 2 section**: Hermes agent reactions (agree/disagree/nuance for each)
- **Phase 3 section**: Harper-Opus final scoring with rationale text
- **Interrupt button**: "Inject Your Take" → text input that feeds into next phase
- **Timeline**: Visual progression showing which phase is active
- Trigger: button in ConsiliumHub header or Aquarium "Update" flow

## Verification
1. `bun run build` — clean
2. `grep -ri "mirofish" --include="*.ts" --include="*.tsx" backend-hono/ frontend/` returns 0 results (except Supabase table name)
3. `curl localhost:8080/api/miroshark/latest` — returns cached report
4. `curl localhost:8080/api/miroshark/context` — returns VIX, FRED, RiskFlow data
5. Click "Update" in Aquarium → simulation runs → debate panel shows 3 phases
6. Each phase shows agent outputs
7. Interrupt works: injecting text pauses flow
8. Feature flag `miroshark: true` in `.env`

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T5: MiroFish→MiroShark full replacement, gov official agents (8 personas), 3-phase deliberation pipeline, debate slide-out panel, scoring improvements', files: ['backend-hono/src/services/miroshark/', 'backend-hono/src/routes/miroshark/', 'frontend/components/miroshark/MiroSharkDebatePanel.tsx', 'frontend/lib/services.ts', 'frontend/components/consilium/ConsiliumHub.tsx'] }
```

## DO NOT
- Do NOT fix the ERROR badge logic (T1 handles that)
- Do NOT touch NarrativeFlow (T2/T3 own that)
- Do NOT modify CategoryScoreCard (T4 owns that)
- Do NOT modify Ask Harp chat UI (T7 owns that)
