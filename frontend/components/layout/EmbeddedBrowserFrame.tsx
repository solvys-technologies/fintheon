// [claude-code 2026-04-25] S42-T5: added optional mode="browserbase" so the
// ArtifactPane can mount a live Browserbase debugger URL with the clipboard
// permissions Browserbase requires + a postMessage relay for nav events.
import { useEffect, useRef } from "react";
import { isElectron } from "../../lib/platform";

export type EmbeddedBrowserMode = "default" | "browserbase";

export interface EmbeddedBrowserNavEvent {
  type: string;
  url?: string;
  title?: string;
  [key: string]: unknown;
}

interface EmbeddedBrowserFrameProps {
  title: string;
  src: string;
  className?: string;
  /**
   * Mounting mode. `"browserbase"` adds clipboard sandbox flags + listens for
   * `postMessage` nav events from the Browserbase debugger and forwards them
   * via `onNavEvent`. Default behavior preserved when omitted.
   */
  mode?: EmbeddedBrowserMode;
  /**
   * Called for each nav event the embedded session emits via postMessage.
   * Only fires when `mode === "browserbase"`.
   */
  onNavEvent?: (event: EmbeddedBrowserNavEvent) => void;
}

const DEFAULT_SANDBOX =
  "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation";

function browserbaseOriginOf(src: string): string | null {
  try {
    return new URL(src).origin;
  } catch {
    return null;
  }
}

export function EmbeddedBrowserFrame({
  title,
  src,
  className = "w-full h-full bg-white",
  mode = "default",
  onNavEvent,
}: EmbeddedBrowserFrameProps) {
  const isBrowserbase = mode === "browserbase";

  useEffect(() => {
    if (!isBrowserbase || !onNavEvent) return;
    const trustedOrigin = browserbaseOriginOf(src);
    const handler = (e: MessageEvent) => {
      if (trustedOrigin && e.origin !== trustedOrigin) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      const candidate = data as EmbeddedBrowserNavEvent;
      if (typeof candidate.type !== "string") return;
      onNavEvent(candidate);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isBrowserbase, onNavEvent, src]);

  if (isElectron()) {
    return (
      <webview
        title={title}
        src={src}
        className={className}
        allowpopups
        partition="persist:fintheon"
        webpreferences="nativeWindowOpen=yes"
      />
    );
  }

  return (
    <iframe
      title={title}
      src={src}
      className={className}
      sandbox={DEFAULT_SANDBOX}
      {...(isBrowserbase ? { allow: "clipboard-read; clipboard-write" } : {})}
    />
  );
}
