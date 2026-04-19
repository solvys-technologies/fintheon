# S27 — Agentic Intelligence Sprint (stars-derived)

## Context

TP asked Claude Code to mine `github.com/solvys`'s starred repos for wins that would increase the UX + power of Fintheon's analysis tools and agentic features. 12 stars were audited on 2026-04-19; 8 mapped to concrete Fintheon gaps. This sprint executes the Tier S + Tier A wins as a **3-track parallel sprint** with one Unification pass at the end.

TP's framing: "increase the UX and power of our platform's analysis tools/agentic features."

## Source Stars → Audit Gaps

| #   | Star                                                                                                                                 | Relevance                      | Fintheon Gap                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [vercel-labs/json-render](https://github.com/vercel-labs/json-render) — Generative UI framework                                      | **Tier S**                     | `harper-handler.ts:144` instructs Harper to emit structured JSON cards but no parser is wired — every reply collapses to plain markdown in `TextPartRenderer`.                                        |
| 2   | [mksglu/context-mode](https://github.com/mksglu/context-mode) — Tool-output sandbox, 98% token reduction                             | **Tier S**                     | `conversation-store.ts` only summarizes at 80k; raw tool output stuffed into context until then. No per-tool hydration layer. Harper claude-cli path has no equivalent.                               |
| 3   | [Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop) — A2A protocol, dream engine, skills marketplace | **Tier A**                     | `hermes-handler.ts` regex-routes to exactly one agent per message. Harper mentions Oracle/Feucht/Consul/Herald in prose but never invokes them — no handoff plumbing.                                 |
| 4   | [browser-use/browser-harness](https://github.com/browser-use/browser-harness) — Self-healing LLM browser                             | **Tier A**                     | Herald = Exa + Rettiwt + `fetch`-based AgentReach. No JS rendering — can't read SEC EDGAR filing detail, FOMC release pages, Polymarket live books. Playwright exists but only for chart screenshots. |
| 5   | [jamiepine/voicebox](https://github.com/jamiepine/voicebox) — Qwen3-TTS voice synthesis                                              | **Tier A**                     | MDB/ADB/PMDB/TOTT are text-only. `voice-service.ts` wires OpenAI TTS for Hermes chat replies only. No per-agent voices, no brief playback.                                                            |
| 6   | [Bitterbot "dream engine"](https://github.com/Bitterbot-AI/bitterbot-desktop) — off-hours memory consolidation                       | **Tier B** (stretch)           | `agent_memory` table accumulates forever; no nightly reflection/compression pass.                                                                                                                     |
| 7   | [nolly-studio/cult-ui](https://github.com/nolly-studio/cult-ui) — shadcn-compat Framer Motion components                             | **Tier B** (stretch)           | Boardroom + Apparatus tool panels are static. Some cult-ui primitives (e.g., animated list, direction-aware hover) fit the glass language.                                                            |
| 8   | [elder-plinius/CL4R1T4S](https://github.com/elder-plinius/CL4R1T4S) — leaked system prompts corpus                                   | **Tier B** (stretch, non-code) | No red-team baseline on `agent-instructions/`. Useful reference to stress-test against known injection + extraction patterns.                                                                         |

Dropped as low-fit: `webadderall/Recordly`, `zats/permiso`, `vercel-labs/portless`, `vercel-labs/wterm` (wterm revisited under Tier B ops console if Track B finishes early).

## Execution Model

Three parallel Claude Code instances via `/solvys-orchestrate`. All three tracks run on worktrees branched from `v5.22` HEAD. TP merges each into `v5.22` as they land, then `v.27.x` tags go on the unified branch.

| Track                | Owner worktree                          | Wins                                              | Surface                                                                |
| -------------------- | --------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **A — Harper UX**    | `fintheon-s27-a` (`s27-a-harper-ux`)    | T1 Generative UI cards, T6 cult-ui polish         | Frontend chat + Boardroom                                              |
| **B — Agent Core**   | `fintheon-s27-b` (`s27-b-agent-core`)   | T2 Context sandbox, T3 A2A handoff                | `backend-hono/src/services/`                                           |
| **C — Capabilities** | `fintheon-s27-c` (`s27-c-capabilities`) | T4 Herald browser-harness, T5 Agent-voiced briefs | `backend-hono/src/services/herald/*`, `voice-service.ts`, brief routes |

## Conflict Matrix

| File / Area                                                    | Track A                                          | Track B                      | Track C   |
| -------------------------------------------------------------- | ------------------------------------------------ | ---------------------------- | --------- |
| `frontend/components/chat/ChatMessageBubble.tsx`               | OWN                                              | —                            | —         |
| `frontend/components/narrative/Sanctum.tsx` (Boardroom polish) | OWN                                              | —                            | —         |
| `backend-hono/src/services/harper-handler.ts`                  | read-only                                        | OWN (prompt + tools)         | read-only |
| `backend-hono/src/services/hermes-handler.ts`                  | —                                                | OWN                          | —         |
| `backend-hono/src/services/conversation-store.ts`              | —                                                | OWN                          | —         |
| `backend-hono/src/services/ai/agent-instructions/*.ts`         | —                                                | OWN (system-prompt rewrites) | read-only |
| `backend-hono/src/services/herald/*` + AgentReach              | —                                                | —                            | OWN       |
| `backend-hono/src/services/voice-service.ts`                   | —                                                | —                            | OWN       |
| `backend-hono/src/routes/data/brief.ts` (playback URLs)        | —                                                | —                            | OWN       |
| `src/lib/changelog.ts`                                         | all tracks append (last-in wins merged manually) |

Only real overlap is `harper-handler.ts`: Track A needs Harper's prompt to emit cards (T1), Track B rewrites Harper's prompt to add A2A tools (T3). **Resolution**: Track B owns Harper prompt edits. Track A defines the card schema as a typed module (`shared/harper-cards.ts`) that Track B imports into the prompt. Track A merges first (pure frontend); Track B rebases on A, wires tools + cards into prompt, merges second.

## Sequence

1. **Day 0** — Orchestrator (TP or Claude) runs `git worktree add` for all three worktrees against `v5.22`. Spawns 3 fresh Claude Code instances each with its T{N} brief + this orchestration doc.
2. **Track A + Track C** run in parallel (no shared files).
3. **Track B** starts after Track A lands its `shared/harper-cards.ts` module (rebase onto A's commit). This unblocks Track B's Harper prompt edits.
4. **Unification pass** — after all 3 tracks merge into `v5.22`, one agent runs the full build, tsc, `/install-maintenance`, and smoke-tests each track's happy path + one edge case.

## Per-Track Briefs

- [`S27-T1-generative-ui-harper.md`](S27-T1-generative-ui-harper.md) — Track A
- [`S27-T2-context-sandbox.md`](S27-T2-context-sandbox.md) — Track B
- [`S27-T3-a2a-handoff.md`](S27-T3-a2a-handoff.md) — Track B
- [`S27-T4-herald-browser.md`](S27-T4-herald-browser.md) — Track C
- [`S27-T5-agent-voice-briefs.md`](S27-T5-agent-voice-briefs.md) — Track C

## Success Criteria (post-unification)

- Harper replies render at least one typed card (probability-table, price-level, agent-handoff, or risk-flag) in a live chat session without falling through to markdown.
- A Hermes conversation that previously OOM'd at ~25 tool calls now completes 60+ turns before context summarization fires.
- Harper invokes `handoff_to_feucht` (or another desk) in at least one live session — the pane shows agent provenance.
- Herald successfully ingests one SEC EDGAR 8-K filing detail page that previously 403'd the `fetch` path.
- MDB renders with a "play" control that streams Consul's voice for the macro section and Oracle's voice for the prob section — distinguishable by ear.
- `vite build` + `bun run build` clean, `tsc --noEmit` clean, `/api/diagnostics` green.

## Ship Tag

Track A merges → `v.27.1`. Track B merges → `v.27.2`. Track C merges → `v.27.3`. Unified + validated → `v.27.4` (release tag; trigger `/solvys-deploy`).

## Out of Scope

- Mobile (S26 is absorbing mobile revisions; S27 does not touch `mobile/`)
- Dream Engine (T6) — noted for S28 unless Track B finishes T2 + T3 with slack
- Any new prediction-market integrations (T4 is read-only scraping, not order placement)
- Rewriting voice-service's STT path (T5 is TTS-only)

## Risk Register

- **Harper card schema drift** — frontend renders one shape while backend emits another. Mitigation: Track A's `shared/harper-cards.ts` lives under a path both frontend and backend import; Zod schemas at both ends.
- **browser-harness cost explosion** — Herald starts loading every news URL in a headless browser. Mitigation: T4 gates browser usage to a narrow allow-list of domains + per-domain daily quota.
- **Agent voice latency** — TTS at request time blows through the 2s render budget. Mitigation: T5 pre-renders brief audio at brief-generation time, stores in Supabase storage, serves signed URL.
- **A2A loops** — Harper calls Feucht who calls Consul who calls Harper. Mitigation: T3 caps handoff depth at 2 + carries a visited-set in the tool-call context.
