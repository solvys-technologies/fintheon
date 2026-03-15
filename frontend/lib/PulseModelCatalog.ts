/**
 * PulseModelCatalog — Minimal model configuration.
 *
 * Fintheon is an Opus-only app. All analysts run Claude Opus 4.6.
 * Codex handles backend trading / coding tasks.
 * There is no user-facing model selection.
 */

export const DEFAULT_MODEL = 'anthropic/claude-opus-4-6' as const;
export const DEFAULT_MODEL_NAME = 'Claude Opus 4.6' as const;

export const CODEX_MODEL = 'openai/codex-mini' as const;
export const CODEX_MODEL_NAME = 'Codex Mini' as const;

/** Returns the default model ID used by all Fintheon analysts. */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

/** Returns the display name for the default model. */
export function getDefaultModelName(): string {
  return DEFAULT_MODEL_NAME;
}

/**
 * Extended thinking configuration.
 * When "Think Harder" is toggled on, we pass these params to the API.
 */
export const THINK_HARDER_CONFIG = {
  max_thinking_tokens: 32000,
  system_prefix: 'Think step by step. Show your full reasoning before providing a final answer.',
} as const;
