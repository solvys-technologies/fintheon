// [claude-code 2026-03-28] S9-T3: Removed IV risk bars canvas — TradingView + projection overlay only
// [claude-code 2026-03-24] Chart overhaul — TradingView iframe embed
// [claude-code 2026-03-25] Price projection canvas overlay — MiroShark expected move path + confidence band
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type {
  MiroSharkTimePoint,
  MiroSharkScenario,
} from "../../types/miroshark";

/** Map user-facing futures symbols to TradingView widget-compatible symbols. */
const SYMBOL_MAP: Record<string, string> = {
  "/MNQ": "NASDAQ:QQQ",
  "/NQ": "NASDAQ:QQQ",
  "/ES": "SP:SPX",
  "/MES": "SP:SPX",
  "/GC": "COMEX:GC1!",
  "/MGC": "COMEX:GC1!",
  "/YM": "DJ:DJI",
  "/RTY": "RUSSELL:RUT",
  "/CL": "NYMEX:CL1!",
  MNQ: "NASDAQ:QQQ",
  NQ: "NASDAQ:QQQ",
  ES: "SP:SPX",
  MES: "SP:SPX",
  YM: "DJ:DJI",
  RTY: "RUSSELL:RUT",
};

function mapSymbol(sym: string): string {
  return SYMBOL_MAP[sym] ?? SYMBOL_MAP[`/${sym}`] ?? "NASDAQ:QQQ";
}

const COMPARE_SYMBOLS = ["COMEX:GC1!", "SP:SPX", "NASDAQ:QQQ"];

interface SanctumChartProps {
  timeSeries: MiroSharkTimePoint[];
  rollingDays: number;
  selectedSymbol?: string;
  compositeIV?: number;
  confidence?: number;
  regimeShiftProbability?: number;
  scenarios?: MiroSharkScenario[];
}

function getThemeColor(
  c: HTMLCanvasElement,
  varName: string,
  fallback: string,
): string {
  const val = getComputedStyle(c).getPropertyValue(varName).trim();
  return val || fallback;
}

/* ── Projection overlay: draws expected move path + confidence band on top of TradingView ── */

/** Generate a smooth projected path using MiroShark data.
 *  Returns an array of {x, y} points normalized to 0-1 range. */
function generateProjectionPath(
  compositeIV: number,
  confidence: number,
  regimeShift: number,
  scenarios: MiroSharkScenario[],
): {
  points: { x: number; y: number }[];
  bandWidth: number;
  direction: "up" | "down" | "flat";
} {
  // Direction: high IV + low confidence = bearish bias; low IV = bullish bias
  const avgScenarioScore =
    scenarios.length > 0
      ? scenarios.reduce((s, sc) => s + sc.projectedScore * sc.probability, 0) /
        Math.max(
          1,
          scenarios.reduce((s, sc) => s + sc.probability, 0),
        )
      : compositeIV;

  // Bearish if composite IV is high (risk elevated), bullish if low
  const direction: "up" | "down" | "flat" =
    avgScenarioScore >= 6.5 ? "down" : avgScenarioScore <= 3.5 ? "up" : "flat";

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
    if (direction === "up") {
      yOffset = -easeT * magnitude;
    } else if (direction === "down") {
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
  scenarios: MiroSharkScenario[],
  accentColor: string,
  lowColor: string,
  severeColor: string,
) {
  const { points, bandWidth, direction } = generateProjectionPath(
    compositeIV,
    confidence,
    regimeShift,
    scenarios,
  );

  // Projection zone: right 30% of the chart area
  const projStart = w * 0.7;
  const projWidth = w * 0.28;
  const chartTop = h * 0.08;
  const chartHeight = h * 0.84;

  // Map normalized points to canvas coordinates
  const canvasPoints = points.map((p) => ({
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
  const bandGrad = ctx.createLinearGradient(
    projStart,
    0,
    projStart + projWidth,
    0,
  );
  const bandColor =
    direction === "down"
      ? severeColor
      : direction === "up"
        ? lowColor
        : accentColor;
  bandGrad.addColorStop(0, bandColor + "08");
  bandGrad.addColorStop(0.5, bandColor + "15");
  bandGrad.addColorStop(1, bandColor + "08");
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
  ctx.font = "10px sans-serif";
  ctx.fillStyle = accentColor;
  ctx.textAlign = "left";
  const label =
    direction === "up"
      ? "BULLISH"
      : direction === "down"
        ? "BEARISH"
        : "NEUTRAL";
  ctx.fillText(label, last.x + 12, last.y + 3);

  // IV + confidence sub-label
  ctx.font = "9px sans-serif";
  ctx.globalAlpha = 0.4;
  ctx.fillText(
    `IV ${compositeIV.toFixed(1)} · ${Math.round(confidence * 100)}% conf`,
    last.x + 12,
    last.y + 15,
  );

  ctx.restore();
}

export function SanctumChart({
  selectedSymbol = "QQQ",
  compositeIV,
  confidence,
  regimeShiftProbability,
  scenarios,
}: SanctumChartProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const [tvLoaded, setTvLoaded] = useState(false);

  const tvSymbol = mapSymbol(selectedSymbol);

  const tvEmbedUrl = useMemo(() => {
    const studies: string[] = [
      // 20 EMA overlay
      "MAExp@tv-basicstudies|0|20",
      // Compare symbols
      ...COMPARE_SYMBOLS.filter((s) => s !== tvSymbol).map(
        (s) => `Compare@tv-basicstudies|0|${s}`,
      ),
    ];
    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval: "240",
      theme: "dark",
      style: "1", // 1 = candlestick (was 3 = area)
      locale: "en",
      timezone: "America/New_York",
      toolbar_bg: "000000",
      enable_publishing: "0",
      hide_side_toolbar: "0",
      allow_symbol_change: "1",
      save_image: "0",
      hide_volume: "1",
      withdateranges: "1",
    });
    params.set("studies", JSON.stringify(studies));
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [tvSymbol]);

  // ── Projection overlay drawing ──
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const container = tvContainerRef.current;
    if (!canvas || !container || compositeIV == null || confidence == null)
      return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const accentColor = getThemeColor(canvas, "--fintheon-accent", "#c79f4a");
    const lowColor = getThemeColor(canvas, "--fintheon-low", "#34D399");
    const severeColor = getThemeColor(canvas, "--fintheon-severe", "#EF4444");

    drawProjectionOverlay(
      ctx,
      rect.width,
      rect.height,
      compositeIV,
      confidence,
      regimeShiftProbability ?? 0,
      scenarios ?? [],
      accentColor,
      lowColor,
      severeColor,
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
    const obs = new ResizeObserver(() => {
      if (tvLoaded) drawOverlay();
    });
    obs.observe(c);
    return () => obs.disconnect();
  }, [tvLoaded, drawOverlay]);

  const hasProjection = compositeIV != null && confidence != null && tvLoaded;

  return (
    <div className="w-full h-full flex flex-col">
      {/* TradingView pane with projection overlay */}
      <div
        ref={tvContainerRef}
        className="flex-1 min-h-0 rounded overflow-hidden border border-[var(--fintheon-accent)]/10 transition-opacity duration-700 relative"
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
    </div>
  );
}
