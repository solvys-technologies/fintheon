// [claude-code 2026-05-12] Hook to resolve the local peer ID by matching the authenticated user
import { useCallback, useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import { useAuth } from "../contexts/AuthContext";

interface LocalPeerState {
  peerId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves the local peer ID from the peer registry.
 * Must be called after the peer has been registered (via TeamOnboarding).
 */
export function useLocalPeer(): LocalPeerState & {
  refresh: () => Promise<void>;
} {
  const backend = useBackend();
  const { userId } = useAuth();
  const [state, setState] = useState<LocalPeerState>({
    peerId: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ peerId: null, loading: false, error: "Not authenticated" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const { peers } = await backend.peers.list();
      // Match by userId — the local peer is the one belonging to this user
      const localPeer = peers.find(
        (p) => p.userId === userId || p.userId === "local-user",
      );
      if (localPeer) {
        setState({ peerId: localPeer.id, loading: false, error: null });
      } else {
        setState({
          peerId: null,
          loading: false,
          error: "No local peer found — register via Team panel.",
        });
      }
    } catch (err) {
      setState({
        peerId: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to resolve peer",
      });
    }
  }, [backend, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
