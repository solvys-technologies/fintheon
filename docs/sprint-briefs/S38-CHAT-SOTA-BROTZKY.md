# S38 — CHAT SOTA (Brotzky Doctrine)

**Goal.** Refactor every Fintheon chat surface to feel like Fey.com / Brotzky's investment-research chat: keyboard-first, perf-first, citation-first, agent-activity visible, output surfaces become chat entry points.

**Source of truth for the doctrine.** @brotzky on X, Apr 2026 + Fey.com landing + his "How we made Fey feel fast" / "Text animation for SEC filings" / "Fey auth without splash" highlights.

---

## The Brotzky Doctrine (what we steal)

| Principle                             | Brotzky / Fey                                                                                                                                   | What it means for us                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keyboard-first navigation**         | Fey: "At your command. Navigate with natural language. Without lifting your hands from your keyboard." Hotkeys X/N/C for filings/news/overview. | Cmd+K palette; ↑↓ in composer = message history; agent-switch via slash (`/oracle`, `/feucht`); jump-to-cite.                                                               |
| **Streaming text reveal**             | Fey SEC-filing text-animation thread (Nov 2023).                                                                                                | Token-level cursor + chunk-pacing on every assistant message. Currently absent in `FintheonStreamingBubble`.                                                                |
| **Stream of work + scores + reports** | New (Apr 23): "I get a stream of everything that is being done along with scores, reports, and more."                                           | Live agent-activity rail next to every chat (sub-agent fetches, tool calls, source hits, scores) — not a separate Boardroom workspace.                                      |
| **Cross-checked sources, inline**     | Fey: "cross-checks multiple news sources with company filings, earnings calls, and financial data."                                             | Every claim in an assistant turn carries a numeric citation chip → opens the RiskFlow item / SEC filing / chart in the right pane.                                          |
| **Concise summaries**                 | Fey: "all headlines in one sentence."                                                                                                           | Summary-first message format, expand-on-demand for the long form. Default = TL;DR; click to unfurl reasoning trace.                                                         |
| **Generated-at timestamps**           | Fey: "Generated at 5:00 PM" on every AI block.                                                                                                  | Every assistant turn footer = `Harper · gen 17:14:08 · 1.4s · 12 sources`.                                                                                                  |
| **No app-hopping**                    | Brotzky Apr 24: "I get 'annoyed' when I have to open an app because AI can't complete the flow."                                                | Every output surface (Arbitrum, Sanctum, TradePlan, Regime, Catalyst) gets an inline chat entry — "ask about this" — that opens with that surface as auto-injected context. |
| **Fast-feel**                         | "How we made Fey feel fast" — go simple, kill data fetches.                                                                                     | Ban any chat-mount blocking fetch. Skeleton-first; stream history in. Mount must be <50ms.                                                                                  |

---

## Current state (gaps mapped to doctrine)

| Surface                   | File                                                                                                                                                | Gap                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop chat              | `frontend/components/ChatInterface.tsx`, `chat/FintheonComposer.tsx`, `chat/FintheonStreamingBubble.tsx`                                            | No Cmd+K, no ↑↓ history, no inline citations, no thinking-trace expand, no agent-activity rail, no per-turn timestamp/source/latency footer |
| Boardroom chat            | `frontend/components/consilium/AgentChattr.tsx`, `ConsiliumMessage.tsx`                                                                             | Has DAG panel but visually stacked, not integrated; persona switch reroutes whole convo (no per-turn agent attribution)                     |
| Mobile chat               | `mobile/components/chat/ChatPage.tsx`, `ChatInput.tsx`                                                                                              | No inline picker, no agent context UI, headline picker is modal sheet                                                                       |
| Backend                   | `backend-hono/src/services/harper-handler.ts`                                                                                                       | No `thinking` token emission; no `tool_call` events with status; no `citation` events; no `latency_ms` / `source_count` in `complete`       |
| Output surfaces (no chat) | `arbitrum/ArbitrumChamber.tsx`, `narrative/Sanctum.tsx`, `proposals/TradePlanCard.tsx`, `RegimeCard.tsx`, `CatalystCard.tsx`, every Strategium card | Zero chat entry. Can't ask "why did seat X dissent?" or "refine this trade."                                                                |

---

## Tracks (single wave — memory rule: one sprint = one wave when no real dependencies)

### T1 — Stream protocol upgrade (backend)

**File:** `backend-hono/src/services/harper-handler.ts`, `backend-hono/src/routes/harper-chat.ts`, type def in `frontend/types/bridge-stream.ts`
**Deliverable:** Extend `BridgeStreamEvent` with `{type: "thinking", token}`, `{type: "tool_call", name, status: "pending|running|done|failed", duration_ms}`, `{type: "citation", id, source, url, snippet}`, and enrich `complete` with `{latency_ms, source_count, model, prompt_tokens, completion_tokens}`. Backwards-compatible (consumers ignore unknown types).
**Why first wave (not blocker):** UI tracks consume new events but degrade gracefully when absent.

### T2 — Composer + keyboard layer (desktop + mobile)

**Files:** `frontend/components/chat/FintheonComposer.tsx`, `mobile/components/chat/ChatInput.tsx`, new `frontend/components/chat/CommandPalette.tsx`
**Deliverable:** Cmd+K command palette (jump to chat / agent / surface / recent message); ↑↓ recalls last user message; `/oracle`, `/feucht`, `/consul`, `/herald` slash-commands switch persona for next turn only; `@<ticker>` injects the ticker as context; Esc cancels in-flight stream. Send button stays circular ArrowUp (memory locked).

### T3 — Message rendering + citations + activity rail

**Files:** `frontend/components/chat/FintheonStreamingBubble.tsx`, new `MessageFooter.tsx`, new `CitationChip.tsx`, new `AgentActivityRail.tsx`, `consilium/ConsiliumMessage.tsx`
**Deliverable:** Token-level streaming cursor (CSS `t-text-swap` reused per `solvys-transitions`); per-turn footer (`agent · gen HH:MM:SS · Ns · N sources`); inline numeric citation chips (`[1][2]`) that scroll-pin the cited source in a right rail; collapsible thinking-trace block (closed by default, opens with `Cmd+T`); a **persistent agent-activity rail** docked right of every chat that consumes `tool_call` / `citation` events as a live timeline (replaces separate Boardroom DAG panel for solo-chat surfaces).

### T4 — "Ask about this" entry on every output surface

**Files:** `arbitrum/ArbitrumChamber.tsx`, `narrative/Sanctum.tsx`, `proposals/TradePlanCard.tsx`, `RegimeCard.tsx`, `CatalystCard.tsx`, all Strategium cards. New shared primitive `frontend/components/chat/AskAboutThis.tsx`.
**Deliverable:** Every output surface gets an unobtrusive "Ask" affordance (icon button, hover-revealed on cards) that opens the chat panel with that surface auto-injected as context (`{type: "context", surface: "arbitrum_verdict", verdict_id}`). Backend `harper-handler` already supports surface-context; we just wire the producers.

### T5 — Mount-time perf + skeleton (Brotzky "fast-feel")

**Files:** `frontend/components/ChatInterface.tsx`, `mobile/components/chat/ChatPage.tsx`
**Deliverable:** Ban blocking fetches at mount. Render skeleton shells for history & sessions; stream them in via deferred query. Target: visible composer in <50ms after route change. Audit and remove any `useEffect(() => fetch(...), [])` that gates the first paint. Add a perf log entry on mount→first-paint to telemetry.

---

## Wave plan

**Single wave, 5 parallel VS Code windows.** Per memory rule: one sprint = one wave when tracks have no real dependencies. T1 stream events ship behind feature detection so T2/T3 can land independently. T4 depends only on T1's `context` producer wiring (already exists). T5 is fully parallel.

```
W1 (parallel):
  ├─ T1 stream protocol         (backend-hono)
  ├─ T2 composer + keyboard     (frontend + mobile)
  ├─ T3 message render + rail   (frontend + consilium)
  ├─ T4 ask-about-this          (frontend output surfaces)
  └─ T5 mount-time perf         (frontend + mobile)
```

---

## Non-goals (explicit)

- No new persona/agent. We're not adding a 6th seat.
- No chat persistence schema change. Existing conversation table stays.
- No model-router change. T9 is its own sprint.
- No Arbitrum re-architecture. T4 only adds an entry point, doesn't change verdict logic.
- No icon-set swap (memory: "icon overhauls are sacred"). Reuse existing lucide icons.
- No glassmorphic surfaces (memory ban). Activity rail = flat surface + accent border.

---

## Open questions for TP before kickoff

1. **Activity rail default state** — docked open or collapsed-by-default with a pulse?
2. **Citation source coverage** — RiskFlow + SEC filings only at S38, or include Arbitrum verdicts as citable sources too?
3. **Cmd+K scope** — chat-only, or full app (jump to Sanctum page, Strategium card)?

---

## Validation gate (before merge)

- Cold mount → composer visible in <50ms (Chrome DevTools Performance)
- Cmd+K reachable from any chat surface
- Every assistant turn shows the new footer (timestamp · latency · sources)
- "Ask about this" present on Arbitrum, Sanctum cards, TradePlan, Regime, Catalyst
- `tsc --noEmit` clean for both frontend + mobile + backend
- `bun run build` clean
- Manual smoke: open Arbitrum verdict → click Ask → chat opens with verdict auto-injected → Harper responds with citations → click citation → right rail scrolls to source

---

## Ready for `/solvys-orchestrate`

This brief is structured for direct ingestion: 5 tracks, 1 wave, file paths declared, deliverable per track. Hand to `/solvys-orchestrate` to split into per-track turnkey briefs.
