// [claude-code 2026-03-06] Canvas 2D renderer for quarter and year zoom levels
import { useCallback, useEffect, useRef } from 'react';
import type {
  CatalystCard,
  NarrativeLane,
  Rope,
  ZoomLevel,
  NarrativeAction,
} from '../../lib/narrative-types';

interface ThemeColors {
  bg: string;
  accent: string;
  bullish: string;
  bearish: string;
  surface: string;
  text: string;
  muted: string;
}

interface NarrativeCanvasViewProps {
  zoomLevel: ZoomLevel;
  catalysts: CatalystCard[];
  lanes: NarrativeLane[];
  ropes: Rope[];
  currentWeekStart: string;
  heatmapEnabled: boolean;
  dispatch: React.Dispatch<NarrativeAction>;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const LANE_HEIGHT = 20;
const HEADER_HEIGHT = 32;
const LEFT_MARGIN = 80;
const DOT_RADIUS = 5;

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: styles.getPropertyValue('--fintheon-bg').trim() || 'var(--fintheon-bg)',
    accent: styles.getPropertyValue('--fintheon-accent').trim() || 'var(--fintheon-accent)',
    bullish: styles.getPropertyValue('--fintheon-bullish').trim() || '#34D399',
    bearish: styles.getPropertyValue('--fintheon-bearish').trim() || '#EF4444',
    surface: styles.getPropertyValue('--fintheon-surface').trim() || 'var(--fintheon-surface)',
    text: styles.getPropertyValue('--fintheon-text').trim() || 'var(--fintheon-text)',
    muted: styles.getPropertyValue('--fintheon-muted').trim() || '#6B7280',
  };
}

function getQuarterForDate(date: Date): number {
  return Math.floor(date.getMonth() / 3);
}

function getMonthsForQuarter(year: number, quarter: number): Date[] {
  const startMonth = quarter * 3;
  return [0, 1, 2].map(i => new Date(year, startMonth + i, 1));
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function NarrativeCanvasView({
  zoomLevel,
  catalysts,
  lanes,
  ropes,
  currentWeekStart,
  heatmapEnabled,
  dispatch,
}: NarrativeCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<ThemeColors>(readThemeColors());
  const hitAreasRef = useRef<Array<{ rect: [number, number, number, number]; action: NarrativeAction }>>([]);

  // Re-read theme colors on mount and theme changes
  useEffect(() => {
    colorsRef.current = readThemeColors();
  }, []);

  // Observe theme attribute changes on documentElement
  useEffect(() => {
    const observer = new MutationObserver(() => {
      colorsRef.current = readThemeColors();
      draw();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const colors = colorsRef.current;

    // Clear with theme bg
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    hitAreasRef.current = [];

    if (zoomLevel === 'quarter') {
      drawQuarterView(ctx, w, h, colors);
    } else if (zoomLevel === 'year') {
      drawYearView(ctx, w, h, colors);
    }
  }, [zoomLevel, catalysts, lanes, ropes, currentWeekStart, heatmapEnabled]);

  // --- Quarter View ---
  const drawQuarterView = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, colors: ThemeColors) => {
      const baseDate = new Date(currentWeekStart);
      const year = baseDate.getFullYear();
      const quarter = getQuarterForDate(baseDate);
      const months = getMonthsForQuarter(year, quarter);
      const colWidth = (w - LEFT_MARGIN) / 3;
      const activeLanes = lanes.filter(l => l.status !== 'archived');

      // Column headers
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      months.forEach((month, i) => {
        const x = LEFT_MARGIN + i * colWidth + colWidth / 2;
        ctx.fillStyle = colors.text;
        ctx.fillText(MONTH_NAMES[month.getMonth()], x, 20);

        // Column separator
        if (i > 0) {
          ctx.strokeStyle = hexToRgba(colors.muted, 0.2);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(LEFT_MARGIN + i * colWidth, HEADER_HEIGHT);
          ctx.lineTo(LEFT_MARGIN + i * colWidth, h);
          ctx.stroke();
        }

        // Hit area for clicking into month
        const monthStart = new Date(year, month.getMonth(), 1).toISOString();
        hitAreasRef.current.push({
          rect: [LEFT_MARGIN + i * colWidth, 0, colWidth, HEADER_HEIGHT],
          action: { type: 'SET_ZOOM', level: 'month' },
        });
        hitAreasRef.current.push({
          rect: [LEFT_MARGIN + i * colWidth, 0, colWidth, HEADER_HEIGHT],
          action: { type: 'SET_WEEK', weekStart: monthStart },
        });
      });

      // Lane bands
      activeLanes.forEach((lane, laneIdx) => {
        const y = HEADER_HEIGHT + laneIdx * LANE_HEIGHT;

        // Lane label
        ctx.fillStyle = colors.muted;
        ctx.textAlign = 'right';
        ctx.font = '9px monospace';
        ctx.fillText(
          lane.title.length > 10 ? lane.title.substring(0, 10) + '..' : lane.title,
          LEFT_MARGIN - 6,
          y + LANE_HEIGHT / 2 + 3,
        );

        // Lane background band
        ctx.fillStyle = hexToRgba(colors.surface, laneIdx % 2 === 0 ? 0.3 : 0.1);
        ctx.fillRect(LEFT_MARGIN, y, w - LEFT_MARGIN, LANE_HEIGHT);

        // Heatmap overlay per month segment
        if (heatmapEnabled) {
          months.forEach((month, colIdx) => {
            const monthStart = month.getTime();
            const monthEnd = new Date(year, month.getMonth() + 1, 0).getTime();

            const monthCatalysts = catalysts.filter(c => {
              const d = new Date(c.date).getTime();
              return c.narrativeIds.includes(lane.id) && d >= monthStart && d <= monthEnd;
            });

            if (monthCatalysts.length > 0) {
              const bullishCount = monthCatalysts.filter(c => c.sentiment === 'bullish').length;
              const bearishCount = monthCatalysts.filter(c => c.sentiment === 'bearish').length;
              const intensity = Math.min(0.3, 0.1 + monthCatalysts.length * 0.04);

              const heatColor = bullishCount >= bearishCount ? colors.bullish : colors.bearish;
              ctx.fillStyle = hexToRgba(heatColor, intensity);
              ctx.fillRect(LEFT_MARGIN + colIdx * colWidth, y, colWidth, LANE_HEIGHT);
            }
          });
        }

        // Catalyst dots
        const laneCatalysts = catalysts.filter(c => c.narrativeIds.includes(lane.id));
        laneCatalysts.forEach(catalyst => {
          const cDate = new Date(catalyst.date);
          const monthIdx = cDate.getMonth() - months[0].getMonth();
          if (monthIdx < 0 || monthIdx >= 3) return;

          const dayFraction = cDate.getDate() / 31;
          const dotX = LEFT_MARGIN + monthIdx * colWidth + dayFraction * colWidth;
          const dotY = y + LANE_HEIGHT / 2;

          ctx.beginPath();
          ctx.arc(dotX, dotY, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle =
            catalyst.sentiment === 'bullish'
              ? colors.bullish
              : catalyst.sentiment === 'bearish'
                ? colors.bearish
                : colors.accent;
          ctx.fill();
        });
      });

      // Ropes as thin lines (simplified at quarter zoom)
      ctx.lineWidth = 1;
      ropes.forEach(rope => {
        const fromCatalyst = catalysts.find(c => c.id === rope.fromId);
        const toCatalyst = catalysts.find(c => c.id === rope.toId);
        if (!fromCatalyst || !toCatalyst) return;

        const fromLaneIdx = activeLanes.findIndex(l => fromCatalyst.narrativeIds.includes(l.id));
        const toLaneIdx = activeLanes.findIndex(l => toCatalyst.narrativeIds.includes(l.id));
        if (fromLaneIdx === -1 || toLaneIdx === -1) return;

        const fromDate = new Date(fromCatalyst.date);
        const toDate = new Date(toCatalyst.date);
        const fromMonthIdx = fromDate.getMonth() - months[0].getMonth();
        const toMonthIdx = toDate.getMonth() - months[0].getMonth();
        if (fromMonthIdx < 0 || fromMonthIdx >= 3 || toMonthIdx < 0 || toMonthIdx >= 3) return;

        const fromX = LEFT_MARGIN + fromMonthIdx * colWidth + (fromDate.getDate() / 31) * colWidth;
        const fromY = HEADER_HEIGHT + fromLaneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
        const toX = LEFT_MARGIN + toMonthIdx * colWidth + (toDate.getDate() / 31) * colWidth;
        const toY = HEADER_HEIGHT + toLaneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;

        ctx.strokeStyle = hexToRgba(
          rope.polarity === 'contradicting' ? colors.bearish : colors.accent,
          0.5,
        );
        if (rope.polarity === 'contradicting') {
          ctx.setLineDash([4, 3]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    },
    [catalysts, lanes, ropes, currentWeekStart, heatmapEnabled],
  );

  // --- Year View ---
  const drawYearView = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, colors: ThemeColors) => {
      const baseDate = new Date(currentWeekStart);
      const year = baseDate.getFullYear();

      const gridCols = 2;
      const gridRows = 2;
      const cellW = w / gridCols;
      const cellH = h / gridRows;
      const maxRadius = Math.min(cellW, cellH) * 0.35;

      QUARTER_LABELS.forEach((label, qi) => {
        const col = qi % gridCols;
        const row = Math.floor(qi / gridCols);
        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;

        // Count catalysts in this quarter
        const qStart = new Date(year, qi * 3, 1).getTime();
        const qEnd = new Date(year, (qi + 1) * 3, 0).getTime();
        const qCatalysts = catalysts.filter(c => {
          const d = new Date(c.date).getTime();
          return d >= qStart && d <= qEnd;
        });

        const count = qCatalysts.length;
        const radius = Math.max(24, Math.sqrt(Math.max(count, 1)) * maxRadius * 0.3);

        // Determine sentiment blend
        const bullishCount = qCatalysts.filter(c => c.sentiment === 'bullish').length;
        const bearishCount = qCatalysts.filter(c => c.sentiment === 'bearish').length;

        let bubbleColor: string;
        if (heatmapEnabled || count === 0) {
          if (bullishCount > bearishCount) bubbleColor = colors.bullish;
          else if (bearishCount > bullishCount) bubbleColor = colors.bearish;
          else bubbleColor = colors.accent;
        } else {
          bubbleColor = colors.accent;
        }

        // Bubble
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(bubbleColor, heatmapEnabled ? 0.35 : 0.15);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(bubbleColor, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy - 6);

        // Count subtitle
        ctx.fillStyle = colors.muted;
        ctx.font = '10px monospace';
        ctx.fillText(`${count} event${count !== 1 ? 's' : ''}`, cx, cy + 10);

        // Hit area for clicking into quarter
        hitAreasRef.current.push({
          rect: [col * cellW, row * cellH, cellW, cellH],
          action: { type: 'SET_ZOOM', level: 'quarter' },
        });
        hitAreasRef.current.push({
          rect: [col * cellW, row * cellH, cellW, cellH],
          action: { type: 'SET_WEEK', weekStart: new Date(year, qi * 3, 1).toISOString() },
        });
      });
    },
    [catalysts, currentWeekStart, heatmapEnabled],
  );

  // Draw on data change
  useEffect(() => {
    draw();
  }, [draw]);

  // ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [draw]);

  // Click handler with hit-testing
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const hit of hitAreasRef.current) {
        const [hx, hy, hw, hh] = hit.rect;
        if (x >= hx && x <= hx + hw && y >= hy && y <= hy + hh) {
          dispatch(hit.action);
          // Don't break — dispatch both SET_ZOOM and SET_WEEK for same area
        }
      }
    },
    [dispatch],
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      style={{ display: 'block' }}
    />
  );
}
