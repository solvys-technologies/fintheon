# S27 — Agentic Intelligence Sprint (10-Claude Edition)

## Context

TP mined `github.com/solvys` stars, ran a Fintheon audit, and chose to absorb every S28 strategic item into S27 because the 10-Claude-instance capacity supports it. This sprint delivers (a) ~7 star-derived wins, (b) full NousResearch Hermes Agent adoption via a Python sidecar so Fintheon becomes plugin-portable, and (c) SOUL.md + Smart Model Routing + Skills Hub + GEPA self-improvement as live production features — not foundation-only.

Full architectural plan lives at [`/Users/tifos/.claude/plans/concurrent-orbiting-widget.md`](~/.claude/plans/concurrent-orbiting-widget.md). This document is the sprint entry point: it assigns Claudes to work, sequences waves, and points to task briefs.

## Execution Model

**10 Claude Code instances in VSCode. Two waves, contract-first. One persistent orchestrator instance across three checkpoints.**

- Orchestrator = Claude-01. Resumed via `SendMessage` at kickoff, mid-sprint, and final sanitation. Writes snapshots to `memory/s27-orchestrator-state.md` so it survives crashes.
- Wave 1 (Claudes 02–05) lands foundations. Nothing in Wave 2 starts until the orchestrator's mid-sprint checkpoint greenlights each foundation contract.
- Wave 2 (Claudes 06–10) builds on top in parallel.
- Each worker Claude runs in its own worktree off `v5.22`, on a feature branch `s27-w{slot}-{slug}`. Orchestrator merges to `v5.22` as each lands with ship tag `v.27.N`.

## Confirmed Scope

Seven S27 wins + four absorbed S28 items. Detailed in the master plan.

- T1 — Generative UI cards (`vercel-labs/json-render`-inspired)
- T2 — Hermes Python sidecar + Lossless Context (real NousResearch Hermes Agent, not a native TS port)
- T3 — A2A handoff (Harper → Oracle/Feucht/Consul/Herald as first-party tools)
- T4 — Shared browser primitives + Rettiwt cut + headline-volume telemetry (`browser-use/browser-harness` replaces Rettiwt, also acts as fallback)
- T5 — Voice Assistant completion (fixes broken OpenAI path; voicebox/Qwen3-TTS + free Qwen reasoning via sidecar; rim UX, never interrupts trading view)
- T6 — Harper Browser Operator (Hyperagent-inspired `page.ai` + `page.extract` + Supabase-backed action cache)
- T7 — Always-On News Worker + portless (`news.fintheon.test`, self-healing)
- T8 — SOUL.md full conversion (all 5 agents, Harper `CLAUDE.md` as source of personal truth — load-bearing for T5)
- T9 — Smart Model Routing (per-agent model live: Oracle→Opus, Feucht→Haiku, Consul→Sonnet, Herald→Haiku, Harper→Opus)
- T10 — Skills Hub full adoption (`agentskills.io` manifests, security scanning, hub importer)
- T11 — GEPA self-improvement loop (DSPy evolutionary optimization, opens PRs to `soul-evolution/` for TP review)

## Claude Assignments

### Claude-01 — Orchestrator (persistent, 3 checkpoints)

Single instance resumed via `SendMessage`.

**Kickoff** — create 9 worktrees off `v5.22`; land skeleton stubs (`shared/harper-cards.ts`, `backend-hono/src/services/browser/`, `backend-hono/src/services/ai/soul/`, Hermes sidecar boot config); brief each Wave 1 Claude by pointing them at their task file + this orchestration doc; verify Hermes sidecar boots green locally before releasing Wave 1 to run.

**Mid-sprint** — verify all 4 Wave 1 branches merge cleanly into `v5.22`. Run full build + tsc + `/api/diagnostics`. Confirm shared contracts (card schema, SOUL schema, browser primitives, sidecar HTTP) are stable. Gate any bad foundation work before Wave 2 propagates it. Then brief each Wave 2 Claude.

**Final sanitation** — integration QA. Full build, tsc, smoke tests for each track's happy path + one edge case (see Verification below). Resolve cross-track merge conflicts. Stamp `v.27.10` unified release tag. Trigger `/solvys-deploy`.

### Wave 1 — Foundation (Claudes 02–05, parallel)

| Claude        | Task                                                          | Branch                 | Worktree                                          | Brief                                                                                                                        |
| ------------- | ------------------------------------------------------------- | ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Claude-02** | W1a — T1 schema layer                                         | `s27-w1a-schema`       | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1a` | [S27-T1-generative-ui-harper.md §1](S27-T1-generative-ui-harper.md)                                                          |
| **Claude-03** | W1b — T2 Hermes sidecar infra                                 | `s27-w1b-sidecar`      | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1b` | [S27-T2-context-sandbox.md §1-3](S27-T2-context-sandbox.md)                                                                  |
| **Claude-04** | W1c — T4 browser primitives + Rettiwt cut + telemetry         | `s27-w1c-browser`      | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1c` | [S27-T4-herald-browser.md](S27-T4-herald-browser.md)                                                                         |
| **Claude-05** | W1d — T8 SOUL.md + T9 routing foundation + manifest scaffolds | `s27-w1d-soul-routing` | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1d` | [S27-T8-soul-conversion.md](S27-T8-soul-conversion.md) + [S27-T9-smart-model-routing.md §1-2](S27-T9-smart-model-routing.md) |

### Wave 2 — Implementation (Claudes 06–10, parallel, starts after mid-sprint checkpoint)

| Claude        | Task                                                   | Branch                     | Worktree                                          | Brief                                                                                                                                                               |
| ------------- | ------------------------------------------------------ | -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude-06** | W2a — T1 renderers + Harper prompt + stream parser     | `s27-w2a-cards-ui`         | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2a` | [S27-T1-generative-ui-harper.md §2-5](S27-T1-generative-ui-harper.md)                                                                                               |
| **Claude-07** | W2b — T2 DAG engine + T3 A2A handoff                   | `s27-w2b-context-handoff`  | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2b` | [S27-T2-context-sandbox.md §4-6](S27-T2-context-sandbox.md) + [S27-T3-a2a-handoff.md](S27-T3-a2a-handoff.md)                                                        |
| **Claude-08** | W2c — T5 voice assistant full loop                     | `s27-w2c-voice`            | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2c` | [S27-T5-agent-voice-briefs.md](S27-T5-agent-voice-briefs.md)                                                                                                        |
| **Claude-09** | W2d — T6 Harper Browser Operator + T7 News Worker      | `s27-w2d-browser-ops`      | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d` | [S27-T6-harper-browser-operator.md](S27-T6-harper-browser-operator.md) + [S27-T7-news-worker.md](S27-T7-news-worker.md)                                             |
| **Claude-10** | W2e — T9 routing live + T10 Skills Hub + T11 GEPA loop | `s27-w2e-routing-hub-gepa` | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e` | [S27-T9-smart-model-routing.md §3-5](S27-T9-smart-model-routing.md) + [S27-T10-skills-hub.md](S27-T10-skills-hub.md) + [S27-T11-gepa-loop.md](S27-T11-gepa-loop.md) |

## Dependency Graph

```
Orchestrator kickoff
    ↓
Claude-02 (W1a) ─┐
Claude-03 (W1b) ─┼─ (parallel)
Claude-04 (W1c) ─┤
Claude-05 (W1d) ─┘
    ↓
Orchestrator mid-sprint checkpoint (gates Wave 1 foundations)
    ↓
Claude-06 (W2a, needs W1a + W1d) ─┐
Claude-07 (W2b, needs W1a + W1b + W1d) ─┤
Claude-08 (W2c, needs W1b + W1d) ─┼─ (parallel)
Claude-09 (W2d, needs W1c) ─┤
Claude-10 (W2e, needs W1b + W1d) ─┘
    ↓
Orchestrator final sanitation → v.27.10 → /solvys-deploy
```

## Conflict Matrix

Files with multi-Claude overlap. Last-writer-wins is explicit, not accidental.

| File / Area                                      | Owner(s)  | Resolution                                                                                                          |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `shared/*.ts`                                    | W1a       | W1a owns; W2a/W2b/W2c/W2e consume read-only                                                                         |
| `backend-hono/src/services/browser/`             | W1c       | W1c owns; W2d consumes read-only                                                                                    |
| `backend-hono/src/services/ai/sidecar-client.ts` | W1b       | W1b owns; W2b/W2c/W2e consume read-only                                                                             |
| `backend-hono/src/services/ai/soul/*.md`         | W1d       | W1d owns; W2c/W2e consume read-only; GEPA (W2e) opens PRs against `soul-evolution/` only                            |
| `backend-hono/src/services/ai/routing.ts`        | W1d + W2e | W1d lands scaffolding + defaults; W2e flips to live per-agent routing. Sequential, not concurrent                   |
| `backend-hono/src/services/harper-handler.ts`    | W2a + W2b | W2a adds card emission to prompt; W2b adds handoff tools. Sections of the same file — W2a merges first, W2b rebases |
| `src/lib/changelog.ts`                           | all       | each Claude appends one entry on merge; orchestrator resolves any merge conflicts in final pass                     |

## Ship Tags

- `v.27.1` — W1a schemas merge
- `v.27.2` — W1b sidecar merge
- `v.27.3` — W1c browser + telemetry merge
- `v.27.4` — W1d SOUL + routing foundation merge
- `v.27.5` — W2a cards UI merge
- `v.27.6` — W2b context + handoff merge
- `v.27.7` — W2c voice assistant merge
- `v.27.8` — W2d browser ops + news worker merge
- `v.27.9` — W2e routing live + hub + GEPA merge
- `v.27.10` — Orchestrator unified release tag

## Verification (orchestrator final pass)

1. `cd backend-hono && bun run build` clean.
2. `cd frontend && npx tsc --noEmit` clean.
3. `cd frontend && find dist -mindepth 1 -delete && npx vite build` clean.
4. `launchctl list | grep io.solvys.fintheon` shows `-backend`, `-hermes`, `-news-worker` all green.
5. `curl http://localhost:8080/api/diagnostics` green; `/api/diagnostics/headline-volume` returns 48h pre/post source counts.
6. Per-track smoke (one happy path + one edge case each):
   - **T1** — Harper asked for NQ support/resistance → `price-level` card renders; malformed-card fuzz → fallback renders, no blank bubble.
   - **T2/T3** — 100-turn Hermes conversation stays under budget via sidecar; Harper invokes `handoff_to_feucht` on a mixed macro/levels question; Oracle→Oracle self-handoff rejected by depth cap.
   - **T4** — Fetch SEC 8-K detail URL that 403'd pre-S27 → full body returned; Rettiwt-to-browser-harness migration evident in `v_headline_volume_48h`.
   - **T5** — Tap mic → rim activates over electron window chrome → greeting plays → user speech streams → agent voice starts <2s after speech ends → interrupt mid-response works → dismiss closes rim without data loss.
   - **T6** — Harper given `browse_task` → action cache populated; second call uses cached XPath replay, zero LLM cost.
   - **T7** — News worker 24h uptime green; launchd restart test triggered + recovered; `news.fintheon.test` resolves from another process.
   - **T8** — Modifying `CLAUDE.md` changes agent behavior on next restart across main chat + voice assistant.
   - **T9** — `routing_decisions` table shows Oracle traffic on Opus, Feucht traffic on Haiku.
   - **T10** — `agentskills.io` manifest validates for all 5 desks; external-skill security scan rejects a known-bad test payload.
   - **T11** — `gepa_metrics` populated; at least one evolution PR opened against `soul-evolution/` branch for a real metric drop.

## Out of Scope

- Mobile PWA (S26 absorbed mobile; S27 does not touch `mobile/`)
- Rettiwt rewrite (it's cut, not replaced in kind)
- Brief-narration audio pipeline (original T5 scope — dropped in favor of voice-assistant fix)
- Prediction-market order placement (T4/T6 read + extract only)
- Cult-ui / Recordly / wterm / CL4R1T4S polish (Tier B stretch, not in S27)

## Risk Register

See master plan. Summary:

- Hermes sidecar fragility → rollback flag `HERMES_SIDECAR_ENABLED=false`
- browser-harness coverage gaps → Rettiwt code inert not deleted, headline-volume metric surfaces gaps
- Voice <2s latency aggressive → fallback to smaller Qwen with quality gate
- A2A loops → depth cap 2 + visited set
- GEPA auto-drift → never auto-merge, PRs against evolution branch
- Orchestrator crash → snapshots to `memory/s27-orchestrator-state.md`

## Post-Sprint

Run `/install-maintenance` after `v.27.10` merges to `v5.22`. Audit setup/update scripts for env var drift + dep sync. Verify launchd units for all three services exist in repo.
