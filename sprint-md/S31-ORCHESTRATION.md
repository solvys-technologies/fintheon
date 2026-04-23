# S31 — Harper 2.1 — Orchestration

**Sprint 2 of the S30/S31/S32 Super Sprint.**
**Codename**: Harper 2.1 — perception + agency refinement pass.
**Branch**: `s31-harper-2-1` (cut off `main` AFTER S30 merges).
**Baseline**: post-S30 `main`.
**Target version**: v5.23.0 at Super Sprint end.

## Composition

Four tracks. T1 is sequential (everything else depends on it); T2/T3/T4 run in parallel after T1 merges.

### Wave 1 — Sequential (T1 only)

```
@sprint-md/S31-T1-kimi-rollback-vproxy-reinstate.md
```

**T1** strips the Kimi K2 / GitHub Models experiment, deletes the GitHub OAuth flow + UpdateBanner, and reinstates VProxy (`localhost:8317`) as the primary agentic provider. Pure subtractive — no new UI, no new routes, no schema change. This is TP's existing brief, renamed to fit the track numbering.

### Wave 2 — Parallel (T2, T3, T4 after T1 merges)

```
@sprint-md/S31-T2-harper-vision-refinement.md
```

```
@sprint-md/S31-T3-ollama-hermes-fallback.md
```

```
@sprint-md/S31-T4-consul-control-pixelation-indicator.md
```

**T2** fixes Kimi's Harper Vision work (audit verdict: refine, don't throw out): repairs the `VoiceTranscribeResult.confidence` TS build error, wires `generateDescriptionAsync` to a real VProxy vision call, dispatches trigger detections to the boardroom DAG (currently dead data), wires the privacy toggle end-to-end, strips the `backdrop-blur` glass violations from `VisionPanel`, implements a real `/status` endpoint (currently hardcoded), and adds a storage-bucket provisioning step + daily retention Routine.

**T3** adds an **Ollama-via-Hermes fallback** for every agentic operation. Primary stays VProxy (reinstated by T1); when it errors or times out, every call — Harper chat, Strands agents, brief generator, Harper Vision descriptions, desk agents — silently retries once against Ollama running Qwen's latest free cloud model (**confirm exact model ID with TP**; candidate `qwen3-coder:480b-cloud`). Response shape is identical regardless of which provider answered. `/api/diagnostics` reveals the source.

**T4** replaces the solid-color Consul Control overlay (Harper's Playwright-style app-control indicator) with animated **Solvys Gold pixel corners** that flicker at varying alpha — transparency + character, no blur, no gradients.

### Wave 3 — Unification (orchestrator-run)

- Merge T2/T3/T4 onto `s31-harper-2-1`
- Resolve any overlap in `/api/diagnostics` between T2 (adds vision-status) and T3 (adds ai-chain) — they touch different keys of the same JSON, should merge cleanly
- Run validation stack
- Test end-to-end: kill VProxy → Harper Vision description falls back to Ollama (exercises T2 + T3 together); activate Consul Control → corners animate (T4)
- Changelog consolidated entry
- Restart launchd backend

## Critical File Ownership

| File                                                          | Owner                                          | Notes                                                         |
| ------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `backend-hono/src/services/harper-vision/engine.ts`           | T2                                             | fix + trigger dispatch                                        |
| `backend-hono/src/services/harper-vision/frame-store.ts`      | T2                                             | wire VProxy description                                       |
| `backend-hono/src/routes/harper-vision/index.ts`              | T2                                             | real /status                                                  |
| `frontend/components/harper-vision/VisionPanel.tsx`           | T2                                             | glass removal + privacy wire                                  |
| `electron/services/harper-vision-screen.cjs`                  | T2                                             | privacy gate                                                  |
| `electron/services/harper-vision-audio.cjs`                   | T2                                             | privacy gate                                                  |
| `backend-hono/src/services/ai/provider-chain.ts`              | T3                                             | new                                                           |
| `backend-hono/src/services/ai/ollama-hermes-client.ts`        | T3                                             | new                                                           |
| `backend-hono/src/services/harper-handler.ts`                 | T3                                             | refactor to chain                                             |
| `backend-hono/src/services/strands/agents/*.ts`               | T3                                             | refactor to chain                                             |
| `backend-hono/src/routes/diagnostics*.ts`                     | T2 + T3                                        | additive only — T3 adds `ai`, T2 may add `vision` sibling key |
| `frontend/components/consul-control/ConsulControlCorners.tsx` | T4                                             | new                                                           |
| `frontend/App.tsx`                                            | T1 (UpdateBanner removal) + T4 (corners mount) | two separate edits, easy unification                          |

## Dependency Graph

```
T1 (rollback) ──► T2 (vision refinement) ──┐
                  T3 (ollama fallback)   ──├──► unification ──► tag v5.23.0
                  T4 (consul corners)    ──┘
```

T2 specifically depends on T1 reinstating VProxy because T2's `generateDescriptionAsync` routes through it. T3 depends on T1 because it wraps VProxy in a provider chain.

## Wave 3 Unification Checklist (orchestrator)

1. Merge T2/T3/T4 onto `s31-harper-2-1`.
2. Confirm `/api/diagnostics` returns both `ai` (from T3) and `vision` status cleanly.
3. Run validation stack:
   ```bash
   npx tsc --noEmit --project frontend/tsconfig.json
   cd backend-hono && bun run build && cd ..
   rm -rf dist && npx vite build
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   ```
4. End-to-end smoke:
   - VProxy up → Harper chat works via VProxy; Harper Vision description semantic; trigger dispatch fires
   - VProxy down → same calls succeed via Ollama; logs tagged `[ai-chain] fallback`
   - Privacy toggle → capture stops; `harper_vision_frames` row count stops growing
   - Consul Control activation → gold pixel corners animate; deactivation fades cleanly
5. Hand the retention-cleanup migration (`035_harper_vision_storage.sql` if added) to TP for `supabase db push`.
6. Document the two new Routines for TP to wire via Harper Ops:
   - `harper-vision-cleanup` (daily 3am ET)
   - (existing T2 `hermes-daily-summary` + `daily-market-summary` from S30)
7. Changelog consolidated entry + per-file header comments.

## Post-S31

- `main` now has: Performance tab overhaul (S30) + Harper 2.1 refinement (S31)
- Ready for S32 (third Super Sprint area — pending TP brief)
- Single `/solvys-deploy` with version bump v5.23.0 at end of Super Sprint
