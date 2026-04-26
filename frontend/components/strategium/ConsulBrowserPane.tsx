// [claude-code 2026-04-25] S40-P9: Consul Browser pane — wraps the Browserbase
// liveURL in an iframe (web) / will use Electron <webview> when running inside
// the desktop shell (graceful fallback to iframe outside Electron).
//
// Renders nothing if no active session — the pane shape is the parent's
// concern (DualPaneShell decides whether to mount us at all).

import { useEffect, useState } from "react";
import { X, Globe, RefreshCw } from "lucide-react";
import { useConsulBrowser } from "../../contexts/ConsulBrowserContext";

interface ConsulBrowserPaneProps {
  className?: string;
}

function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { electron?: unknown }).electron ||
    (window as unknown as { isElectron?: boolean }).isElectron,
  );
}

export function ConsulBrowserPane({ className = "" }: ConsulBrowserPaneProps) {
  const { session, stats, close, isLoading } = useConsulBrowser();
  const [supportsWebview, setSupportsWebview] = useState(false);

  useEffect(() => {
    setSupportsWebview(isElectron());
  }, []);

  if (!session) return null;

  return (
    <div
      className={`flex flex-col h-full bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-accent)]/20 ${className}`}
    >
      <div className="flex items-center gap-2 h-8 px-3 border-b border-[var(--fintheon-accent)]/15 text-[11px]">
        <Globe size={12} className="text-[var(--fintheon-accent)]" />
        <span className="font-mono text-[var(--fintheon-text)]/80">
          Consul Browser
        </span>
        <span className="text-[var(--fintheon-text)]/50 font-mono">
          · {stats.dayCount}/{stats.dayCap} today
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="p-1 rounded-sm hover:bg-[var(--fintheon-text)]/10 transition-colors"
          aria-label="Refresh pane"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
        <button
          type="button"
          onClick={() => void close()}
          disabled={isLoading}
          className="p-1 rounded-sm hover:bg-[var(--fintheon-text)]/10 transition-colors disabled:opacity-40"
          aria-label="Close session"
          title="Close session"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-black">
        {supportsWebview ? (
          // @ts-ignore — webview is an Electron-only element
          <webview
            src={session.liveUrl}
            // Sandbox + fresh stealth profile per brief — no credential injection.
            partition="persist:consul-browser-stealth"
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <iframe
            src={session.liveUrl}
            title="Consul Browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
          />
        )}
      </div>
    </div>
  );
}
