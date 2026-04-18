// [claude-code 2026-04-19] S25: POST /api/harper/dispatch — "Ask CAO" flow. Creates a new
//   Harper conversation seeded with catalyst/riskflow/brief context, stores the user's first
//   message, returns { conversationId }. The mobile client then opens the Chat tab + loads
//   the conversation; Harper's reply streams via the existing /api/harper/chat SSE path.
//   This route does NOT stream — it's a lightweight "start the session" call.
import { Hono } from "hono";
import { z } from "zod";
import {
  createConversation,
  addMessage,
} from "../../services/ai/conversation-store.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HarperDispatch");

const DispatchBody = z.object({
  source: z.enum(["catalyst", "riskflow", "brief"]),
  sourceId: z.string().min(1).max(120),
  context: z
    .object({
      title: z.string().max(300).optional(),
      summary: z.string().max(1200).optional(),
      severity: z.string().max(24).optional(),
      iv: z.number().optional(),
      sentiment: z.string().max(24).optional(),
      tickers: z.array(z.string().max(16)).max(12).optional(),
      sourceUrl: z.string().max(500).optional(),
    })
    .default({}),
  /** Optional user-authored question appended after the context block. */
  question: z.string().max(500).optional(),
});

function formatSeed(
  source: "catalyst" | "riskflow" | "brief",
  ctx: z.infer<typeof DispatchBody>["context"],
  question?: string,
): string {
  const label =
    source === "catalyst"
      ? "Catalyst"
      : source === "riskflow"
        ? "Headline"
        : "Brief";
  const headline = ctx.title?.trim() || `${label} (no title)`;
  const metaParts: string[] = [];
  if (ctx.severity) metaParts.push(ctx.severity.toUpperCase());
  if (typeof ctx.iv === "number") metaParts.push(`IV ${ctx.iv.toFixed(1)}`);
  if (ctx.sentiment) metaParts.push(ctx.sentiment);
  const meta = metaParts.length ? ` · ${metaParts.join(" · ")}` : "";
  const tickers = ctx.tickers?.length
    ? `\nTickers: ${ctx.tickers.join(", ")}`
    : "";
  const summary = ctx.summary ? `\n\n${ctx.summary.trim()}` : "";
  const ask =
    question?.trim() ||
    "What does this mean for the portfolio — positioning, hedges, and the next 24h?";
  return `${label}${meta}: ${headline}${tickers}${summary}\n\n${ask}`;
}

export function createDispatchRoute() {
  const app = new Hono();

  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = DispatchBody.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid body", issues: parsed.error.flatten() },
        400,
      );
    }
    const { source, sourceId, context, question } = parsed.data;

    const userId = (c.get("userId" as never) as string) || "anonymous";

    const seed = formatSeed(source, context, question);

    try {
      const title = (context.title ?? `${source} dispatch`).slice(0, 60);
      const conversation = await createConversation(userId, {
        title,
        model: "harper-opus",
        metadata: { dispatch: { source, sourceId } },
      });

      await addMessage(conversation.id, {
        conversationId: conversation.id,
        role: "user",
        content: seed,
        model: "harper-opus",
      });

      log.info("dispatch.created", {
        source,
        sourceId,
        conversationId: conversation.id,
        userId,
      });

      return c.json({
        conversationId: conversation.id,
        seedMessage: seed,
      });
    } catch (err) {
      log.error("dispatch.failed", {
        source,
        sourceId,
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "Failed to start dispatch" }, 500);
    }
  });

  return app;
}
