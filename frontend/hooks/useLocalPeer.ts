// [claude-code 2026-05-12] useLocalPeer stub — placeholder for local peer identity hook
// Imported by ConsiliumHub but implementation deferred.

import { useState, useEffect } from "react";

export function useLocalPeer() {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stub: generates a deterministic peer ID for now
    const stored = localStorage.getItem("fintheon-peer-id");
    if (stored) {
      setPeerId(stored);
    } else {
      const id = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("fintheon-peer-id", id);
      setPeerId(id);
    }
    setLoading(false);
  }, []);

  return { peerId, loading };
}
