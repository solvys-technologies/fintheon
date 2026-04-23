---
name: solvys-feels
description: Visual architecture for Solvys applications. Industrial-luxe monochrome canvas with a single warm accent + frosted-glass surfaces for cards, panels, and sheets. Use for any UI work -- new components, styling changes, theme adjustments, visual reviews, or when generating frontend code.
---

# Solvys Feels -- Visual Architecture

You are a design systems engineer. Every UI decision you make must pass through these filters. This is not optional -- these rules override your default aesthetic instincts.

> **AUTO-ENFORCED BANS (applies to every surface this skill touches).**
> No gradients. No emojis (colored OR monochrome Unicode). No Kanban-style side-stripe borders. No AI sparkles / shimmer. These four are non-negotiable -- if any appear in code generated under this skill, that code is wrong. When another skill (including `/solvys-orchestrate` track briefs) invokes `/solvys-feels`, it inherits these bans verbatim. Do not restate them as "preferences" or "usually avoid" -- they are bans.

## THE FOUR BANNED ORNAMENTS (zero tolerance)

TP called these out by name. They are never shipped, not anywhere in the product, not in UI chrome, not in prose, not in push copy, not in marketing, not in error messages:

1. **Kanban borders** -- no 2-4px colored side-stripes on cards, no trello-column layouts, no "card with left stripe = urgent" patterns. Severity/status goes in a small accent-tinted dot or short accent-color label, never a stripe.
2. **Gradients** -- no `linear-gradient`, `radial-gradient`, `bg-gradient-*`, animated gradient text, or gradient backgrounds of any kind. Solid fills only (or translucent glass over solid).
3. **AI sparkles** -- no ✨, 🪄, shimmer effects, glitter, aurora washes, animated rainbow edges, or any decorative glyph meant to signal "AI did this". That look reads as AI slop and cheapens the product instantly.
4. **Emojis** -- zero emojis in UI chrome, labels, buttons, empty states, toasts, or push copy. Colored Unicode set AND monochrome set. Use line icons from Lucide for iconography, text labels for status.

**CRITICAL RULES (from operational history):**

- Never start a vite dev server to preview UI -- verify via `tsc --noEmit` + `vite build`, then deploy to test
- Always `rm -rf dist` before vite build when checking UI changes
- UI verification happens on the live deployed site, not localhost
- **Glassmorphic before Kanban.** Default surface for cards/panels/sheets is frosted glass (translucent bg + `backdrop-filter: blur(16-24px) saturate(1.3-1.4)` + thin accent-tinted border + subtle accent-shadow). Flat rectangles are reserved for dense data tables and form inputs.

## Core Identity

**Palette: Solvys Gold**

- Background: `#050402` (near-black with warm undertone)
- Accent: `#c79f4a` (muted gold -- not bright, not shiny)
- Text: `#f0ead6` (warm off-white -- never pure white)

**Aesthetic: Industrial Luxe**
Precise but not cold. Technical but not clinical. Monochrome canvas with a single warm accent. Every element earns its pixel.

## Design Principles

1. **Subtract, don't add.** If you can remove an element without losing meaning, remove it.
2. **Structure is ornament.** The grid, the data, the hierarchy ARE the design. No decorative elements.
3. **Monochrome is the canvas.** Color is an event, not a default. The gold accent is a signal, not a fill.
4. **Type does the heavy lifting.** Scale, weight, and spacing create hierarchy. Not color, not icons, not borders.
5. **Flat is final.** No depth simulation. No shadows, no gradients, no blur. Layers are distinguished by opacity and tone.

## Absolute Bans

These patterns are NEVER acceptable in Solvys applications:

| Banned Pattern                                                    | Why                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| Gradients (`bg-gradient-*`, `linear-gradient`, `radial-gradient`) | The Four — zero tolerance                           |
| AI sparkles / glitter / aurora / shimmer                          | The Four — zero tolerance (AI slop signal)          |
| Emojis anywhere (chrome, labels, copy, push, prose)               | The Four — zero tolerance                           |
| Kanban-style side-stripe borders on cards/alerts                  | The Four — zero tolerance                           |
| Colored icons / filled icons                                      | Line icons only, stroke-width 1.5-2px               |
| Rounded-full on non-circular elements                             | Industrial, not bubbly                              |
| Pure black (`#000000`) as background                              | Too harsh -- use warm near-black                    |
| Pure white (`#ffffff`) as text                                    | Too harsh -- use warm off-white                     |
| M-dashes in text content                                          | Use en-dashes or hyphens                            |
| Gradient text (`background-clip: text`)                           | Never                                               |
| Skeleton loading screens                                          | Use `[LOADING...]` text indicators                  |
| Parallax, scroll-jacking, bounce easing                           | Disruptive motion                                   |
| Flat-card grids that read as Trello columns                       | Glassmorphic first, flat only for dense data/inputs |

### Allowed but deliberate

- **Backdrop blur + translucent bg on glass surfaces** — the default for cards, panels, sheets. `backdrop-filter: blur(16-24px) saturate(1.3-1.4)` over a near-black base with a thin accent-tinted border.
- **Subtle accent-tinted shadows** (e.g. `0 -12px 40px rgba(0,0,0,0.6)` on lifted sheets) — used only to separate glass from background.
- **Toasts** — short-lived, bottom-left (system) / top-right (market). Existing `ToastContext` only. Never a stack.
- **Severity dots** in the top-right of a glass card — 6px accent-tinted circle. The only acceptable replacement for the banned side-stripe.
- **Accent-letter buttons** — `color: var(--accent)` on transparent background, no border. The only button style for inline Approve/Deny/CTA actions inside glass cards.

## Color System

Use OKLCH where possible. All custom properties should be defined in OKLCH with hex fallbacks.

### Surface Layers (darkest to lightest)

```
Layer 0 (base):     #050402   oklch(0.06 0.01 70)
Layer 1 (surface):  #0a0905   oklch(0.10 0.01 70)
Layer 2 (elevated): #110f0a   oklch(0.13 0.01 70)
Layer 3 (overlay):  #151310   oklch(0.15 0.01 70)
Header:             #080604   oklch(0.08 0.01 70)
```

### Text Opacity Tiers

```
Primary:    #f0ead6  100%     -- headings, primary content
Secondary:  #f0ead6  72%      -- body text, descriptions
Muted:      #f0ead6  40%      -- labels, timestamps, secondary info
Disabled:   #f0ead6  20%      -- disabled states
```

### Accent Usage

```
Accent:         #c79f4a           -- links, active states, key indicators
Accent hover:   rgba(199,159,74, 0.20)  -- hover backgrounds
Accent active:  rgba(199,159,74, 0.10)  -- active/selected backgrounds
Accent subtle:  rgba(199,159,74, 0.06)  -- subtle hover states
```

### Severity Colors (for data, alerts, status)

```
Severe:          #da0000    -- critical errors, stop signals
Neutral-Severe:  #ac5318    -- warnings, caution
Neutral:         #c79f4a    -- normal state (same as accent)
Low-Neutral:     #526089    -- informational
Low:             #073c00    -- success, safe, confirmed
```

### Bullish / Bearish (for financial data)

```
Bullish (muted):   #2d5a3d   -- Stone theme
Bullish (vibrant): #34D399   -- Gold theme
Bearish (muted):   #7a3030   -- Stone theme
Bearish (vibrant): #EF4444   -- Gold theme
```

Severity colors apply to VALUES only, never to labels or containers.

## Typography

### Font Stack (in priority order)

1. **Readable Digits** -- Inter mapped to numeric unicode ranges. Prepended in every font stack so digits always render consistently regardless of theme.
2. **Inter** (300-700) -- Default body font. Clean, neutral, readable at all sizes.
3. **Playfair Display** (400, 600, 700) -- Elegant headings. Use sparingly for display text.
4. **JetBrains Mono** (400, 500) -- Code, monospace, technical data. Always available.
5. **Cinzel** (400, 600, 700) -- Imperial/ceremonial headings. Reserved for branding contexts.
6. **Cormorant Garamond** (400-700) -- Imperial body text. Reserved for long-form ceremonial content.

### Hierarchy Rules

- Maximum 2 font families per screen
- Maximum 3 font sizes per screen
- Maximum 2 font weights per screen
- If two elements compete visually, one must shrink, fade, or move
- Monospace for ALL data values, metrics, and KPIs

### Loading CSS

All fonts self-hosted as WOFF2 with `font-display: swap`. See `reference/font-kit.md` for the complete `@font-face` definitions.

## Borders

```
Base:   rgba(199, 159, 74, 0.10)   -- 1px, default card/section borders
Hover:  rgba(199, 159, 74, 0.20)   -- on hover
Focus:  rgba(199, 159, 74, 0.40)   -- focused inputs, active elements
```

Always 1px. Never thicker. Never solid accent color at full opacity for borders (too loud).

## Animation

### Easing

```css
--ease-standard: cubic-bezier(
  0.4,
  0,
  0.2,
  1
); /* Primary easing -- calm, luxurious */
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1); /* Entrance easing */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Card entrance only */
```

### Duration

- Micro-interactions (hover, focus): 150-200ms
- Transitions (tab switch, collapse): 300-500ms
- Entrance animations: 500-600ms
- Luxurious fades: 1000-1300ms

### Rules

- Opacity transitions over transform transitions
- No bounce on anything except card entrances
- No spring physics, no parallax, no scroll-jacking
- Respect `prefers-reduced-motion` -- disable all non-essential animation

## Component Patterns

### Cards

- Background: Layer 1 (`#0a0905`)
- Border: 1px `rgba(199, 159, 74, 0.10)`
- Border-radius: 4-8px maximum
- Padding: 16-24px
- No shadow. No hover glow. Hover = border opacity increase to 0.20.

### Buttons

- Primary: `#c79f4a` background, `#050402` text
- Secondary: `rgba(199, 159, 74, 0.12)` background, `#f0ead6` text
- Danger: `#dc2626` background, `#ffffff` text
- No rounded-full. Use 4px border-radius.

### Inputs

- Background: transparent or Layer 1
- Border: 1px base border color
- Focus: border transitions to focus opacity
- No shadow, no glow, no outline rings

### Status Indicators

- Use inline text: `[SAVED]`, `[ERROR: reason]`, `[LOADING...]`
- No toast notifications, no popups, no snackbars
- Status text in monospace, uppercase, muted opacity

## CSS Custom Properties

When building for Solvys applications, use these CSS custom property names:

```css
:root {
  --fintheon-accent: #c79f4a;
  --fintheon-bg: #050402;
  --fintheon-text: #f0ead6;
  --fintheon-bullish: #34d399;
  --fintheon-bearish: #ef4444;
  --fintheon-surface: #0a0905;
  --fintheon-border: #c79f4a;
  --fintheon-muted: #6b7280;
}
```

For Fluxer/iframe embeds, see `reference/css-tokens.md` for the full variable map.

## Validation -- The Slop Test

Before finalizing any UI work, ask yourself:

> "If someone saw this interface and was told 'AI made this,' would they believe it immediately?"

If yes, that is the problem. Go back and subtract. Real design has opinion and restraint. AI slop has everything turned up to 7/10 across the board.

## Design Research -- Pulling "Low-Key Luxe" References

When you need external inspiration (a new component, a fresh take on an existing surface, proof that a pattern reads as industrial-luxe rather than AI slop), use the **`browser-harness`** operator that already powers the newsfeed scraping. It lives at `backend-hono/src/services/browser/` and exposes `browseTask({ url, objective, extract_schema })` through `backend-hono/src/services/browser/operator.ts`. Same allowlist, same quota budget, same Supabase action cache.

**Preferred sources (industrial-luxe, not flashy):**

- `https://x.com/search?q=%22design%20system%22%20luxe%20-gradient%20-emoji&f=live` -- live X/Twitter search filtered for low-key design-system work
- `https://x.com/search?q=%22dark%20mode%22%20monochrome%20industrial&f=live` -- monochrome/industrial dark UI references
- Specific accounts worth scraping case-by-case: Linear team builds, Superhuman components, Arc Browser, Railway status pages, Vercel docs

**How to invoke (example skeleton for the executing Claude):**

```ts
import { browseTask } from "backend-hono/src/services/browser/operator.js";
import { z } from "zod";

const refs = await browseTask({
  url: "https://x.com/search?q=%22design%20system%22%20luxe%20-gradient%20-emoji&f=live",
  objective:
    "Collect post URLs + one-line summary of posts showing monochrome/industrial UI with a single warm accent. Ignore anything with gradients, emojis, or sparkle effects.",
  extract_schema: z.array(
    z.object({
      post_url: z.string().url(),
      summary: z.string(),
      signals: z
        .enum(["monochrome", "warm-accent", "flat", "typographic"])
        .array(),
    }),
  ),
  budget_usd: 0.05,
});
```

**Allowlist reality-check:** before firing, open `backend-hono/src/services/browser/allowlist.ts` and confirm `x.com` is permitted. If not, do NOT bypass -- ask the user to extend the allowlist via the standard path (the allowlist is how quotas and compliance stay honest).

**What to DO with the references:**

1. Filter every returned reference against the four banned ornaments above. Anything with a gradient, emoji, Kanban stripe, or AI sparkle is discarded silently.
2. Extract only the structural idea: layout grid, typographic hierarchy, accent placement, spacing rhythm. Do not copy color, iconography, or branding.
3. Re-render the idea in Solvys Gold + Inter + flat surfaces. If the idea cannot survive that re-render, the idea wasn't low-key -- drop it.

**What NOT to DO:**

- Do not screenshot-dump references into prompts for UI generation. `browseTask` returns text extracts for a reason -- the visual is the screenshot cache, the decision input is the text summary.
- Do not scrape Figma, Dribbble, or Behance through `browser-harness`. Figma has its own MCP (`claude_ai_Figma`), and the other two are full of the exact AI slop we are filtering against.
- Do not exfiltrate or cache full post bodies from private/locked accounts.
- Do not invoke `browser-harness` for standard theme tweaks where the answer is already in `reference/solvys-themes.md`. External research is reserved for genuinely novel surfaces.

## Reference Files

For detailed token tables, font definitions, and theme presets:

- `reference/solvys-themes.md` -- All 9 production theme presets with complete color values
- `reference/font-kit.md` -- Complete @font-face definitions for self-hosted WOFF2 fonts
- `reference/css-tokens.md` -- Full CSS variable token map for backgrounds, text, buttons, borders
- `reference/solvys-gold-palette.md` -- Deep-dive on the Solvys Gold/Stone color system
