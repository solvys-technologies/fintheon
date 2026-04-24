# Sprint Brief: T3 — Arbitrum Frontend (ArbitrumChamber + VerdictCard + DissentBadge + IV Peek + Sanctum Wire)

## Context

Build the UI for the Arbitrum deliberation engine: a chamber visualization showing 5 seats debating in rounds, a final VerdictCard with consensus probability + dissent surfacing, and a DissentBadge primitive. Also: insert a "peek textbox" of the latest Arbitrum digest into the IV scoring widget's hover modal (header toolbar), and swap `AgentDeskDebatePanel` inside Sanctum for `ArbitrumChamber`. The Aquarium surface label stays — only the engine + component change.

Design anchor: **/solvys-feels**. Industrial-luxe monochrome canvas, Solvys Gold (#c79f4a) accent only. BANNED: gradients, emojis, Kanban borders, AI sparkles, glass/backdrop-blur, shimmer effects, decorative animated text.

## Branch Target

`s35-t3-arbitrum-frontend` (off `s34-unified`)

## Scope — Included

- [ ] `frontend/components/arbitrum/ArbitrumChamber.tsx` (NEW) — live chamber visualization (5 seats fade in round-by-round)
- [ ] `frontend/components/arbitrum/VerdictCard.tsx` (NEW) — final digest card: consensus probability (Doto numeral), confidence, digest_text body, dissent flag
- [ ] `frontend/components/arbitrum/DissentBadge.tsx` (NEW) — inline badge showing dissenting seat + magnitude_pp (e.g., "Bear -18pp")
- [ ] `frontend/components/arbitrum/ArbitrumPeek.tsx` (NEW) — compact peek textbox for IV hover modal (1-line consensus + dissent flag + "view full" link)
- [ ] `frontend/hooks/useArbitrumLatest.ts` (NEW) — fetches `GET /api/arbitrum/latest`, returns `{verdict, isLoading, error, refresh}`, polls every 60s when mounted
- [ ] `frontend/components/IVScoreCard.tsx` (EDIT lines 279-292, portal slot) — insert `<ArbitrumPeek />` before the close icon
- [ ] `frontend/components/narrative/Sanctum.tsx` (EDIT) — replace import `AgentDeskDebatePanel` from `../agent-desk/AgentDeskDebatePanel` with `ArbitrumChamber` from `../arbitrum/ArbitrumChamber`, swap the JSX element (`<AgentDeskDebatePanel ... />` → `<ArbitrumChamber ... />`)

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/**` — T1 owns all backend
- `supabase/migrations/` — T2 owns
- Any `agent-desk/` directory files OTHER than the one-line import swap in Sanctum.tsx — T9 owns the full tear-out of AgentDesk (types/components/etc)
- `frontend/types/agent-desk.ts` — T9 renames this to `arbitrum.ts`; for T3 you may import types from the still-existing `agent-desk.ts` OR define local types in `frontend/components/arbitrum/types.ts`. Prefer local types to avoid T9 merge conflicts.
- `frontend/components/regimes/RegimeMiniChat.tsx` — T4 owns
- `frontend/lib/relay-dispatch-store.ts`, `frontend/lib/usage-emit.ts` — T4 owns

## Reuse Inventory (existing code to call, not reinvent)

- `IVScoreCard.tsx:279-292` — the custom React Portal tooltip. It is NOT Radix Popover or shadcn HoverCard. The portal renders a fixed-positioned container with viewport clamping. Insert `<ArbitrumPeek />` as a child before the close icon.
- Solvys Gold palette tokens — look at `frontend/index.css` for CSS custom properties like `--fintheon-accent: #c79f4a`, `--fintheon-bg: #050402`, `--fintheon-text: #f0ead6`. Use these via `var(--fintheon-accent)`, NOT hardcoded hex.
- Existing flat-surface card pattern — look at `frontend/components/narrative/CatalystCard.tsx` for the accent-border + no-glass pattern to match
- Doto numeral font for probabilities — search for existing Doto usage in `frontend/components/` (RiskFlowCard uses it per memory `feedback_riskflow_card_anatomy`)
- Segmented NothingFuse primitive — check `frontend/components/shared/` or similar; used on RiskFlow cards per memory
- `ArrowUp` send-button pattern (memory: `feedback_send_button_style`) — NOT directly relevant here but respect the icon vocabulary if you add any controls

## Known Issues to Preserve

- Glass effects banned (memory: `feedback_no_glass_effects`). Do NOT use `backdrop-blur`, `box-shadow`, `GlassEffect` anywhere in ArbitrumChamber or VerdictCard. Use flat `bg-[var(--fintheon-bg)]` with `border border-[var(--fintheon-accent)]/30`.
- Fuses + icon overhauls are sacred (memory: `feedback_fuses_are_sacred`). If you need a fuse-like element for "round progress," REUSE the existing NothingFuse. Do NOT design a new one.
- Solvys Gold only. No other accent colors. State tinting (e.g., Bear dissent) uses slightly desaturated variants of the accent, not red/green.
- Don't ship emojis — if a seat needs an icon, use lucide-react iconography (or a simple letter label).

## ArbitrumPeek component shape

```tsx
// frontend/components/arbitrum/ArbitrumPeek.tsx
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";

export function ArbitrumPeek() {
  const { verdict, isLoading } = useArbitrumLatest();

  if (isLoading)
    return (
      <div className="text-xs text-[var(--fintheon-text)]/50">
        Loading chamber read...
      </div>
    );
  if (!verdict)
    return (
      <div className="text-xs text-[var(--fintheon-text)]/50">
        No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5.
      </div>
    );

  const {
    consensus_probability,
    confidence,
    dissent,
    digest_text,
    created_at,
  } = verdict;
  return (
    <div className="border-t border-[var(--fintheon-accent)]/20 pt-2 mt-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-doto text-[var(--fintheon-accent)]">
          {Math.round(consensus_probability * 100)}%
        </span>
        <span className="text-[var(--fintheon-text)]/70">
          conf {Math.round(confidence * 100)}%
        </span>
        {dissent && (
          <span className="text-[var(--fintheon-text)]/50">
            {dissent.seat} {dissent.magnitude_pp > 0 ? "+" : ""}
            {dissent.magnitude_pp}pp
          </span>
        )}
      </div>
      <p className="mt-1 text-[var(--fintheon-text)]/80 line-clamp-2">
        {digest_text}
      </p>
      <div className="mt-1 text-[var(--fintheon-text)]/40 text-[10px]">
        {new Date(created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · Sanctum for full
      </div>
    </div>
  );
}
```

## ArbitrumChamber layout spec (Sanctum)

- 5 seat cards in a row (desktop) or stacked 2+2+1 grid (narrow)
- Each seat card shows: role label (Lead / Forecaster / Risk / Quant / Bear), model tag (e.g., "Qwen3-235B"), current probability estimate (Doto font), confidence bar, 1-line rationale
- Round indicator at top: "Round 1 of 3" with a segmented NothingFuse advancing as rounds complete
- Below the row: facilitator's digest_text (VerdictCard) appears when chamber finishes
- Dissent indicator: if a seat dissents, its card gets a thin `border-l-2 border-[var(--fintheon-accent)]/70` accent stripe (not red, not yellow — just a slightly brighter accent)
- Live state: while running, seats animate in one at a time (200ms stagger). Use Framer Motion or simple CSS transitions — NOT shimmer, NOT gradient, NOT pulse.

## Implementation Steps

1. Scaffold `frontend/components/arbitrum/` directory; create `types.ts` with local `ArbitrumVerdict`, `ArbitrumSeat`, `ArbitrumDissent` types mirroring T2's migration columns
2. Build `useArbitrumLatest.ts` — SWR-style hook against `GET /api/arbitrum/latest` with 60s polling; export `{ verdict, isLoading, error, refresh }`
3. Build `ArbitrumPeek.tsx` per the spec above
4. Build `VerdictCard.tsx` — standalone card displaying a full verdict; used by ArbitrumChamber and possibly future standalone surfaces
5. Build `DissentBadge.tsx` — tiny inline primitive: `<DissentBadge seat={...} magnitude_pp={...} />`; used by VerdictCard and ArbitrumPeek
6. Build `ArbitrumChamber.tsx` — 5-seat row + round indicator + digest footer; subscribes to useArbitrumLatest; if no verdict yet, shows empty state
7. Edit `IVScoreCard.tsx` — locate the portal tooltip rendering block (lines 279-292); add `<ArbitrumPeek />` before the close-icon element
8. Edit `Sanctum.tsx` — find the `AgentDeskDebatePanel` import + usage; replace import path + component name. Leave all other Sanctum logic (chart mode, split layout, Aquarium label) untouched
9. Run tsc + vite build to catch type errors
10. If the existing `types/agent-desk.ts` exports types you need (e.g., `SimulationContext`), import them but treat this as a transient import — T9 will rename the types file and migrate imports

## Acceptance Criteria

- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `rm -rf frontend/dist && cd frontend && npx vite build` clean
- [ ] Hover over IV score widget in the header → peek textbox renders (loading state, then empty-state or content depending on backend availability)
- [ ] Sanctum page renders; `AgentDeskDebatePanel` no longer appears; `ArbitrumChamber` renders in its slot
- [ ] NO gradients, NO emojis, NO backdrop-blur, NO glass effects anywhere in your new components
- [ ] All accent colors use `var(--fintheon-accent)` CSS token, NOT hardcoded hex
- [ ] Doto font applied to numeric probability displays
- [ ] Empty state message: "No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5."

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && (cd frontend && npx vite build)

# Visual check (don't start vite dev; run the built preview if you need it)
# Open the deployed preview OR verify the build output in frontend/dist/
```

## Commit Format

```
[v5.25.0-S35-T3] feat: Arbitrum frontend — ArbitrumChamber, VerdictCard, DissentBadge, IV peek, Sanctum swap

Adds frontend/components/arbitrum/ (Chamber, VerdictCard, DissentBadge,
Peek), useArbitrumLatest hook, IVScoreCard peek textbox insertion in
hover portal (line 279-292), Sanctum swap AgentDeskDebatePanel ->
ArbitrumChamber. /solvys-feels enforced throughout: no gradients, no
glass, no emojis, Solvys Gold accent only.
```
