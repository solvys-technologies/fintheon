// [claude-code 2026-04-18] Pass clearConversationId into useHermesChat so the 404 branch
//   in the hydration effect can nuke the stale localStorage entry instead of leaving a
//   ghost conversationId around for FintheonComposer's relay button to trip over.
// [claude-code 2026-03-07] assistant-ui runtime hook — wraps useHermesChat via useAISDKRuntime
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useHermesChat } from "./hooks/useHermesChat";
import { usePersistentHermesConversation } from "../../hooks/usePersistentHermesConversation";
import { toHermesAgentOverride } from "../../lib/hermesAgentRouting";

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation
export function useHermesRuntime(
  agentId: string,
  thinkHarder?: boolean,
  surfaceId?: string,
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
  );

  // useAISDKRuntime expects UseChatHelpers shape — add missing fields
  const chatHelpers = {
    ...chat,
    id: agentId,
    error: undefined as Error | undefined,
    stop: async () => {
      chat.stop();
    },
  };
  const runtime = useAISDKRuntime(chatHelpers);

  return {
    runtime,
    conversationId,
    setConversationId,
    clearConversationId,
    lastError: chat.lastError,
    clearError: chat.clearError,
    lastRequestId: chat.lastRequestId ?? null,
    isHydrating: chat.isHydrating,
  };
}
