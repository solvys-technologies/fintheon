# S59 Orchestration — Hermes App-Native Runtime: Agent Persona Restoration + Self-Learning Loop

**Sprint:** S59
**Date:** 2026-05-05
**Branch:** `s59-hermes-native` (shared)
**Tracks:** 4 (3 parallel + 1 sequential unify)
**Breakage tolerance:** Harper chat, agent responses, RiskFlow feed, daily briefs (MDB/ADB/PMDB/TWT) must not regress. Everything else is fair game.
**Provider:** All agents route through `deepseek-reasoner` (DeepSeek v4 Pro). No more `nous` or `claude-code` provider paths for agent desks.

## What This Sprint Does

S55 Wave 2 deferred "Hermes App-Native Runtime migration, DeepSeek/NOUS routing, MCP governance, and self-improving plugins." This sprint delivers that. The Python Hermes sidecar is stripped entirely. Hermes Agent architectural patterns (SOUL.md personas, lossless context, skills catalog, learning loop) are ported to native TypeScript in backend-hono. All 5 agents get their SOUL.md-based identity restored — they know Fintheon is their native home, Priced In Capital is the firm they represent, and their specific role in the agentic hedge fund. Autoresearcher/REFLECT already writes to all agents (verified in code). GEPA already covers all agents. This sprint unifies the persona pipeline and surfaces agent health in the Apparatus dashboard.

## Track Summary

| Track | Title | Complexity | Est. Files | Depends On |
|-------|-------|-----------|------------|------------|
| T1 | Sidecar Removal + Native Hermes Agent Core | High | ~18 files | None |
| T2 | Persona Unification — SOUL.md as Canonical Source for ALL Agents | High | ~14 files | None |
| T3 | Agent Health Dashboard + Persona Status UI | Medium | ~8 files | None |
| T4 | Unification + Full Stack Validation | Medium | merge + changelog | T1, T2, T3 |

## Wave 1 — T1, T2, T3 in parallel

All three tracks work on disjoint file sets. No file overlap. T1 owns backend-hono/src/services/hermes/ + sidecar removal. T2 owns SOUL.md files + strands agents. T3 owns frontend/ + mobile/ UI.

## Wave 2 — T4 (after T1 + T2 + T3)

T4 merges, resolves conflicts, runs full validation suite.

## Execution Sequence

### Wave 1 (parallel)

```
@sprint-md/S59-T1-sidecar-removal-hermes-native.md
```

```
@sprint-md/S59-T2-persona-unification.md
```

```
@sprint-md/S59-T3-agent-health-dashboard.md
```

### Wave 2 (after Wave 1)

```
@sprint-md/S59-T4-unification.md
```

## Conflict Prevention

- **No file overlap between T1, T2, T3.** T1 owns `backend-hono/src/services/hermes/`, `hermes-sidecar/`, `backend-hono/src/services/ai/sidecar-client.ts`, and env/config files. T2 owns `backend-hono/src/services/ai/soul/*.md`, `backend-hono/src/services/strands/agents/*.ts`, `backend-hono/src/services/ai/agent-instructions/index.ts`. T3 owns `frontend/components/apparatus/`, `frontend/components/diagnostics/`, `mobile/`.
- **Only shared file across all tracks:** `src/lib/changelog.ts`. T4 resolves the merge.
- **T1 and T2 both touch `backend-hono/src/boot/services.ts`** — T1 removes sidecar init, T2 may add SOUL preload. If both need it, T4 handles the merge. Each track documents what it needs from boot/services.ts.

## Post-Sprint

T4 runs `/solvys-deploy` to ship to all 3 targets (Fly.io backend, Vercel desktop, Vercel mobile).

## Pre-Flight Facts (verified against live tree)

- **REFLECT engine already writes to ALL 5 agents** — `reflect-engine.ts:434-489` distributes findings to `ALL_AGENTS: ["oracle", "feucht", "consul", "herald", "harper"]`. No code change needed.
- **GEPA runner already enumerates ALL 5 agents** — `runner.ts:20` has `AGENTS = ["harper", "oracle", "feucht", "consul", "herald"]`.
- **Agent memory system is fully built** — store, injector, feedback, outcome tracker, cron resolver all exist and are wired.
- **SOUL.md files exist for all 5 agents** — but strands agents (oracle, feucht, consul, herald) ignore them and use old `getAgentSystemPrompt()` instead.
- **Harper chat uses SOUL.md via `harper-handler.ts`** — the only production path that actually loads SOUL.
- **Hermes sidecar runtime.py is a STUB** — FastAPI scaffold is real but the core Hermes Agent runtime never runs. `GEPA_DEEP=true` env would trigger DSPy but sidecar routes aren't registered in app.py.
