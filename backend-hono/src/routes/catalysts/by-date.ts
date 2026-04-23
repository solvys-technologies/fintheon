import { Hono } from "hono";
import { z } from "zod";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";

const QuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export function createCatalystsByDateRoute() {
  const app = new Hono();

  app.get("/by-date", async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { from, to } = parsed.data;

    if (!isSupabaseConfigured()) {
      return c.json({ catalysts: [], from, to });
    }

    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from("scored_riskflow_items")
        .select(
          "tweet_id, headline, source, url, published_at, urgency, macro_level, iv_score, symbols, tags, sentiment, promoted_at",
        )
        .not("promoted_at", "is", null)
        .gte("published_at", from)
        .lte("published_at", to)
        .order("published_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const catalysts = (data ?? []).map((r) => ({
        id: r.tweet_id,
        headline: r.headline ?? "",
        source: r.source ?? "",
        url: r.url ?? null,
        publishedAt: r.published_at ?? null,
        urgency: deriveUrgency(r.urgency, r.macro_level),
        symbols: r.symbols ?? [],
        tags: r.tags ?? [],
        sentiment: r.sentiment ?? "neutral",
        score: typeof r.iv_score === "number" ? r.iv_score : 0,
      }));

      return c.json({ catalysts, from, to });
    } catch (err) {
      console.error("[Catalysts] by-date failed:", err);
      return c.json({ catalysts: [], from, to, error: "db-unavailable" });
    }
  });

  return app;
}

function deriveUrgency(
  urgency: string | null | undefined,
  macroLevel: number | null | undefined,
): "immediate" | "high" | "normal" {
  if (urgency === "immediate") return "immediate";
  if (urgency === "high") return "high";
  const level = macroLevel ?? 1;
  if (level >= 3) return "immediate";
  if (level === 2) return "high";
  return "normal";
}
