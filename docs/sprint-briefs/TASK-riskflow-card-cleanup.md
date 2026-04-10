# Task Brief: RiskFlow Card — Remove Points, Add IV Bar, Fix Generate Note

**Date:** 2026-04-04
**Scope:** Clean up RiskFlowDetailCard: remove implied point scoring, show IV score bar in collapsed footer, fix generate-note ID mismatch, remove sparkle icon from Generate Note button
**Estimated files:** 3

## Context

The RiskFlow detail cards currently show `±210 pts` implied point estimates in the collapsed footer bar. These are unreliable and should be replaced with a compact IV score indicator (like the IV bar already shown in expanded view). Additionally, "Generate Note" never works because the frontend sends feed-cache string IDs (e.g. `twcli-2040085521125216483`) but the backend queries `scored_riskflow_items` by numeric integer ID. The user also wants the sparkle icon removed from the Generate Note button.

## Files to Read First

- `frontend/components/feed/RiskFlowDetailCard.tsx` — The card component. Lines 121-124 (points in footer), 164-172 (generate note button), 215-226 (IV score in expanded view)
- `backend-hono/src/services/riskflow/agent-notes.ts:116-131` — `fetchItemById` queries `scored_riskflow_items` by `id` but receives string IDs from the feed cache
- `backend-hono/src/services/riskflow/feed-service.ts` — Feed items have string IDs from twitter-cli/FJ, not numeric DB IDs
- `backend-hono/src/services/supabase-service.ts` — Check `scored_riskflow_items` schema for the `id` column type and what unique column could match (likely `tweet_id` matches feed item IDs)

## What to Build/Change

### 1. `frontend/components/feed/RiskFlowDetailCard.tsx` — UI Changes

- **Action:** Modify

#### Remove implied points from collapsed footer (lines 121-124)

Delete the points display block entirely:

```tsx
// REMOVE THIS:
<span className="text-[10px] text-zinc-500 tabular-nums">
  {alert.instrument ? `${alert.instrument} ` : ""}
  {pts > 0 ? `±${pts.toFixed(0)} pts` : "0-5 pts"}
</span>
```

#### Add compact IV score to collapsed footer

Replace the removed points with a compact IV indicator. Place it where points were, between direction and priority badge:

```tsx
{
  (alert as any).ivScore != null && (
    <span className="text-[10px] font-mono tabular-nums text-[var(--fintheon-accent)]/70">
      IV {Number((alert as any).ivScore).toFixed(1)}
    </span>
  );
}
```

#### Remove implied points from expanded view (lines 220-226)

Delete the `±X pts` block in the expanded deviation indicators section. Keep the IV score text and beat/miss badge.

#### Remove sparkle icon from Generate Note (lines 169)

Change:

```tsx
<Sparkles className="w-3 h-3" />
<span>Generate Note +</span>
```

To:

```tsx
<span>Generate Note +</span>
```

Also remove `Sparkles` from the import if no longer used elsewhere in the file (check first — it IS used on line 156 for the Oracle note header, so keep the import).

#### Clean up unused `pts` variable

Remove `const pts = alert.pointRange ?? 0;` on line 64 and any other references to `pointRange` in the component.

### 2. `backend-hono/src/services/riskflow/agent-notes.ts` — Fix ID mismatch

- **Action:** Modify

#### Fix `fetchItemById` (lines 116-131)

The feed cache uses string IDs like `twcli-2040085521125216483` or `fj-...`. The `scored_riskflow_items` table has an auto-increment integer `id` but also has a `tweet_id` text column that matches the feed cache ID.

Change the query to search by `tweet_id` instead of `id`:

```ts
async function fetchItemById(itemId: string): Promise<ScoredRow | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("id, headline, body, macro_level, tags, econ_data, sub_scores")
    .eq("tweet_id", itemId)
    .single();

  if (error) {
    log.error("Failed to fetch item by tweet_id", {
      itemId,
      error: error.message,
    });
    return null;
  }
  return data as ScoredRow | null;
}
```

**Verify first:** Run `curl -s "http://localhost:8080/api/riskflow/debug" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['items'][0])"` to confirm `scored_riskflow_items` rows have a `tweet_id` field.

If `tweet_id` doesn't exist, check the table schema via Supabase MCP or by reading the migration files. The column might be named differently (e.g., `external_id`, `source_id`). Use whatever string column stores the feed-cache ID.

### 3. `frontend/components/feed/RiskFlowDetailCard.tsx` — Add toast on note generation

- **Action:** Modify
- After `handleGenerateNote` succeeds, show a toast. Import `useToast` and add:

```tsx
const { addToast } = useToast();
// In handleGenerateNote callback:
const handleGenerateNote = useCallback(
  async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGenerateNote) {
      const rawId = alert.id.replace(/^backend-/, "");
      onGenerateNote(rawId);
      addToast("Generating analyst note...", "info");
    }
  },
  [alert.id, onGenerateNote, addToast],
);
```

## Key Rules

- The `ivScore` field exists on `RiskFlowAlert` (via `(alert as any).ivScore`) — it's passed through from the backend but not in the TypeScript interface. Don't add it to the interface — just use the cast.
- Don't remove `pointRange` from the data model or backend — just stop displaying it.
- The Sparkles icon is still used for the Oracle note header (line 156) — keep the import.

## DO NOT

- Change the backend feed endpoint or scoring logic
- Modify `RiskFlowAlert` or `FeedItem` type definitions
- Remove `pointRange` from backend calculation or API response
- Touch any other component besides RiskFlowDetailCard and agent-notes

## Verification

```bash
cd frontend && npx tsc --noEmit && npx vite build
cd ../backend-hono && bun run build
```

Then:

1. Open RiskFlow — verify no `±X pts` in the collapsed footer, IV score shows instead
2. Expand an item — verify no points in expanded view either, IV score remains
3. Click "Generate Note" — verify toast shows, note eventually appears (or at least no silent failure)
4. Verify Generate Note button has no sparkle icon

## Changelog Entry

```typescript
{
  date: '2026-04-04T00:00:00',
  agent: 'claude-code',
  summary: 'Remove implied point scoring from RiskFlow cards, show IV score in footer, fix generate-note ID mismatch (tweet_id), remove sparkle from Generate Note button',
  files: [
    'frontend/components/feed/RiskFlowDetailCard.tsx',
    'backend-hono/src/services/riskflow/agent-notes.ts'
  ]
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
