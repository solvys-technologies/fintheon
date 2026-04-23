interface EmptyStateProps {
  selectionLabel: string;
}

export function EmptyState({ selectionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16">
      <div className="w-8 h-px mb-6" style={{ backgroundColor: "#c79f4a30" }} />
      <p
        className="text-[13px] text-center leading-relaxed"
        style={{
          color: "rgba(240, 234, 214, 0.35)",
          fontFamily: "var(--font-body)",
        }}
      >
        No catalysts for
        <br />
        <span style={{ color: "rgba(240, 234, 214, 0.55)" }}>
          {selectionLabel}
        </span>
      </p>
      <div className="w-8 h-px mt-6" style={{ backgroundColor: "#c79f4a30" }} />
    </div>
  );
}
