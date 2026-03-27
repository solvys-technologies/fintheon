// [claude-code 2026-03-24] Chart overhaul — TradingView iframe embed + compact heat-mapped IV bars
// [claude-code 2026-03-25] Price projection canvas overlay — MiroFish expected move path + confidence band
import { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react';
import type { MiroFishTimePoint, MiroFishRiskCategory, MiroFishScenario } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, COMPOSITE_COLOR, ivHeatColor } from '../../types/mirofish';

/** Map user-facing futures symbols to TradingView widget-compatible symbols. */
const SYMBOL_MAP: Record<string, string> = {
  '/MNQ': 'NASDAQ:NDX',
  '/NQ':  'NASDAQ:NDX',
  '/ES':  'SP:SPX',
  '/MES': 'SP:SPX',
  '/GC':  'COMEX:GC1!',
  '/MGC': 'COMEX:GC1!',
  '/YM':  'DJ:DJI',
  '/RTY': 'RUSSELL:RUT',
  '/CL':  'NYMEX:CL1!',
  'MNQ':  'NASDAQ:NDX',
  'NQ':   'NASDAQ:NDX',
  'ES':   'SP:SPX',
  'MES':  'SP:SPX',
  'YM':   'DJ:DJI',
  'RTY':  'RUSSELL:RUT',
};

function mapSymbol(sym: string): string {
  return SYMBOL_MAP[sym] ?? SYMBOL_MAP[`/${sym}`] ?? 'NASDAQ:NDX';
}

const COMPARE_SYMBOLS = ['COMEX:GC1!', 'SP:SPX', 'NASDAQ:NDX'];

interface SanctumChartProps {
  timeSeries: MiroFishTimePoint[];
  rollingDays: 7 | 14 | 30;
  selectedSymbol?: string;
  compositeIV?: number;
  confidence?: number;
  regimeShiftProbability?: number;
  scenarios?: MiroFishScenario[];
}

const CATS: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];
const PAD = { top: 4, right: 36, bottom: 20, left: 4 };
const AXIS_COLOR = 'rgba(240, 234, 214, 0.3)';
const GOLD_ACCENTS = ['#d4af37', '#c79f4a'];

function isGold(c: HTMLCanvasElement) {
  return GOLD_ACCENTS.includes(getComputedStyle(c).getPropertyValue('--fintheon-accent').trim().toLowerCase());
}

function getThemeColor(c: HTMLCanvasElement, varName: string, fallback: string): string {
  const val = getComputedStyle(c).getPropertyValue(varName).trim();
  return val || fallback;
}

function roundTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** Layered IV bars — highest IV drawn first (back, full opacity, widest) → lowest IV on top (narrow, translucent).
 *  Rich gradient fill: base color → brighter highlight at top → fade to transparent at peak.
 *  Bars fill edge-to-edge within the plot area. */
function drawBars(
  ctx: CanvasRenderingContext2D, data: MiroFishTimePoint[],
  pL: number, pW: number, bTop: number, bH: number, _gold: boolean,
) {
  const n = data.length;
  // Bars fill the full slot width with only 1px gap between
  const slotW = pW / Math.max(n, 1);
  const gap = Math.min(1, slotW * 0.05);
  const maxBarW = slotW - gap;

  for (let i = 0; i < n; i++) {
    const cx = pL + (i / Math.max(n - 1, 1)) * pW;

    // Sort categories by IV score descending — highest (most dangerous) drawn first in back
    const sorted = CATS
      .map(cat => ({ cat, val: data[i].categories[cat] }))
      .filter(c => c.val > 0.1)
      .sort((a, b) => b.val - a.val);

    for (let layer = 0; layer < sorted.length; layer++) {
      const { val } = sorted[layer];
      const color = ivHeatColor(val);

      // Height: proportional to IV score (full pane height at 10)
      const barH = (val / 10) * bH;
      if (barH < 1) continue;

      // Width: back layers fill full slot, front layers progressively narrower
      const widthScale = 1 - (layer / sorted.length) * 0.45;
      const bW = maxBarW * widthScale;

      // Opacity: back layer (highest IV) = 100% solid, each subsequent layer fades
      const alpha = layer === 0 ? 1.0 : Math.max(0.15, 0.7 / (layer + 0.5));

      const sy = bTop + bH - barH;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Rich vertical gradient: solid base → bright highlight band → transparent fade at peak
      const grad = ctx.createLinearGradient(0, sy + barH, 0, sy);
      grad.addColorStop(0, color);                                          // solid base
      grad.addColorStop(0.3, color);                                        // hold solid
      grad.addColorStop(0.6, lightenColor(color, layer === 0 ? 25 : 15));   // highlight band
      grad.addColorStop(0.85, color + (layer === 0 ? 'cc' : '80'));         // start fade
      grad.addColorStop(1, color + (layer === 0 ? '60' : '20'));            // transparent peak
      ctx.fillStyle = grad;

      // Rounded top
      roundTopRect(ctx, cx - bW / 2, sy, bW, barH, 3);
      ctx.fill();

      // Inner highlight shimmer — thin bright line at ~60% height for glass effect
      if (barH > 8) {
        const shimmerY = sy + barH * 0.35;
        ctx.save();
        ctx.globalAlpha = layer === 0 ? 0.25 : 0.12;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - bW / 2 + 1, shimmerY, bW - 2, 1);
        ctx.restore();
      }

      // Top-edge glow for high-IV bars
      if (val >= 5) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = val >= 7 ? 12 : 6;
        ctx.globalAlpha = layer === 0 ? 0.6 : 0.2;
        ctx.fillStyle = color;
        ctx.fillRect(cx - bW / 2, sy, bW, Math.min(2, barH));
        ctx.restore();
      }

      ctx.restore();
    }
  }
}

/** Lighten a hex color by a percentage (0-100). */
function lightenColor(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + Math.round(255 * pct / 100));
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + Math.round(255 * pct / 100));
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + Math.round(255 * pct / 100));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/* ── Projection overlay: draws expected move path + confidence band on top of TradingView ── */

/** Generate a smooth projected path using MiroFish data.
 *  Returns an array of {x, y} points normalized to 0-1 range. */
function generateProjectionPath(
  compositeIV: number,
  confidence: number,
  regimeShift: number,
  scenarios: MiroFishScenario[],
): { points: { x: number; y: number }[]; bandWidth: number; direction: 'up' | 'down' | 'flat' } {
  // Direction: high IV + low confidence = bearish bias; low IV = bullish bias
  const avgScenarioScore = scenarios.length > 0
    ? scenarios.reduce((s, sc) => s + sc.projectedScore * sc.probability, 0) / Math.max(1, scenarios.reduce((s, sc) => s + sc.probability, 0))
    : compositeIV;

  // Bearish if composite IV is high (risk elevated), bullish if low
  const direction: 'up' | 'down' | 'flat' =
    avgScenarioScore >= 6.5 ? 'down' :
    avgScenarioScore <= 3.5 ? 'up' :
    'flat';

  // Magnitude: scaled by IV level (higher IV = bigger expected move)
  const magnitude = (compositeIV / 10) * 0.3; // 0 to 0.3 of chart height

  // Band width: wider with less confidence, wider with regime shift risk
  const bandWidth = (1 - confidence) * 0.15 + regimeShift * 0.1;

  // Generate 8-12 points along the projection path with slight natural curve
  const numPoints = 10;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 → 1 (left to right across projection zone)
    const easeT = t * t * (3 - 2 * t); // smoothstep easing

    // Base direction
    let yOffset: number;
    if (direction === 'up') {
      yOffset = -easeT * magnitude;
    } else if (direction === 'down') {
      yOffset = easeT * magnitude;
    } else {
      // Flat with slight oscillation
      yOffset = Math.sin(t * Math.PI * 2) * magnitude * 0.15;
    }

    // Add subtle natural curvature (S-curve for realism)
    const curvature = Math.sin(t * Math.PI) * magnitude * 0.08;
    yOffset += curvature;

    points.push({ x: t, y: 0.5 + yOffset }); // 0.5 = center of chart
  }

  return { points, bandWidth, direction };
}

function drawProjectionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  compositeIV: number,
  confidence: number,
  regimeShift: number,
  scenarios: MiroFishScenario[],
  accentColor: string,
  lowColor: string,
  severeColor: string,
) {
  const { points, bandWidth, direction } = generateProjectionPath(compositeIV, confidence, regimeShift, scenarios);

  // Projection zone: right 30% of the chart area
  const projStart = w * 0.70;
  const projWidth = w * 0.28;
  const chartTop = h * 0.08;
  const chartHeight = h * 0.84;

  // Map normalized points to canvas coordinates
  const canvasPoints = points.map(p => ({
    x: projStart + p.x * projWidth,
    y: chartTop + p.y * chartHeight,
  }));

  // ── Confidence band (filled area) ──
  const bandPixels = bandWidth * chartHeight;
  ctx.save();

  // Upper band edge
  ctx.beginPath();
  canvasPoints.forEach((p, i) => {
    const y = p.y - bandPixels;
    i === 0 ? ctx.moveTo(p.x, y) : ctx.lineTo(p.x, y);
  });
  // Lower band edge (reversed)
  for (let i = canvasPoints.length - 1; i >= 0; i--) {
    const p = canvasPoints[i];
    ctx.lineTo(p.x, p.y + bandPixels);
  }
  ctx.closePath();

  // Gradient fill for band
  const bandGrad = ctx.createLinearGradient(projStart, 0, projStart + projWidth, 0);
  const bandColor = direction === 'down' ? severeColor : direction === 'up' ? lowColor : accentColor;
  bandGrad.addColorStop(0, bandColor + '08');
  bandGrad.addColorStop(0.5, bandColor + '15');
  bandGrad.addColorStop(1, bandColor + '08');
  ctx.fillStyle = bandGrad;
  ctx.fill();

  // ── Main projection line ──
  ctx.beginPath();
  canvasPoints.forEach((p, i) => {
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Glow effect on the line ──
  ctx.beginPath();
  canvasPoints.forEach((p, i) => {
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.15;
  ctx.stroke();

  ctx.globalAlpha = 1;

  // ── Endpoint dot ──
  const last = canvasPoints[canvasPoints.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.stroke();

  // ── Label at endpoint ──
  ctx.globalAlpha = 0.7;
  ctx.font = '10px sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'left';
  const label = direction === 'up' ? 'BULLISH' : direction === 'down' ? 'BEARISH' : 'NEUTRAL';
  ctx.fillText(label, last.x + 12, last.y + 3);

  // IV + confidence sub-label
  ctx.font = '9px sans-serif';
  ctx.globalAlpha = 0.4;
  ctx.fillText(`IV ${compositeIV.toFixed(1)} · ${Math.round(confidence * 100)}% conf`, last.x + 12, last.y + 15);

  ctx.restore();
}

export function SanctumChart({
  timeSeries, rollingDays, selectedSymbol = 'QQQ',
  compositeIV, confidence, regimeShiftProbability, scenarios,
}: SanctumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const [tvLoaded, setTvLoaded] = useState(false);
  const data = timeSeries.filter(p => p.dayOffset <= rollingDays);

  const tvSymbol = mapSymbol(selectedSymbol);

  const tvEmbedUrl = useMemo(() => {
    const studies = COMPARE_SYMBOLS
      .filter(s => s !== tvSymbol)
      .map(s => `Compare@tv-basicstudies|0|${s}`);
    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval: '240',
      theme: 'dark',
      style: '3',
      locale: 'en',
      timezone: 'America/New_York',
      toolbar_bg: '000000',
      enable_publishing: '0',
      hide_side_toolbar: '0',
      allow_symbol_change: '1',
      save_image: '0',
      hide_volume: '1',
      withdateranges: '1',
    });
    if (studies.length > 0) params.set('studies', JSON.stringify(studies));
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [tvSymbol]);

  // ── Projection overlay drawing ──
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const container = tvContainerRef.current;
    if (!canvas || !container || compositeIV == null || confidence == null) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const accentColor = getThemeColor(canvas, '--fintheon-accent', '#c79f4a');
    const lowColor = getThemeColor(canvas, '--fintheon-low', '#34D399');
    const severeColor = getThemeColor(canvas, '--fintheon-severe', '#EF4444');

    drawProjectionOverlay(
      ctx, rect.width, rect.height,
      compositeIV, confidence,
      regimeShiftProbability ?? 0,
      scenarios ?? [],
      accentColor, lowColor, severeColor,
    );
  }, [compositeIV, confidence, regimeShiftProbability, scenarios]);

  // Draw projection when data changes or TV loads
  useEffect(() => {
    if (tvLoaded) drawOverlay();
  }, [tvLoaded, drawOverlay]);

  // Resize observer for projection overlay
  useEffect(() => {
    const c = tvContainerRef.current;
    if (!c) return;
    const obs = new ResizeObserver(() => { if (tvLoaded) drawOverlay(); });
    obs.observe(c);
    return () => obs.disconnect();
  }, [tvLoaded, drawOverlay]);

  // ── IV bars canvas drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;
    const rect = container.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const pW = w - PAD.left - PAD.right;
    const bTop = PAD.top;
    const bH = h - PAD.top - PAD.bottom;
    const gold = isGold(canvas);
    const grid = gold ? 'rgba(212,175,55,0.06)' : 'rgba(128,128,128,0.08)';
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    const ivStep = bH > 60 ? 5 : 10;
    for (let iv = 0; iv <= 10; iv += ivStep) {
      const y = bTop + bH - (iv / 10) * bH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
      ctx.fillStyle = AXIS_COLOR; ctx.fillText(String(iv), w - PAD.right + 6, y + 4);
    }

    const lStep = Math.max(1, Math.floor(data.length / Math.max(4, Math.floor(w / 100))));
    ctx.fillStyle = AXIS_COLOR; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += lStep) {
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * pW;
      ctx.fillText(data[i].date.slice(5), x, h - 4);
    }

    drawBars(ctx, data, PAD.left, pW, bTop, bH, gold);
  }, [data]);

  const drawRef = useRef(draw);
  useLayoutEffect(() => { drawRef.current = draw; }, [draw]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const c = containerRef.current; if (!c) return;
    const obs = new ResizeObserver(() => drawRef.current());
    obs.observe(c);
    return () => obs.disconnect();
  }, []);

  const hasProjection = compositeIV != null && confidence != null && tvLoaded;

  return (
    <div className="w-full h-full flex flex-col">
      {/* TradingView pane with projection overlay */}
      <div
        ref={tvContainerRef}
        className="flex-[3] min-h-0 rounded-t overflow-hidden border border-[var(--fintheon-accent)]/10 transition-opacity duration-700 relative"
        style={{ opacity: tvLoaded ? 1 : 0 }}
      >
        <iframe
          src={tvEmbedUrl}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => setTvLoaded(true)}
          title="TradingView Chart"
        />
        {/* Projection canvas overlay — positioned above the iframe */}
        {hasProjection && (
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          />
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-[var(--fintheon-accent)]/15 shrink-0" />

      {/* Compact IV risk bars pane */}
      <div ref={containerRef} className="flex-1 min-h-[80px] relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
