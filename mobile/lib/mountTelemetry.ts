// [claude-code 2026-04-25] S42-T7 mount-time perf telemetry (mobile). Mirrors the
// frontend helper — separate copy because mobile is a distinct Vite bundle and
// we don't share the frontend/lib alias here for one-file utilities.

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
