export interface Citation {
  index: number;
  title: string;
  sourceId?: string;
  excerpt?: string;
  url?: string;
}

interface CitationChipProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
  active?: boolean;
}

export function CitationChip({ citation, onClick, active }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      style={{
        border: `1px solid ${active ? "var(--fintheon-accent)" : "#3f3f46"}`,
        borderRadius: 9999,
        padding: "3px 8px",
        fontSize: 11,
        color: "var(--fintheon-text)",
        background: "transparent",
      }}
    >
      {citation.index + 1}. {citation.title}
    </button>
  );
}
