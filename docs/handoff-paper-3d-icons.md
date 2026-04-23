# Handoff Prompt — Paper Native AI Agent

## Solvys 3D Icon Bank & Microinteractions

---

## CONTEXT

You are designing a complete 3D icon bank and microinteraction system for **Fintheon**, a trading/finance desktop application. The brand is **Solvys**.

**Critical reference:** The Solvys logo is a golden 3D isometric emblem — a circuit-board/tree motif inside a radiating spiked circle, sitting on an isometric grid platform. Every icon must share this same **isometric platform base** aesthetic and a **slight leftward rotation** (the platform extends toward bottom-left, like the logo).

---

## DESIGN SYSTEM

### Color Palette (CSS Custom Properties — THEME-READY)

All colors MUST use these CSS variables so they connect to app theme settings:

```css
:root {
  --fintheon-accent: #c79f4a; /* Burnished gold — primary */
  --fintheon-accent-light: #e8d5a3; /* Lighter gold — highlights */
  --fintheon-bg: #0a0905; /* Instrument black — backgrounds */
  --fintheon-surface: #141210; /* Panel surface — icon bases */
  --fintheon-highlight: #f0ead6; /* Parchment white — specular */
  --fintheon-shadow: #050402; /* Deep shadow */
}
```

### Typography

- Labels: **Inter Medium** 11px, uppercase, letter-spacing 0.08em, color: var(--fintheon-accent)
- Headings: **Space Grotesk Bold** 32px, color: var(--fintheon-highlight)

### Platform Base (Every icon gets this)

Each icon must sit on an isometric diamond platform:

- Top face: diamond polygon (stroke: var(--fintheon-accent), stroke-width: 1.2)
- Left face: visible side panel going down-left (stroke: var(--fintheon-accent), stroke-dasharray: 2 2 for dotted edge)
- Right face: visible side panel going down-right (stroke: var(--fintheon-accent), opacity: 0.4)
- Bottom edge: connecting line
- Size: ~100×100px container, platform top is ~60px wide diamond

### Icon Shape (Above the platform)

- Stroke: var(--fintheon-accent) or var(--fintheon-highlight)
- Stroke-width: 1.4–1.8
- Style: Clean geometric line art, minimal, Swiss editorial precision
- Fill: None or very subtle (opacity 0.08–0.14)
- Positioned ~8px above platform center

### Rotation

All icons should have a subtle **leftward isometric lean** — the platform top should appear to recede toward the upper-right, with the left face more prominent (matching the Solvys logo's orientation).

---

## PART 1: ISO ICONS (35 icons total)

These are the core app icons. Each needs a 3D isometric platform base + the icon shape above it.

### NAV ICONS (6)

| Name         | Description                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| **Home**     | House with roof slopes, front wall, door, and knob. Isometric perspective.     |
| **News**     | Two layered newspaper sheets with center fold and headline lines. Spread open. |
| **Chat**     | Chat bubble body (parallelogram) with tail and two text lines inside.          |
| **Settings** | 3-drawer filing cabinet with top/left/right faces and two knob circles.        |
| **Menu**     | Three stacked horizontal bars (hamburger) as iso parallelograms.               |
| **Bell**     | Bell dome with base rim ellipse, top nub, clapper circle, and two light rays.  |

### STATUS ICONS (7)

| Name            | Description                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Zap**         | Battery/cylinder body with lightning bolt inside. Bolt is prominent.                       |
| **Crosshair**   | Target with outer ring, middle ring, inner dot, and 4 cross ticks (top/bottom/left/right). |
| **Sun**         | Circle center with 8 radiating rays evenly spaced.                                         |
| **Moon**        | Crescent moon shape with two small star accent dots nearby.                                |
| **CheckCircle** | Circle with a checkmark polyline inside (stroke-width: 2).                                 |
| **XCircle**     | Circle with an X cross inside (stroke-width: 2).                                           |
| **ShieldCheck** | Shield body (pointed bottom) with inner checkmark polyline.                                |

### CONTENT ICONS (9)

| Name              | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Search**        | Magnifying glass: circle lens with inner highlight dot + diagonal handle.             |
| **Paperclip**     | Classic paperclip curved shape. Single continuous stroke.                             |
| **StickyNote**    | Note with folded top-right corner and three horizontal text lines.                    |
| **Clock**         | Watch/clock face with two hands (pointing ~10:10), small stem at top, center pin dot. |
| **Calendar**      | Calendar body with header strip at top, two binding rings, and 6 date dots in grid.   |
| **Trash**         | Trash can with lid, handle on lid, and two vertical inner slots.                      |
| **Refresh**       | ¾ circular arc with arrowhead at end + small accent arc opposite.                     |
| **ExternalLink**  | Open box (missing top-right) with diagonal arrow exiting upper-right.                 |
| **MessageCircle** | Speech bubble with three horizontal dots inside.                                      |

### GLYPH ICONS (10)

| Name             | Description                              |
| ---------------- | ---------------------------------------- |
| **Check**        | Simple checkmark polyline.               |
| **X**            | Simple X cross (two diagonal lines).     |
| **Plus**         | Plus sign (vertical + horizontal lines). |
| **Minus**        | Horizontal minus line.                   |
| **ChevronUp**    | Up-pointing chevron/V shape.             |
| **ChevronDown**  | Down-pointing chevron/V shape.           |
| **ChevronRight** | Right-pointing chevron/V shape.          |
| **ArrowUp**      | Up arrow with shaft and arrowhead.       |
| **ArrowRight**   | Right arrow with shaft and arrowhead.    |
| **ArrowUpRight** | Diagonal arrow pointing up-right.        |

### SIDEBAR ICONS (8)

| Name              | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| **LogOut**        | Door frame (open on right) with rightward exit arrow.                      |
| **Landmark**      | Classical building with triangular pediment, 4 columns, and base platform. |
| **GripVertical**  | 6 dots arranged in 2×3 grid (drag handle).                                 |
| **ChevronsLeft**  | Double left chevron (two V-shapes pointing left).                          |
| **ChevronsRight** | Double right chevron (two V-shapes pointing right).                        |
| **BookOpenCheck** | Open book with spine in middle, checkmark on right page, lines on left.    |
| **BellOff**       | Bell silhouette with diagonal slash through it.                            |
| **Wrench**        | Wrench body from upper-left to lower-right, open head on left.             |

---

## PART 2: ASCII/BRAILLE SPINNERS — Nothing Design Aesthetic

Create a set of **6 core loading spinners** in the Nothing Design style:

- Minimal, pixel-perfect, monochrome
- Use Braille Unicode characters or simple ASCII
- Clean, mechanical, precise
- Color: var(--fintheon-accent) on var(--fintheon-bg)

### Required Spinners

| Name      | Style                    | Frames                        |
| --------- | ------------------------ | ----------------------------- |
| **Dots**  | Classic Braille rotation | `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`         |
| **Helix** | Vertical Braille helix   | `⠁ ⠂ ⠄ ⡀ ⢀ ⠠ ⠐ ⠈`             |
| **Pulse** | Growing/shrinking dot    | `· • ● • ·`                   |
| **Wave**  | Audio waveform bars      | `▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ ▃ ▂` |
| **Arc**   | Rotating quarter-circle  | `◜ ◠ ◝ ◞ ◡ ◟`                 |
| **Clock** | Clock hand rotation      | `◴ ◷ ◶ ◵`                     |

Each spinner should be shown as:

1. A **static frame sequence** (4–6 frames displayed side by side)
2. A **3D platform base** matching the icon style
3. A **label** identifying the spinner

---

## PART 3: THINKING INDICATORS

### Default Thinking State

- **8px pulsing gold dot** (`var(--fintheon-accent)`)
- Animation: `p 1.5s ease-in-out infinite` (opacity pulse)
- Positioned left of thinking text

### Cognition Steps ( glyphs used in sequence )

These glyphs appear as step indicators:
`→` `≡` `✓` `⊙` `⚑` `⇌` `↩` `◆` `✕`

Each step should have:

- A small platform base (mini version, ~40px)
- The glyph centered above it
- Color: var(--fintheon-accent)

---

## OUTPUT FORMAT

Create **TWO artboards** in Paper:

### Artboard 1: "Solvys 3D Icon Bank"

- Dark background: var(--fintheon-bg)
- Header: "Solvys 3D Icon Bank" in Space Grotesk Bold 32px
- Subheader: "Isometric platform base × golden line art × theme-ready CSS vars"
- Grid of all 35 icons, organized by category (Nav, Status, Content, Glyphs, Sidebar)
- Each icon: platform base + icon shape + label below
- Use CSS custom properties for ALL colors

### Artboard 2: "Microinteractions & Spinners"

- Dark background: var(--fintheon-bg)
- Header: "Microinteractions"
- Section 1: The 6 spinners with frame sequences
- Section 2: Thinking indicator (pulsing dot)
- Section 3: Cognition step glyphs on mini platforms

---

## CRITICAL RULES

1. **NO raster images** — everything must be SVG/vector
2. **ALL colors via CSS vars** — never hardcode hex values
3. **Platform base on EVERY icon** — the isometric diamond is the signature
4. **Leftward lean** — match the Solvys logo's orientation
5. **Golden stroke** — var(--fintheon-accent) for all strokes
6. **Minimal fill** — no solid fills, only subtle opacity fills (0.04–0.14)
7. **Clean geometry** — Swiss precision, no decorative flourishes
8. **Consistent stroke-width** — 1.2 for platform, 1.4–1.8 for icon shapes
9. **Nothing Design spinners** — stark, mechanical, Braille/ASCII only
10. **Theme-ready** — the entire design must work if --fintheon-accent changes to any color

---

## REFERENCE: SOLVYS LOGO CHARACTERISTICS

The attached Solvys logo shows:

- Isometric perspective (30° angle)
- Golden line art (#c79f4a)
- Platform/base with dotted edge detail
- Clean geometric shapes
- Slight leftward rotation (left face more visible)
- Transparent/dark background

Every icon must feel like it belongs on the same platform as this logo.
