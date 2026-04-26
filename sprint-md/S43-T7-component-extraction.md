# S43-T7 — Component library extraction (Figma → Next.js)

**Owner**: Frontend lead
**Day**: Thu 2026-04-30
**Outputs**: TypeScript React components in `pricedinresearch-site/components/` matching every entry on Figma Page 3 (Components page), Storybook-style preview route at `/_dev/components`, all components type-checked + Tailwind-styled.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T1 locked tokens Mon. T2 scaffolded Next.js Mon. T4 (Tue) + T5 (Wed) populated Figma Page 3 with reusable components. T7 turns those Figma components into shippable React/Tailwind components so T9 can compose pages Friday from a ready library.

## Working directory

```
~/Documents/Codebases/pricedinresearch-site/
├─ components/
│  ├─ primitives/    # Hairline, GoldDot, MonoLabel
│  ├─ blocks/        # BodyParagraph, PublishedRow, VideoFrame, ActHeader
│  ├─ ctas/          # LinkArrow, CTAButton
│  └─ layout/        # LetterboxedVideo, FullBleedSection
└─ app/
   └─ _dev/
      └─ components/
         └─ page.tsx  # showcase route, all components rendered with prop variants
```

## Components to build

### Primitives

**`<Hairline />`**

- 1px horizontal rule, color `#c79f4a` (accent)
- Props: `width` (default `100%`), `opacity` (default 1)
- One line of code: `<div className="h-px bg-accent" style={{ width, opacity }} />`

**`<GoldDot />`**

- 8px solid gold dot
- Props: `pulse` (boolean, default true) — wires CSS keyframe pulse 60% → 100% over 2.4s infinite
- Honors `prefers-reduced-motion` (no pulse if reduced)

**`<MonoLabel />`**

- Section heading style
- Class: `font-mono text-[12px] tracking-[0.2em] uppercase text-accent`
- Props: `children`, optional `as` (default `span`)

### Blocks

**`<BodyParagraph />`**

- 32px grotesk paragraph for The Framework section
- Class: `font-sans text-[32px] leading-[1.4] text-bone`
- Props: `children`, optional `delay` (for stagger)

**`<PublishedRow />`**

- List row: `date · title · ticker`
- Props: `date`, `title`, `ticker`, `href`
- Hover: gold underline beneath title via `t-text-swap` (240ms left-to-right draw)

**`<VideoFrame />`**

- 16:9 video with 1px gold border + mono caption beneath
- Props: `src`, `webmSrc`, `poster`, `caption`, `maxWidth` (default 1440)
- Always: `autoPlay muted loop playsInline preload="metadata"`
- Lazy-load via IntersectionObserver below the fold

**`<ActHeader />`**

- Doto display heading + optional mono caption
- Props: `headline`, `caption`, `size` (sm/md/lg/xl mapped to 64/96/160/224 px)

### CTAs

**`<LinkArrow />`**

- Text + arrow with hover x-translate 12px
- Props: `children`, `href`, `external` (boolean)
- Class: `font-mono text-bone hover:text-accent transition-colors`
- Arrow: `<span className="inline-block transition-transform duration-300 group-hover:translate-x-3">→</span>`

**`<CTAButton />`**

- Gold-border transparent → fills on hover
- Props: `children`, `href`, `onClick`
- Hover: `t-card-resize` 320ms, bg fills `#c79f4a`, text inverts to `#050402`

### Layout

**`<LetterboxedVideo />`**

- Wraps `VideoFrame` with letterbox padding for hero treatment
- Centers max-width 1440px on desktop, full-width on mobile

**`<FullBleedSection />`**

- 100vw section with min-height
- Props: `minHeight` (default `100vh`), `align` (`center` / `top` / `bottom`)
- Used by Hero, Product Pointer, every Act on `/fintheon`

## Showcase route `/app/_dev/components/page.tsx`

Single page that renders every component with 2–3 prop variants each. Used for visual QA Thu PM. Behind a no-index meta tag — never indexed publicly.

```tsx
export const metadata = { robots: { index: false, follow: false } };
```

## Verification gates

Before EOD Thu:

- [ ] `bun run build` green
- [ ] `bunx tsc --noEmit` green
- [ ] `/app/_dev/components` renders every component
- [ ] All hover states work (test in Chrome + Safari)
- [ ] All `prefers-reduced-motion` paths verified (Chrome devtools → Rendering → Emulate)
- [ ] No off-palette colors anywhere (search components dir for hex codes other than `#050402` / `#c79f4a` / `#f0ead6`)
- [ ] Vercel preview URL deployed and shared with TP

## Done means

- All ~12 components live in `components/` with proper TS types
- Showcase route renders every component
- Build passes, types pass
- Vercel preview live
- Slack/iMessage ping: "S43-T7 done, components ready: [Vercel preview URL]/\_dev/components"

## Off-limits

- Don't compose pages yet — T9 owns Friday page builds
- Don't add components beyond the Figma Page 3 list without T4/T5 sign-off
- Don't introduce styling libraries beyond Tailwind (no styled-components, no emotion, no shadcn/ui)
- Don't break the brand spec — review T1 ban list before every commit
