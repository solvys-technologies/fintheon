// [claude-code 2026-04-26] Mobile-side HTML-entity decoder. Mirrors
// frontend/lib/html-entities.ts; mobile token system + lib divergence means
// we can't import directly from /frontend. Apply at the single ingest point
// (RiskFlowContext) so every consumer (RiskFlowCard, NarrativeFlow surfaces,
// timeline rows, chat header, etc.) gets clean strings.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
};

const ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;

function decodeEntity(entityBody: string): string {
  const lower = entityBody.toLowerCase();

  if (lower.startsWith("#x")) {
    const codePoint = Number.parseInt(lower.slice(2), 16);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
    return `&${entityBody};`;
  }

  if (lower.startsWith("#")) {
    const codePoint = Number.parseInt(lower.slice(1), 10);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
    return `&${entityBody};`;
  }

  return NAMED_ENTITIES[lower] ?? `&${entityBody};`;
}

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(ENTITY_PATTERN, (_, entityBody: string) =>
    decodeEntity(entityBody),
  );
}
