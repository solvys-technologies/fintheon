// [claude-code 2026-04-18] v5.22 S2: rename MiroShark → Agent Desk; hook now useAgentDeskLatest.
// [claude-code 2026-04-15] Aquarium summary — briefing text block, Nothing-styled
import { useAgentDeskLatest } from "../../hooks/useAgentDeskLatest";

export function AquariumSummary() {
  const { data, isLoading } = useAgentDeskLatest();

  if (isLoading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}
        >
          [LOADING AQUARIUM...]
        </span>
      </div>
    );
  }

  const summary = data?.briefing?.summary;
  if (!summary) {
    return (
      <div style={{ padding: "16px 0" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}
        >
          [NO AQUARIUM DATA]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        AQUARIUM ANALYSIS
      </span>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {summary}
      </p>
      {data.briefing?.keyFindings && data.briefing.keyFindings.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginTop: 4,
          }}
        >
          {data.briefing.keyFindings.slice(0, 3).map((finding, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              &bull; {finding}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
