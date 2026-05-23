import { emitStep } from "./cognition-emitter.js";

export interface ChatUiQuestion {
  id: string;
  label: string;
  question: string;
  placeholder?: string;
  required?: boolean;
}

export interface ChatUiAnswer {
  id: string;
  label: string;
  value: string;
}

export interface ChatUiQuestionResult {
  status: "answered" | "cancelled" | "expired";
  answers: ChatUiAnswer[];
}

interface PendingQuestionnaire {
  requestId: string;
  resolve: (result: ChatUiQuestionResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingQuestionnaires = new Map<string, PendingQuestionnaire>();
const QUESTION_TIMEOUT_MS = 10 * 60 * 1000;

function makeActionId(): string {
  return `ui-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emitChatUiAction(
  requestId: string,
  action: string,
  payload: Record<string, unknown>,
): void {
  emitStep(requestId, {
    kind: "tool-dispatch",
    label: `chat-ui:${action}`,
    detail: JSON.stringify({ action, ...payload }),
  });
}

export function requestChatUiQuestions(
  requestId: string,
  payload: {
    title?: string;
    summary?: string;
    questions: ChatUiQuestion[];
  },
): Promise<ChatUiQuestionResult> {
  const actionId = makeActionId();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingQuestionnaires.delete(actionId);
      resolve({ status: "expired", answers: [] });
    }, QUESTION_TIMEOUT_MS);

    pendingQuestionnaires.set(actionId, { requestId, resolve, timer });
    emitChatUiAction(requestId, "approval_questions", {
      actionId,
      title: payload.title ?? "Harper needs approval",
      summary: payload.summary,
      questions: payload.questions.slice(0, 6),
    });
  });
}

export function resolveChatUiQuestions(
  actionId: string,
  result: ChatUiQuestionResult,
): { found: boolean } {
  const pending = pendingQuestionnaires.get(actionId);
  if (!pending) return { found: false };

  pendingQuestionnaires.delete(actionId);
  clearTimeout(pending.timer);
  pending.resolve(result);

  emitChatUiAction(pending.requestId, "approval_questions_resolved", {
    actionId,
    status: result.status,
    answerCount: result.answers.length,
  });

  return { found: true };
}
