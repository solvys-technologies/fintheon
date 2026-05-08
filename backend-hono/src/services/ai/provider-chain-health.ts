// [claude-code 2026-05-06] S59-T4: stripped OpenRouter and VProxy.
// Chain health reports DeepSeek direct + OpenCode Go availability.
import { checkDeepSeekDirectHealth } from "../strands/deepseek-health.js";

export interface ChainHealthEntry {
  provider: "deepseek-direct" | "opencode-go";
  available: boolean;
  model?: string;
  error?: string | null;
}

export interface ChainHealth {
  primary: ChainHealthEntry;
  fallback: ChainHealthEntry;
}

export async function getChainHealth(): Promise<ChainHealth> {
  const deepseekKeySet = Boolean(process.env.DEEPSEEK_API_KEY);
  let deepseekReachable = false;
  let deepseekError: string | null = null;

  if (deepseekKeySet) {
    try {
      const health = await checkDeepSeekDirectHealth();
      deepseekReachable = health.available;
      deepseekError = health.error;
    } catch (err) {
      deepseekError = err instanceof Error ? err.message : String(err);
    }
  }

  const ocGoKeySet = Boolean(
    process.env.OPENCODE_GO_API_KEY || process.env.HERMES_API_KEY,
  );
  const ocGoReachable = Boolean(process.env.HERMES_API_URL) && ocGoKeySet;

  return {
    primary: {
      provider: "deepseek-direct",
      available: deepseekReachable,
      error: deepseekKeySet ? deepseekError : "DEEPSEEK_API_KEY not set",
    },
    fallback: {
      provider: "opencode-go",
      available: ocGoReachable,
      error: !ocGoKeySet
        ? "OPENCODE_GO_API_KEY or HERMES_API_KEY not set"
        : !process.env.HERMES_API_URL
          ? "HERMES_API_URL not set"
          : null,
    },
  };
}
