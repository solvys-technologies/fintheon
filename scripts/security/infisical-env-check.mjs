#!/usr/bin/env node
// [claude-code 2026-05-30] Validate non-secret Infisical operator config.
const projectId = process.env.INFISICAL_PROJECT_ID ?? "";
const envSlug =
  process.env.INFISICAL_ENVIRONMENT ??
  process.env.INFISICAL_ENV ??
  process.env.INFISICAL_ENV_SLUG ??
  "";
const manualMode = process.env.INFISICAL_SYNC_MODE === "manual";
const syncIds = [
  process.env.INFISICAL_SYNC_IDS,
  process.env.INFISICAL_FLY_SYNC_IDS,
  process.env.INFISICAL_VERCEL_SYNC_IDS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const requiredPaths = ["/backend", "/frontend-public", "/desktop-local", "/ci"];
const configuredPaths = (
  process.env.INFISICAL_SECRET_PATHS ?? requiredPaths.join(",")
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const missing = [];
if (!projectId) missing.push("INFISICAL_PROJECT_ID");
if (!envSlug) missing.push("INFISICAL_ENV");
if (syncIds.length === 0 && !manualMode)
  missing.push("INFISICAL_SYNC_IDS or INFISICAL_SYNC_MODE=manual");

console.log("Infisical config check");
console.log(`projectId: ${projectId ? "set" : "missing"}`);
console.log(`environment: ${envSlug || "missing"}`);
console.log(`sync mode: ${manualMode ? "manual" : "api"}`);
console.log(`sync ids: ${syncIds.length}`);
console.log(`paths: ${configuredPaths.join(", ")}`);
console.log(
  `api url: ${process.env.INFISICAL_API_URL ?? "https://app.infisical.com"}`,
);

const absentPaths = requiredPaths.filter(
  (path) => !configuredPaths.includes(path),
);
if (absentPaths.length > 0) {
  console.log(
    `path warning: missing recommended paths ${absentPaths.join(", ")}`,
  );
}

if (missing.length > 0) {
  console.error(`missing config: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Infisical config ready");
