import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import {
  emitChatUiAction,
  requestChatUiQuestions,
} from "../chat-ui-action-store.js";

const issueTypeSchema = z
  .enum(["task", "bug", "feature", "risk", "chore", "issue"])
  .optional();

const questionSchema = z.object({
  id: z.string().min(1).max(48),
  label: z.string().min(1).max(48),
  question: z.string().min(1).max(240),
  placeholder: z.string().max(120).optional(),
  required: z.boolean().optional(),
});

function renderAnswers(
  result: Awaited<ReturnType<typeof requestChatUiQuestions>>,
): string {
  if (result.status !== "answered") {
    return `Question request ${result.status}. Continue with stated assumptions.`;
  }
  return result.answers
    .map((answer) => `${answer.label}: ${answer.value || "(blank)"}`)
    .join("\n");
}

export function createChatUiTools(requestId: string) {
  return [
    tool({
      name: "open_todo_drawer",
      description:
        "Open the Fintheon chat to-do drawer and add visible issue-tracked work items. Use this when making or demoing an execution plan.",
      inputSchema: z.object({
        title: z.string().max(80).optional(),
        items: z
          .array(
            z.object({
              text: z.string().min(1).max(180),
              issueType: issueTypeSchema.describe(
                "Issue tracking type symbol to show in the drawer",
              ),
              priority: z.string().max(32).optional(),
            }),
          )
          .min(1)
          .max(8),
      }),
      callback: async (input) => {
        emitChatUiAction(requestId, "open_todo_drawer", input);
        return `Opened the to-do drawer with ${input.items.length} issue-tracked item(s).`;
      },
    }),

    tool({
      name: "open_right_rail",
      description:
        "Open the Fintheon chat right rail with a markdown plan, canvas note, or browser/workbench brief.",
      inputSchema: z.object({
        title: z.string().min(1).max(80),
        surface: z.enum(["plan", "canvas", "browser", "report"]).optional(),
        markdown: z.string().min(1).max(6000),
        append: z.boolean().optional(),
      }),
      callback: async (input) => {
        emitChatUiAction(requestId, "open_right_rail", input);
        return `Opened the right rail: ${input.title}.`;
      },
    }),

    tool({
      name: "ask_approval_questions",
      description:
        "Ask TP a short set of approval questions in the chat composer drawer. The tool waits for answers, then returns them so Harper can continue.",
      inputSchema: z.object({
        title: z.string().min(1).max(80).optional(),
        summary: z.string().max(240).optional(),
        questions: z.array(questionSchema).min(1).max(6),
      }),
      callback: async (input) => {
        const result = await requestChatUiQuestions(requestId, input);
        return renderAnswers(result);
      },
    }),
  ];
}
