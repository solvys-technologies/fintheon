// [claude-code 2026-04-25] S42-T7 mount-time perf telemetry. Logs cold-mount timings
// for chat surfaces ({ surface, mountMs, composerMs, historyMs }) once per session
// per surface. Drains as soon as composer-visible fires; history is best-effort
// with a 5s fallback in case hydration never resolves.

export type MountSurface = "chat-web" | "chat-mobile";

interface Cycle {
  start: number;
  composerMs?: number;
  historyMs?: number;
  drained: boolean;
  fallbackTimer?: ReturnType<typeof setTimeout>;
}

const cycles = new Map<MountSurface, Cycle>();
const drained = new Set<MountSurface>();

function safeMark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    /* performance.mark is unavailable in some sandboxes */
  }
}

function ensureCycle(surface: MountSurface): Cycle {
  let c = cycles.get(surface);
  if (!c) {
    c = { start: 0, drained: false };
    cycles.set(surface, c);
  }
  return c;
}

export function markMountStart(surface: MountSurface): void {
  if (drained.has(surface)) return;
  const c = ensureCycle(surface);
  if (c.start !== 0) return;
  c.start = performance.now();
  safeMark(`fintheon:${surface}:mount-start`);
  c.fallbackTimer = setTimeout(() => maybeDrain(surface, true), 5_000);
}

export function markComposerVisible(surface: MountSurface): void {
  if (drained.has(surface)) return;
  const c = ensureCycle(surface);
  if (c.start === 0) markMountStart(surface);
  if (c.composerMs != null) return;
  c.composerMs = Math.round(performance.now() - c.start);
  safeMark(`fintheon:${surface}:composer-visible`);
  maybeDrain(surface, false);
}

export function markHistoryReady(surface: MountSurface): void {
  if (drained.has(surface)) return;
  const c = ensureCycle(surface);
  if (c.start === 0) markMountStart(surface);
  if (c.historyMs != null) return;
  c.historyMs = Math.round(performance.now() - c.start);
  safeMark(`fintheon:${surface}:history-ready`);
  maybeDrain(surface, false);
}

function maybeDrain(surface: MountSurface, viaFallback: boolean): void {
  const c = cycles.get(surface);
  if (!c || c.drained) return;
  // Composer-visible is the gating signal. History is reported when it arrives
  // or as null after the fallback fires.
  if (c.composerMs == null && !viaFallback) return;

  c.drained = true;
  drained.add(surface);
  if (c.fallbackTimer) clearTimeout(c.fallbackTimer);

  const row = {
    surface,
    mountMs: Math.round(c.start),
    composerMs: c.composerMs ?? null,
    historyMs: c.historyMs ?? null,
  };
  // eslint-disable-next-line no-console
  console.log("[mount-telem]", row);
  try {
    window.dispatchEvent(
      new CustomEvent("fintheon:mount-telemetry", { detail: row }),
    );
  } catch {
    /* ignore — non-DOM environments */
  }
}
