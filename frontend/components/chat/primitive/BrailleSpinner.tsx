// [codex 2026-05-23] Compatibility wrapper: all legacy Braille spinners now
// render circular dot/matrix loaders while preserving call-site props.
import { DotMatrixLoader } from "../../icon-bank/DotMatrixLoader";

interface BrailleSpinnerProps {
  size?: number;
  gap?: number;
  color?: string;
  label?: string;
  className?: string;
}

export function BrailleSpinner({
  size = 12,
  color = "var(--fintheon-primary, var(--fintheon-accent))",
  label,
  className,
}: BrailleSpinnerProps) {
  return (
    <DotMatrixLoader
      variant="diagonal-scan"
      size={Math.max(size * 1.8, 14)}
      color={color}
      label={label}
      className={className}
    />
  );
}

export function BrailleSpinnerCentered({
  size = 12,
  color,
  label,
}: BrailleSpinnerProps) {
  return (
    <div className="flex items-center justify-center py-3">
      <BrailleSpinner size={size} color={color} label={label} />
    </div>
  );
}
