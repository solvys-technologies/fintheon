// [claude-code 2026-03-20] Data routes — Supabase-backed, replaces /api/notion/* endpoints
// [claude-code 2026-03-22] Refactored brief generation to use shared brief-generator service
// [claude-code 2026-03-27] Added /econ-history/:ticker for Sanctum expanded cards with prints + scoring
import { Hono } from "hono";
import {
  readTradeIdeas,
  updateTradeIdeaStatus,
  readDailyPnl,
  readLatestBrief,
  readBriefs,
  readEconEvents,
  readEconPrints,
  writeEconPrint,
  updateEconEventActual,
  readEconHistory,
  type BriefType,
  type TradeIdeaRecord,
  type DailyPnlRecord,
} from "../../services/supabase-service.js";
import { getFeed } from "../../services/riskflow/feed-service.js";
import { getUserSettings } from "../../services/settings-store.js";
import {
  getCurrentBriefType,
  generateBrief,
  BRIEF_LABELS,
} from "../../services/brief-generator.js";
import { startPrediction } from "../../services/agent-desk/agent-desk-service.js";

// ── Helpers: transform DB records → frontend shapes ─────────────────────────

function confidenceLabel(n: number): string {
  if (n >= 70) return "high";
  if (n >= 50) return "medium";
  return "low";
}

function tradeIdeaToFrontend(r: TradeIdeaRecord) {
  const entry = r.entry_price ?? undefined;
  const exitPrice = r.take_profit ?? undefined;
  const rawDir = (r.direction ?? "neutral").toLowerCase();
  const direction: "long" | "short" | "neutral" =
    rawDir === "long" ? "long" : rawDir === "short" ? "short" : "neutral";

  let potentialRisk: number | undefined;
  let potentialProfit: number | undefined;
  let riskRewardRatio: number | undefined;

  if (entry && entry <= 1) {
    potentialRisk = entry * 100;
    potentialProfit = (1 - entry) * 100;
    if (potentialRisk > 0) riskRewardRatio = potentialProfit / potentialRisk;
  } else if (entry && exitPrice) {
    potentialProfit = (Math.abs(exitPrice - entry) / entry) * 100;
  }

  return {
    id: r.id!,
    title: r.title || r.ticker || "Untitled Trade",
    ticker: r.ticker || r.title || "UNKNOWN",
    direction,
    entry,
    stopLoss: r.stop_loss ?? undefined,
    takeProfit: exitPrice,
    potentialRisk,
    potentialProfit,
    riskRewardRatio: r.risk_reward_ratio ?? riskRewardRatio,
    confidence:
      r.confidence != null ? confidenceLabel(r.confidence) : undefined,
    timeframe: r.timeframe ?? undefined,
    sourceAgent: r.analyst ?? undefined,
    hermesDescription:
      r.hermes_description ?? r.thesis?.slice(0, 300) ?? undefined,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function dailyPnlToKpis(records: DailyPnlRecord[]) {
  if (records.length === 0) return [];
  const latest = records[0]; // already sorted desc
  const kpis: Array<{ label: string; value: string; meta: string }> = [];

  const pnl = latest.net_pnl ?? latest.gross_pnl;
  if (pnl != null) {
    const n = Number(pnl);
    kpis.push({
      label: "Net P&L",
      value: isNaN(n)
        ? String(pnl)
        : `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString()}`,
      meta: "Live · Supabase",
    });
  }
  if (latest.win_rate != null) {
    const n = Number(latest.win_rate);
    kpis.push({
      label: "Win Rate",
      value: isNaN(n)
        ? String(latest.win_rate)
        : `${(n > 1 ? n : n * 100).toFixed(0)}%`,
      meta: "Daily sessions",
    });
  }
  if (latest.trades_taken != null) {
    kpis.push({
      label: "Trades Taken",
      value: String(latest.trades_taken),
      meta: latest.bias ? `Bias: ${latest.bias}` : "Today",
    });
  }
  if (latest.trades_taken && pnl != null) {
    const avg = Number(pnl) / latest.trades_taken;
    if (!isNaN(avg)) {
      kpis.push({
        label: "Avg P&L / Trade",
        value: `${avg >= 0 ? "+" : ""}$${Math.abs(avg).toFixed(0)}`,
        meta: "Per trade",
      });
    }
  }
  return kpis;
}

// ── Route factory ───────────────────────────────────────────────────────────

export function createDataRoutes(): Hono {
  const app = new Hono();

  // ── Trade Ideas ─────────────────────────────────────────────────

  // GET /api/data/trade-ideas
  app.get("/trade-ideas", async (c) => {
    const ideas = await readTradeIdeas();
    const tradeIdeas = ideas.map(tradeIdeaToFrontend);
    return c.json({
      tradeIdeas,
      count: tradeIdeas.length,
      fetchedAt: new Date().toISOString(),
    });
  });

  // PATCH /api/data/trade-ideas/:id/status
  app.patch("/trade-ideas/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ status: string }>().catch(() => null);
    if (!id || !body?.status) {
      return c.json({ error: "Missing id or status" }, 400);
    }
    const validStatuses = ["Proposed", "Approved", "Rejected", "Closed"];
    if (!validStatuses.includes(body.status)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        400,
      );
    }
    const ok = await updateTradeIdeaStatus(id, body.status);
    if (!ok) return c.json({ error: "Failed to update trade idea" }, 500);
    return c.json({ success: true, id, status: body.status });
  });

  // ── Performance ─────────────────────────────────────────────────

  // GET /api/data/performance
  app.get("/performance", async (c) => {
    const records = await readDailyPnl({ limit: 1 });
    const kpis = dailyPnlToKpis(records);
    return c.json({
      kpis,
      count: kpis.length,
      fetchedAt: new Date().toISOString(),
    });
  });

  // ── Briefs ──────────────────────────────────────────────────────

  // GET /api/data/brief?type=MDB|ADB|PMDB|TOTT
  // No type param → returns most recent brief of any type (so overnight shows PMDB, not stale MDB)
  app.get("/brief", async (c) => {
    try {
      const typeParam = c.req.query("type")?.toUpperCase() as
        | BriefType
        | undefined;
      const validTypes = ["MDB", "ADB", "PMDB", "WT"];

      if (typeParam && validTypes.includes(typeParam)) {
        // Explicit type requested — fetch that specific brief
        const brief = await readLatestBrief(typeParam);
        if (brief) {
          return c.json({
            items: [{ title: `${typeParam} — Brief`, detail: brief.content }],
            briefType: typeParam,
          });
        }
      } else {
        // No type specified — return the most recent brief regardless of type
        const latest = await readBriefs(undefined, 1);
        if (latest.length > 0) {
          const bt = latest[0].brief_type;
          return c.json({
            items: [{ title: `${bt} — Brief`, detail: latest[0].content }],
            briefType: bt,
          });
        }
      }

      return c.json({
        items: [],
        briefType: typeParam ?? getCurrentBriefType(),
      });
    } catch (err) {
      console.error("[Data] /brief error:", err);
      return c.json({ items: [] }, 500);
    }
  });

  // GET /api/data/briefs/today — all briefs generated today (for dropdown selector)
  app.get("/briefs/today", async (c) => {
    try {
      const all = await readBriefs(undefined, 20);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBriefs = all.filter((b) => new Date(b.created_at) >= today);
      return c.json({
        briefs: todayBriefs.map((b) => ({
          id: b.id,
          type: b.brief_type,
          label: BRIEF_LABELS[b.brief_type] ?? b.brief_type,
          content: b.content,
          createdAt: b.created_at,
        })),
        currentType: getCurrentBriefType(),
      });
    } catch (err) {
      console.error("[Data] /briefs/today error:", err);
      return c.json({ briefs: [], currentType: getCurrentBriefType() }, 500);
    }
  });

  // POST /api/data/brief/generate — AI brief generation + store in Supabase
  // Delegates to shared brief-generator service (also used by dispatch-scheduler crons)
  // [claude-code 2026-04-16] Triggers AgentDesk Aquarium run after successful brief publish
  app.post("/brief/generate", async (c) => {
    try {
      const result = await generateBrief();

      // Fire-and-forget: trigger Aquarium deliberation after brief publish
      // Empty lanes → AgentDesk synthesizes from RiskFlow headlines
      startPrediction(
        { lanes: [], catalysts: [], ropes: [] },
        undefined,
        "full-brief",
      ).catch((err) =>
        console.warn("[Data] Post-brief Aquarium trigger failed:", err),
      );

      return c.json({
        content: result.content,
        briefType: result.briefType,
        generatedAt: result.generatedAt,
        supabaseId: result.supabaseId,
        provider: result.provider,
      });
    } catch (err) {
      console.error("[Data] /brief/generate error:", err);
      return c.json({ error: "Generation failed", details: String(err) }, 500);
    }
  });

  // ── Schedule (Econ Events + Prints merged) ──────────────────────

  // GET /api/data/schedule
  app.get("/schedule", async (c) => {
    try {
      const [eventsResult, printsResult] = await Promise.allSettled([
        readEconEvents(),
        readEconPrints({ limit: 30 }),
      ]);

      const events =
        eventsResult.status === "fulfilled" ? eventsResult.value : [];
      const prints =
        printsResult.status === "fulfilled" ? printsResult.value : [];

      // Map events → schedule items
      const items = events.map((e) => ({
        title: e.name,
        detail: e.detail || "No details provided",
        forecast: e.forecast ?? undefined,
        previous: e.previous ?? undefined,
        actual: e.actual ?? undefined,
        date: e.date ?? undefined,
      }));

      // Merge prints as additional schedule items (dedup by title)
      const existingTitles = new Set(items.map((i) => i.title.toLowerCase()));
      for (const p of prints) {
        const printName = p.headline.split("|")[0].trim().toLowerCase();
        if (existingTitles.has(printName)) continue;
        items.push({
          title: p.headline.split("|")[0].trim() || "Economic Print",
          detail: `Print — IV ${p.iv_score ?? "?"}/10`,
          forecast: p.forecast_value ?? undefined,
          actual: p.actual_value ?? undefined,
          previous: p.previous_value ?? undefined,
          date: p.printed_at
            ? new Date(p.printed_at).toISOString().slice(0, 10)
            : undefined,
        });
      }

      return c.json({ items });
    } catch (err) {
      console.error("[Data] /schedule error:", err);
      return c.json({ items: [] }, 500);
    }
  });

  // ── Econ Calendar Sub-routes ────────────────────────────────────

  // GET /api/data/econ-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
  // [claude-code 2026-03-28] S7: Enriched with latest scored FJ item per ticker for card display
  app.get("/econ-calendar", async (c) => {
    try {
      const from = c.req.query("from");
      const to = c.req.query("to");
      const events = await readEconEvents({
        from: from ?? undefined,
        to: to ?? undefined,
      });

      // Enrich each ECON_TICKER with latest scored item data
      const tickerEnrichments: Record<
        string,
        {
          lastHeadline?: string;
          sentiment?: string;
          ivScore?: number;
          publishedAt?: string;
        }
      > = {};
      const ECON_TICKERS = [
        "CPI",
        "PPI",
        "PI",
        "GDP",
        "PMI",
        "PCE",
        "FOMC",
        "CUTS",
      ];
      for (const ticker of ECON_TICKERS) {
        const { scoredItems } = await readEconHistory(ticker, 1);
        if (scoredItems.length > 0) {
          const item = scoredItems[0];
          tickerEnrichments[ticker] = {
            lastHeadline: item.headline,
            sentiment: item.sentiment ?? undefined,
            ivScore: item.iv_score ?? undefined,
            publishedAt: item.published_at ?? item.analyzed_at ?? undefined,
          };
        }
      }

      return c.json({ events, count: events.length, tickerEnrichments });
    } catch (err) {
      console.error("[Data] /econ-calendar error:", err);
      return c.json({ events: [], count: 0, tickerEnrichments: {} }, 500);
    }
  });

  // GET /api/data/econ-prints?event=CPI
  app.get("/econ-prints", async (c) => {
    try {
      const eventName = c.req.query("event");
      const prints = await readEconPrints({
        eventName: eventName ?? undefined,
      });
      return c.json({ prints, count: prints.length });
    } catch (err) {
      console.error("[Data] /econ-prints error:", err);
      return c.json({ prints: [], count: 0 }, 500);
    }
  });

  // POST /api/data/econ-print — write an actual print result
  app.post("/econ-print", async (c) => {
    try {
      const body = await c.req.json<{
        eventName: string;
        date: string;
        actual: number;
        forecast?: number;
        previous?: number;
      }>();
      if (!body.eventName || !body.date || body.actual == null) {
        return c.json({ error: "eventName, date, actual required" }, 400);
      }
      const result = await writeEconPrint({
        headline: body.eventName,
        actual_value: String(body.actual),
        forecast_value:
          body.forecast != null ? String(body.forecast) : undefined,
        previous_value:
          body.previous != null ? String(body.previous) : undefined,
      });
      if (!result) return c.json({ error: "Failed to write print" }, 500);
      return c.json({ success: true, id: result.id });
    } catch (err) {
      console.error("[Data] /econ-print POST error:", err);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // PATCH /api/data/econ-event/:id/actual — update actual on existing event
  app.patch("/econ-event/:id/actual", async (c) => {
    try {
      const id = c.req.param("id");
      const { actual } = await c.req.json<{ actual: string }>();
      if (!actual) return c.json({ error: "actual required" }, 400);
      const ok = await updateEconEventActual(id, actual);
      return ok
        ? c.json({ success: true })
        : c.json({ error: "Update failed" }, 500);
    } catch (err) {
      console.error("[Data] PATCH econ-event error:", err);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // GET /api/data/econ-poller-status — smart polling window status
  app.get("/econ-poller-status", async (c) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const events = await readEconEvents({ from: today, to: today });
      const highImportance = events.filter(
        (e) => e.impact === "high" || e.impact === "medium",
      );

      const now = Date.now();
      const PRE = 5;
      const POST = 15;

      const upcoming = highImportance
        .map((e) => {
          if (!e.date || !e.time) return null;
          const eventMs = new Date(`${e.date}T${e.time}`).getTime();
          const diffMin = (now - eventMs) / 60_000;
          return {
            name: e.name,
            time: e.time,
            msUntil: eventMs - now,
            inWindow: diffMin >= -PRE && diffMin <= POST,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.msUntil - b.msUntil);

      const activeInWindow = upcoming.filter((e) => e.inWindow);
      const nextEvent = upcoming.find((e) => e.msUntil > -POST * 60_000);

      let autoRefresh = true;
      try {
        const settings = await getUserSettings("default");
        if (settings.autoRefresh !== undefined)
          autoRefresh = settings.autoRefresh as boolean;
      } catch {
        /* default true */
      }

      return c.json({
        active: activeInWindow.length > 0,
        autoRefresh,
        nextEvent: nextEvent
          ? {
              name: nextEvent.name,
              time: nextEvent.time,
              msUntil: nextEvent.msUntil,
            }
          : null,
        todayEventCount: highImportance.length,
        eventsInWindow: activeInWindow.length,
      });
    } catch (err) {
      return c.json(
        {
          active: false,
          autoRefresh: true,
          nextEvent: null,
          todayEventCount: 0,
          eventsInWindow: 0,
        },
        500,
      );
    }
  });

  // ── Econ History (for Sanctum expanded cards) ─────────────────

  // GET /api/data/econ-history/:ticker — historical prints + scored items for a ticker
  app.get("/econ-history/:ticker", async (c) => {
    try {
      const ticker = c.req.param("ticker");
      const limit = parseInt(c.req.query("limit") ?? "10", 10);
      const { prints, scoredItems } = await readEconHistory(ticker, limit);

      // Transform prints into frontend-friendly shape
      const history = prints.map((p) => {
        const actual =
          p.actual_value != null ? parseFloat(p.actual_value) : null;
        const forecast =
          p.forecast_value != null ? parseFloat(p.forecast_value) : null;
        const previous =
          p.previous_value != null ? parseFloat(p.previous_value) : null;
        let surprise: number | null = null;
        let direction: "beat" | "miss" | "inline" | null = null;

        if (actual != null && forecast != null && forecast !== 0) {
          surprise = ((actual - forecast) / Math.abs(forecast)) * 100;
          direction =
            Math.abs(surprise) < 2 ? "inline" : surprise > 0 ? "beat" : "miss";
        }

        return {
          id: p.id,
          date: p.printed_at
            ? new Date(p.printed_at).toISOString().slice(0, 10)
            : null,
          actual,
          forecast,
          previous,
          surprise: surprise != null ? Math.round(surprise * 100) / 100 : null,
          direction,
          ivScore: p.iv_score ?? null,
        };
      });

      // Transform scored items — extract sub-score breakdowns
      const scoring = scoredItems.map((s) => ({
        id: s.tweet_id,
        headline: s.headline,
        ivScore: s.iv_score ?? null,
        macroLevel: s.macro_level ?? null,
        sentiment: s.sentiment ?? null,
        riskType: s.risk_type ?? null,
        subScores: s.sub_scores ?? null,
        econData: s.econ_data ?? null,
        publishedAt: s.published_at ?? null,
        marketImpact: s.market_impact ?? null,
      }));

      return c.json({
        ticker,
        history,
        scoring,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Data] /econ-history error:", err);
      return c.json(
        {
          ticker: c.req.param("ticker"),
          history: [],
          scoring: [],
          fetchedAt: new Date().toISOString(),
        },
        500,
      );
    }
  });

  return app;
}
