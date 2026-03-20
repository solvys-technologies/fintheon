import { useState } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
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
import { pulseAppearance } from './components/auth/pulseAppearance';
// ERProvider removed - using component-based ER monitoring for stability

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

const DEFAULT_CLERK_DOMAIN = 'clerk.app.pricedinresearch.io';
const DEFAULT_CLERK_PROXY_URL = 'https://clerk.app.pricedinresearch.io';

// Debug logging
if (DEV_MODE) {
  console.log('[DEV MODE] Bypass Auth:', BYPASS_AUTH, 'DEV:', import.meta.env.DEV, 'MODE:', import.meta.env.MODE, 'VITE_BYPASS_AUTH:', import.meta.env.VITE_BYPASS_AUTH);
}

function AppInner() {
  const [showSettings, setShowSettings] = useState(false);

  const appContent = (
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

  // In dev mode with auth bypass, show app directly
  if (BYPASS_AUTH) {
    return appContent;
  }

  // Normal Clerk authentication flow
  return (
    <>
      <SignedOut>
        <AuthShell>
          <SignIn
            appearance={pulseAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        </AuthShell>
      </SignedOut>
      <SignedIn>
        {appContent}
      </SignedIn>
    </>
  );
}

export default function App() {
  // Production Clerk publishable key
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const clerkDomain = import.meta.env.VITE_CLERK_DOMAIN || DEFAULT_CLERK_DOMAIN;
  const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || DEFAULT_CLERK_PROXY_URL;

  // In dev mode with auth bypass, skip ClerkProvider
  if (BYPASS_AUTH) {
    return <AppInner />;
  }

  if (!clerkKey && DEV_MODE) {
    console.warn('[DEV MODE] Missing VITE_CLERK_PUBLISHABLE_KEY. Showing AuthShell preview without Clerk.');
    return (
      <AuthShell>
        <MockSignInPreview />
      </AuthShell>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkKey} domain={clerkDomain} proxyUrl={clerkProxyUrl}>
      <AppInner />
    </ClerkProvider>
  );
}

function MockSignInPreview() {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-yellow-500/20 bg-black/60 px-6 py-8 text-center text-yellow-100">
      <p className="text-xs uppercase tracking-[0.4em] text-yellow-500/70">Clerk Preview</p>
      <p className="text-sm text-yellow-100/80">
        Set <span className="font-semibold">VITE_CLERK_PUBLISHABLE_KEY</span> to load the real Clerk widget.
      </p>
      <div className="space-y-2 text-left text-[0.85rem] text-yellow-100/80">
        <label className="text-[0.6rem] uppercase tracking-[0.3em] text-yellow-600/80">Email address</label>
        <div className="rounded-full border border-yellow-500/20 bg-black/50 px-4 py-3 text-yellow-100/60">user@example.com</div>
        <label className="text-[0.6rem] uppercase tracking-[0.3em] text-yellow-600/80">Password</label>
        <div className="rounded-full border border-yellow-500/20 bg-black/50 px-4 py-3 text-yellow-100/60">••••••••</div>
        <button className="mt-4 w-full rounded-full border-2 border-yellow-500 bg-black py-3 text-xs font-bold uppercase tracking-[0.3em] text-yellow-500">
          Continue
        </button>
      </div>
    </div>
  );
}
