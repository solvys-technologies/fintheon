# Task Brief: T1 — Fintheon Mobile Scaffold + Build System + Design Tokens

**Date:** 2026-04-14
**Scope:** Create `/mobile/` directory with full Vite + React 19 + Tailwind CSS 4 project, Nothing x Fintheon design tokens, PWA manifest, and Vercel deployment config.
**Estimated files:** 10

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_backend_client_pattern, feedback_vite_build_paths, feedback_esm_no_require, feedback_never_remove_env_vars
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

Fintheon Mobile is a separate web app sharing the same backend (Fly.io) but with a Nothing Design System aesthetic (monochrome industrial + Solvys Gold accent). This track creates the foundation that all other tracks build on. The mobile app imports shared services/types from `../frontend/` via a `@frontend` path alias.

## Files to Read First

- `frontend/vite.config.ts` — Vite 6 config pattern with React + Tailwind plugins, path aliases, build options
- `frontend/tsconfig.json` — TypeScript config with `@/*` path alias
- `frontend/package.json` — Dependencies list (React 19, Tailwind 4, etc.)
- `frontend/index.html` — HTML shell pattern
- `frontend/main.tsx` — React root mount pattern
- `frontend/index.css` — CSS variable system (lines 34-113 for token definitions)
- `frontend/vercel.json` — Vercel deployment config with API rewrites to Fly.io
- `frontend/lib/theme.ts` — 10 color presets + ThemeConfig interface
- `frontend/lib/font-theme.ts` — 4 font theme presets + FontTheme interface

## What to Build

### 1. `mobile/package.json`

- **Path:** `mobile/package.json`
- **Action:** Create
- **Spec:** Bun package manager. React 19, react-dom, framer-motion, zustand, tailwindcss 4, @tailwindcss/vite, lucide-react, @supabase/supabase-js, react-markdown, remark-gfm, clsx, tailwind-merge, space-mono (npm font package if available). DevDeps: @types/react, @types/react-dom, @vitejs/plugin-react, typescript 5.8+, vite 6.2+, @tailwindcss/oxide, lightningcss. Scripts: `dev`, `build` (tsc && vite build), `preview`, `typecheck`.
- **Max lines:** 60

### 2. `mobile/tsconfig.json`

- **Path:** `mobile/tsconfig.json`
- **Action:** Create
- **Spec:** Mirror frontend tsconfig. Two path aliases: `@/*` -> `./*` and `@frontend/*` -> `../frontend/*`. Target ES2020, strict mode, bundler module resolution, jsx preserve.
- **Max lines:** 25

### 3. `mobile/vite.config.ts`

- **Path:** `mobile/vite.config.ts`
- **Action:** Create
- **Spec:** Vite 6 with React + Tailwind plugins. Two resolve aliases: `@` -> current dir, `@frontend` -> `../frontend`. Base `/`. Dev port 7778 (avoid collision with frontend 7777). Build output `dist/`. Source maps in production. Define `BUILD_TIME` env var. No Sentry (add later). No mini-widget entry — single `index.html` entry only.
- **Max lines:** 40

### 4. `mobile/vercel.json`

- **Path:** `mobile/vercel.json`
- **Action:** Create
- **Spec:** Copy frontend/vercel.json rewrites exactly (API proxy to `https://pulse-api-withered-dust-1394.fly.dev`). Add Service Worker header for `/sw.js` (Service-Worker-Allowed: /, Cache-Control: no-cache). Same security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection).
- **Max lines:** 50

### 5. `mobile/index.html`

- **Path:** `mobile/index.html`
- **Action:** Create
- **Spec:** HTML5 shell. Viewport meta with `viewport-fit=cover` for notch devices. Google Fonts preconnect + load: Doto (variable), Space Grotesk (300,400,500), Space Mono (400,700). PWA meta tags: `<meta name="theme-color" content="#000000">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`. Link to manifest.json. Title: "Fintheon". Single `<div id="root">` + script module src `/main.tsx`.
- **Max lines:** 30

### 6. `mobile/main.tsx`

- **Path:** `mobile/main.tsx`
- **Action:** Create
- **Spec:** React 19 createRoot mount. Import `./index.css`. Render `<App />` in StrictMode. NO console.warn suppression (keep it clean for mobile).
- **Max lines:** 15

### 7. `mobile/App.tsx`

- **Path:** `mobile/App.tsx`
- **Action:** Create
- **Spec:** Provider shell skeleton. For now, just renders a centered `[FINTHEON MOBILE]` text in Space Mono on black background. Wrap in a `<div className="min-h-screen bg-black text-white font-mono">`. Provider tree will be added by T2. Export default.
- **Max lines:** 20

### 8. `mobile/index.css`

- **Path:** `mobile/index.css`
- **Action:** Create
- **Spec:** Full Nothing x Fintheon token system. Must contain:
  - `@import "tailwindcss";` at top
  - `:root` block with ALL Nothing color tokens: `--black`, `--surface`, `--surface-raised`, `--border`, `--border-visible`, `--text-disabled`, `--text-secondary`, `--text-primary`, `--text-display`, `--accent` (#D4AF37), `--accent-subtle`, `--success` (#34d399), `--warning` (#D4A843), `--error` (#ef4444), `--interactive` (#5B9BF6)
  - Typography tokens: `--display-xl` through `--label` (9 sizes with line-height and letter-spacing)
  - Font variables: `--font-display` (Doto), `--font-body` (Space Grotesk), `--font-data` (Space Mono)
  - Spacing scale: `--space-2xs` (2px) through `--space-4xl` (96px)
  - Motion: `--ease-nothing: cubic-bezier(0.25, 0.1, 0.25, 1);` `--duration-micro: 150ms;` `--duration-transition: 300ms;`
  - Fintheon legacy tokens (for shared imports): `--fintheon-accent`, `--fintheon-bg`, `--fintheon-text`, `--fintheon-bullish`, `--fintheon-bearish`, `--fintheon-surface`, `--fintheon-border`, `--fintheon-muted`, severity vars
  - Dot-matrix grid utility: `.dot-grid` background pattern
  - Global: `body { background: var(--black); color: var(--text-primary); font-family: var(--font-body); }` + scrollbar hiding (match frontend pattern)
  - Safe area padding utility: `.safe-top`, `.safe-bottom`
- **Max lines:** 200

### 9. `mobile/manifest.json`

- **Path:** `mobile/manifest.json`
- **Action:** Create
- **Spec:** PWA web app manifest. name: "Fintheon", short_name: "Fintheon", start_url: "/", display: "standalone", theme_color: "#000000", background_color: "#000000". Icons array with 192x192 and 512x512 PNG placeholders (just reference paths, actual icons can be added later).
- **Max lines:** 25

### 10. `mobile/public/` directory

- **Path:** `mobile/public/`
- **Action:** Create directory
- **Spec:** Create `mobile/public/` directory. Copy or symlink `frontend/public/logo.png` if it exists. Create placeholder `icons/icon-192.png` and `icons/icon-512.png` (can be actual icons or just empty files — they'll be replaced with real assets).

## Key Rules

- Package manager is `bun` — use `bun install`, `bun run build`
- `@frontend` alias MUST resolve to `../frontend` in both vite.config.ts AND tsconfig.json
- Nothing design: OLED black (#000000) background, NOT Fintheon near-black (#050402)
- Fintheon legacy CSS vars must also be defined (shared components import them)
- No gradients, no colored emojis anywhere
- index.css should define BOTH Nothing tokens AND Fintheon legacy tokens (for compatibility with shared imports)

## DO NOT

- Install Sentry, Electron, TradingView, LiveKit, TipTap, XYFlow, or any desktop-specific deps
- Create any React components beyond the minimal App.tsx shell
- Touch any files in `frontend/` or `backend-hono/`
- Add routing, navigation, or any UI beyond the placeholder text
- Use spring/bounce easing anywhere

## Verification

```bash
cd mobile && bun install && bun run build
# Should compile successfully with zero errors
cd mobile && bun run dev
# Should open on localhost:7778 showing "[FINTHEON MOBILE]" on black background
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T1: Scaffold /mobile/ directory with Vite 6 + React 19 + Tailwind CSS 4, Nothing x Fintheon design tokens, PWA manifest, Vercel deployment config',
  files: ['mobile/package.json', 'mobile/tsconfig.json', 'mobile/vite.config.ts', 'mobile/vercel.json', 'mobile/index.html', 'mobile/main.tsx', 'mobile/App.tsx', 'mobile/index.css', 'mobile/manifest.json']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
