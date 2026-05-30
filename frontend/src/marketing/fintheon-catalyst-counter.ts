interface RiskflowStats {
  ok?: boolean;
  totalIngested?: number | null;
  heartbeatIngested?: number | null;
}

interface RiskflowSources {
  method_breakdown?: Record<string, number> | null;
  sources?: {
    financialJuiceRss?: { ingested?: number };
    xHomeTimeline?: {
      tiers?: Record<string, { ingested?: number }>;
    };
  };
}

interface RiskSignalResponse {
  signals?: unknown[];
  staleSignals?: unknown[];
}

export function getApiBase() {
  const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  const isRemotePreview =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  if (envBase && !(isRemotePreview && envBase.includes("localhost"))) {
    return envBase;
  }
  if (isRemotePreview) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return envBase || "http://localhost:8080";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

async function readSourcesTotal(apiBase: string) {
  const response = await fetch(`${apiBase}/api/riskflow/sources`);
  if (!response.ok) return null;

  const payload = (await response.json()) as RiskflowSources;
  const methodTotal = Object.values(payload.method_breakdown ?? {}).reduce(
    (sum, value) => sum + Number(value ?? 0),
    0,
  );
  if (methodTotal > 0) return methodTotal;

  const financialJuice = payload.sources?.financialJuiceRss?.ingested ?? 0;
  const xTiers = Object.values(payload.sources?.xHomeTimeline?.tiers ?? {});
  return xTiers.reduce(
    (sum, tier) => sum + (tier.ingested ?? 0),
    financialJuice,
  );
}

async function readTotalIngested(apiBase: string) {
  const response = await fetch(`${apiBase}/api/riskflow/stats`);
  if (!response.ok) return readSourcesTotal(apiBase);

  const payload = (await response.json()) as RiskflowStats;
  if (typeof payload.totalIngested === "number") return payload.totalIngested;
  if (typeof payload.heartbeatIngested === "number") {
    return payload.heartbeatIngested;
  }
  return readSourcesTotal(apiBase);
}

async function readRiskSignalCount(apiBase: string) {
  const response = await fetch(`${apiBase}/api/riskflow/risk-signals`);
  if (!response.ok) return null;

  const payload = (await response.json()) as RiskSignalResponse;
  if (Array.isArray(payload.signals)) return payload.signals.length;
  if (Array.isArray(payload.staleSignals)) return payload.staleSignals.length;
  return null;
}

export function setupCatalystCounter(target: HTMLElement) {
  target.textContent = "[LOADING]";

  readTotalIngested(getApiBase())
    .then((total) => {
      if (typeof total !== "number" || total <= 0) {
        target.textContent = "DB LINK PENDING";
        return;
      }
      target.textContent = formatCount(total);
    })
    .catch(() => {
      target.textContent = "DB LINK PENDING";
    });
}

export function setupRiskSignalCounter(target: HTMLElement) {
  target.textContent = "[LOADING]";

  readRiskSignalCount(getApiBase())
    .then((total) => {
      if (typeof total !== "number") {
        target.textContent = "DB LINK PENDING";
        return;
      }
      target.textContent = formatCount(total);
    })
    .catch(() => {
      target.textContent = "DB LINK PENDING";
    });
}
