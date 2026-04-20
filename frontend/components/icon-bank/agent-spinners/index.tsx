// Ported from https://github.com/Eronred/expo-agent-spinners (MIT) — S28-T3 2026-04-20
// All 54 terminal-style spinners as thin BaseSpinner wrappers. Each component
// accepts the shared SpinnerProps (size, color, severity, priority, active,
// className, style) so consumers can swap them without prop-bag churn.
import { BaseSpinner, type SpinnerProps } from "./base";
import { SPINNERS } from "./frames";

export type { SpinnerProps, SpinnerSeverity, SpinnerPriority } from "./base";
export {
  BaseSpinner,
  useReducedMotion,
  useSpinnerFrame,
  resolveSpinnerColor,
  resolveSpinnerMs,
  glyphStyle,
} from "./base";
export { SPINNERS, type SpinnerDefinition, type SpinnerKey } from "./frames";

function makeSpinner(key: keyof typeof SPINNERS, ariaLabel: string) {
  const { frames, intervalMs } = SPINNERS[key];
  const Named = (props: SpinnerProps) => (
    <BaseSpinner
      {...props}
      frames={frames}
      intervalMs={intervalMs}
      ariaLabel={ariaLabel}
    />
  );
  Named.displayName = `${key}Spinner`;
  return Named;
}

export const ArcSpinner = makeSpinner("arc", "loading");
export const ArrowSpinner = makeSpinner("arrow", "loading");
export const BalloonSpinner = makeSpinner("balloon", "loading");
export const BounceSpinner = makeSpinner("bounce", "loading");
export const BreatheSpinner = makeSpinner("breathe", "loading");
export const CascadeSpinner = makeSpinner("cascade", "loading");
export const CheckerboardSpinner = makeSpinner("checkerboard", "loading");
export const CircleHalvesSpinner = makeSpinner("circleHalves", "loading");
export const CircleQuartersSpinner = makeSpinner(
  "circleQuarters",
  "refreshing",
);
export const ClockSpinner = makeSpinner("clock", "waiting");
export const ColumnsSpinner = makeSpinner("columns", "loading");
export const DiagswipeSpinner = makeSpinner("diagswipe", "loading");
export const DotsSpinner = makeSpinner("dots", "loading");
export const Dots2Spinner = makeSpinner("dots2", "loading");
export const Dots3Spinner = makeSpinner("dots3", "loading");
export const Dots4Spinner = makeSpinner("dots4", "loading");
export const Dots5Spinner = makeSpinner("dots5", "loading");
export const Dots6Spinner = makeSpinner("dots6", "loading");
export const Dots7Spinner = makeSpinner("dots7", "loading");
export const Dots8Spinner = makeSpinner("dots8", "loading");
export const Dots9Spinner = makeSpinner("dots9", "loading");
export const Dots10Spinner = makeSpinner("dots10", "loading");
export const Dots11Spinner = makeSpinner("dots11", "loading");
export const Dots12Spinner = makeSpinner("dots12", "loading");
export const Dots13Spinner = makeSpinner("dots13", "loading");
export const Dots14Spinner = makeSpinner("dots14", "loading");
export const DoubleArrowSpinner = makeSpinner("doubleArrow", "loading");
export const DqpbSpinner = makeSpinner("dqpb", "loading");
export const EarthSpinner = makeSpinner("earth", "loading");
export const FillsweepSpinner = makeSpinner("fillsweep", "refreshing");
export const GrowHorizontalSpinner = makeSpinner("growHorizontal", "loading");
export const GrowVerticalSpinner = makeSpinner("growVertical", "loading");
export const HeartsSpinner = makeSpinner("hearts", "loading");
export const HelixSpinner = makeSpinner("helix", "thinking");
export const MoonSpinner = makeSpinner("moon", "loading");
export const NoiseSpinner = makeSpinner("noise", "loading");
export const OrbitSpinner = makeSpinner("orbit", "loading");
export const PointSpinner = makeSpinner("point", "loading");
export const PulseSpinner = makeSpinner("pulse", "loading");
export const RainSpinner = makeSpinner("rain", "loading");
export const RollingLineSpinner = makeSpinner("rollingLine", "loading");
export const SandSpinner = makeSpinner("sand", "loading");
export const ScanSpinner = makeSpinner("scan", "loading");
export const SimpleDotsSpinner = makeSpinner("simpleDots", "loading");
export const SimpleDotsScrollingSpinner = makeSpinner(
  "simpleDotsScrolling",
  "loading",
);
export const SnakeSpinner = makeSpinner("snake", "swimming");
export const SparkleSpinner = makeSpinner("sparkle", "loading");
export const SpeakerSpinner = makeSpinner("speaker", "audio");
export const SquareCornersSpinner = makeSpinner("squareCorners", "loading");
export const ToggleSpinner = makeSpinner("toggle", "loading");
export const TriangleSpinner = makeSpinner("triangle", "loading");
export const WaveSpinner = makeSpinner("wave", "loading");
export const WaveRowsSpinner = makeSpinner("waveRows", "loading");
export const WeatherSpinner = makeSpinner("weather", "loading");
