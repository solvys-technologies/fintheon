// [claude-code 2026-04-25] S42-T5 — isolated smoke test for /api/browserbase.
// Boots only the route module + Hono so we can verify wiring without standing
// up the full backend (database, supabase, hermes, etc.).
//
// Usage: node scripts/smoke-browserbase-route.mjs

import { Hono } from "hono";
import { createBrowserbaseRoutes } from "../dist/routes/browserbase/index.js";

const app = new Hono();
app.route("/api/browserbase", createBrowserbaseRoutes());

async function post(path, body) {
  const res = await app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function del(path) {
  const res = await app.request(path, { method: "DELETE" });
  return { status: res.status, body: await res.json() };
}

const previousKey = process.env.BROWSERBASE_API_KEY;
delete process.env.BROWSERBASE_API_KEY;

const fallback = await post("/api/browserbase/iframe/session", {
  task: "navigate to https://www.sec.gov",
  conversationId: "smoke-fallback",
});
console.log("[fallback] status =", fallback.status);
console.log("[fallback] body   =", fallback.body);

const invalid = await post("/api/browserbase/iframe/session", { task: "" });
console.log("[invalid]  status =", invalid.status);
console.log("[invalid]  body   =", invalid.body);

const closed = await del("/api/browserbase/iframe/session/sess_smoke_id");
console.log("[delete]   status =", closed.status);
console.log("[delete]   body   =", closed.body);

if (previousKey) process.env.BROWSERBASE_API_KEY = previousKey;
