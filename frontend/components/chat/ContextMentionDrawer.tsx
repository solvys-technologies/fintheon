// [codex 2026-05-23] Composer-attached @mention drawer.
import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Bot,
  ChartCandlestick,
  FileText,
  GitBranch,
  Plug,
  Scroll,
  Search,
  X,
} from "lucide-react";
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
  memo: "Memo",
  chart: "Chart",
  agent: "Agent",
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
            <AtSign
              size={13}
              className="text-[color-mix(in_srgb,var(--fintheon-accent)_70%,transparent)]"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--fintheon-text)_62%,transparent)]">
              Mention Context
            </span>
            <span className="text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_34%,transparent)]">
              {query || "all"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[color-mix(in_srgb,var(--fintheon-text)_34%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_6%,transparent)] hover:text-[color-mix(in_srgb,var(--fintheon-text)_70%,transparent)]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_38%,transparent)]">
          <Search size={11} />
          Docs, memos, charts, agents, narratives, headlines, and tickers
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
                  ? "bg-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)]"
                  : "hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)]"
              }`}
            >
              <MentionIcon item={item} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-medium text-[color-mix(in_srgb,var(--fintheon-text)_78%,transparent)]">
                    {item.label}
                  </span>
                  <span className="shrink-0 rounded-sm bg-[color-mix(in_srgb,var(--fintheon-accent)_6%,transparent)] px-1 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--fintheon-text)_40%,transparent)]">
                    {typeLabels[item.type]}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_36%,transparent)]">
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
  const className =
    "mt-0.5 shrink-0 text-[color-mix(in_srgb,var(--fintheon-accent)_55%,transparent)]";
  if (item.type === "memo") return <Scroll size={13} className={className} />;
  if (item.type === "chart") return <ChartCandlestick size={13} className={className} />;
  if (item.type === "agent") return <Bot size={13} className={className} />;
  if (item.type === "document" || item.type === "vault")
    return <FileText size={13} className={className} />;
  if (item.type === "connector" || item.type === "skill")
    return <Plug size={13} className={className} />;
  return <GitBranch size={13} className={className} />;
}

function MentionState({ label }: { label: string }) {
  return (
    <div className="rounded-md px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-text)_34%,transparent)]">
      {label}
    </div>
  );
}
