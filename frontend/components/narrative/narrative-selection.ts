export const ALL_NARRATIVES_SLUG = "__all_narratives__";
export const ALL_NARRATIVES_LABEL = "All Narratives";

export interface NarrativeSelectionChip {
  slug: string;
  label: string;
  color?: string;
}

export function hasAllNarratives(slugs?: Set<string>): boolean {
  return Boolean(slugs?.has(ALL_NARRATIVES_SLUG));
}

export function selectedNarrativeLabel(
  chips: NarrativeSelectionChip[],
  slugs?: Set<string>,
): string | null {
  if (hasAllNarratives(slugs)) return ALL_NARRATIVES_LABEL;
  const selected = chips.find((chip) => slugs?.has(chip.slug));
  return selected?.label ?? null;
}

export function selectedNarrativeTags(
  chips: NarrativeSelectionChip[],
  slugs: Set<string>,
): string[] {
  if (hasAllNarratives(slugs)) {
    return chips
      .filter((chip) => chip.slug !== ALL_NARRATIVES_SLUG)
      .map((chip) => chip.slug);
  }

  return chips.filter((chip) => slugs.has(chip.slug)).map((chip) => chip.slug);
}
