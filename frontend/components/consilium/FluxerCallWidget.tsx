// [claude-code 2026-04-16] Compact header call widget — rolls open to reveal Fluxer voice room controls
// [claude-code 2026-04-16] Voice channel updated to trading-floor; connect opens Fluxer directly
// [claude-code 2026-04-17] Connect joins silently in background (hidden webview wires system audio); PiP icon toggles visible panel
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
  Video,
  PhoneOff,
  PictureInPicture2,
} from "@/components/shared/iso-icons";
import { isElectron } from "../../lib/platform";

const FLUXER_URL = import.meta.env.VITE_FLUXER_COMMUNITY_URL as
  | string
  | undefined;

// Trading-floor voice channel in the PIC Fluxer community
const VOICE_CHANNEL_PATH = "1494460462212445023";

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

  const fluxerWindowRef = useRef<Window | null>(null);

  // Connect opens Fluxer voice channel silently: Electron mounts a hidden
  // webview so system audio wires automatically; browser opens a background
  // window. The user can reveal the visible panel via the PiP button.
  // Mute/deafen are visual-only indicators — Fluxer does not expose a
  // postMessage API for audio control, so users manage audio inside Fluxer.
  const handleConnect = useCallback(() => {
    if (connected) {
      setConnected(false);
      setMuted(false);
      setDeafened(false);
      setShowVideoPanel(false);
      if (fluxerWindowRef.current && !fluxerWindowRef.current.closed) {
        fluxerWindowRef.current.close();
      }
      fluxerWindowRef.current = null;
      return;
    }
    if (!voiceUrl) return;
    if (!isElectron()) {
      // Browser: open a backgrounded window — user can focus it if needed
      fluxerWindowRef.current = window.open(
        voiceUrl,
        "fluxer-voice",
        "noopener,noreferrer",
      );
    }
    // Electron: the hidden webview below mounts when `connected` flips true
    setConnected(true);
  }, [connected, voiceUrl]);

  const handlePipToggle = useCallback(() => {
    if (!voiceUrl) return;
    if (isElectron()) {
      setShowVideoPanel((v) => !v);
    } else {
      // Browser: focus the background window (opened on connect)
      if (fluxerWindowRef.current && !fluxerWindowRef.current.closed) {
        fluxerWindowRef.current.focus();
      } else {
        fluxerWindowRef.current = window.open(
          voiceUrl,
          "fluxer-voice",
          "noopener,noreferrer",
        );
      }
    }
  }, [voiceUrl]);

  if (!FLUXER_URL) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={`relative flex items-center ${className}`}
      >
        {/* Trigger button — phone icon */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`relative toolbar-icon-btn ${
            connected
              ? "!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-400"
              : ""
          }`}
          title={connected ? "Voice connected" : "Voice room"}
        >
          <Phone className="w-3 h-3" />
          {connected && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        {/* Roll-out controls panel */}
        <div
          className="flex items-center overflow-hidden"
          style={{
            width: expanded ? 156 : 0,
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
                <Phone className="w-3 h-3" />
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

            {/* Video (placeholder — reserved for future in-app video) */}
            <button
              disabled
              className="p-1.5 rounded-md text-gray-600 cursor-not-allowed"
              title="Video (inside voice room)"
            >
              <Video className="w-3 h-3" />
            </button>

            {/* Picture-in-picture — reveals the voice room panel */}
            <button
              onClick={handlePipToggle}
              disabled={!connected}
              className={`p-1.5 rounded-md transition-all ${
                !connected
                  ? "text-gray-600 cursor-not-allowed"
                  : showVideoPanel
                    ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                    : "text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 hover:bg-[var(--fintheon-accent)]/10"
              }`}
              title={showVideoPanel ? "Hide voice room" : "Show voice room"}
            >
              <PictureInPicture2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Persistent voice-room webview (Electron only).
          Renders as soon as `connected` flips true so audio wires up in the
          background. Position is off-screen when the user hasn't popped the
          panel — display:none would suspend the webview and cut audio. */}
      {connected && isElectron() && voiceUrl && (
        <div
          className={
            showVideoPanel
              ? "fixed bottom-16 right-4 z-[9999] w-[400px] h-[300px] rounded-xl overflow-hidden border border-[var(--fintheon-accent)]/20 shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
              : "fixed w-[400px] h-[300px] pointer-events-none"
          }
          style={
            showVideoPanel
              ? { backdropFilter: "blur(24px)" }
              : {
                  top: -9999,
                  left: -9999,
                  opacity: 0,
                }
          }
        >
          {showVideoPanel && (
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
          )}
          <webview
            src={voiceUrl}
            className="w-full"
            style={{
              height: showVideoPanel ? "calc(100% - 28px)" : "100%",
            }}
            allowpopups
            partition="persist:fintheon"
            webpreferences="nativeWindowOpen=yes,autoplayPolicy=no-user-gesture-required"
          />
        </div>
      )}
    </>
  );
}
