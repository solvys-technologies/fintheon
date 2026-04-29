# S31 — Harper — Orchestration

**Sprint for Harper (S32).**
**Codename**: Harper — perception, reasoning, and advisory refinement.
**Branch**: `s32-harper-2-1` (cut off `main` AFTER S30 merges).
**Target version**: v5.23.0 at Super Sprint end.

## Composition

**Wave 1** (sequential prereq): T1.
**Wave 2** (parallel, 8 tracks): T2–T9. All non-conflicting; each owns a distinct module. Up to 14 VS Code windows available — run them all at once.
**Wave 3** (unification): orchestrator merges.

### Wave 1 — T1 sequential

```
@sprint-md/S32-T1-kimi-rollback-vproxy-reinstate.md
```

**T1** — TP's Kimi rollback brief. Strips Kimi K2 / GitHub Models + GitHub OAuth + UpdateBanner; reinstates VProxy (`localhost:8317`) as primary. Everything else depends on this.

### Wave 2 — parallel (T2–T9)

```
@sprint-md/S32-T2-harper-vision-refinement.md
```

```
@sprint-md/S32-T3-ollama-hermes-fallback.md
```

```
@sprint-md/S32-T4-consul-control-pixelation-indicator.md
```

```
@sprint-md/S32-T5-streamdown-and-tradingview-charts.md
```

```
@sprint-md/S32-T6-psychassist-gating-and-blindspots.md
```

```
@sprint-md/S32-T7-harper-advisory-and-calendar-pill.md
```

```
@sprint-md/S32-T8-browser-harness-voice-orb-sidebar-chat.md
```

```
@sprint-md/S32-T9-predictive-feature-knowledge-graph.md
```

### Wave 3 — unification (orchestrator)

- Merge T2–T9 onto `s32-harper-2-1`
- Resolve additive conflicts in `/api/diagnostics` (T2, T3, T7 all append keys; union should merge cleanly)
- Resolve additive conflicts in `shared/index.ts` (every track appends types)
- Resolve additive conflicts in `backend-hono/src/routes/index.ts` (every backend track appends mounts)
- Hand all migrations to TP for `supabase db push`:
  - `034_harper_vision_storage.sql` (T2, if storage-bucket SQL path was chosen)
  - `035_blindspots.sql` (T6)
  - `036_watchouts.sql` (T7)
  - `037_browser_harness_audit.sql` (T8)
  - `038_usage_telemetry.sql` (T9)
- Wire new Routines via Harper Ops (TP action, docs shipped by each track):
  - `blindspots-nightly` (T6, Mon–Sat 3am ET)
  - `feature-proposals-weekly` (T9, Sun 6pm ET)
  - `harper-vision-cleanup` (T2, daily 3am ET)
- Run validation stack + end-to-end smoke
- Changelog consolidated entry + per-file header comments

## Track Ownership Matrix

| Track | Scope                                                                                                                | Key files                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| T1    | Kimi rollback, VProxy reinstate                                                                                      | TP's brief                                                                                     |
| T2    | Harper Vision fixes (TS error, trigger dispatch, privacy wire, LLM descriptions, glass removal)                      | `harper-vision/**`                                                                             |
| T3    | VProxy → Ollama/Hermes fallback chain on every agentic call                                                          | `services/ai/provider-chain.ts`, all agentic call sites                                        |
| T4    | Animated Solvys Gold pixel corners for Consul Control                                                                | `components/consul-control/ConsulControlCorners.tsx`                                           |
| T5    | Streamdown rich chat + TradingView lightweight charts                                                                | `components/chat/slots/*`, streamdown install                                                  |
| T6    | PsychAssist gating + psych_blindspots + trading_blindspots + ER monitor + over-trading nudge (ONLY push-nudge)       | `services/blindspots/*`, `services/psych/*`, migration 036                                     |
| T7    | Advisory: calendar pill, autopilot guardian (non-psych), size suggestion, blindspots UI wiring, watchouts silent log | `components/layout/CalendarCountdownPill.tsx`, `services/autopilot/guardian.ts`, migration 037 |
| T8    | browser-harness tool for Harper + voice orb toggle + sidebar chat takes over Omi quick-chat                          | browser_harness tool registration, voice orb, sidebar mount                                    |
| T9    | Predictive knowledge graph — usage telemetry + weekly feature proposals                                              | `services/knowledge-graph/proposer.ts`, migration 039                                          |

## Shared-File Coordination

| File                                            | Tracks appending                                                                                                                                                                                       | Merge strategy                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `backend-hono/src/routes/index.ts`              | T2 (vision), T6 (blindspots, harper-ops), T7 (calendar, advisory, watchouts, autopilot), T8 (usage-events not applicable, but browser-harness admin), T9 (usage-events, feature-proposals, harper-ops) | Each track appends its mounts at the bottom in a labeled block `// [S32-T#] mounts`. Orchestrator de-duplicates and orders logically. |
| `shared/index.ts`                               | T6 (`Blindspot`), T7 (`Watchout`), T9 (`UsageEvent`, `FeatureProposal`)                                                                                                                                | Append-only; orchestrator keeps ordering.                                                                                             |
| `user_preferences.prefs` JSONB                  | T6 (`psychAssistEnabled`), T7 (`autopilotGuardian`)                                                                                                                                                    | Single type definition updated in `shared/`; no schema collision since it's JSONB.                                                    |
| `/api/diagnostics`                              | T2 (`vision`), T3 (`ai` chain), T7 (`autopilot`)                                                                                                                                                       | Additive keys; orchestrator merges response builder.                                                                                  |
| `frontend/components/journal/BlindspotsRow.tsx` | S30-T2 creates, S32-T7 wires to live endpoints                                                                                                                                                         | T7's edit overlays T2's; clean additive.                                                                                              |

## Dependency Graph

```
T1 (rollback) ──► T2 (vision refine) ─┐
                  T3 (ollama chain)   ├─► Wave 3 unification ──► tag v5.23.0
                  T4 (consul corners) │
                  T5 (streamdown+tv)  │
                  T6 (psych+blindspots)│
                  T7 (advisory+pill)  │
                  T8 (browser+voice)  │
                  T9 (knowledge graph)┘
```

T2 depends on T1 for VProxy. T3 depends on T1 for VProxy. T5 has no runtime dep on others but its `tv-chart` slot pairs well with T7's calendar pill. T6 + T7 share PsychAssist semantics — T6 owns the gating source of truth; T7 reads.

## Wave 3 Unification Checklist

1. Merge all 8 Wave-2 branches onto `s32-harper-2-1`.
2. Resolve additive conflicts per matrix above.
3. Run:
   ```bash
   npx tsc --noEmit --project frontend/tsconfig.json
   cd backend-hono && bun run build && cd ..
   rm -rf dist && npx vite build
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   ```
4. End-to-end smoke matrix:
   - VProxy up + Harper chat → replies via VProxy
   - VProxy down → replies via Ollama-Qwen, log tagged `[ai-chain] fallback`
   - Start Harper Vision capture → ask "what do you see?" → semantic response (not just window title)
   - Toggle Privacy mode → frames stop arriving
   - Trigger Consul Control → gold pixel corners animate
   - Emit `catalyst-card` JSON block from Harper → streamdown renders the card
   - Render `tv-chart` slot → candle chart appears with overlays
   - PsychAssist OFF → BlindspotsRow shows empty-state CTA; no nightly rows written
   - PsychAssist ON → manual-trigger nightly → rows appear in both blindspot tables
   - 30 rapid trades in 5 min (while PsychAssist ON) → single over-trading nudge fires; rate-limit blocks repeat for 60 min
   - Autopilot guardian → simulate drawdown trigger → autopilot pauses
   - Calendar pill → set next event 4 min out → pill fades in with "{name} — 4 min"
   - Voice orb → single click starts Omi session, orb pulses
   - Sidebar chat open → Omi quick-chat floater hidden
   - Harper asked "look something up" → `browser_harness` tool fires, audit row written
   - Emit 50 usage events → run weekly proposer → proposals appear in settings panel (none forced)
5. Hand migrations to TP; wire Routines.
6. Changelog entry + per-file headers.
7. Post-ship: `/install-maintenance` audit.

## Post-S31

- `main` now has: Performance tab overhaul (S30) + Harper refinement (S31)
- Ready for S32 (third Super Sprint area — pending TP brief)
- Single `/solvys-deploy` with version bump v5.23.0 after S32 lands
