#!/usr/bin/env node

const PROXY_BY_INSTRUMENT = {
  NQ: "QQQ",
  MNQ: "QQQ",
  ES: "SPY",
  MES: "SPY",
  YM: "DIA",
  MYM: "DIA",
  RTY: "IWM",
  M2K: "IWM",
};

const TICK_BY_INSTRUMENT = {
  NQ: 0.25,
  MNQ: 0.25,
  ES: 0.25,
  MES: 0.25,
  YM: 1,
  MYM: 1,
  RTY: 0.1,
  M2K: 0.1,
};

const LABELS = {
  putWall: "POI Put Wall",
  hvl: "POI HVL",
  callWall: "POI Call Wall",
  maxPain: "POI Max Pain",
  volumePoc: "POI Volume POC",
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function numberValue(value) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function rowsFromResponse(json) {
  const data = json?.data ?? json;
  return Array.isArray(data) ? data : [];
}

async function uwFetch(path) {
  const key = process.env.UNUSUAL_WHALES_API_KEY;
  if (!key) throw new Error("UNUSUAL_WHALES_API_KEY not configured");
  const response = await fetch(`https://api.unusualwhales.com${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (response.ok) return response.json();
  const body = await response.text().catch(() => "");
  throw new Error(`Unusual Whales ${response.status}: ${body.slice(0, 180)}`);
}

function strikeOf(row) {
  return numberValue(row.strike ?? row.price);
}

function callGammaOf(row) {
  return numberValue(
    row.call_gex ?? row.call_gamma_oi ?? row.call_gamma_vol ?? row.call_gamma,
  );
}

function putGammaOf(row) {
  return numberValue(
    row.put_gex ?? row.put_gamma_oi ?? row.put_gamma_vol ?? row.put_gamma,
  );
}

function signedPutGamma(callGamma, putGamma) {
  if (putGamma == null) return 0;
  if (putGamma < 0) return putGamma;
  if (callGamma != null && callGamma < 0) return putGamma;
  return -Math.abs(putGamma);
}

function isInSideRange(strike, side, sourcePrice) {
  if (!sourcePrice) return true;
  return side === "put" ? strike <= sourcePrice : strike >= sourcePrice;
}

function strongestSide(rows, side, sourcePrice) {
  const candidates = rows
    .map((row) => {
      const strike = strikeOf(row);
      const exposure = side === "call" ? callGammaOf(row) : putGammaOf(row);
      if (strike == null || exposure == null) return null;
      return { strike, exposure: Math.abs(exposure) };
    })
    .filter(Boolean)
    .filter((item) => isInSideRange(item.strike, side, sourcePrice))
    .sort((a, b) => b.exposure - a.exposure);
  return candidates[0]?.strike ?? null;
}

function findGammaFlip(rows, sourcePrice) {
  const netRows = rows
    .map((row) => {
      const strike = strikeOf(row);
      const callGamma = callGammaOf(row) ?? 0;
      const putGamma = signedPutGamma(callGamma, putGammaOf(row));
      return strike == null ? null : { strike, net: callGamma + putGamma };
    })
    .filter(Boolean)
    .sort((a, b) => a.strike - b.strike);

  const flips = [];
  for (let i = 1; i < netRows.length; i += 1) {
    const prev = netRows[i - 1];
    const current = netRows[i];
    if (prev.net === 0) flips.push(prev.strike);
    const hasCrossed =
      (prev.net < 0 && current.net > 0) || (prev.net > 0 && current.net < 0);
    if (!hasCrossed) continue;
    const range = current.strike - prev.strike;
    const denom = Math.abs(prev.net) + Math.abs(current.net);
    flips.push(prev.strike + range * (Math.abs(prev.net) / denom));
  }

  if (flips.length === 0) return null;
  if (!sourcePrice) return flips[Math.floor(flips.length / 2)];
  return flips.sort(
    (a, b) => Math.abs(a - sourcePrice) - Math.abs(b - sourcePrice),
  )[0];
}

function volumeFallback(rows, field, sourcePrice, direction) {
  const candidates = rows
    .map((row) => {
      const price = numberValue(row.price ?? row.strike);
      const volume = numberValue(row[field]);
      return price == null || volume == null ? null : { price, volume };
    })
    .filter(Boolean)
    .filter((item) => {
      if (!sourcePrice) return true;
      return direction === "below"
        ? item.price <= sourcePrice
        : item.price >= sourcePrice;
    })
    .sort((a, b) => b.volume - a.volume);
  return candidates[0]?.price ?? null;
}

async function settleRows(path) {
  const result = await uwFetch(path);
  return rowsFromResponse(result);
}

async function deriveFromUnusualWhales(source, sourcePrice) {
  const encoded = encodeURIComponent(source);
  const params = sourcePrice
    ? `?limit=500&min_strike=${Math.floor(sourcePrice * 0.85)}&max_strike=${Math.ceil(sourcePrice * 1.15)}`
    : "?limit=500";
  const [gexResult, volumeResult, maxPainResult] = await Promise.allSettled([
    settleRows(`/api/stock/${encoded}/spot-exposures/strike${params}`),
    settleRows(`/api/stock/${encoded}/option/stock-price-levels`),
    settleRows(`/api/stock/${encoded}/max-pain`),
  ]);
  const gexRows = gexResult.status === "fulfilled" ? gexResult.value : [];
  const volumeRows =
    volumeResult.status === "fulfilled" ? volumeResult.value : [];
  const maxPainRows =
    maxPainResult.status === "fulfilled" ? maxPainResult.value : [];
  const putWall =
    strongestSide(gexRows, "put", sourcePrice) ??
    volumeFallback(volumeRows, "put_volume", sourcePrice, "below");
  const callWall =
    strongestSide(gexRows, "call", sourcePrice) ??
    volumeFallback(volumeRows, "call_volume", sourcePrice, "above");
  const hvl = findGammaFlip(gexRows, sourcePrice);
  return {
    levels: {
      putWall,
      hvl,
      callWall,
      maxPain: numberValue(maxPainRows[0]?.max_pain),
    },
    metadata: {
      sourceMode: "unusual-whales-rest",
      gexRows: gexRows.length,
      volumeRows: volumeRows.length,
      maxPainRows: maxPainRows.length,
      hvlConfidence: hvl == null ? "unavailable" : "derived",
    },
  };
}

function normalizeManualLevels(levelsArg) {
  if (!levelsArg) return {};
  const parsed = JSON.parse(levelsArg);
  if (!Array.isArray(parsed)) {
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, numberValue(value)]),
    );
  }
  return Object.fromEntries(
    parsed.map((item) => [
      item.kind,
      numberValue(item.sourceLevel ?? item.level),
    ]),
  );
}

function confidenceFor(kind, metadata) {
  if (kind === "hvl" && metadata?.hvlConfidence === "unavailable") {
    return "unavailable";
  }
  if (metadata?.sourceMode === "manual") return "manual";
  return kind === "maxPain" ? "fallback" : "derived";
}

function buildOutput(input) {
  const tick = TICK_BY_INSTRUMENT[input.instrument] ?? 0.25;
  const ratio = input.targetPrice / input.sourcePrice;
  const levels = Object.entries(input.rawLevels)
    .filter(([, value]) => value != null)
    .map(([kind, sourceLevel]) => ({
      kind,
      sourceLevel,
      targetLevel: Number(
        (Math.round((sourceLevel * ratio) / tick) * tick).toFixed(4),
      ),
      label: LABELS[kind] ?? `POI ${kind}`,
      confidence: confidenceFor(kind, input.metadata),
    }));
  return {
    instrument: input.instrument,
    source: input.source,
    generatedAt: new Date().toISOString(),
    basis: {
      sourcePrice: input.sourcePrice,
      targetPrice: input.targetPrice,
      ratio: Number(ratio.toFixed(8)),
      method: "targetLevel = sourceLevel * targetPrice / sourcePrice",
      tick,
    },
    levels,
    metadata: input.metadata,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const instrument = String(args.instrument || args.i || "")
    .replace("/", "")
    .toUpperCase();
  if (!instrument) throw new Error("--instrument is required");
  const source = String(
    args.source || PROXY_BY_INSTRUMENT[instrument] || "",
  ).toUpperCase();
  if (!source) throw new Error(`No default source proxy for ${instrument}`);
  const sourcePrice = numberValue(args["source-price"] || args.sourcePrice);
  const targetPrice = numberValue(args["target-price"] || args.targetPrice);
  if (!sourcePrice || !targetPrice) {
    throw new Error("--source-price and --target-price are required");
  }
  const derived = args.uw
    ? await deriveFromUnusualWhales(source, sourcePrice)
    : {
        levels: normalizeManualLevels(args.levels),
        metadata: { sourceMode: "manual" },
      };
  console.log(
    JSON.stringify(
      buildOutput({
        instrument,
        source,
        sourcePrice,
        targetPrice,
        rawLevels: derived.levels,
        metadata: derived.metadata,
      }),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
});
