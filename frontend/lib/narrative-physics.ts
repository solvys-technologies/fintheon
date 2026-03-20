// [claude-code 2026-03-16] Physics simulation for NarrativeCanvas — float, repulsion, containment, rope swing

import type { NarrativeCategory } from './narrative-types';

export interface BubbleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  category: NarrativeCategory;
  phase: number;
  amplitude: number;
}

export interface RopeSwingState {
  ropeId: string;
  amplitude: number;
  gamma: number;
  omega: number;
  startTime: number;
}

/** Zone layout for each narrative category — positioned as columns across the canvas */
const ZONE_COLUMNS: NarrativeCategory[] = [
  'geopolitical', 'macroeconomic', 'monetary',
  'market-structure', 'supply-chain', 'black-swan', 'earnings',
];

export function getZoneBounds(
  category: NarrativeCategory,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; width: number; height: number } {
  const idx = ZONE_COLUMNS.indexOf(category);
  const colCount = ZONE_COLUMNS.length;
  const colWidth = canvasWidth / colCount;
  return {
    x: idx * colWidth,
    y: 0,
    width: colWidth,
    height: canvasHeight,
  };
}

export function getAllZoneBounds(canvasWidth: number, canvasHeight: number) {
  return ZONE_COLUMNS.map(cat => ({
    category: cat,
    bounds: getZoneBounds(cat, canvasWidth, canvasHeight),
  }));
}

/** Initialize bubble state from a narrative lane */
export function initBubble(
  id: string,
  category: NarrativeCategory,
  canvasWidth: number,
  canvasHeight: number,
  index: number,
): BubbleState {
  const zone = getZoneBounds(category, canvasWidth, canvasHeight);
  const padding = 40;
  return {
    id,
    x: zone.x + padding + Math.random() * (zone.width - padding * 2 - 200),
    y: zone.y + 60 + (index % 4) * 140 + Math.random() * 40,
    vx: 0,
    vy: 0,
    width: 200,
    height: 120,
    category,
    phase: Math.random() * Math.PI * 2,
    amplitude: 0.3 + Math.random() * 0.5,
  };
}

/** Gentle sine-wave float animation — updates y velocity */
export function applyFloat(bubble: BubbleState, time: number, dt: number): void {
  const floatForce = Math.sin(time * 0.8 + bubble.phase) * bubble.amplitude * 0.3;
  bubble.vy += floatForce * dt;
  // Horizontal drift
  const driftForce = Math.cos(time * 0.5 + bubble.phase * 1.7) * bubble.amplitude * 0.1;
  bubble.vx += driftForce * dt;
}

/** Soft bounce at zone boundaries */
export function applyZoneContainment(
  bubble: BubbleState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const zone = getZoneBounds(bubble.category, canvasWidth, canvasHeight);
  const padding = 20;
  const stiffness = 0.05;

  const left = zone.x + padding;
  const right = zone.x + zone.width - padding - bubble.width;
  const top = zone.y + 50; // leave room for zone label
  const bottom = zone.y + zone.height - padding - bubble.height;

  if (bubble.x < left) bubble.vx += (left - bubble.x) * stiffness;
  if (bubble.x > right) bubble.vx += (right - bubble.x) * stiffness;
  if (bubble.y < top) bubble.vy += (top - bubble.y) * stiffness;
  if (bubble.y > bottom) bubble.vy += (bottom - bubble.y) * stiffness;
}

/** Repulsion force between overlapping bubbles */
export function applyRepulsion(bubbles: BubbleState[]): void {
  const repulsionStrength = 2;
  const minDist = 30; // minimum gap between bubbles

  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const b = bubbles[j];
      const acx = a.x + a.width / 2;
      const acy = a.y + a.height / 2;
      const bcx = b.x + b.width / 2;
      const bcy = b.y + b.height / 2;

      const dx = bcx - acx;
      const dy = bcy - acy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const minSep = (a.width + b.width) / 2 + minDist;
      if (dist < minSep && dist > 0) {
        const force = (minSep - dist) / dist * repulsionStrength;
        const fx = dx * force * 0.5;
        const fy = dy * force * 0.5;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
  }
}

/** Apply velocity damping and integrate position */
export function integrateBubble(bubble: BubbleState, dt: number): void {
  const damping = 0.92;
  bubble.vx *= damping;
  bubble.vy *= damping;
  bubble.x += bubble.vx * dt * 60;
  bubble.y += bubble.vy * dt * 60;
}

/** Full physics step for all bubbles */
export function stepPhysics(
  bubbles: BubbleState[],
  time: number,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const b of bubbles) {
    applyFloat(b, time, dt);
    applyZoneContainment(b, canvasWidth, canvasHeight);
  }
  applyRepulsion(bubbles);
  for (const b of bubbles) {
    integrateBubble(b, dt);
  }
}

// --- Rope swing physics ---

const activeSwings = new Map<string, RopeSwingState>();

/** Trigger a rope swing animation */
export function triggerRopeSwing(ropeId: string, now: number): void {
  activeSwings.set(ropeId, {
    ropeId,
    amplitude: 12 + Math.random() * 8, // pixels of sway
    gamma: 2.5,    // damping coefficient
    omega: 6,      // angular frequency
    startTime: now,
  });
}

/** Get current rope swing offset. Returns 0 if rope is not swinging. */
export function getRopeSwingOffset(ropeId: string, now: number): number {
  const swing = activeSwings.get(ropeId);
  if (!swing) return 0;

  const t = now - swing.startTime;
  if (t > 3) {
    // Animation done after 3 seconds
    activeSwings.delete(ropeId);
    return 0;
  }

  // Damped spring oscillation: x(t) = A * e^(-γt) * cos(ωt)
  return swing.amplitude * Math.exp(-swing.gamma * t) * Math.cos(swing.omega * t);
}

/** Clean up expired swings */
export function cleanupSwings(now: number): void {
  for (const [id, swing] of activeSwings) {
    if (now - swing.startTime > 3) activeSwings.delete(id);
  }
}

export { ZONE_COLUMNS };
