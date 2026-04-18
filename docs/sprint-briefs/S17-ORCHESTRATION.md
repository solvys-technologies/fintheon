# S17 — Chat UX Overhaul: Stop, Queue, Approvals, Tool Panes, Thinking

**Sprint:** S17
**Date:** 2026-04-15
**Owner:** TP (Chief)
**Tracks:** 6 (T0-T5)
**Phases:** 3 (sequential phases, parallel tracks within each)
**Applies to:** Desktop frontend + Mobile + Backend relay

## Sprint Goal

Bring Fintheon's chat experience to parity with Claude Code / Codex: functional stop buttons, Codex-style message queue, in-app approval modals (no system popups), collapsible tool execution panes, and expandable thinking/reasoning streams. All features must work across both chat interfaces (Main & AskHarp sidebar) on both desktop and mobile.

---

## Execution Order

### Phase 0 — Foundation (Sequential, blocks all other tracks)

| Track  | Brief                                                                | Description                                                 | Est. Files |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| **T0** | [S17-T0-foundation-store-relay.md](S17-T0-foundation-store-relay.md) | Zustand chat store + relay requestId exposure + sendCommand | 4          |

### Phase 1 — Independent Features (Parallel, after T0)

| Track  | Brief                                                  | Description                                         | Est. Files |
| ------ | ------------------------------------------------------ | --------------------------------------------------- | ---------- |
| **T1** | [S17-T1-stop-button.md](S17-T1-stop-button.md)         | Stop request button (animated send/stop swap)       | 2          |
| **T2** | [S17-T2-thinking-stream.md](S17-T2-thinking-stream.md) | Thinking indicator (pulsing dot + phrases + expand) | 3          |
| **T3** | [S17-T3-tool-panes.md](S17-T3-tool-panes.md)           | Tool call streaming panes (collapsible peek cards)  | 4          |

### Phase 2 — Complex Features (Parallel, after T0; T4 can start after T1)

| Track  | Brief                                                | Description                                            | Est. Files |
| ------ | ---------------------------------------------------- | ------------------------------------------------------ | ---------- |
| **T4** | [S17-T4-queue-popover.md](S17-T4-queue-popover.md)   | Codex-style message queue (drag reorder, auto-drain)   | 4          |
| **T5** | [S17-T5-approval-modal.md](S17-T5-approval-modal.md) | In-app approval modal + cognition stream + Approve All | 5          |

---

## Dependency Graph

```
T0 (Foundation)
 ├── T1 (Stop Button)        ─── can start immediately after T0
 ├── T2 (Thinking Stream)    ─── can start immediately after T0
 ├── T3 (Tool Panes)         ─── can start immediately after T0
 ├── T4 (Queue Popover)      ─── after T0; benefits from T1 (input bar state)
 └── T5 (Approval Modal)     ─── after T0; feeds tool events to T3
```

T1, T2, T3 are fully independent — max parallelism = 3 tracks.
T4 and T5 can run alongside Phase 1 but T4 touches ChatInput (shared with T1).

**Recommended execution:** T0 first, then T1+T2+T3 in parallel, then T4+T5 in parallel.

---

## Status Dashboard

| Track | Status  | Assignee | Blocker |
| ----- | ------- | -------- | ------- |
| T0    | PENDING | —        | —       |
| T1    | PENDING | —        | T0      |
| T2    | PENDING | —        | T0      |
| T3    | PENDING | —        | T0      |
| T4    | PENDING | —        | T0, T1  |
| T5    | PENDING | —        | T0      |

---

## Shared Resources (Conflict Zones)

These files are touched by multiple tracks. Assign carefully or merge sequentially:

| File                                        | Tracks                                          | Risk                                                                                      |
| ------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mobile/stores/useChatStore.ts`             | T0 (create), T3, T4, T5 (modify)                | T0 creates, others add actions — low conflict if T0 stubs all fields                      |
| `mobile/components/chat/ChatInput.tsx`      | T1 (stop), T4 (enqueue)                         | T1 adds stop button, T4 adds enqueue — different code paths, merge safe                   |
| `mobile/components/chat/ChatMessage.tsx`    | T2 (thinking), T3 (tool panes)                  | T2 adds ThinkingIndicator, T3 adds ToolCallGroup — different insertion points, merge safe |
| `mobile/components/chat/ChatPage.tsx`       | T0 (refactor), T4 (queue render)                | T0 refactors to store, T4 adds QueuePopover — sequential safer                            |
| `backend-hono/src/services/relay-bridge.ts` | T0 (requestId + sendCommand), T5 (cognition WS) | Both modify forward() — assign to same track or merge carefully                           |

---

## Build Verification (Run After Each Track)

```bash
# After every track:
cd /Users/tifos/Desktop/Codebases/fintheon
cd mobile && bun run build          # Mobile must build clean
cd ../frontend && npx vite build    # Desktop must build clean (not just tsc)
cd ../backend-hono && bun run build # Backend must build clean
```

## Integration Test (Run After All Tracks)

```bash
# 1. Start local backend with relay enabled
cd backend-hono && RELAY_ENABLED=true bun run dev

# 2. Start mobile dev server
cd mobile && bun run dev

# 3. Test matrix:
```

| Feature         | Test                                            | Expected                                                          |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Stop            | Send message, tap stop while streaming          | Stream stops, UI resets                                           |
| Thinking        | Send complex query                              | Pulsing dot + phrases, "thought for Xs" on done, tap to expand    |
| Tool panes      | Trigger tool use (search, file ops)             | Running spinner, collapse to peek pill, tap to expand I/O         |
| Queue           | Send while loading                              | Message queues, auto-sends on completion, drag reorder, X removes |
| Approval        | Trigger tool needing permission                 | Modal appears, Approve/Approve All/Deny work correctly            |
| Cross-feature   | Complex query with thinking + tools + approval  | All UI coexists, no z-index conflicts                             |
| Both interfaces | Test all above in Main chat AND AskHarp sidebar | Identical behavior via shared store                               |

---

## Design System Reference

| Token               | Value      | Usage                                     |
| ------------------- | ---------- | ----------------------------------------- |
| `--accent`          | #d4af37    | Queue borders, thinking dot, approval CTA |
| `--error`           | #ef4444    | Stop button, deny button, error states    |
| `--surface-raised`  | #141414    | Card backgrounds, tool panes              |
| `--text-secondary`  | #8a8a8a    | Thinking phrases, tool duration           |
| `--text-disabled`   | #4a4a4a    | "thought for Xs", drag handles            |
| Font: Space Mono    | monospace  | Labels, status text, data                 |
| Font: Space Grotesk | sans-serif | Body text, queue messages                 |
| Min tap target      | 44px       | All interactive elements                  |

---

## Post-Sprint

After all tracks complete and integration tests pass:

1. Update `src/lib/changelog.ts` with S17 summary
2. Run `/solvys-ship` for commit + push + DMG rebuild
3. Tag release with version bump
4. Update MEMORY.md with any new feedback/patterns discovered
