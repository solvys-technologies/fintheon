// [claude-code 2026-03-24] Dither hero background shaped like the Fintheon logo (concentric rings + diagonal)
import React, { useMemo } from 'react';

// Dither chars by visual weight (light → heavy)
const D = [' ', ' ', '·', '.', '∙', ':', '░', '▒', '▓', '█'];

// Seeded PRNG for deterministic noise
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLS = 160;
const ROWS = 70;

// The Fintheon logo: concentric rings (3 bands) with a diagonal slash from upper-right
// Rendered as a dither density map — dense where the rings are, sparse elsewhere
function generateLogoField(): string {
  const rand = rng(8821);
  const grid: string[][] = [];

  // Logo center — offset left and slightly up to act as hero on the left branding side
  const cx = COLS * 0.35;
  const cy = ROWS * 0.48;

  // Ring radii (in character units, accounting for ~2:1 char aspect ratio)
  const ASPECT = 2.1; // monospace chars are taller than wide
  const rings = [
    { r: 8, width: 1.8 },   // inner ring (tight)
    { r: 15, width: 2.0 },  // middle ring
    { r: 23, width: 2.2 },  // outer ring
  ];

  // Center dot radius
  const dotR = 2.5;

  // Diagonal slash: line from upper-right through center, going to lower-left
  // Slope: the logo shows a line going from ~1 o'clock to ~7 o'clock
  const slashAngle = -1.2; // radians (roughly 70° from horizontal)
  const slashWidth = 1.6;

  for (let r = 0; r < ROWS; r++) {
    const row: string[] = [];
    for (let c = 0; c < COLS; c++) {
      // Normalized distance from logo center (corrected for char aspect ratio)
      const dx = (c - cx);
      const dy = (r - cy) * ASPECT;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Compute density for this pixel
      let density = 0;

      // Center dot
      if (dist < dotR) {
        density = 0.9;
      }

      // Concentric rings — each ring contributes density based on proximity to its radius
      for (const ring of rings) {
        const ringDist = Math.abs(dist - ring.r);
        if (ringDist < ring.width) {
          // Sharper falloff at edges, solid at center of ring stroke
          const t = 1 - ringDist / ring.width;
          density = Math.max(density, t * 0.85);
        }
      }

      // Diagonal slash — a line through center at slashAngle
      // Project point onto perpendicular of the slash line
      const cosA = Math.cos(slashAngle);
      const sinA = Math.sin(slashAngle);
      const perpDist = Math.abs(dx * sinA - dy * cosA);
      // Only render the slash where it extends beyond the outer ring
      const alongLine = dx * cosA + dy * sinA;
      if (perpDist < slashWidth && alongLine > -5) {
        // Taper the slash — stronger near center, fades at tip
        const reach = Math.min(alongLine / 40, 1);
        const slashStrength = (1 - perpDist / slashWidth) * 0.7;
        density = Math.max(density, slashStrength * (0.4 + reach * 0.6));
      }

      // Add noise to the density for dither feel
      const noise = rand() * 0.35;
      const finalDensity = density + (density > 0.1 ? noise * 0.4 : noise * 0.05);

      // Very faint ambient noise everywhere (atmosphere)
      const ambient = rand() > 0.92 ? 0.08 : 0;
      const total = Math.max(finalDensity, ambient);

      // Map density to character
      const charIdx = Math.min(Math.floor(total * D.length), D.length - 1);
      row.push(D[charIdx]);
    }
    grid.push(row);
  }

  return grid.map(row => row.join('')).join('\n');
}

export const AsciiBackground: React.FC = () => {
  const art = useMemo(() => generateLogoField(), []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <pre
        className="whitespace-pre text-[#c79f4a]/[0.07] leading-[1.15]"
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '10px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {art}
      </pre>
    </div>
  );
};
