// [claude-code 2026-04-30] Operator backfill: last N days of X-sourced RiskFlow (Wire /
// Macro / Commentary handles from riskflow_source_accounts) plus calendar prints
// injected into raw_riskflow_items. Requires SUPABASE_* and optional DATABASE_URL
// for econ inject. Sets FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW for the process if unset.
//
// Usage (from backend-hono):
//   BACKFILL_DAYS=30 bun scripts/riskflow-feed-backfill.ts
//   DRY_RUN=true bun scripts/riskflow-feed-backfill.ts   # no writes

import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN === "true";
const DAYS = Math.min(90, Math.max(1, Number(process.env.BACKFILL_DAYS ?? 30)));
const TAIL_MS = Math.max(
  500,
  Math.min(8000, Number(process.env.BACKFILL_TAIL_MS ?? 2000)),
);

if (!DRY_RUN) {
  process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW ??= "true";
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function twitterSources(handles: string[]): string[] {
  const out = new Set<string>();
  for (const h of handles) {
    const c = h.replace(/^@/, "").trim().toLowerCase();
    if (c.length > 0) out.add(`twitter:${c}`);
  }
  return [...out].sort();
}

async function main() {
  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86_400_000);
  const fromStr = ymd(from);
  const toStr = ymd(to);

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      script: "riskflow-feed-backfill",
      dryRun: DRY_RUN,
      days: DAYS,
      from: fromStr,
      to: toStr,
      writesFlag: process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW,
    }),
  );

  const { runRefillForSources } =
    await import("../src/services/riskflow/refill-driver.js");
  const { getWireHandles, getBrowserHandles, getCommentaryHandles } =
    await import("../src/services/source-accounts/source-accounts-service.js");
  const { fetchEconCalendar } =
    await import("../src/services/econ-calendar-service.js");

  const [wire, macro, commentary] = await Promise.all([
    getWireHandles().catch(() => [] as string[]),
    getBrowserHandles().catch(() => [] as string[]),
    getCommentaryHandles().catch(() => [] as string[]),
  ]);

  const wireSrc = twitterSources(wire);
  const wireSet = new Set(wireSrc.map((s) => s.slice("twitter:".length)));
  const macroSrc = twitterSources(macro).filter(
    (s) => !wireSet.has(s.slice("twitter:".length)),
  );
  const commentarySrc = twitterSources(
    commentary.length > 0 ? commentary : ["financialjuice"],
  ).filter((s) => !wireSet.has(s.slice("twitter:".length)));

  console.log(
    `[backfill] handles wire=${wireSrc.length} macro=${macroSrc.length} commentary=${commentarySrc.length}`,
  );

  if (DRY_RUN) {
    console.log("[backfill] DRY_RUN — skipping refill and econ inject");
    return;
  }

  let ingestedX = 0;
  if (wireSrc.length > 0) {
    const r = await runRefillForSources({
      sources: wireSrc,
      from: fromStr,
      to: toStr,
      tailHandleMs: TAIL_MS,
      tailCycleMs: 2000,
      twitterTier: "breaking",
    });
    ingestedX += r.ingested_total;
    console.log("[backfill] wire refill", r);
  }
  if (macroSrc.length > 0) {
    const r = await runRefillForSources({
      sources: macroSrc,
      from: fromStr,
      to: toStr,
      tailHandleMs: TAIL_MS,
      tailCycleMs: 2000,
      twitterTier: "standard",
    });
    ingestedX += r.ingested_total;
    console.log("[backfill] macro refill", r);
  }
  if (commentarySrc.length > 0) {
    const r = await runRefillForSources({
      sources: commentarySrc,
      from: fromStr,
      to: toStr,
      tailHandleMs: TAIL_MS,
      tailCycleMs: 2000,
      twitterTier: "commentary",
    });
    ingestedX += r.ingested_total;
    console.log("[backfill] commentary refill", r);
  }

  const events = await fetchEconCalendar({ from: fromStr, to: toStr });
  let econInjected = 0;
  const { injectEconPrintToFeed } =
    await import("../src/services/riskflow/econ-bridge.js");

  for (const ev of events) {
    if (!ev.actual || ev.actual.trim() === "") continue;
    const actual = parseFloat(String(ev.actual).replace(/,/g, ""));
    if (!Number.isFinite(actual)) continue;
    const forecast = ev.forecast
      ? parseFloat(String(ev.forecast).replace(/,/g, ""))
      : undefined;
    const previous = ev.previous
      ? parseFloat(String(ev.previous).replace(/,/g, ""))
      : undefined;
    const date = (ev.date ?? fromStr).slice(0, 10);
    try {
      await injectEconPrintToFeed({
        eventName: ev.name,
        actual,
        forecast: Number.isFinite(forecast!) ? forecast : undefined,
        previous: Number.isFinite(previous!) ? previous : undefined,
        date,
      });
      econInjected++;
    } catch (err) {
      console.warn(
        `[backfill] econ inject skip: ${ev.name}`,
        err instanceof Error ? err.message : err,
      );
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      script: "riskflow-feed-backfill",
      stage: "complete",
      rawXIngestedApprox: ingestedX,
      econInjectAttempts: econInjected,
      calendarRowsInRange: events.length,
    }),
  );
}

main().catch((err) => {
  console.error("[backfill] fatal", err);
  process.exit(1);
});
