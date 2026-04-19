// [claude-code 2026-04-19] S27-T10 W2e: Minimal skill.yaml parser + Zod validation.
//   Backend-hono tsconfig has rootDir=./src and does not cross into shared/, so the
//   SkillManifest schema is duplicated here in compact form. Keep in sync with
//   shared/skill-manifest.ts.

import { z } from "zod";

const PermissionEnum = z.enum([
  "read_market_data",
  "read_news",
  "read_filings",
  "write_notes",
  "browser_allowlist",
  "browser_universal",
]);

export const SkillManifestSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  entry_point: z.string(),
  soul: z.string().optional(),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        input_schema: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
  permissions: z.array(PermissionEnum).default([]),
  security_scan: z
    .object({
      data_exfil_risks: z.array(z.string()).default([]),
      prompt_injection_vectors: z.array(z.string()).default([]),
      destructive_ops: z.array(z.string()).default([]),
    })
    .optional(),
  authors: z.array(z.string()).default([]),
  license: z.string().default("Proprietary"),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

interface YamlLine {
  indent: number;
  content: string;
}

function prepLines(raw: string): YamlLine[] {
  const out: YamlLine[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    out.push({
      indent: line.length - line.trimStart().length,
      content: trimmed,
    });
  }
  return out;
}

function coerceScalar(raw: string): string | number | boolean {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith(">-") || raw.startsWith(">")) return raw.slice(2).trim();
  return raw;
}

function parseYamlBlock(
  lines: YamlLine[],
  start: number,
  indent: number,
): { value: unknown; next: number } {
  if (start >= lines.length || lines[start].indent < indent) {
    return { value: null, next: start };
  }

  if (lines[start].content.startsWith("- ")) {
    const arr: unknown[] = [];
    let i = start;
    while (
      i < lines.length &&
      lines[i].indent === indent &&
      lines[i].content.startsWith("- ")
    ) {
      const item = lines[i].content.slice(2).trim();
      i++;
      if (!item) {
        const nested = parseYamlBlock(lines, i, indent + 2);
        arr.push(nested.value);
        i = nested.next;
      } else if (item.endsWith(":")) {
        // list-of-objects where first key is on the dash line
        const tmpLines: YamlLine[] = [
          { indent: 0, content: item },
          ...lines.slice(i).map((l) => ({
            indent: Math.max(0, l.indent - (indent + 2)),
            content: l.content,
          })),
        ];
        const nested = parseYamlBlock(tmpLines, 0, 0);
        arr.push(nested.value);
        // advance i past the block we consumed
        let consumed = 1;
        while (
          i + consumed - 1 < lines.length &&
          lines[i + consumed - 1].indent >= indent + 2
        ) {
          consumed++;
        }
        i += consumed - 1;
      } else if (item.includes(": ")) {
        // inline "key: value" on the dash line
        const colonIdx = item.indexOf(": ");
        const key = item.slice(0, colonIdx).trim();
        const value = item.slice(colonIdx + 1).trim();
        const obj: Record<string, unknown> = { [key]: coerceScalar(value) };
        while (
          i < lines.length &&
          lines[i].indent === indent + 2 &&
          !lines[i].content.startsWith("- ")
        ) {
          const line = lines[i].content;
          const cIdx = line.indexOf(":");
          if (cIdx === -1) {
            i++;
            continue;
          }
          const k = line.slice(0, cIdx).trim();
          const v = line.slice(cIdx + 1).trim();
          i++;
          if (!v) {
            const nested = parseYamlBlock(lines, i, indent + 4);
            obj[k] = nested.value;
            i = nested.next;
          } else {
            obj[k] = coerceScalar(v);
          }
        }
        arr.push(obj);
      } else {
        arr.push(coerceScalar(item));
      }
    }
    return { value: arr, next: i };
  }

  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent) {
    const line = lines[i].content;
    if (line.startsWith("- ")) break;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    i++;
    if (!value) {
      const nested = parseYamlBlock(lines, i, indent + 2);
      obj[key] = nested.value;
      i = nested.next;
    } else {
      obj[key] = coerceScalar(value);
    }
  }
  return { value: obj, next: i };
}

export function parseSkillYaml(raw: string): SkillManifest {
  const { value } = parseYamlBlock(prepLines(raw), 0, 0);
  return SkillManifestSchema.parse(value);
}
