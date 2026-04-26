# S43-T1 — IA + design tokens + Figma scaffold

**Owner**: Design lead
**Day**: Mon 2026-04-27
**Outputs**: Locked IA, Figma file scaffold with token pages, type ramp, color tokens, motion tokens, ban-list guide frame.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. Two sites being designed: `/` (firm front door) + `/fintheon` (cinematic product). Figma file already has impeccable.style + ddlabstudio.com captures sitting on a blank page — keep that as Page 0 ("Moodboard"). All other pages get scaffolded today.

## Brand spec (locked)

- Palette: BG `#050402` · Accent `#c79f4a` · Text `#f0ead6`
- Type: Doto (display) · Söhne / Neue Haas Grotesk Display (UI) · Berkeley Mono / JetBrains Mono (mono)
- Surfaces: matte industrial-luxe — flat, hairline 1px gold borders, no glass/blur/shadow/gradient
- Motion: 280–600ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`

## Deliverables

1. **Figma file structure** (named "Priced In Research — Site Redesign v1"):
   - Page 0 — Moodboard (existing captures stay)
   - Page 1 — Tokens
   - Page 2 — Type ramp
   - Page 3 — Components
   - Page 4 — Motion guide
   - Page 5 — Page 1 comps (`/`)
   - Page 6 — Page 2 comps (`/fintheon`)
   - Page 7 — Mobile comps
   - Page 8 — OG / favicon / share assets

2. **Tokens page** — three color swatches with hex + role labels; include 60% / 80% / 100% opacity steps for each.

3. **Type ramp page**:
   - Doto display: 96 / 128 / 160 / 224 px
   - Grotesk: 14 / 16 / 18 / 24 / 32 / 48 px
   - Mono: 12 / 14 / 16 px
   - Show line-height + tracking for each step

4. **Motion guide page** — 9 named transitions from solvys-transitions skill, each as a labeled frame with timing + easing + use case:
   `t-modal`, `t-dropdown`, `t-panel-reveal`, `t-card-resize`, `t-icon-swap`, `t-text-swap`, `t-page-slide`, `t-badge`, `t-number-pop-in`

5. **Ban-list guide frame** — single frame on Tokens page with the banned-ornaments list as type. Anyone opening this file sees the rules first.

6. **IA lock document** — written into a Figma frame on Page 1:

   ```
   PAGE 1 — / (firm front door)
   ├─ Hero
   ├─ The Framework
   ├─ Apparatus (agent roster)
   ├─ Product Pointer (FINTHEON →)
   ├─ Published Work
   └─ Footer

   PAGE 2 — /fintheon (cinematic)
   ├─ Act 0 — Cold open
   ├─ Act 1 — Hero keynote video
   ├─ Act 2 — Problem
   ├─ Act 3 — Consilium Boardroom
   ├─ Act 4 — Agent reveal (5 sub-acts)
   ├─ Act 5 — Arbitrum chamber
   ├─ Act 6 — RiskFlow + NarrativeFlow
   ├─ Act 7 — Execution rail
   ├─ Act 8 — Lifetime tier
   └─ Act 9 — Closing keynote frame
   ```

## Done means

- Figma file exists with all 9 pages
- Tokens, type ramp, motion guide all populated
- Ban-list frame visible on Tokens page
- Figma file shared with TP + T4 + T5 designers
- Slack/iMessage ping to TP: "S43-T1 done, file: [Figma URL]"

## Off-limits

- Don't touch Page 0 captures
- Don't start page comps yet — that's T4 (Tue) + T5 (Wed)
- Don't propose new tokens — palette + type are locked
