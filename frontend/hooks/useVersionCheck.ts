/**
 * Version Check Hook - Disabled for local single-user mode
 * No authentication, no version-based re-auth needed
 */

export function useVersionCheck() {
  // No-op in local mode - no auth to manage
}
