// [claude-code 2026-03-13] Hermes migration: OpenClaw -> Hermes imports
// [claude-code 2026-03-06] Unified chat session hook wrapping useHermesChat + persistence + agent routing + part normalization
import { useCallback, useMemo, useState } from 'react';
import { useHermesChat } from './useHermesChat';
import { usePersistentHermesConversation } from '../../../hooks/usePersistentHermesConversation';
import { toHermesAgentOverride } from '../../../lib/hermesAgentRouting';
import { normalizeToParts } from '../../../lib/chatMessageNormalizer';
import { SKILL_PREFIXES } from '../../../lib/skillPrefixes';
import type { ChatMessage } from '../types';

export interface UseChatSessionOptions {
  agentId: string;
  activeSkill?: string | null;
  surfaceId?: string;
}

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation
export function useChatSession({ agentId, activeSkill, surfaceId }: UseChatSessionOptions) {
  const { conversationId, setConversationId, clearConversationId } =
    usePersistentHermesConversation(agentId, surfaceId);

  const agentOverride = toHermesAgentOverride(agentId);

  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    isLoading: _isLoading,
    setIsStreaming,
    stop: rawStop,
    lastError,
    clearError,
    lastRequestId,
  } = useHermesChat(conversationId, setConversationId, agentOverride);

  const [lastSentMessage, setLastSentMessage] = useState('');

  // Normalize raw useChat messages into part-aware ChatMessage[]
  const messages: ChatMessage[] = useMemo(
    () => normalizeToParts(useChatMessages as any[]),
    [useChatMessages]
  );

  const isLoading = status === 'streaming' || status === 'submitted';

  // Find latest thinking content: reasoning parts from last assistant message after last user message
  const latestThinkingContent = useMemo(() => {
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== 'assistant') continue;
      if (i < lastUserIndex) return undefined;
      const reasoning = message.parts
        .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
        .map((p) => p.text)
        .join('\n');
      if (reasoning.trim()) return reasoning.trim();
      return undefined;
    }
    return undefined;
  }, [messages]);

  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === 'user'),
    [messages]
  );

  const send = useCallback(
    async (text: string, _images?: string[]) => {
      if (!text.trim() || isLoading) return;

      let finalText = text;
      if (activeSkill && SKILL_PREFIXES[activeSkill]) {
        finalText = SKILL_PREFIXES[activeSkill] + '\n\n' + text;
      }

      clearError();
      setLastSentMessage(text);

      try {
        await sendMessage(
          { text: finalText },
          { body: { conversationId } }
        );
      } catch (error) {
        console.error('[useChatSession] Failed to send message:', error);
        setIsStreaming(false);
      }
    },
    [activeSkill, isLoading, conversationId, sendMessage, clearError, setIsStreaming, setLastSentMessage]
  );

  const stop = useCallback(() => {
    rawStop();
    setIsStreaming(false);
    setLastSentMessage('');
  }, [rawStop, setIsStreaming]);

  const newChat = useCallback(() => {
    setUseChatMessages([]);
    clearConversationId();
  }, [setUseChatMessages, clearConversationId]);

  return {
    messages,
    send,
    stop,
    newChat,
    isLoading,
    latestThinkingContent,
    hasUserMessages,
    lastError,
    clearError,
    conversationId,
    status,
    lastSentMessage,
    lastRequestId,
  };
}
