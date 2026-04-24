// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// TradingView Lightweight Charts inline in chat. Bars can arrive inline on the
// slot payload (Harper pre-assembled) or be fetched from /api/market/ohlc/:symbol
// (if present). Falls back to a clean error card when no bars are available —
// per brief, we DO NOT add a backend route here.

import { useEffect, useRef, useState } from "react";
import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type CandlestickData,
  type LineData,
} from "lightweight-charts";
import {
  DEFAULT_TRADE_COLORS,
  DEFAULT_FUSE_PALETTE,
  type FusePalette,
} from "../../../lib/fuse-palette";
import { parseSlotBody } from "./parseSlotBody";
import { SlotShell, SlotSkeleton, SlotError, SlotReveal } from "./SlotShell";

const OhlcBarSchema = z.object({
  t: z.number(), // seconds or ms epoch
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number().optional(),
});

const OverlaySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("level"),
    value: z.number(),
    label: z.string().optional(),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("zone"),
    low: z.number(),
    high: z.number(),
    label: z.string().optional(),
    color: z.string().optional(),
  }),
]);

const TVChartDataSchema = z.object({
  symbol: z.string(),
  interval: z.string().default("5m"),
  range: z.string().optional(),
  bars: z.array(OhlcBarSchema).optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  overlays: z.array(OverlaySchema).optional(),
});

type TVChartData = z.infer<typeof TVChartDataSchema>;
type OhlcBar = z.infer<typeof OhlcBarSchema>;

function toSeconds(t: number): Time {
  // Accept ms or s; normalize to seconds for lightweight-charts `Time`.
  return (t > 1e12 ? Math.floor(t / 1000) : Math.floor(t)) as Time;
}

function toCandles(bars: OhlcBar[]): CandlestickData[] {
  return bars
    .map((b) => ({
      time: toSeconds(b.t),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number));
}

async function fetchOhlc(
  symbol: string,
  interval: string,
): Promise<OhlcBar[] | null> {
  try {
    const r = await fetch(
      `/api/market/ohlc/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const arr = Array.isArray(j) ? j : j?.bars;
    if (!Array.isArray(arr)) return null;
    return z.array(OhlcBarSchema).parse(arr);
  } catch {
    return null;
  }
}

interface ChartCanvasProps {
  data: TVChartData;
  palette: FusePalette;
}

function ChartCanvas({ data, palette }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [bars, setBars] = useState<OhlcBar[] | null>(data.bars ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "empty">(
    data.bars && data.bars.length > 0 ? "idle" : "loading",
  );

  useEffect(() => {
    if (data.bars && data.bars.length > 0) {
      setBars(data.bars);
      setStatus("idle");
      return;
    }
    let alive = true;
    setStatus("loading");
    fetchOhlc(data.symbol, data.interval).then((fetched) => {
      if (!alive) return;
      if (fetched && fetched.length > 0) {
        setBars(fetched);
        setStatus("idle");
      } else {
        setStatus("empty");
      }
    });
    return () => {
      alive = false;
    };
  }, [data.symbol, data.interval, data.bars]);

  useEffect(() => {
    if (!containerRef.current || !bars || bars.length === 0) return;

    const bullish = palette.bullishColor ?? DEFAULT_TRADE_COLORS.bullishColor;
    const bearish = palette.bearishColor ?? DEFAULT_TRADE_COLORS.bearishColor;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(240, 234, 214, 0.7)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(199, 159, 74, 0.04)" },
        horzLines: { color: "rgba(199, 159, 74, 0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(199, 159, 74, 0.15)",
      },
      timeScale: {
        borderColor: "rgba(199, 159, 74, 0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    chartRef.current = chart;

    const candles: ISeriesApi<"Candlestick"> = chart.addSeries(
      CandlestickSeries,
      {
        upColor: bullish,
        downColor: bearish,
        wickUpColor: bullish,
        wickDownColor: bearish,
        borderVisible: false,
      },
    );
    candles.setData(toCandles(bars));

    // Draw horizontal level + zone overlays. Zones render as low+high level
    // pair; full shaded-rectangle zones would need price lines on both sides.
    for (const o of data.overlays ?? []) {
      if (o.type === "level") {
        candles.createPriceLine({
          price: o.value,
          color: o.color ?? "rgba(199, 159, 74, 0.55)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: o.label ?? "",
        });
      } else {
        const c = o.color ?? "rgba(199, 159, 74, 0.35)";
        candles.createPriceLine({
          price: o.high,
          color: c,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: o.label ? `${o.label} ▲` : "",
        });
        candles.createPriceLine({
          price: o.low,
          color: c,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: o.label ? `${o.label} ▼` : "",
        });
        // Shade the middle with a faint line series spanning the bar range.
        const shade: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
          color: c,
          lineWidth: 1,
          lineStyle: 3,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const mid = (o.high + o.low) / 2;
        const shadeData: LineData[] = bars.map((b) => ({
          time: toSeconds(b.t),
          value: mid,
        }));
        shade.setData(shadeData);
      }
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, data.overlays, palette]);

  const statusStyle: React.CSSProperties = {
    height: 200,
    fontFamily: "var(--font-data, ui-monospace, monospace)",
    fontSize: 10,
    color: "rgba(240, 234, 214, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (status === "loading")
    return <div style={statusStyle}>Loading {data.symbol}…</div>;
  if (status === "empty" || !bars || bars.length === 0)
    return <div style={statusStyle}>No bars available for {data.symbol}</div>;
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 200, minHeight: 180 }}
    />
  );
}

export function TVChartSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<TVChartData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="chart" lines={5} />;
  if (parsed.status === "error")
    return <SlotError label="chart" reason={parsed.reason} />;

  const validated = TVChartDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="chart" reason="Schema mismatch" />;

  const d = validated.data;
  const overlayCount = d.overlays?.length ?? 0;

  return (
    <SlotReveal>
      <SlotShell
        label={`${d.symbol} · ${d.interval}${overlayCount ? ` · ${overlayCount} overlay${overlayCount === 1 ? "" : "s"}` : ""}`}
        style={{ padding: "8px 10px" }}
      >
        <ChartCanvas data={d} palette={DEFAULT_FUSE_PALETTE} />
      </SlotShell>
    </SlotReveal>
  );
}
