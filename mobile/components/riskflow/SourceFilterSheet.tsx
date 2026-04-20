// [claude-code 2026-04-20] Per-bucket counts rendered on each pill so TP can
//   see zero-match buckets before selecting them. Previously selecting "Econ"
//   (or any niche bucket) silently produced [NO ALERTS] with no signal why.
// [claude-code 2026-04-19] Mobile source filter — bottom sheet of 5 toggle pills
//   matching the RiskFlowFilterBar visual family (same typography + tap target).
import { BottomSheet } from "../shared/BottomSheet";
import { SOURCE_BUCKETS, type SourceBucket } from "../../lib/source-buckets";

interface SourceFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selected: Set<SourceBucket>;
  bucketCounts?: Partial<Record<SourceBucket, number>>;
  onToggle: (b: SourceBucket) => void;
  onClear: () => void;
}

export function SourceFilterSheet({
  isOpen,
  onClose,
  selected,
  bucketCounts,
  onToggle,
  onClear,
}: SourceFilterSheetProps) {
  const allActive = selected.size === 0;
  const totalCount = bucketCounts
    ? Object.values(bucketCounts).reduce<number>((sum, n) => sum + (n ?? 0), 0)
    : undefined;
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Filter by source">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingTop: 4,
        }}
      >
        <Pill
          label="ALL"
          count={totalCount}
          active={allActive}
          onClick={onClear}
        />
        {SOURCE_BUCKETS.map((b) => (
          <Pill
            key={b}
            label={b.toUpperCase()}
            count={bucketCounts?.[b] ?? 0}
            active={selected.has(b)}
            onClick={() => onToggle(b)}
          />
        ))}
      </div>
    </BottomSheet>
  );
}

function Pill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 44,
        fontFamily: "var(--font-data)",
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: active ? "var(--text-display)" : "var(--text-secondary)",
        background: active ? "var(--surface-raised)" : "transparent",
        border: active
          ? "1px solid var(--text-display)"
          : "1px solid var(--border)",
        padding: "0 16px",
        textAlign: "left",
        cursor: "pointer",
        transition: "color 150ms, background 150ms, border-color 150ms",
        WebkitTapHighlightColor: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{label}</span>
      {count != null && (
        <span
          style={{
            fontFamily:
              "'Doto', 'Readable Digits', var(--font-data, monospace)",
            fontSize: 11,
            color: active ? "var(--text-primary)" : "var(--text-disabled)",
            letterSpacing: "0.02em",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
