# S43 — Priced In Research site redesign (Figma-first, exec Friday 2026-05-01)

## What ships

A redesigned `pricedinresearch.io` (firm front door) and `pricedinresearch.io/fintheon` (cinematic product page) — designed in Figma against two locked references (impeccable.style + ddlabstudio.com), built on Next.js 15 + Lenis + GSAP, deployed to Vercel. Hyperframes keynote video renders in parallel as the spine of `/fintheon`. Old site is replaced via DNS swap end-of-day Friday.

Omma was eliminated. Build stack is now: Next.js (App Router) + Tailwind + Lenis (smooth scroll) + GSAP (scroll-linked timelines) + Vercel.

## Reference anchors (already captured in Figma)

- **impeccable.style** — typographic restraint, slow type-on, weighted hairline rules, mono accent rhythm
- **ddlabstudio.com** — full-bleed cinematic project reveals, scroll-pinned video, act-based scroll storyboard

The two references live in a blank Figma doc TP captured. That doc becomes the **moodboard page** in the new file (Page 0).

## Brand spec (NON-NEGOTIABLE — copy into every Figma frame guide)

- **Palette**: BG `#050402` · Accent `#c79f4a` · Text `#f0ead6`
- **Type**: Doto (display/numerals) · Söhne or Neue Haas Grotesk Display (UI/body) · Berkeley Mono or JetBrains Mono (mono accents)
- **Surfaces**: matte industrial-luxe — flat dark panels, hairline 1px gold borders, no glass, no blur, no shadow, no gradient
- **Banned**: gradients, emojis, Kanban borders, AI sparkles, neon, purple/blue tech tropes, stock photography, 3D blobs, particle systems
- **Motion language**: 280–600ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`, slow weighted Lenis scroll (`lerp: 0.08`)

## Repo + branch

- **New repo**: `~/Documents/Codebases/pricedinresearch-site` (fresh — NOT inside fintheon)
- **Stack scaffold**: `bunx create-next-app@latest pricedinresearch-site --typescript --tailwind --app --no-src-dir`
- **Worktree-per-track**: each design+code track gets its own VS Code window, branched off `main`
- **Vercel project**: `pricedinresearch-site` linked at scaffold time; preview URL per branch

## Timeline (5 working days)

| Day                | Phase                             | Deliverable                                                                 |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------- |
| **Mon 2026-04-27** | Discovery + tokens                | IA lock, Figma file scaffolded, design tokens page, type ramp, color tokens |
| **Tue 2026-04-28** | Page 1 comps (`/`)                | All 6 sections of firm site at desktop + mobile, motion notes per section   |
| **Wed 2026-04-29** | Page 2 comps (`/fintheon`)        | All 9 acts of cinematic page at desktop + mobile, scroll-storyboard diagram |
| **Thu 2026-04-30** | Hyperframes render + dev scaffold | Keynote video rendered via Kimi Code, Next.js scaffold + Lenis/GSAP wired   |
| **Fri 2026-05-01** | EXECUTION DAY                     | Build both pages from Figma, deploy preview, DNS swap, archive old site     |

## Wave structure

```
Wave 1 — Mon (3 parallel windows):
  ├─ T1 IA + tokens + Figma scaffold       [design]
  ├─ T2 build stack scaffold                [code: Next.js + Lenis + GSAP + Vercel]
  └─ T3 Hyperframes keynote script lock     [content/video]

Wave 2 — Tue–Wed (3 parallel windows):
  ├─ T4 Figma comps — Page 1 (/)            [design]
  ├─ T5 Figma comps — Page 2 (/fintheon)    [design]
  └─ T6 Hyperframes render iteration        [content/video]

Wave 3 — Thu (2 parallel windows):
  ├─ T7 Component library extracted from Figma → Next.js   [code]
  └─ T8 Keynote video final render + poster frame export   [content/video]

Wave 4 — Fri (EXECUTION, 2 parallel windows):
  ├─ T9 Page builds (/ and /fintheon) wired to keynote     [code]
  └─ T10 QA + Lighthouse + DNS swap + archive old site     [code/ops]
```

## Off-limits

- **fintheon repo** — this sprint is separate. No changes to `~/Documents/Codebases/fintheon`.
- **Existing `pulse.pricedinresearch.io` dashboard** — untouched.
- **Old site source** — archive to `~/Documents/Codebases/pricedinresearch-site-archive` before DNS swap.
- **Brand palette + ban list** — no negotiation, no exceptions per track.

## Build stack lock (T2 sets these)

```bash
bunx create-next-app@latest pricedinresearch-site --typescript --tailwind --app --no-src-dir
cd pricedinresearch-site
bun add lenis gsap @gsap/react
bun add -D @types/node
```

- Lenis smooth scroll wired in root layout (`lerp: 0.08`)
- GSAP ScrollTrigger registered, `useGSAP` hook for components
- Tailwind config: extend `colors.bg`, `colors.accent`, `colors.bone`; `fontFamily.display` (Doto), `fontFamily.sans` (grotesk), `fontFamily.mono`
- Fonts: `next/font/google` for Doto, self-host grotesk + mono in `/public/fonts/`
- Global CSS: 9 `t-*` named transitions ported from solvys-transitions skill

## Hyperframes keynote integration (T3/T6/T8)

Per the Kimi Code prompt drafted in chat — 90s silent cinematic, 7 acts, MP4 + WebM + 8 poster PNGs. T6 iterates with TP feedback Mon→Wed. T8 locks final render Thu morning so T9 can wire scroll-linked playback Fri.

- Video output: `/public/assets/fintheon-keynote.mp4` + `.webm`
- Poster frames: `/public/assets/poster-act{1..8}.png`
- Scroll-linked: GSAP ScrollTrigger binds `video.currentTime` to scroll progress between Acts 1 and 9 of `/fintheon`

## Friday execution checklist (T9 + T10)

1. Scaffold both pages from approved Figma comps (T4/T5)
2. Wire Hyperframes video into `/fintheon` Acts 1, 4, 9
3. Lighthouse: LCP < 1.8s, CLS < 0.05, TBT < 200ms — fail = no ship
4. Test `prefers-reduced-motion` path: all video → poster, all scroll-linked motion → instant
5. Deploy preview to Vercel — TP eyes-on
6. Archive old site source + screenshot every page to `~/Documents/Codebases/pricedinresearch-site-archive/`
7. DNS swap on Cloudflare (apex + `www`) → Vercel project
8. Verify SSL, redirects, OG tags
9. Tweet + announce only after TP greenlights live URL

## DNS + ops notes

- DNS at Cloudflare. Apex `pricedinresearch.io` + `www` → Vercel.
- `pulse.pricedinresearch.io` subdomain stays pointed at existing dashboard — do NOT touch.
- 301 redirect old `/fintheon` URL preserves itself (same path, new content).
- OG image: render the Hyperframes Act 7 closing frame ("INTELLIGENCE THAT LEADS.") at 1200×630.

## @-mention wave block (paste into VS Code windows starting Mon)

```
@sprint-md/S43-T1-ia-tokens-figma.md
```

```
@sprint-md/S43-T2-stack-scaffold.md
```

```
@sprint-md/S43-T3-keynote-script.md
```

Tue–Wed:

```
@sprint-md/S43-T4-figma-page-firm.md
```

```
@sprint-md/S43-T5-figma-page-fintheon.md
```

```
@sprint-md/S43-T6-keynote-render.md
```

Thu:

```
@sprint-md/S43-T7-component-extraction.md
```

```
@sprint-md/S43-T8-keynote-final.md
```

Fri (execution):

```
@sprint-md/S43-T9-page-builds.md
```

```
@sprint-md/S43-T10-qa-deploy-dns.md
```

## Open decisions for TP before Mon kickoff

1. **Apex stack confirmation** — Next.js + Vercel as stated, or do you want Framer (since Figma → Framer is one-click)? Framer trades flexibility for speed. Recommend Next.js for the cinematic GSAP work.
2. **Domain registrar / DNS** — confirm Cloudflare is the source of truth for `pricedinresearch.io` zone records.
3. **Old site archive** — full clone or screenshot-only? Recommend git-clone of source repo + screenshot of every rendered page.
4. **Hyperframes seat time** — keynote needs ~6 hours of render iteration time across Tue–Thu. Confirm you can sit with Kimi Code for 2 sessions Tue + Wed.
5. **Soft-launch vs hard-cutover** — Friday DNS swap is a hard cutover. Want a 24h preview-URL soft window first?
