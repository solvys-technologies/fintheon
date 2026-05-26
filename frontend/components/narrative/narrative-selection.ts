export const ALL_NARRATIVES_SLUG = "__all_narratives__";
export const ALL_NARRATIVES_LABEL = "All Narratives";
export const NO_NARRATIVE_SLUG = "__no_narrative__";
export const NO_NARRATIVE_LABEL = "No Narrative";

export interface NarrativeSelectionChip {
  slug: string;
  label: string;
  color?: string;
}

export function hasAllNarratives(slugs?: Set<string>): boolean {
  return Boolean(slugs?.has(ALL_NARRATIVES_SLUG));
}

export function hasNoNarrative(slugs?: Set<string>): boolean {
  return Boolean(slugs?.has(NO_NARRATIVE_SLUG));
}

export function selectedNarrativeLabel(
  chips: NarrativeSelectionChip[],
  slugs?: Set<string>,
): string | null {
  if (hasNoNarrative(slugs)) return NO_NARRATIVE_LABEL;
  if (hasAllNarratives(slugs)) return ALL_NARRATIVES_LABEL;
  const selected = chips.find((chip) => slugs?.has(chip.slug));
  return selected?.label ?? null;
}

export function selectedNarrativeTags(
  chips: NarrativeSelectionChip[],
  slugs: Set<string>,
): string[] {
  if (hasNoNarrative(slugs)) return [];
  if (hasAllNarratives(slugs)) {
    return chips
      .filter(
        (chip) => ![ALL_NARRATIVES_SLUG, NO_NARRATIVE_SLUG].includes(chip.slug),
      )
      .map((chip) => chip.slug);
  }

  return chips
    .filter((chip) => chip.slug !== NO_NARRATIVE_SLUG && slugs.has(chip.slug))
    .map((chip) => chip.slug);
}

export function selectedNarrativeColor(
  chips: NarrativeSelectionChip[],
  slugs: Set<string>,
  fallbackColor: string,
): string {
  if (hasNoNarrative(slugs)) return fallbackColor;
  if (hasAllNarratives(slugs)) return fallbackColor;
  return chips.find((chip) => slugs.has(chip.slug))?.color ?? fallbackColor;
}
