// [claude-code 2026-03-22] Supabase auth — replaces Clerk (ClerkProvider → Supabase session listener)
import { useState, useEffect } from 'react';
import { supabase, type Session } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { VIXProvider } from './contexts/VIXContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { PsychProvider } from './contexts/PsychContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { NotificationContainer } from './components/NotificationToast';
import { PsychOrientationModal } from './components/psych/PsychOrientationModal';
import { AuthShell } from './components/auth/AuthShell';
import { SupabaseSignIn } from './components/auth/SupabaseSignIn';

const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost');
const BYPASS_AUTH = IS_ELECTRON || (DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true');

if (DEV_MODE) {
  console.log('[DEV MODE] Bypass Auth:', BYPASS_AUTH, 'IS_ELECTRON:', IS_ELECTRON, 'DEV:', import.meta.env.DEV, 'MODE:', import.meta.env.MODE, 'VITE_BYPASS_AUTH:', import.meta.env.VITE_BYPASS_AUTH);
}

function AppInner() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <VIXProvider>
    <AuthProvider>
      <SettingsProvider>
        <PsychProvider>
          <ThreadProvider>
            <div className="dark">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');

              * {
                scrollbar-width: thin;
                scrollbar-color: #D4AF37 #0a0a00;
              }

              *::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }

              *::-webkit-scrollbar-track {
                background: #0a0a00;
              }

              *::-webkit-scrollbar-thumb {
                background: #D4AF37;
                border-radius: 4px;
              }

              *::-webkit-scrollbar-thumb:hover {
                background: #FFD060;
              }

              .scanline-overlay {
                background: repeating-linear-gradient(
                  0deg,
                  rgba(255, 192, 56, 0.03) 0px,
                  rgba(255, 192, 56, 0.03) 1px,
                  transparent 1px,
                  transparent 2px
                );
                pointer-events: none;
              }
            `}</style>
              <MainLayout onSettingsClick={() => setShowSettings(true)} />
              {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
              <NotificationContainer />
              <PsychOrientationModal />
            </div>
          </ThreadProvider>
        </PsychProvider>
      </SettingsProvider>
    </AuthProvider>
    </VIXProvider>
  );
}

export default function App() {
  // Bypass mode: skip auth entirely (Electron / dev with VITE_BYPASS_AUTH=true)
  if (BYPASS_AUTH) {
    return <AppInner />;
  }

  // Supabase not configured: show preview
  if (!supabase) {
    if (DEV_MODE) {
      console.warn('[DEV MODE] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Showing auth preview.');
      return (
        <AuthShell>
          <MockSignInPreview />
        </AuthShell>
      );
    }
    return <AppInner />;
  }

  return <SupabaseAuthGate />;
}

function SupabaseAuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthShell>
        <SupabaseSignIn />
      </AuthShell>
    );
  }

  return <AppInner />;
}

function MockSignInPreview() {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-yellow-500/20 bg-black/60 px-6 py-8 text-center text-yellow-100">
      <p className="text-xs uppercase tracking-[0.4em] text-yellow-500/70">Auth Preview</p>
      <p className="text-sm text-yellow-100/80">
        Set <span className="font-semibold">VITE_SUPABASE_URL</span> and{' '}
        <span className="font-semibold">VITE_SUPABASE_ANON_KEY</span> to load the real sign-in.
      </p>
      <div className="mt-2 rounded-full border border-yellow-500/20 bg-black/50 px-4 py-3 text-sm text-yellow-100/60">
        Continue with Google (preview)
      </div>
    </div>
  );
}
