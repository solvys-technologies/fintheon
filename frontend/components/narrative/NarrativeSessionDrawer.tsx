import { ChevronDown, Clock, Plus, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import { NarrativeSessionDrawerRow } from "./NarrativeSessionDrawerRow";

interface NarrativeSessionDrawerProps {
  isOpen: boolean;
  isWorkspaceOpen: boolean;
  sessions: NarrativeSessionSummary[];
  activeSessionId: string | null;
  onClose: () => void;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onOpenThread: (sessionId: string, threadId: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
  onManageSession: (session: NarrativeSessionSummary) => void;
}

export function NarrativeSessionDrawer({
  isOpen,
  sessions,
  activeSessionId,
  onClose,
  onNewSession,
  onOpenSession,
  onOpenThread,
  onRenameSession,
  onManageSession,
}: NarrativeSessionDrawerProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    activeSessionId,
  );
  const activeSessions = useMemo(
    () => sessions.filter((session) => session.status !== "archived"),
    [sessions],
  );
  const archivedSessions = useMemo(
    () => sessions.filter((session) => session.status === "archived"),
    [sessions],
  );

  return (
    <aside
      className={`narrative-session-drawer-motion absolute bottom-0 left-0 top-0 z-40 w-[360px] overflow-hidden bg-[color-mix(in_srgb,var(--fintheon-bg)_82%,transparent)] backdrop-blur-xl ${
        isOpen ? "" : "pointer-events-none"
      }`}
      data-open={isOpen ? "true" : "false"}
      style={{
        backgroundImage:
          "linear-gradient(to bottom, transparent, rgba(199,159,74,0.18), transparent)",
        backgroundPosition: "right top",
        backgroundRepeat: "no-repeat",
        backgroundSize: "1px 100%",
      }}
    >
      <div className="flex h-full min-h-0 flex-col pt-[55px]">
        <DrawerHeader onClose={onClose} />
        <div className="p-2 fading-ruler-bottom">
          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex h-8 items-center gap-2 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
          >
            <Plus size={13} />
            New session
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <DrawerSection label="Active Narratives">
            {activeSessions.length === 0 ? (
              <EmptyState>No active narratives yet.</EmptyState>
            ) : (
              <div className="space-y-1">
                {activeSessions.map((session) => (
                  <NarrativeSessionDrawerRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    isExpanded={expandedSessionId === session.id}
                    onExpand={(id) =>
                      setExpandedSessionId((current) =>
                        current === id ? null : id,
                      )
                    }
                    onOpenSession={onOpenSession}
                    onOpenThread={onOpenThread}
                    onRenameSession={onRenameSession}
                    onManageSession={onManageSession}
                  />
                ))}
              </div>
            )}
          </DrawerSection>

          <DrawerSection
            label={`Archive (${archivedSessions.length})`}
            action={
              <button
                type="button"
                onClick={() => setArchiveOpen((value) => !value)}
                className="grid h-6 w-6 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)]"
                title={archiveOpen ? "Collapse archive" : "Expand archive"}
              >
                <ChevronDown
                  size={13}
                  className={`transition ${archiveOpen ? "rotate-180" : ""}`}
                />
              </button>
            }
          >
            {archiveOpen ? (
              archivedSessions.length === 0 ? (
                <EmptyState>No archived narratives.</EmptyState>
              ) : (
                <div className="space-y-1">
                  {archivedSessions.map((session) => (
                    <NarrativeSessionDrawerRow
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      isExpanded={expandedSessionId === session.id}
                      onExpand={(id) =>
                        setExpandedSessionId((current) =>
                          current === id ? null : id,
                        )
                      }
                      onOpenSession={onOpenSession}
                      onOpenThread={onOpenThread}
                      onRenameSession={onRenameSession}
                      onManageSession={onManageSession}
                    />
                  ))}
                </div>
              )
            ) : null}
          </DrawerSection>
        </div>
      </div>
    </aside>
  );
}

function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-11 items-center justify-between px-3 fading-ruler-bottom">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-[var(--fintheon-accent)]" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          Narratives
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
        title="Close narratives drawer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function DrawerSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/55 fading-ruler-bottom">
        <span>{label}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-3 text-xs leading-5 text-[var(--fintheon-muted)]">
      {children}
    </div>
  );
}
