// [Codex 2026-05-27] Manual Arbitrum deliberate handler with run presets.
import type { Context } from "hono";
import { createLogger } from "../../lib/logger.js";
import {
  buildArbitrumPresetContext,
  normalizeArbitrumRunPresetIds,
  runChamber,
} from "../../services/arbitrum/index.js";

const log = createLogger("ArbitrumDeliberateRoute");

export async function handleDeliberate(c: Context) {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const question = typeof body.question === "string" ? body.question : "";
  const category = typeof body.category === "string" ? body.category : "custom";
  const context = typeof body.context === "string" ? body.context : undefined;
  const rounds = typeof body.rounds === "number" ? body.rounds : undefined;
  const presetIds =
    body.preset_ids === undefined
      ? normalizeArbitrumRunPresetIds(["roro"])
      : normalizeArbitrumRunPresetIds(body.preset_ids);
  const presetContext = buildArbitrumPresetContext(presetIds);
  const combinedContext = [presetContext, context]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n\n");

  if (question.trim().length === 0)
    return c.json({ error: "question is required" }, 400);

  try {
    const result = await runChamber(
      {
        question,
        category,
        context: combinedContext || undefined,
      },
      "manual",
      {
        rounds,
        triggerSource: presetIds.length > 0 ? { preset_ids: presetIds } : null,
      },
    );
    return c.json({
      verdict_id: result.verdict.verdict_id,
      persisted: result.persisted,
      consensus_probability: result.verdict.consensus_probability,
      confidence: result.verdict.confidence,
      dissent: result.verdict.dissent,
      digest_text: result.verdict.digest_text,
      preset_ids: presetIds,
    });
  } catch (err) {
    log.error("runChamber failed on /deliberate", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "chamber invocation failed" }, 500);
  }
}
