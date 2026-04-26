// [claude-code 2026-04-26] S45.5/F2: commentary scraper retired. The
// rettiwtUserTimeline path it relied on is gone; curated-timeline coverage
// now lives in workers/riskflow-worker/sources/x-handles-browser.ts (with
// xactions secondary + agent-reach Nitter tertiary). Boot still calls
// startCommentaryScraper(), so this file is kept as an inert no-op until a
// follow-up sweep removes the boot wiring + the file together.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("CommentaryScraper");

export async function pollCommentary(): Promise<void> {
  // Intentional no-op — see file header.
}

export function startCommentaryScraper(): void {
  log.info(
    "CommentaryScraper retired — riskflow-worker/x-handles-browser covers curated timelines now",
  );
}
