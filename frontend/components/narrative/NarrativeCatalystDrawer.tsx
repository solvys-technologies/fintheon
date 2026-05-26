import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  NarrativeHeadlineOption,
  SensemakingCatalyst,
} from "./sensemaking-types";

interface NarrativeCatalystDrawerProps {
  open: boolean;
  headlines: NarrativeHeadlineOption[];
  relatedCatalysts: SensemakingCatalyst[];
  selectedIds: Set<string>;
  isLoading: boolean;
  onClose: () => void;
  onToggle: (headline: NarrativeHeadlineOption) => void;
}

export function NarrativeCatalystDrawer({
  open,
  headlines,
  relatedCatalysts,
  selectedIds,
  isLoading,
  onClose,
  onToggle,
}: NarrativeCatalystDrawerProps) {
  const [query, setQuery] = useState("");
  const relatedIds = new Set(relatedCatalysts.map((item) => item.id));
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return headlines;
    return headlines.filter((item) =>
      `${item.headline} ${item.summary} ${item.tags.join(" ")} ${item.symbols.join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [headlines, query]);

  return (
    <aside
      className={`absolute inset-y-0 left-0 z-30 w-[360px] max-w-[calc(100%-24px)] border-r border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/98 backdrop-blur-xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
              Catalyst Drawer
            </p>
            <p className="text-xs text-[var(--fintheon-muted)]">
              {selectedIds.size} attached
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
            title="Close catalysts"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/15 px-3 py-2 text-xs text-[var(--fintheon-muted)]">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headlines, tags, symbols"
            className="min-w-0 flex-1 bg-transparent text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
          />
        </label>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {isLoading ? <DrawerState text="Loading RiskFlow" /> : null}
          {!isLoading && filtered.length === 0 ? (
            <DrawerState text="No catalysts" />
          ) : null}
          {relatedCatalysts.length > 0 ? (
            <section className="space-y-2">
              <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
                Related In Map
              </p>
              {relatedCatalysts.slice(0, 6).map((item) => (
                <CatalystRow
                  key={`related-${item.id}`}
                  headline={toOption(item)}
                  selected={selectedIds.has(item.id)}
                  related
                  onToggle={onToggle}
                />
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
              RiskFlow Headlines
            </p>
            {filtered.map((item) => (
              <CatalystRow
                key={item.id}
                headline={item}
                selected={selectedIds.has(item.id)}
                related={relatedIds.has(item.id)}
                onToggle={onToggle}
              />
            ))}
          </section>
        </div>
      </div>
    </aside>
  );
}

function CatalystRow({
  headline,
  selected,
  related,
  onToggle,
}: {
  headline: NarrativeHeadlineOption;
  selected: boolean;
  related: boolean;
  onToggle: (headline: NarrativeHeadlineOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(headline)}
      className={`w-full rounded-md border p-3 text-left transition ${
        selected
          ? "border-[var(--fintheon-accent)]/55 bg-[var(--fintheon-accent)]/10"
          : "border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/50 hover:border-[var(--fintheon-accent)]/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
          {related ? "Related" : headline.source}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--fintheon-muted)]">
          {formatDate(headline.publishedAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-5 text-[var(--fintheon-text)]">
        {headline.headline}
      </p>
    </button>
  );
}

function DrawerState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[var(--fintheon-accent)]/10 px-3 py-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      {text}
    </div>
  );
}

function toOption(item: SensemakingCatalyst): NarrativeHeadlineOption {
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    severity: item.category,
    publishedAt: item.publishedAt,
    symbols: item.symbols,
    tags: item.tags,
    narrativeThreads: item.narrativeThreads,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
