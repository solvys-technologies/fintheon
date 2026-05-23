// [claude-code 2026-05-06] S60-T2: delegates runtime creation to open-agents adapter
// instead of direct useAISDKRuntime — establishes open-agents SDK bridge layer
// while preserving all existing conversation, error, and request-ID semantics.
// [claude-code 2026-04-18] Pass clearConversationId into useHermesChat so the 404 branch
//   in the hydration effect can nuke the stale localStorage entry instead of leaving a
//   ghost conversationId around for FintheonComposer's relay button to trip over.
// [claude-code 2026-03-07] assistant-ui runtime hook — wraps useHermesChat via useAISDKRuntime
import { useHermesChat } from "./hooks/useHermesChat";
import { useOpenAgentsRuntime } from "./hooks/useOpenAgentsRuntime";
import { usePersistentHermesConversation } from "../../hooks/usePersistentHermesConversation";
import { toHermesAgentOverride } from "../../lib/hermesAgentRouting";
import type { ReasoningLevel } from "./reasoning";

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation
export function useHermesRuntime(
  agentId: string,
  thinkHarder?: boolean,
  surfaceId?: string,
  reasoningLevel?: ReasoningLevel,
) {
  const { conversationId, setConversationId, clearConversationId } =
    usePersistentHermesConversation(agentId, surfaceId);

  const agentOverride = toHermesAgentOverride(agentId);
  const chat = useHermesChat(
    conversationId,
    setConversationId,
    agentOverride,
    thinkHarder,
    clearConversationId,
    reasoningLevel,
  );

  // Build chatHelpers compatible with UseChatHelpers from @ai-sdk/react
  const chatHelpers = {
    ...chat,
    id: agentId,
    error: undefined as Error | undefined,
    stop: async () => {
      chat.stop();
    },
  };
  const runtime = useOpenAgentsRuntime(chatHelpers);

  return {
    runtime,
    conversationId,
    setConversationId,
    clearConversationId,
    lastError: chat.lastError,
    clearError: chat.clearError,
    lastRequestId: chat.lastRequestId ?? null,
  };
}
