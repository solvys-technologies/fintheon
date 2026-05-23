// [codex 2026-05-23] Legacy exports mapped to dot/matrix loaders.
import { DotMatrixLoader } from "./DotMatrixLoader";

interface LegacySpinnerProps {
  size?: number;
  color?: string;
  active?: boolean;
  className?: string;
  cells?: number;
  rows?: number;
  streamWidth?: number;
}

export function FishSwimmer({ size = 14, color, className }: LegacySpinnerProps) {
  return <DotMatrixLoader variant="pyramid" size={size * 1.8} color={color} className={className} />;
}

export function CircleQuarters({ size = 14, color, active = true, className }: LegacySpinnerProps) {
  return active ? <DotMatrixLoader variant="cipher" size={size * 1.5} color={color} className={className} /> : null;
}

export function MeterBar({ size = 12, color, active = true, className }: LegacySpinnerProps) {
  return active ? <DotMatrixLoader variant="stream" size={size * 1.6} color={color} className={className} /> : null;
}

export function ArrowShimmer({ size = 12, color, active = true, className }: LegacySpinnerProps) {
  return active ? <DotMatrixLoader variant="stream" size={size * 1.6} color={color} className={className} /> : null;
}

export function MeterToShimmer({ size = 12, color, active = true, className }: LegacySpinnerProps) {
  return active ? <DotMatrixLoader variant="cipher" size={size * 1.7} color={color} className={className} /> : null;
}

export function HelixVertical({ size = 12, color, active = true, className }: LegacySpinnerProps) {
  return active ? <DotMatrixLoader variant="diagonal-scan" size={size * 1.8} color={color} className={className} /> : null;
}
