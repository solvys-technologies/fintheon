# S27 — Agent Context Pointer

If you are a worker Claude spawned into an S27 worktree and unsure what's going on: **read this first**, then your task brief(s), then `CLAUDE.md`.

## What This Sprint Is

Ten parallel Claude Code instances adopt NousResearch Hermes Agent upstream, add a generative UI card layer for Harper, fix the broken voice assistant, replace Rettiwt with `browser-use/browser-harness`, stand up an always-on news worker, and flip Smart Model Routing + Skills Hub + GEPA live — all in one coordinated sprint. Orchestrator (Claude-01) coordinates; 9 workers own tasks; no track is allowed to touch another's files.

Full plan lives at `/Users/tifos/.claude/plans/concurrent-orbiting-widget.md` (off-repo, TP-readable) and [`S27-ORCHESTRATION.md`](S27-ORCHESTRATION.md) (in-repo, authoritative for workers).

## If You Are... (quick orient)

| Claude                     | Wave | Task files to read                                                                                                                                                        |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude-01 Orchestrator** | —    | [`S27-ORCHESTRATION.md`](S27-ORCHESTRATION.md) + every task brief                                                                                                         |
| **Claude-02 W1a**          | 1    | [`S27-T1-generative-ui-harper.md`](S27-T1-generative-ui-harper.md) §1 only                                                                                                |
| **Claude-03 W1b**          | 1    | [`S27-T2-context-sandbox.md`](S27-T2-context-sandbox.md) §1-3                                                                                                             |
| **Claude-04 W1c**          | 1    | [`S27-T4-herald-browser.md`](S27-T4-herald-browser.md)                                                                                                                    |
| **Claude-05 W1d**          | 1    | [`S27-T8-soul-conversion.md`](S27-T8-soul-conversion.md) + [`S27-T9-smart-model-routing.md`](S27-T9-smart-model-routing.md) §1-2                                          |
| **Claude-06 W2a**          | 2    | [`S27-T1-generative-ui-harper.md`](S27-T1-generative-ui-harper.md) §2-5                                                                                                   |
| **Claude-07 W2b**          | 2    | [`S27-T2-context-sandbox.md`](S27-T2-context-sandbox.md) §4-6 + [`S27-T3-a2a-handoff.md`](S27-T3-a2a-handoff.md)                                                          |
| **Claude-08 W2c**          | 2    | [`S27-T5-agent-voice-briefs.md`](S27-T5-agent-voice-briefs.md)                                                                                                            |
| **Claude-09 W2d**          | 2    | [`S27-T6-harper-browser-operator.md`](S27-T6-harper-browser-operator.md) + [`S27-T7-news-worker.md`](S27-T7-news-worker.md)                                               |
| **Claude-10 W2e**          | 2    | [`S27-T9-smart-model-routing.md`](S27-T9-smart-model-routing.md) §3-5 + [`S27-T10-skills-hub.md`](S27-T10-skills-hub.md) + [`S27-T11-gepa-loop.md`](S27-T11-gepa-loop.md) |

**Wave 2 workers do NOT start until the Orchestrator's mid-sprint SendMessage fires.** If you are a Wave 2 Claude and Wave 1 hasn't merged, stop and wait.

## Foundation Stubs (already on v5.22)

These files exist as typed stubs so imports resolve on day 0. Each stub's comment names the Claude responsible for filling it in. Throwing stubs means you can't _use_ the functionality yet — you _can_ import the types.

- [`shared/harper-cards.ts`](../../shared/harper-cards.ts) — W1a populates (6 Zod card variants)
- [`shared/skill-manifest.ts`](../../shared/skill-manifest.ts) — W1a populates (agentskills.io schema)
- [`shared/plugin-manifest.ts`](../../shared/plugin-manifest.ts) — W1a populates (Hermes plugin schema)
- [`shared/sidecar-contract.ts`](../../shared/sidecar-contract.ts) — W1a scaffolds, W1b populates
- [`shared/soul-schema.ts`](../../shared/soul-schema.ts) — W1d populates
- [`shared/index.ts`](../../shared/index.ts) — barrel
- [`backend-hono/src/services/browser/index.ts`](../../backend-hono/src/services/browser/index.ts) — W1c populates (pool, allowlist, harness)
- [`backend-hono/src/services/ai/sidecar-client.ts`](../../backend-hono/src/services/ai/sidecar-client.ts) — W1b populates
- [`backend-hono/src/services/ai/routing.ts`](../../backend-hono/src/services/ai/routing.ts) — W1d populates defaults, W2e flips live
- [`backend-hono/src/services/ai/soul/README.md`](../../backend-hono/src/services/ai/soul/README.md) — W1d writes .md files here
- [`hermes-sidecar/README.md`](../../hermes-sidecar/README.md) — W1b populates the full directory

## Hard Rules (Non-Negotiable)

From [`CLAUDE.md`](../../CLAUDE.md) + TP memory + sprint-locked decisions:

1. **No gradients, no kanban borders, no shimmer, no emojis.** Glassmorphic default — translucent bg, backdrop-blur, thin accent border. Solvys-Gold palette: BG `#050402`, accent `#c79f4a`, text `#f0ead6`.
2. **No `npx vite` dev server.** Only `vite build` for verification. TP's rule.
3. **Every commit runs `bun run build` (backend) + `npx tsc --noEmit` + `vite build` after `rm -rf dist`.** Not just tsc.
4. **Never skip hooks (`--no-verify`), never force-push, never `reset --hard` without TP approval.**
5. **Never commit secrets** (`.env`, `credentials.json`). Always stage specific files, never `git add -A`.
6. **Append a changelog entry** to `src/lib/changelog.ts` for every merge. Format: `{ date, agent: 'claude-code', summary, files: [...] }`.
7. **Leave a `// [claude-code 2026-04-19] …` header comment** at the top of substantially modified files.
8. **Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>** in every commit message.
9. **Only touch files your brief lists.** Cross-track file ownership is enforced — see the conflict matrix in [`S27-ORCHESTRATION.md`](S27-ORCHESTRATION.md).
10. **Do NOT touch `mobile/*`** — S26 absorbed mobile. Out of scope for S27.
11. **Do NOT restart `io.solvys.fintheon-backend`** while another track is also modifying it. Coordinate via the Orchestrator.
12. **Never rewrite history on v5.22 or main.** Feature branches only; merge to v5.22 via the Orchestrator.

## Ports

| Service                   | Local port                                                    | Prod                                           |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `fintheon` backend        | 8080                                                          | Fly app `fintheon`                             |
| `fintheon-hermes` sidecar | 8318                                                          | Fly app `fintheon-hermes`, internal networking |
| `fintheon-news-worker`    | 8082                                                          | Fly app `fintheon-news-worker`                 |
| Portless local hostnames  | `fintheon.test`, `hermes.fintheon.test`, `news.fintheon.test` | —                                              |

## Dependency Graph

```
Orchestrator kickoff (stubs on v5.22)
    ↓
W1a (T1 schemas) ─┐
W1b (T2 sidecar) ─┼─ parallel
W1c (T4 browser) ─┤
W1d (T8 SOUL + T9 foundation) ─┘
    ↓
Orchestrator mid-sprint checkpoint → SendMessage unlocks Wave 2
    ↓
W2a (T1 renderers) ─┐              depends on W1a + W1d
W2b (T2 DAG + T3 handoff) ─┤       depends on W1a + W1b + W1d
W2c (T5 voice) ─┼─ parallel        depends on W1b + W1d
W2d (T6 + T7) ─┤                   depends on W1c
W2e (T9 live + T10 + T11) ─┘       depends on W1b + W1d
    ↓
Orchestrator final sanitation → v.27.10 tag → /solvys-deploy
```

## Ship Tags

- `v.27.0-kickoff` — Orchestrator skeleton stubs (this commit, already landed)
- `v.27.1` — W1a schemas
- `v.27.2` — W1b sidecar
- `v.27.3` — W1c browser + telemetry
- `v.27.4` — W1d SOUL + routing foundation
- `v.27.5` — W2a cards UI
- `v.27.6` — W2b context + handoff
- `v.27.7` — W2c voice
- `v.27.8` — W2d browser ops + news worker
- `v.27.9` — W2e routing live + hub + GEPA
- `v.27.10` — Orchestrator unified release

## Common Failure Modes — Avoid These

- **Reimplementing Hermes internals in TypeScript.** T2 is a Python sidecar. `shared/sidecar-contract.ts` types + `sidecar-client.ts` HTTP wrapper is all the TS that should exist for agent runtime.
- **Copy-pasting `CLAUDE.md` into SOUL.md.** SOUL imports it literally. CI drift guard (`scripts/soul-ground-check.ts`) fails if you duplicate.
- **Touching files outside your brief's "Files to touch" list.** The conflict matrix exists because cross-track file edits cause merge hell. Ask the Orchestrator if unsure.
- **Starting `npx vite` for visual verification.** Build-only per TP's rule. Write a Playwright spec instead if you need runtime verification.
- **Skipping the changelog append.** Other agents (Cursor, Codex, Harper) read `src/lib/changelog.ts` to know what's intentional. No entry = your change is unattributed and risks being reverted.
- **Push-before-build.** Always run `bun run build` + `tsc --noEmit` + `vite build` BEFORE you commit, not after.

## When In Doubt

1. Re-read your task brief.
2. Re-read [`S27-ORCHESTRATION.md`](S27-ORCHESTRATION.md) conflict matrix.
3. Re-read [`CLAUDE.md`](../../CLAUDE.md).
4. Still stuck? Write what you're stuck on to `memory/s27-{your-claude-id}-blocker.md` and signal the Orchestrator. Do NOT guess.
