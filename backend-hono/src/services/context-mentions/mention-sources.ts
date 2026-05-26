// [codex 2026-05-23] Safe mention inventory for chat drawers.
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import { getSupabaseClient } from "../../config/supabase.js";
import { listDocuments } from "../documents/doc-store.js";
import { listAllSkills } from "../skills/registry.js";
import * as themeStore from "../theme-tracker/persistence.js";
import { getFeed } from "../riskflow/feed-service.js";
import { listFileRoom } from "../file-room/index.js";

export type MentionType =
  | "document"
  | "skill"
  | "connector"
  | "narrative"
  | "theme"
  | "riskflow"
  | "instrument"
  | "vault"
  | "memo"
  | "chart"
  | "agent";

export interface MentionItem {
  id: string;
  type: MentionType;
  label: string;
  subtitle: string;
  preview: string;
  source: string;
  referenceId: string;
  tags: string[];
  updatedAt: string | null;
}

export interface MentionQuery {
  q?: string;
  type?: MentionType | "all";
  deskId?: string;
  limit: number;
}

const instruments = [
  ["MNQ", "Micro Nasdaq futures"],
  ["NQ", "Nasdaq-100 futures"],
  ["ES", "S&P 500 futures"],
  ["YM", "Dow futures"],
  ["RTY", "Russell 2000 futures"],
  ["VIX", "Volatility index"],
  ["DXY", "U.S. Dollar Index"],
  ["US02Y", "U.S. 2Y yield"],
  ["US10Y", "U.S. 10Y yield"],
  ["GC", "Gold futures"],
  ["CL", "Crude oil futures"],
] as const;

const connectors = [
  ["riskflow", "RiskFlow", "Internal catalyst and headline connector"],
  ["tradingview", "TradingView", "Chart, calendar, and scanner context"],
  ["playwright", "Playwright", "Browser automation connector"],
  ["exa", "Exa", "Web research connector"],
  ["fmp", "FMP", "Market data connector"],
] as const;

function matches(item: MentionItem, query: MentionQuery): boolean {
  if (query.type && query.type !== "all" && item.type !== query.type)
    return false;
  const needle = query.q?.trim().toLowerCase();
  if (!needle) return true;
  return `${item.label} ${item.subtitle} ${item.preview} ${item.tags.join(" ")}`
    .toLowerCase()
    .includes(needle);
}

function sortMentions(a: MentionItem, b: MentionItem): number {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  if (aTime !== bTime) return bTime - aTime;
  return a.label.localeCompare(b.label);
}

export async function listMentions(
  query: MentionQuery,
): Promise<MentionItem[]> {
  const groups = await Promise.all([
    readDocuments(query),
    readSkills(),
    readConnectors(),
    readThemes(),
    readNarratives(query),
    readRiskFlow(),
    readInstruments(),
    readFileRoomMentions(query),
    readVaultNotes(),
  ]);
  return groups
    .flat()
    .filter((item) => matches(item, query))
    .sort(sortMentions)
    .slice(0, query.limit);
}

async function readDocuments(query: MentionQuery): Promise<MentionItem[]> {
  const documents = await listDocuments({ deskId: query.deskId, limit: 40 });
  return documents.map((doc) => ({
    id: `document:${doc.id}`,
    type: "document",
    label: doc.title,
    subtitle: doc.deskId ? `Workspace doc · ${doc.deskId}` : "Workspace doc",
    preview: doc.tags.length ? doc.tags.join(", ") : "Document available",
    source: "documents",
    referenceId: doc.id,
    tags: doc.tags,
    updatedAt: doc.updatedAt,
  }));
}

async function readSkills(): Promise<MentionItem[]> {
  const skills = await listAllSkills().catch(() => []);
  return skills.slice(0, 40).map((entry) => ({
    id: `skill:${entry.manifest.id}`,
    type: "skill",
    label: entry.manifest.name ?? entry.manifest.id,
    subtitle: `${entry.origin} skill`,
    preview: entry.manifest.description ?? "Agent skill",
    source: "skills",
    referenceId: entry.manifest.id,
    tags: [entry.origin, entry.status ?? "available"].filter(Boolean),
    updatedAt: null,
  }));
}

async function readConnectors(): Promise<MentionItem[]> {
  return connectors.map(([id, name, description]) => ({
    id: `connector:${id}`,
    type: "connector",
    label: name,
    subtitle: "Connector",
    preview: description,
    source: "connectors",
    referenceId: id,
    tags: ["connector"],
    updatedAt: null,
  }));
}

async function readThemes(): Promise<MentionItem[]> {
  return themeStore.listThemes().map((theme) => ({
    id: `theme:${theme.id}`,
    type: "theme",
    label: theme.name,
    subtitle: `${theme.status} theme · IPV ${Math.round(theme.ipv * 100)}`,
    preview: `${theme.catalystIds.length} linked catalysts`,
    source: "theme-tracker",
    referenceId: theme.id,
    tags: [theme.status.toLowerCase(), "theme"],
    updatedAt: theme.updatedAt,
  }));
}

async function readNarratives(query: MentionQuery): Promise<MentionItem[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  let request = sb
    .from("narrative_sessions")
    .select("id,title,desk_id,updated_at,color")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (query.deskId) request = request.eq("desk_id", query.deskId);
  const { data } = await request;
  return (data ?? []).map((row) => ({
    id: `narrative:${row.id}`,
    type: "narrative",
    label: String(row.title ?? "Untitled narrative"),
    subtitle: "NarrativeFlow session",
    preview: row.desk_id ? `Desk ${row.desk_id}` : "Narrative session",
    source: "narrative-sessions",
    referenceId: String(row.id),
    tags: ["narrative"],
    updatedAt: String(row.updated_at ?? ""),
  }));
}

async function readRiskFlow(): Promise<MentionItem[]> {
  const feed = await getFeed("system", { limit: 40 }).catch(() => null);
  return (feed?.items ?? []).map((item) => ({
    id: `riskflow:${item.id}`,
    type: "riskflow",
    label: item.headline,
    subtitle: `${item.source} · IV ${item.ivScore?.toFixed(1) ?? "n/a"}`,
    preview: item.agentNote ?? item.body ?? "RiskFlow headline",
    source: "riskflow",
    referenceId: item.id,
    tags: [...(item.symbols ?? []), ...(item.tags ?? [])].slice(0, 8),
    updatedAt: item.publishedAt,
  }));
}

async function readInstruments(): Promise<MentionItem[]> {
  return instruments.map(([symbol, description]) => ({
    id: `instrument:${symbol}`,
    type: "instrument",
    label: symbol,
    subtitle: "Instrument",
    preview: description,
    source: "market-watchlist",
    referenceId: symbol,
    tags: ["instrument"],
    updatedAt: null,
  }));
}

async function readVaultNotes(): Promise<MentionItem[]> {
  const root = process.env.OBSIDIAN_VAULT_PATH;
  if (!root || !existsSync(root)) return [];
  const files = await collectMarkdown(root, 2, 40).catch(() => []);
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(file, "utf8").catch(() => "");
      const title =
        raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
        file.split("/").pop() ||
        "Vault note";
      const rel = relative(root, file);
      return {
        id: `vault:${rel}`,
        type: "vault" as const,
        label: title,
        subtitle: "Obsidian vault note",
        preview: rel,
        source: "obsidian",
        referenceId: rel,
        tags: ["vault", "memory"],
        updatedAt: null,
      };
    }),
  );
}

async function readFileRoomMentions(
  query: MentionQuery,
): Promise<MentionItem[]> {
  const fileRoom = await listFileRoom(query.deskId).catch(() => null);
  if (!fileRoom) return [];
  return fileRoom.sections.flatMap((section) =>
    section.items.slice(0, 30).map((item) => ({
      id: `file-room:${item.id}`,
      type: mentionTypeForFileRoomSection(item.sectionId),
      label: item.title,
      subtitle: `${section.title} · ${fileRoom.desk.name}`,
      preview: item.summary || item.excerpt || item.path,
      source: "file-room",
      referenceId: item.id,
      tags: [...item.tags, ...item.tickers, item.kind].filter(Boolean),
      updatedAt: item.updatedAt,
    })),
  );
}

function mentionTypeForFileRoomSection(sectionId: string): MentionType {
  if (sectionId === "agentic-memos") return "memo";
  if (sectionId === "chart-evidence") return "chart";
  if (sectionId === "agent-souls") return "agent";
  return "vault";
}

async function collectMarkdown(
  root: string,
  depth: number,
  cap: number,
): Promise<string[]> {
  if (depth < 0 || cap <= 0) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (out.length >= cap) break;
    if (entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectMarkdown(full, depth - 1, cap - out.length)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}
