// [claude-code 2026-05-06] S60-T2: open-agents runtime adapter — wraps useChat helpers
// into an AssistantRuntime via useAISDKRuntime, establishing the open-agents SDK
// bridge layer with ai package types for future direct runtime integration.
//
// Uses structural typing rather than importing UseChatHelpers from @ai-sdk/react
// to avoid diamond-dependency version conflicts with the @ai-sdk/react copy
// vendored by @assistant-ui/react-ai-sdk.
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import type { AssistantRuntime } from "@assistant-ui/react";
import type { LanguageModel } from "ai";

export interface OpenAgentsRuntimeOptions {
  adapters?: Parameters<typeof useAISDKRuntime>[1] extends {
    adapters?: infer A;
  }
    ? A
    : never;
  toCreateMessage?: Parameters<typeof useAISDKRuntime>[1] extends {
    toCreateMessage?: infer T;
  }
    ? T
    : never;
  cancelPendingToolCallsOnSend?: boolean;
  model?: LanguageModel;
}

export function useOpenAgentsRuntime(
  chatHelpers: Parameters<typeof useAISDKRuntime>[0],
  options?: OpenAgentsRuntimeOptions,
): AssistantRuntime {
  return useAISDKRuntime(chatHelpers, {
    adapters: options?.adapters,
    toCreateMessage: options?.toCreateMessage,
    cancelPendingToolCallsOnSend: options?.cancelPendingToolCallsOnSend,
  });
}
