// [claude-code 2026-04-19] S27-T8 W1d: Thin shim over herald-extra.md — dossier body now lives in the sibling .md consumed by SOUL grounding.extra.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DOSSIER_HERALD = readFileSync(
  join(__dirname, "..", "herald-extra.md"),
  "utf-8",
);
