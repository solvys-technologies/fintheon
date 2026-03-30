// [claude-code 2026-03-28] S7: Force-directed layout config for NarrativeFlow mind map
import type { NarrativeCategory } from './narrative-types';
export {
  NARRATIVE_THREADS,
  THREAD_MAP,
  TERRITORY_LAYOUT,
  HUB_POSITIONS,
  CROSS_NARRATIVE_GOLD,
  SEVERITY_COLORS,
  safeSlug,
  getSemanticZoom,
  getMonthKey,
  formatDateShort,
  deriveIvScore,
  deriveCyclicality,
} from './narrative-territory-layout';

// Category cluster positions — arranged in a circle for visual balance
export const CATEGORY_CENTERS: Record<NarrativeCategory, { x: number; y: number }> = {
  geopolitical:      { x: -400, y: -250 },
  monetary:          { x: 400,  y: -250 },
  macroeconomic:     { x: 0,    y: -350 },
  'market-structure': { x: -400, y: 250 },
  earnings:          { x: 400,  y: 250 },
  'supply-chain':    { x: 0,    y: 350 },
  'black-swan':      { x: 0,    y: 0 },
};

export const CATEGORY_COLORS: Record<NarrativeCategory, string> = {
  geopolitical: '#F59E0B',
  monetary: '#8B5CF6',
  macroeconomic: '#3B82F6',
  'market-structure': '#EC4899',
  earnings: '#34D399',
  'supply-chain': '#14B8A6',
  'black-swan': '#EF4444',
};

// Severity → node radius
export function severityRadius(severity: string): number {
  if (severity === 'high') return 24;
  if (severity === 'medium') return 18;
  return 14;
}

// Force simulation parameters
export const FORCE_CONFIG = {
  // Charge: negative = repel, strength scales with node count
  charge: -120,
  // Link force for rope connections
  linkDistance: 100,
  linkStrength: 0.3,
  // Cluster force: pull toward category center
  clusterStrength: 0.08,
  // Collision: prevent overlap
  collisionPadding: 8,
  // Temporal: pull same-date events together on X axis
  temporalStrength: 0.02,
  // Alpha decay: how fast simulation cools
  alphaDecay: 0.015,
  velocityDecay: 0.3,
};

// Zoom thresholds for rendering modes
export const ZOOM_THRESHOLDS = {
  fullCard: 1.5,    // >= 1.5x: full card with description
  miniCard: 0.7,    // >= 0.7x: mini card with title
  bubble: 0.3,      // >= 0.3x: colored bubble with count
  dot: 0,           // < 0.3x: severity dot only
};

// Map date to x position (temporal axis)
export function dateToX(date: string, anchorDate: Date): number {
  const d = new Date(date);
  const diffDays = (d.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays * 8; // 8px per day
}
