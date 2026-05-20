// [codex 2026-05-19] Forecast redeliberation is now enforced by the backend before
// Desk Plans are returned, so forecast rows render immediately on every surface.
import { type ReactNode } from "react";

interface PriceRevealTagProps {
  planDate?: string | null;
  windowStartTime: string;
  children: ReactNode;
}

export function PriceRevealTag({
  children,
}: PriceRevealTagProps) {
  return <>{children}</>;
}
