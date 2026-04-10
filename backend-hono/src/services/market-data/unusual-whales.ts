// [claude-code 2026-03-10] Unusual Whales REST client — GEX, option walls, flow
// Gracefully degrades when UW_API_KEY is not set (isAvailable() returns false)
import type { GammaExposure, OptionsWall, OptionsFlow } from "./types.js";

const UW_BASE = "https://api.unusualwhales.com";

const getUwKey = (): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.UNUSUAL_WHALES_API_KEY;

export function isAvailable(): boolean {
  return !!getUwKey();
}

async function uwFetch<T>(path: string): Promise<T> {
  const key = getUwKey();
  if (!key) throw new Error("UNUSUAL_WHALES_API_KEY not configured");

  const res = await fetch(`${UW_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 429)
    throw Object.assign(new Error("UW rate limit"), { status: 429 });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`UW ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export async function getGammaExposure(symbol: string): Promise<GammaExposure> {
  const data = await uwFetch<any>(
    `/api/stock/${encodeURIComponent(symbol)}/greek-exposure`,
  );
  const d = data?.data ?? data;

  return {
    symbol: symbol.toUpperCase(),
    netGex: d?.net_gex ?? d?.netGex ?? 0,
    callGex: d?.call_gex ?? d?.callGex ?? 0,
    putGex: d?.put_gex ?? d?.putGex ?? 0,
    gexFlip: d?.gex_flip ?? d?.gexFlip ?? 0,
    timestamp: new Date().toISOString(),
  };
}

export async function getOptionsWalls(symbol: string): Promise<OptionsWall> {
  // UW returns option chains; we derive put/call walls from OI concentration
  const data = await uwFetch<any>(
    `/api/stock/${encodeURIComponent(symbol)}/option-chains`,
  );
  const chains: any[] = data?.data ?? data ?? [];

  const puts: Array<{
    strike: number;
    volume: number;
    oi: number;
    notional: number;
  }> = [];
  const calls: Array<{
    strike: number;
    volume: number;
    oi: number;
    notional: number;
  }> = [];

  for (const row of chains) {
    const strike = parseFloat(row.strike ?? row.strike_price ?? 0);
    const vol = parseInt(row.volume ?? 0, 10);
    const oi = parseInt(row.open_interest ?? row.openInterest ?? 0, 10);
    const notional = strike * oi * 100;

    if (
      row.type === "put" ||
      row.option_type === "put" ||
      row.put_call === "P"
    ) {
      puts.push({ strike, volume: vol, oi, notional });
    } else {
      calls.push({ strike, volume: vol, oi, notional });
    }
  }

  // Sort by OI descending, keep top 10
  puts.sort((a, b) => b.oi - a.oi);
  calls.sort((a, b) => b.oi - a.oi);

  // Max pain: strike where total notional loss for option buyers is maximized
  const allStrikes = [
    ...new Set([...puts.map((p) => p.strike), ...calls.map((c) => c.strike)]),
  ].sort((a, b) => a - b);
  let maxPain = allStrikes[Math.floor(allStrikes.length / 2)] ?? 0;

  if (allStrikes.length > 0) {
    let minLoss = Infinity;
    for (const s of allStrikes) {
      const putLoss = puts.reduce(
        (acc, p) => acc + Math.max(0, p.strike - s) * p.oi * 100,
        0,
      );
      const callLoss = calls.reduce(
        (acc, c) => acc + Math.max(0, s - c.strike) * c.oi * 100,
        0,
      );
      const totalLoss = putLoss + callLoss;
      if (totalLoss < minLoss) {
        minLoss = totalLoss;
        maxPain = s;
      }
    }
  }

  return {
    symbol: symbol.toUpperCase(),
    putWalls: puts.slice(0, 10),
    callWalls: calls.slice(0, 10),
    maxPain,
    timestamp: new Date().toISOString(),
  };
}

export async function getOptionsFlow(
  symbol: string,
  opts?: { limit?: number },
): Promise<OptionsFlow> {
  const limit = opts?.limit ?? 50;
  const data = await uwFetch<any>(
    `/api/stock/${encodeURIComponent(symbol)}/option-contracts?limit=${limit}`,
  );
  const contracts: any[] = data?.data ?? data ?? [];

  const items = contracts.map((c: any) => {
    const type = (c.type ?? c.option_type ?? c.put_call ?? "call")
      .toLowerCase()
      .startsWith("p")
      ? ("put" as const)
      : ("call" as const);
    const premium = parseFloat(c.premium ?? c.total_premium ?? 0);
    const volume = parseInt(c.volume ?? 0, 10);
    const avgVol = parseInt(c.avg_volume ?? c.avgVolume ?? volume, 10);
    const unusual = volume > avgVol * 2;

    return {
      type,
      strike: parseFloat(c.strike ?? c.strike_price ?? 0),
      expiry: c.expiration_date ?? c.expiry ?? "",
      premium,
      volume,
      sentiment: type === "call" ? ("bullish" as const) : ("bearish" as const),
      unusual,
    };
  });

  const netPremium = items.reduce(
    (acc, i) => acc + (i.type === "call" ? i.premium : -i.premium),
    0,
  );
  const putCount = items.filter((i) => i.type === "put").length;
  const callCount = items.filter((i) => i.type === "call").length;
  const putCallRatio = callCount > 0 ? putCount / callCount : 0;

  return {
    symbol: symbol.toUpperCase(),
    items,
    netPremium,
    putCallRatio,
    timestamp: new Date().toISOString(),
  };
}
