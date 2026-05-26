import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../constants.js";
import type { IssueTrackingType } from "./useTodoList";

export interface ChatUiTodoItem {
  text: string;
  issueType?: IssueTrackingType;
  priority?: string;
}

export interface ChatUiRightRailPayload {
  title: string;
  surface?:
    | "plan"
    | "canvas"
    | "browser"
    | "report"
    | "narrativeflow"
    | "narrativeflow-data"
    | "narrativeflow-edit";
  markdown: string;
  append?: boolean;
}

export type NarrativeFlowUiAction =
  | "narrativeflow_open_surface"
  | "narrativeflow_show_internal_data"
  | "narrativeflow_stage_edit"
  | "narrativeflow_apply_approved_edit";

export interface NarrativeFlowUiActionPayload {
  action: NarrativeFlowUiAction;
  surface?: "workspace" | "forecasts" | "coliseum" | "resolved" | "map";
  dataKind?: string;
  editType?: string;
  sessionId?: string;
  targetId?: string;
  operationId?: string;
  title?: string;
  markdown?: string;
  previewMarkdown?: string;
  patch?: Record<string, unknown>;
  append?: boolean;
}

export interface ChatUiQuestion {
  id: string;
  label: string;
  question: string;
  placeholder?: string;
  required?: boolean;
}

export interface ChatUiQuestionnaire {
  actionId: string;
  title: string;
  summary?: string;
  questions: ChatUiQuestion[];
}

export interface ChatUiAnswer {
  id: string;
  label: string;
  value: string;
}

export interface ChatAnswerWidget {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
}

interface UseChatUiActionsOptions {
  onTodoDrawer?: (payload: { title?: string; items: ChatUiTodoItem[] }) => void;
  onRightRail?: (payload: ChatUiRightRailPayload) => void;
  onNarrativeFlowAction?: (payload: NarrativeFlowUiActionPayload) => void;
}

interface CognitionStep {
  kind?: string;
  label?: string;
  detail?: string;
  ts?: number;
}

function answersToMarkdown(
  questionnaire: ChatUiQuestionnaire,
  answers: ChatUiAnswer[],
): string {
  const lines = [`### ${questionnaire.title}`, ""];
  for (const answer of answers) {
    lines.push(`**${answer.label}**`);
    lines.push(answer.value || "_No answer provided._");
    lines.push("");
  }
  return lines.join("\n");
}

function isNarrativeFlowAction(
  action: string | undefined,
): action is NarrativeFlowUiAction {
  return (
    action === "narrativeflow_open_surface" ||
    action === "narrativeflow_show_internal_data" ||
    action === "narrativeflow_stage_edit" ||
    action === "narrativeflow_apply_approved_edit"
  );
}

function dispatchNarrativeFlowAction(payload: NarrativeFlowUiActionPayload) {
  window.dispatchEvent(
    new CustomEvent("fintheon:narrative-agent-action", {
      detail: payload,
    }),
  );
  if (payload.action === "narrativeflow_open_surface" && payload.surface) {
    window.dispatchEvent(
      new CustomEvent("fintheon:narrative-surface-change", {
        detail: {
          mode: payload.surface,
          sessionId: payload.sessionId ?? payload.targetId,
        },
      }),
    );
  }
}

export function useChatUiActions(
  requestId: string | null,
  options: UseChatUiActionsOptions,
) {
  const { onNarrativeFlowAction, onRightRail, onTodoDrawer } = options;
  const [questionnaire, setQuestionnaire] =
    useState<ChatUiQuestionnaire | null>(null);
  const [answerWidgets, setAnswerWidgets] = useState<ChatAnswerWidget[]>([]);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const seenStepKeysRef = useRef<Set<string>>(new Set());

  const handleStep = useCallback(
    (step: CognitionStep) => {
      try {
        if (step.kind !== "tool-dispatch" || !step.detail) return;
        const detail = JSON.parse(step.detail);
        const action =
          typeof detail.action === "string" ? detail.action : undefined;
        if (!step.label?.startsWith("chat-ui:") && !action) return;

        const stepKey = `${step.ts ?? "na"}:${step.label ?? ""}:${action ?? ""}`;
        if (seenStepKeysRef.current.has(stepKey)) return;
        seenStepKeysRef.current.add(stepKey);

        if (action === "open_todo_drawer") {
          onTodoDrawer?.({
            title: detail.title,
            items: Array.isArray(detail.items) ? detail.items : [],
          });
        }
        if (action === "open_right_rail") {
          onRightRail?.(detail);
        }
        if (isNarrativeFlowAction(action)) {
          const payload = {
            ...(detail as Record<string, unknown>),
            action,
          } as NarrativeFlowUiActionPayload;
          onNarrativeFlowAction?.(payload);
          dispatchNarrativeFlowAction(payload);
          if (action === "narrativeflow_show_internal_data") {
            onRightRail?.({
              title: String(detail.title ?? "NarrativeFlow Internal Data"),
              surface: "narrativeflow-data",
              markdown: String(detail.markdown ?? ""),
              append: Boolean(detail.append),
            });
          }
          if (action === "narrativeflow_stage_edit") {
            onRightRail?.({
              title: "Staged NarrativeFlow Edit",
              surface: "narrativeflow-edit",
              markdown: String(detail.previewMarkdown ?? ""),
            });
          }
        }
        if (action === "approval_questions") {
          setQuestionnaire({
            actionId: String(detail.actionId),
            title: String(detail.title ?? "Harper needs approval"),
            summary:
              typeof detail.summary === "string" ? detail.summary : undefined,
            questions: Array.isArray(detail.questions) ? detail.questions : [],
          });
        }
      } catch {
        /* ignore malformed stream payload */
      }
    },
    [onNarrativeFlowAction, onRightRail, onTodoDrawer],
  );

  useEffect(() => {
    if (!requestId) {
      setQuestionnaire(null);
      setAnswerWidgets([]);
      seenStepKeysRef.current.clear();
      return;
    }

    seenStepKeysRef.current.clear();
    const es = new EventSource(
      `${API_BASE_URL}/api/ai/cognition/stream?requestId=${encodeURIComponent(requestId)}`,
    );

    es.addEventListener("step", (event) => {
      try {
        handleStep(JSON.parse(event.data) as CognitionStep);
      } catch {
        /* ignore malformed stream payload */
      }
    });

    const onWindowStep = (event: Event) => {
      const detail = (
        event as CustomEvent<{ requestId?: string; step?: CognitionStep }>
      ).detail;
      if (detail?.requestId !== requestId || !detail.step) return;
      handleStep(detail.step);
    };
    window.addEventListener("fintheon:cognition-step", onWindowStep);

    es.addEventListener("done", () => es.close());
    es.onerror = () => es.close();
    return () => {
      es.close();
      window.removeEventListener("fintheon:cognition-step", onWindowStep);
    };
  }, [requestId, handleStep]);

  const resolveQuestionnaire = useCallback(
    async (status: "answered" | "cancelled", answers: ChatUiAnswer[]) => {
      if (!questionnaire) return;
      setIsSubmittingAnswers(true);
      try {
        await fetch(
          `${API_BASE_URL}/api/harper/ui-actions/${encodeURIComponent(questionnaire.actionId)}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, answers }),
          },
        );
        if (status === "answered") {
          setAnswerWidgets((current) => [
            ...current,
            {
              id: questionnaire.actionId,
              title: questionnaire.title,
              markdown: answersToMarkdown(questionnaire, answers),
              createdAt: Date.now(),
            },
          ]);
        }
        setQuestionnaire(null);
      } finally {
        setIsSubmittingAnswers(false);
      }
    },
    [questionnaire],
  );

  return {
    questionnaire,
    answerWidgets,
    isSubmittingAnswers,
    submitAnswers: (answers: ChatUiAnswer[]) =>
      resolveQuestionnaire("answered", answers),
    cancelQuestions: () => resolveQuestionnaire("cancelled", []),
  };
}
