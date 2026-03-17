// [claude-code 2026-03-11] T2: Mini widget now fetches IV score from backend
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { FloatingWidget } from './components/layout/FloatingWidget';
import { useBackend } from './lib/backend';
import { useSettings } from './contexts/SettingsContext';
import type { IVScoreResponse } from './types/market-data';
import './index.css';

/**
 * Mini Widget App - Standalone floating widget for persistent display
 * This is a lightweight version that runs in a separate Electron window
 * Simplified for local single-user mode - no authentication
 */
function MiniWidgetApp() {
  const backend = useBackend();
  const { selectedSymbol } = useSettings();
  const [ivData, setIvData] = useState<IVScoreResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(true);

  // Fetch blended IV score from backend — uses selected instrument from settings
  useEffect(() => {
    const fetchIVScore = async () => {
      try {
        const data = await backend.marketData.getIVScore(selectedSymbol.symbol);
        setIvData(data);
      } catch (error) {
        console.warn('[MiniWidget] Failed to fetch IV score:', error);
      } finally {
        setIvLoading(false);
      }
    };

    fetchIVScore();
    const interval = setInterval(fetchIVScore, 60_000);
    return () => clearInterval(interval);
  }, [backend, selectedSymbol.symbol]);

  const handleClose = () => {
    // Hide the widget window via Electron
    window.electron?.toggleMiniWidget();
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Draggable area for moving the window */}
      <div
        className="fixed top-0 left-0 right-0 h-4 cursor-move"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Widget content - positioned to account for drag area */}
      <div className="pt-2">
        <FloatingWidget
          ivData={ivData}
          ivLoading={ivLoading}
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
