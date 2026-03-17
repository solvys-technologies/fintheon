// [claude-code 2026-03-16] Kalshi-style IV prediction chart — Canvas API, 6 risk lines + composite
import { useRef, useEffect, useCallback, useState } from 'react';
import type { MiroFishTimePoint, MiroFishRiskCategory } from '../../types/mirofish';
import { RISK_CATEGORY_COLORS, RISK_CATEGORY_LABELS, COMPOSITE_COLOR } from '../../types/mirofish';

interface AuditoriumChartProps {
  timeSeries: MiroFishTimePoint[];
  rollingDays: 7 | 14 | 30;
}

const CATEGORIES: MiroFishRiskCategory[] = [
  'geopolitical', 'political', 'monetary-policy',
  'earnings-corporate', 'market-structure', 'black-swan',
];

const GRID_COLOR = 'rgba(212, 175, 55, 0.08)';
const AXIS_COLOR = 'rgba(240, 234, 214, 0.3)';
const TOOLTIP_BG = 'rgba(10, 10, 0, 0.9)';
const PADDING = { top: 20, right: 16, bottom: 32, left: 36 };

export function AuditoriumChart({ timeSeries, rollingDays }: AuditoriumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = timeSeries.filter(p => p.dayOffset <= rollingDays);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines (IV 0-10)
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let iv = 0; iv <= 10; iv += 2) {
      const y = PADDING.top + plotH - (iv / 10) * plotH;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(w - PADDING.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = AXIS_COLOR;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(iv), PADDING.left - 6, y + 3);
    }

    // X-axis date labels
    const labelStep = Math.max(1, Math.floor(data.length / 6));
    ctx.fillStyle = AXIS_COLOR;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += labelStep) {
      const x = PADDING.left + (i / (data.length - 1)) * plotW;
      const dateLabel = data[i].date.slice(5); // MM-DD
      ctx.fillText(dateLabel, x, h - 8);
    }

    const toX = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const toY = (v: number) => PADDING.top + plotH - (Math.max(0, Math.min(10, v)) / 10) * plotH;

    // Draw category lines
    for (const cat of CATEGORIES) {
      ctx.strokeStyle = RISK_CATEGORY_COLORS[cat];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = toX(i);
        const y = toY(data[i].categories[cat]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw composite line (bold gold)
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COMPOSITE_COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = toX(i);
      const y = toY(data[i].composite);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Hover crosshair + tooltip
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < data.length) {
      const hx = toX(hoverIdx);
      const point = data[hoverIdx];

      // Vertical line
      ctx.strokeStyle = 'rgba(240, 234, 214, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, PADDING.top);
      ctx.lineTo(hx, PADDING.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dots on each line
      for (const cat of CATEGORIES) {
        ctx.fillStyle = RISK_CATEGORY_COLORS[cat];
        ctx.beginPath();
        ctx.arc(hx, toY(point.categories[cat]), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = COMPOSITE_COLOR;
      ctx.beginPath();
      ctx.arc(hx, toY(point.composite), 4, 0, Math.PI * 2);
      ctx.fill();

      // Tooltip box
      const tooltipW = 140;
      const tooltipH = 120;
      let tx = hx + 12;
      if (tx + tooltipW > w - 8) tx = hx - tooltipW - 12;
      const ty = PADDING.top + 4;

      ctx.fillStyle = TOOLTIP_BG;
      ctx.fillRect(tx, ty, tooltipW, tooltipH);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, tooltipW, tooltipH);

      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      let row = ty + 14;

      ctx.fillStyle = COMPOSITE_COLOR;
      ctx.fillText(`${point.date}`, tx + 6, row);
      row += 13;

      ctx.fillStyle = COMPOSITE_COLOR;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`Composite: ${point.composite.toFixed(1)}`, tx + 6, row);
      row += 13;
      ctx.font = '9px monospace';

      for (const cat of CATEGORIES) {
        ctx.fillStyle = RISK_CATEGORY_COLORS[cat];
        const label = RISK_CATEGORY_LABELS[cat].slice(0, 10).padEnd(10);
        ctx.fillText(`${label} ${point.categories[cat].toFixed(1)}`, tx + 6, row);
        row += 12;
      }
    }
  }, [data, hoverIdx]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const plotW = rect.width - PADDING.left - PADDING.right;
    const relX = (mx - PADDING.left) / plotW;
    const idx = Math.round(relX * (data.length - 1));
    setHoverIdx(idx >= 0 && idx < data.length ? idx : null);
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-[180px] relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      />
    </div>
  );
}
