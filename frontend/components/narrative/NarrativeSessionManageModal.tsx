import { Inbox, RotateCcw, Trash2, X } from "lucide-react";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";

interface NarrativeSessionManageModalProps {
  session: NarrativeSessionSummary | null;
  open: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function NarrativeSessionManageModal({
  session,
  open,
  isBusy = false,
  onClose,
  onDelete,
  onArchive,
  onRestore,
}: NarrativeSessionManageModalProps) {
  if (!open || !session) return null;

  const isArchived = session.status === "archived";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-sm">
      <section className="narrative-manage-modal narrative-fade-item w-[min(420px,calc(100vw-32px))] rounded-[6px] border border-[var(--fintheon-accent)]/18 bg-[color-mix(in_srgb,var(--fintheon-surface)_72%,transparent)] p-4 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
              Manage Narrative
            </p>
            <h3 className="mt-1 truncate text-sm font-medium text-[var(--fintheon-text)]">
              {session.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs leading-5 text-[var(--fintheon-muted)]">
          Deleting removes the workspace, chat artifacts, and its bubble from the map.
          Moving it out of view keeps the narrative in the archive drawer and hides it
          from active desk map surfaces.
        </p>

        <div className="mt-4 grid gap-2">
          {isArchived ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRestore(session.id)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[var(--fintheon-accent)]/20 px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 disabled:opacity-45"
            >
              <RotateCcw size={13} />
              Restore to active map
            </button>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onArchive(session.id)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[var(--fintheon-accent)]/20 px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 disabled:opacity-45"
            >
              <Inbox size={13} />
              Move out of view
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onDelete(session.id)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-red-400/20 px-3 text-[10px] uppercase tracking-[0.12em] text-red-300 transition hover:-translate-y-px hover:bg-red-400/8 disabled:opacity-45"
          >
            <Trash2 size={13} />
            Delete workspace and map bubble
          </button>
        </div>
      </section>
    </div>
  );
}
