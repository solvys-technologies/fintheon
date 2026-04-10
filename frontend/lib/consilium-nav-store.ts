// [claude-code 2026-04-04] Zustand store for cross-component ConsiliumHub tab navigation
import { create } from "zustand";

type ConsiliumTab = "sanctum" | "chat" | "boardroom" | "apparatus";

interface ConsiliumNavStore {
  /** Pending tab request from outside ConsiliumHub (e.g. ChatPanel sidebar icons) */
  pendingTab: ConsiliumTab | null;
  /** Request navigation to a specific ConsiliumHub sub-tab */
  requestTab: (tab: ConsiliumTab) => void;
  /** ConsiliumHub calls this after consuming the pending tab */
  clearPending: () => void;
}

export const useConsiliumNav = create<ConsiliumNavStore>((set) => ({
  pendingTab: null,
  requestTab: (tab) => set({ pendingTab: tab }),
  clearPending: () => set({ pendingTab: null }),
}));
