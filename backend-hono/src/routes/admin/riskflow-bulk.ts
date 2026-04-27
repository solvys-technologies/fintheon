// [claude-code 2026-04-27] S46.4: bulk admin routes for the Refinement Engine
// Catalyst Stats panel.
//
//   GET  /api/admin/riskflow/source-stats?days=30
//        → counts per (category, polling_type, source) for the last N days.
//
//   POST /api/admin/riskflow/bulk-delete    body: { sources?: string[],
//                                                   category?: string,
//                                                   from?: ISO_DATE,
//                                                   to?: ISO_DATE }
//        → DELETE rows matching the filter from scored_riskflow_items + raw.
//
//   POST /api/admin/riskflow/refill         body: { sources: string[],
//                                                   from: ISO_DATE,
//                                                   to: ISO_DATE,
//                                                   tail_handle_ms?: number,
//                                                   tail_cycle_ms?: number }
//        → kicks the ad-hoc refill across the past 14d (default) for the
//          listed sources, sleeping `tail_handle_ms` between handle fetches
//          and `tail_cycle_ms` between cycle passes (mass-refill rate-limit).
//
//   POST /api/admin/riskflow/msm-purge      body: { confirm?: boolean }
//        → audit pass returns candidate_count + sample_headlines (≤20).
//          With confirm:true → hard-DELETE matched rows from BOTH
//          scored_riskflow_items + raw_riskflow_items.
//
// All routes gated on x-routine-secret matching ROUTINE_SECRET (same gate as
// the existing backfill routes). Refinement Engine UI sends the secret via a
// header read from the dev-settings password manager — see RefinementEngine
// Catalyst Stats panel.

import { Hono } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { runRefillForSources } from "../../services/riskflow/refill-driver.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// MSM publisher needles — kept in lockstep with publisher-blocklist.ts so the
// audit pass surfaces every row the universal block-list would have rejected
// at the persist boundary, plus the historical rows that landed before the
// block-list shipped.
const MSM_NEEDLES = [
  "bloomberg",
  "reuters",
  "cnbc",
  "fox news",
  "fox business",
  "msnbc",
  "cnn",
  "marketwatch",
  "wsj",
  "wall street journal",
  "financial times",
  "barron",
  "nbc news",
  "abc news",
  "cbs news",
  "usa today",
  "business insider",
  "seeking alpha",
  "zero hedge",
];

interface SourceStat {
  source: string;
  category: string | null;
  polling_type: "social" | "web";
  count: number;
}

export function createRiskFlowBulkRoutes() {
  const router = new Hono();

  router.use("*", async (c, next) => {
    const secret = process.env.ROUTINE_SECRET;
    if (!secret) {
      return c.json({ error: "ROUTINE_SECRET not configured" }, 503);
    }
    if (c.req.header("x-routine-secret") !== secret) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  // GET /source-stats — counts per source for the Refinement Engine panel.
  router.get("/source-stats", async (c) => {
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

    const days = Math.max(1, Math.min(Number(c.req.query("days") ?? 30), 90));
    const sinceIso = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Pull every scored row in window with the columns we need to attribute
    // back to a source. The classification rule:
    //   - source_domain like "twitter:%" or "nitter:%" → polling_type = social,
    //     source = the handle suffix.
    //   - any other source_domain → polling_type = web, source = the host.
    const PAGE = 1000;
    const counts = new Map<string, SourceStat>();
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("scored_riskflow_items")
        .select("source_domain, source")
        .gte("published_at", sinceIso)
        .range(from, from + PAGE - 1);
      if (error) {
        return c.json(
          { error: "scored_read_failed", detail: error.message },
          500,
        );
      }
      const rows = data ?? [];
      for (const row of rows) {
        const sd = (row as { source_domain?: string | null }).source_domain;
        const src = (row as { source?: string | null }).source;
        let key: string;
        let pollingType: "social" | "web";
        if (typeof sd === "string" && sd.length > 0) {
          if (sd.startsWith("twitter:")) {
            key = sd;
            pollingType = "social";
          } else if (sd.startsWith("nitter:")) {
            key = `twitter:${sd.slice("nitter:".length)}`;
            pollingType = "social";
          } else {
            key = sd;
            pollingType = "web";
          }
        } else if (typeof src === "string" && src.length > 0) {
          key = src;
          pollingType = "web";
        } else {
          continue;
        }
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, {
            source: key,
            category: null,
            polling_type: pollingType,
            count: 1,
          });
        }
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    // Decorate social sources with their riskflow_source_accounts.category.
    const { data: accounts } = await sb
      .from("riskflow_source_accounts")
      .select("handle, category, active");
    const handleToCategory = new Map<
      string,
      { category: string; active: boolean }
    >();
    for (const a of accounts ?? []) {
      const handle = ((a as { handle?: string }).handle ?? "").toLowerCase();
      handleToCategory.set(handle, {
        category: (a as { category?: string }).category ?? "Custom",
        active: (a as { active?: boolean }).active ?? false,
      });
    }
    for (const stat of counts.values()) {
      if (stat.polling_type === "social") {
        const handle = stat.source.replace(/^twitter:/, "").toLowerCase();
        const meta = handleToCategory.get(handle);
        if (meta) stat.category = meta.category;
        else stat.category = "Custom";
      }
    }

    const list = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    return c.json({ days, stats: list });
  });

  // POST /bulk-delete — mass delete by sources / category / date range.
  router.post("/bulk-delete", async (c) => {
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

    const body = (await c.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const sources = Array.isArray(body.sources)
      ? (body.sources as unknown[]).filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        )
      : [];
    const from = typeof body.from === "string" ? body.from : null;
    const to = typeof body.to === "string" ? body.to : null;
    if (from && !ISO_DATE.test(from)) {
      return c.json({ error: "from must be YYYY-MM-DD" }, 400);
    }
    if (to && !ISO_DATE.test(to)) {
      return c.json({ error: "to must be YYYY-MM-DD" }, 400);
    }
    if (sources.length === 0 && !from && !to) {
      return c.json({ error: "at_least_one_filter_required" }, 400);
    }

    let scoredQ = sb.from("scored_riskflow_items").delete({ count: "exact" });
    let rawQ = sb.from("raw_riskflow_items").delete({ count: "exact" });

    if (sources.length > 0) {
      // Sources may be either "twitter:<handle>" (social) or a host string (web).
      // Match against source_domain for both shapes; nitter:<handle> historical
      // rows are normalized into twitter:<handle> via OR.
      const orParts: string[] = [];
      for (const s of sources) {
        orParts.push(`source_domain.eq.${s}`);
        if (s.startsWith("twitter:")) {
          orParts.push(`source_domain.eq.nitter:${s.slice("twitter:".length)}`);
        }
      }
      scoredQ = scoredQ.or(orParts.join(","));
      rawQ = rawQ.or(orParts.join(","));
    }
    if (from) {
      const startIso = new Date(`${from}T00:00:00Z`).toISOString();
      scoredQ = scoredQ.gte("published_at", startIso);
      rawQ = rawQ.gte("published_at", startIso);
    }
    if (to) {
      const endIso = new Date(
        Date.parse(`${to}T00:00:00Z`) + 86_400_000,
      ).toISOString();
      scoredQ = scoredQ.lt("published_at", endIso);
      rawQ = rawQ.lt("published_at", endIso);
    }

    const { count: scoredCount, error: scoredErr } = await scoredQ;
    if (scoredErr) {
      return c.json(
        { error: "scored_delete_failed", detail: scoredErr.message },
        500,
      );
    }
    const { count: rawCount, error: rawErr } = await rawQ;
    if (rawErr) {
      return c.json(
        { error: "raw_delete_failed", detail: rawErr.message },
        500,
      );
    }

    return c.json({
      ok: true,
      scored_deleted: scoredCount ?? 0,
      raw_deleted: rawCount ?? 0,
    });
  });

  // POST /refill — mass refill from selected sources across a date range with
  // tail rate-limit. Long-running; runs detached and returns the run handle.
  router.post("/refill", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const sources = Array.isArray(body.sources)
      ? (body.sources as unknown[]).filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        )
      : [];
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (sources.length === 0) {
      return c.json({ error: "sources_required" }, 400);
    }
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return c.json({ error: "from/to must be YYYY-MM-DD" }, 400);
    }
    if (from > to) {
      return c.json({ error: "from must be <= to" }, 400);
    }
    const tailHandleMs = Math.max(
      250,
      Math.min(Number(body.tail_handle_ms ?? 1500), 10_000),
    );
    const tailCycleMs = Math.max(
      0,
      Math.min(Number(body.tail_cycle_ms ?? 5_000), 30_000),
    );

    const result = await runRefillForSources({
      sources,
      from,
      to,
      tailHandleMs,
      tailCycleMs,
    });
    return c.json({ ok: true, ...result });
  });

  // POST /msm-purge — audit + confirm-gated mainstream-media row removal.
  router.post("/msm-purge", async (c) => {
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

    const body = (await c.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const confirm = body.confirm === true;

    // Build the OR clause once — every needle hits headline + body + url.
    const orParts: string[] = [];
    for (const needle of MSM_NEEDLES) {
      orParts.push(`headline.ilike.%${needle}%`);
      orParts.push(`body.ilike.%${needle}%`);
      orParts.push(`url.ilike.%${needle}%`);
    }
    const orClause = orParts.join(",");

    if (!confirm) {
      const { data: sample, error: sampleErr } = await sb
        .from("scored_riskflow_items")
        .select("id, headline, source_domain, published_at, url")
        .or(orClause)
        .order("published_at", { ascending: false })
        .limit(20);
      if (sampleErr) {
        return c.json(
          { error: "audit_read_failed", detail: sampleErr.message },
          500,
        );
      }
      const { count, error: countErr } = await sb
        .from("scored_riskflow_items")
        .select("id", { count: "exact", head: true })
        .or(orClause);
      if (countErr) {
        return c.json(
          { error: "audit_count_failed", detail: countErr.message },
          500,
        );
      }
      return c.json({
        confirmed: false,
        candidate_count: count ?? 0,
        sample: sample ?? [],
        needles: MSM_NEEDLES,
      });
    }

    const { count: scoredDeleted, error: scoredErr } = await sb
      .from("scored_riskflow_items")
      .delete({ count: "exact" })
      .or(orClause);
    if (scoredErr) {
      return c.json(
        { error: "scored_purge_failed", detail: scoredErr.message },
        500,
      );
    }
    const { count: rawDeleted, error: rawErr } = await sb
      .from("raw_riskflow_items")
      .delete({ count: "exact" })
      .or(orClause);
    if (rawErr) {
      return c.json({ error: "raw_purge_failed", detail: rawErr.message }, 500);
    }

    return c.json({
      confirmed: true,
      scored_deleted: scoredDeleted ?? 0,
      raw_deleted: rawDeleted ?? 0,
    });
  });

  return router;
}
