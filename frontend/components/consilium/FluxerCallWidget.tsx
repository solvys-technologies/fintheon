// [claude-code 2026-04-16] Compact header call widget — rolls open to reveal Fluxer voice room controls
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Headphones,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
  Video,
  PhoneOff,
} from "lucide-react";
import { isElectron } from "../../lib/platform";

const FLUXER_URL = import.meta.env.VITE_FLUXER_COMMUNITY_URL as
  | string
  | undefined;

// Voice channel path appended to the community base URL
const VOICE_CHANNEL_PATH = "1492795130002214970";

interface FluxerCallWidgetProps {
  className?: string;
}

export function FluxerCallWidget({ className = "" }: FluxerCallWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  const voiceUrl = FLUXER_URL
    ? `${FLUXER_URL.replace(/\/$/, "")}/${VOICE_CHANNEL_PATH}`
    : undefined;

  const handleConnect = useCallback(() => {
    if (connected) {
      setConnected(false);
      setMuted(false);
      setDeafened(false);
      setShowVideoPanel(false);
      return;
    }
    setConnected(true);
  }, [connected]);

  const handleVideoPopout = useCallback(() => {
    if (!voiceUrl) return;
    if (isElectron()) {
      setShowVideoPanel((v) => !v);
    } else {
      window.open(voiceUrl, "_blank", "noopener,noreferrer");
    }
  }, [voiceUrl]);

  if (!FLUXER_URL) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={`relative flex items-center ${className}`}
      >
        {/* Trigger button — headphones icon */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`relative p-1.5 rounded-lg transition-all ${
            connected
              ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15"
              : "text-gray-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10"
          }`}
          title={connected ? "Voice connected" : "Voice room"}
        >
          <Headphones className="w-3.5 h-3.5" />
          {connected && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        {/* Roll-out controls panel */}
        <div
          className="flex items-center overflow-hidden"
          style={{
            width: expanded ? 132 : 0,
            opacity: expanded ? 1 : 0,
            transition:
              "width 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 180ms ease",
          }}
        >
          <div className="flex items-center gap-0.5 pl-1">
            {/* Connect / disconnect */}
            <button
              onClick={handleConnect}
              className={`p-1.5 rounded-md transition-all text-xs ${
                connected
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-emerald-400 hover:bg-emerald-500/10"
              }`}
              title={connected ? "Disconnect" : "Connect to voice"}
            >
              {connected ? (
                <PhoneOff className="w-3 h-3" />
              ) : (
                <Headphones className="w-3 h-3" />
              )}
            </button>

            {/* Mute */}
            <button
              onClick={() => setMuted((v) => !v)}
              disabled={!connected}
              className={`p-1.5 rounded-md transition-all ${
                !connected
                  ? "text-gray-600 cursor-not-allowed"
                  : muted
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/10"
              }`}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <MicOff className="w-3 h-3" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
            </button>

            {/* Deafen */}
            <button
              onClick={() => setDeafened((v) => !v)}
              disabled={!connected}
              className={`p-1.5 rounded-md transition-all ${
                !connected
                  ? "text-gray-600 cursor-not-allowed"
                  : deafened
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/10"
              }`}
              title={deafened ? "Undeafen" : "Deafen"}
            >
              {deafened ? (
                <VolumeOff className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>

            {/* Video pop-out */}
            <button
              onClick={handleVideoPopout}
              disabled={!connected}
              className={`p-1.5 rounded-md transition-all ${
                !connected
                  ? "text-gray-600 cursor-not-allowed"
                  : showVideoPanel
                    ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                    : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/10"
              }`}
              title="Video room"
            >
              <Video className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating video panel (Electron only) */}
      {showVideoPanel && connected && isElectron() && voiceUrl && (
        <div
          className="fixed bottom-16 right-4 z-[9999] w-[400px] h-[300px] rounded-xl overflow-hidden border border-[var(--fintheon-accent)]/20 shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
          style={{ backdropFilter: "blur(24px)" }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--fintheon-bg)] border-b border-[var(--fintheon-accent)]/10">
            <span className="text-[10px] font-medium text-[var(--fintheon-accent)]/60 uppercase tracking-wider">
              Voice Room
            </span>
            <button
              onClick={() => setShowVideoPanel(false)}
              className="text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/60 transition-colors text-xs"
            >
              x
            </button>
          </div>
          <webview
            src={voiceUrl}
            className="w-full"
            style={{ height: "calc(100% - 28px)" }}
            allowpopups
            partition="persist:fintheon"
            webpreferences="nativeWindowOpen=yes"
          />
        </div>
      )}
    </>
  );
}
