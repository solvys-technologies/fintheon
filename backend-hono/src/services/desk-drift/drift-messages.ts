// [claude-code 2026-04-26] S45-T1: drift-message flavors. Three flavors,
// gated by PsychAssist resonance + intraday P&L:
//   drift_alert    — outside window, ER healthy / P&L flat
//   tilt_stop      — outside window AND ER unhealthy (lockout-eligible)
//   dead_volume    — inside dead-volume zone (after last window + 45 min)

import type { DriftKind } from "../../types/day-plan.js";

export interface DriftMessageContext {
  kind: DriftKind;
  contract: string;
  fillEt: Date;
  intradayPnl: number;
  resonanceHealthy: boolean;
  deskTheme: string | null;
}

export function pickDriftMessage(ctx: DriftMessageContext): string {
  const fillLabel = formatHHMM(ctx.fillEt);
  const themeFragment = ctx.deskTheme ? ` Today's theme: ${ctx.deskTheme}` : "";

  if (ctx.kind === "tilt_stop") {
    return `Tilt-stop: ${ctx.contract} fill at ${fillLabel} ET is outside the desk window with ER unhealthy. Step away.${themeFragment}`;
  }

  if (ctx.kind === "dead_volume") {
    if (ctx.intradayPnl >= 0 && ctx.resonanceHealthy) {
      return `Dead-volume warning: ${ctx.contract} fill at ${fillLabel} ET is past the desk window. You're green; protect it.${themeFragment}`;
    }
    return `Dead-volume zone: ${ctx.contract} fill at ${fillLabel} ET is past the desk window. No edge here.${themeFragment}`;
  }

  // drift_alert
  if (!ctx.resonanceHealthy) {
    return `Drift alert: ${ctx.contract} fill at ${fillLabel} ET breaks the desk window while ER is fragile. Re-anchor.${themeFragment}`;
  }
  return `Drift alert: ${ctx.contract} fill at ${fillLabel} ET sits outside the desk window.${themeFragment}`;
}

function formatHHMM(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
