// [claude-code 2026-03-28] S8-T7: Artifact parser — extracts structured JSON from Claude CLI responses
/**
 * Artifact Parser
 * Extracts structured artifact blocks from Harper responses.
 * Claude CLI outputs artifacts as fenced JSON blocks with a type marker:
 *
 *   ```artifact:catalyst
 *   { "title": "...", "description": "...", ... }
 *   ```
 *
 * Parsed artifacts can be dispatched to NarrativeContext (catalyst cards)
 * or rendered in the artifacts pane.
 */

import type {
  CatalystCard,
  CatalystSentiment,
  CatalystSeverity,
  NarrativeCategory,
} from "./narrative-types";

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType = "catalyst" | "trade-proposal" | "narrative-item";

export interface ParsedArtifact {
  type: ArtifactType;
  data: Record<string, unknown>;
  raw: string;
}

export interface CatalystArtifact {
  title: string;
  description: string;
  date?: string;
  sentiment?: CatalystSentiment;
  severity?: CatalystSeverity;
  category?: NarrativeCategory;
  tags?: string[];
  directionBias?: "bullish" | "bearish" | "neutral";
  narrative?: string;
}

// ── Parser ─────────────────────────────────────────────────────────────────

const ARTIFACT_REGEX = /```artifact:(\w[\w-]*)\s*\n([\s\S]*?)```/g;

/**
 * Extract all artifact blocks from a Claude CLI response string.
 */
export function parseArtifacts(responseText: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  ARTIFACT_REGEX.lastIndex = 0;

  while ((match = ARTIFACT_REGEX.exec(responseText)) !== null) {
    const type = match[1] as ArtifactType;
    const raw = match[2].trim();

    try {
      const data = JSON.parse(raw);
      artifacts.push({ type, data, raw });
    } catch {
      // Malformed JSON — skip
      console.warn(
        "[ArtifactParser] Failed to parse artifact JSON:",
        raw.slice(0, 100),
      );
    }
  }

  return artifacts;
}

/**
 * Convert a parsed artifact into a NarrativeContext-compatible catalyst card payload.
 * Returns the Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'> shape.
 */
export function toCatalystPayload(
  artifact: ParsedArtifact,
): Omit<CatalystCard, "id" | "createdAt" | "updatedAt"> | null {
  if (artifact.type !== "catalyst" && artifact.type !== "narrative-item")
    return null;

  const d = artifact.data as unknown as CatalystArtifact;

  return {
    title: d.title || "Untitled Catalyst",
    description: d.description || "",
    date: d.date || new Date().toISOString().split("T")[0],
    sentiment:
      d.sentiment || (d.directionBias === "bearish" ? "bearish" : "bullish"),
    severity: d.severity || "medium",
    source: "agent",
    narrativeIds: [],
    isGhost: false,
    templateType: null,
    position: null,
    tags: d.tags || [],
    category: d.category,
    directionBias: d.directionBias || "neutral",
    status: "active",
    dateRange: {
      start: d.date || new Date().toISOString().split("T")[0],
      end: null,
    },
    drillDepth: 0,
    narrative: d.narrative,
  };
}

/**
 * Strip artifact blocks from response text, returning clean display text.
 */
export function stripArtifactBlocks(responseText: string): string {
  return responseText.replace(ARTIFACT_REGEX, "").trim();
}
