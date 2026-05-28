// [claude-code 2026-03-24] Supabase client + Google OAuth for Electron deep link flow
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeApiBase } from "./runtime-api-base";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && !supabaseAnonKey.startsWith("<")) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // We handle deep links manually
    },
  });
}

export { supabase };

/**
 * Start Google OAuth flow via Supabase.
 * Uses skipBrowserRedirect so we can open the URL in the system browser
 * (Electron) and receive the callback via fintheon:// deep link.
 */
export async function signInWithGoogle() {
  if (!supabase)
    throw new Error(
      "Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
    );
  // Redirect to backend callback page which will relay the auth code
  // back to the Electron app via fintheon:// deep link
  const API_BASE = getRuntimeApiBase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${API_BASE}/api/auth/supabase/callback`,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  return data;
}

/** Get current session access token (for Bearer header to backend) */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
