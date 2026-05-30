#!/usr/bin/env node
// [claude-code 2026-05-30] Report Infisical sync status without secret values.
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length > 0 ? rest.join("=") : "true"];
  }),
);

const envSlug = args.get("env") ?? process.env.INFISICAL_ENV ?? "prod";
const shouldTrigger = args.get("trigger") === "true";
const projectId = process.env.INFISICAL_PROJECT_ID ?? "";
const token = process.env.INFISICAL_TOKEN ?? "";
const apiBase = (
  process.env.INFISICAL_API_URL ?? "https://app.infisical.com"
).replace(/\/$/, "");
const manualMode = process.env.INFISICAL_SYNC_MODE === "manual";
const configuredIds = [
  process.env.INFISICAL_SYNC_IDS,
  process.env.INFISICAL_FLY_SYNC_IDS,
  process.env.INFISICAL_VERCEL_SYNC_IDS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

if (manualMode && configuredIds.length === 0) {
  console.log("Infisical sync check: manual mode");
  console.log("sync ids: none configured");
  console.log(
    "operator action: run provider sync from Infisical UI, then smoke runtime health",
  );
  process.exit(0);
}

if (!projectId) fail("INFISICAL_PROJECT_ID is required");
if (!token) fail("INFISICAL_TOKEN is required for API sync checks");

const syncs = await getJson(
  `/api/v1/secret-syncs?projectId=${encodeURIComponent(projectId)}`,
);
const allSyncs = Array.isArray(syncs.secretSyncs) ? syncs.secretSyncs : [];
const selected = allSyncs.filter((sync) => {
  if (configuredIds.length > 0) return configuredIds.includes(sync.id);
  return (
    sync.environment?.slug === envSlug &&
    ["flyio", "vercel"].includes(sync.destination)
  );
});

if (selected.length === 0) fail("No matching Fly/Vercel syncs found");

let hasFailure = false;
console.log(`Infisical sync check env=${envSlug} syncs=${selected.length}`);
for (const sync of selected) {
  if (shouldTrigger) await triggerSync(sync);
  const count = await countSecrets(sync);
  const status = sync.syncStatus ?? "unknown";
  const enabled = sync.isAutoSyncEnabled ?? sync.isEnabled ?? false;
  const path = sync.folder?.path ?? "/";
  const updated = sync.lastSyncedAt ?? "never";
  const hasMessage = sync.lastSyncMessage ? "yes" : "no";
  console.log(
    `${sync.name ?? sync.id} destination=${sync.destination} env=${sync.environment?.slug ?? "unknown"} path=${path} enabled=${enabled} status=${status} keys=${count} lastSyncedAt=${updated} message=${hasMessage}`,
  );
  if (String(status).toLowerCase().includes("fail")) hasFailure = true;
}

process.exit(hasFailure ? 1 : 0);

async function triggerSync(sync) {
  if (!["flyio", "vercel"].includes(sync.destination)) return;
  await getJson(
    `/api/v1/secret-syncs/${sync.destination}/${encodeURIComponent(sync.id)}/sync-secrets`,
    { method: "POST" },
  );
}

async function countSecrets(sync) {
  const environment = sync.environment?.slug ?? envSlug;
  const secretPath = sync.folder?.path ?? "/";
  const query = new URLSearchParams({
    projectId,
    environment,
    secretPath,
    viewSecretValue: "false",
    includeImports: "true",
  });
  try {
    const response = await getJson(`/api/v4/secrets?${query.toString()}`);
    const ownCount = Array.isArray(response.secrets)
      ? response.secrets.length
      : 0;
    const importCount = Array.isArray(response.imports)
      ? response.imports.reduce(
          (sum, item) => sum + (item.secrets?.length ?? 0),
          0,
        )
      : 0;
    return ownCount + importCount;
  } catch {
    return "unavailable";
  }
}

async function getJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Infisical API ${response.status} for ${path.split("?")[0]}`,
    );
  }
  return response.json();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
