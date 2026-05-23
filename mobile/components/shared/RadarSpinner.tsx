// [codex 2026-05-23] Mobile compatibility wrapper for dot/matrix loaders.
import { DotMatrixLoader } from "@frontend/components/icon-bank/DotMatrixLoader";

interface RadarSpinnerProps {
  size?: number;
  color?: string;
}

export function RadarSpinner({
  size = 22,
  color = "var(--black, #000)",
}: RadarSpinnerProps) {
  return <DotMatrixLoader variant="diagonal-scan" size={size} color={color} />;
}
