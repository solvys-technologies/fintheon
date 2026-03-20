// [claude-code 2026-02-26] Improve OAuth behavior for embedded surfaces (Notion, TradeSea, etc).

import { isElectron } from '../../lib/platform';

interface EmbeddedBrowserFrameProps {
  title: string;
  src: string;
  className?: string;
}

export function EmbeddedBrowserFrame({ title, src, className = 'w-full h-full bg-white' }: EmbeddedBrowserFrameProps) {
  if (isElectron()) {
    return (
      <webview
        title={title}
        src={src}
        className={className}
        allowpopups
        partition="persist:pulse"
        webpreferences="nativeWindowOpen=yes"
      />
    );
  }

  return (
    <iframe
      title={title}
      src={src}
      className={className}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"
    />
  );
}
