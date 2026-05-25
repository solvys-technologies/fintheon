# S23 — ArbitrumChamber Consilium + Unified CAO Memory Bank

**Mode:** 1-man sequential sprint. Single agent executes T1 → T2 → T3 → T4 → T5.
**Branch:** `s20-agent-swarm-platform-ops` (continuing — branch still open, last commit `eba0aac`).
**Version:** `v.04.17.1`.
**Style gate:** all new UI must pass `/solvys-feels` — theme-sensitive via CSS custom properties (`var(--fintheon-accent)`, `var(--fintheon-bg)`, `var(--fintheon-text)`, `var(--fintheon-surface)`), 1px borders at 0.10 opacity, flat surfaces, no gradient/shadow/blur, monospace for data values.

## Sequence

### Wave 1 (sequential)

```
@docs/sprint-briefs/S23-T1-arbitrum-chamber-ui-restructure.md
```

```
@docs/sprint-briefs/S23-T2-arbitrum-chamber-delivery-hang-fix.md
```

```
@docs/sprint-briefs/S23-T3-harper-arbitrum-chamber-literacy.md
```

```
@docs/sprint-briefs/S23-T4-unified-cao-memory-bank.md
```

### Wave 2 (unification)

Orchestrating instance (this session) merges, builds, runs `/solvys-audit` and `/solvys-deploy` across all 3 targets (Fly.io backend + desktop Vercel + mobile Vercel), then performs the manual UX pass.

## Non-technical summary

- **T1** rebuilds the ArbitrumChamber page layout — removes the big QQQ chart at the top, replaces it with a side-by-side container matching the Dashboard brief pattern (Blended IV + Next Session Forecast on the left, MiroShark Deliberation on the right), swaps the DEBATE button for a CHART button that toggles a full-width TradingView view, and deletes the redundant iframe toggle from the Proposals panel.
- **T2** fixes the "Updating…" hang — when Harper finishes scoring a simulation, the frontend will now actually update the KPIs and Analysis instead of sitting stuck.
- **T3** teaches Harper (and the Hermes CAOs) how to read her own ArbitrumChamber output. Right now she treats simulation reports as broken pipelines.
- **T4** unifies all five CAOs onto a single memory bank — real user IDs, trader name in every prompt, explicit `[MEMORY]` writes, and an hourly summarizer that promotes recurring preferences/observations automatically.
- **T5** is build + deploy + verify.

## Conflict map

No parallel conflicts — single agent, sequential execution. Shared surfaces: `Sanctum.tsx` (T1+T2), `harper-handler.ts` (T3+T4), `hermes-handler.ts` (T3+T4). Order chosen so downstream tracks edit already-modified files.
