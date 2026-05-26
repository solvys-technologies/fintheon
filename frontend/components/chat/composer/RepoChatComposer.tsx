import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

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
    "--fintheon-chat-drawer-width": "90%",
  } as CSSProperties;

  return (
    <div
      className={`fintheon-chat-composer-wrap ${className}`}
      data-composer-format={format}
      style={style}
      {...props}
    >
      <div
        className="fintheon-repo-chat-composer__inner"
        style={innerStyle}
      >
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
  if (!open) return null;

  return (
    <div
      aria-hidden={!open}
      data-composer-surface={kind}
      data-open="true"
      className={`fintheon-chat-input-drawer narrative-chat-drawer-motion t-panel-slide transition-all duration-300 pointer-events-auto ${className}`}
      style={{
        ...style,
        maxHeight,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
