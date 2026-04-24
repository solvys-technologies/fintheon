// [claude-code 2026-04-23] S32-T7: Passive position-size suggestion — deterministic,
// no LLM. Surfaced on order ticket open; user decides. Never enforced.

export interface SizeSuggestionInput {
  contract: string;
  proposedSize: number;
  defaultSize?: number;
  accountBalance?: number;
  previousOpenBalance?: number;
  recentPnl?: number[];
}

export interface SizeSuggestion {
  suggestedSize: number;
  reasoning: string;
}

function countTrailingLosses(pnl: number[] | undefined, depth: number): number {
  if (!pnl || pnl.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < Math.min(depth, pnl.length); i++) {
    if (pnl[i] < 0) count += 1;
    else break;
  }
  return count;
}

export function suggestSize(input: SizeSuggestionInput): SizeSuggestion {
  const defaultSize = input.defaultSize ?? input.proposedSize;
  const proposed = Math.max(1, Math.round(input.proposedSize));

  const trailingLosses = countTrailingLosses(input.recentPnl, 3);
  if (trailingLosses >= 3) {
    const suggested = Math.max(1, Math.floor(defaultSize * 0.5));
    return {
      suggestedSize: Math.min(suggested, proposed),
      reasoning:
        "Last 3 trades were losses — halving default size for the next entry.",
    };
  }

  if (
    typeof input.accountBalance === "number" &&
    typeof input.previousOpenBalance === "number" &&
    input.previousOpenBalance > 0 &&
    input.accountBalance < input.previousOpenBalance * 0.8
  ) {
    const suggested = Math.max(1, Math.floor(defaultSize * 0.75));
    return {
      suggestedSize: Math.min(suggested, proposed),
      reasoning: "Account down >20% from yesterday's open — sizing at 75%.",
    };
  }

  return {
    suggestedSize: proposed,
    reasoning: "No drawdown flags — proposed size is appropriate.",
  };
}
