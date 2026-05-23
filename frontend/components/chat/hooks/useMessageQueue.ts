// [codex 2026-05-23] Real composer queue controller shared by main and sidebar chat.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadQueue,
  saveQueue,
  type QueuedMessage,
} from "../MessageQueue";

interface UseMessageQueueArgs {
  isRunning: boolean;
  sendNow: (text: string) => void;
  storageKey?: string;
}

function createQueueItem(text: string): QueuedMessage {
  return {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    timestamp: Date.now(),
  };
}

export function useMessageQueue({
  isRunning,
  sendNow,
  storageKey,
}: UseMessageQueueArgs) {
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue(storageKey));
  const shouldDrainRef = useRef(false);
  const queueRef = useRef(queue);
  const waitingForCompletionRef = useRef(false);
  const sawRunningSinceDispatchRef = useRef(false);

  useEffect(() => {
    queueRef.current = queue;
    saveQueue(queue, storageKey);
  }, [queue, storageKey]);

  const drainFirst = useCallback(() => {
    if (isRunning || waitingForCompletionRef.current) return;
    const next = queueRef.current[0];
    if (!next) {
      shouldDrainRef.current = false;
      return;
    }
    waitingForCompletionRef.current = true;
    sawRunningSinceDispatchRef.current = false;
    setQueue((prev) => prev.slice(1));
    requestAnimationFrame(() => sendNow(next.text));
  }, [isRunning, sendNow]);

  useEffect(() => {
    if (isRunning && waitingForCompletionRef.current) {
      sawRunningSinceDispatchRef.current = true;
      return;
    }
    if (
      !isRunning &&
      waitingForCompletionRef.current &&
      sawRunningSinceDispatchRef.current
    ) {
      waitingForCompletionRef.current = false;
      sawRunningSinceDispatchRef.current = false;
    }
    if (!shouldDrainRef.current || isRunning || queue.length === 0) return;
    drainFirst();
  }, [drainFirst, isRunning, queue.length]);

  const addQueue = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQueue((prev) => [...prev, createQueueItem(trimmed)]);
  }, []);

  const editQueue = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text: trimmed } : item)),
    );
  }, []);

  const removeQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const reorderQueue = useCallback((fromIdx: number, toIdx: number) => {
    setQueue((prev) => {
      if (fromIdx < 0 || toIdx < 0) return prev;
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  const sendOne = useCallback(() => {
    shouldDrainRef.current = false;
    drainFirst();
  }, [drainFirst]);

  const sendAll = useCallback(() => {
    shouldDrainRef.current = true;
    drainFirst();
  }, [drainFirst]);

  return {
    queue,
    addQueue,
    editQueue,
    removeQueue,
    reorderQueue,
    sendOne,
    sendAll,
  };
}
