// [claude-code 2026-03-19] Safe Clerk hook wrappers — return mock data in BYPASS_AUTH mode
// Prevents crashes when Clerk hooks are called outside <ClerkProvider />
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';

const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const SHOULD_BYPASS = BYPASS_AUTH || !CLERK_KEY;

export function useSafeUser() {
  if (SHOULD_BYPASS) {
    return { user: null, isLoaded: true, isSignedIn: false } as const;
  }
  return useUser();
}

export function useSafeAuth() {
  if (SHOULD_BYPASS) {
    return {
      getToken: async () => 'dev-token',
      isLoaded: true,
      isSignedIn: false,
      userId: 'dev-user-123',
    } as const;
  }
  return useAuth();
}

export function useSafeClerk() {
  if (SHOULD_BYPASS) {
    return {
      signOut: () => Promise.resolve(),
      openSignIn: () => {},
      openUserProfile: () => {},
    } as const;
  }
  return useClerk();
}
