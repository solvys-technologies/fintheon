// [claude-code 2026-04-16] T2: Headline pill chips + formatHeadlineContext for mobile chat
import { X } from "../shared/iso-icons";

export interface HeadlineChip {
  id: string;
  headline: string;
  severity?: string;
}

export function HeadlineChips({
  chips,
  onRemove,
}: {
  chips: HeadlineChip[];
  onRemove: (id: string) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 0" }}
    >
      {chips.map((c) => (
        <span
          key={c.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontFamily: "var(--font-data)",
            background: "rgba(199, 159, 74, 0.1)",
            border: "1px solid rgba(199, 159, 74, 0.25)",
            color: "var(--accent)",
          }}
        >
          {c.headline.length > 40
            ? c.headline.slice(0, 40) + "..."
            : c.headline}
          <button
            onClick={() => onRemove(c.id)}
            aria-label={`Remove ${c.headline}`}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={10} color="var(--accent)" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function formatHeadlineContext(chips: HeadlineChip[]): string {
  if (chips.length === 0) return "";
  const lines = chips.map((c) => `- ${c.headline}`);
  return `\n\n[Attached Headlines]\n${lines.join("\n")}`;
}
