// [claude-code 2026-04-18] S21-T1 Relay dispatch state — desktop ↔ mobile mirror handoff.
// Tracks: whether paired mobile is reachable, whether a dispatch is active, the mirror
// messages streaming in from mobile while dispatched. One store shared by sidebar chat
// and main Ask Harper chat so both surfaces render the same state.
import { create } from "zustand";

export interface MirrorMessage {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isChunk?: boolean;
}

interface RelayDispatchState {
  /** Paired mobile reachable via relay. Null = unknown (pre-first-poll). */
  isMobileReachable: boolean | null;
  /** Active dispatch, if any. */
  dispatchedConversationId: string | null;
  deviceLabel: string | null;
  /** Mirror messages buffered from mobile for the active dispatched conversation. */
  mirrorMessages: MirrorMessage[];
  /** In-flight dispatch action — disable button while this is true. */
  isDispatching: boolean;

  setMobileReachable: (reachable: boolean) => void;
  beginDispatch: (conversationId: string, deviceLabel: string) => void;
  endDispatch: () => void;
  setDispatching: (v: boolean) => void;
  appendMirrorMessage: (msg: MirrorMessage) => void;
  clearMirrorFor: (conversationId: string) => void;
}

export const useRelayDispatchStore = create<RelayDispatchState>((set) => ({
  isMobileReachable: null,
  dispatchedConversationId: null,
  deviceLabel: null,
  mirrorMessages: [],
  isDispatching: false,

  setMobileReachable: (reachable) => set({ isMobileReachable: reachable }),

  beginDispatch: (conversationId, deviceLabel) =>
    set({
      dispatchedConversationId: conversationId,
      deviceLabel,
      mirrorMessages: [],
    }),

  endDispatch: () =>
    set({
      dispatchedConversationId: null,
      deviceLabel: null,
      mirrorMessages: [],
      isDispatching: false,
    }),

  setDispatching: (v) => set({ isDispatching: v }),

  appendMirrorMessage: (msg) =>
    set((state) => {
      // Only buffer messages for the currently dispatched conversation
      if (state.dispatchedConversationId !== msg.conversationId) return state;
      // Coalesce consecutive assistant chunks into a single message for render
      if (msg.isChunk && msg.role === "assistant") {
        const last = state.mirrorMessages[state.mirrorMessages.length - 1];
        if (last && last.role === "assistant" && last.isChunk) {
          // Stop on [DONE] sentinel — finalize
          if (msg.content === "[DONE]") {
            const next = [...state.mirrorMessages];
            next[next.length - 1] = { ...last, isChunk: false };
            return { mirrorMessages: next };
          }
          const next = [...state.mirrorMessages];
          next[next.length - 1] = {
            ...last,
            content: last.content + msg.content,
          };
          return { mirrorMessages: next };
        }
        if (msg.content === "[DONE]") return state; // nothing to finalize
      }
      return { mirrorMessages: [...state.mirrorMessages, msg] };
    }),

  clearMirrorFor: (conversationId) =>
    set((state) => {
      if (state.dispatchedConversationId !== conversationId) return state;
      return { mirrorMessages: [] };
    }),
}));
