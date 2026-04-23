// [claude-code 2026-04-23] S32-T4 — poll Consul Control (browser operator) status.
import { useEffect, useRef, useState } from "react";

const POLL_MS = 2000;
const API = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function useConsulControlStatus(): boolean {
  const [active, setActive] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const tick = async () => {
      try {
        const res = await fetch(`${API}/api/consul-control/status`, {
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) {
          if (!cancelledRef.current) setActive(false);
          return;
        }
        const body = (await res.json()) as { active?: boolean };
        if (!cancelledRef.current) setActive(Boolean(body?.active));
      } catch {
        if (!cancelledRef.current) setActive(false);
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(id);
    };
  }, []);

  return active;
}
