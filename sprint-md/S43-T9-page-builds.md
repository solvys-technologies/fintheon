# S43-T9 — Page builds: `/` and `/fintheon` wired to keynote

**Owner**: Frontend lead
**Day**: Fri 2026-05-01 (EXECUTION DAY)
**Outputs**: Both pages composed from T7 components, Hyperframes keynote scroll-linked into `/fintheon`, Lighthouse green, Vercel preview locked for TP eyes-on before T10 DNS swap.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T1 locked tokens. T2 scaffolded Next.js. T4/T5 produced Figma comps. T7 extracted components. T8 dropped keynote assets in `public/`. T9 composes the final pages and wires scroll-linked video playback. T10 deploys + DNS swap after T9 hands over a green Vercel preview.

## Working repo

```
~/Documents/Codebases/pricedinresearch-site/
├─ app/
│  ├─ layout.tsx          # Lenis provider mounted, fonts wired
│  ├─ page.tsx            # / (firm front door)
│  ├─ fintheon/
│  │  └─ page.tsx         # /fintheon (cinematic, scroll-linked)
│  └─ _dev/               # showcase + keynote test routes (kept for QA)
├─ components/             # all T7 components ready
└─ public/assets/          # keynote.mp4/webm + 8 posters + og-image.png
```

## Page 1 — `app/page.tsx` (firm front door)

Compose from T7 components in this order, matching T4 Figma comps:

```tsx
export default function Home() {
  return (
    <main>
      <Hero />
      <Framework />
      <Apparatus />
      <ProductPointer />
      <PublishedWork />
      <Footer />
    </main>
  );
}
```

Inline section components live in `app/_sections/firm/`:

- **Hero** — `<FullBleedSection align="center">` with Doto title type-on (40ms char stagger via GSAP), grotesk subhead fade-in 600ms after, `<GoldDot pulse />`
- **Framework** — split layout, sticky left rail (`MonoLabel` + heading), three `<BodyParagraph>` with `t-text-swap` ScrollTrigger
- **Apparatus** — 5-column rail with `<Hairline>` dividers, hover `t-panel-reveal` for bios
- **ProductPointer** — `<FullBleedSection minHeight="60vh">` with Doto "FINTHEON →" linking to `/fintheon`, hover x-translate
- **PublishedWork** — `<MonoLabel>` heading, 12 `<PublishedRow>` items, "View archive →" `<LinkArrow>`
- **Footer** — three mono lines, no nav, no socials

## Page 2 — `app/fintheon/page.tsx` (cinematic)

Compose 9 acts as `<FullBleedSection>` blocks. Wire GSAP ScrollTrigger to bind keynote `currentTime` to scroll progress between Acts 1 → 9.

```tsx
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/app/gsap";

export default function Fintheon() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!videoRef.current || !containerRef.current) return;
      const video = videoRef.current;
      video.pause();

      ScrollTrigger.create({
        trigger: "#act-1",
        endTrigger: "#act-9",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onUpdate: (self) => {
          const duration = video.duration || 90;
          video.currentTime = self.progress * duration;
        },
      });
    },
    { scope: containerRef },
  );

  return (
    <main ref={containerRef}>
      <ColdOpen id="act-0" />
      <HeroVideo id="act-1" videoRef={videoRef} />
      <Problem id="act-2" />
      <ConsiliumBoardroom id="act-3" />
      <AgentReveal id="act-4" /> {/* internal: 5 sub-acts */}
      <ArbitrumChamber id="act-5" />
      <RiskFlowNarrative id="act-6" />
      <ExecutionRail id="act-7" />
      <LifetimeTier id="act-8" />
      <ClosingFrame id="act-9" />
      <Footer />
    </main>
  );
}
```

Section components live in `app/_sections/fintheon/`. Each takes an `id` prop for ScrollTrigger anchoring.

### Hero video block

```tsx
<video
  ref={videoRef}
  muted
  playsInline
  preload="metadata"
  poster="/assets/poster-act1.png"
  className="w-full max-w-[1440px] mx-auto border border-accent"
>
  <source src="/assets/keynote.webm" type="video/webm" />
  <source src="/assets/keynote.mp4" type="video/mp4" />
</video>
```

NOT autoplay — GSAP scrubs `currentTime` based on scroll. Reduced-motion path falls back to `<img src="/assets/poster-act1.png" />`.

### Reduced-motion guard

```tsx
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

if (prefersReducedMotion) {
  // Render posters as static images instead of scroll-linked video
  // Skip type-on staggers — render all type instantly
  // Disable Lenis smooth scroll (handled at root in T2)
}
```

## OG / metadata

`app/fintheon/page.tsx` exports:

```tsx
export const metadata = {
  title: "Fintheon — Priced In Research",
  description:
    "Five AI agents. Every signal, score, and narrative. All on one unified surface.",
  openGraph: {
    title: "Fintheon — Intelligence That Leads",
    description: "The Integrated Trading Environment from Priced In Capital.",
    images: ["/assets/og-image.png"],
    url: "https://pricedinresearch.io/fintheon",
  },
  twitter: { card: "summary_large_image", images: ["/assets/og-image.png"] },
};
```

`app/page.tsx`:

```tsx
export const metadata = {
  title: "Priced In Research",
  description:
    "An institutional research desk run by traders who move on narrative, not nonsense.",
  openGraph: {
    title: "Priced In Research",
    description: "Intelligence that leads, not lags.",
    url: "https://pricedinresearch.io",
  },
};
```

## Verification gates (before handing to T10)

- [ ] `bun run build` green
- [ ] `bunx tsc --noEmit` green
- [ ] Both pages render at 1440px desktop without overflow
- [ ] Both pages render at 390px mobile without overflow
- [ ] Lighthouse mobile: LCP < 1.8s, CLS < 0.05, TBT < 200ms, Performance ≥ 90
- [ ] Lighthouse desktop: Performance ≥ 95
- [ ] Scroll-linked keynote scrubs smoothly in Chrome + Safari + Firefox
- [ ] Reduced-motion path verified: video → static posters, type → instant
- [ ] All hover states work
- [ ] OG image previews correctly via Twitter Card Validator + Facebook Debugger
- [ ] Vercel preview URL stable, no console errors
- [ ] No off-palette colors anywhere (grep for hex codes)

## Done means

- Both pages live at Vercel preview URL
- TP greenlit visually + technically
- Lighthouse passing
- T10 has a green build to swap DNS to
- Slack/iMessage ping: "S43-T9 done, hand off to T10: [Vercel preview URL]"

## Off-limits

- No new components — use only what T7 shipped
- No new copy — pull from T4/T5 Figma comps
- No new motion patterns beyond the 9 `t-*` named transitions
- No analytics scripts beyond Vercel built-in (deferred to post-launch)
- No experimental React features (no React Server Components beyond defaults, no PPR, no `use cache`)
