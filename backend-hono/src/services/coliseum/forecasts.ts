import { getColiseumClient } from "./db.js";
import { resolveColiseumDeskId } from "./desks.js";
import type {
  DeskForecast,
  DeskForecastInput,
  ForecastCatalyst,
  ForecastMarketReference,
  MarketReferenceInput,
} from "./types.js";

export async function createDraftForecast(input: {
  actorId: string;
  forecast: DeskForecastInput;
}): Promise<DeskForecast> {
  const sb = getColiseumClient();
  const deskId = await resolveColiseumDeskId(
    input.forecast.deskId,
    input.actorId,
  );
  const { data, error } = await sb
    .from("coliseum_desk_forecasts")
    .insert({
      desk_id: deskId,
      narrative_session_id: input.forecast.narrativeSessionId ?? null,
      title: input.forecast.title,
      thesis: input.forecast.thesis,
      probability: input.forecast.probability ?? null,
      direction: input.forecast.direction ?? null,
      timeframe: input.forecast.timeframe,
      validation_rule: input.forecast.validationRule,
      expires_at: input.forecast.expiresAt ?? null,
      created_by: input.actorId,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Forecast draft failed: ${error.message}`);
  await replaceForecastChildren(
    String(data.id),
    input.forecast.catalystIds ?? [],
    input.forecast.marketReferences ?? [],
  );
  return readForecast(String(data.id));
}

export async function listForecasts(
  deskIdInput: string | null,
  actorId: string | null,
): Promise<DeskForecast[]> {
  const deskId = await resolveColiseumDeskId(deskIdInput, actorId);
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("coliseum_desk_forecasts")
    .select("*")
    .eq("desk_id", deskId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Forecast list failed: ${error.message}`);
  const rows = data ?? [];
  return Promise.all(rows.map((row) => readForecast(String(row.id))));
}

export async function readForecast(id: string): Promise<DeskForecast> {
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("coliseum_desk_forecasts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Forecast lookup failed: ${error.message}`);
  const [catalysts, marketReferences] = await Promise.all([
    readForecastCatalysts(id),
    readForecastMarketReferences(id),
  ]);
  return toForecast(data, catalysts, marketReferences);
}

export async function publishForecast(input: {
  id: string;
  actorId: string;
}): Promise<DeskForecast> {
  const forecast = await readForecast(input.id);
  if (forecast.catalysts.length < 3) {
    throw new Error("Publish requires at least 3 RiskFlow catalysts.");
  }
  const sb = getColiseumClient();
  const { error } = await sb
    .from("coliseum_desk_forecasts")
    .update({
      status: "published",
      publisher_id: input.actorId,
      published_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) throw new Error(`Forecast publish failed: ${error.message}`);
  return readForecast(input.id);
}

export async function updateForecastStatus(
  id: string,
  status: string,
): Promise<DeskForecast> {
  const sb = getColiseumClient();
  const { error } = await sb
    .from("coliseum_desk_forecasts")
    .update({ status, last_checked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Forecast status failed: ${error.message}`);
  return readForecast(id);
}

async function replaceForecastChildren(
  forecastId: string,
  catalystIds: string[],
  marketReferences: MarketReferenceInput[],
): Promise<void> {
  const sb = getColiseumClient();
  await sb
    .from("coliseum_forecast_catalysts")
    .delete()
    .eq("forecast_id", forecastId);
  await sb
    .from("coliseum_forecast_market_refs")
    .delete()
    .eq("forecast_id", forecastId);

  const catalystRows = Array.from(new Set(catalystIds)).map(
    (riskflowItemId) => ({
      forecast_id: forecastId,
      riskflow_item_id: riskflowItemId,
    }),
  );
  if (catalystRows.length > 0) {
    const { error } = await sb
      .from("coliseum_forecast_catalysts")
      .insert(catalystRows);
    if (error) throw new Error(`Forecast catalysts failed: ${error.message}`);
  }

  const marketRows = marketReferences.map((ref) => ({
    forecast_id: forecastId,
    venue: ref.venue,
    market_title: ref.marketTitle,
    market_url: ref.marketUrl,
    price_or_odds: ref.priceOrOdds ?? null,
    expiry: ref.expiry ?? null,
    fetched_at: ref.fetchedAt ?? new Date().toISOString(),
  }));
  if (marketRows.length > 0) {
    const { error } = await sb
      .from("coliseum_forecast_market_refs")
      .insert(marketRows);
    if (error) throw new Error(`Forecast market refs failed: ${error.message}`);
  }
}

async function readForecastCatalysts(id: string): Promise<ForecastCatalyst[]> {
  const { data, error } = await getColiseumClient()
    .from("coliseum_forecast_catalysts")
    .select("*")
    .eq("forecast_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Forecast catalysts failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    riskflowItemId: String(row.riskflow_item_id),
    evidenceLabel: row.evidence_label ? String(row.evidence_label) : null,
    createdAt: String(row.created_at),
  }));
}

async function readForecastMarketReferences(
  id: string,
): Promise<ForecastMarketReference[]> {
  const { data, error } = await getColiseumClient()
    .from("coliseum_forecast_market_refs")
    .select("*")
    .eq("forecast_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Forecast market refs failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    venue: String(row.venue),
    marketTitle: String(row.market_title),
    marketUrl: String(row.market_url),
    priceOrOdds: row.price_or_odds ? String(row.price_or_odds) : null,
    expiry: row.expiry ? String(row.expiry) : null,
    fetchedAt: String(row.fetched_at),
    createdAt: String(row.created_at),
  }));
}

function toForecast(
  row: Record<string, unknown>,
  catalysts: ForecastCatalyst[],
  marketReferences: ForecastMarketReference[],
): DeskForecast {
  return {
    id: String(row.id),
    deskId: String(row.desk_id),
    narrativeSessionId: row.narrative_session_id
      ? String(row.narrative_session_id)
      : null,
    title: String(row.title),
    thesis: String(row.thesis),
    probability: row.probability === null ? null : Number(row.probability),
    direction: row.direction ? String(row.direction) : null,
    timeframe: String(row.timeframe),
    validationRule: String(row.validation_rule),
    status: String(row.status),
    createdBy: String(row.created_by),
    publisherId: row.publisher_id ? String(row.publisher_id) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    catalysts,
    marketReferences,
  };
}
