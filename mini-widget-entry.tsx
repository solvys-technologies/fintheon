// [claude-code 2026-03-22] Mini widget — Supabase auth (replaces Clerk)
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './frontend/contexts/AuthContext';
import { SettingsProvider } from './frontend/contexts/SettingsContext';
import { FloatingWidget } from './frontend/components/layout/FloatingWidget';
import { useBackend } from './frontend/lib/backend';
import './index.css';

/**
 * Mini Widget App - Standalone floating widget for persistent display
 * This is a lightweight version that runs in a separate Electron window
 */
function MiniWidgetApp() {
  const backend = useBackend();
  const [vix, setVix] = useState(20);
  const [ivScore, setIvScore] = useState(3.2);

  // Fetch VIX value
  useEffect(() => {
    const fetchVIX = async () => {
      try {
        const newsClient = (backend as any).news;
        const baseClient = (newsClient as any).baseClient;
        const response = await baseClient.callTypedAPI('/news/fetch-vix', { method: 'GET', body: undefined });
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.value === 'number') {
            setVix(data.value);
          }
        }
      } catch (error) {
        console.error('[MiniWidget] Failed to fetch VIX:', error);
      }
    };

    fetchVIX();
    const interval = setInterval(fetchVIX, 300000);
    return () => clearInterval(interval);
  }, [backend]);

  // Simulate IV score updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIvScore(prev => Math.max(0, Math.min(10, prev + (Math.random() - 0.5) * 0.5)));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    window.electron?.toggleMiniWidget();
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div
        className="fixed top-0 left-0 right-0 h-4 cursor-move"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <div className="pt-2">
        <FloatingWidget
          vix={vix}
          ivScore={ivScore}
          layoutOption="tickers-only"
          onClose={handleClose}
        />
      </div>
    </div>
  );
}

function MiniWidgetRoot() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <MiniWidgetApp />
      </SettingsProvider>
    </AuthProvider>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MiniWidgetRoot />);
}
