// [claude-code 2026-03-24] Supabase Google OAuth + Electron deep link + GitHub Models OAuth
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase, signInWithGoogle, signOut as supabaseSignOut } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type UserTier = 'free' | 'fintheon' | 'fintheon_plus' | 'fintheon_pro';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar: string;
}

interface AuthContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  isAuthenticated: boolean;
  userId: string;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  // GitHub OAuth (for GitHub Models — separate from Supabase auth)
  gitHub: {
    isConnected: boolean;
    user: GitHubUser | null;
    token: string | null;
    connect: () => void;
    disconnect: () => void;
    handleCallback: (code: string, state: string) => Promise<void>;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!BYPASS_AUTH);
  const [tier, setTier] = useState<UserTier>('fintheon_pro');

  // GitHub OAuth state (separate from Supabase — used for GitHub Models access)
  const [ghToken, setGhToken] = useState<string | null>(() => localStorage.getItem('github_token'));
  const [ghUser, setGhUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem('github_user');
    return stored ? JSON.parse(stored) : null;
  });

  // Persist GitHub state
  useEffect(() => {
    if (ghToken) localStorage.setItem('github_token', ghToken);
    else localStorage.removeItem('github_token');
  }, [ghToken]);

  useEffect(() => {
    if (ghUser) localStorage.setItem('github_user', JSON.stringify(ghUser));
    else localStorage.removeItem('github_user');
  }, [ghUser]);

  // Listen for GitHub OAuth popup messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'github-oauth-success') {
        const token = localStorage.getItem('github_token');
        const userStr = localStorage.getItem('github_user');
        if (token) setGhToken(token);
        if (userStr) setGhUser(JSON.parse(userStr));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // --- Supabase Auth ---
  useEffect(() => {
    if (!supabase || BYPASS_AUTH) {
      setIsLoading(false);
      return;
    }

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    // Subscribe to auth state changes (handles token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Session token refreshed');
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for Electron deep link callback (fintheon://auth/callback?code=...)
  useEffect(() => {
    if (!supabase || BYPASS_AUTH) return;

    const client = supabase; // narrowed for closure
    const handleDeepLink = async (url: string) => {
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) console.error('[Auth] Code exchange failed:', error.message);
        }
      } catch (err) {
        console.error('[Auth] Deep link parse error:', err);
      }
    };

    window.electron?.onAuthCallback(handleDeepLink);
    return () => window.electron?.onAuthCallback(null);
  }, []);

  const signIn = useCallback(async () => {
    const data = await signInWithGoogle();
    if (data.url) {
      // Open in system browser — Electron will receive the deep link callback
      window.open(data.url, '_blank');
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setSession(null);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase || BYPASS_AUTH) return null;
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ?? null;
  }, []);

  // GitHub OAuth handlers
  const connectGitHub = useCallback(() => {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    window.open(
      `${API_BASE}/api/auth/github`,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }, []);

  const disconnectGitHub = useCallback(() => {
    setGhToken(null);
    setGhUser(null);
  }, []);

  const handleGitHubCallback = useCallback(async (code: string, state: string) => {
    const res = await fetch(`${API_BASE}/api/auth/github/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'GitHub authentication failed');
    }
    const data = await res.json() as { token: string; user: GitHubUser };
    setGhToken(data.token);
    setGhUser(data.user);
  }, []);

  const isAuthenticated = BYPASS_AUTH || session !== null;
  const userId = user?.id ?? 'local-user';

  return (
    <AuthContext.Provider
      value={{
        tier,
        setTier,
        isAuthenticated,
        userId,
        isLoading,
        session,
        user,
        signIn,
        signOut,
        getAccessToken,
        gitHub: {
          isConnected: Boolean(ghToken),
          user: ghUser,
          token: ghToken,
          connect: connectGitHub,
          disconnect: disconnectGitHub,
          handleCallback: handleGitHubCallback,
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
