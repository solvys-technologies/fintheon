import { Loader2 } from "lucide-react";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

export type NarrativeConflictStatus = "CONFIRMING" | "CONFLICT" | "NOISE";

interface NarrativeRiskFlowPickerProps {
  headlines: NarrativeHeadlineOption[];
  selectedIds: Set<string>;
  isLoading: boolean;
  error?: string | null;
  minSelected?: number;
  conflictById?: Record<string, NarrativeConflictStatus>;
  onToggle: (headline: NarrativeHeadlineOption) => void;
}

export function NarrativeRiskFlowPicker({
  headlines,
  selectedIds,
  isLoading,
  error = null,
  minSelected = 3,
  conflictById = {},
  onToggle,
}: NarrativeRiskFlowPickerProps) {
  const selectedCount = selectedIds.size;

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          RiskFlow
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
          [{selectedCount}/{minSelected} catalysts]
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto border-y border-[var(--fintheon-accent)]/10">
        {isLoading ? (
          <div className="flex h-28 items-center justify-center gap-2 text-xs text-[var(--fintheon-muted)]">
            <Loader2 size={14} className="animate-spin text-[var(--fintheon-accent)]" />
            Loading headlines
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="px-1 py-6 text-xs text-[var(--fintheon-muted)]">{error}</div>
        ) : null}

        {!isLoading && !error && headlines.length === 0 ? (
          <div className="px-1 py-6 text-xs text-[var(--fintheon-muted)]">
            No RiskFlow headlines available.
          </div>
        ) : null}

        {!isLoading && !error
          ? headlines.map((headline, index) => (
              <HeadlineRow
                key={headline.id}
                headline={headline}
                checked={selectedIds.has(headline.id)}
                status={conflictById[headline.id] ?? inferConflictStatus(headline)}
                isLast={index === headlines.length - 1}
                onToggle={onToggle}
              />
            ))
          : null}
      </div>
    </section>
  );
}

function HeadlineRow({
  headline,
  checked,
  status,
  isLast,
  onToggle,
}: {
  headline: NarrativeHeadlineOption;
  checked: boolean;
  status: NarrativeConflictStatus;
  isLast: boolean;
  onToggle: (headline: NarrativeHeadlineOption) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <div className="flex items-start gap-3 px-1 py-3 transition hover:bg-[var(--fintheon-accent)]/5">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(headline)}
          className="mt-1 h-3.5 w-3.5 accent-[var(--fintheon-accent)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block line-clamp-2 text-[13px] leading-5 text-[var(--fintheon-text)]">
            {headline.headline}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
            <span>{headline.source}</span>
            <span>{formatPublishedAt(headline.publishedAt)}</span>
            <span>IV {formatScore(headline.ivScore)}</span>
            <span>Macro {headline.macroLevel ?? "-"}</span>
          </span>
        </span>
        <span className="rounded border border-[var(--fintheon-accent)]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]">
          {status}
        </span>
      </div>
      {!isLast ? (
        <div
          className="mx-1 h-px bg-[var(--fintheon-accent)]/20"
          style={{ maskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)" }}
        />
      ) : null}
    </label>
  );
}

function inferConflictStatus(headline: NarrativeHeadlineOption): NarrativeConflictStatus {
  if (headline.severity.toLowerCase().includes("low")) return "NOISE";
  if ((headline.ivScore ?? 0) >= 7) return "CONFLICT";
  return "CONFIRMING";
}

function formatScore(value: number | undefined) {
  if (value === undefined) return "-";
  return value.toFixed(value >= 10 ? 0 : 1);
}

function formatPublishedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recent";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
