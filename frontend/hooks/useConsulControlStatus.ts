// [claude-code 2026-04-23] S32-T4 — poll Consul Control (browser operator) status.
// [claude-code 2026-04-24] Hardened: a single 404 means the route is unwired
// (backend stub returns 404 only if the entire /api/consul-control mount is
// missing). When that happens we stop polling immediately so the dev console
// doesn't flood with 404s (was 231+ per session). Same rule for the
// `reason: "consul_control_not_wired"` payload from the new stub: treat as
// permanently inactive and stop polling.
import { useEffect, useRef, useState } from "react";

const POLL_MS = 2000;
const API = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function useConsulControlStatus(): boolean {
  const [active, setActive] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let intervalId: number | null = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = async () => {
      try {
        const res = await fetch(`${API}/api/consul-control/status`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.status === 404) {
          // Feature not wired — stop polling for this session.
          if (!cancelledRef.current) setActive(false);
          stopPolling();
          return;
        }
        if (!res.ok) {
          if (!cancelledRef.current) setActive(false);
          return;
        }
        const body = (await res.json()) as {
          active?: boolean;
          reason?: string;
        };
        if (body?.reason === "consul_control_not_wired") {
          if (!cancelledRef.current) setActive(false);
          stopPolling();
          return;
        }
        if (!cancelledRef.current) setActive(Boolean(body?.active));
      } catch {
        if (!cancelledRef.current) setActive(false);
      }
    };

    void tick();
    intervalId = window.setInterval(tick, POLL_MS);
    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, []);

  return active;
}
