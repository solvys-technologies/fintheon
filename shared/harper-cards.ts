// [claude-code 2026-04-19] S27 skeleton stub. W1a (Claude-02) populates with the 6 Zod card variants + fence contract.
// See docs/sprint-briefs/S27-T1-generative-ui-harper.md §1 for the full spec.
// Do not import from this file outside the S27 worktrees until W1a lands.

import { z } from "zod";

export const CARD_FENCE_OPEN = "<<card>>";
export const CARD_FENCE_CLOSE = "<<endcard>>";

export const CardVariantSchema = z.enum([
  "price-level",
  "probability-table",
  "agent-handoff",
  "risk-flag",
  "backtest-result",
  "narrative-thread",
]);

export const HarperCardSchema = z.object({
  kind: z.literal("fintheon-card"),
  variant: CardVariantSchema,
  id: z.string(),
  data: z.unknown(),
});

export type HarperCard = z.infer<typeof HarperCardSchema>;
export type CardVariant = z.infer<typeof CardVariantSchema>;
