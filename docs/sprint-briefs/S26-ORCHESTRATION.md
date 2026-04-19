# S26 — Mobile UX Revisions + Maintenance Modal

## Context

TP audited the mobile PWA after S25 shipped (RiskFlow 24h hardening + Teams Card rewrite + SOTA notifications) and returned 10 revisions. This sprint executes them as a **sequential two-part single-agent handoff** — no parallel tracks. The incoming fresh thread runs **Part 1 to completion, commits, then runs Part 2**.

TP's exact framing:

> "invoke /solvys-orchestrate for this next part as a two-part sprint performed by one agent in a fresh thread"

## Execution Model

- **One agent, fresh thread.** No `/solvys-orchestrate` sub-agent spawn. The incoming Claude Code instance reads Part 1, executes all items, verifies, commits, then reads Part 2 and repeats.
- **No parallel tracks.** Every file is owned by one part only — no conflicts because there is nothing to conflict with.
- **Mobile-only sprint** (with two small backend additions in Part 2 item 9). Desktop frontend and core RiskFlow backend are out of scope.

## Sequencing Rationale

**Part 1 = low-risk polish.** Pure UI/config edits. No new modals, no backend routes, no gesture math, no shared-layout animation. Lets the agent build confidence on the codebase and unblocks testing surfaces that Part 2 needs clean.

**Part 2 = high-risk UX + backend.** Gesture-math rewrite of SnapSheet, full theme-picker overhaul, new backend route + modal for maintenance requests, and the choreographed IV-fuse animation between card → modal. These must land after Part 1 because they touch surfaces Part 1 is simultaneously adjusting.

## Sequence

### Part 1 — Polish + Cleanup

```
@docs/sprint-briefs/S26-PART-1-polish.md
```

Contains items 2, 3, 4, 6, 7, 8:

- Remove IV score from briefing modal
- Full-headline expansion + "view original" link
- Settings: invisible horizontal dividers
- Trader section: strip CAO/risk limits, make fields read-only
- Haptic feedback helpers
- About: website link to pricedinresearch.io/fintion

Ship: commit with `v.26.1` prefix after validation.

### Part 2 — Heavy UX + Backend

```
@docs/sprint-briefs/S26-PART-2-heavy.md
```

Contains items 1, 5, 9, 10:

- Bulletin scroll-lock (raise SnapSheet drag threshold, add pill-bar tap-to-close, content scrolls in place)
- Theme picker → full-bleed swatch dropdown + light/dark toggle in hamburger
- Maintenance request modal + backend route + 3-action super-admin flow
- RiskFlow card → catalyst modal + IV fuse drain/refill choreography

Ship: commit with `v.26.2` prefix after validation.

### Unification

No dedicated unification pass needed (sequential single-agent execution means every part exits in a committed, buildable state). Final step: confirm build + tsc clean, push `s24-unify`, run `/solvys-deploy`.

## Guardrails (read before touching anything)

1. **`mobile/components/shared/SnapSheet.tsx` was rewritten in S24.** Every popup in the mobile app now uses it — NotificationDrawer, MobileBulletin, BriefingCard, and the new DetailSheet for catalyst modals. Read the file and the S24 changelog entry before editing. Changes must preserve the top-anchored behavior and glassmorphic surface.
2. **Never start a vite dev server.** Verify via `cd mobile && npx tsc --noEmit` + `npx vite build` only.
3. **`find dist -mindepth 1 -delete` before every vite build** (memory: `rm -rf` is blocked by a pre-tool hook).
4. **Check `src/lib/changelog.ts` before modifying any file** — recent entries are intentional. The S24-S25 entries name many of the files in this sprint.
5. **Backend edits only in Part 2 item 9.** Touch `backend-hono/src/services/notifications/emit.ts` (add category), new `backend-hono/src/routes/maintenance.ts`, register in `backend-hono/src/routes/index.ts`. Then `cd backend-hono && bun run build` + `launchctl unload/load io.solvys.fintheon-backend.plist`.
6. **Glassmorphic before Kanban, always.** TP memo: `feedback_glassmorphic_over_kanban.md`. No card outlines, no vertical borders, no Trello-column gray-box look.
7. **Solvys Gold palette**: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`. Existing theme vars: `--fintheon-bg`, `--fintheon-accent`, `--fintheon-muted`, `--fintheon-low`, `--fintheon-severe`, `--fintheon-neutral-severe`.
8. **No time estimates in any commit message or PR** (memory: `feedback_no_time_estimates.md`).

## Definition of Done (entire sprint)

- [ ] Both parts merged to `s24-unify`
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd mobile && find dist -mindepth 1 -delete && npx vite build` clean
- [ ] `cd backend-hono && bun run build` clean
- [ ] Local backend restarted, `/api/diagnostics` + `/api/riskflow/sources` 200
- [ ] Mobile preview (via the user's update script, not a dev server) confirms each item works on a real device
- [ ] One changelog entry per part in `src/lib/changelog.ts`
- [ ] Short debrief posted to TP summarizing what landed

## Non-Goals

- Desktop frontend changes (unless strictly required by shared context types)
- RiskFlow ingest/scoring pipeline changes (S25 is already live)
- New Supabase migrations (storage for maintenance requests uses existing `notifications` table rows keyed by category)
- Push notification delivery changes (the emit pipeline already handles new categories automatically)
