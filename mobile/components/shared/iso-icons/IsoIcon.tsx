// [claude-code 2026-04-20] Base wrapper for isometric menu icons — fade-in on mount, press-scale micro-interaction
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface IsoIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  animate?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  style?: React.CSSProperties;
  children?: ReactNode;
}

const MOUNT = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: "easeOut" as const },
};

const STATIC = {
  initial: false,
};

export function IsoIcon({
  size = 24,
  className,
  strokeWidth = 1.8,
  animate = true,
  onClick,
  style,
  children,
  ...aria
}: IsoIconProps) {
  const motionProps = animate ? MOUNT : STATIC;

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
      style={style}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      {...motionProps}
      {...aria}
    >
      {children}
    </motion.svg>
  );
}
