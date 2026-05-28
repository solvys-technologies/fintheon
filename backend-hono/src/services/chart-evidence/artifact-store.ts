import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  sanitizeDeskId,
  sectionRoot,
  ensureDeskFolders,
} from "../file-room/paths.js";
import {
  parseMarkdown,
  stringifyMarkdown,
} from "../file-room/markdown.js";
import type { ChartArtifact } from "./types.js";

export async function storeArtifact(
  artifact: ChartArtifact,
): Promise<ChartArtifact> {
  const deskId = sanitizeDeskId(artifact.deskId);
  await ensureDeskFolders(deskId);
  const id =
    artifact.id ||
    `chart-${Date.now()}-${hash(artifact.ticker).slice(0, 8)}`;
  const now = new Date().toISOString();
  const stored: ChartArtifact = {
    ...artifact,
    id,
    deskId,
    createdAt: artifact.createdAt || now,
    updatedAt: now,
  };
  await writeFile(
    join(sectionRoot(deskId, "chart-evidence"), `${id}.md`),
    encode(stored),
    "utf8",
  );
  return stored;
}

export async function fulfillArtifact(
  id: string,
  deskId: string,
  path: string,
  url: string | null,
): Promise<ChartArtifact | null> {
  const current = await readArtifact(id, deskId);
  if (!current) return null;
  return storeArtifact({
    ...current,
    path,
    url: url ?? null,
    capturedAt: new Date().toISOString(),
    status: "captured",
  });
}

export async function getArtifactsForMemo(
  memoId: string,
  deskId = "priced-in-capital",
): Promise<ChartArtifact[]> {
  const all = await listArtifacts(deskId);
  return all.filter((item) => item.memoId === memoId);
}

export async function listArtifacts(
  deskId = "priced-in-capital",
): Promise<ChartArtifact[]> {
  const root = sectionRoot(sanitizeDeskId(deskId), "chart-evidence");
  const files = await readdir(root, { withFileTypes: true }).catch(() => []);
  const items = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const raw = await readFile(join(root, entry.name), "utf8");
        return decode(raw, deskId);
      }),
  );
  return items
    .filter(Boolean)
    .sort((a, b) =>
      (b?.updatedAt ?? "").localeCompare(a?.updatedAt ?? ""),
    ) as ChartArtifact[];
}

async function readArtifact(
  id: string,
  deskId: string,
): Promise<ChartArtifact | null> {
  const root = sectionRoot(sanitizeDeskId(deskId), "chart-evidence");
  const raw = await readFile(join(root, `${id}.md`), "utf8").catch(() => null);
  if (!raw) return null;
  return decode(raw, deskId);
}

function encode(artifact: ChartArtifact): string {
  return stringifyMarkdown(
    {
      id: artifact.id,
      ticker: artifact.ticker,
      timeframe: artifact.timeframe,
      source: artifact.source,
      status: artifact.status,
      capturedAt: artifact.capturedAt,
      path: artifact.path,
      url: artifact.url,
      memoId: artifact.memoId,
      deskId: artifact.deskId,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    },
    `# Chart Evidence: ${artifact.ticker}\n\nTimeframe: ${artifact.timeframe}  \nStatus: ${artifact.status}`,
  );
}

function decode(raw: string, deskId: string): ChartArtifact | null {
  const { frontmatter } = parseMarkdown(raw);
  if (!frontmatter.id || !frontmatter.ticker) return null;
  return {
    id: frontmatter.id,
    ticker: frontmatter.ticker,
    timeframe: frontmatter.timeframe ?? "1D",
    source: frontmatter.source ?? "chart-evidence",
    capturedAt: frontmatter.capturedAt ?? null,
    path: frontmatter.path ?? null,
    url: frontmatter.url ?? null,
    status: normalizeStatus(frontmatter.status),
    memoId: frontmatter.memoId ?? null,
    deskId: frontmatter.deskId ?? deskId,
    createdAt: frontmatter.createdAt ?? "",
    updatedAt: frontmatter.updatedAt ?? "",
  };
}

function normalizeStatus(
  value?: string,
): ChartArtifact["status"] {
  if (value === "captured") return "captured";
  if (value === "unavailable") return "unavailable";
  return "pending";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
