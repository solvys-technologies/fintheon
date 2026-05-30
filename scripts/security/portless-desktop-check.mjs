#!/usr/bin/env node
// [claude-code 2026-05-30] Desktop Portless route health check.
import { spawnSync } from "node:child_process";

const checks = [
  { name: "localhost", url: "http://localhost:8080/healthz", required: true },
  { name: "fintheon", url: "http://fintheon.test/healthz", required: true },
  {
    name: "hermes",
    url: "http://hermes.fintheon.test/healthz",
    required: false,
  },
  { name: "news", url: "http://news.fintheon.test/healthz", required: false },
];
const repair = "bun run portless:desktop:install && bun run portless:desktop";

const status = spawnSync("bun", ["run", "portless:desktop:status"], {
  encoding: "utf8",
  stdio: "pipe",
});

if (status.error?.code === "ENOENT") {
  console.log("bun unavailable");
  console.log(`repair: ${repair}`);
  process.exit(1);
}

const hasPortless = status.status === 0;
console.log(`portless status: ${hasPortless ? "available" : "needs-repair"}`);
if (!hasPortless) console.log(`repair: ${repair}`);

let hasFailure = !hasPortless;
for (const check of checks) {
  const result = await probe(check.url);
  const label = result.ok ? "ok" : check.required ? "fail" : "warn";
  console.log(`${check.name}: ${label} ${check.url} ${result.detail}`);
  if (check.required && !result.ok) hasFailure = true;
}

if (hasFailure) {
  console.log(`repair: ${repair}`);
  process.exit(1);
}

console.log("Portless Desktop routes healthy");

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1800) });
    return {
      ok: response.status < 500,
      detail: `http=${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.name : "error",
    };
  }
}
