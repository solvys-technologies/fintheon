import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Inbox, Loader2, RefreshCcw, RotateCcw, X } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import { StreamdownChat } from "../chat/slots";
import { useBackend } from "../../lib/backend";
import type { DeskInboxItem } from "../../lib/services/desk-inbox";

const DEFAULT_DESK_ID = "priced-in-capital";

export function DeskInboxFeed() {
  const backend = useBackend();
  const [items, setItems] = useState<DeskInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await backend.deskInbox.list(DEFAULT_DESK_ID));
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (item: DeskInboxItem, action: "approve" | "request" | "dismiss") => {
      setActiveId(item.id);
      try {
        if (action === "approve")
          await backend.deskInbox.approve(item.id, DEFAULT_DESK_ID);
        if (action === "request") {
          await backend.deskInbox.requestChanges(
            item.id,
            "Tighten the memo and add chart evidence before publishing.",
            DEFAULT_DESK_ID,
          );
        }
        if (action === "dismiss")
          await backend.deskInbox.dismiss(item.id, DEFAULT_DESK_ID);
        await load();
      } finally {
        setActiveId(null);
      }
    },
    [backend, load],
  );

  const pending = items.filter((item) => item.status === "pending");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <p className="font-mono text-[9px] text-[color-mix(in_srgb,var(--fintheon-accent)_72%,transparent)]">
            Pending
          </p>
          <h2 className="mt-1 text-[12px] font-semibold text-[color-mix(in_srgb,var(--fintheon-text)_85%,transparent)]">
            Inbox
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md p-1 text-[color-mix(in_srgb,var(--fintheon-muted)_45%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)] hover:text-[var(--fintheon-accent)]"
          aria-label="Refresh Inbox"
        >
          <RefreshCcw size={12} />
        </button>
        <span className="font-mono text-[9px] text-[color-mix(in_srgb,var(--fintheon-muted)_42%,transparent)]">
          {pending.length}
        </span>
      </div>
      <FadingRuler className="mx-4 opacity-45" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={16}
              className="animate-spin text-[color-mix(in_srgb,var(--fintheon-accent)_65%,transparent)]"
            />
          </div>
        ) : null}
        {!isLoading && pending.length === 0 ? <EmptyInbox /> : null}
        {pending.map((item) => (
          <MemoApprovalCard
            key={item.id}
            item={item}
            isBusy={activeId === item.id}
            onApprove={() => void decide(item, "approve")}
            onRequest={() => void decide(item, "request")}
            onDismiss={() => void decide(item, "dismiss")}
          />
        ))}
      </div>
    </div>
  );
}

function MemoApprovalCard({
  item,
  isBusy,
  onApprove,
  onRequest,
  onDismiss,
}: {
  item: DeskInboxItem;
  isBusy: boolean;
  onApprove: () => void;
  onRequest: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="mb-3 rounded-md border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-surface)_76%,var(--fintheon-bg))] p-3">
      <div className="flex items-start gap-2">
        <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--fintheon-accent)_55%,transparent)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] font-semibold leading-snug text-[color-mix(in_srgb,var(--fintheon-text)_82%,transparent)]">
            {item.title}
          </h3>
          <p className="mt-1 text-[10px] leading-relaxed text-[color-mix(in_srgb,var(--fintheon-text)_40%,transparent)]">
            Drift {item.catalystDriftSessions.toFixed(1)} sessions · Harper ·{" "}
            {Math.round(item.confidence * 100)}%
          </p>
        </div>
      </div>
      <div className="fintheon-chat-markdown mt-3 max-h-[220px] overflow-y-auto rounded-md border border-[color-mix(in_srgb,var(--fintheon-accent)_8%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-bg)_92%,var(--fintheon-surface))] p-2 text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_62%,transparent)]">
        <StreamdownChat content={item.body} />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <ActionButton
          icon={<Check size={11} />}
          label="Approve"
          disabled={isBusy}
          onClick={onApprove}
        />
        <ActionButton
          icon={<RotateCcw size={11} />}
          label="Changes"
          disabled={isBusy}
          onClick={onRequest}
        />
        <ActionButton
          icon={<X size={11} />}
          label="Dismiss"
          disabled={isBusy}
          onClick={onDismiss}
        />
      </div>
    </article>
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] px-2 py-1 text-[9px] text-[color-mix(in_srgb,var(--fintheon-text)_55%,transparent)] transition-colors hover:border-[color-mix(in_srgb,var(--fintheon-accent)_30%,transparent)] hover:text-[var(--fintheon-accent)] disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyInbox() {
  return (
    <div className="flex h-full items-center justify-center px-5 text-center">
      <div className="rounded-md border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-surface)_78%,var(--fintheon-bg))] px-5 py-6">
        <Inbox className="mx-auto h-5 w-5 text-[color-mix(in_srgb,var(--fintheon-accent)_45%,transparent)]" />
        <p className="mt-3 text-[11px] text-[color-mix(in_srgb,var(--fintheon-text)_48%,transparent)]">
          No pending approvals
        </p>
      </div>
    </div>
  );
}
