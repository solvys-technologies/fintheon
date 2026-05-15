# S66 Orchestration — Release Suite

## Sprint Goal

Ship a complete feature release: instrument expansion with per-instrument IV scoring, multi-week Desk Plan generation with pre-session pricing, permanent macOS lockout permissions with a themed lock screen, fully customizable drag-and-drop toolbar, and a chat overhaul with collapsible tool call cards and braille spinners.

## Discovery Summary

- Current branch is `sprint/S65` (v6.1.1 deploy prep). S66 starts fresh on `sprint/S66`.
- Latest tagged version: `v6.1.1`. Next version: `v6.2.0`.
- `src/lib/changelog.ts` S65 entries must be preserved — do not touch S65 entries.
- Everything must work at ship — no regressions on CAO chat, RiskFlow feed, Desk Plan, Arbitrum, Sanctum, Mobile PWA, Desktop install flow, Supabase RLS.

## Track Definitions

### T1 — Instrument Expansion + Desk Plan Multi-Week + Pre-Session Pricing

Scope: Add missing instruments (ZT, crypto basket, currencies basket) to INSTRUMENT_BETAS and SYMBOL_MAP. Per-instrument IV scoring tailored globally. Multi-week Desk Plan generation via TWT expansion. Pre-session price pulling 30min before via TV RSS. Multi-plan-per-day cycling. Supabase migration for instrument_preferences. Instrument selector in Trading Settings (remove from Profile tab). Arbitrum instrument dropdown. Mobile instrument selector.

### T2 — Lockout Permanent Permissions + Themed Lock Screen

Scope: macOS Accessibility API one-time grant via Electron `systemPreferences`. "Lock til Desk Session" one-click. Themed lock overlay (no flashbang). Settings panel permissions in BlockerTab. No macOS password re-prompt after initial grant.

### T3 — Pill Bar UI + Toolbar Overhaul + Drag-and-Drop + Detail Polish

Scope: Nametag/VIX height match IVScoreCard. Pill bar borders → vertical FadingRulers. Icon group same. Install @dnd-kit — all toolbar items draggable, reorderable to empty spots, swappable between pill bars, /solvys-feels preview. Remove footer button from heading toolbar. Fix toolbar hover (no blur, pointer cursor). ProviderDropdown = PersonaDropdown height. Arbitrum "next run" timer border removed + 15% text. Consilium subheading min-height +10%. Desk Plan lock button shimmer animation.

### T4 — Chat Overhaul: Tool Call Cards + Rich Text + Braille Spinners

Scope: Global rich text rendering (**text** → bold). Collapsible iOS-style tool call cards with thinking phrases as titles, no "agent mind" text. Click row to reveal, expand/collapse persists per card, auto-collapse when done. Replace desktop circular spinner with mobile Nothing-style SegmentedSpinner (2x2 block fill) in all chat interfaces. Theme-colored. Tool call text sizing fix.

### T5 — Unification & Validation

Scope: Merge all track changes. Resolve interface mismatches (SettingsContext, DayCard, TopHeader). Full validation suite: tsc, vite build, bun build, curl smoke, Playwright Browser Harness. Final changelog.

## Execution Sequence

### Wave 1 (parallel — no overlapping file sets)

```
@sprint-md/S66-T1-instrument-expansion-desk-plan.md
```

```
@sprint-md/S66-T2-lockout-permissions-lock-screen.md
```

```
@sprint-md/S66-T4-chat-overhaul-rich-text.md
```

**Wave 1** expands instrument config, generates multi-week desk plans, wires pre-session pricing, adds lockout permissions and lock screen, and overhauls chat with tool call cards and braille spinners — all in parallel with no file conflicts.

### Wave 2 (after Wave 1 — T3 depends on T1 DayCard + T2 TopHeader)

```
@sprint-md/S66-T3-pill-bar-toolbar-drag-drop.md
```

**Wave 2** applies the pill bar UI overhaul, drag-and-drop toolbar, and detail polish on top of the stabilized DayCard (from T1) and lock button (from T2).

### Wave 3

```
@sprint-md/S66-T5-unification-validation.md
```

**Wave 3** merges everything, resolves the three known cross-track conflicts (SettingsContext, DayCard, TopHeader), runs the full validation suite, and writes the changelog.

## Conflict Notes

- T1 and T3 both touch `DayCard.tsx`. T1 owns data/cycling/pricing. T3 owns lock button shimmer via CSS class hooks. T1 adds `<div className="desk-plan-lock-btn">` — T3 targets this class for animation.
- T1 and T2 both touch `SettingsContext.tsx`. T1 adds `selectedInstrument` field. T2 adds `lockoutPermission` field. Both are separate field additions — merge-safe.
- T2 and T3 both touch `TopHeader.tsx`. T2 adds/consolidates lock button component. T3 reworks toolbar layout with @dnd-kit. T2 provides the component, T3 places it.
- T3 and T4 both touch `frontend/package.json` (T3 adds @dnd-kit deps). T5 reconciles if needed.

## Validation Standard

Every implementation track must run:

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

Backend-changing tracks (T1, T2) must also run:

```bash
cd backend-hono && bun run build
```

Mobile-changing tracks (T1, T4) must also run:

```bash
cd mobile && npx tsc --noEmit && rm -rf dist && npx vite build
```

T5 runs full integration:
- tsc + vite build on frontend
- tsc + vite build on mobile
- bun build on backend
- Curl smoke tests against all changed endpoints
- Playwright Browser Harness: heading toolbar, Desk Plan DayCard, chat tool calls, lock screen

Version: `v6.2.0`
