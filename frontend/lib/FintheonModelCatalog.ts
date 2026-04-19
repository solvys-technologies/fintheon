/**
 * FintheonModelCatalog — Minimal model configuration.
 *
 * Fintheon is an Opus-only app. All analysts run Claude Opus 4.6.
 * Autonomous backend work runs on Claude Code Routines (see docs/routines.md).
 * There is no user-facing model selection.
 */

export const DEFAULT_MODEL = "anthropic/claude-opus-4-6" as const;
export const DEFAULT_MODEL_NAME = "Claude Opus 4.6" as const;

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
  system_prefix:
    "Think step by step. Show your full reasoning before providing a final answer.",
} as const;
