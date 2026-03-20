/**
 * Authentication Helper
 * Provides sign-out functionality for use in non-React contexts (like ApiClient)
 */

let signOutCallback: (() => Promise<void>) | null = null;

/**
 * Register a sign-out callback (called from React components)
 */
export function registerSignOutCallback(callback: () => Promise<void>) {
  signOutCallback = callback;
}

/**
 * Sign out user (can be called from anywhere, including non-React code)
 */
export async function signOutUser(): Promise<void> {
  if (signOutCallback) {
    try {
      await signOutCallback();
    } catch (error) {
      console.error('[AuthHelper] Error signing out:', error);
    }
  } else {
    console.warn('[AuthHelper] Sign-out callback not registered. User may need to manually sign out.');
  }
}
