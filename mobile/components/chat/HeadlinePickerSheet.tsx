// [claude-code 2026-04-16] T2: Bottom sheet headline selector — mobile port of desktop HeadlinePickerPopover
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Check } from "../shared/iso-icons";
import { BottomSheet } from "../shared/BottomSheet";
import { useMobileRiskFlow } from "../../contexts/RiskFlowContext";
import type { HeadlineChip } from "./HeadlineChips";

interface HeadlinePickerSheetProps {
  open: boolean;
  onClose: () => void;
  selected: HeadlineChip[];
  onToggle: (chip: HeadlineChip) => void;
  onClear: () => void;
}

const severityColor = (s?: string) => {
  if (s === "critical" || s === "high") return "#f87171";
  if (s === "medium") return "#c79f4a";
  return "#71717a";
};

export function HeadlinePickerSheet({
  open,
  onClose,
  selected,
  onToggle,
  onClear,
}: HeadlinePickerSheetProps) {
  const { alerts } = useMobileRiskFlow();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
    else setQuery("");
  }, [open]);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? alerts.filter((a) => a.title.toLowerCase().includes(q))
      : alerts;
    return list.slice(0, 20);
  }, [alerts, query]);

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="ATTACH HEADLINES">
      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 6,
            background: "rgba(199, 159, 74, 0.05)",
            border: "1px solid var(--border-visible)",
          }}
        >
          <Search size={14} color="var(--text-secondary)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--font-data)",
              // 16px prevents iOS Safari from auto-zooming the viewport on focus
              fontSize: 16,
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Selected count + clear */}
      {selected.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {selected.length} selected
          </span>
          <button
            onClick={onClear}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Alert list */}
      {filtered.map((a) => {
        const isSelected = selectedIds.has(a.id);
        return (
          <button
            key={a.id}
            onClick={() =>
              onToggle({ id: a.id, headline: a.title, severity: a.severity })
            }
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 4px",
              background: isSelected
                ? "rgba(199, 159, 74, 0.06)"
                : "transparent",
              border: "none",
              borderBottom: "1px solid var(--border-visible)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: severityColor(a.severity),
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: "var(--font-body)",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.title}
            </span>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-visible)"}`,
                background: isSelected
                  ? "rgba(199, 159, 74, 0.15)"
                  : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isSelected && <Check size={10} color="var(--accent)" />}
            </span>
          </button>
        );
      })}

      {filtered.length === 0 && (
        <div
          style={{
            padding: "24px 0",
            textAlign: "center",
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-disabled)",
          }}
        >
          {query ? "No matching headlines" : "No headlines available"}
        </div>
      )}
    </BottomSheet>
  );
}
