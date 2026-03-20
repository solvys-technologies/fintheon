// [claude-code 2026-03-13] Hermes migration: renamed from useOpenClawRuntime.ts
// [claude-code 2026-03-07] assistant-ui runtime hook — wraps useHermesChat via useAISDKRuntime
import { useAISDKRuntime } from '@assistant-ui/react-ai-sdk';
import { useHermesChat } from './hooks/useHermesChat';
import { usePersistentHermesConversation } from '../../hooks/usePersistentHermesConversation';
import { toHermesAgentOverride } from '../../lib/hermesAgentRouting';

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation
export function useHermesRuntime(agentId: string, thinkHarder?: boolean, surfaceId?: string) {
  const { conversationId, setConversationId, clearConversationId } =
    usePersistentHermesConversation(agentId, surfaceId);

  const agentOverride = toHermesAgentOverride(agentId);
  const chat = useHermesChat(conversationId, setConversationId, agentOverride, thinkHarder);

  // useAISDKRuntime expects UseChatHelpers shape — add missing fields
  const chatHelpers = {
    ...chat,
    id: agentId,
    error: undefined as Error | undefined,
  };
  const runtime = useAISDKRuntime(chatHelpers);

  return { runtime, conversationId, clearConversationId, lastError: chat.lastError, clearError: chat.clearError, lastRequestId: chat.lastRequestId ?? null };
}
