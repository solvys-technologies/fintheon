// [claude-code 2026-04-16] Fluxer embed — webview in Electron (bypasses X-Frame-Options), external link fallback in browser
import { useState, useRef, useCallback, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { isElectron } from "../../lib/platform";
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
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "fluxer-theme", css: buildFluxerThemeCSS() },
        "*",
      );
    } catch {
      // Cross-origin — theme injection not possible
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
        </div>
      </div>
    );
  }

  const src = channelPath
    ? `${FLUXER_URL.replace(/\/$/, "")}/${channelPath.replace(/^\//, "")}`
    : FLUXER_URL;

  // Electron: webview bypasses X-Frame-Options / CSP frame-ancestors
  const webviewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const onReady = () => setLoaded(true);
    wv.addEventListener("did-finish-load", onReady);
    return () => wv.removeEventListener("did-finish-load", onReady);
  }, []);

  if (isElectron()) {
    return (
      <div className="relative h-full w-full">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--fintheon-bg)]">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--fintheon-accent)]/30 border-t-[var(--fintheon-accent)] animate-spin" />
          </div>
        )}
        <webview
          ref={webviewRef as React.Ref<never>}
          src={src}
          className="h-full w-full"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
          allowpopups
          partition="persist:fintheon"
          webpreferences="nativeWindowOpen=yes"
        />
      </div>
    );
  }

  // Browser fallback: Fluxer sends X-Frame-Options: DENY, so iframe won't work.
  // Show a styled launcher that opens Fluxer in a new tab.
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-full border border-[var(--fintheon-accent)]/20 flex items-center justify-center">
          <ExternalLink
            size={20}
            className="text-[var(--fintheon-accent)]/60"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[var(--fintheon-text)]/80 text-sm font-medium">
            Imperium Forum
          </p>
          <p className="text-[var(--fintheon-text)]/40 text-xs leading-relaxed">
            Fluxer opens in a separate window in browser mode. Use the desktop
            app for an embedded experience.
          </p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/5 px-4 py-2 text-xs font-medium text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/50 transition-all"
        >
          <ExternalLink size={13} />
          Open Forum
        </a>
      </div>
    </div>
  );
}
