// [claude-code 2026-03-24] T2 — Deep dither background with embedded Roman trading motifs
import React, { useMemo } from 'react';

// Dither characters ordered by visual density (light → heavy)
const DITHER_LIGHT = [' ', ' ', ' ', '·', '.', '∙', ':', '᛫'];
const DITHER_MED = ['░', '░', '▒', '╌', '┄', '─', '╴', '╶'];
const DITHER_HEAVY = ['▒', '▓', '█', '▓', '▒', '░', '▓', '█'];

// Seeded PRNG for deterministic output
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roman trading motifs to embed in the dither field
const MOTIFS = [
  // Commodity ticker board
  [
    '┌─────────────────────────────────┐',
    '│ TABULA MERCATORUM               │',
    '│                                 │',
    '│ AURUM ......... MCCXLII  ▲     │',
    '│ ARGENTUM ...... DCCXCI   ▼     │',
    '│ TRITICUM ...... CLXXXIV  ▲     │',
    '│ OLIVUM ........ XCII     ━     │',
    '│ AERIS ......... CDLVI    ▲     │',
    '│                                 │',
    '│ FORTUNA FAVET FORTIBUS          │',
    '└─────────────────────────────────┘',
  ],
  // Candlestick fragment
  [
    '    │    │         │    ',
    '   ▲│▲  │    ▼    │ ▲  ',
    '  ▲│ │  │   │▼    │▲│  ',
    ' ▲│  │  │   │ ▼  ▲│ │  ',
    '▲│   │▲ │   │  ▼▲│  │  ',
    '├────┼──┼───┼───┼────┤ ',
    '0   100 200 300 400 500',
  ],
  // Roman column
  [
    '  ╔════╗  ',
    '  ║SPQR║  ',
    '  ╚════╝  ',
    '   ║  ║   ',
    '   ║  ║   ',
    '   ║  ║   ',
    '   ║  ║   ',
    '   ║  ║   ',
    '  ┌╨──╨┐  ',
    '  └────┘  ',
  ],
  // Legion marker
  [
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓ LEGIO  XIII ▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  ],
];

// Motif placements: [motifIndex, gridRow, gridCol] — positioned to avoid center
const PLACEMENTS: [number, number, number][] = [
  [0, 8, 6],     // ticker board — upper left area
  [1, 30, 90],   // candlestick — right side
  [2, 5, 110],   // column — far right
  [2, 5, 12],    // column — left
  [3, 42, 50],   // legion marker — bottom center-ish
  [1, 35, 15],   // candlestick — lower left
  [3, 3, 85],    // legion marker — upper right
];

const COLS = 140;
const ROWS = 50;

function generateDitherGrid(): string {
  const rng = mulberry32(7743); // fixed seed for consistency
  const grid: string[][] = [];

  // Fill with dither noise — density varies by region (radial falloff from center)
  const cx = COLS / 2;
  const cy = ROWS / 2;

  for (let r = 0; r < ROWS; r++) {
    const row: string[] = [];
    for (let c = 0; c < COLS; c++) {
      // Distance from center (normalized 0-1)
      const dx = (c - cx) / cx;
      const dy = (r - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Denser at edges, sparser near center (leaves room for UI)
      const v = rng();
      const edgeBias = Math.min(dist * 1.2, 1);

      if (v > 0.7 + (1 - edgeBias) * 0.25) {
        // Heavy dither at edges
        row.push(DITHER_HEAVY[Math.floor(rng() * DITHER_HEAVY.length)]);
      } else if (v > 0.4 + (1 - edgeBias) * 0.3) {
        // Medium dither
        row.push(DITHER_MED[Math.floor(rng() * DITHER_MED.length)]);
      } else if (v > 0.15 + (1 - edgeBias) * 0.35) {
        // Light scatter
        row.push(DITHER_LIGHT[Math.floor(rng() * DITHER_LIGHT.length)]);
      } else {
        row.push(' ');
      }
    }
    grid.push(row);
  }

  // Stamp motifs into the grid
  for (const [motifIdx, startRow, startCol] of PLACEMENTS) {
    const motif = MOTIFS[motifIdx];
    for (let mr = 0; mr < motif.length; mr++) {
      const gr = startRow + mr;
      if (gr >= ROWS) break;
      const line = motif[mr];
      for (let mc = 0; mc < line.length; mc++) {
        const gc = startCol + mc;
        if (gc >= COLS) break;
        if (line[mc] !== ' ') {
          grid[gr][gc] = line[mc];
        }
      }
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

export const AsciiBackground: React.FC = () => {
  const art = useMemo(() => generateDitherGrid(), []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <pre
        className="whitespace-pre text-[#c79f4a]/[0.05] leading-[1.2]"
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '11px',
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
