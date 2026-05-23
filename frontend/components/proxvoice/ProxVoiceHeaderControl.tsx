import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  PictureInPicture2,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useProxVoice } from "../../contexts/ProxVoiceContext";
import { ProxVoicePanel } from "./ProxVoicePanel";

interface ProxVoiceHeaderControlProps {
  className?: string;
}

export function ProxVoiceHeaderControl({
  className = "",
}: ProxVoiceHeaderControlProps) {
  const voice = useProxVoice();
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const connected = voice.state === "connected";
  const connecting = voice.state === "connecting";

  async function handleConnect() {
    if (connected) {
      voice.disconnect();
      return;
    }
    await voice.connect();
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => setExpanded((v) => !v)}
        className={`relative toolbar-icon-btn ${connected ? "toolbar-active" : ""}`}
        title={connected ? "Forum live" : "Forum"}
      >
        <Phone
          className={`h-3 w-3 ${connected ? "toolbar-icon-active" : ""}`}
          style={
            connected
              ? ({ "--toolbar-icon-active-color": "#34d399" } as CSSProperties)
              : undefined
          }
        />
        {connected && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--fintheon-accent)] transition-opacity duration-200" />
        )}
      </button>

      <div
        className="flex items-center overflow-hidden"
        style={{
          width: expanded ? 150 : 0,
          opacity: expanded ? 1 : 0,
          transition: "width 220ms ease, opacity 180ms ease",
        }}
      >
        <div className="flex items-center gap-0.5 pl-1">
          <button
            onClick={() => void handleConnect()}
            className={`fintheon-action-link rounded-md p-1.5 ${
              connected ? "text-red-300" : "text-[var(--fintheon-accent)]"
            }`}
            title={connected ? "Disconnect" : "Connect"}
          >
            {connected ? <PhoneOff className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
          </button>
          <button
            onClick={() => void voice.toggleMute()}
            disabled={!connected}
            className="fintheon-action-link rounded-md p-1.5 text-[var(--fintheon-text)]/55 disabled:text-zinc-700"
            title={voice.muted ? "Unmute" : "Mute"}
          >
            {voice.muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          </button>
          <button
            onClick={voice.toggleDeafen}
            disabled={!connected}
            className="fintheon-action-link rounded-md p-1.5 text-[var(--fintheon-text)]/55 disabled:text-zinc-700"
            title={voice.deafened ? "Undeafen" : "Deafen"}
          >
            {voice.deafened ? <VolumeOff className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="fintheon-action-link rounded-md p-1.5 text-[var(--fintheon-text)]/55"
            title="Show Forum"
          >
            <PictureInPicture2 className="h-3 w-3" />
          </button>
          <span className="min-w-4 text-center text-[10px] tabular-nums text-[var(--fintheon-accent)]/70">
            {connecting ? "..." : voice.participants.length}
          </span>
        </div>
      </div>
      <ProxVoicePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        anchorRect={triggerRef.current?.getBoundingClientRect() ?? null}
      />
    </div>
  );
}
