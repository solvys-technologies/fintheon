// [claude-code 2026-03-22] Source of Truth fusion — commandment-aware context injection

/**
 * Generates contextual commandment gates based on current trading state.
 * These are injected into agent prompts when relevant context is available.
 */
export function getCommandmentGates(context: {
  timeEST?: string;
  morningRoutineDone?: boolean;
  consecutiveLosses?: number;
  lastBigWinWithin48h?: boolean;
  holdingLosingPosition?: boolean;
  currentPnL?: number;
}): string {
  const gates: string[] = [];

  // HARD BLOCK: Commandment 14 — morning routine
  if (context.morningRoutineDone === false) {
    gates.push(
      "[HARD BLOCK C14] Morning routine not completed. No trading until routine is verified.",
    );
  }

  // HARD BLOCK: 11:30 AM circuit breaker
  if (context.timeEST) {
    const [h, m] = context.timeEST.split(":").map(Number);
    if (h > 11 || (h === 11 && m >= 30)) {
      gates.push(
        "[HARD BLOCK] 11:30 AM EST circuit breaker active. No new trades.",
      );
    }
  }

  // HARD BLOCK: Commandment 7 — no doubling down
  if (context.holdingLosingPosition) {
    gates.push(
      "[HARD BLOCK C7] Holding a losing position. Do NOT add to this position. Cut and reassess.",
    );
  }

  // SOFT: Commandment 6 — anti-revenge after losses
  if (context.consecutiveLosses && context.consecutiveLosses >= 2) {
    gates.push(
      `[WARNING C6] ${context.consecutiveLosses} consecutive losses detected. "You never need to make back losses the same way you lost them." Consider a different instrument or direction.`,
    );
  }

  // SOFT: Hot hand — 48h overconfidence flag
  if (context.lastBigWinWithin48h) {
    gates.push(
      "[WARNING C4] Hot hand flag active (48h window after $5K+ win). Verify thesis quality. Enforce standard sizing. Remember the BOJ pattern: $20K win, gave back half next day.",
    );
  }

  // SOFT: Loss streak lockout awareness
  if (context.consecutiveLosses && context.consecutiveLosses >= 3) {
    gates.push(
      "[ESCALATION] 3+ consecutive losses. Soft lockout should be triggered. Recommend stopping and running debrief before next trade.",
    );
  }

  if (gates.length === 0) return "";
  return "\n\n## Active Commandment Gates\n" + gates.join("\n");
}
