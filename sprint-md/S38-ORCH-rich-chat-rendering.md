# S38-ORCH — Rich Chat Rendering

- **Parent sprint branch**: `sprint/S38`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Bring rich text rendering parity to the Fintheon chat system. Two tracks: (1) full Streamdown slot coverage so all slot types render properly in the chat stream, and (2) rich text formatting for Arbitrum verdict digests so chamber output is readable and structured.

## Codebase map

### Chat slots system

- `frontend/components/chat/slots/index.ts` — Slot registry and export barrel
- `frontend/components/chat/slots/parseSlotBody.ts` — Slot body parser (extracts slot metadata from markdown)
- `frontend/components/chat/slots/SlotShell.tsx` — Slot wrapper component (common chrome/error boundary)
- `frontend/components/chat/slots/StreamdownChat.tsx` — Streamdown rendering engine for chat messages
- `frontend/components/chat/slots/CatalystCardSlot.tsx` — Catalyst card slot renderer
- `frontend/components/chat/slots/NarrativePreviewSlot.tsx` — Narrative preview slot renderer
- `frontend/components/chat/slots/PsychTableSlot.tsx` — Psych table slot renderer
- `frontend/components/chat/slots/TVChartSlot.tsx` — TradingView chart slot renderer (off-limits per project rules)
- `frontend/components/chat/slots/VisionInsightSlot.tsx` — Vision insight slot renderer
- `frontend/components/chat/slots/PerfTableSlot.tsx` — Performance table slot renderer

### Chat components

- `frontend/components/chat/CognitionPanel.tsx` — Main chat cognition panel
- `frontend/components/chat/parts/TextPart.tsx` — Text part renderer for chat messages
- `frontend/components/chat/types.ts` — Chat type definitions

### Arbitrum

- `backend-hono/src/services/arbitrum/` — Deliberation engine (verdict generation, digest creation)
- `frontend/components/arbitrum/` — Frontend Arbitrum surfaces
- `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx` — Verdict prediction card display
- `frontend/components/arbitrum/VerdictCard.tsx` — Verdict card component
- `frontend/components/arbitrum/ChamberSeats.tsx` — Chamber seat rendering
- `frontend/components/arbitrum/types.ts` — Verdict, seat, dissent type defs

## Child tickets

### SOL-63 — S38-CHAT: Rich formatting parity (Streamdown slot coverage)

Branch: `sprint/S38`

**What to do**: Audit the existing Streamdown slot renderers and identify which slot types are missing or partially implemented. Ensure every slot type defined in `parseSlotBody.ts` has a corresponding renderer in `slots/`. Check `StreamdownChat.tsx` for coverage gaps. Fix rendering issues (text wrapping, missing data, broken layouts) in the chat stream.

**Key files to touch**: `frontend/components/chat/slots/StreamdownChat.tsx`, `frontend/components/chat/slots/index.ts`, `frontend/components/chat/slots/parseSlotBody.ts`, `frontend/components/chat/slots/SlotShell.tsx`, `frontend/components/chat/slots/*.tsx`

**Validation**: Open CAO chat, trigger responses with various slot types, verify all render correctly. Check mobile viewport for overflow. Run `npx tsc --noEmit`.

### SOL-65 — S38-CHAT: Arbitrum Rich Text for verdict digest

Branch: `sprint/S38`

**What to do**: Add rich text formatting to Arbitrum verdict digests. The digest text (produced by the deliberation engine) should support markdown-style formatting (bold for consensus points, lists for dissent items, structured sections). Ensure the frontend renders this formatted text in the ArbitrumChamber card stack and any chat slots that display verdict summaries.

**Key files to touch**: `backend-hono/src/services/arbitrum/` (digest generation), `frontend/components/arbitrum/VerdictCard.tsx` (digest rendering), `frontend/components/arbitrum/ArbitrumChamber.tsx`, `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx`

**Validation**: Trigger an Arbitrum deliberation (`POST /api/arbitrum/deliberate`). Check the verdict digest renders with proper formatting (headings, lists, emphasis). Run both frontend and backend type-checks.

## Execution order (wave sequence)

1. **Wave 1 — Streamdown coverage** (SOL-63): Fix slot rendering first since it affects all chat. Audit all slot types, fix gaps.
2. **Wave 2 — Arbitrum rich text** (SOL-65): Then update the Arbitrum digest format. Depends on SOL-63 only for shared rendering patterns (if any).

## Validation

- [ ] All Streamdown slot types render in chat
- [ ] Arbitrum verdict digest shows formatted rich text
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] No console errors when rendering chat slots
- [ ] Add changelog entry to `src/lib/changelog.ts`

## Reference

- @sprint-md/S44-T1-refinement-glass-gate.md — referenced in child ticket descriptions (original sprint context, refinement unrelated but referenced)
