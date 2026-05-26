// [codex 2026-05-23] Export scored RiskFlow catalysts into an Obsidian vault.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

interface CatalystRow {
  tweet_id: string;
  source: string | null;
  headline: string | null;
  body: string | null;
  url: string | null;
  symbols: string[] | null;
  tags: string[] | null;
  sentiment: string | null;
  iv_score: number | null;
  macro_level: number | null;
  published_at: string | null;
  promoted_at: string | null;
  category: string | null;
  status: string | null;
  risk_type: string | null;
  market_impact: unknown;
  agent_note: string | null;
  created_at: string | null;
}

interface CatalystRelation {
  riskflow_item_id: string;
  role: string | null;
  conflict_label: string | null;
  session_id: string | null;
  session_title: string | null;
  desk_id: string | null;
  desk_name: string | null;
  desk_slug: string | null;
  session_tags: string[] | null;
}

interface NarrativeDeskRow {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  created_by: string | null;
}

interface CatalystBankRow {
  user_id: string;
  desk_id: string | null;
  desk_name: string | null;
  desk_slug: string | null;
  narrative_session_id: string | null;
  session_title: string | null;
  riskflow_item_id: string;
  role: string | null;
  tags: string[] | null;
  desk_fit: string | null;
  status: string | null;
  notes: string | null;
  updated_at: string | null;
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function vaultPath(): string {
  const explicit =
    arg("vault") ??
    process.env.OBSIDIAN_RISKFLOW_VAULT_PATH ??
    process.env.OBSIDIAN_CATALYST_VAULT_PATH;
  if (explicit) return resolve(explicit);
  if (process.env.OBSIDIAN_VAULT_PATH) {
    return resolve(process.env.OBSIDIAN_VAULT_PATH, "RiskFlow Main Vault");
  }
  return resolve(homedir(), "Documents", "Obsidian", "RiskFlow Main Vault");
}

function limitValue(): number | null {
  const raw = arg("limit");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function traderName(): string {
  return (
    arg("trader") ??
    arg("user") ??
    process.env.FINTHEON_TRADER_NAME ??
    "TP"
  ).trim();
}

function dateStamp(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "undated";
  return date.toISOString().slice(0, 10);
}

function monthStamp(value?: string | null): string {
  const stamp = dateStamp(value);
  return stamp === "undated" ? "undated" : stamp.slice(0, 7);
}

function safeSlug(value: string, fallback = "item"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function yamlValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function frontmatter(data: Record<string, unknown>): string {
  return `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join("\n")}\n---`;
}

function noteName(row: CatalystRow): string {
  return `${dateStamp(row.published_at)}-${safeSlug(row.tweet_id)}-${safeSlug(row.headline ?? "catalyst")}.md`;
}

async function readCatalysts(client: pg.Client): Promise<CatalystRow[]> {
  const params: unknown[] = [];
  const filters: string[] = [];
  const since = arg("since");
  if (since) {
    params.push(since);
    filters.push(`published_at >= $${params.length}`);
  }
  const limit = limitValue();
  const limitSql = limit ? `LIMIT $${params.push(limit)}` : "";
  const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const { rows } = await client.query<CatalystRow>(
    `SELECT tweet_id, source, headline, body, url, symbols, tags, sentiment,
            iv_score, macro_level, published_at, promoted_at, category,
            status, risk_type, market_impact, agent_note, created_at
       FROM scored_riskflow_items
      ${whereSql}
      ORDER BY published_at DESC NULLS LAST, created_at DESC NULLS LAST
      ${limitSql}`,
    params,
  );
  return rows;
}

async function readRelations(
  client: pg.Client,
  ids: string[],
): Promise<Map<string, CatalystRelation[]>> {
  const map = new Map<string, CatalystRelation[]>();
  if (ids.length === 0) return map;
  const { rows } = await client.query<CatalystRelation>(
    `SELECT nsc.riskflow_item_id,
            nsc.role,
            nsc.conflict_label,
            ns.id AS session_id,
            ns.title AS session_title,
            nd.id AS desk_id,
            nd.name AS desk_name,
            nd.slug AS desk_slug,
            COALESCE(array_remove(array_agg(DISTINCT nst.tag), NULL), '{}') AS session_tags
       FROM narrative_session_catalysts nsc
       LEFT JOIN narrative_sessions ns ON ns.id = nsc.session_id
       LEFT JOIN narrative_desks nd ON nd.id = ns.desk_id
       LEFT JOIN narrative_session_tags nst ON nst.session_id = ns.id
      WHERE nsc.riskflow_item_id = ANY($1::text[])
      GROUP BY nsc.riskflow_item_id, nsc.role, nsc.conflict_label,
               ns.id, ns.title, nd.id, nd.name, nd.slug`,
    [ids],
  );
  for (const row of rows) {
    const list = map.get(row.riskflow_item_id) ?? [];
    list.push(row);
    map.set(row.riskflow_item_id, list);
  }
  return map;
}

async function readNarrativeDesks(
  client: pg.Client,
): Promise<NarrativeDeskRow[]> {
  try {
    const { rows } = await client.query<NarrativeDeskRow>(
      `SELECT id, name, slug, color, created_by
         FROM narrative_desks
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
    );
    return rows;
  } catch (error) {
    console.warn(
      `[CatalystVault] narrative_desks unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

async function readCatalystBankRows(
  client: pg.Client,
): Promise<CatalystBankRow[]> {
  try {
    const { rows } = await client.query<CatalystBankRow>(
      `SELECT bank.user_id,
              bank.desk_id,
              desk.name AS desk_name,
              desk.slug AS desk_slug,
              bank.narrative_session_id,
              session.title AS session_title,
              bank.riskflow_item_id,
              bank.role,
              bank.tags,
              bank.desk_fit,
              bank.status,
              bank.notes,
              bank.updated_at
         FROM narrative_user_catalyst_bank bank
         LEFT JOIN narrative_desks desk ON desk.id = bank.desk_id
         LEFT JOIN narrative_sessions session ON session.id = bank.narrative_session_id
        ORDER BY bank.updated_at DESC NULLS LAST
        LIMIT 1000`,
    );
    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("narrative_user_catalyst_bank")) return [];
    console.warn(`[CatalystVault] catalyst bank unavailable: ${message}`);
    return [];
  }
}

async function writeCatalystNote(
  root: string,
  row: CatalystRow,
  relations: CatalystRelation[],
): Promise<string> {
  const symbols = row.symbols ?? [];
  const tags = row.tags ?? [];
  const sessionTags = Array.from(
    new Set(relations.flatMap((rel) => rel.session_tags ?? [])),
  );
  const deskSlugs = Array.from(
    new Set(relations.map((rel) => rel.desk_slug).filter(Boolean)),
  );
  const narrativeTitles = Array.from(
    new Set(relations.map((rel) => rel.session_title).filter(Boolean)),
  );
  const relativePath = join(
    "Catalysts",
    monthStamp(row.published_at),
    noteName(row),
  );
  const fullPath = join(root, relativePath);
  await mkdir(join(root, "Catalysts", monthStamp(row.published_at)), {
    recursive: true,
  });
  const body = [
    frontmatter({
      id: row.tweet_id,
      type: "riskflow-catalyst",
      source: row.source ?? "riskflow",
      url: row.url,
      published_at: row.published_at,
      promoted_at: row.promoted_at,
      iv_score: row.iv_score,
      macro_level: row.macro_level,
      sentiment: row.sentiment,
      category: row.category,
      status: row.status,
      risk_type: row.risk_type,
      symbols,
      tags: ["fintheon", "riskflow", "catalyst", ...tags, ...sessionTags],
      desks: deskSlugs,
      narratives: narrativeTitles,
      generated_at: new Date().toISOString(),
    }),
    "",
    `# ${safeText(row.headline) || "Untitled Catalyst"}`,
    "",
    `Source: ${row.source ?? "riskflow"}${row.url ? ` · ${row.url}` : ""}`,
    `Published: ${row.published_at ?? "unknown"}`,
    `IV Score: ${row.iv_score ?? "n/a"} · Macro Level: ${row.macro_level ?? "n/a"} · Sentiment: ${row.sentiment ?? "n/a"}`,
    "",
    "## Catalyst",
    "",
    safeText(row.body) || safeText(row.headline),
    "",
    row.agent_note ? "## Agent Note\n\n" + safeText(row.agent_note) + "\n" : "",
    row.market_impact
      ? "## Market Impact\n\n```json\n" +
        JSON.stringify(row.market_impact, null, 2) +
        "\n```\n"
      : "",
    "## Desk And Narrative Assignments",
    "",
    relations.length > 0
      ? relations
          .map((rel) => {
            const desk = rel.desk_slug
              ? `[[Desks/${rel.desk_slug}|${rel.desk_name ?? rel.desk_slug}]]`
              : "Unassigned desk";
            const narrative = rel.session_id
              ? `[[Narratives/${safeSlug(rel.session_title ?? rel.session_id)}-${rel.session_id}|${rel.session_title ?? rel.session_id}]]`
              : "Unassigned narrative";
            return `- ${desk} -> ${narrative} (${rel.role ?? "supporting"})`;
          })
          .join("\n")
      : "- Unassigned. Available for NF-Workspace catalyst bank search and desk fit tagging.",
    "",
    "## Agent Use",
    "",
    "- Pull this note when an NF-Workspace session needs default RiskFlow catalyst context.",
    "- Assign it to a narrative session when it becomes anchor, supporting, confirming, conflicting, or watchlist evidence.",
    "- Add desk-fit tags in the user catalyst bank before presenting bespoke desk context.",
  ]
    .filter(Boolean)
    .join("\n");
  await writeFile(fullPath, body);
  return relativePath;
}

async function writeIndexes(
  root: string,
  catalysts: CatalystRow[],
  relationsById: Map<string, CatalystRelation[]>,
  notePaths: Map<string, string>,
): Promise<void> {
  await mkdir(join(root, "Desks"), { recursive: true });
  await mkdir(join(root, "Narratives"), { recursive: true });
  await mkdir(join(root, "Tags"), { recursive: true });

  const indexRows = catalysts.slice(0, 500).map((row) => {
    const note = notePaths.get(row.tweet_id) ?? "";
    return `| [[${note}|${safeText(row.headline).replace(/\|/g, "/") || row.tweet_id}]] | ${row.iv_score ?? "n/a"} | ${row.macro_level ?? "n/a"} | ${(row.symbols ?? []).join(", ")} | ${row.published_at ?? ""} |`;
  });
  await writeFile(
    join(root, "Index.md"),
    [
      frontmatter({
        type: "riskflow-main-vault-index",
        generated_at: new Date().toISOString(),
        total_catalysts: catalysts.length,
        tags: ["fintheon", "riskflow", "main-vault"],
      }),
      "",
      "# RiskFlow Main Vault",
      "",
      `Catalysts exported: ${catalysts.length}`,
      "",
      "## Latest Catalysts",
      "",
      "| Catalyst | IV | Macro | Symbols | Published |",
      "| --- | ---: | ---: | --- | --- |",
      ...indexRows,
    ].join("\n"),
  );

  const byDesk = new Map<string, string[]>();
  const byNarrative = new Map<string, string[]>();
  const byTag = new Map<string, string[]>();

  for (const row of catalysts) {
    const note = notePaths.get(row.tweet_id);
    if (!note) continue;
    for (const tag of row.tags ?? []) {
      const key = safeSlug(tag);
      byTag.set(key, [...(byTag.get(key) ?? []), note]);
    }
    for (const rel of relationsById.get(row.tweet_id) ?? []) {
      if (rel.desk_slug)
        byDesk.set(rel.desk_slug, [...(byDesk.get(rel.desk_slug) ?? []), note]);
      if (rel.session_id) {
        const key = `${safeSlug(rel.session_title ?? rel.session_id)}-${rel.session_id}`;
        byNarrative.set(key, [...(byNarrative.get(key) ?? []), note]);
      }
    }
  }

  await Promise.all([
    ...Array.from(byDesk.entries()).map(([slug, notes]) =>
      writeLinkIndex(
        join(root, "Desks", `${slug}.md`),
        "Desk Catalyst Index",
        notes,
      ),
    ),
    ...Array.from(byNarrative.entries()).map(([slug, notes]) =>
      writeLinkIndex(
        join(root, "Narratives", `${slug}.md`),
        "Narrative Catalyst Index",
        notes,
      ),
    ),
    ...Array.from(byTag.entries())
      .slice(0, 200)
      .map(([slug, notes]) =>
        writeLinkIndex(
          join(root, "Tags", `${slug}.md`),
          "Catalyst Tag Index",
          notes,
        ),
      ),
  ]);
}

async function writeNarrativeBuilder(
  root: string,
  catalysts: CatalystRow[],
  desks: NarrativeDeskRow[],
  bankRows: CatalystBankRow[],
  notePaths: Map<string, string>,
): Promise<void> {
  await mkdir(join(root, "Narrative Builder"), { recursive: true });
  await mkdir(join(root, "Narratives", "Drafts"), { recursive: true });
  await mkdir(join(root, "Templates"), { recursive: true });
  await mkdir(join(root, "Trader Banks"), { recursive: true });
  await mkdir(join(root, "Desk Workspaces"), { recursive: true });

  const trader = traderName();
  const traderSlug = safeSlug(trader, "trader");
  const latestLinks = catalysts.slice(0, 20).map((row) => {
    const note = notePaths.get(row.tweet_id);
    const label = safeText(row.headline) || row.tweet_id;
    return note ? `- [[${note}|${label}]]` : `- ${label}`;
  });

  await writeFile(
    join(root, "Narrative Builder", "Start Here.md"),
    [
      frontmatter({
        type: "narrative-builder-guide",
        generated_at: new Date().toISOString(),
        trader,
        tags: ["fintheon", "riskflow", "narrative-builder"],
      }),
      "",
      "# Narrative Builder",
      "",
      "This RiskFlow Main vault is the default, ever-growing headline database for NF-Workspace sessions. Raw headline notes live under `Catalysts/`; human narrative work should live under `Narratives/Drafts/` so future exports can refresh indexes without overwriting your thesis notes.",
      "",
      "## Workflow",
      "",
      "1. Start from `Index.md`, a desk workspace, or a trader bank.",
      "2. Pull 3-12 catalyst notes into a draft from `Templates/Narrative Brief.md`.",
      "3. Tag the narrative with desk fit, trader owner, regime, symbol, and thesis status.",
      "4. Ask a Fintheon agent to assign selected catalyst IDs to an NF-Workspace session through `/api/narrative/sessions/:id/catalyst-bank/assign`.",
      "5. Promote only narratives with a clear trigger, invalidation, and desk-specific implication.",
      "",
      "## Useful Generated Surfaces",
      "",
      "- [[Index|Latest catalyst index]]",
      `- [[Trader Banks/${traderSlug}-generated-catalyst-bank|${trader} generated catalyst bank]]`,
      "- [[Narratives/Drafts/README|Narrative drafts area]]",
      "- [[Templates/Narrative Brief|Narrative brief template]]",
      "- [[Templates/Desk Catalyst Review|Desk catalyst review template]]",
      "",
      "## Latest Catalyst Starters",
      "",
      ...latestLinks,
      "",
      "## Agent Contract",
      "",
      "When an NF-Workspace agent uses this vault, it should cite catalyst note links, preserve the user's own draft narrative text, and update database assignments through the catalyst-bank API rather than treating Obsidian as the only source of truth.",
    ].join("\n"),
  );

  await writeFile(
    join(root, "Narratives", "Drafts", "README.md"),
    [
      frontmatter({
        type: "narrative-drafts-readme",
        generated_at: new Date().toISOString(),
        tags: ["fintheon", "narrative-drafts"],
      }),
      "",
      "# Narrative Drafts",
      "",
      "Create your own desk and trader narratives here. Export runs should not write draft notes in this folder except this README.",
      "",
      "Suggested filename: `YYYY-MM-DD-desk-symbol-thesis.md`.",
      "",
      "Start from [[Templates/Narrative Brief]].",
    ].join("\n"),
  );

  await writeTemplates(root, trader);
  await writeTraderBanks(
    root,
    bankRows,
    catalysts,
    notePaths,
    traderSlug,
    trader,
  );
  await writeDeskWorkspaces(root, desks, bankRows, catalysts, notePaths);
}

async function writeTemplates(root: string, trader: string): Promise<void> {
  await writeFile(
    join(root, "Templates", "Narrative Brief.md"),
    [
      frontmatter({
        type: "narrative-brief-template",
        owner: trader,
        desk: "{{desk}}",
        status: "draft",
        conviction: "watch",
        time_horizon: "{{intraday | swing | event | regime}}",
        tags: ["fintheon", "narrative", "draft"],
      }),
      "",
      "# {{Narrative Title}}",
      "",
      "## Thesis",
      "",
      "What is the market story, and why should this desk care?",
      "",
      "## Desk Fit",
      "",
      "- Trader: " + trader,
      "- Desk:",
      "- Symbols:",
      "- Horizon:",
      "- Regime:",
      "",
      "## Catalyst Stack",
      "",
      "- [[Catalysts/...]]",
      "",
      "## Evidence For",
      "",
      "- ",
      "",
      "## Evidence Against",
      "",
      "- ",
      "",
      "## Trigger / Invalidation",
      "",
      "- Trigger:",
      "- Invalidation:",
      "- Recheck cadence:",
      "",
      "## Trading Implication",
      "",
      "What changes in sizing, bias, watchlist, or handoff?",
      "",
      "## Agent Handoff",
      "",
      "Ask Fintheon agents to use the catalyst-bank API to assign the linked catalyst IDs into the matching NF-Workspace narrative session.",
    ].join("\n"),
  );

  await writeFile(
    join(root, "Templates", "Desk Catalyst Review.md"),
    [
      frontmatter({
        type: "desk-catalyst-review-template",
        owner: trader,
        desk: "{{desk}}",
        tags: ["fintheon", "desk-review", "catalysts"],
      }),
      "",
      "# {{Desk}} Catalyst Review",
      "",
      "## Narrative Candidates",
      "",
      "| Candidate | Catalyst Links | Desk Fit | Action |",
      "| --- | --- | --- | --- |",
      "|  |  |  |  |",
      "",
      "## Conflicts",
      "",
      "- ",
      "",
      "## Promote / Archive",
      "",
      "- Promote:",
      "- Archive:",
    ].join("\n"),
  );
}

async function writeTraderBanks(
  root: string,
  bankRows: CatalystBankRow[],
  catalysts: CatalystRow[],
  notePaths: Map<string, string>,
  fallbackSlug: string,
  fallbackTrader: string,
): Promise<void> {
  const catalystLookup = new Map(catalysts.map((row) => [row.tweet_id, row]));
  const rowsByUser = new Map<string, CatalystBankRow[]>();
  for (const row of bankRows) {
    rowsByUser.set(row.user_id, [...(rowsByUser.get(row.user_id) ?? []), row]);
  }
  if (rowsByUser.size === 0) rowsByUser.set(fallbackTrader, []);

  await Promise.all(
    Array.from(rowsByUser.entries()).map(async ([userId, rows]) => {
      const slug = safeSlug(userId, fallbackSlug);
      const table = rows.map((row) => {
        const catalyst = catalystLookup.get(row.riskflow_item_id);
        const note = notePaths.get(row.riskflow_item_id);
        const label = safeText(catalyst?.headline) || row.riskflow_item_id;
        const link = note
          ? `[[${note}|${label.replace(/\|/g, "/")}]]`
          : label.replace(/\|/g, "/");
        return `| ${link} | ${row.desk_name ?? row.desk_slug ?? "unassigned"} | ${row.role ?? "candidate"} | ${(row.tags ?? []).join(", ")} | ${row.desk_fit ?? ""} | ${row.status ?? "active"} |`;
      });
      await writeFile(
        join(root, "Trader Banks", `${slug}-generated-catalyst-bank.md`),
        [
          frontmatter({
            type: "trader-catalyst-bank",
            generated_at: new Date().toISOString(),
            user_id: userId,
            count: rows.length,
            tags: ["fintheon", "trader-bank", "catalyst-bank"],
          }),
          "",
          `# ${userId} Generated Catalyst Bank`,
          "",
          "This is a generated index from `narrative_user_catalyst_bank`. Use it to seed your own narrative drafts, then save human-written notes under `Narratives/Drafts/`.",
          "",
          "| Catalyst | Desk | Role | Tags | Desk Fit | Status |",
          "| --- | --- | --- | --- | --- | --- |",
          ...(table.length > 0
            ? table
            : ["| _No assigned catalysts yet._ |  |  |  |  |  |"]),
        ].join("\n"),
      );
    }),
  );
}

async function writeDeskWorkspaces(
  root: string,
  desks: NarrativeDeskRow[],
  bankRows: CatalystBankRow[],
  catalysts: CatalystRow[],
  notePaths: Map<string, string>,
): Promise<void> {
  const catalystLookup = new Map(catalysts.map((row) => [row.tweet_id, row]));
  const rowsByDesk = new Map<string, CatalystBankRow[]>();
  for (const row of bankRows) {
    const key = row.desk_slug ?? row.desk_id ?? "unassigned";
    rowsByDesk.set(key, [...(rowsByDesk.get(key) ?? []), row]);
  }

  await Promise.all(
    desks.map(async (desk) => {
      const slug = safeSlug(desk.slug ?? desk.name ?? desk.id, "desk");
      const folder = join(root, "Desk Workspaces", slug);
      await mkdir(folder, { recursive: true });
      const rows = rowsByDesk.get(desk.slug ?? desk.id) ?? [];
      const starters = rows.slice(0, 30).map((row) => {
        const catalyst = catalystLookup.get(row.riskflow_item_id);
        const note = notePaths.get(row.riskflow_item_id);
        const label = safeText(catalyst?.headline) || row.riskflow_item_id;
        return note
          ? `- [[${note}|${label}]] — ${row.role ?? "candidate"}${row.desk_fit ? `; ${row.desk_fit}` : ""}`
          : `- ${label} — ${row.role ?? "candidate"}`;
      });
      await writeFile(
        join(folder, "README.md"),
        [
          frontmatter({
            type: "desk-narrative-workspace",
            generated_at: new Date().toISOString(),
            desk_id: desk.id,
            desk_slug: desk.slug,
            tags: ["fintheon", "desk-workspace", "narrative-builder"],
          }),
          "",
          `# ${desk.name ?? desk.slug ?? desk.id} Narrative Workspace`,
          "",
          "Use this workspace to turn the desk's catalyst bank into thesis notes for specific traders and sessions.",
          "",
          "## Starter Catalyst Bank",
          "",
          ...(starters.length > 0
            ? starters
            : [
                "- No desk-specific catalyst assignments yet. Search `Index.md` or ask an agent to assign candidates.",
              ]),
          "",
          "## Draft Links",
          "",
          "- [[../../Narratives/Drafts/README|Narrative drafts]]",
          "- [[../../Templates/Narrative Brief|Narrative brief template]]",
          "- [[../../Templates/Desk Catalyst Review|Desk catalyst review template]]",
        ].join("\n"),
      );
    }),
  );
}

async function writeLinkIndex(
  path: string,
  title: string,
  notes: string[],
): Promise<void> {
  await writeFile(
    path,
    [
      frontmatter({
        type: safeSlug(title),
        generated_at: new Date().toISOString(),
        count: notes.length,
        tags: ["fintheon", "riskflow", "catalyst-index"],
      }),
      "",
      `# ${title}`,
      "",
      ...Array.from(new Set(notes)).map((note) => `- [[${note}]]`),
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL or NEON_DATABASE_URL is required");
  const root = vaultPath();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const catalysts = await readCatalysts(client);
  const relationsById = await readRelations(
    client,
    catalysts.map((row) => row.tweet_id),
  );
  const [desks, bankRows] = await Promise.all([
    readNarrativeDesks(client),
    readCatalystBankRows(client),
  ]);
  const notePaths = new Map<string, string>();

  await mkdir(root, { recursive: true });
  for (const row of catalysts) {
    const notePath = await writeCatalystNote(
      root,
      row,
      relationsById.get(row.tweet_id) ?? [],
    );
    notePaths.set(row.tweet_id, notePath);
  }
  await writeIndexes(root, catalysts, relationsById, notePaths);
  await writeNarrativeBuilder(root, catalysts, desks, bankRows, notePaths);
  await client.end();
  console.log(`Exported ${catalysts.length} RiskFlow catalysts to ${root}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
