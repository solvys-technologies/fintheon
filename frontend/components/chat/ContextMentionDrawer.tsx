// [codex 2026-05-23] Composer-attached @mention drawer.
import { useEffect, useMemo, useState } from "react";
import { AtSign, FileText, GitBranch, Plug, Search, X } from "lucide-react";
import {
  fetchContextMentions,
  type ContextMention,
} from "../../lib/context-mentions";
import { RepoChatComposerSurface } from "./composer/RepoChatComposer";

interface ContextMentionDrawerProps {
  open: boolean;
  query: string;
  selected?: ContextMention[];
  onSelect: (item: ContextMention) => void;
  onClose: () => void;
}

const typeLabels: Record<ContextMention["type"], string> = {
  document: "Doc",
  skill: "Skill",
  connector: "Connector",
  narrative: "Narrative",
  theme: "Theme",
  riskflow: "RiskFlow",
  instrument: "Instrument",
  vault: "Vault",
};

export function ContextMentionDrawer({
  open,
  query,
  selected = [],
  onSelect,
  onClose,
}: ContextMentionDrawerProps) {
  const [items, setItems] = useState<ContextMention[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.id)),
    [selected],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchContextMentions(query)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Mentions unavailable");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  return (
    <RepoChatComposerSurface open={open} kind="drawer">
      <div className="flex max-h-[280px] min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <AtSign size={13} className="text-[var(--fintheon-accent)]/70" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f0ead6]/62">
              Mention Context
            </span>
            <span className="text-[10px] text-[#f0ead6]/34">{query || "all"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#f0ead6]/34 transition-colors hover:bg-white/[0.055] hover:text-[#f0ead6]/70"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-[#f0ead6]/38">
          <Search size={11} />
          Docs, skills, connectors, narratives, headlines, tickers, and vault notes
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? <MentionState label="Loading context" /> : null}
          {error ? <MentionState label={error} /> : null}
          {!isLoading && !error && items.length === 0 ? (
            <MentionState label="No mention matches" />
          ) : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                selectedIds.has(item.id)
                  ? "bg-[var(--fintheon-accent)]/10"
                  : "hover:bg-white/[0.045]"
              }`}
            >
              <MentionIcon item={item} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-medium text-[#f0ead6]/78">
                    {item.label}
                  </span>
                  <span className="shrink-0 rounded-sm bg-white/[0.055] px-1 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#f0ead6]/40">
                    {typeLabels[item.type]}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[#f0ead6]/36">
                  {item.subtitle} · {item.preview}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </RepoChatComposerSurface>
  );
}

function MentionIcon({ item }: { item: ContextMention }) {
  const className = "mt-0.5 shrink-0 text-[var(--fintheon-accent)]/55";
  if (item.type === "document" || item.type === "vault")
    return <FileText size={13} className={className} />;
  if (item.type === "connector" || item.type === "skill")
    return <Plug size={13} className={className} />;
  return <GitBranch size={13} className={className} />;
}

function MentionState({ label }: { label: string }) {
  return (
    <div className="rounded-md px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[#f0ead6]/34">
      {label}
    </div>
  );
}
