import { MACRO_WATCHLIST } from "../../market-data/macro-watchlist.js";

const watchedSymbols = MACRO_WATCHLIST.map((symbol) => symbol.label);

export function buildTradingViewWatchlistScopeBlock(): string {
  return `

## TradingView Watchlist Trading Scope
The TradingView watchlist is the only trading-analysis universe: ${watchedSymbols.join(", ")}.

Agents may observe external companies, countries, policy actors, sectors, credit stress, crypto, single stocks, and geopolitical events as drivers, risks, or catalysts. Those external items are evidence only.

When talking about trading, direction, setup quality, entries, invalidation, risk, sizing, targets, hedges, or tape impact, translate the narrative back to the watched symbols only. Do not recommend or analyze trades in non-watchlist instruments. If a catalyst does not map cleanly to a watched symbol, say there is no watched-symbol trade read yet.

Equity or sector narratives must resolve through watched futures or macro instruments, usually NQ, ES, YM, RTY, VIX, DXY, US02Y, US10Y, US30Y, GC, or CL.`;
}

export function buildNarrativeFlowResearchProtocolBlock(): string {
  return `

## NarrativeFlow Research Skill Translation
NarrativeFlow uses the Orchestra-style research loop, translated for futures desks:
1. Frame the market question as a falsifiable watchlist thesis.
2. Ground it in attached RiskFlow headlines, vault notes, desk notes, and explicit user context.
3. Split evidence into confirmations, contradictions, and missing observations.
4. Map the narrative to TradingView watchlist sensitivity, not broad asset chatter.
5. Output forward catalysts to watch, each tied to watched-symbol impact and invalidation.

Futures-specific forks:
- macro-narrative-builder: Convert a raw macro/policy/theme idea into a watchlist thesis.
- futures-catalyst-review: Rank attached and related RiskFlow catalysts by watched-symbol relevance.
- policy-headline-cycle: Track escalation/de-escalation cadence and timing risk.
- risk-on-risk-off-synthesis: Translate cross-asset drivers into risk-on/risk-off watchlist pressure.
- catalysts-to-watch-forward: Name the next catalysts, tells, and breakpoints to monitor going forward.

Required output discipline:
- Start with the watched-symbol read.
- Cite attached catalysts and vault notes when present.
- Mark external drivers as drivers, not trade targets.
- Include confirmation, invalidation, and catalysts to watch going forward.
- Keep any trade language constrained to the TradingView watchlist.`;
}
