# S42 — CHAT SOTA Orchestration (Brotzky Doctrine + Artifact Pane + Browserbase + Nothing Fuses)

## What ships

Every Fintheon chat surface (desktop `ChatInterface`, boardroom `AgentChattr`, mobile `ChatPage`) feels like Fey.com: keyboard-first navigation, inline citation chips, live agent-activity stream, "Ask about this" entry from every output card, sub-50ms mount-to-composer. A new dual-pane artifact preview shows TradingView iframes, browserbase-driven agent browser sessions, agent HTML reports, and citation sources on the right (web) / bottom-sheet (mobile). RiskFlow expanded cards get an Ask AI affordance + visual refactor. NothingFuse + every spinner gets a Nothing-design overhaul; Doto display font extends from mobile to desktop frontend.

## Branch + worktree

- **Worktree:** `~/Desktop/Codebases/fintheon-s42-chat-sota` (cut off prod tag `v5.28.0` per memory rule "Fresh worktree for parallel sprints")
- **Per-track sub-branches:** `s42-t1-stream`, `s42-t2-composer`, `s42-t3-render`, `s42-t4-artifact`, `s42-t5-browserbase`, `s42-t6-ask`, `s42-t7-perf`, `s42-t8-nothing`
- **Unification target:** `s42-chat-sota` (T9 merges all 8 into this; final PR opens against `main`)

## Wave structure

```
Wave 1 (8 parallel VS Code windows):
  ├─ T1 stream protocol           [backend-hono]
  ├─ T2 composer + cmdk + queue   [frontend + mobile]
  ├─ T3 message render + rail     [frontend + mobile]
  ├─ T4 artifact pane             [frontend + mobile]
  ├─ T5 browserbase plugin        [backend + frontend + mobile]
  ├─ T6 ask + RiskFlow expand     [frontend + mobile output cards]
  ├─ T7 mount-time perf           [frontend + mobile]
  └─ T8 Nothing fuses/spinners    [frontend + mobile shared primitives]

Wave 2 (after Wave 1 lands):
  └─ T9 unify + validate + PR
```

T1 stream events ship behind feature detection so T2/T3 can land before backend deploys.

## Off-limits across all tracks

- **Refinement Engine S37 Advanced pane** — password gate immutable; reuse `dev-settings-auth` helpers without modifying them
- **TradingView Sanctum chart** at `narrative/SanctumChart.tsx:59` — preserved as-is; T4 instantiates `EmbeddedBrowserFrame` separately for the chat artifact pane
- **`feed-health.log` + auto-checkpoint hook** — background WIP autosave; conflicts default-resolve `--theirs`
- **MCP server list** at `.mcp.json` (Claude Peers wired) — must round-trip identically through `/api/mcp`
- **MDB / ADB / PMDB / TWT brief generators + cron** — untouched
- **Persona system prompts** at `backend-hono/src/services/ai/agent-instructions/` — untouched
- **Supabase migrations** — no schema change in this sprint

## Banned ornaments (every UI track)

- No gradients
- No colored or monochrome emojis
- No Kanban borders
- No AI sparkles (✨, shimmer, animated gradient text)
- No glassmorphic surfaces (memory ban) — use flat surfaces + accent borders
- Solvys palette: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`

## Library install matrix (per track)

| Track | Install                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2    | `cmdk` (frontend)                                                                                                                                                 |
| T3    | `@assistant-ui/react-streamdown` (frontend + mobile), `@assistant-ui/react` (mobile — frontend already has it), Agent Elements package (verify name during track) |
| T5    | `@browserbasehq/sdk` (backend-hono); ENV `BROWSERBASE_API_KEY` to `backend-hono/.env.example`                                                                     |

## @-mention wave block (paste into 8 VS Code windows)

```
@sprint-md/S42-T1-stream.md
```

```
@sprint-md/S42-T2-composer.md
```

```
@sprint-md/S42-T3-message-render.md
```

```
@sprint-md/S42-T4-artifact-pane.md
```

```
@sprint-md/S42-T5-browserbase.md
```

```
@sprint-md/S42-T6-ask-and-riskflow-expand.md
```

```
@sprint-md/S42-T7-mount-perf.md
```

```
@sprint-md/S42-T8-nothing-fuses-spinners-doto.md
```

After Wave 1:

```
@sprint-md/S42-T9-unify.md
```
