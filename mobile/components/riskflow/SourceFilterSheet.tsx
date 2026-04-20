// [claude-code 2026-04-19] Mobile source filter — bottom sheet of 5 toggle pills
//   matching the RiskFlowFilterBar visual family (same typography + tap target).
import { BottomSheet } from "../shared/BottomSheet";
import { SOURCE_BUCKETS, type SourceBucket } from "../../lib/source-buckets";

interface SourceFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selected: Set<SourceBucket>;
  onToggle: (b: SourceBucket) => void;
  onClear: () => void;
}

export function SourceFilterSheet({
  isOpen,
  onClose,
  selected,
  onToggle,
  onClear,
}: SourceFilterSheetProps) {
  const allActive = selected.size === 0;
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
        <Pill label="ALL" active={allActive} onClick={onClear} />
        {SOURCE_BUCKETS.map((b) => (
          <Pill
            key={b}
            label={b.toUpperCase()}
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
  active,
  onClick,
}: {
  label: string;
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
      }}
    >
      {label}
    </button>
  );
}
