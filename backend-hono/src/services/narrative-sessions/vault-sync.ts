import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureDeskVault,
  sanitizeDeskId,
  sectionRoot,
} from "../file-room/paths.js";
import type { NarrativeSessionDetail } from "./types.js";

export function enqueueNarrativeSessionVaultSync(
  session: NarrativeSessionDetail,
): void {
  if (!session.desk) return;
  void syncNarrativeSessionToVault(session).catch((error) => {
    console.warn(
      `[DeskVault] narrative sync failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });
}

async function syncNarrativeSessionToVault(
  session: NarrativeSessionDetail,
): Promise<void> {
  if (!session.desk) return;
  await ensureDeskVault(session.desk);
  const deskSlug = sanitizeDeskId(session.desk.slug || session.desk.id);
  await Promise.all([
    writeWorkspaceNote(deskSlug, session),
    writeTagNote(deskSlug, session),
  ]);
}

async function writeWorkspaceNote(
  deskSlug: string,
  session: NarrativeSessionDetail,
): Promise<void> {
  const root = sectionRoot(deskSlug, "narrative-workspaces");
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, `${safeSlug(session.title)}-${session.id}.md`),
    [
      "---",
      `type: "narrative-workspace"`,
      `session_id: ${JSON.stringify(session.id)}`,
      `desk_id: ${JSON.stringify(session.deskId)}`,
      `title: ${JSON.stringify(session.title)}`,
      `status: ${JSON.stringify(session.status)}`,
      `updated_at: ${JSON.stringify(session.updatedAt)}`,
      `tags: ${yamlList(["fintheon", "narrativeflow", ...tagNames(session)])}`,
      "---",
      "",
      `# ${session.title}`,
      "",
      `Desk: ${session.desk?.name ?? session.deskId}`,
      `Status: ${session.status}`,
      `Updated: ${session.updatedAt}`,
      "",
      "## Narrative Tags",
      "",
      bulletList(tagNames(session)),
      "",
      "## RiskFlow Catalysts",
      "",
      bulletList(catalystIds(session)),
      "",
      "## Latest Workspace Notes",
      "",
      workspaceSummary(session),
    ].join("\n"),
  );
}

async function writeTagNote(
  deskSlug: string,
  session: NarrativeSessionDetail,
): Promise<void> {
  const tags = tagNames(session);
  if (tags.length === 0) return;
  const root = sectionRoot(deskSlug, "narrative-tags");
  await mkdir(root, { recursive: true });
  await Promise.all(
    tags.map((tag) =>
      writeFile(
        join(root, `${safeSlug(tag)}.md`),
        [
          "---",
          `type: "narrative-tag"`,
          `tag: ${JSON.stringify(tag)}`,
          `updated_at: ${JSON.stringify(new Date().toISOString())}`,
          `tags: ${yamlList(["fintheon", "narrative-tag", tag])}`,
          "---",
          "",
          `# ${tag}`,
          "",
          "## Linked Workspaces",
          "",
          `- [[../Narrative Workspaces/${safeSlug(session.title)}-${session.id}|${session.title}]]`,
        ].join("\n"),
      ),
    ),
  );
}

function workspaceSummary(session: NarrativeSessionDetail): string {
  const docs = session.artifacts.docs?.payload;
  const summary = String(docs?.summary ?? docs?.synthesisSummary ?? "").trim();
  if (summary) return summary;
  const latest = session.messages.at(-1) as { content?: unknown } | undefined;
  return String(latest?.content ?? "No workspace summary captured yet.");
}

function tagNames(session: NarrativeSessionDetail): string[] {
  return Array.from(
    new Set(
      session.tags.map((tag) => String(tag.tag ?? "").trim()).filter(Boolean),
    ),
  );
}

function catalystIds(session: NarrativeSessionDetail): string[] {
  return session.catalysts
    .map((item) => String(item.riskflowItemId ?? item.riskflow_item_id ?? ""))
    .filter(Boolean);
}

function bulletList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function yamlList(items: string[]): string {
  return `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;
}

function safeSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "narrative";
}
