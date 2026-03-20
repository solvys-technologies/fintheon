// [claude-code 2026-03-06] GitHub OAuth state for GitHub Models (DeepSeek R1) — popup window flow
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type UserTier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  tradingStyle?: string;
  experienceLevel?: string;
  riskTolerance?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar: string;
}

interface AuthContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  onboardingData: OnboardingData;
  setOnboardingData: (data: OnboardingData) => void;
  isAuthenticated: boolean;
  userId: string;
  isLoading: boolean;
  // GitHub OAuth
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

/**
 * Local Auth Provider with GitHub OAuth for GitHub Models
 * Single-user local product — GitHub auth is optional, used for AI model access
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<UserTier>('pulse_pro');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    hasCompletedOnboarding: true,
  });

  // GitHub OAuth state — restore from localStorage
  const [ghToken, setGhToken] = useState<string | null>(() => localStorage.getItem('github_token'));
  const [ghUser, setGhUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem('github_user');
    return stored ? JSON.parse(stored) : null;
  });

  // Persist changes
  useEffect(() => {
    if (ghToken) localStorage.setItem('github_token', ghToken);
    else localStorage.removeItem('github_token');
  }, [ghToken]);

  useEffect(() => {
    if (ghUser) localStorage.setItem('github_user', JSON.stringify(ghUser));
    else localStorage.removeItem('github_user');
  }, [ghUser]);

  // Listen for OAuth popup messages (popup shares the same AuthContext via localStorage)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'github-oauth-success') {
        // Popup already called handleCallback which updated state — reload from localStorage
        const token = localStorage.getItem('github_token');
        const user = localStorage.getItem('github_user');
        if (token) setGhToken(token);
        if (user) setGhUser(JSON.parse(user));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const connectGitHub = useCallback(() => {
    // Open GitHub OAuth in a popup window to avoid white-screen in Electron/embedded contexts
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

  return (
    <AuthContext.Provider
      value={{
        tier,
        setTier,
        onboardingData,
        setOnboardingData,
        isAuthenticated: true,
        userId: 'local-user',
        isLoading: false,
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
