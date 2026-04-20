// [claude-code 2026-04-19] View Transitions API helper — thin wrapper around
// document.startViewTransition() for non-Next.js React apps. Works in Chromium/
// Electron today; no-ops on browsers without support (Firefox, older Safari).
// Pair with CSS ::view-transition-* rules in index.css to customize animations.

type MaybePromise<T> = T | Promise<T>;

/**
 * Run `update` inside a browser view transition if the API is available.
 * If not supported, just calls `update` directly so behavior is unchanged.
 *
 * Example:
 *   onClick={() => withViewTransition(() => clearConversationId())}
 */
export function withViewTransition(update: () => MaybePromise<void>): void {
  const start = (
    document as Document & {
      startViewTransition?: (cb: () => MaybePromise<void>) => unknown;
    }
  ).startViewTransition;
  if (typeof start !== "function") {
    void update();
    return;
  }
  start.call(document, () => Promise.resolve(update()));
}

/**
 * Returns true if the browser supports the View Transitions API. Use to gate
 * animations that only look right with a real transition (e.g. shared-element
 * morphs). Cross-fade fallbacks don't need this check.
 */
export function supportsViewTransitions(): boolean {
  return (
    typeof (document as Document & { startViewTransition?: unknown })
      .startViewTransition === "function"
  );
}

/**
 * Convenience wrapper for React event handlers so callsites stay one-liners:
 *   <button onClick={vt(() => openPanel())} />
 */
export function vt<E extends { preventDefault?: () => void }>(
  update: (e: E) => MaybePromise<void>,
): (e: E) => void {
  return (e: E) => {
    withViewTransition(() => update(e));
  };
}
