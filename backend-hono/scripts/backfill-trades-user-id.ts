// [claude-code 2026-04-26] S45 orchestrator: one-time backfill for trades.user_id.
// projectx-sync.ts and autopilot-scheduler.ts historically inserted NULL user_id;
// the forward-fix now resolves PROJECTX_USER_ID || SYSTEM_USER_ID. Run this once
// after both env vars are provisioned in Fly secrets.
//
// Usage:
//   cd backend-hono && SYSTEM_USER_ID=<uuid> npx tsx scripts/backfill-trades-user-id.ts
//   cd backend-hono && npx tsx scripts/backfill-trades-user-id.ts --user-id=<uuid>
//   cd backend-hono && npx tsx scripts/backfill-trades-user-id.ts --dry-run

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function parseFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.split("=")[1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const targetUserId = parseFlag("user-id") ?? process.env.SYSTEM_USER_ID;

  if (!targetUserId) {
    console.error(
      "[backfill] No target user_id. Pass --user-id=<uuid> or set SYSTEM_USER_ID. Aborting.",
    );
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "[backfill] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error: countErr } = await supabase
    .from("trades")
    .select("*", { count: "exact", head: true })
    .is("user_id", null);

  if (countErr) {
    console.error("[backfill] count failed:", countErr.message);
    process.exit(1);
  }

  console.log(`[backfill] ${count ?? 0} trades rows have NULL user_id`);
  console.log(`[backfill] target user_id: ${targetUserId}`);

  if (!count) {
    console.log("[backfill] nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("[backfill] --dry-run, exiting without UPDATE.");
    return;
  }

  const { error: updateErr, count: updated } = await supabase
    .from("trades")
    .update({ user_id: targetUserId })
    .is("user_id", null)
    .select("*", { count: "exact", head: true });

  if (updateErr) {
    console.error("[backfill] UPDATE failed:", updateErr.message);
    process.exit(1);
  }

  console.log(`[backfill] updated ${updated ?? 0} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
