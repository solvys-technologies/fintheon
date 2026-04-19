// [claude-code 2026-04-19] S26-P1 T7: haptic micro-interactions module. Module-level
//   singleton so non-React call-sites (toasts, service handlers, one-off callbacks)
//   can buzz without threading a hook through. SettingsContext wires the enable flag
//   via setHapticsEnabled() on every change. Desktop browsers silently no-op because
//   navigator.vibrate is undefined — guarded via optional chaining.
let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

function buzz(pattern: number | number[]) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore — platform without vibration support */
  }
}

export const haptic = {
  /** Quick confirmation — button press, threshold crossed. */
  tap: () => buzz(10),
  /** Positive outcome — refresh done, approve, success toast. */
  success: () => buzz([12, 40, 12]),
  /** Negative outcome — deny, error toast, blocked motion. */
  deny: () => buzz([30, 30, 30]),
};
