// [claude-code 2026-03-27] AI wiring — connects highlight/drill events to research endpoint and state

import type {
  CatalystCard,
  ResearchBullet,
  NarrativeAction,
} from "./narrative-types";
import { drillDeeperInCard } from "./narrative-research";
import {
  createBranchCard,
  inferCrossLaneCategory,
} from "./narrative-highlight";

/**
 * Handle "Drill deeper" input within a card.
 * Calls the research-drill API and dispatches ADD_RESEARCH_BULLETS.
 */
export async function handleDrillDeeper(
  cardId: string,
  query: string,
  card: CatalystCard,
  dispatch: (action: NarrativeAction) => void,
): Promise<void> {
  const bullets = await drillDeeperInCard(
    query,
    card.title,
    card.description,
    card.category ?? "macroeconomic",
    card.sentiment,
  );
  dispatch({ type: "ADD_RESEARCH_BULLETS", cardId, bullets });
}

/**
 * Handle highlight → branch.
 * Creates a child card, dispatches HIGHLIGHT_BRANCH, then returns highlight for UI feedback.
 */
export async function handleHighlightBranch(
  parentCard: CatalystCard,
  highlightedText: string,
  dispatch: (action: NarrativeAction) => void,
): Promise<string> {
  // Infer if the highlight implies a different risk lane
  const crossLaneCategory = inferCrossLaneCategory(
    highlightedText,
    parentCard.category ?? "macroeconomic",
  );

  // Create the branch card spec
  const childSpec = createBranchCard(
    parentCard,
    highlightedText,
    crossLaneCategory ?? undefined,
  );

  // Dispatch to create the child card + rope
  dispatch({
    type: "HIGHLIGHT_BRANCH",
    parentId: parentCard.id,
    highlightText: highlightedText,
    childCard: childSpec,
  });

  // Auto-research is handled by autoResearchBranch() after state settles
  return highlightedText;
}

/**
 * Auto-research a newly branched card.
 * Call this after HIGHLIGHT_BRANCH has settled and you have the child card ID.
 */
export async function autoResearchBranch(
  childCard: CatalystCard,
  parentCard: CatalystCard,
  dispatch: (action: NarrativeAction) => void,
): Promise<void> {
  if (!childCard.parentHighlight) return;

  const bullets = await drillDeeperInCard(
    childCard.parentHighlight,
    parentCard.title,
    parentCard.description,
    childCard.category ?? parentCard.category ?? "macroeconomic",
    parentCard.sentiment,
  );

  dispatch({ type: "ADD_RESEARCH_BULLETS", cardId: childCard.id, bullets });
}
