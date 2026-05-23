// [codex 2026-05-23] Shared chat reasoning-level contract.
export type ReasoningLevel = "quick" | "standard" | "deep" | "max";

export interface ReasoningLevelDef {
  id: ReasoningLevel;
  label: string;
  shortLabel: string;
  description: string;
  budget: string;
}

export const REASONING_LEVELS: ReasoningLevelDef[] = [
  {
    id: "quick",
    label: "Quick",
    shortLabel: "Q",
    description: "Fast answer, minimal inspection.",
    budget: "1-2 turns",
  },
  {
    id: "standard",
    label: "Standard",
    shortLabel: "S",
    description: "Balanced context and tool use.",
    budget: "3 turns",
  },
  {
    id: "deep",
    label: "Deep",
    shortLabel: "D",
    description: "Broader context and stronger verification.",
    budget: "5 turns",
  },
  {
    id: "max",
    label: "Max",
    shortLabel: "M",
    description: "Exhaustive inspection for high-stakes work.",
    budget: "7 turns",
  },
];

export function normalizeReasoningLevel(value: unknown): ReasoningLevel {
  if (
    value === "quick" ||
    value === "standard" ||
    value === "deep" ||
    value === "max"
  ) {
    return value;
  }
  return "standard";
}

export function shouldThinkHarder(level: ReasoningLevel): boolean {
  return level === "deep" || level === "max";
}
