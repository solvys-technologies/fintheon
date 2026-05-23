import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { ChatCitationIcon } from "../icon-bank/ChatCitationIcon";
import { RepoChatComposerSurface } from "./composer/RepoChatComposer";
import type {
  ChatUiAnswer,
  ChatUiQuestionnaire,
} from "./hooks/useChatUiActions";

interface ChatQuestionApprovalDrawerProps {
  questionnaire: ChatUiQuestionnaire | null;
  isSubmitting?: boolean;
  onSubmit: (answers: ChatUiAnswer[]) => void;
  onCancel: () => void;
}

export function ChatQuestionApprovalDrawer({
  questionnaire,
  isSubmitting,
  onSubmit,
  onCancel,
}: ChatQuestionApprovalDrawerProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setIndex(0);
    setAnswers({});
  }, [questionnaire?.actionId]);

  const question = questionnaire?.questions[index];
  const total = questionnaire?.questions.length ?? 0;
  const canGoBack = index > 0;
  const canGoNext = index < total - 1;
  const currentValue = question ? answers[question.id] ?? "" : "";
  const isRequiredMissing = !!question?.required && !currentValue.trim();
  const compiledAnswers = useMemo(() => {
    if (!questionnaire) return [];
    return questionnaire.questions.map((item) => ({
      id: item.id,
      label: item.label,
      value: answers[item.id] ?? "",
    }));
  }, [answers, questionnaire]);

  return (
    <RepoChatComposerSurface
      open={!!questionnaire}
      maxHeight="360px"
      role="dialog"
      aria-label={questionnaire?.title ?? "Harper approval questions"}
    >
      {questionnaire && question && (
        <div className="p-3">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--fintheon-accent)]/10 pb-3">
            <div className="flex min-w-0 items-start gap-2">
              <ChatCitationIcon kind="approval" size={30} title="Approval" />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
                  {questionnaire.title}
                </p>
                {questionnaire.summary && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-text)]/52">
                    {questionnaire.summary}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-[var(--fintheon-text)]/32 transition-colors hover:text-[var(--fintheon-text)]/70"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/36">
                {question.label}
              </span>
              <span className="font-mono text-[10px] text-[var(--fintheon-accent)]/64">
                {index + 1}/{total}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-[var(--fintheon-text)]/84">
              {question.question}
            </p>
            <textarea
              value={currentValue}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question.id]: event.target.value,
                }))
              }
              placeholder={question.placeholder ?? "Answer..."}
              className="mt-3 min-h-[76px] w-full resize-none rounded-md border border-[var(--fintheon-accent)]/14 bg-[#080705] px-3 py-2 text-[12px] leading-5 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-text)]/28 focus:border-[var(--fintheon-accent)]/36"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--fintheon-accent)]/10 pt-3">
            <button
              type="button"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={!canGoBack || isSubmitting}
              className="flex items-center gap-1 rounded-md border border-[var(--fintheon-accent)]/16 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-text)]/52 disabled:opacity-35"
            >
              <ChevronLeft size={12} />
              Back
            </button>
            {canGoNext ? (
              <button
                type="button"
                onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
                disabled={isRequiredMissing || isSubmitting}
                className="flex items-center gap-1 rounded-md border border-[var(--fintheon-accent)]/26 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)] disabled:opacity-35"
              >
                Next
                <ChevronRight size={12} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSubmit(compiledAnswers)}
                disabled={isRequiredMissing || isSubmitting}
                className="flex items-center gap-1 rounded-md bg-[var(--fintheon-accent)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#050402] disabled:opacity-45"
              >
                <Check size={12} />
                {isSubmitting ? "Saving" : "Submit"}
              </button>
            )}
          </div>
        </div>
      )}
    </RepoChatComposerSurface>
  );
}
