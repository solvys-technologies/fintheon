// [claude-code 2026-04-18] Notify the local backend of the signed-in user's sub so its relay
//   connector can register the outbound WS under the correct user_id. Without this the local
//   backend has no way to know which user it serves, Fly reports connected:false on
//   /api/relay/health, and mobile's ChatInput stays locked in "OFFLINE".
// [claude-code 2026-03-24] Supabase Google OAuth + Electron deep link + GitHub Models OAuth
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  supabase,
  signInWithGoogle,
  signOut as supabaseSignOut,
} from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export type UserTier = "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";

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

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const DEV = import.meta.env.DEV;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tier, setTier] = useState<UserTier>("fintheon_pro");

  // GitHub OAuth state (separate from Supabase — used for GitHub Models access)
  const [ghToken, setGhToken] = useState<string | null>(() =>
    localStorage.getItem("github_token"),
  );
  const [ghUser, setGhUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem("github_user");
    return stored ? JSON.parse(stored) : null;
  });

  // Persist GitHub state
  useEffect(() => {
    if (ghToken) localStorage.setItem("github_token", ghToken);
    else localStorage.removeItem("github_token");
  }, [ghToken]);

  useEffect(() => {
    if (ghUser) localStorage.setItem("github_user", JSON.stringify(ghUser));
    else localStorage.removeItem("github_user");
  }, [ghUser]);

  // Listen for GitHub OAuth popup messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "github-oauth-success") {
        const token = localStorage.getItem("github_token");
        const userStr = localStorage.getItem("github_user");
        if (token) setGhToken(token);
        if (userStr) setGhUser(JSON.parse(userStr));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // --- Supabase Auth ---
  useEffect(() => {
    if (!supabase) {
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "TOKEN_REFRESHED") {
        // token refreshed — no action needed
      }
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync the user's identity to the local backend's relay connector. The
  // local backend can't know which user it serves until we tell it — without
  // this, Fly's /api/relay/health reports connected:false and mobile locks
  // to OFFLINE. We also poll /connector-status every 30s because:
  //   (a) the local backend is launchd-managed and can restart independently,
  //   (b) RELAY_ENABLED may have been toggled off/on,
  //   (c) the WS may have dropped and reconnected under the wrong identity.
  // The poll is cheap (tiny JSON) and self-heals the link without user action.
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const token = session?.access_token ?? null;
    if (!currentUserId || !token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function syncSetUser(reason: string) {
      try {
        const res = await fetch(`${API_BASE}/api/relay/set-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: currentUserId }),
        });
        if (!cancelled && !res.ok && res.status !== 401) {
          console.debug(
            `[AuthContext] relay set-user (${reason}) non-ok:`,
            res.status,
          );
        }
      } catch {
        // Local backend down — the next poll will retry.
      }
    }

    async function reconcile() {
      try {
        const res = await fetch(`${API_BASE}/api/relay/connector-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          userId: string | null;
          connected: boolean;
          matchesCaller: boolean;
        };
        // Local connector out of sync with us — realign it.
        if (!data.matchesCaller || !data.connected) {
          void syncSetUser(
            !data.matchesCaller ? "identity-drift" : "disconnected",
          );
        }
      } catch {
        // Local backend unreachable — do nothing this tick.
      }
    }

    // Initial push + periodic reconciliation.
    void syncSetUser("initial");
    timer = setInterval(reconcile, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [user?.id, session?.access_token]);

  // Set session from tokens (implicit flow — access_token + refresh_token)
  const setSessionFromTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      if (!supabase) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          DEV && console.error("[Auth] setSession failed:", error.message);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        DEV && console.error("[Auth] setSession error:", err);
      }
      setIsLoading(false);
    },
    [],
  );

  // Exchange a PKCE auth code for a Supabase session
  const exchangeCode = useCallback(async (code: string) => {
    if (!supabase || !code) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        DEV && console.error("[Auth] Code exchange failed:", error.message);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
    } catch (err) {
      DEV && console.error("[Auth] Exchange error:", err);
    }
    setIsLoading(false);
  }, []);

  // Handle auth data from deep link or polling (code OR tokens)
  const handleAuthData = useCallback(
    async (params: Record<string, string>) => {
      if (params.access_token && params.refresh_token) {
        await setSessionFromTokens(params.access_token, params.refresh_token);
      } else if (params.code) {
        await exchangeCode(params.code);
      }
    },
    [setSessionFromTokens, exchangeCode],
  );

  // Listen for Electron deep link callback
  useEffect(() => {
    if (!supabase) return;

    const handleDeepLink = async (url: string) => {
      try {
        const parsed = new URL(url);
        const params: Record<string, string> = {};
        parsed.searchParams.forEach((v, k) => {
          params[k] = v;
        });
        // Also check hash fragment
        if (parsed.hash) {
          parsed.hash
            .substring(1)
            .split("&")
            .forEach((pair) => {
              const [k, v] = pair.split("=");
              if (k)
                params[decodeURIComponent(k)] = decodeURIComponent(v || "");
            });
        }
        await handleAuthData(params);
      } catch (err) {
        DEV && console.error("[Auth] Deep link parse error:", err);
      }
    };

    window.electron?.onAuthCallback(handleDeepLink);
    return () => window.electron?.onAuthCallback(null);
  }, [handleAuthData]);

  // Fallback: poll backend for pending auth data
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/supabase/pending`);
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, string | null>;
        // Check if we got tokens or a code
        if (data.access_token || (data.code && data.code !== null)) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          await handleAuthData(data as Record<string, string>);
        }
      } catch {
        /* silent */
      }
    }, 1500);
    setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 120_000);
  }, [handleAuthData]);

  // Cleanup polling on unmount
  useEffect(
    () => () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    },
    [],
  );

  const signIn = useCallback(async () => {
    try {
      const data = await signInWithGoogle();
      if (data.url) {
        // Open in system browser via Electron shell.openExternal
        if (window.electron?.openExternal) {
          window.electron.openExternal(data.url);
        } else {
          window.location.href = data.url;
        }
        // Start polling backend for the auth code as fallback
        startPolling();
      } else {
        console.error("[Auth] signInWithGoogle returned no URL:", data);
      }
    } catch (err) {
      console.error("[Auth] Google sign-in failed:", err);
    }
  }, [startPolling]);

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

  // GitHub OAuth handlers
  const connectGitHub = useCallback(() => {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    window.open(
      `${API_BASE}/api/auth/github`,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );
  }, []);

  const disconnectGitHub = useCallback(() => {
    setGhToken(null);
    setGhUser(null);
  }, []);

  const handleGitHubCallback = useCallback(
    async (code: string, state: string) => {
      const res = await fetch(`${API_BASE}/api/auth/github/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "GitHub authentication failed");
      }
      const data = (await res.json()) as { token: string; user: GitHubUser };
      setGhToken(data.token);
      setGhUser(data.user);
    },
    [],
  );

  const isAuthenticated = session !== null;
  const userId = user?.id ?? "";

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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
