const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

const ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;

function decodeEntity(entityBody: string): string {
  const lower = entityBody.toLowerCase();

  if (lower.startsWith('#x')) {
    const codePoint = Number.parseInt(lower.slice(2), 16);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
    return `&${entityBody};`;
  }

  if (lower.startsWith('#')) {
    const codePoint = Number.parseInt(lower.slice(1), 10);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
    return `&${entityBody};`;
  }

  return NAMED_ENTITIES[lower] ?? `&${entityBody};`;
}

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(ENTITY_PATTERN, (_, entityBody: string) => decodeEntity(entityBody));
}

