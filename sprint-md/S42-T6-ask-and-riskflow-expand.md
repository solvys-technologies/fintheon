# Sprint Brief: S42-T6 — "Ask About This" + RiskFlow Expanded Card Refactor

## Context

Brotzky principle: "I get annoyed when I have to open an app because AI can't complete the flow." Every Fintheon output surface (Arbitrum verdict, Sanctum narrative, TradePlan, Regime card, Catalyst card, every Strategium card) currently has zero chat entry — the user can't ask "why did seat X dissent?" or "explain this narrative." This track adds an "Ask about this" affordance to every output card. Click → chat panel opens with that surface auto-injected as context (`{type:"context", surface, payload}` to harper-handler).

**Scope expansion (per R2):** RiskFlow expanded cards (mobile `RiskFlowCardExpanded.tsx` + desktop `AlertCardBase.tsx` expanded mode) get a refactor — Ask AI affordance + visual cleanup. This is the ONLY allowed change to the RiskFlow surface (ingest/scoring/IV pipeline untouched).

## Branch Target

`s42-t6-ask` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Shared primitive

- [ ] NEW `frontend/components/chat/AskAboutThis.tsx` — icon button (lucide `MessageSquare`), hover-revealed on cards, opens chat with auto-injected surface context
- [ ] Mobile equivalent `mobile/components/chat/AskAboutThis.tsx` (likely identical) — or share via a common path if `mobile/` and `frontend/` import from a shared dir; otherwise mirror

### Web output surfaces — add Ask button

- [ ] `frontend/components/arbitrum/ArbitrumChamber.tsx` — Ask button on the verdict header; payload includes verdict id
- [ ] `frontend/components/narrative/Sanctum.tsx` — Ask button per Sanctum card (Briefing / Narratives / Risk / Aquarium / Forecast / Trades / VIX); payload identifies the card type + current data
- [ ] `frontend/components/proposals/TradePlanCard.tsx` — Ask button; payload includes the plan
- [ ] `frontend/components/RegimeCard.tsx` (or wherever it lives — search) — Ask button; payload includes regime
- [ ] `frontend/components/CatalystCard.tsx` (search) — Ask button; payload includes catalyst id
- [ ] All Strategium cards (audit `frontend/components/MissionControl.tsx` + sibling Strategium panels) — Ask button per card

### Mobile output surfaces — same coverage

- [ ] Mirror Ask button on every mobile equivalent

### RiskFlow expanded card refactor (NEW per R2 expansion)

- [ ] **Mobile:** `mobile/components/riskflow/RiskFlowCardExpanded.tsx` — refactor visual layout (no glassmorphic; flat + accent border; readable typography); add Ask AI affordance (header-positioned, calls AskAboutThis with `{surface:"riskflow_card", payload:{itemId, headline, urgency}}`)
- [ ] **Desktop:** `frontend/components/feed/AlertCardBase.tsx` (the file that handles RiskFlow alert rendering on desktop — confirmed via grep; no separate `RiskFlowCardExpanded.tsx` on desktop) — add expanded-mode visual cleanup + Ask AI button
- [ ] Both surfaces: link out to source URL stays prominent; preserve existing IV-weighted urgency chip + NothingFuse usage (T8 owns visual treatment of fuses; T6 only consumes them)

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/*` — `harper-handler.ts` already supports surface-context (T1 owns enrichment, not T6)
- RiskFlow ingest pipeline (`backend-hono/src/services/riskflow/*`)
- RiskFlow scoring + IV-aggregate routes
- RiskFlow card list rendering (only the **expanded** card view changes)
- `frontend/components/chat/*` (T2, T3, T4 own those)
- `frontend/components/shared/NothingFuse.tsx` (T8) — T6 imports and uses, does not modify
- All spinner files (T8)
- TradingView Sanctum chart (untouched)
- Refinement Engine S37
- Persona prompts
- MCP routes
- Existing card data shape — only adds an Ask button + visual polish to expanded view

## Reuse Inventory

- `harper-handler.ts` `buildAquariumContext` / `buildBoardroomContext` (existing surface-context wiring) — T6 dispatches the click → existing handler consumes
- Lucide `MessageSquare` icon (existing import pattern; memory: no icon overhauls)
- `ChatInterface.tsx` open mechanism — find existing pattern (likely a `setActiveChat()` or `dispatch('open-chat')` event); reuse it
- T3 `CitationChip` artifact dispatch pattern (`fintheon:artifact` CustomEvent) — T6 mirrors with `fintheon:open-chat-with-context` CustomEvent dispatched on Ask button click; ChatInterface listens
- `solvys-transitions`: `t-badge` for the hover-reveal animation
- Existing `HeadlinePickerPopover` context-injection shape — T6 dispatches the same context shape so the chat handler doesn't need new code paths

## Known Issues to Preserve

- RiskFlow IV-weighted urgency chip — keep
- Existing card hover behavior — Ask button reveals on hover, doesn't replace existing hover affordances
- Sanctum's chart-mode toggle — Ask button per card does NOT interfere with chart mode
- Memory: "Sanctum header ≠ chamber data" — Ask button on Sanctum cards uses card data; Ask button on Arbitrum chamber uses chamber data; do not cross-wire
- Memory: "RiskFlow card anatomy" — preserve segmented NothingFuse + right-stacked chevron over Doto numeral on the COLLAPSED card; only the EXPANDED state changes

## Implementation Steps

1. **Create `AskAboutThis.tsx`**:
   - Props: `surface: string, payload: Record<string, unknown>, label?: string`
   - Renders a small icon button (lucide `MessageSquare`, accent color, hover-reveal: opacity 0 → 1 on parent hover)
   - On click: dispatches `window.dispatchEvent(new CustomEvent('fintheon:open-chat-with-context', {detail: {surface, payload}}))`
   - Optional `label` prop for explicit labeling ("Ask about this verdict" etc.)
2. **ChatInterface listener** (in T2's wiring or here — coordinate with T2 owner): `useEffect(() => { const handler = (e) => { setOpen(true); injectContext(e.detail); }; window.addEventListener('fintheon:open-chat-with-context', handler); return () => window.removeEventListener(...) }, [])`
3. **Web surface integration** — for each card listed under "Scope Included":
   - Import `AskAboutThis`
   - Add `<AskAboutThis surface="<surface_name>" payload={...} />` to card header (top-right corner, accent-colored, hover-revealed)
   - Surface names: `"arbitrum_verdict"`, `"sanctum_briefing"`, `"sanctum_narratives"`, `"sanctum_risk"`, `"sanctum_aquarium"`, `"sanctum_forecast"`, `"sanctum_trades"`, `"sanctum_vix"`, `"trade_plan"`, `"regime_card"`, `"catalyst_card"`, `"strategium_<panel>"`, `"riskflow_card"`
4. **Mobile surface integration** — mirror for every mobile output card; search `mobile/components/` for parallels (they mostly exist)
5. **RiskFlow expanded card refactor (mobile)**:
   - File: `mobile/components/riskflow/RiskFlowCardExpanded.tsx`
   - Visual cleanup: flat surface, accent border (no glassmorphic), readable typography, IV-weighted urgency chip prominent at top, source link prominent at bottom
   - Add Ask AI button at header right (uses `AskAboutThis` shared primitive)
   - Preserve all existing data flow, props, and modal wiring
6. **RiskFlow expanded refactor (desktop)**:
   - File: `frontend/components/feed/AlertCardBase.tsx`
   - Same visual cleanup for the expanded mode (collapsed mode of the card is preserved per memory)
   - Add Ask AI button to the expanded header
7. **Banned ornaments enforced everywhere**: no gradients, no glass, flat surfaces with accent borders, Solvys palette only

## Acceptance Criteria

- [ ] Every named output surface (Arbitrum, Sanctum cards, TradePlan, Regime, Catalyst, all Strategium cards) shows an Ask button on hover
- [ ] Click Ask on Arbitrum verdict → chat opens, conversation auto-injects `{surface:"arbitrum_verdict", payload:{verdict_id}}`, Harper responds about that verdict
- [ ] Click Ask on RiskFlow expanded card → chat opens with `{surface:"riskflow_card", payload:{itemId, headline}}` injected
- [ ] RiskFlow expanded card (mobile + desktop) visually cleaner: flat surface + accent border, no glass, readable type, source link prominent
- [ ] Ask button is hover-revealed (opacity 0 default; opacity 1 on parent hover); does NOT permanently clutter the card
- [ ] Existing RiskFlow card collapsed view unchanged
- [ ] Existing Sanctum chart-mode toggle unchanged
- [ ] No new event types in BridgeStreamEvent (T6 uses existing surface-context wiring)
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
```

## Banned Ornaments

- No gradients, no emojis, no Kanban borders, no AI sparkles, no glassmorphic surfaces — flat + accent border

## Commit Format

```
[v5.29.0] feat: T6 Ask About This entry on output surfaces + RiskFlow expanded card refactor
```
