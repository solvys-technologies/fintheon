# S43-T5 — Figma comps for `/fintheon` (cinematic product page)

**Owner**: Designer B
**Day**: Wed 2026-04-29 (begins Tue afternoon for Acts 0–2)
**Outputs**: All 9 acts of the cinematic page at desktop (1440px) + mobile (390px), scroll-storyboard diagram, video-anchor frames marked.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T1 scaffolded the Figma file — open Page 6 ("Page 2 comps (`/fintheon`)"). Reference Page 0 (ddlabstudio.com captures) for scroll-pinned video and act-based storyboard pacing. The Hyperframes keynote (T3/T6) is the spine of Acts 1, 4, 9 — leave those frames as 16:9 placeholders with the locked timecode labeled.

## Brand spec (already locked on Tokens page)

- Palette: `#050402` / `#c79f4a` / `#f0ead6`
- Type: Doto (display) · grotesk (UI) · mono (accents)
- Surfaces: matte, hairline 1px gold borders, no glass/blur/shadow/gradient
- Banned: gradients, emojis, sparkles, neon, particles, drop shadows

## Frames to deliver (Page 6)

Each act gets desktop 1440×900 + mobile 390×844 paired side-by-side. Acts that span multiple beats (Act 4 = 5 sub-acts) get one frame per beat.

### Scroll-storyboard diagram (top of Page 6)

Single horizontal strip diagram showing scroll progress 0% → 100% mapped to acts 0 → 9, with video timecode anchors marked at:
- 0:00 (Act 1 enters)
- 0:24 (Act 4 enters)
- 1:14 (Act 9 enters)

This diagram tells T9 where to bind GSAP ScrollTriggers.

### Act 0 — Cold open

**Desktop**: pure black canvas, no content. Annotation frame: "3s dead air on first paint, then Doto type-on 'FIVE AGENTS. ONE SURFACE.' character-by-character at 40ms stagger. Hold 2s. Cut to Act 1."

**Mobile**: same, type drops to 48px

### Act 1 — Hero keynote video

**Desktop**:
- Full-bleed `<video>` placeholder (16:9, max-width 1440px, centered)
- 1px gold border around video
- Caption beneath in mono 14px: "Fintheon — the Integrated Trading Environment."
- Frame label: "VIDEO ANCHOR · timecode 0:00–0:14"

**Mobile**: video remains 16:9, fits viewport width, caption 12px

### Act 2 — Problem

**Desktop**:
- Black canvas, type-only
- Three Doto lines stacked, 96px each, 80px gaps:
  - "Bloomberg costs $24,000/yr."
  - "Retail tools are vibe-coded."
  - "Neither understands narrative."
- Each line revealed via `t-text-swap` on scroll progress

**Mobile**: lines drop to 40px, gaps 48px

### Act 3 — Consilium Boardroom

**Desktop**:
- 1440-wide cinematic still of Consilium UI (placeholder image — TP supplies via T3 captures)
- Frame UI like a Vermeer: dark canvas, single warm key from upper-left implied
- Caption beneath in mono 14px: "Where signals are deliberated, not just displayed."

**Mobile**: image scales to 390 width, maintains aspect

### Act 4 — Agent reveal (5 sub-acts)

For each agent (Harper, Oracle, Feucht, Consul, Herald):

**Desktop frame per sub-act**:
- Left half (720px): Doto numeral "01" through "05" at 224px, color `#c79f4a`
- Below numeral: grotesk agent name at 48px, role at 18px (opacity 60%)
- Right half (720px): 16:9 video placeholder for the captured UI loop, 1px gold border
- Frame label: "VIDEO ANCHOR · sub-act {N} · 6s loop"
- Annotation: "right side pinned via ScrollTrigger while left text scrolls past"

**Mobile per sub-act**: stacks vertically — numeral + name top, video bottom; no scroll-pin

### Act 5 — Arbitrum chamber

**Desktop**:
- Centered Arbitrum chamber visualization (Hyperframes-generated, placeholder for now)
- 12s loop of 5-seat token traverse
- Heading above in Doto 96px: "FIVE SEATS. ONE VERDICT."
- Caption below in mono 14px: "Arbitrum — 5-seat Qwen deliberation engine via Hermes."
- Frame label: "VIDEO ANCHOR · 0:54–1:06"

**Mobile**: heading drops to 40px, video maintains 16:9

### Act 6 — RiskFlow + NarrativeFlow

**Desktop**:
- Side-by-side 16:9 placeholders, 1px gold borders, 24px gap between
- Left labeled "RiskFlow" in mono, right labeled "NarrativeFlow"
- Caption below spanning both in mono 14px: "Headlines scored. Narratives tracked. IV-weighted."

**Mobile**: stacks vertically, 16px gap

### Act 7 — Execution rail

**Desktop**:
- Single horizontal rail, three logos rendered in `#f0ead6` bone:
  - TopStepX
  - Kalshi
  - Tradovate
- 1px gold dividers between
- Caption below in mono 14px: "Multi-platform execution."

**Mobile**: rail stacks vertically, dividers become horizontal

### Act 8 — Lifetime tier

**Desktop**:
- Big Doto numeral with the price (TP supplies — placeholder "$XXXX") at 320px, color `#c79f4a`
- Below in grotesk 24px: "One-time. Lifetime access."
- Below in CTA button: "REQUEST ACCESS →" — 1px gold border, transparent fill, 24px grotesk text
- Hover frame variant: button fills to gold, text inverts to `#050402` via `t-card-resize` (320ms)

**Mobile**: numeral drops to 160px, button width 100%

### Act 9 — Closing keynote frame

**Desktop**:
- Final still from Hyperframes Act 7 (closing frame "INTELLIGENCE THAT LEADS." on black)
- Frame label: "VIDEO ANCHOR · timecode 1:14–1:30 · holds as poster"
- Footer matches Page 1 footer (3 lines, mono, left-aligned)

**Mobile**: same, scaled

## Component library additions (extend Page 3)

- `VideoFrame` — 16:9 with 1px gold border + mono caption beneath
- `ActHeader` — Doto display + optional mono caption pattern
- `LetterboxedVideo` — 1440 max-width 16:9 with letterbox padding
- `CTAButton` — gold-border transparent → fills on hover

## Done means

- 9 acts × 2 viewports = ~18+ frames (Act 4 has 5 sub-acts × 2 = 10 extra)
- Scroll-storyboard diagram at top of Page 6
- All video anchors labeled with timecodes matching T3 cut sheet
- Component library on Page 3 extended with 4 new components
- Figma file shared with TP for Wed EOD review
- Slack/iMessage ping: "S43-T5 done, /fintheon comps ready: [Figma URL]"

## Off-limits

- Don't touch Page 5 (`/`) — that's T4
- Don't deviate from the 9-act structure without TP signoff
- Don't sketch animations in Figma frames — written notes only
- Don't generate placeholder video assets — T6 owns Hyperframes renders
