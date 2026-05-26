const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ColiseumForecast {
  id: string;
  deskId: string;
  title: string;
  thesis: string;
  probability: number | null;
  direction: string | null;
  timeframe: string;
  validationRule: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  catalysts: { riskflowItemId: string }[];
  marketReferences: ColiseumMarketReference[];
}

export interface ColiseumMarketReference {
  venue: string;
  marketTitle: string;
  marketUrl: string;
  priceOrOdds: string | null;
  expiry: string | null;
}

export interface CreateColiseumForecastInput {
  title: string;
  thesis: string;
  probability: number | null;
  direction: string | null;
  timeframe: string;
  validationRule: string;
  catalystIds: string[];
  marketReferences: ColiseumMarketReference[];
}

export interface DeskAgentStyle {
  archetypeMix: string[];
  houseBias: string | null;
  preferredEvidenceSources: string[];
  riskPosture: string | null;
  timeHorizon: string | null;
  forbiddenClaims: string[];
  customInstruction: string | null;
}

export async function fetchColiseumForecasts(): Promise<ColiseumForecast[]> {
  const data = await requestJson<{ forecasts?: ColiseumForecast[] }>(
    "/api/coliseum/forecasts?deskId=default",
  );
  return data.forecasts ?? [];
}

export async function fetchDeskAgentStyle(): Promise<DeskAgentStyle | null> {
  const data = await requestJson<{ style?: DeskAgentStyle | null }>(
    "/api/coliseum/desks/default/agent-style",
  );
  return data.style ?? null;
}

export async function saveDeskAgentStyle(
  style: DeskAgentStyle,
): Promise<DeskAgentStyle> {
  const data = await requestJson<{ style?: DeskAgentStyle }>(
    "/api/coliseum/desks/default/agent-style",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(style),
    },
  );
  if (!data.style) throw new Error("Desk style response was empty.");
  return data.style;
}

export async function createColiseumForecast(
  input: CreateColiseumForecastInput,
): Promise<ColiseumForecast> {
  const data = await requestJson<{ forecast?: ColiseumForecast }>(
    "/api/coliseum/forecasts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deskId: "default", ...input }),
    },
  );
  if (!data.forecast) throw new Error("Forecast response was empty.");
  return data.forecast;
}

export async function publishColiseumForecast(
  id: string,
): Promise<ColiseumForecast> {
  const data = await requestJson<{ forecast?: ColiseumForecast }>(
    `/api/coliseum/forecasts/${encodeURIComponent(id)}/publish`,
    { method: "POST" },
  );
  if (!data.forecast) throw new Error("Publish response was empty.");
  return data.forecast;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error ?? `Coliseum ${response.status}`);
  return data as T;
}
