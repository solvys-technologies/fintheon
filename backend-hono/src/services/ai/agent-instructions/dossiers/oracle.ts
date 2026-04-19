// [claude-code 2026-04-19] S27-T8 W1d: Thin shim over oracle-extra.md — dossier body now lives in the sibling .md consumed by SOUL grounding.extra.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DOSSIER_ORACLE = readFileSync(
  join(__dirname, "..", "oracle-extra.md"),
  "utf-8",
);
