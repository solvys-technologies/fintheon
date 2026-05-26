import { buildResponse, mockHeadlines, sessionDetails } from "./mock-data";

export interface CognitionStep {
  kind: string;
  label: string;
  detail: string;
  ts: number;
}

interface PendingEdit {
  requestId: string;
  workspaceId: string | null;
  payload: Record<string, unknown>;
}

const pendingEdits = new Map<string, PendingEdit>();

export function buildCognitionSteps(input: {
  requestId: string;
  workspaceId: string | null;
  workspaceTitle: string;
}): CognitionStep[] {
  const now = Date.now();
  const approvalActionId = `sandbox-question-${now.toString(36)}`;
  const operationId = `sandbox-edit-${now.toString(36)}`;
  const editPayload = buildWorkspaceEditPayload({
    operationId,
    workspaceId: input.workspaceId,
  });
  pendingEdits.set(approvalActionId, {
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    payload: editPayload,
  });
  return [
    step(now, "open_todo_drawer", {
      title: "NarrativeFlow launch queue",
      items: [
        { text: "Anchor Energy & Infrastructure Crisis thesis", issueType: "task", priority: "P0" },
        { text: "Separate grid-capex, load-growth, and policy catalysts", issueType: "feature", priority: "P0" },
        { text: "Pressure-test second-order market impacts", issueType: "risk", priority: "P1" },
      ],
    }),
    step(now + 1, "open_right_rail", {
      title: "NarrativeFlow Plan Mode",
      surface: "plan",
      markdown: planModeMarkdown(input.workspaceTitle, input.workspaceId),
    }),
    step(now + 2, "narrativeflow_open_surface", {
      surface: "workspace",
      sessionId: input.workspaceId,
    }),
    step(now + 3, "narrativeflow_show_internal_data", {
      title: "NarrativeFlow Internal Data",
      surface: "workspace",
      dataKind: "catalysts",
      markdown: internalDataMarkdown(input.workspaceTitle, input.workspaceId),
    }),
    step(now + 4, "narrativeflow_stage_edit", editPayload),
    step(now + 5, "approval_questions", {
      actionId: approvalActionId,
      title: "Approve NarrativeFlow edit",
      summary: "Apply Harper's Energy & Infrastructure Crisis workspace edit.",
      questions: [
        {
          id: "approval",
          label: "Approval",
          question: "Type APPROVE to apply this NarrativeFlow edit, or describe changes.",
          placeholder: "APPROVE",
          required: true,
        },
      ],
    }),
  ];
}

export function resolveMockNarrativeApproval(
  actionId: string,
  body: Record<string, unknown> | null,
) {
  const pending = pendingEdits.get(actionId);
  if (!pending) return { ok: false, status: 404 };
  pendingEdits.delete(actionId);
  if (!isApproved(body)) return { ok: true, status: 200 };
  const title = applyNarrativeWorkspaceEdit(pending.workspaceId);
  dispatchApprovedEdit(pending.requestId, actionId, pending.payload);
  return { ok: true, status: 200, title };
}

export function buildAssistantText(input: { workspaceTitle: string }) {
  return [
    `I staged an approved-write edit for **${input.workspaceTitle}** instead of mutating the workspace silently.`,
    "I opened Plan Mode, queued the visible work, surfaced internal catalyst data, and asked for approval before applying the edit.",
    "For the Energy & Infrastructure Crisis, I am tracking three lanes: grid bottlenecks, power-demand shock, and financing/permitting stress.",
  ].join("\n\n");
}

function buildWorkspaceEditPayload(input: {
  operationId: string;
  workspaceId: string | null;
}) {
  return {
    operationId: input.operationId,
    surface: "workspace",
    editType: "workspace_title",
    targetId: input.workspaceId,
    previewMarkdown:
      "## Proposed NarrativeFlow edit\n\nRename the active workspace to **Energy & Infrastructure Crisis — Grid Bottleneck Thesis** and refresh the session artifacts around grid reserve pressure, AI load, transformer shortages, and financing stress.",
    patch: {
      title: "Energy & Infrastructure Crisis — Grid Bottleneck Thesis",
      color: "#c79f4a",
    },
    rationale:
      "Energy and infrastructure catalysts are clustering around one tradable grid-bottleneck thesis.",
    requiresApproval: true,
  };
}

function applyNarrativeWorkspaceEdit(sessionId: string | null) {
  if (!sessionId || !sessionDetails[sessionId]) return null;
  const detail = sessionDetails[sessionId];
  const previousTitle = String(detail.title ?? "");
  const response = buildResponse(["rf-grid", "rf-ai-load", "rf-transformers"]);
  const title = "Energy & Infrastructure Crisis — Grid Bottleneck Thesis";
  detail.title = title;
  detail.color = "#c79f4a";
  detail.generatedAt = response.generatedAt;
  detail.updatedAt = new Date().toISOString();
  detail.updated_at = detail.updatedAt;
  detail.catalyst_count = response.anchorCatalysts.length;
  detail.catalysts = response.anchorCatalysts.map((item) => ({ riskflow_item_id: item.id }));
  detail.artifacts = {
    flow: { payload: response },
    timeline: { payload: { nodes: response.timelineNodes, edges: response.timelineEdges } },
    docs: { payload: { summary: response.synthesisSummary, forecast: response.forecast, links: [] } },
  };
  detail.work_events = [
    ...(detail.work_events ?? []),
    {
      id: `${sessionId}-sandbox-edit-${Date.now()}`,
      agent: "Harper",
      summary: "Applied approved Energy & Infrastructure Crisis edit.",
      status: "complete",
      created_at: new Date().toISOString(),
    },
  ];
  window.requestAnimationFrame(() => syncVisibleTitle(title));
  window.setTimeout(() => reopenVisibleSession(previousTitle), 80);
  return title;
}

function dispatchApprovedEdit(
  requestId: string,
  approvalActionId: string,
  payload: Record<string, unknown>,
) {
  window.dispatchEvent(
    new CustomEvent("fintheon:cognition-step", {
      detail: {
        requestId,
        step: step(Date.now(), "narrativeflow_apply_approved_edit", {
          ...payload,
          approvalActionId,
          approvedAt: new Date().toISOString(),
        }),
      },
    }),
  );
}

function internalDataMarkdown(workspaceTitle: string, workspaceId: string | null) {
  return `Active workspace: **${workspaceTitle}**\n\nAttached catalyst reads:\n${getWorkspaceCatalystLines(workspaceId)}\n\nAvailable agent UI tools: to-do drawer, approval questions, right rail reports, all NarrativeFlow surfaces, and approval-gated workspace edits.`;
}

function planModeMarkdown(workspaceTitle: string, workspaceId: string | null) {
  return `## Plan Mode\n\n**Workspace:** ${workspaceTitle}\n\n1. Anchor the thesis around grid reserve pressure, AI load growth, transformer scarcity, and financing stress.\n2. Separate confirmation evidence from invalidation evidence before editing the workspace.\n3. Keep the approval gate open for the proposed title/artifact change.\n\nCatalyst focus:\n${getWorkspaceCatalystLines(workspaceId)}`;
}

function getWorkspaceCatalystLines(sessionId: string | null) {
  const detail = sessionId ? sessionDetails[sessionId] : null;
  const ids = detail?.catalysts?.map((item: { riskflow_item_id: string }) => item.riskflow_item_id) ?? [];
  const catalysts: string[] = ids.length ? ids : ["rf-grid", "rf-ai-load", "rf-transformers"];
  return catalysts
    .map((id: string) => mockHeadlines.find((item) => item.id === id)?.headline)
    .filter((headline: string | undefined): headline is string => Boolean(headline))
    .map((headline: string) => `- ${headline}`)
    .join("\n");
}

function isApproved(body: Record<string, unknown> | null) {
  if (body?.status !== "answered") return false;
  if (!Array.isArray(body.answers)) return false;
  return body.answers.some((answer) => /\bapprove\b/i.test(String(answer?.value ?? "")));
}

function syncVisibleTitle(title: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Narrative title"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!input || !setter) return;
  setter.call(input, title);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

function reopenVisibleSession(previousTitle: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const sessionButton = buttons.find((button) => button.textContent?.includes(previousTitle));
  sessionButton?.click();
}

function step(ts: number, action: string, payload: Record<string, unknown>): CognitionStep {
  return {
    kind: "tool-dispatch",
    label: `chat-ui:${action}`,
    detail: JSON.stringify({ action, ...payload }),
    ts,
  };
}
