// [codex 2026-05-23] Mobile compatibility wrapper for dot/matrix loaders.
import { DotMatrixLoader } from "@frontend/components/icon-bank/DotMatrixLoader";

export function SegmentedSpinner({
  size = 8,
}: {
  size?: number;
  gap?: number;
}) {
  return (
    <DotMatrixLoader
      variant="diagonal-scan"
      size={Math.max(size * 2.2, 16)}
      color="var(--text-display)"
    />
  );
}
