export interface ParsedMarkdown {
  frontmatter: Record<string, string>;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

export function parseMarkdown(raw: string): ParsedMarkdown {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) return { frontmatter: {}, body: raw };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    frontmatter[line.slice(0, idx).trim()] = unquoteScalar(
      line.slice(idx + 1).trim(),
    );
  }
  return { frontmatter, body: raw.slice(match[0].length) };
}

export function stringifyMarkdown(
  frontmatter: Record<string, string | number | boolean | string[] | null>,
  body: string,
): string {
  const lines = Object.entries(frontmatter)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${formatValue(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

export function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function summarizeMarkdown(body: string): string {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "No summary available";
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

export function boundedExcerpt(body: string, limit = 900): string {
  const cleaned = body.trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit - 3).trim()}...`;
}

function formatValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) return `[${value.map((v) => `"${v}"`).join(", ")}]`;
  if (typeof value === "string" && value.includes(":")) return `"${value}"`;
  return String(value);
}

function unquoteScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
