// [claude-code 2026-04-15] T8: Mobile supabase client — detectSessionInUrl: true for browser OAuth redirect
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabasePublicKey && !supabasePublicKey.startsWith("<")) {
  supabase = createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Mobile web needs this — browser redirect, not deep links
    },
  });
}

export { supabase };

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
