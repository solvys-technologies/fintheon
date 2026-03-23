// [claude-code 2026-03-22] Supabase auth hook wrappers — replaces Clerk hook wrappers
// Kept as clerk-hooks.ts to avoid breaking imports; rename to auth-hooks.ts in next cleanup pass
import { getAccessToken, signOut, supabase } from './supabase';

const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost');
const BYPASS_AUTH = IS_ELECTRON || (DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true');

export function useSafeUser() {
  if (BYPASS_AUTH || !supabase) {
    return { user: null, isLoaded: true, isSignedIn: false } as const;
  }
  // Supabase session is managed via AuthContext — this is a compatibility shim
  return { user: null, isLoaded: true, isSignedIn: false } as const;
}

export function useSafeAuth() {
  if (BYPASS_AUTH || !supabase) {
    return {
      getToken: async () => 'dev-token',
      isLoaded: true,
      isSignedIn: false,
      userId: 'dev-user-123',
    } as const;
  }
  return {
    getToken: getAccessToken,
    isLoaded: true,
    isSignedIn: true,
    userId: null,
  } as const;
}

export function useSafeClerk() {
  if (BYPASS_AUTH || !supabase) {
    return {
      signOut: () => Promise.resolve(),
      openSignIn: () => {},
      openUserProfile: () => {},
    } as const;
  }
  return {
    signOut,
    openSignIn: () => {},
    openUserProfile: () => {},
  } as const;
}
