interface UserMessagePrimitiveProps {
  rawContent: unknown;
  createdAt?: Date;
}

function textFromRawContent(rawContent: unknown): string {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as { type?: string; text?: string };
      if (p.type === "text" && typeof p.text === "string") return p.text;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function UserMessagePrimitive({
  rawContent,
}: UserMessagePrimitiveProps) {
  const text = textFromRawContent(rawContent);
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "85%",
          border: "1px solid #3f3f46",
          borderRadius: 8,
          padding: "10px 12px",
          whiteSpace: "pre-wrap",
          fontSize: 13,
        }}
      >
        {text}
      </div>
    </div>
  );
}
