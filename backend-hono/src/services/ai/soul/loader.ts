// [claude-code 2026-04-19] S27-T8 W1d: SOUL.md loader — literal CLAUDE.md grounding + Zod validation + 5-min cache.
import { readFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Schema duplicated from shared/soul-schema.ts — backend tsconfig rootDir is ./src so cross-root imports are not available.
// Keep in sync with shared/soul-schema.ts.
const AgentIdSchema = z.enum([
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export const SoulSchema = z.object({
  schema_version: z.literal(1),
  agent_id: AgentIdSchema,
  identity: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    self_description: z.string().optional(),
  }),
  native_home: z
    .object({
      platform: z.string().min(1),
      platform_description: z.string().min(1),
      company: z.string().min(1),
      company_description: z.string().min(1),
      design_system: z.string().min(1),
      design_description: z.string().min(1),
      model_provider: z.string().min(1),
      model: z.string().min(1),
      model_company: z.string().min(1),
    })
    .optional(),
  scope: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).min(1),
  grounding: z.object({
    source_of_truth: z.string().min(1),
    extra: z.array(z.string().min(1)).optional(),
  }),
  tools: z.array(z.string().min(1)),
  handoff_rules: z.array(z.string().min(1)),
  voice_style: z.string().min(1),
  memory_policy: z.object({
    writes: z.array(z.string().min(1)),
  }),
  model_preferences: z
    .object({
      prefer: z.string().min(1),
      fallback: z.string().min(1).optional(),
    })
    .optional(),
});

export type Soul = z.infer<typeof SoulSchema>;

export interface LoadedSoul extends Soul {
  grounding_text: string;
  extras_text: string[];
  soul_path: string;
}

const SOUL_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  soul: LoadedSoul;
  expiresAt: number;
}

const cache = new Map<AgentId, CacheEntry>();

// ── YAML frontmatter ────────────────────────────────────────────────────────

function splitFrontmatter(raw: string): string {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new Error("SOUL file missing opening '---' frontmatter delimiter");
  }
  const lines = raw.split("\n");
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new Error("SOUL file missing closing '---' frontmatter delimiter");
  }
  return lines.slice(1, endIdx).join("\n");
}

function coerce(raw: string): string | number | boolean {
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

interface YamlLine {
  indent: number;
  content: string;
}

function prepLines(text: string): YamlLine[] {
  const out: YamlLine[] = [];
  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    out.push({ indent, content: trimmed });
  }
  return out;
}

// Minimal YAML parser for SOUL frontmatter only. Supports nested objects, string
// arrays, inline scalars. Does not support anchors, flow syntax, or multiline strings.
function parseYaml(text: string): unknown {
  const lines = prepLines(text);
  let i = 0;

  function parseBlock(indent: number): unknown {
    if (i >= lines.length || lines[i].indent < indent) return null;

    if (lines[i].content.startsWith("- ") || lines[i].content === "-") {
      const arr: any[] = [];
      while (
        i < lines.length &&
        lines[i].indent === indent &&
        (lines[i].content.startsWith("- ") || lines[i].content === "-")
      ) {
        const item =
          lines[i].content === "-" ? "" : lines[i].content.slice(2).trim();
        i++;
        if (item === "") {
          arr.push(parseBlock(indent + 2));
        } else {
          arr.push(coerce(item));
        }
      }
      return arr;
    }

    const obj: Record<string, unknown> = {};
    while (
      i < lines.length &&
      lines[i].indent === indent &&
      !lines[i].content.startsWith("- ")
    ) {
      const line = lines[i].content;
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) {
        throw new Error(`YAML parse error at line '${line}'`);
      }
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      i++;
      if (value === "") {
        obj[key] = parseBlock(indent + 2);
      } else {
        obj[key] = coerce(value);
      }
    }
    return obj;
  }

  return parseBlock(0);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function loadSoul(agentId: AgentId): Promise<LoadedSoul> {
  const cached = cache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) return cached.soul;

  const soulPath = join(SOUL_DIR, `${agentId}.md`);
  const raw = await readFile(soulPath, "utf-8");
  const frontmatterText = splitFrontmatter(raw);
  const parsed = parseYaml(frontmatterText);
  const validated = SoulSchema.parse(parsed);

  const groundingPath = resolve(SOUL_DIR, validated.grounding.source_of_truth);
  const grounding_text = await readFile(groundingPath, "utf-8");

  const extras_text = await Promise.all(
    (validated.grounding.extra ?? []).map((p) =>
      readFile(resolve(SOUL_DIR, p), "utf-8"),
    ),
  );

  const loaded: LoadedSoul = {
    ...validated,
    grounding_text,
    extras_text,
    soul_path: soulPath,
  };

  cache.set(agentId, { soul: loaded, expiresAt: Date.now() + CACHE_TTL_MS });
  return loaded;
}

export function reloadSouls(): void {
  cache.clear();
}

export function renderSystemPrompt(soul: LoadedSoul): string {
  const parts: string[] = [];
  parts.push(
    `# Identity\n\nYou are ${soul.identity.name} — ${soul.identity.role}.`,
  );
  if (soul.identity.self_description) {
    parts.push(soul.identity.self_description);
  }

  // WHERE YOU ARE — platform/company/design identity injected from native_home
  if (soul.native_home) {
    parts.push(
      `## WHERE YOU ARE\n` +
        `You operate inside **${soul.native_home.platform}** — ${soul.native_home.platform_description}.\n` +
        `You work for **${soul.native_home.company}** — ${soul.native_home.company_description}.\n` +
        `The design system is **${soul.native_home.design_system}** — ${soul.native_home.design_description}.\n` +
        `You run on **${soul.native_home.model}** (${soul.native_home.model_company}), provisioned via ${soul.native_home.model_provider}.`,
    );
  }

  parts.push(`## Scope\n${soul.scope.map((s) => `- ${s}`).join("\n")}`);
  parts.push(
    `## Constraints\n${soul.constraints.map((s) => `- ${s}`).join("\n")}`,
  );
  parts.push(`## Voice\n${soul.voice_style}`);
  parts.push(`## Tools\n${soul.tools.map((t) => `- ${t}`).join("\n")}`);
  parts.push(
    `## Handoff Rules\n${soul.handoff_rules.map((r) => `- ${r}`).join("\n")}`,
  );
  parts.push(
    `## Memory Policy\nWrites: ${soul.memory_policy.writes.join(", ")}`,
  );
  parts.push(
    `## Grounding — Project CLAUDE.md (source of personal truth)\n\n${soul.grounding_text}`,
  );
  for (const extra of soul.extras_text) {
    parts.push(extra);
  }
  return parts.join("\n\n");
}
