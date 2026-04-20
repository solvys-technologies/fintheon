// [claude-code 2026-04-20] Base wrapper for isometric icons — fade-in on mount, press-scale, lucide-compatible props
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export interface IsoIconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  animate?: boolean;
  onClick?: () => void;
  color?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

const MOUNT = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: "easeOut" as const },
};

const STATIC = { initial: false } as const;

export function IsoIcon({
  size = 24,
  className,
  strokeWidth = 1.8,
  animate = true,
  onClick,
  color,
  style,
  children,
  ...aria
}: IsoIconProps) {
  const motionProps = animate ? MOUNT : STATIC;
  const mergedStyle: CSSProperties = color
    ? { color, ...style }
    : (style ?? {});

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={mergedStyle}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      {...motionProps}
      {...aria}
    >
      {children}
    </motion.svg>
  );
}
