// [claude-code 2026-04-23] S31-T6 — deterministic blindspot templates.
// Detectors are pure; no LLM. Each template owns its allowed `pattern` key —
// the generator rejects any row whose pattern isn't in this allowlist.

export interface TradeRecord {
  id: string;
  contract: string;
  side: "long" | "short" | string;
  qty: number;
  entryAt: string; // ISO
  exitAt: string | null;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnL: number;
}

export interface DetectContext {
  userId: string;
  date: string; // YYYY-MM-DD
  trades: TradeRecord[];
  accountLimitNotional?: number;
  vix?: number;
  newsEventsToday?: Array<{ at: string; impact: "high" | "medium" | "low" }>;
  plannedSymbols?: string[];
  avgTradesPer30Days?: number;
}

export interface BlindspotHit {
  pattern: string;
  evidence: string;
}

export interface BlindspotTemplate {
  pattern: string;
  category: "psych" | "trading";
  correctiveAction: string;
  severity: 1 | 2 | 3 | 4 | 5;
  detect: (ctx: DetectContext) => BlindspotHit | null;
}

// Acceptable pattern keys — hard allowlist. Fluid-pass output that lists any
// pattern not in this set is discarded by the generator.
export const ALLOWED_PSYCH_PATTERNS = [
  "revenge_entry",
  "size_escalation",
  "post_loss_cluster",
  "fomo_entry",
] as const;

export const ALLOWED_TRADING_PATTERNS = [
  "over_trading",
  "over_leverage",
  "high_vol_env",
  "news_trading_early",
  "plan_deviation",
] as const;

export type PsychPattern = (typeof ALLOWED_PSYCH_PATTERNS)[number];
export type TradingPattern = (typeof ALLOWED_TRADING_PATTERNS)[number];

function minutesBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}

function sortedByEntry(trades: TradeRecord[]): TradeRecord[] {
  return [...trades].sort(
    (a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime(),
  );
}

function stoppedOut(t: TradeRecord): boolean {
  return t.exitAt !== null && t.realizedPnL < 0;
}

// ── Psych templates ─────────────────────────────────────────────────────────

const revengeEntry: BlindspotTemplate = {
  pattern: "revenge_entry",
  category: "psych",
  severity: 4,
  correctiveAction:
    "After any stop-out, wait 5 minutes minimum before re-entering the same contract. Walk away from the chart.",
  detect(ctx) {
    const ordered = sortedByEntry(ctx.trades);
    const byContract = new Map<string, TradeRecord[]>();
    for (const t of ordered) {
      const list = byContract.get(t.contract) ?? [];
      list.push(t);
      byContract.set(t.contract, list);
    }
    for (const [contract, rows] of byContract) {
      let hits = 0;
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        if (!stoppedOut(prev) || !prev.exitAt) continue;
        if (minutesBetween(prev.exitAt, rows[i].entryAt) <= 2) hits++;
      }
      if (hits >= 3) {
        return {
          pattern: "revenge_entry",
          evidence: `Re-entered ${contract} within 2 min of a stop-out ${hits} times today`,
        };
      }
    }
    return null;
  },
};

const sizeEscalation: BlindspotTemplate = {
  pattern: "size_escalation",
  category: "psych",
  severity: 4,
  correctiveAction:
    "Cap size to planned units after two consecutive losses. Size-up only on the next green day, not mid-session.",
  detect(ctx) {
    const ordered = sortedByEntry(ctx.trades);
    let losses = 0;
    let baseQty = 0;
    for (const t of ordered) {
      if (baseQty === 0) baseQty = t.qty;
      if (losses >= 2 && t.qty >= baseQty * 2) {
        return {
          pattern: "size_escalation",
          evidence: `Size went from ${baseQty} → ${t.qty} after ${losses} consecutive losses`,
        };
      }
      if (t.realizedPnL < 0) losses++;
      else losses = 0;
    }
    return null;
  },
};

const postLossCluster: BlindspotTemplate = {
  pattern: "post_loss_cluster",
  category: "psych",
  severity: 3,
  correctiveAction:
    "Step away for 10 minutes after any loss. No new entries within 5 minutes of a stop-out.",
  detect(ctx) {
    const ordered = sortedByEntry(ctx.trades);
    for (let i = 0; i < ordered.length; i++) {
      if (!stoppedOut(ordered[i]) || !ordered[i].exitAt) continue;
      const window = ordered.filter(
        (t) =>
          t.id !== ordered[i].id &&
          minutesBetween(ordered[i].exitAt!, t.entryAt) <= 5 &&
          new Date(t.entryAt) > new Date(ordered[i].exitAt!),
      );
      if (window.length >= 4) {
        return {
          pattern: "post_loss_cluster",
          evidence: `${window.length} trades within 5 min of a losing trade on ${ordered[i].contract}`,
        };
      }
    }
    return null;
  },
};

const fomoEntry: BlindspotTemplate = {
  pattern: "fomo_entry",
  category: "psych",
  severity: 3,
  correctiveAction:
    "No entries within 30 seconds of a headline unless the level was on your plan before the news hit.",
  detect(ctx) {
    if (!ctx.newsEventsToday?.length) return null;
    const highImpact = ctx.newsEventsToday.filter((e) => e.impact === "high");
    if (highImpact.length === 0) return null;
    for (const t of ctx.trades) {
      for (const e of highImpact) {
        const delta =
          (new Date(t.entryAt).getTime() - new Date(e.at).getTime()) / 1000;
        if (delta >= 0 && delta <= 30) {
          const planned = ctx.plannedSymbols?.includes(t.contract);
          if (!planned) {
            return {
              pattern: "fomo_entry",
              evidence: `Entered ${t.contract} ${Math.round(delta)}s after a high-impact headline, no pre-planned level`,
            };
          }
        }
      }
    }
    return null;
  },
};

// ── Trading templates ───────────────────────────────────────────────────────

const overTrading: BlindspotTemplate = {
  pattern: "over_trading",
  category: "trading",
  severity: 3,
  correctiveAction:
    "Set a hard cap of 1.5× your 30-day average. Once hit, close the platform for 30 minutes.",
  detect(ctx) {
    const count = ctx.trades.length;
    const avg = ctx.avgTradesPer30Days ?? 0;
    if (avg > 0 && count >= Math.ceil(avg * 1.75)) {
      return {
        pattern: "over_trading",
        evidence: `${count} trades today vs your 30-day avg of ${avg.toFixed(1)}`,
      };
    }
    if (avg === 0 && count >= 20) {
      return {
        pattern: "over_trading",
        evidence: `${count} trades today (no baseline yet; 20+ is high for a first session)`,
      };
    }
    return null;
  },
};

const overLeverage: BlindspotTemplate = {
  pattern: "over_leverage",
  category: "trading",
  severity: 5,
  correctiveAction:
    "Size by notional, not contract count. Cap single-trade notional at account risk limit.",
  detect(ctx) {
    const cap = ctx.accountLimitNotional;
    if (!cap || cap <= 0) return null;
    for (const t of ctx.trades) {
      const notional = t.qty * t.entryPrice;
      if (notional > cap * 2) {
        return {
          pattern: "over_leverage",
          evidence: `Notional ${notional.toFixed(0)} on ${t.contract} > 2x account limit ${cap}`,
        };
      }
    }
    return null;
  },
};

const highVolEnv: BlindspotTemplate = {
  pattern: "high_vol_env",
  category: "trading",
  severity: 3,
  correctiveAction:
    "Half-size in any regime with VIX > 25 until you have a written exception to that rule.",
  detect(ctx) {
    if (!ctx.vix || ctx.vix <= 25) return null;
    const avg = ctx.avgTradesPer30Days ?? 0;
    const avgSize =
      ctx.trades.reduce((s, t) => s + t.qty, 0) /
      Math.max(1, ctx.trades.length);
    if (avg > 0 && avgSize > 1.0) {
      return {
        pattern: "high_vol_env",
        evidence: `Traded avg ${avgSize.toFixed(1)} contracts with VIX at ${ctx.vix.toFixed(1)} — no visible size reduction`,
      };
    }
    return null;
  },
};

const newsTradingEarly: BlindspotTemplate = {
  pattern: "news_trading_early",
  category: "trading",
  severity: 4,
  correctiveAction:
    "No new entries in the 5-min window before a scheduled high-impact event. Wait for the first tick post-release.",
  detect(ctx) {
    if (!ctx.newsEventsToday?.length) return null;
    const highImpact = ctx.newsEventsToday.filter((e) => e.impact === "high");
    if (highImpact.length === 0) return null;
    for (const t of ctx.trades) {
      for (const e of highImpact) {
        const delta =
          (new Date(e.at).getTime() - new Date(t.entryAt).getTime()) / 60_000;
        if (delta >= 0 && delta <= 5) {
          return {
            pattern: "news_trading_early",
            evidence: `Entered ${t.contract} ${delta.toFixed(1)} min before a scheduled high-impact event`,
          };
        }
      }
    }
    return null;
  },
};

const planDeviation: BlindspotTemplate = {
  pattern: "plan_deviation",
  category: "trading",
  severity: 3,
  correctiveAction:
    "Log the plan before open. Every off-plan trade gets reviewed and journaled by EOD.",
  detect(ctx) {
    const planned = ctx.plannedSymbols;
    if (!planned || planned.length === 0) return null;
    const offPlan = ctx.trades.filter(
      (t) => !planned.includes(t.contract.toUpperCase()),
    );
    if (offPlan.length >= 1) {
      const contracts = Array.from(new Set(offPlan.map((t) => t.contract)));
      return {
        pattern: "plan_deviation",
        evidence: `${offPlan.length} off-plan trade(s) on ${contracts.join(", ")}; plan was ${planned.join(", ")}`,
      };
    }
    return null;
  },
};

export const PSYCH_BLINDSPOT_TEMPLATES: BlindspotTemplate[] = [
  revengeEntry,
  sizeEscalation,
  postLossCluster,
  fomoEntry,
];

export const TRADING_BLINDSPOT_TEMPLATES: BlindspotTemplate[] = [
  overTrading,
  overLeverage,
  highVolEnv,
  newsTradingEarly,
  planDeviation,
];

export function isAllowedPsychPattern(p: string): p is PsychPattern {
  return (ALLOWED_PSYCH_PATTERNS as readonly string[]).includes(p);
}

export function isAllowedTradingPattern(p: string): p is TradingPattern {
  return (ALLOWED_TRADING_PATTERNS as readonly string[]).includes(p);
}
