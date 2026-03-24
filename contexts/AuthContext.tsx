// [claude-code 2026-03-22] Supabase auth context — replaces Clerk useUser/useAuth hooks
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, type Session } from '../lib/supabase';
import { useBackend } from '../lib/backend';
import { pullCloudSettings } from '../lib/user-sync';

export type UserTier = 'free' | 'fintheon' | 'fintheon_plus' | 'fintheon_pro';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  tradingStyle?: string;
  experienceLevel?: string;
  riskTolerance?: string;
}

interface AuthContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  onboardingData: OnboardingData;
  setOnboardingData: (data: OnboardingData) => void;
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development mode: bypass authentication
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

// Auth provider without Supabase (for dev mode)
function AuthProviderNoAuth({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<UserTier>('free');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    hasCompletedOnboarding: false,
  });

  return (
    <AuthContext.Provider
      value={{
        tier,
        setTier: setTierState,
        onboardingData,
        setOnboardingData,
        isAuthenticated: true,
        userId: 'dev-user-123',
        isLoading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Auth provider with Supabase (for production)
function AuthProviderWithSupabase({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabaseUserId = session?.user?.id ?? null;
  const isSignedIn = !!session;

  const backend = useBackend();
  const [tier, setTierState] = useState<UserTier>('free');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    hasCompletedOnboarding: false,
  });

  // Listen for Supabase auth state
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Wrapper to persist tier changes to backend
  const setTier = (newTier: UserTier) => {
    setTierState(newTier);
    if (isSignedIn && supabaseUserId) {
      backend.account.updateTier({ tier: newTier }).catch((error) => {
        console.error('Failed to update tier:', error);
        backend.account.get()
          .then((account) => {
            if (account.tier) {
              setTierState(account.tier);
            }
          })
          .catch((getError) => {
            console.error('Failed to revert tier:', getError);
          });
      });
    }
  };

  useEffect(() => {
    async function initializeUser() {
      if (isSignedIn && supabaseUserId) {
        try {
          const account = await backend.account.get();
          if (account.tier) {
            setTierState(account.tier);
          } else {
            setTierState('free');
          }
          // Hydrate cloud settings (non-blocking)
          pullCloudSettings(supabaseUserId).catch(() => {});
        } catch (error: any) {
          if (error?.message?.includes('not found') || error?.code === 'not_found') {
            try {
              const newAccount = await backend.account.create({ initialBalance: 10000 });
              await backend.projectx.syncProjectXAccounts();
              if (newAccount.tier) {
                setTierState(newAccount.tier);
              } else {
                setTierState('free');
              }
            } catch (createError) {
              console.error('Failed to create account:', createError);
              setTierState('free');
            }
          } else {
            console.error('Failed to get account:', error);
          }
        }
      } else {
        setTierState('free');
      }
      setIsLoading(false);
    }

    initializeUser();
  }, [isSignedIn, supabaseUserId, backend]);

  return (
    <AuthContext.Provider
      value={{
        tier,
        setTier,
        onboardingData,
        setOnboardingData,
        isAuthenticated: isSignedIn,
        userId: supabaseUserId,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Main AuthProvider that chooses the right implementation
export function AuthProvider({ children }: { children: ReactNode }) {
  if (BYPASS_AUTH) {
    return <AuthProviderNoAuth>{children}</AuthProviderNoAuth>;
  }
  return <AuthProviderWithSupabase>{children}</AuthProviderWithSupabase>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
