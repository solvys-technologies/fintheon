// [claude-code 2026-03-24] Chart overhaul — TradingView iframe embed + compact heat-mapped IV bars
import { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react';
import type { MiroFishTimePoint, MiroFishRiskCategory } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, COMPOSITE_COLOR, ivHeatColor } from '../../types/mirofish';

/** Map user-facing futures symbols to TradingView symbol format */
const SYMBOL_MAP: Record<string, string> = {
  '/MNQ': 'CME_MINI:NQ1!',
  '/NQ':  'CME:NQ1!',
  '/ES':  'CME_MINI:ES1!',
  '/MES': 'CME_MINI:ES1!',
  '/GC':  'COMEX:GC1!',
  '/MGC': 'COMEX:MGC1!',
  '/YM':  'CBOT_MINI:YM1!',
  '/CL':  'NYMEX:CL1!',
};

function mapSymbol(sym: string): string {
  return SYMBOL_MAP[sym] ?? SYMBOL_MAP['/MNQ']!;
}

/** Compare symbols always overlaid alongside the main instrument */
const COMPARE_SYMBOLS = ['COMEX:GC1!', 'CME_MINI:ES1!', 'CME_MINI:NQ1!'];

interface AuditoriumChartProps {
  timeSeries: MiroFishTimePoint[];
  rollingDays: 7 | 14 | 30;
  selectedSymbol?: string;
}

const CATS: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];
const PAD = { top: 8, right: 48, bottom: 24, left: 48 };
const AXIS_COLOR = 'rgba(240, 234, 214, 0.3)';
const GOLD_ACCENTS = ['#d4af37', '#c79f4a'];

function isGold(c: HTMLCanvasElement) {
  return GOLD_ACCENTS.includes(getComputedStyle(c).getPropertyValue('--fintheon-accent').trim().toLowerCase());
}

function roundTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawBars(
  ctx: CanvasRenderingContext2D, data: MiroFishTimePoint[],
  pL: number, pW: number, bTop: number, bH: number, gold: boolean,
) {
  const n = data.length;
  const bW = Math.max(4, (pW / Math.max(n, 1)) * 0.6);
  for (let i = 0; i < n; i++) {
    const cx = pL + (i / Math.max(n - 1, 1)) * pW;
    let yOff = 0;
    for (let c = 0; c < CATS.length; c++) {
      const cat = CATS[c], val = data[i].categories[cat], segH = (val / 10) * bH;
      if (segH < 0.5) { yOff += segH; continue; }
      const sy = bTop + bH - yOff - segH, color = ivHeatColor(val);
      const top = c === CATS.length - 1 || CATS.slice(c + 1).every(k => data[i].categories[k] < 0.05);
      if (gold) {
        ctx.fillStyle = color;
        top ? roundTopRect(ctx, cx - bW / 2, sy, bW, segH, 2) : (ctx.beginPath(), ctx.rect(cx - bW / 2, sy, bW, segH));
        ctx.fill();
        ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 6;
        ctx.fillRect(cx - bW / 2, sy, bW, Math.min(2, segH)); ctx.restore();
      } else {
        const g = ctx.createLinearGradient(0, sy + segH, 0, sy);
        g.addColorStop(0, color); g.addColorStop(1, color + '99');
        ctx.fillStyle = g;
        top ? roundTopRect(ctx, cx - bW / 2, sy, bW, segH, 2) : (ctx.beginPath(), ctx.rect(cx - bW / 2, sy, bW, segH));
        ctx.fill();
      }
      yOff += segH;
    }
  }
}

export function AuditoriumChart({ timeSeries, rollingDays, selectedSymbol = '/MNQ' }: AuditoriumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tvLoaded, setTvLoaded] = useState(false);
  const data = timeSeries.filter(p => p.dayOffset <= rollingDays);

  const tvSymbol = mapSymbol(selectedSymbol);

  // Build TradingView embed URL — works reliably in Electron file:// context
  const tvEmbedUrl = useMemo(() => {
    const studies = COMPARE_SYMBOLS
      .filter(s => s !== tvSymbol)
      .map(s => `Compare@tv-basicstudies|0|${s}`);
    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval: '15',
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

    // Right axis — IV 0-10
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    const ivStep = bH > 60 ? 5 : 10;
    for (let iv = 0; iv <= 10; iv += ivStep) {
      const y = bTop + bH - (iv / 10) * bH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
      ctx.fillStyle = AXIS_COLOR; ctx.fillText(String(iv), w - PAD.right + 6, y + 4);
    }

    // X labels
    const lStep = Math.max(1, Math.floor(data.length / Math.max(4, Math.floor(w / 100))));
    ctx.fillStyle = AXIS_COLOR; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += lStep) {
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * pW;
      ctx.fillText(data[i].date.slice(5), x, h - 4);
    }

    // Stacked IV bars with heat-map coloring
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

  return (
    <div className="w-full h-full flex flex-col">
      {/* TradingView pane — ~75% via direct iframe (reliable in Electron) */}
      <div
        className="flex-[3] min-h-0 rounded-t overflow-hidden border border-[var(--fintheon-accent)]/10 transition-opacity duration-700"
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
      </div>

      {/* Separator */}
      <div className="h-px bg-[var(--fintheon-accent)]/15 shrink-0" />

      {/* Compact IV risk bars pane — ~25% */}
      <div ref={containerRef} className="flex-1 min-h-[80px] relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
