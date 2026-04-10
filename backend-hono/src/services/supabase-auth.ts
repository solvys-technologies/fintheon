// [claude-code 2026-03-22] Supabase auth service — replaces clerk-auth.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const hasSupabaseAuth = Boolean(supabaseUrl && supabaseServiceKey);
const isDev = process.env.NODE_ENV !== "production";

export interface SupabaseAuthPayload {
  sub: string;
  email: string;
  role?: string;
  aud?: string;
}

/**
 * Verify a Supabase access token by calling auth.getUser().
 * Uses the service_role client to validate any user's token.
 */
export async function verifySupabaseToken(
  token: string,
): Promise<SupabaseAuthPayload> {
  if (!token) {
    throw new Error("Missing token");
  }

  // Dev mode without Supabase credentials: return mock payload
  if (!hasSupabaseAuth) {
    if (isDev) {
      console.warn(
        "[Supabase Auth] No credentials — using mock auth in dev mode",
      );
      return {
        sub: "dev-user-123",
        email: "dev@local",
      };
    }
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(error?.message || "Invalid or expired token");
  }

  return {
    sub: data.user.id,
    email: data.user.email || "",
    role: data.user.role,
    aud: data.user.aud,
  };
}

export function supabaseAuthHealth() {
  return {
    hasCredentials: hasSupabaseAuth,
    mockMode: !hasSupabaseAuth && isDev,
    provider: "supabase",
  };
}
