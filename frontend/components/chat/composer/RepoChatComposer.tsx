import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

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
  return (
    <div
      aria-hidden={!open}
      data-composer-surface={kind}
      className={`fintheon-chat-input-drawer transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      } ${className}`}
      style={{
        maxHeight: open ? maxHeight : "0px",
        opacity: open ? 1 : 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
