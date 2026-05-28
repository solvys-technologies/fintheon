import { useEffect, useState } from "react";
import { ChevronDown, FileText, Globe, Paperclip, Scroll, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StreamdownChat } from "../chat/slots/StreamdownChat";
import {
  fetchFileRoom,
  type FileRoomIndex,
  type FileRoomItem,
  type FileRoomSection,
} from "../../lib/file-room";

const SECTION_ICONS: Record<string, LucideIcon> = {
  "weekly-tribune": Scroll,
  "agentic-memos": Zap,
  "narrative-summaries": FileText,
  "narrative-workspaces": FileText,
  "narrative-tags": FileText,
  uploads: Paperclip,
  "chart-evidence": FileText,
  "agent-souls": Globe,
};

interface FileRoomProps {
  deskId?: string;
}

export function FileRoom({ deskId }: FileRoomProps) {
  const [data, setData] = useState<FileRoomIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFileRoom(deskId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Load failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [deskId]);

  if (error) {
    return (
      <div className="px-4 py-6 text-xs text-[var(--fintheon-muted)]">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6 text-xs text-[var(--fintheon-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-3">
      <div className="mb-2 px-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          File Room
        </p>
        <p className="mt-0.5 text-xs text-[var(--fintheon-muted)]">
          {data.desk.name}
        </p>
      </div>
      {data.sections.map((section) => (
        <SectionGroup key={section.id} section={section} />
      ))}
    </div>
  );
}

function SectionGroup({ section }: { section: FileRoomSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = SECTION_ICONS[section.id] ?? FileText;
  const count = section.items.length;

  return (
    <div className="overflow-hidden rounded-[4px] border border-[var(--fintheon-accent)]/10">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--fintheon-accent)]/[0.04]"
      >
        <Icon
          size={13}
          className={`shrink-0 transition ${isOpen ? "text-[var(--fintheon-accent)]" : "text-[var(--fintheon-muted)]"}`}
        />
        <span
          className={`flex-1 truncate text-[11px] uppercase tracking-[0.12em] transition ${
            isOpen
              ? "text-[var(--fintheon-accent)]"
              : "text-[var(--fintheon-text)]/80"
          }`}
        >
          {section.title}
        </span>
        <span className="font-mono text-[10px] text-[var(--fintheon-muted)]">
          {count}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-[var(--fintheon-muted)] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--fintheon-accent)]/8">
          {count === 0 ? (
            <p className="px-4 py-4 text-xs text-[var(--fintheon-muted)]">
              {section.description}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--fintheon-accent)]/8">
              {section.items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({ item }: { item: FileRoomItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody =
    (item.kind === "markdown" || item.kind === "soul") && item.excerpt;

  return (
    <article className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <KindBadge kind={item.kind} />
            <p className="truncate text-[11px] text-[var(--fintheon-text)]">
              {item.title}
            </p>
          </div>
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--fintheon-muted)]">
              {item.summary}
            </p>
          ) : null}
        </div>
        {hasBody ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-0.5 shrink-0 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)]"
          >
            {expanded ? "Less" : "More"}
          </button>
        ) : null}
      </div>

      {expanded && hasBody ? (
        <div className="mt-2 rounded-[4px] bg-black/20 px-3 py-2 text-[11px] leading-5">
          <StreamdownChat content={item.excerpt} />
        </div>
      ) : null}

      <MetaRow item={item} />
    </article>
  );
}

function KindBadge({ kind }: { kind: FileRoomItem["kind"] }) {
  const labels: Record<FileRoomItem["kind"], string> = {
    markdown: "MD",
    pdf: "PDF",
    notion: "Notion",
    url: "URL",
    soul: "SOUL",
    chart: "Chart",
    unknown: "—",
  };
  return (
    <span className="shrink-0 rounded-[2px] bg-[var(--fintheon-accent)]/8 px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--fintheon-accent)]/70">
      {labels[kind]}
    </span>
  );
}

function MetaRow({ item }: { item: FileRoomItem }) {
  const parts: string[] = [];
  if (item.tickers.length) parts.push(item.tickers.slice(0, 3).join(" · "));
  if (item.tags.length) parts.push(item.tags.slice(0, 2).join(", "));
  if (item.updatedAt)
    parts.push(new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }));

  if (!parts.length) return null;
  return (
    <p className="mt-1 font-mono text-[9px] tracking-[0.06em] text-[var(--fintheon-muted)]/60">
      {parts.join("  ·  ")}
    </p>
  );
}
