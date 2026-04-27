# S45 — Discovery Q&A Reference

> All decisions locked at sprint kickoff. Both T1 and T2 should treat these as authoritative.

## R1 — Scope & Surface

**Q: Polygon vs Yahoo for Day Card price math?**
A: Neither. **TradingView API** is the data source. Backend uses the existing `backend-hono/src/services/skills/tradingview-trade-plan.ts` Claude Computer Use pattern to fetch OHLCV bars; day-plan-service computes time-anchored VWAP, POC, VAH, VAL server-side. Kronos is OUT.

**Q: Desk Drift trade-event source?**
A: **Loose polling, 15-minute interval.** Cron in `backend-hono/src/services/cron/` scans `trades.entry_at > last_seen`, cross-checks active windows, emits drift event if outside.

**Q: Mobile bulletin scope?**
A: **Full bulletin tab, parity with desktop.** 5th section added to BOTH `frontend/components/StickyBulletin.tsx` AND `mobile/components/bulletin/MobileBulletin.tsx`.

**Q: Hermes calibration agent / weekly batch?**
A: **No offline weekly batch.** New model:

- Weekly **pre-population pass** lays out trading-window TIMES from econ calendar + earnings (no prices)
- **Day-of plan generator** publishes the actual Day Card ONCE for the whole team (one plan per day, broadcast to every PIC user)
- TP overrides via **CAO chat** ("Harper, redo today's plan because X")
- Self-improvement is conversational through Harper-chat, NOT a Sunday batch
- Plan is team-scoped (one PIC team today; design supports multi-team later)
- **LLM:** `claude-sonnet-4-6` via VProxy gateway (`http://localhost:8317`). Not Opus, not Qwen.

## R2 — Architecture & Constraints

**Q: Branch strategy?**
A: **Single shared branch `s45-day-card`.** Both tracks push there.

**Q: Streak rule?**
A: **P&L-only.** Day green (positive P&L) at 4pm ET close = streak +1. Day red = streak break. Plan adherence is observability and Harper context only — NOT a streak input.

**Q: Plan publish trigger?**
A: **Cron primary at 6:15 ET weekdays + lazy backstop on first Sanctum open.**

**Q: Kronos?**
A: **Out.** TV API is the data path.

## R3 — Validation & Aesthetic

**Q: Emotional resonance signal source?**
A: Existing PsychAssist matrix (`backend-hono/src/services/psych-assist/`). Extension: when a trader drifts off Desk Theme, apply a **static -5 to ER score that does NOT heal** for the rest of the day, plus log a **"drifted from desk theme" infraction in Performance Journal** via `writeAnnotation()`.

**Q: Dead Volume detection?**
A: **Time-of-day only — 45 minutes after the LAST trading window ends.** Not calculated from actual volume. Pure rule. Purpose is situational awareness ("market makers don't sweat the markets all day"), not volume math.

**Q: Daily P&L source for streak ledger?**
A: **ProjectX account balance delta.** Start-of-day balance pulled at 6:15 ET pre-cron, end-of-day balance at 16:00 ET, delta determines green/red day.

**Q: Per-track validation gate?**
A: All four:

- `npx tsc --noEmit` clean
- `rm -rf dist && npx vite build` clean (T2)
- `cd backend-hono && bun run build` clean (T1)
- Curl smoke on every new route
- Browser Harness Playwright pass on staging

## Hard rules carried into both tracks

- **Visual:** new surfaces use a **fading-ruler-line divider** (transparent → `rgba(199,159,74,0.35)` → transparent), NOT glass borders. No kanban borders, no card-outlines.
- **Banned ornaments:** no emojis, no AI sparkles, no gradients-as-fills (the FadingRuler IS a divider, not a fill — distinction is intentional).
- **Palette:** BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`.
- **Streak count:** plan-adherence streak is OUT. Only P&L-based green-day streak.
- **Faded vs Sat-out:** both preserved as feedback options for observability; Faded with reason logged is encouraged but does NOT affect streak.
- **Brief surface:** ONE compact Desk Theme block per scheduled brief (MDB / ADB / PMDB / TWT). Fixed shape, fixed grammar. Titles left-justified, values right-justified, monospace gutter. Two entries max, one target. No commentary.
- **Plan distribution:** team-shared, single-publish per day. One plan, all PIC users.
- **TP override:** CAO chat ("redo today's plan because X") regenerates via day-plan-service.

## Deferred to post-build (NOT blocking S45 kickoff)

1. **`trades.user_id` historical backfill** — projectx-sync + autopilot-scheduler currently insert NULL. T1 fixes forward. Orchestrator runs a one-time backfill at Wave 2 unification.
2. **Multi-team scaffolding** — `day_plans.team_id` defaults to `'pic'`; team-management UI is V2.
3. **Performance Journal infraction surface** — drift infractions write to `refinement_annotations`; UI surface for the infraction list is V2 (TP can query Supabase directly post-ship).
4. **TV Computer Use cost monitoring** — propose envelope to TP at unification.
