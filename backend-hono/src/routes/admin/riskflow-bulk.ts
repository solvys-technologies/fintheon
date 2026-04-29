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
  // [claude-code 2026-04-27] v5.33.3: gate swapped from x-routine-secret to
  // Supabase JWT + superadmin allow-list per TP. Route mount in routes/index.ts
  // stacks authMiddleware + requireAuth + requireSuperadmin upstream — no
  // per-route secret check needed here. The Refinement Engine UI now passes
  // the user's JWT via Authorization: Bearer <token> instead of having TP
  // paste a routine secret into the panel.

  // GET /source-stats — counts per source for the Refinement Engine panel.
  router.get("/source-stats", async (c) => {
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

    const days = Math.max(1, Math.min(Number(c.req.query("days") ?? 30), 90));
    const typeFilter = c.req.query("type"); // S48-T1: optional "web" or "social" filter
    const sinceIso = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // [claude-code 2026-04-27] v5.33.6: scored_riskflow_items doesn't have
    // a source_domain column (only raw_riskflow_items does), so we read
    // `source` and `tags` and reconstruct the polling-type classification:
    //   - source starting with "twitter:" → polling_type = social, key = source.
    //   - tags carry the original source_domain when the worker writes them
    //     (e.g. ["url:https://...", "tier:standard"]).
    //   - everything else → polling_type = web, key = source.
    const PAGE = 1000;
    const counts = new Map<string, SourceStat>();
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("scored_riskflow_items")
        .select("source, tags")
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
        const src = (row as { source?: string | null }).source;
        if (typeof src !== "string" || src.length === 0) continue;
        let key: string;
        let pollingType: "social" | "web";
        if (src.startsWith("twitter:")) {
          key = src;
          pollingType = "social";
        } else if (src.startsWith("nitter:")) {
          key = `twitter:${src.slice("nitter:".length)}`;
          pollingType = "social";
        } else {
          key = src;
          pollingType = "web";
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

    // S48-T1: optional type filter — only return sources of the specified polling_type
    const filtered = typeFilter
      ? list.filter((s) => s.polling_type === typeFilter)
      : list;

    return c.json({ days, stats: filtered });
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
      // [claude-code 2026-04-27] v5.33.6: scored_riskflow_items has no
      // source_domain column — match scored on `source` (which IS on both
      // tables and stores "twitter:<handle>" / "browser-harness" / etc.);
      // raw_riskflow_items keeps the source_domain check since it has the
      // column and worker writes the publisher host there.
      const scoredOrParts: string[] = [];
      const rawOrParts: string[] = [];
      for (const s of sources) {
        scoredOrParts.push(`source.eq.${s}`);
        rawOrParts.push(`source_domain.eq.${s}`);
        if (s.startsWith("twitter:")) {
          const handle = s.slice("twitter:".length);
          scoredOrParts.push(`source.eq.nitter:${handle}`);
          rawOrParts.push(`source_domain.eq.nitter:${handle}`);
        }
      }
      scoredQ = scoredQ.or(scoredOrParts.join(","));
      rawQ = rawQ.or(rawOrParts.join(","));
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
  // [claude-code 2026-04-27] v5.33.3:
  //   - body.from / body.to (YYYY-MM-DD) scope the purge by published_at;
  //     defaults to TODAY in America/New_York when both are omitted.
  //   - body.scope: "today" (default), "all", or "range" — "today" forces
  //     the ET-midnight window even if from/to are passed.
  //   - Wire-relay exemption: rows whose source_domain starts with
  //     "twitter:" / "nitter:" are EXCLUDED from the match. Approved-handle
  //     wire tweets that quote MSM names inline ("Fed announces XYZ:
  //     REUTERS" from FinancialJuice) stay in the feed; only MSM URLs +
  //     MSM-published text (web scrapes) get dropped.
  router.post("/msm-purge", async (c) => {
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

    const body = (await c.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const confirm = body.confirm === true;
    const scope = typeof body.scope === "string" ? body.scope : "today";

    // Resolve date window. "today" = America/New_York calendar day.
    let fromIso: string | null = null;
    let toIso: string | null = null;
    if (scope === "all") {
      fromIso = null;
      toIso = null;
    } else if (
      scope === "range" &&
      typeof body.from === "string" &&
      typeof body.to === "string" &&
      ISO_DATE.test(body.from) &&
      ISO_DATE.test(body.to)
    ) {
      fromIso = new Date(`${body.from}T00:00:00Z`).toISOString();
      toIso = new Date(
        Date.parse(`${body.to}T00:00:00Z`) + 86_400_000,
      ).toISOString();
    } else {
      // "today" — ET calendar day
      const etYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      // ET midnight → UTC. Use a synthetic date string + Date math; en-CA
      // gives YYYY-MM-DD already.
      const etMidnight = new Date(`${etYmd}T00:00:00-04:00`);
      // EDT vs EST: -04 in DST, -05 outside. America/New_York observes DST
      // most of the year; the 1-hour skew at boundaries is acceptable for
      // a purge window. Caller can pass scope=range for surgical control.
      fromIso = etMidnight.toISOString();
      toIso = new Date(etMidnight.getTime() + 86_400_000).toISOString();
    }

    // Build the OR clause — every needle hits headline + body + url.
    const orParts: string[] = [];
    for (const needle of MSM_NEEDLES) {
      orParts.push(`headline.ilike.%${needle}%`);
      orParts.push(`body.ilike.%${needle}%`);
      orParts.push(`url.ilike.%${needle}%`);
    }
    const orClause = orParts.join(",");

    // [claude-code 2026-04-27] v5.33.6: scored_riskflow_items has no
    // source_domain column (only raw does), so the wire-relay exemption
    // checks the `source` column instead. Worker writes "twitter:<handle>"
    // / "nitter:<handle>" into source for X relays — those rows stay in
    // the feed even if their body mentions Reuters/Bloomberg.
    function applyFilters<
      T extends { or: Function; not: Function; gte: Function; lt: Function },
    >(q: T): T {
      let out: T = q.or(orClause) as T;
      out = out.not("source", "ilike", "twitter:%") as T;
      out = out.not("source", "ilike", "nitter:%") as T;
      if (fromIso) out = out.gte("published_at", fromIso) as T;
      if (toIso) out = out.lt("published_at", toIso) as T;
      return out;
    }

    if (!confirm) {
      const sampleQ = applyFilters(
        sb
          .from("scored_riskflow_items")
          .select("id, headline, source, published_at, url"),
      );
      const { data: sample, error: sampleErr } = await sampleQ
        .order("published_at", { ascending: false })
        .limit(20);
      if (sampleErr) {
        return c.json(
          { error: "audit_read_failed", detail: sampleErr.message },
          500,
        );
      }
      const countQ = applyFilters(
        sb
          .from("scored_riskflow_items")
          .select("id", { count: "exact", head: true }),
      );
      const { count, error: countErr } = await countQ;
      if (countErr) {
        return c.json(
          { error: "audit_count_failed", detail: countErr.message },
          500,
        );
      }
      // [claude-code 2026-04-27] v5.33.6: alias `source` → `source_domain`
      // in the response so the existing CatalystStatsDrawer audit display
      // keeps rendering without a frontend type churn.
      const aliasedSample = (sample ?? []).map((row: any) => ({
        id: row.id,
        headline: row.headline,
        source_domain: row.source ?? null,
        published_at: row.published_at,
        url: row.url,
      }));
      return c.json({
        confirmed: false,
        scope,
        from: fromIso,
        to: toIso,
        candidate_count: count ?? 0,
        sample: aliasedSample,
        needles: MSM_NEEDLES,
      });
    }

    const scoredDelQ = applyFilters(
      sb.from("scored_riskflow_items").delete({ count: "exact" }),
    );
    const { count: scoredDeleted, error: scoredErr } = await scoredDelQ;
    if (scoredErr) {
      return c.json(
        { error: "scored_purge_failed", detail: scoredErr.message },
        500,
      );
    }
    const rawDelQ = applyFilters(
      sb.from("raw_riskflow_items").delete({ count: "exact" }),
    );
    const { count: rawDeleted, error: rawErr } = await rawDelQ;
    if (rawErr) {
      return c.json({ error: "raw_purge_failed", detail: rawErr.message }, 500);
    }

    return c.json({
      confirmed: true,
      scope,
      from: fromIso,
      to: toIso,
      scored_deleted: scoredDeleted ?? 0,
      raw_deleted: rawDeleted ?? 0,
    });
  });

  return router;
}
