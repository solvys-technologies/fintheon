// [claude-code 2026-03-24] Chart redesign — implied pts line + stacked IV bars + theme-aware gradients
import { useRef, useEffect, useCallback, useState } from 'react';
import type { MiroFishTimePoint, MiroFishRiskCategory } from '../../types/mirofish';
import { RISK_CATEGORY_COLORS, RISK_CATEGORY_LABELS, COMPOSITE_COLOR } from '../../types/mirofish';

interface AuditoriumChartProps {
  timeSeries: MiroFishTimePoint[];
  rollingDays: 7 | 14 | 30;
}

const CATS: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];
const PAD = { top: 24, right: 48, bottom: 36, left: 48 };
const SPLIT = 0.55;
const AXIS_COLOR = 'rgba(240, 234, 214, 0.3)';
const GOLD_ACCENTS = ['#d4af37', '#c79f4a'];

type Pt = { x: number; y: number };

function isGold(c: HTMLCanvasElement) {
  return GOLD_ACCENTS.includes(getComputedStyle(c).getPropertyValue('--fintheon-accent').trim().toLowerCase());
}
function iPts(p: MiroFishTimePoint) { return (p as any).impliedPoints ?? p.composite * 5; }

function bezierCPs(pts: Pt[]) {
  const out: { c1: Pt; c2: Pt }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    const t = 0.3;
    out.push({
      c1: { x: p1.x + (p2.x - p0.x) * t, y: p1.y + (p2.y - p0.y) * t },
      c2: { x: p2.x - (p3.x - p1.x) * t, y: p2.y - (p3.y - p1.y) * t },
    });
  }
  return out;
}

function traceBezier(ctx: CanvasRenderingContext2D, pts: Pt[], cps: { c1: Pt; c2: Pt }[]) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < cps.length; i++)
    ctx.bezierCurveTo(cps[i].c1.x, cps[i].c1.y, cps[i].c2.x, cps[i].c2.y, pts[i + 1].x, pts[i + 1].y);
}

function roundTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
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
      const sy = bTop + bH - yOff - segH, color = RISK_CATEGORY_COLORS[cat];
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

function drawLine(ctx: CanvasRenderingContext2D, pts: Pt[], top: number, split: number, gold: boolean) {
  if (pts.length < 2) return;
  const cps = bezierCPs(pts);
  // Area fill
  ctx.beginPath(); traceBezier(ctx, pts, cps);
  ctx.lineTo(pts[pts.length - 1].x, split); ctx.lineTo(pts[0].x, split); ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, split);
  g.addColorStop(0, 'rgba(199,159,74,0.15)'); g.addColorStop(1, 'rgba(199,159,74,0)');
  ctx.fillStyle = g; ctx.fill();
  // Stroke
  ctx.save();
  if (gold) { ctx.shadowColor = '#c79f4a'; ctx.shadowBlur = 8; }
  ctx.strokeStyle = COMPOSITE_COLOR; ctx.lineWidth = 2;
  ctx.beginPath(); traceBezier(ctx, pts, cps); ctx.stroke();
  ctx.restore();
}

function drawTooltip(
  ctx: CanvasRenderingContext2D, point: MiroFishTimePoint,
  hx: number, ly: number, w: number, h: number, gold: boolean,
) {
  // Crosshair
  ctx.strokeStyle = 'rgba(240,234,214,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(hx, PAD.top); ctx.lineTo(hx, h - PAD.bottom); ctx.stroke();
  ctx.setLineDash([]);
  // Dot
  ctx.fillStyle = COMPOSITE_COLOR;
  ctx.beginPath(); ctx.arc(hx, ly, 5, 0, Math.PI * 2); ctx.fill();
  // Box
  const tw = 195, th = 156, r = 4;
  let tx = hx + 16, ty = PAD.top + 8;
  if (tx + tw > w - 12) tx = hx - tw - 16;
  if (ty + th > h - 12) ty = h - th - 12;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(10,10,0,0.94)'; roundRect(ctx, tx, ty, tw, th, r); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(199,159,74,0.3)'; ctx.lineWidth = 1;
  if (gold) { ctx.save(); ctx.shadowColor = 'rgba(199,159,74,0.2)'; ctx.shadowBlur = 6; }
  ctx.stroke(); if (gold) ctx.restore();
  // Text
  ctx.textAlign = 'left'; let row = ty + 18;
  ctx.fillStyle = COMPOSITE_COLOR; ctx.font = '10px monospace';
  ctx.fillText(point.date, tx + 10, row); row += 14;
  ctx.fillStyle = '#f0ead6'; ctx.font = 'bold 11px monospace';
  ctx.fillText(`Implied Pts: ${iPts(point).toFixed(1)}`, tx + 10, row); row += 14;
  ctx.fillStyle = COMPOSITE_COLOR; ctx.font = '10px monospace';
  ctx.fillText(`Composite IV: ${point.composite.toFixed(1)}`, tx + 10, row); row += 16;
  for (const cat of CATS) {
    ctx.fillStyle = RISK_CATEGORY_COLORS[cat];
    ctx.beginPath(); ctx.arc(tx + 14, row - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0ead6';
    ctx.fillText(`${RISK_CATEGORY_LABELS[cat].padEnd(14)} ${point.categories[cat].toFixed(1)}`, tx + 22, row);
    row += 14;
  }
}

export function AuditoriumChart({ timeSeries, rollingDays }: AuditoriumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = timeSeries.filter(p => p.dayOffset <= rollingDays);

  const draw = useCallback(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;
    const rect = container.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const pW = w - PAD.left - PAD.right, pH = h - PAD.top - PAD.bottom;
    const splitY = PAD.top + pH * SPLIT, lineH = pH * SPLIT, barH = pH * (1 - SPLIT);
    const gold = isGold(canvas);
    const grid = gold ? 'rgba(212,175,55,0.06)' : 'rgba(128,128,128,0.08)';
    ctx.clearRect(0, 0, w, h);

    // Left axis — implied points
    const maxPts = Math.max(...data.map(iPts), 1);
    const step = Math.pow(10, Math.floor(Math.log10(maxPts))) || 10;
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    for (let v = 0; v <= maxPts + step; v += step) {
      const y = PAD.top + lineH - (v / (maxPts * 1.1)) * lineH;
      if (y < PAD.top - 4) break;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
      ctx.fillStyle = AXIS_COLOR; ctx.fillText(String(Math.round(v)), PAD.left - 8, y + 4);
    }
    // Right axis — IV 0-10
    ctx.textAlign = 'left';
    for (let iv = 0; iv <= 10; iv += (h > 300 ? 2 : 5)) {
      const y = splitY + barH - (iv / 10) * barH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
      ctx.fillStyle = AXIS_COLOR; ctx.fillText(String(iv), w - PAD.right + 6, y + 4);
    }
    // Split divider
    ctx.strokeStyle = gold ? 'rgba(199,159,74,0.12)' : 'rgba(128,128,128,0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, splitY); ctx.lineTo(w - PAD.right, splitY); ctx.stroke();
    ctx.setLineDash([]);
    // X labels
    const lStep = Math.max(1, Math.floor(data.length / Math.max(4, Math.floor(w / 100))));
    ctx.fillStyle = AXIS_COLOR; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += lStep) {
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * pW;
      ctx.fillText(data[i].date.slice(5), x, h - 8);
    }
    // Draw content
    drawBars(ctx, data, PAD.left, pW, splitY, barH, gold);
    const mxS = maxPts * 1.1;
    const lPts = data.map((p, i) => ({
      x: PAD.left + (i / Math.max(data.length - 1, 1)) * pW,
      y: PAD.top + lineH - (iPts(p) / mxS) * lineH,
    }));
    drawLine(ctx, lPts, PAD.top, splitY, gold);
    // Tooltip
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < data.length) {
      const hx = PAD.left + (hoverIdx / Math.max(data.length - 1, 1)) * pW;
      const ly = PAD.top + lineH - (iPts(data[hoverIdx]) / mxS) * lineH;
      drawTooltip(ctx, data[hoverIdx], hx, ly, w, h, gold);
    }
  }, [data, hoverIdx]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const c = containerRef.current; if (!c) return;
    const obs = new ResizeObserver(() => draw()); obs.observe(c);
    return () => obs.disconnect();
  }, [draw]);

  const onMove = useCallback((e: React.MouseEvent) => {
    const c = canvasRef.current; if (!c || data.length === 0) return;
    const r = c.getBoundingClientRect();
    const rel = (e.clientX - r.left - PAD.left) / (r.width - PAD.left - PAD.right);
    const idx = Math.round(rel * (data.length - 1));
    setHoverIdx(idx >= 0 && idx < data.length ? idx : null);
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair"
        onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} />
    </div>
  );
}
