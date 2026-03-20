import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../lib/backend';
import type { BoardroomMessage, InterventionMessage, TriggerInterventionParams, TradeIdeaParams } from '../lib/services';
import {
  getAllThreads,
  getThread,
  saveThread,
  createThread,
  mergeMessages,
  type BoardroomThread,
} from '../lib/boardroomThreadStore';

const POLL_INTERVAL_MS = 5000;
/** Threads go stale after 30 min of no new messages → start a new thread. */
const STALE_THREAD_MS = 30 * 60 * 1000;

export function useBoardroom() {
  const backend = useBackend();

  const [messages, setMessages] = useState<BoardroomMessage[]>([]);
  const [interventionMessages, setInterventionMessages] = useState<InterventionMessage[]>([]);
  const [status, setStatus] = useState<{ boardroomActive: boolean; interventionActive: boolean }>({
    boardroomActive: false,
    interventionActive: false,
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Thread history state
  const [threads, setThreads] = useState<BoardroomThread[]>([]);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const activeThreadIdRef = useRef<string | null>(null);

  const mountedRef = useRef(true);

  // Auto-save messages to a thread whenever they change
  const autoSaveToThread = useCallback(async (msgs: BoardroomMessage[], intMsgs: InterventionMessage[]) => {
    if (msgs.length === 0) return;

    try {
      let threadId = activeThreadIdRef.current;
      let thread: BoardroomThread | undefined;

      if (threadId) {
        thread = await getThread(threadId);
      }

      // Check if we should start a new thread (no active thread, or thread is stale)
      if (!thread) {
        // Check the most recent thread to see if we should continue it
        const allThreads = await getAllThreads();
        if (allThreads.length > 0) {
          const latest = allThreads[0];
          const timeSinceUpdate = Date.now() - new Date(latest.updatedAt).getTime();
          if (timeSinceUpdate < STALE_THREAD_MS) {
            thread = latest;
            activeThreadIdRef.current = latest.id;
          }
        }
      }

      if (thread) {
        // Merge new messages into existing thread
        const updated = mergeMessages(thread, msgs, intMsgs);
        if (updated !== thread) {
          await saveThread(updated);
          setThreadRefreshKey((k) => k + 1);
        }
      } else {
        // Create a new thread
        const newThread = createThread(msgs, intMsgs);
        await saveThread(newThread);
        activeThreadIdRef.current = newThread.id;
        setThreadRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error('[useBoardroom] auto-save thread failed:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [msgs, intMsgs, st] = await Promise.all([
        backend.boardroom.getMessages(),
        backend.boardroom.getInterventionMessages(),
        backend.boardroom.getStatus(),
      ]);
      if (!mountedRef.current) return;
      setMessages(msgs);
      setInterventionMessages(intMsgs);
      setStatus(st);

      // Auto-save to thread
      await autoSaveToThread(msgs, intMsgs);
    } catch (err) {
      console.error('[useBoardroom] poll failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [backend, autoSaveToThread]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = window.setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [fetchAll]);

  const sendIntervention = useCallback(
    async (message: string) => {
      setSending(true);
      try {
        await backend.boardroom.sendIntervention(message);
        // Immediately re-fetch both intervention and boardroom messages (relay writes to both)
        const [intMsgs, msgs] = await Promise.all([
          backend.boardroom.getInterventionMessages(),
          backend.boardroom.getMessages(),
        ]);
        if (mountedRef.current) {
          setInterventionMessages(intMsgs);
          setMessages(msgs);
        }
      } catch (err) {
        console.error('[useBoardroom] send failed:', err);
        throw err;
      } finally {
        if (mountedRef.current) setSending(false);
      }
    },
    [backend],
  );

  const sendMention = useCallback(
    async (message: string, agent: string) => {
      setSending(true);
      try {
        await backend.boardroom.sendMention(message, agent);
        // Re-fetch boardroom messages to show the mention
        const msgs = await backend.boardroom.getMessages();
        if (mountedRef.current) setMessages(msgs);
      } catch (err) {
        console.error('[useBoardroom] mention send failed:', err);
        throw err;
      } finally {
        if (mountedRef.current) setSending(false);
      }
    },
    [backend],
  );

  const triggerIntervention = useCallback(
    async (params: TriggerInterventionParams) => {
      try {
        await backend.boardroom.triggerIntervention(params);
        // Re-fetch boardroom messages to show the intervention inline
        const msgs = await backend.boardroom.getMessages();
        if (mountedRef.current) setMessages(msgs);
      } catch (err) {
        console.error('[useBoardroom] triggerIntervention failed:', err);
        throw err;
      }
    },
    [backend],
  );

  const postTradeIdea = useCallback(
    async (params: TradeIdeaParams) => {
      try {
        await backend.boardroom.postTradeIdea(params);
        const msgs = await backend.boardroom.getMessages();
        if (mountedRef.current) setMessages(msgs);
      } catch (err) {
        console.error('[useBoardroom] postTradeIdea failed:', err);
        throw err;
      }
    },
    [backend],
  );

  // Load threads on mount
  useEffect(() => {
    getAllThreads().then((t) => {
      if (mountedRef.current) setThreads(t);
    });
  }, [threadRefreshKey]);

  return {
    messages,
    interventionMessages,
    status,
    loading,
    sending,
    sendIntervention,
    sendMention,
    triggerIntervention,
    postTradeIdea,
    refresh: fetchAll,
    // Thread history
    threads,
    threadRefreshKey,
  };
}
