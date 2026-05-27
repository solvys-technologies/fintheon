---
name: prices-of-interest
description: Derive and plot basis-adjusted options prices of interest for futures charts. Use when a user asks for /prices, put walls, call walls, HVL, gamma exposure levels, Unusual Whales options levels, or TradingView-style chart plotting for NQ, ES, YM, or related futures.
version: 0.1.0
---

# Prices Of Interest

This skill turns options-market structure into chart-ready futures levels.

Primary command shape:

```text
/prices NQ
/prices ES date=today
/prices YM source=DIA sourcePrice=431.10 targetPrice=39122
```

## Scope

Start with:

- `NQ` / `MNQ` using `QQQ` options data
- `ES` / `MES` using `SPY` options data
- `YM` / `MYM` using `DIA` options data

Later instruments may be added only after the data source, proxy, tick size, and basis method are explicit.

## Required Levels

Return these as `Prices of Interest`:

- `Put Wall`: largest downside put-gamma or put-volume concentration
- `HVL`: high-volatility level, preferred as the zero-gamma / gamma-flip level; if unavailable, report `HVL unavailable` and optionally include `max pain` or `volume POC` as a separate center level
- `Call Wall`: largest upside call-gamma or call-volume concentration

Never call max pain or volume POC the HVL unless the source explicitly labels it as HVL. If the user says HVL but the data only supports gamma flip, label it `HVL / Gamma Flip`.

## Data Order

1. Prefer existing Fintheon backend endpoints when they already expose fresh data:
   - `/api/market-data/gex/:symbol`
   - `/api/market-data/walls/:symbol`
   - `/api/market-data/flow/:symbol`
   - `/api/market-data/context/:symbol`
2. For richer level derivation, use Unusual Whales REST or MCP.
   - REST docs: `https://api.unusualwhales.com/docs`
   - MCP server: `https://api.unusualwhales.com/api/mcp`
   - Key env var: `UNUSUAL_WHALES_API_KEY`
3. If MCP discovery will consume too much context, hand the job to a Codex CLI session with a narrow prompt and ask it to return only JSON.

## Basis Adjustment

Basis-adjust ETF or index-option levels to the futures chart with a live ratio:

```text
targetLevel = sourceOptionLevel * (targetFuturesPrice / sourceUnderlyingPrice)
```

Use the current futures price from the active chart or quote feed, and the current source underlying price from the same timestamp window if possible. Record both prices in the output.

Round plotted levels to the futures tick size:

- `NQ`, `MNQ`, `ES`, `MES`: `0.25`
- `YM`, `MYM`: `1`
- `RTY`, `M2K`: `0.1`

If source and target quotes are more than 2 minutes apart during regular trading hours, mark the basis as stale.

## Deterministic Script

Use `scripts/derive-prices-of-interest.mjs` for basis math and optional Unusual Whales REST fetches.

Manual example:

```bash
node .claude/skills/prices-of-interest/scripts/derive-prices-of-interest.mjs \
  --instrument NQ \
  --source-price 529.42 \
  --target-price 21894.25 \
  --levels '{"putWall":525,"hvl":528,"callWall":532}'
```

Unusual Whales example:

```bash
UNUSUAL_WHALES_API_KEY=$UNUSUAL_WHALES_API_KEY \
node .claude/skills/prices-of-interest/scripts/derive-prices-of-interest.mjs \
  --instrument ES \
  --source-price 594.20 \
  --target-price 5968.25 \
  --uw
```

## Output Contract

Return compact JSON plus a human summary:

```json
{
  "instrument": "NQ",
  "source": "QQQ",
  "basis": {
    "sourcePrice": 529.42,
    "targetPrice": 21894.25,
    "ratio": 41.35609,
    "method": "targetLevel = sourceLevel * targetPrice / sourcePrice"
  },
  "levels": [
    {
      "kind": "putWall",
      "sourceLevel": 525,
      "targetLevel": 21711.75,
      "label": "POI Put Wall",
      "confidence": "derived"
    }
  ]
}
```

## Chart Plotting Protocol

For a TradingView-style chart:

1. Confirm the active symbol and timeframe from the chart UI or chart API.
2. Plot horizontal levels at `targetLevel`, not the source ETF level.
3. Labels must be compact:
   - `POI Put`
   - `POI HVL`
   - `POI Call`
4. Use restrained colors:
   - Put wall: muted red
   - HVL: Solvys Gold
   - Call wall: muted green
5. If browser automation cannot reliably draw the chart, return a Pine Script snippet with the same levels and labels.

## Handoff Prompt

For Codex CLI handoff, use:

```text
Read .claude/skills/prices-of-interest/SKILL.md. Derive prices of interest for {instrument}. Use Unusual Whales if UNUSUAL_WHALES_API_KEY is available; otherwise explain missing data. Return only JSON matching the skill output contract plus source endpoint metadata. Do not mutate repo files.
```
