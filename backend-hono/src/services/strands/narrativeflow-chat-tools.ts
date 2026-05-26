import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import {
  emitChatUiAction,
  requestChatUiQuestions,
} from "../chat-ui-action-store.js";

const surfaceSchema = z.enum([
  "workspace",
  "forecasts",
  "coliseum",
  "resolved",
  "map",
]);

const dataKindSchema = z.enum([
  "session",
  "catalysts",
  "flow",
  "timeline",
  "docs",
  "forecast",
  "desk_map",
  "coliseum",
  "resolved",
  "runbook",
]);

const editTypeSchema = z.enum([
  "workspace_title",
  "workspace_summary",
  "workspace_docs",
  "workspace_flow",
  "workspace_timeline",
  "deskmap_note",
  "forecast_draft",
  "resolved_note",
]);

const editSurfaceSchema = z.enum(["workspace", "forecasts", "resolved", "map"]);

const patchSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => Object.keys(value).length > 0,
    "Patch must include at least one field.",
  );

function makeOperationId(): string {
  return `nf-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasApprovalAnswer(
  result: Awaited<ReturnType<typeof requestChatUiQuestions>>,
): boolean {
  if (result.status !== "answered") return false;
  return result.answers.some((answer) =>
    /\b(approve|approved|yes|go|ship|apply|do it)\b/i.test(answer.value),
  );
}

export function createNarrativeFlowChatTools(requestId: string) {
  return [
    tool({
      name: "narrativeflow_open_surface",
      description:
        "Open a NarrativeFlow surface for TP. Use this before discussing, editing, or demoing Workspace, Forecasts, Coliseum, Resolved, or DeskMap.",
      inputSchema: z.object({
        surface: surfaceSchema,
        sessionId: z.string().max(96).optional(),
        focus: z.string().max(120).optional(),
      }),
      callback: async (input) => {
        emitChatUiAction(requestId, "narrativeflow_open_surface", input);
        return `Opened NarrativeFlow ${input.surface}.`;
      },
    }),

    tool({
      name: "narrativeflow_show_internal_data",
      description:
        "Display NarrativeFlow internal state in the workspace/right rail: sessions, catalysts, Flow, Timeline, Docs, Forecasts, DeskMap, or runbook context.",
      inputSchema: z.object({
        title: z.string().min(1).max(80),
        surface: surfaceSchema.optional(),
        dataKind: dataKindSchema,
        markdown: z.string().min(1).max(10000),
        payload: z.record(z.string(), z.unknown()).optional(),
        append: z.boolean().optional(),
      }),
      callback: async (input) => {
        emitChatUiAction(requestId, "narrativeflow_show_internal_data", input);
        return `Displayed NarrativeFlow ${input.dataKind} data.`;
      },
    }),

    tool({
      name: "narrativeflow_stage_edit",
      description:
        "Stage a NarrativeFlow write. This always opens an approval modal first; the edit is applied only if TP types an approval answer.",
      inputSchema: z.object({
        surface: editSurfaceSchema,
        editType: editTypeSchema,
        targetId: z.string().max(96).optional(),
        previewMarkdown: z.string().min(1).max(8000),
        patch: patchSchema,
        rationale: z.string().min(1).max(500),
      }),
      callback: async (input) => {
        const operationId = makeOperationId();
        const payload = { ...input, operationId, requiresApproval: true };
        emitChatUiAction(requestId, "narrativeflow_stage_edit", payload);

        const result = await requestChatUiQuestions(requestId, {
          title: "Approve NarrativeFlow edit",
          summary: input.rationale,
          questions: [
            {
              id: "approval",
              label: "Approval",
              question:
                "Type APPROVE to apply this NarrativeFlow edit, or describe what should change first.",
              placeholder: "APPROVE",
              required: true,
            },
          ],
        });

        if (!hasApprovalAnswer(result)) {
          return "NarrativeFlow edit was not approved. Leave the staged draft visible and continue from TP feedback.";
        }

        emitChatUiAction(requestId, "narrativeflow_apply_approved_edit", {
          ...payload,
          approvalActionId: result.actionId,
          approvedAt: new Date().toISOString(),
        });
        return `Applied approved NarrativeFlow ${input.editType} edit.`;
      },
    }),
  ];
}
