import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DESK_ID, sectionRoot } from "../../file-room/paths.js";
import { stringifyMarkdown } from "../../file-room/markdown.js";
import type { AgentId } from "../../agent-memory/types.js";

const AGENT_LABEL: Record<AgentId, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

const FILES = {
  soul: "SOUL.md",
  system: "System Prompt.streamdown.md",
  reflections: "Reflections.streamdown.md",
  growth: "Growth Addendum.streamdown.md",
  gepa: "GEPA Proposals.streamdown.md",
} as const;

const GENERATED_PLACEHOLDER = "No active Fileroom prompt deltas yet.";
const SOUL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../soul");

export interface ReflectionInput {
  agentId: AgentId;
  topic?: string | null;
  insight: string;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
}

export function hasAgentMemoryUpdateIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  const phraseHit = [
    "update your memory",
    "update memory",
    "remember this",
    "remember that",
    "remember me",
    "make a note",
    "write this down",
    "save that",
    "save this to memory",
    "add this to your memory",
    "store this in memory",
    "put this in memory",
    "update your soul",
    "update your system prompt",
    "update your fileroom",
    "add this to your soul",
    "put this in your soul",
    "learn this for next time",
  ].some((phrase) => normalized.includes(phrase));
  return (
    phraseHit ||
    /\b(remember|save|store|learn)\b.{0,36}\b(next time|future|memory|soul|system prompt)\b/.test(
      normalized,
    )
  );
}

export async function renderFileroomPromptLayer(
  agentId: AgentId,
): Promise<string> {
  await ensureAgentPromptVault(agentId);
  const [system, growth] = await Promise.all([
    readBody(agentFile(agentId, FILES.system)),
    readBody(agentFile(agentId, FILES.growth)),
  ]);
  const parts: string[] = [];
  if (isMeaningful(system)) {
    parts.push(`## Fileroom System Prompt\n${system}`);
  }
  if (isMeaningful(growth)) {
    parts.push(`## Fileroom Growth Addendum\n${growth}`);
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

export async function recordAgentReflection(
  input: ReflectionInput,
): Promise<void> {
  const insight = input.insight.trim();
  if (!insight) throw new Error("Reflection insight is required");

  await ensureAgentPromptVault(input.agentId);
  const timestamp = new Date().toISOString();
  const eventId = `${input.agentId}-${Date.now().toString(36)}`;
  const topic = input.topic?.trim() || "agent-reflection";
  const confidence =
    typeof input.confidence === "number"
      ? ` confidence=${input.confidence.toFixed(2)}`
      : "";
  const provenance = {
    eventId,
    source: "fintheon-fileroom",
    agentId: input.agentId,
    topic,
    ...(input.metadata ?? {}),
  };
  const reflection = [
    `## ${timestamp} — ${topic}`,
    "",
    `${insight}${confidence}`,
    "",
    `provenance: ${JSON.stringify(provenance)}`,
  ].join("\n");

  await appendSection(agentFile(input.agentId, FILES.reflections), reflection);
  await appendSection(
    agentFile(input.agentId, FILES.growth),
    `- ${timestamp}: ${topic} — ${insight} [provenance:${eventId}]`,
  );
  await appendSection(
    agentFile(input.agentId, FILES.system),
    `## Reflection Update — ${timestamp}\n- ${topic}: ${insight}\n- provenance: ${eventId}`,
  );

  if (shouldAppendToSoulMemory(input)) {
    await appendSection(
      agentFile(input.agentId, FILES.soul),
      [
        `## Relationship Memory — ${timestamp}`,
        "",
        `- ${insight}`,
        `- provenance: ${eventId}`,
      ].join("\n"),
    );
  }

  if (shouldOpenGepaProposal(input)) {
    await appendSection(
      agentFile(input.agentId, FILES.gepa),
      [
        `## Proposal — ${timestamp}`,
        "",
        `Agent: ${input.agentId}`,
        `Trigger: ${topic}`,
        `Candidate durable change: ${insight}`,
        `Provenance: ${eventId}`,
        "",
        "Review before promoting into canonical SOUL.",
      ].join("\n"),
    );
  }
}

export async function ensureAgentPromptVault(agentId: AgentId): Promise<void> {
  await mkdir(agentRoot(agentId), { recursive: true });
  await Promise.all([
    ensureSoulMirror(agentId),
    ensureMarkdownFile(agentId, FILES.system, "system-prompt", [
      GENERATED_PLACEHOLDER,
    ]),
    ensureMarkdownFile(agentId, FILES.reflections, "reflections", [
      "Append-only reflections land here.",
    ]),
    ensureMarkdownFile(agentId, FILES.growth, "growth-addendum", [
      GENERATED_PLACEHOLDER,
    ]),
    ensureMarkdownFile(agentId, FILES.gepa, "gepa-proposals", [
      "Durable SOUL changes require review before promotion.",
    ]),
  ]);
}

function agentRoot(agentId: AgentId): string {
  return join(
    sectionRoot(DEFAULT_DESK_ID, "agent-souls"),
    AGENT_LABEL[agentId],
  );
}

function agentFile(agentId: AgentId, fileName: string): string {
  return join(agentRoot(agentId), fileName);
}

async function ensureSoulMirror(agentId: AgentId): Promise<void> {
  const target = agentFile(agentId, FILES.soul);
  if (existsSync(target)) return;
  const bundled = await readFile(join(SOUL_DIR, `${agentId}.md`), "utf8").catch(
    () => null,
  );
  await atomicWrite(
    target,
    bundled ??
      stringifyMarkdown(
        frontmatter(agentId, "soul"),
        `# ${AGENT_LABEL[agentId]} SOUL\n\nFileroom SOUL mirror pending seed.`,
      ),
  );
}

async function ensureMarkdownFile(
  agentId: AgentId,
  fileName: string,
  artifactType: string,
  body: string[],
): Promise<void> {
  const target = agentFile(agentId, fileName);
  if (existsSync(target)) return;
  await atomicWrite(
    target,
    stringifyMarkdown(frontmatter(agentId, artifactType), body.join("\n")),
  );
}

function frontmatter(
  agentId: AgentId,
  artifactType: string,
): Record<string, string> {
  return {
    type: artifactType,
    agent_id: agentId,
    updated_at: new Date().toISOString(),
    source: "fintheon-fileroom",
  };
}

async function readBody(path: string): Promise<string> {
  const raw = await readFile(path, "utf8").catch(() => "");
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function isMeaningful(body: string): boolean {
  const trimmed = body.trim();
  return Boolean(trimmed) && trimmed !== GENERATED_PLACEHOLDER;
}

async function appendSection(path: string, section: string): Promise<void> {
  const raw = await readFile(path, "utf8").catch(() => "");
  const base = touchUpdatedAt(removeGeneratedPlaceholder(raw)).trim();
  const next = `${base}\n\n${section.trim()}\n`;
  await atomicWrite(path, next);
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, content, "utf8");
  await rename(temp, path);
}

function removeGeneratedPlaceholder(raw: string): string {
  return raw.replace(GENERATED_PLACEHOLDER, "").replace(/\n{3,}/g, "\n\n");
}

function touchUpdatedAt(raw: string): string {
  const timestamp = new Date().toISOString();
  if (!raw.startsWith("---\n")) return raw;
  return raw.replace(/^---\n([\s\S]*?)\n---/, (_match, body: string) => {
    const lines = body.split("\n");
    let found = false;
    const next = lines.map((line) => {
      if (!line.startsWith("updated_at:")) return line;
      found = true;
      return `updated_at: ${timestamp}`;
    });
    if (!found) next.push(`updated_at: ${timestamp}`);
    return `---\n${next.join("\n")}\n---`;
  });
}

function shouldOpenGepaProposal(input: ReflectionInput): boolean {
  const text = `${input.topic ?? ""} ${input.insight}`.toLowerCase();
  return (
    /soul|identity|system prompt|commandment|rubric|always|never|strategy/.test(
      text,
    ) || (input.confidence ?? 0) >= 0.88
  );
}

function shouldAppendToSoulMemory(input: ReflectionInput): boolean {
  const topic = input.topic?.toLowerCase() ?? "";
  return (
    topic.includes("user-directed-memory-update") ||
    hasAgentMemoryUpdateIntent(input.insight)
  );
}
