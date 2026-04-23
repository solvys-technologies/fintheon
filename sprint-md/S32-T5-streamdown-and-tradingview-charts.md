# Sprint Brief: S32-T5 — Streamdown Chat Renderer + TradingView Lightweight Charts

## Context

Sprint 2 (Harper 2.1). Harper needs a rich chat surface that can stream markdown with custom slots — RiskFlow catalyst cards, NarrativeFlow previews with their descriptions, psych tables, performance tables, embedded charts. Install **`streamdown`** (Vercel web package, v2.5.0 — NOT `react-native-streamdown`, which is RN-only). Render into both desktop (Electron/Vite) and mobile PWA surfaces via shared chat components.

Additionally: Harper must be able to embed **TradingView Lightweight Charts** inline in chat so she can show the user a chart instead of describing one.

Design rules: invisible panels, zero borders, fading rulers between cells/columns, no blur, no box-shadow, Solvys Gold accent only.

## Branch Target

`s32-harper-2-1`

## Scope — Included

### Streamdown integration

- [ ] `bun add streamdown` in both `frontend/` and `mobile/` (or wherever mobile lives)
- [ ] Wrap existing chat message renderer with `<Streamdown>` — look at `frontend/components/chat/FintheonStreamingBubble.tsx` (or equivalent) and swap its `ReactMarkdown` usage for `Streamdown` (use `streamdown` `parseIncompleteMarkdown` option true for live streaming)
- [ ] Register custom component slots via Streamdown's `components` prop:
  - `catalyst-card` → renders a RiskFlow catalyst card (reuse existing card shape from `shared/harper-cards.ts`)
  - `narrative-preview` → renders a NarrativeFlow preview with title + one-line description of what the narrative covers
  - `psych-table` → renders ER/discipline/infractions as a compact table
  - `perf-table` → renders per-symbol or per-session performance stats
  - `tv-chart` → renders a TradingView Lightweight Chart (see next section)
  - `vision-insight` → renders a proactive Harper Vision card (reuses the `vision-insight` card variant from T2)
- [ ] Harper emits these slots via fenced code blocks in the response, e.g.
  ````
  ```catalyst-card
  { "id": "riskflow-1234", "headline": "...", "ivScore": 7.8 }
  ````
  ```
  Streamdown parses the JSON body and renders via the matching React component.
  ```

### TradingView Lightweight Charts

- [ ] `bun add lightweight-charts` in `frontend/` (mobile optional — defer unless trivial)
- [ ] New component `frontend/components/chat/slots/TVChartSlot.tsx`:
  - Props: `{ symbol: string; interval: string; from?: number; to?: number; overlays?: Array<{type:'level'|'zone'; value: number | [number, number]; label?: string}> }`
  - Fetches OHLCV from existing backend `/api/market/*` endpoints (grep for existing intraday/daily routes; Yahoo-backed)
  - Renders a compact (~180-240px tall) candlestick chart with user's bullish/bearish colors from `user_preferences.fusePalette`
  - Supports drawing horizontal levels (support/resistance) and shaded zones
  - No grid lines, no axis labels outside the necessary price + time — minimal chrome
- [ ] Harper emits a `tv-chart` fenced block with JSON to render a chart for the user

### Visual treatment (shared across all slots)

- [ ] Every slot renders with:
  - Background: `rgba(10, 9, 5, 0.7)` (dark alpha, no blur)
  - Border: `1px solid rgba(199, 159, 74, 0.15)` (faint Solvys Gold), or NO border if "invisible panel" applies
  - Table row dividers: faded — `border-bottom: 1px solid` with gradient alpha `rgba(199,159,74, 0)` at edges, `rgba(199,159,74, 0.2)` in center. Implement via `mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent)` on the divider element
  - Column dividers: same fading ruler treatment
  - No `backdrop-filter`, no `box-shadow`, no gradients for fills

### Streaming behavior

- [ ] Partial/incomplete JSON inside a fenced slot must not crash the renderer — Streamdown handles incomplete markdown; the slot component must gracefully render a skeleton or "loading…" state if JSON is partial
- [ ] When Harper's stream completes and the JSON finishes, the slot swaps from skeleton to real content with a 200ms fade

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S32-T5 streamdown + TV charts` on modified files

## Scope — Excluded (DO NOT TOUCH)

- `streamdown`'s internals — it's a dep
- Voice orb / Omi sidebar chat UI — T8 territory
- PsychAssist gating logic — T6 territory
- Any backend route — this is frontend only (charts pull from existing `/api/market/*`)

## Known Issues to Preserve

- Memory: `feedback_no_glass_effects.md` — no `backdrop-blur`. Faded ruler dividers via `mask-image` is the replacement for what would have been `backdrop-blur` separators.
- Memory: `feedback_send_button_style.md` — circular ArrowUp, not airplane icon. Don't change the existing send button.
- Must cleanly render on mobile PWA too — test at 375px width.

## Implementation Steps

1. Install `streamdown` both surfaces.
2. Find existing chat renderer; swap ReactMarkdown → Streamdown.
3. Define slot component registry. Skeleton states first.
4. Install `lightweight-charts`; build `TVChartSlot`.
5. Define the JSON schema for each slot; document in `shared/chat-slots.ts`.
6. Write a tiny Harper prompt addendum (handed to T6/T7 — "you can emit catalyst-card, narrative-preview, psych-table, perf-table, tv-chart, vision-insight blocks when helpful").
7. Visual QA at 1440×900 and 375×812.

## Acceptance Criteria

- [ ] A test Harper response with all 6 slot types renders cleanly on desktop + mobile PWA
- [ ] Partial stream of a slot body shows a skeleton, never a crash
- [ ] TV chart renders a valid candle chart from Yahoo-backed data; overlays draw correctly
- [ ] Zero `backdrop-blur`, zero `box-shadow`, zero gradient fills in the slot components
- [ ] Table dividers have fading-edge treatment via `mask-image`
- [ ] `tsc --noEmit` + `vite build` pass on both surfaces
- [ ] All new files <300 lines

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Ruler-gradient + glass gate
grep -rE "backdrop-blur|box-shadow|linear-gradient.*fill" frontend/components/chat/slots/ \
  && echo "FAIL: banned effect" || echo "OK"
```

## Commit Format

```
[v5.23.0] feat: S32-T5 streamdown chat renderer + TradingView lightweight charts
```
