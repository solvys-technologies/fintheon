import {
  ChevronDown,
  Edit3,
  Inbox,
  MessageSquareText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchNarrativeChatThreads,
  type NarrativeChatThread,
} from "../../lib/narrative-chat-history";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";

interface NarrativeSessionDrawerRowProps {
  session: NarrativeSessionSummary;
  isActive: boolean;
  isExpanded: boolean;
  onOpenSession: (id: string) => void;
  onExpand: (id: string) => void;
  onOpenThread: (sessionId: string, threadId: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
  onManageSession: (session: NarrativeSessionSummary) => void;
}

const swatches = [
  "#c79f4a",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#14B8A6",
  "#F97316",
];

export function NarrativeSessionDrawerRow({
  session,
  isActive,
  isExpanded,
  onOpenSession,
  onExpand,
  onOpenThread,
  onRenameSession,
  onManageSession,
}: NarrativeSessionDrawerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [color, setColor] = useState(session.color);
  const [threads, setThreads] = useState<NarrativeChatThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const isArchived = session.status === "archived";

  useEffect(() => {
    if (!isExpanded || threads.length > 0 || isLoadingThreads) return;
    let cancelled = false;
    setIsLoadingThreads(true);
    setThreadError(null);
    fetchNarrativeChatThreads(session.id)
      .then((items) => {
        if (!cancelled) setThreads(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setThreads([]);
          setThreadError(
            err instanceof Error ? err.message : "Thread load failed.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingThreads(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpanded, isLoadingThreads, session.id, threads.length]);

  function commitRename() {
    setIsEditing(false);
    onRenameSession(session.id, title.trim() || session.title, color);
  }

  function handleOpenWorkspace() {
    setIsEditing(false);
    onExpand(session.id);
    onOpenSession(session.id);
  }

  return (
    <article
      className={`narrative-session-row group p-2 transition duration-150 hover:translate-x-0.5 ${isActive ? "text-[var(--fintheon-accent)]" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={handleOpenWorkspace}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: session.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-[var(--fintheon-text)]">
              {session.title}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
              <span>{session.catalystCount} catalysts</span>
              <span>{formatUpdatedAt(session.updatedAt)}</span>
              {isArchived ? <span>Archived</span> : null}
            </span>
          </span>
          <ChevronDown
            size={13}
            className={`mt-0.5 shrink-0 transition ${isExpanded ? "rotate-180 text-[var(--fintheon-accent)]" : "text-[var(--fintheon-muted)]/60"}`}
          />
        </button>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="row-action"
          title="Rename narrative"
        >
          <Edit3 size={13} />
        </button>
        <button
          type="button"
          onClick={() => onManageSession(session)}
          className="row-action"
          title={
            isArchived
              ? "Restore or delete narrative"
              : "Archive or delete narrative"
          }
        >
          {isArchived ? <RotateCcw size={13} /> : <Inbox size={13} />}
        </button>
        <button
          type="button"
          onClick={() => onManageSession(session)}
          className="row-action text-red-300/60 hover:text-red-300"
          title="Delete narrative"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {isEditing ? (
        <RenamePanel
          color={color}
          title={title}
          setColor={setColor}
          setTitle={setTitle}
          commitRename={commitRename}
          onCancel={() => setIsEditing(false)}
        />
      ) : null}
      {isExpanded ? (
        <ThreadList
          threads={threads}
          isLoading={isLoadingThreads}
          error={threadError}
          onOpenThread={(threadId) => onOpenThread(session.id, threadId)}
        />
      ) : null}
    </article>
  );
}

function RenamePanel({
  color,
  title,
  setColor,
  setTitle,
  commitRename,
  onCancel,
}: {
  color: string;
  title: string;
  setColor: (value: string) => void;
  setTitle: (value: string) => void;
  commitRename: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 space-y-2 pl-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitRename();
          if (event.key === "Escape") onCancel();
        }}
        className="h-8 w-full rounded-[4px] bg-[var(--fintheon-accent)]/6 px-2 text-xs text-[var(--fintheon-text)] outline-none transition focus:bg-[var(--fintheon-accent)]/10"
        aria-label="Rename narrative"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              className={`h-[18px] w-[18px] rounded-sm transition hover:-translate-y-px ${swatch.toLowerCase() === color.toLowerCase() ? "ring-1 ring-[var(--fintheon-text)]/70" : "opacity-80 hover:opacity-100"}`}
              style={{ backgroundColor: swatch }}
              title={swatch}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={commitRename}
          className="h-7 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:-translate-y-px"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  isLoading,
  error,
  onOpenThread,
}: {
  threads: NarrativeChatThread[];
  isLoading: boolean;
  error: string | null;
  onOpenThread: (id: string) => void;
}) {
  const copy =
    error ??
    (isLoading ? "Loading workspace chats..." : "No chat threads stored yet.");
  return (
    <div className="ml-4 mt-2 space-y-1 border-l border-[var(--fintheon-accent)]/12 pl-3">
      {threads.length === 0 ? (
        <p className="py-1 text-[11px] leading-4 text-[var(--fintheon-muted)]/70">
          {copy}
        </p>
      ) : (
        threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => onOpenThread(thread.id)}
            className="flex w-full items-start gap-2 py-1.5 text-left text-[var(--fintheon-muted)] transition hover:translate-x-0.5 hover:text-[var(--fintheon-accent)]"
          >
            <MessageSquareText size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-[var(--fintheon-text)]">
                {thread.title}
              </span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.12em]">
                {thread.messageCount} messages ·{" "}
                {formatUpdatedAt(thread.lastMessageAt)}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recent";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
