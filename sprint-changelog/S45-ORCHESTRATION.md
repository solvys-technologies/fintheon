# S45 — Day Card / Desk Drift / Plan Feedback Loop

**Branch:** `s45-day-card` (single shared)
**Tracks:** 2 parallel (T1 backend/brain, T2 frontend/surfaces)
**Unification:** orchestrator merge on `s45-day-card`, full validation suite, single PR

---

## Why this sprint

Pivots Fintheon's "infinite situational awareness" workspace back to a focused, prescriptive day-trading plan. Three feeds (TradingView chart, RiskFlow news, IV scoring matrix) collapse into:

- **Day Card** — single Sanctum surface answering "what should I do today?" with one trading window, prices of interest (entries), invalidation, profit target, expected-move, and a Desk Theme message tying the idea to the day's brief catalyst.
- **Streak hook** — green-day-only ledger. Daily P&L positive at 4pm ET close = streak +1; red day = reset. Plan adherence is observability, NOT a streak input.
- **Desk Drift** — Harper-voiced 15-min poll. Three message flavors gated by PsychAssist resonance + intraday P&L: Drift Alert (always), Tilt-stop (resonance unhealthy), Dead Volume Warning (resonance stable, green-on-day, 45 min after last window).
- **Plan Feedback Loop** — Followed / Faded / Sat-out triad in trading journal + Strategium bulletin. Reason chips. Observability only — Harper-chat references it, but it does NOT auto-tune any thresholds.

Plan generation is **team-shared, single-publish per day** (one plan for all PIC users), via `claude-sonnet-4-6` through VProxy gateway. Cron at 6:15 ET, lazy backstop on first Sanctum open. TP overrides via CAO chat.

Brief generator (MDB / ADB / PMDB / TWT) gets ONE inline **Desk Theme** block — fixed shape, fixed grammar:

```
Desk Theme
{1-sentence message tying idea to brief catalyst}

Event:                              {Event name or "—"}
Trading Window:                     {HH:MM-HH:MM (12h)}
Prices of Interest:                 {Entry-1}, {Entry-2}
Invalidation Point:                 {Price}
Profit Target:                      {Price}
```

Titles left-justified, values right-justified, monospace gutter. Two entries max, one target. NO calibration commentary, NO streak chatter, NO fade analysis.

**Visual rule (locked):** new surfaces use a fading-ruler-line divider (`linear-gradient(transparent → rgba(199,159,74,0.35) → transparent)`), NOT glass borders. No kanban borders, no card-outlines, no emojis, no AI sparkles.

---

## Track split

| Track                 | Owns                                                                                                                                                                                                  | LOC est. | Risk                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| **T1 — Data + Brain** | `backend-hono/services/day-plan/`, `desk-drift/`, `cron/`, `routes/day-plan/`, supabase migration, brief-generator splice, harper-handler override, PsychAssist drift hook, projectx-sync user_id fix | ~2,200   | Medium — TV Computer Use cost, ProjectX user_id retrofit |
| **T2 — Surfaces**     | `frontend/components/narrative/DayCard.tsx`, `strategium/`, `streak/`, `journal/PlanFeedbackBlock`, `shared/FadingRuler`, hooks, mobile bulletin tab, Sanctum + StickyBulletin + MobileBulletin edits | ~1,800   | Low — pure UI on stable hosts                            |

Tracks share zero source files. Both append entries to `src/lib/changelog.ts` (low-risk merge).

---

## Wave sequence

### Wave 1 (parallel — 2 VS Code windows on branch `s45-day-card`)

```
@sprint-md/S45-T1-data-brain.md
```

```
@sprint-md/S45-T2-surfaces.md
```

### Wave 2 (orchestrator unification)

- Merge both tracks' commits on `s45-day-card`
- Validate type parity: `backend-hono/src/types/day-plan.ts` ↔ `frontend/types/day-plan.ts` ↔ `mobile/types/day-plan.ts`
- Run full suite: `tsc --noEmit` (frontend + mobile + backend), `rm -rf dist && vite build` (frontend + mobile), `bun run build` (backend), curl smoke on every new route, Browser Harness Playwright pass
- Backfill historical `trades.user_id` (one-time script, orchestrator runs)
- Append single S45 changelog entry tying both tracks
- Open PR against `main`

---

## Reference

- **R1/R2/R3 Q&A:** `@sprint-md/S45-OPEN-QUESTIONS.md`
- **Plan file (full discovery transcript):** `~/.claude/plans/draft-a-2-track-parallel-rustling-pnueli.md`

---

## Banned ornaments (locked)

No kanban borders. No gradients-as-fills (the fading ruler divider is a divider, not a fill). No emojis. No AI sparkles. No card-outlines on new surfaces. Solvys palette only: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`.
