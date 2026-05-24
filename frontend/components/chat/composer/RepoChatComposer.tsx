import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

type ComposerSurfaceGeometry = {
  bottom: number;
  left: number;
  maxHeight: number;
  width: number;
};

const COMPOSER_SURFACE_GUTTER = 12;
const DEFAULT_SURFACE_MAX_HEIGHT = 280;
const MIN_SURFACE_MAX_HEIGHT = 112;

function parsePixelHeight(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SURFACE_MAX_HEIGHT;
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [geometry, setGeometry] = useState<ComposerSurfaceGeometry | null>(
    null,
  );

  const updateGeometry = useCallback(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor || typeof window === "undefined") {
      setGeometry(null);
      return;
    }

    const composer = anchor.closest(
      ".fintheon-repo-chat-composer__inner",
    ) as HTMLElement | null;
    const input =
      (composer?.querySelector(".fintheon-composer-input") as HTMLElement | null) ??
      composer ??
      anchor;
    const rect = input.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (
      rect.right <= 0 ||
      rect.left >= window.innerWidth ||
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight
    ) {
      setGeometry(null);
      return;
    }

    const targetWidth = Math.min(
      rect.width * 0.9,
      window.innerWidth - COMPOSER_SURFACE_GUTTER * 2,
    );
    const left = Math.min(
      Math.max(
        rect.left + (rect.width - targetWidth) / 2,
        COMPOSER_SURFACE_GUTTER,
      ),
      window.innerWidth - targetWidth - COMPOSER_SURFACE_GUTTER,
    );
    const availableHeight = Math.max(
      MIN_SURFACE_MAX_HEIGHT,
      rect.top - COMPOSER_SURFACE_GUTTER,
    );
    const requestedHeight = parsePixelHeight(maxHeight);

    setGeometry({
      bottom: Math.max(window.innerHeight - rect.top, COMPOSER_SURFACE_GUTTER),
      left,
      maxHeight: Math.min(requestedHeight, availableHeight),
      width: targetWidth,
    });
  }, [maxHeight, open]);

  useLayoutEffect(() => {
    updateGeometry();
    if (!open || typeof window === "undefined") return;

    const anchor = anchorRef.current;
    const composer = anchor?.closest(
      ".fintheon-repo-chat-composer__inner",
    ) as HTMLElement | null;
    const input =
      (composer?.querySelector(".fintheon-composer-input") as HTMLElement | null) ??
      composer ??
      null;
    const observer =
      typeof ResizeObserver !== "undefined" && input
        ? new ResizeObserver(updateGeometry)
        : null;

    if (observer && input) observer.observe(input);
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
    };
  }, [open, updateGeometry]);

  const surface =
    open && geometry && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-hidden={!open}
            data-composer-surface={kind}
            data-composer-surface-portal="true"
            className={`fintheon-chat-input-drawer transition-all duration-300 pointer-events-auto ${className}`}
            style={{
              ...style,
              bottom: `${geometry.bottom}px`,
              left: `${geometry.left}px`,
              maxHeight: `${geometry.maxHeight}px`,
              opacity: 1,
              position: "fixed",
              width: `${geometry.width}px`,
            }}
            {...props}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="fintheon-chat-input-drawer-anchor"
        data-composer-surface-anchor={kind}
      />
      {surface}
    </>
  );
}
