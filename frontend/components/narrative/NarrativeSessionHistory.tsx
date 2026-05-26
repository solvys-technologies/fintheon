import { PencilLine } from "lucide-react";
import { useState } from "react";
import { NarrativeColorPopover } from "./NarrativeColorPopover";

export interface NarrativeSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  catalystCount: number;
  color: string;
  status?: string;
  deskLabel?: string;
}

interface NarrativeSessionHistoryProps {
  sessions: NarrativeSessionSummary[];
  activeDeskLabel?: string;
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
}

const DEFAULT_NARRATIVES = [
  "Rate Cut Cycle",
  "Price Stability",
  "Max Employment",
];

export function NarrativeSessionHistory({
  sessions,
  activeDeskLabel = "Priced In Capital",
  onOpenSession,
  onRenameSession,
}: NarrativeSessionHistoryProps) {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          {activeDeskLabel}
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
          Desk memory
        </span>
      </div>

      <div className="relative max-h-64 overflow-hidden">
        <div className="space-y-0">
          {sessions.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              isLast={index === sessions.length - 1}
              onOpenSession={onOpenSession}
              onRenameSession={onRenameSession}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16">
          <div className="h-4 bg-[var(--fintheon-bg)] opacity-15" />
          <div className="h-4 bg-[var(--fintheon-bg)] opacity-35" />
          <div className="h-4 bg-[var(--fintheon-bg)] opacity-65" />
          <div className="h-4 bg-[var(--fintheon-bg)] opacity-95" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-1">
        {DEFAULT_NARRATIVES.map((label) => (
          <span
            key={label}
            className="rounded border border-[var(--fintheon-accent)]/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]"
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function SessionRow({
  session,
  isLast,
  onOpenSession,
  onRenameSession,
}: {
  session: NarrativeSessionSummary;
  isLast: boolean;
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [color, setColor] = useState(session.color);

  function commitRename() {
    setIsEditing(false);
    onRenameSession(session.id, title.trim() || session.title, color);
  }

  return (
    <div className="group relative">
      <div className="flex items-center gap-3 px-1 py-3">
        <button
          type="button"
          onClick={() => onOpenSession(session.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-white/10"
            style={{ backgroundColor: session.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-[var(--fintheon-text)]">
              {session.title}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
              <span>{session.deskLabel ?? "Priced In Capital"}</span>
              <span>{session.catalystCount} catalysts</span>
              <span>{formatUpdatedAt(session.updatedAt)}</span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-[var(--fintheon-muted)] opacity-0 transition group-hover:border-[var(--fintheon-accent)]/15 group-hover:opacity-100 hover:text-[var(--fintheon-accent)]"
          title="Rename narrative"
        >
          <PencilLine size={13} />
        </button>
      </div>

      {isEditing ? (
        <div className="mb-3 ml-7 flex flex-wrap items-start gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
            }}
            className="h-8 min-w-48 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-2 text-xs text-[var(--fintheon-text)] outline-none"
            aria-label="Rename narrative"
            autoFocus
          />
          <NarrativeColorPopover color={color} onChange={setColor} />
          <button
            type="button"
            onClick={commitRename}
            className="h-8 rounded border border-[var(--fintheon-accent)]/20 px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]"
          >
            Apply
          </button>
        </div>
      ) : null}

      {!isLast ? (
        <div
          className="mx-1 h-px bg-[var(--fintheon-accent)]/20"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 18%, black 82%, transparent)",
          }}
        />
      ) : null}
    </div>
  );
}

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Updated recently";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
