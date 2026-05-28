// [Codex 2026-05-27] Loads the PIC macro event-risk doctrine for all agent prompts.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DOCTRINE_PATH =
  "knowledge-base/source-of-truth/macro-event-risk-cognition.md";

interface CacheEntry {
  block: string;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

export async function loadMacroEventCognitionBlock(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.block;

  const content = await readDoctrine();
  const block = `\n\n## PIC Macro Event-Risk Cognition\n${content}`;
  cache = { block, expiresAt: Date.now() + CACHE_TTL_MS };
  return block;
}

async function readDoctrine(): Promise<string> {
  for (const path of candidatePaths()) {
    try {
      return await readFile(path, "utf8");
    } catch {
      /* try the next cwd shape */
    }
  }

  return [
    "Calendar consensus is a baseline only; PIC must produce its own forecast.",
    "Every event-risk window needs miss/beat odds, confidence, data-cycle logic,",
    "cross-asset transmission, confirmation, and invalidation.",
  ].join(" ");
}

function candidatePaths(): string[] {
  return [
    resolve(process.cwd(), DOCTRINE_PATH),
    resolve(process.cwd(), "..", DOCTRINE_PATH),
  ];
}
