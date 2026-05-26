import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type RepoChatComposerFormat = "full" | "compact";
export type RepoChatComposerSurface = "drawer";

interface RepoChatComposerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  format?: RepoChatComposerFormat;
  maxWidth?: string;
}

interface RepoChatComposerSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  open: boolean;
  kind?: RepoChatComposerSurface;
  className?: string;
  maxHeight?: string;
}

export function RepoChatComposer({
  children,
  format = "full",
  maxWidth,
  className = "",
  style,
  ...props
}: RepoChatComposerProps) {
  const innerStyle = {
    "--fintheon-chat-composer-max":
      maxWidth ?? (format === "compact" ? "32rem" : "56rem"),
    "--fintheon-chat-drawer-width": "92%",
  } as CSSProperties;

  return (
    <div
      className={`fintheon-chat-composer-wrap ${className}`}
      data-composer-format={format}
      style={style}
      {...props}
    >
      <div className="fintheon-repo-chat-composer__inner" style={innerStyle}>
        {children}
      </div>
    </div>
  );
}

export function RepoChatComposerSurface({
  children,
  open,
  kind = "drawer",
  className = "",
  maxHeight = "280px",
  style,
  ...props
}: RepoChatComposerSurfaceProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div
      aria-hidden={!isVisible}
      data-composer-surface={kind}
      data-open={isVisible ? "true" : "false"}
      className={`fintheon-chat-input-drawer narrative-chat-drawer-motion t-panel-slide ${isVisible ? "pointer-events-auto" : "pointer-events-none"} ${className}`}
      style={
        {
          ...style,
          "--fintheon-chat-drawer-max-height": maxHeight,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  );
}
