# Sprint Brief: S62-T1 — Desktop Sanctum Layout Audit (Remaining Deltas)

## Context

Sanctum is the centerpiece of Consilium — the 3-page chamber surface (Command, Econ Intel, Risk & Narratives) that hosts the Arbitrum deliberation read-out. After S47 (UI cleanup), S56 (Sanctum restructure), and S57 (Arbitrum + Sanctum refinement), the surface still carries small residual deltas — colored page headers, inconsistent rulers, asymmetric section labels, and uneven page padding — that violate the Solvys industrial-luxe doctrine (BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`; no decorative hues; fading rulers, not solid strokes).

This task is a **scoped audit fix** on the desktop layout only. No structural changes (page count, hero split, chart mode), no child-component rework.

## Branch Target

`sprint/S62` (cut from `s60-openagents-plane-loop` tip)

## Scope — Included

- [ ] `frontend/components/narrative/Sanctum.tsx` — palette normalize Page 1 & Page 2 headers/tags from cyan/emerald to Solvys Gold accent
- [ ] `frontend/components/narrative/Sanctum.tsx` — standardize vertical FadingRuler spacing across pages (drop ad-hoc `mx-2`)
- [ ] `frontend/components/narrative/Sanctum.tsx` — swap the Page 2 solid horizontal divider for `FadingRuler orientation="horizontal"`
- [ ] `frontend/components/narrative/Sanctum.tsx` — bring Page 0 non-chart padding to `p-5` parity with Pages 1 & 2
- [ ] `frontend/components/narrative/SanctumBriefing.tsx` — replace `border-red-500/15` on the severe risk alert row with `border-[var(--fintheon-severe)]/15` to align with the inline `border-left-color` token

## Slice D — Cancelled (Audit Correction)

Initial audit flagged the right column ("Active Narratives") as missing a section header. On second look, `SanctumNarratives` already renders its own "Active Narratives" label internally (`SanctumNarratives.tsx:186-189`) at matching style (`text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/85`). No fix required.

## Scope — Excluded (DO NOT TOUCH)

- Page structure / pagination logic — `data-aud-page` indexing, `scrollToPage`, `handleScroll`, `visiblePages` stay as-is
- Chart-mode logic (S38 pin-through right panel) — `chartMode` branch in Page 0 stays as-is
- 50/50 hero split (Volatility Read | Arbitrum Chamber) — S47 baseline
- SanctumHeader (clean, already on token palette)
- `useIVScoreData`, `BlendedIVForecastCard`, `DayCard`, `ArbitrumChamber`, `ArbitrumChamberPredictionCards`, `ConsolidatedTradeLedger`, `RiskSignalCards`, `SanctumNarratives`, `SanctumEconIntel` internals
- Mobile / responsive breakpoints — desktop only
- The page-indicator dot column on the right rail

## Aesthetic Rules (Solvys Industrial-Luxe)

- **Canvas**: `bg-[var(--fintheon-bg)]` warm near-black `#050402`
- **Accent**: `#c79f4a` Solvys Gold (`var(--fintheon-accent)`) for all surface labels, dividers, active states
- **Borders**: thin, low-opacity (`/10` to `/30`) accent or token-driven
- **Rulers**: `FadingRuler` only; no solid strokes on Sanctum surface
- **No**: gradients, emojis, colored page headers (cyan/emerald), Kanban borders, AI sparkles, generic shadows
- **Typography**: `var(--font-heading)` for section labels, `var(--font-body)` for inline copy; tabular numbers stay where they are

## Acceptance Criteria

- [ ] Page 1 ("Economic Intelligence") header + "Econ Watch" tag render in Solvys Gold accent (no cyan)
- [ ] Page 2 ("Risk & Narratives") header + "Risk Scan" tag render in Solvys Gold accent (no emerald)
- [ ] Page 2 row divider between Risk/Narratives row and Trade Ledger renders as `FadingRuler`, not solid stroke
- [ ] Vertical FadingRuler spacing is consistent across Page 0 and Page 2 (no orphan `mx-2`)
- [ ] Page 0 non-chart wrapper padding matches Pages 1 & 2 (`p-5`)
- [ ] `SanctumBriefing` severe risk alert border uses `var(--fintheon-severe)` token, not Tailwind `red-500`
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] No regressions in chart mode, page scroll/snap behavior, or preset routing

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
npx vite build
```

## Commit Format

`[v.6.0.27-s62-t1] feat: Sanctum desktop layout audit — palette, rulers, padding, symmetry`
