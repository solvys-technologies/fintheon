# S43-T2 — Build stack scaffold (Next.js + Lenis + GSAP + Vercel)

**Owner**: Frontend lead
**Day**: Mon 2026-04-27
**Outputs**: New repo `pricedinresearch-site`, Next.js 15 App Router scaffold with Lenis + GSAP + Tailwind tokens wired, Vercel project linked, deploy preview live.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. Omma was eliminated. Stack is locked: Next.js 15 + Tailwind + Lenis + GSAP + Vercel. Repo lives at `~/Documents/Codebases/pricedinresearch-site` — fresh, NOT inside fintheon.

## Steps

1. **Scaffold**:

   ```bash
   cd ~/Documents/Codebases
   bunx create-next-app@latest pricedinresearch-site --typescript --tailwind --app --no-src-dir --import-alias "@/*" --turbopack
   cd pricedinresearch-site
   ```

2. **Install motion stack**:

   ```bash
   bun add lenis gsap @gsap/react
   bun add -D @types/node
   ```

3. **Tailwind config** — `tailwind.config.ts`:

   ```ts
   theme: {
     extend: {
       colors: {
         bg: '#050402',
         accent: '#c79f4a',
         bone: '#f0ead6',
       },
       fontFamily: {
         display: ['var(--font-doto)'],
         sans: ['var(--font-grotesk)'],
         mono: ['var(--font-mono)'],
       },
       transitionTimingFunction: {
         solvys: 'cubic-bezier(0.22, 1, 0.36, 1)',
       },
     },
   }
   ```

4. **Fonts** — `app/layout.tsx` uses `next/font/google` for Doto, self-host grotesk + mono in `/public/fonts/`. Wire CSS vars `--font-doto`, `--font-grotesk`, `--font-mono`.

5. **Lenis root provider** — `app/lenis-provider.tsx` (client component):

   ```tsx
   "use client";
   import Lenis from "lenis";
   import { useEffect } from "react";
   export function LenisProvider({ children }: { children: React.ReactNode }) {
     useEffect(() => {
       const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
       function raf(time: number) {
         lenis.raf(time);
         requestAnimationFrame(raf);
       }
       requestAnimationFrame(raf);
       return () => lenis.destroy();
     }, []);
     return <>{children}</>;
   }
   ```

   Mount inside `app/layout.tsx`.

6. **GSAP global registration** — `app/gsap.ts`:

   ```ts
   import gsap from "gsap";
   import { ScrollTrigger } from "gsap/ScrollTrigger";
   if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);
   export { gsap, ScrollTrigger };
   ```

7. **Global CSS** — `app/globals.css` ports the 9 `t-*` named transitions from `~/Documents/Codebases/solvys-skills/skills/solvys-transitions/transitions.css`. Read that file, copy verbatim.

8. **Reduced-motion guard** — `app/globals.css`:

   ```css
   @media (prefers-reduced-motion: reduce) {
     *,
     *::before,
     *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

9. **Placeholder pages**:
   - `app/page.tsx` → renders `<main>S43 scaffold — / placeholder</main>`
   - `app/fintheon/page.tsx` → renders `<main>S43 scaffold — /fintheon placeholder</main>`
   - Body bg `#050402`, text `#f0ead6` so the canvas reads brand from minute 1

10. **Vercel link**:

    ```bash
    bunx vercel link
    bunx vercel --prod=false
    ```

    Project name: `pricedinresearch-site`. Note preview URL.

11. **First commit + push**:
    ```bash
    git init
    git add .
    git commit -m "S43-T2: Next.js 15 + Lenis + GSAP scaffold"
    gh repo create pricedinresearch-site --private --source=. --remote=origin --push
    ```

## Done means

- Repo at `~/Documents/Codebases/pricedinresearch-site` exists with green `bun run build`
- Both placeholder pages render with brand canvas (`#050402` bg, `#f0ead6` text)
- Lenis smooth scroll active
- GSAP ScrollTrigger registered
- Vercel preview URL live, posted to TP
- Reduced-motion guard verified

## Off-limits

- No comps yet — that's T7 (Thu) + T9 (Fri)
- No fintheon repo touches
- No `src/` directory — App Router at root
- No App Router experimental flags beyond defaults
