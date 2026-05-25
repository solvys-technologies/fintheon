import { Loader2 } from "lucide-react";
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
}

export function FileRoomDetailPane({
  item,
  detail,
  isLoading,
}: FileRoomDetailPaneProps) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[color-mix(in_srgb,var(--fintheon-text)_30%,transparent)]">
        Select a document
      </div>
    );
  }

  return (
    <article className="mx-auto flex min-h-full max-w-4xl flex-col px-8 py-7">
      <header className="border-b border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--fintheon-accent)_64%,transparent)]">
            Read View
          </p>
          <span className="font-mono text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_22%,transparent)]">
            {formatItemMeta(item)}
          </span>
        </div>
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
          <StreamdownChat
            className="max-w-none [&_h1]:mt-0 [&_h1]:text-[18px] [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h3]:text-[13px] [&_p]:text-[13px] [&_p]:leading-7 [&_table]:w-full [&_td]:border-t [&_td]:border-[color-mix(in_srgb,var(--fintheon-accent)_9%,transparent)] [&_td]:py-2 [&_th]:border-b [&_th]:border-[color-mix(in_srgb,var(--fintheon-accent)_16%,transparent)] [&_th]:py-2"
            content={cleanDocumentContent(detail)}
          />
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
