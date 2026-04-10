// [claude-code 2026-03-24] Boardroom UX overhaul — removed hover discoloration, added inline copy, date+time timestamps
// [claude-code 2026-03-26] T3: Rich @mention parsing + "show full analysis" button
import { useState, useCallback } from "react";
import { Copy, Check, Bot } from "lucide-react";
import { AgentBadge, type BoardroomAgent } from "./AgentBadge";
import { AgentMention, EveryoneMention } from "./AgentMention";

export interface BoardroomMessage {
  id: string;
  agent: BoardroomAgent;
  emoji: string;
  content: string;
  timestamp: string;
  role: "user" | "assistant" | "system";
  metadata?: Record<string, unknown>;
}

interface ConsiliumMessageProps {
  message: BoardroomMessage;
  onShowFullAnalysis?: (messageId: string) => void;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${mm}/${dd}/${yy} ${time}`;
  } catch {
    return "";
  }
}

// ─── @Mention Parsing ──────────────────────────────────────────────

const MENTION_TO_AGENT: Record<string, BoardroomAgent> = {
  "harper-opus": "Harper-Opus",
  harper: "Harper-Opus",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

function renderContentWithMentions(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /@(Harper-Opus|Harper|Oracle|Feucht|Consul|Herald|everyone)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const mentionName = match[1].toLowerCase();
    if (mentionName === "everyone") {
      parts.push(<EveryoneMention key={`m-${match.index}`} />);
    } else {
      const agent = MENTION_TO_AGENT[mentionName] || "Unknown";
      parts.push(<AgentMention key={`m-${match.index}`} agent={agent} />);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// ─── Component ─────────────────────────────────────────────────────

export function ConsiliumMessage({
  message,
  onShowFullAnalysis,
}: ConsiliumMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const isHuddle = message.content.startsWith("[HUDDLE TRIGGERED]");
  const isBriefing =
    message.content.startsWith("[PRE-MARKET BRIEF]") ||
    message.content.startsWith("[POST-MARKET BRIEF]");
  const isStandup = message.content.startsWith("[STANDUP]");
  const hasThought = !!message.metadata?.thoughtId;
  // [claude-code 2026-04-05] Detect autonomous Harper messages
  const isAutonomous = !!message.metadata?.autonomous;
  const taskType = isAutonomous
    ? (message.metadata?.taskType as string)?.replace(/-/g, " ").toUpperCase()
    : null;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [message.content]);

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="rounded-full border border-[#c79f4a]/10 bg-[#c79f4a]/5 px-4 py-1.5">
          <span className="text-xs text-[#c79f4a]/50">{message.content}</span>
        </div>
      </div>
    );
  }

  const borderClass = isHuddle
    ? "border-[#c79f4a]/40"
    : isUser
      ? "border-[#c79f4a]/30"
      : "border-[#c79f4a]/15";

  const maxWidth = isBriefing ? "max-w-[90%]" : "max-w-[75%]";

  return (
    <div
      className={`group/msg flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {!isUser && (
        <div className="flex items-center gap-1">
          <AgentBadge
            agent={message.agent}
            size="sm"
            autonomous={isAutonomous}
          />
          {isAutonomous && <Bot size={10} className="text-emerald-400/60" />}
        </div>
      )}
      <div
        className={`flex ${maxWidth} flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
      >
        {isAutonomous && taskType && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/70">
            {taskType}
          </span>
        )}
        {isHuddle && (
          <span className="rounded-full border border-[#c79f4a]/30 bg-[#c79f4a]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c79f4a]">
            Huddle
          </span>
        )}
        {isBriefing && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-400/80">
            {message.content.startsWith("[PRE-MARKET")
              ? "Pre-Market Brief"
              : "Post-Market Brief"}
          </span>
        )}
        <div
          className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${borderClass} ${
            isUser
              ? "bg-[#c79f4a]/10 text-[#f0ead6]"
              : "bg-[#050402] text-[#f0ead6]/90"
          } ${isAutonomous && !isUser ? "border-l-2 border-l-[var(--fintheon-accent)]/30" : ""}`}
        >
          <p
            className={`whitespace-pre-wrap break-words ${isStandup ? "italic" : ""}`}
          >
            {renderContentWithMentions(message.content)}
          </p>
        </div>
        {/* Show full analysis button for messages with thought bank entries */}
        {hasThought && onShowFullAnalysis && (
          <button
            onClick={() => onShowFullAnalysis(message.id)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-[#c79f4a]/50 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
          >
            Show full analysis
          </button>
        )}
        {/* Timestamp + copy — visible on hover */}
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
          <span className="px-1 text-[10px] tabular-nums text-[#f0ead6]/25">
            {formatTimestamp(message.timestamp)}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[#f0ead6]/25 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
        </div>
      </div>
    </div>
  );
}
