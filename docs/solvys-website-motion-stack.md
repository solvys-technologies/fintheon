# Solvys Website Motion Stack

This is the default stack for Solvys public websites and high-polish launch pages.

## Standard

- Three.js for 360-degree product scenes, rotatable hero objects, and WebGL-native set pieces. No plugin is required for the core interaction.
- WebGL lights for product atmosphere. Use `PointLight` or equivalent shader uniforms when glow should react to scroll, pointer, or section state.
- CSS scroll-snap for buttery horizontal product rails, section-by-section tours, and mobile-safe carousel behavior.
- GSAP ScrollTrigger for complex pinned storytelling where product media stays fixed while copy scrolls alongside it.
- Lottie through `lottie-web` when an After Effects JSON asset is the source of truth for a micro-animation or branded sequence.

## Fintheon Direction

- Lead with market chaos: trading-floor, exchange-floor, or crash-era imagery treated with ASCII, dithering, scanlines, and data overlays.
- Use the product layer to impose order: Fintheon copy, agents, RiskFlow, NarrativeFlow, and PsychAssist should feel like the signal system above the chaos.
- Keep copy and controls code-native. Raster/video assets can carry ambience, but headings, CTAs, forms, and navigation stay accessible HTML.
- Prefer compressed video for animated hero media. Do not ship raw oversized GIFs on public pages.

## Implementation Notes

- Use Three.js when the section needs camera, lighting, or rotatable geometry.
- Use CSS scroll-snap before JavaScript for simple product rails.
- Use ScrollTrigger only for pinned choreography that cannot be expressed cleanly with CSS sticky plus scroll progress.
- Use Lottie only when there is a real AE/Lottie source asset; otherwise prefer CSS, SVG, canvas, or Three.js.
- Respect `prefers-reduced-motion` on every animation layer.
