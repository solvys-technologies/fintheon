// S38-T2: FintheonThread — decomposed to <300 lines.
// Core scroll container + message map → delegates to extracted primitives.
// Primitives: AssistantMessagePrimitive, UserMessagePrimitive, MessageFooter,
//             CitationChip, ThinkingTrace, AgentActivityRail, BrailleSpinner.
import {
  type FC,
  type ReactNode,
  type RefObject,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { ThreadPrimitive, useThread } from "@assistant-ui/react";
import { AlertCircle, ArrowDown } from "lucide-react";
import { ChatGreeting } from "./ChatGreeting";
import { FintheonThinkingIndicator } from "./FintheonThinkingIndicator";
import { BrailleSpinnerCentered } from "./primitive/BrailleSpinner";
import { useFintheonAgents } from "../../contexts/FintheonAgentContext";
import { CognitionPanel } from "./CognitionPanel";
import { ToolApprovalCard } from "./ToolApprovalCard";
import { useToolApprovals } from "./hooks/useToolApprovals";
import { AssistantMessagePrimitive } from "./AssistantMessagePrimitive";
import { UserMessagePrimitive } from "./UserMessagePrimitive";
import { ChatAnswerStreamWidgets } from "./ChatAnswerStreamWidget";
import type { Citation } from "./CitationChip";
import type { ActivityEntry } from "./AgentActivityRail";
import type { ChatAnswerWidget } from "./hooks/useChatUiActions";

/* ------------------------------------------------------------------ */
/*  Parts helpers (kept here to avoid prop-drilling rawContent)         */
/* ------------------------------------------------------------------ */

function extractText(msg: any): string {
  const parts = msg.content ?? msg.parts ?? [];
  if (!Array.isArray(parts)) return typeof parts === "string" ? parts : "";
  return parts
    .filter((p: any) => p.type === "text" && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("\n\n");
}

function extractRawContent(msg: any): any {
  return msg.parts ?? msg.content;
}

function hasVisibleAssistantText(msg: any): boolean {
  return extractText(msg).trim().length > 0;
}

/* ------------------------------------------------------------------ */
/*  Scroll-to-bottom button                                             */
/* ------------------------------------------------------------------ */

const ScrollToBottomButton: FC<{
  containerRef: RefObject<HTMLElement | null>;
  bottomOffset?: number;
}> = ({ containerRef, bottomOffset = 116 }) => {
  const [showButton, setShowButton] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowButton(!entry.isIntersecting),
      {
        root: containerRef.current,
        threshold: 0.1,
        rootMargin: "80px 0px 0px 0px",
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [containerRef]);

  return (
    <>
      <div ref={sentinelRef} className="h-1 w-full" />
      {showButton && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn fixed left-1/2 z-30 flex -translate-x-1/2 items-center justify-center rounded-full text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
          style={{
            width: "36px",
            height: "36px",
            bottom: `${bottomOffset}px`,
            background:
              "color-mix(in srgb, var(--fintheon-accent) 9%, rgba(5,4,2,0.78))",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 22%, transparent)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  AI Loader — initial hydration spinner                               */
/* ------------------------------------------------------------------ */

export const AiLoader: FC = () => (
  <BrailleSpinnerCentered label="Loading conversation" size={16} />
);

/* ------------------------------------------------------------------ */
/*  Thread                                                              */
/* ------------------------------------------------------------------ */

interface FintheonThreadProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  agentName?: string;
  onTakeNote?: (messageId: string, content: string) => void;
  messageRefs?: RefObject<Record<string, HTMLDivElement | null>>;
  lastError?: string | null;
  lastRequestId?: string | null;
  compact?: boolean;
  hasSubmittedMessage?: boolean;
  /** S38-T2: Activity entries for the agent rail */
  activityEntries?: ActivityEntry[];
  /** S38-T2: Citations from the message */
  citations?: Citation[];
  onPinCitation?: (citation: Citation) => void;
  pinnedCitationIndex?: number;
  scrollButtonOffset?: number;
  composerBottomInset?: number;
  answerWidgets?: ChatAnswerWidget[];
  emptyState?: ReactNode;
}

export function FintheonThread({
  onSend,
  isLoading,
  agentName,
  onTakeNote,
  lastError,
  lastRequestId,
  compact,
  hasSubmittedMessage,
  activityEntries = [],
  citations = [],
  onPinCitation,
  pinnedCitationIndex,
  scrollButtonOffset,
  composerBottomInset = 136,
  answerWidgets = [],
  emptyState,
}: FintheonThreadProps) {
  const { activeAgent } = useFintheonAgents();
  const viewportRef = useRef<HTMLDivElement>(null);
  const { approvals, sendDecision } = useToolApprovals(lastRequestId ?? null);
  const messages = useThread((s) => s.messages);

  const resolvedAgent = agentName ?? activeAgent?.name ?? "Harper";

  return (
    <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0 relative">
      <ThreadPrimitive.Viewport
        ref={viewportRef as any}
        className="flex-1 overflow-y-auto p-6 pb-8"
        style={{ paddingBottom: composerBottomInset }}
      >
        <div className="max-w-full mx-auto space-y-4 mb-8">
          {/* Greeting screen */}
          {messages.length === 0 &&
            !isLoading &&
            !hasSubmittedMessage &&
            emptyState}
          {!emptyState &&
            !compact &&
            messages.length === 0 &&
            !isLoading &&
            !hasSubmittedMessage && (
              <ChatGreeting onSend={onSend} isLoading={isLoading} />
            )}
          {!emptyState &&
            compact &&
            messages.length === 0 &&
            !hasSubmittedMessage && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-sm text-[var(--fintheon-accent)]/60 font-medium">
                  Ave, Trader.
                </p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Quick dispatch from the Forum.
                </p>
              </div>
            )}

          {/* Message list — renders via extracted primitives */}
          {messages.map((msg: any) => {
            if (msg.role === "user") {
              return (
                <UserMessagePrimitive
                  key={msg.id}
                  rawContent={extractRawContent(msg)}
                  createdAt={msg.createdAt as Date | undefined}
                />
              );
            }
            if (msg.role === "assistant") {
              if (!hasVisibleAssistantText(msg)) return null;
              return (
                <AssistantMessagePrimitive
                  key={msg.id}
                  rawContent={extractRawContent(msg)}
                  messageId={msg.id}
                  agentName={resolvedAgent}
                  genTime={msg.createdAt ? new Date(msg.createdAt) : undefined}
                  citations={citations}
                  onPinCitation={onPinCitation}
                  pinnedCitationIndex={pinnedCitationIndex}
                  onTakeNote={onTakeNote}
                  isStreaming={false}
                />
              );
            }
            return null;
          })}

          {/* Thinking indicator */}
          <ThreadPrimitive.If running>
            <div className="flex justify-start items-center">
              <FintheonThinkingIndicator isThinking agentName={resolvedAgent} />
            </div>
          </ThreadPrimitive.If>

          {/* Agent cognition panel */}
          {lastRequestId && !compact && (
            <CognitionPanel requestId={lastRequestId} isStreaming={isLoading} />
          )}

          {/* Tool approval cards */}
          {approvals.map((a) => (
            <ToolApprovalCard
              key={a.approvalId}
              approval={a}
              onApprove={(id) => sendDecision(id, "approved")}
              onDeny={(id) => sendDecision(id, "denied")}
            />
          ))}

          <ChatAnswerStreamWidgets widgets={answerWidgets} />

          {/* Error banner */}
          {lastError && !isLoading && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 animate-fade-slide-in">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-red-300 leading-relaxed">
                  {lastError}
                </p>
              </div>
            </div>
          )}

          <ScrollToBottomButton
            containerRef={viewportRef}
            bottomOffset={scrollButtonOffset}
          />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
