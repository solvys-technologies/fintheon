// [claude-code 2026-04-19] S27 skeleton stub. W1c (Claude-04) populates pool/allowlist/harness.
// See docs/sprint-briefs/S27-T4-herald-browser.md for the full spec.
// Consumers: Herald source router, T6 Harper Browser Operator, T7 News Worker.

export const BROWSER_PRIMITIVES_READY = false;

export interface BrowseResult {
  url: string;
  title: string;
  body: string;
  fields?: Record<string, string>;
  status: number;
  rendered_at: string;
}

export async function browseRead(_opts: {
  url: string;
  mode: "allowlist" | "universal";
  waitFor?: "load" | "networkidle" | { selector: string; timeoutMs?: number };
  extract?: { schema: unknown };
  textOnly?: boolean;
  budget_usd?: number;
}): Promise<BrowseResult> {
  throw new Error(
    "browseRead not implemented — W1c (Claude-04) must land first. See S27-T4-herald-browser.md.",
  );
}
