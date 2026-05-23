import { Hono } from "hono";
import {
  resolveChatUiQuestions,
  type ChatUiAnswer,
  type ChatUiQuestionResult,
} from "../../services/chat-ui-action-store.js";

interface AnswerBody {
  status?: "answered" | "cancelled";
  answers?: ChatUiAnswer[];
}

export function createHarperUiActionRoutes() {
  const app = new Hono();

  app.post("/:actionId/answer", async (c) => {
    const actionId = c.req.param("actionId");
    const body = (await c.req.json<AnswerBody>().catch(() => ({}))) as
      | AnswerBody
      | undefined;
    const status = body?.status ?? "answered";
    const answers = Array.isArray(body?.answers) ? body.answers : [];
    const result: ChatUiQuestionResult = { status, answers };
    const resolved = resolveChatUiQuestions(actionId, result);

    if (!resolved.found) {
      return c.json({ error: "Question request not found" }, 404);
    }

    return c.json({ ok: true, status, answerCount: answers.length });
  });

  return app;
}
