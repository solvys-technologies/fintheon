// [claude-code 2026-03-11] T2e: persistent thread support from Gateway settings
import { useCallback, useEffect, useState } from 'react';
import { hermesConversationStorageKey } from '../lib/hermesAgentRouting';

// [claude-code 2026-03-09] Added surfaceId for per-surface session isolation
export function usePersistentHermesConversation(
  fintheonAgentId: string | undefined | null,
  surfaceId?: string,
) {
  const [conversationId, setConversationIdState] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Check if persistent thread is enabled in Gateway settings
    const persistentEnabled = localStorage.getItem('fintheon:gateway-persistent-thread-enabled') === 'true';
    const persistentId = localStorage.getItem('fintheon:gateway-persistent-thread-id');

    if (persistentEnabled && persistentId) {
      setConversationIdState(persistentId);
      return;
    }

    const key = hermesConversationStorageKey(fintheonAgentId, surfaceId);
    const stored = localStorage.getItem(key) || undefined;
    setConversationIdState(stored);
  }, [fintheonAgentId, surfaceId]);

  const setConversationId = useCallback(
    (id: string) => {
      const key = hermesConversationStorageKey(fintheonAgentId, surfaceId);
      localStorage.setItem(key, id);

      // Also update persistent thread ID if persistent mode is enabled
      const persistentEnabled = localStorage.getItem('fintheon:gateway-persistent-thread-enabled') === 'true';
      if (persistentEnabled) {
        localStorage.setItem('fintheon:gateway-persistent-thread-id', id);
      }

      setConversationIdState(id);
    },
    [fintheonAgentId, surfaceId]
  );

  const clearConversationId = useCallback(() => {
    // Only clear the per-agent key, not the persistent thread
    const key = hermesConversationStorageKey(fintheonAgentId, surfaceId);
    localStorage.removeItem(key);
    setConversationIdState(undefined);
  }, [fintheonAgentId, surfaceId]);

  return { conversationId, setConversationId, clearConversationId };
}
