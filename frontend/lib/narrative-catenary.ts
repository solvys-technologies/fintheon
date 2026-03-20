// [claude-code 2026-03-06] Catenary curve math for NarrativeFlow rope physics

export interface Point {
  x: number;
  y: number;
}

export interface CatenaryPath {
  d: string;
  length: number;
  midpoint: Point;
  controlPoints: [Point, Point];
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Compute a catenary-approximating cubic bezier between two points.
 * Uses a quadratic sag model for natural hanging-rope appearance.
 */
export function computeCatenary(from: Point, to: Point, sag = 0.3): CatenaryPath {
  const dist = distance(from, to);
  const midX = (from.x + to.x) / 2;
  const midY = Math.max(from.y, to.y) + sag * dist * 0.3;

  // Cubic bezier control points that pass through the sag midpoint.
  // For a cubic bezier B(t) with t=0.5 passing through (midX, midY):
  // B(0.5) = 0.125*P0 + 0.375*CP1 + 0.375*CP2 + 0.125*P3 = mid
  // We split the sag offset equally between the two controls.
  const cp1: Point = {
    x: from.x + (midX - from.x) * 0.66,
    y: midY,
  };
  const cp2: Point = {
    x: to.x + (midX - to.x) * 0.66,
    y: midY,
  };

  const d = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;

  // Approximate arc length using chord + control polygon average
  const chordLen = dist;
  const polyLen = distance(from, cp1) + distance(cp1, cp2) + distance(cp2, to);
  const approxLength = (chordLen + polyLen) / 2;

  return {
    d,
    length: approxLength,
    midpoint: { x: midX, y: midY },
    controlPoints: [cp1, cp2],
  };
}

/**
 * Compute anchor point on a card element for rope attachment.
 * Returns the center of the closest edge facing the target.
 */
export function getCardAnchor(cardRect: DOMRect, targetCenter: Point): Point {
  const cx = cardRect.left + cardRect.width / 2;
  const cy = cardRect.top + cardRect.height / 2;

  const dx = targetCenter.x - cx;
  const dy = targetCenter.y - cy;

  // Determine which edge is closest to the target direction
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const aspectRatio = cardRect.width / cardRect.height;

  if (absDx / aspectRatio > absDy) {
    // Horizontal edge is closer
    return dx > 0
      ? { x: cardRect.right, y: cy }
      : { x: cardRect.left, y: cy };
  }
  // Vertical edge is closer
  return dy > 0
    ? { x: cx, y: cardRect.bottom }
    : { x: cx, y: cardRect.top };
}

/**
 * Compute anchor point on a lane header for rope attachment.
 */
export function getLaneAnchor(laneRect: DOMRect, targetCenter: Point): Point {
  const cx = laneRect.left + laneRect.width / 2;
  const cy = laneRect.top + laneRect.height / 2;

  // Lanes are wide horizontal bands — attach at top or bottom edge, horizontally aligned to target
  const clampedX = Math.max(laneRect.left + 8, Math.min(targetCenter.x, laneRect.right - 8));

  return targetCenter.y < cy
    ? { x: clampedX, y: laneRect.top }
    : { x: clampedX, y: laneRect.bottom };
}
