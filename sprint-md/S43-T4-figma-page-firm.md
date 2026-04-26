# S43-T4 — Figma comps for `/` (firm front door)

**Owner**: Designer A
**Day**: Tue 2026-04-28
**Outputs**: All 6 sections of the firm site at desktop (1440px) + mobile (390px), motion notes per section, component library extracted to Page 3.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T1 scaffolded the Figma file Mon — open Page 5 ("Page 1 comps (`/`)") and start there. Reference Page 0 (impeccable.style + ddlabstudio.com captures) for typographic restraint and weighted hairline rhythm.

## Brand spec (already locked on Tokens page — pull, don't redefine)

- Palette: `#050402` / `#c79f4a` / `#f0ead6`
- Type: Doto (display) · grotesk (UI) · mono (accents)
- Surfaces: matte, hairline 1px gold borders, no glass/blur/shadow/gradient
- Banned: gradients, emojis, Kanban borders, AI sparkles, neon, stock photography

## Frames to deliver (Page 5)

Each section gets two frames: desktop 1440×900 and mobile 390×844. Place desktop on left column, mobile on right column, paired per section.

### 1. Hero — full viewport

**Desktop**:

- Black canvas `#050402`
- Centered vertically and horizontally
- Doto display "PRICED IN RESEARCH" at 160px, weight 800, letter-spacing -0.02em
- Below at 56px gap: grotesk subhead "An institutional research desk run by traders who move on narrative, not nonsense." at 18px, max-width 56ch, color `#f0ead6`, opacity 80%
- Below at 80px gap: 8px solid gold dot `#c79f4a`
- No CTA above the fold

**Motion note** (annotation frame beside):

- 1s dead black on first paint
- Then character-by-character type-on at 40ms stagger
- Subhead fades in 600ms after title completes
- Dot pulses opacity 60% → 100% over 2.4s, infinite loop

**Mobile**: title drops to 64px, subhead 16px, dot stays 8px

### 2. The Framework — split layout

**Desktop**:

- Left rail (320px wide): grotesk heading "The Framework" at 24px, sticky on scroll, color `#f0ead6`
- Right column: three paragraphs at 32px size, weight 400, color `#f0ead6`, line-height 1.4
  - "What the market believes matters more than what it knows."
  - "Positioning, timing, and capital flows over fundamentals."
  - "Intelligence that leads, not lags."
- 160px vertical gap between paragraphs
- Section padding: 240px top + bottom

**Motion note**: each paragraph fades in via `t-text-swap` (480ms) as it enters viewport at 30% from top

**Mobile**: heading stacks above paragraphs (not sticky), paragraphs at 24px, 96px gaps

### 3. Apparatus — agent roster

**Desktop**:

- Section heading mono "APPARATUS" at 12px, letter-spacing 0.2em, color `#c79f4a`, top of section
- 5 columns equal width separated by 1px gold dividers `#c79f4a`
- Per column:
  - Mono "01" through "05" at 14px top, color `#c79f4a`
  - Grotesk agent name at 32px, color `#f0ead6`: HARPER / ORACLE / FEUCHT / CONSUL / HERALD
  - Grotesk role at 14px, opacity 60%: "CAO" / "Prediction Markets" / "Futures & Risk" / "Mega-Cap Fundamentals" / "Breaking News & Sentiment"
  - 1-line bio (hidden by default) — show as second frame variant labeled "hover state"
- Section padding: 200px top + bottom

**Motion note**: hover reveals 1-line bio via `t-panel-reveal` (320ms), expanding column height

**Mobile**: stacks vertically as 5 rows separated by horizontal gold dividers, no hover state — bio always visible at 14px

### 4. Product Pointer — full bleed band

**Desktop**:

- 60vh tall band, full bleed
- Background `#050402` (same as page — band is just type)
- Centered: Doto "FINTHEON →" at 224px
- Hover state frame: arrow shifts right 12px

**Motion note**: hover triggers x-translate 12px on arrow over 320ms easing solvys

**Mobile**: 40vh tall, "FINTHEON →" at 96px

### 5. Published Work

**Desktop**:

- Section heading mono "PUBLISHED WORK" at 12px, letter-spacing 0.2em, color `#c79f4a`
- Two-column list, 12 rows max
- Each row: mono date (14px) · grotesk title (24px) · mono ticker tag (12px) right-aligned
- Row example: `2026.04.12 · NVDA — When Positioning Eats Earnings · NVDA`
- Hover row: gold underline beneath title only (1px)
- Bottom right: "View archive →" link in mono, 14px

**Motion note**: hover triggers underline draw left-to-right via `t-text-swap` (240ms)

**Mobile**: single column, date stacks above title, ticker tag below title

### 6. Footer

**Desktop + Mobile**:

- Three lines, left-aligned, mono, generous line-height (1.8)
- `contact@pricedinresearch.io` at 18px, color `#f0ead6`
- `BEGIN A CONVERSATION →` at 18px, color `#c79f4a`
- `© Priced In Capital · Solvys Technologies` at 14px, color `#f0ead6` opacity 60%
- Section padding: 160px top, 96px bottom
- No social icons, no nav, no newsletter

## Component library (Page 3)

Extract these reusable components:

- `Hairline` — 1px horizontal gold rule
- `MonoLabel` — section heading style (12px, mono, gold, 0.2em tracking)
- `BodyParagraph` — 32px grotesk paragraph style
- `LinkArrow` — text + arrow with hover x-translate
- `GoldDot` — 8px pulsing dot
- `PublishedRow` — list row with date/title/ticker

## Done means

- All 6 sections × 2 viewports = 12 frames on Page 5
- All hover/scroll motion notes annotated as separate frames or sticky notes
- Component library on Page 3 populated with 6 components
- Figma file shared with TP for Tue EOD review
- Slack/iMessage ping: "S43-T4 done, comps ready for review: [Figma URL]"

## Off-limits

- Don't touch Page 6 (`/fintheon`) — that's T5
- Don't add sections beyond the 6 listed
- Don't propose new tokens
- No animations sketched in Figma — written notes only (motion lives in code per T9)
