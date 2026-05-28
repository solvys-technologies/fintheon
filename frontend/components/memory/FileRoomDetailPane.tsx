// [Codex 2026-05-27] Forecasting-model FileRoom items can be edited by managers.
import { useEffect, useState } from "react";
import { Check, Loader2, PencilLine, X } from "lucide-react";
import { StreamdownChat } from "../chat/slots";
import type {
  FileRoomItem,
  FileRoomItemDetail,
} from "../../lib/services/file-room";
import { cleanDocumentContent, formatItemMeta } from "./file-room-format";

interface FileRoomDetailPaneProps {
  item: FileRoomItem | null;
  detail: FileRoomItemDetail | null;
  isLoading: boolean;
  onSave?: (item: FileRoomItem, content: string) => Promise<void>;
}

export function FileRoomDetailPane({
  item,
  detail,
  isLoading,
  onSave,
}: FileRoomDetailPaneProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setDraft(detail ? cleanDocumentContent(detail) : "");
    setSaveError(null);
  }, [detail?.id]);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[color-mix(in_srgb,var(--fintheon-text)_30%,transparent)]">
        Select a document
      </div>
    );
  }
  const canEdit = item.sectionId === "forecasting-models" && Boolean(onSave);

  async function handleSave() {
    if (!item || !onSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(item, draft);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="mx-auto flex min-h-full max-w-4xl flex-col px-8 py-7">
      <header className="border-b border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--fintheon-accent)_64%,transparent)]">
            {isEditing ? "Edit View" : "Read View"}
          </p>
          <span className="font-mono text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_22%,transparent)]">
            {formatItemMeta(item)}
          </span>
        </div>
        {canEdit ? (
          <div className="mt-4 flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_20%,transparent)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] disabled:opacity-40"
                  title="Save forecasting model"
                >
                  <Check size={12} /> Save
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setDraft(detail ? cleanDocumentContent(detail) : "");
                    setIsEditing(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-text)_46%,transparent)] disabled:opacity-40"
                  title="Cancel edit"
                >
                  <X size={12} /> Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-accent)_76%,transparent)]"
                title="Edit forecasting model"
              >
                <PencilLine size={12} /> Edit
              </button>
            )}
            {saveError ? (
              <span className="font-mono text-[10px] text-red-300">
                {saveError}
              </span>
            ) : null}
          </div>
        ) : null}
        <h1 className="mt-3 text-[22px] font-semibold leading-tight text-[var(--fintheon-text)]">
          {item.title}
        </h1>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-[color-mix(in_srgb,var(--fintheon-text)_48%,transparent)]">
          {item.summary}
        </p>
        <MetaStrip item={item} />
      </header>

      <div className="fintheon-chat-markdown min-h-0 flex-1 py-5 text-[13px] leading-relaxed text-[color-mix(in_srgb,var(--fintheon-text)_80%,transparent)]">
        {isLoading ? (
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--fintheon-text)_36%,transparent)]">
            <Loader2 size={13} className="animate-spin" />
            Loading
          </div>
        ) : detail ? (
          isEditing ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[520px] w-full resize-y rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] bg-black/20 p-4 font-mono text-[12px] leading-6 text-[var(--fintheon-text)] outline-none focus:border-[color-mix(in_srgb,var(--fintheon-accent)_34%,transparent)]"
              spellCheck={false}
            />
          ) : (
            <StreamdownChat
              className="max-w-none [&_h1]:mt-0 [&_h1]:text-[18px] [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h3]:text-[13px] [&_p]:text-[13px] [&_p]:leading-7 [&_table]:w-full [&_td]:border-t [&_td]:border-[color-mix(in_srgb,var(--fintheon-accent)_9%,transparent)] [&_td]:py-2 [&_th]:border-b [&_th]:border-[color-mix(in_srgb,var(--fintheon-accent)_16%,transparent)] [&_th]:py-2"
              content={cleanDocumentContent(detail)}
            />
          )
        ) : (
          <p className="text-xs text-[color-mix(in_srgb,var(--fintheon-text)_38%,transparent)]">
            Document text unavailable
          </p>
        )}
      </div>
    </article>
  );
}

function MetaStrip({ item }: { item: FileRoomItem }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_12%,transparent)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-text)_38%,transparent)]">
        {item.path}
      </span>
      {item.tickers.map((ticker) => (
        <span
          key={ticker}
          className="rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] px-2 py-1 font-mono text-[9px] text-[color-mix(in_srgb,var(--fintheon-accent)_72%,transparent)]"
        >
          {ticker}
        </span>
      ))}
    </div>
  );
}
