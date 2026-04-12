// [claude-code 2026-04-12] Fluxer.app iframe embed — replaces BulletinFeed forum + LiveKit voice
import { useState, useRef, useCallback } from "react";
import { buildFluxerThemeCSS } from "../../lib/fluxer-theme";

const FLUXER_URL = import.meta.env.VITE_FLUXER_COMMUNITY_URL as
  | string
  | undefined;

interface FluxerEmbedProps {
  channelPath?: string;
}

export function FluxerEmbed({ channelPath }: FluxerEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    // Attempt to inject Solvys Gold theme via postMessage
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "fluxer-theme", css: buildFluxerThemeCSS() },
        "*",
      );
    } catch {
      // Cross-origin — theme injection not possible, Fluxer will use its own theme
    }
  }, []);

  if (!FLUXER_URL) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-[var(--fintheon-text)]/60 text-sm">
            Forum not configured
          </p>
          <p className="text-[var(--fintheon-text)]/30 text-xs max-w-xs">
            Set{" "}
            <code className="text-[var(--fintheon-accent)]/60">
              VITE_FLUXER_COMMUNITY_URL
            </code>{" "}
            in your environment to enable the community hub.
          </p>
          <a
            href="https://fluxer.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-[var(--fintheon-accent)] hover:underline"
          >
            fluxer.app
          </a>
        </div>
      </div>
    );
  }

  const src = channelPath
    ? `${FLUXER_URL.replace(/\/$/, "")}/${channelPath.replace(/^\//, "")}`
    : FLUXER_URL;

  return (
    <div className="relative h-full w-full">
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--fintheon-bg)]">
          <div className="h-5 w-5 rounded-full border-2 border-[var(--fintheon-accent)]/30 border-t-[var(--fintheon-accent)] animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={handleLoad}
        title="Forum"
        className="h-full w-full border-0"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
        allow="microphone; camera; display-capture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      />
    </div>
  );
}
