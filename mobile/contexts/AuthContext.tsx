// [claude-code 2026-04-19] S26-P2 T9: isSuperAdmin helper — TP's sub (from memory) OR
//   a VITE_SUPER_ADMIN_USER_ID allow-list env for staging/pairing. Consumed by the
//   MaintenanceDetail modal to decide whether the 3-button action row renders.
// [claude-code 2026-04-15] T2: Mobile auth — Supabase Google OAuth with browser redirect, session auto-restore
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { supabase, signOut as supabaseSignOut } from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export type UserTier = "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";

/** TP's auth sub (per memory reference_tp_identity). Still overridable via env
 *  so TP can add a staging account without a code change. */
const TP_USER_ID = "826e7c65-7fd0-48be-9fe7-f05601dfb004";
const SUPER_ADMIN_ALLOW_LIST = (
  (import.meta.env.VITE_SUPER_ADMIN_USER_ID as string | undefined) || TP_USER_ID
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string;
  isSuperAdmin: boolean;
  session: Session | null;
  user: User | null;
  tier: UserTier;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tier, setTier] = useState<UserTier>("fintheon_pro");

  // Restore existing session from localStorage + listen for auth state changes
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setSession(null);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    return s?.access_token ?? null;
  }, []);

  const userId = user?.id ?? "";
  const isSuperAdmin =
    Boolean(userId) && SUPER_ADMIN_ALLOW_LIST.includes(userId);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: session !== null,
        isLoading,
        userId,
        isSuperAdmin,
        session,
        user,
        tier,
        signIn,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
