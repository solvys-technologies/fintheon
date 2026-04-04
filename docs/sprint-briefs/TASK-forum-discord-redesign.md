# Task Brief: Forum — Discord-Style Redesign with Attachments
**Date:** 2026-04-03
**Scope:** Redesign the Bulletin Board (Forum) to look like Discord with message grouping, hover actions, and attachment support
**Estimated files:** 3

## Context
The Forum is the human version of the Boardroom (agent chat). Currently it's a basic bulletin board with textarea + post cards. It needs to look like Discord — messages flowing vertically, avatar + username header, grouped consecutive messages, reactions-style voting, and attachment support. The `PromptBox` component already supports image paste and attachments. The backend already supports `contentParts` for rich content.

## Files to Read First
- `frontend/components/bulletin/BulletinFeed.tsx` — Current forum container (254 lines)
- `frontend/components/bulletin/BulletinPost.tsx` — Current post card (89 lines)
- `frontend/components/bulletin/VotingControls.tsx` — Current voting buttons (43 lines)
- `frontend/components/consilium/AgentChattr.tsx` — **Reference**: Discord-like chat layout with PromptBox at bottom, scroll container, status bar. Mirror this pattern.
- `frontend/components/consilium/ConsiliumMessage.tsx` — **Reference**: Message bubble with avatar, hover timestamp, copy button
- `frontend/components/ui/chatgpt-prompt-input.tsx` — PromptBox props (supports `onSend(message, images?)`, `compact` mode, attach popup)
- `frontend/lib/services/editor.ts:109-144` — BulletinService API methods
- `backend-hono/src/types/bulletin.ts` — `BulletinPost` type with `contentParts`

## What to Build/Change

### 1. `frontend/components/bulletin/BulletinFeed.tsx` — Discord Channel Layout
- **Action:** Rewrite
- **Layout:** Full-height flex column like `AgentChattr`:
  - Top: thin header bar with desk filter dropdown + message count
  - Middle: scrollable message area (flex-1, overflow-y-auto) with auto-scroll to bottom
  - Bottom: `PromptBox` in compact mode for composing messages
- **PromptBox integration:** Use the existing `PromptBox` component:
  ```tsx
  <PromptBox
    compact
    onSend={(msg, images) => handleSubmit(msg, images)}
    isProcessing={submitting}
    placeholder="Message the forum..."
    thinkHarder={false}
    setThinkHarder={() => {}}
    activeSkill={null}
    onSelectSkill={() => {}}
    showSkills={false}
    onToggleSkills={() => {}}
  />
  ```
- **Image/attachment handling:** When `onSend` receives `images` array (base64 strings from paste/upload), include them in `contentParts`:
  ```ts
  const contentParts = images?.length
    ? images.map(img => ({ type: 'image' as const, data: img }))
    : undefined;
  await backend.bulletin.createPost({
    content: msg,
    contentParts,
    deskId: selectedDesk || undefined,
  });
  ```
- **Thread expansion:** When clicking reply on a message, expand thread inline below (keep current pattern but styled as Discord thread — indented with a left border, lighter background)
- **Max lines:** 280

### 2. `frontend/components/bulletin/BulletinPost.tsx` — Discord Message Row
- **Action:** Rewrite
- **Layout:** Discord-style message row:
  - Left: Avatar circle (32px) with author initials or agent icon
  - Right: Author name + timestamp on first message of a group, then just content below
- **Message grouping:** Accept a `isGrouped` prop. When `true`, hide avatar and author line (consecutive messages from same author within 5 minutes)
- **Hover actions bar:** On message hover, show a floating action bar (absolute positioned, top-right):
  - Reply button (MessageSquare icon)
  - Vote buttons (thumbs up/down or the existing check/x/up/down)
  - Delete button (Trash2 icon, only if `post.authorId === userId`)
  - Copy button
- **Content rendering:** 
  - Text with `whitespace-pre-wrap`
  - If `contentParts` contains images, render them as thumbnails below text
  - Promoted-to-proposal badge stays
- **Voting display:** Show vote counts as Discord-style reaction pills below the message (small rounded pills with icon + count, highlight if user voted)
- **Timestamp:** Show on author line as relative time ("2m ago"), full datetime on hover
- **Max lines:** 200

### 3. `frontend/components/bulletin/VotingControls.tsx` — Reaction Pills
- **Action:** Modify
- **Style change:** Transform from inline button row to Discord-style reaction pills:
  - Smaller: `text-[10px]`, `px-1.5 py-0.5`, `rounded-full`
  - Only show pills that have votes > 0, plus a "+" button to add a reaction
  - Active state: gold accent background
  - Layout: `flex flex-wrap gap-1` below message content
- **Max lines:** 60

## Key Rules
- Follow Fintheon design system: `--fintheon-bg`, `--fintheon-accent` (#D4AF37), `--fintheon-text`, `--fintheon-surface`
- No gradients, no colored emojis
- Use lucide-react icons only
- Reference `AgentChattr.tsx` for the scroll + PromptBox pattern
- Reference `ConsiliumMessage.tsx` for hover timestamp + copy button pattern
- The `BulletinPostData` interface stays unchanged — don't modify the data model
- Supabase realtime subscription stays (already in BulletinFeed)
- Message grouping logic: group if same `authorId` AND within 5 minutes of previous message

## DO NOT
- Touch the backend (routes, store, types) — it already supports everything needed
- Add new dependencies or libraries
- Create new files — modify the 3 existing bulletin files only
- Touch `ConsiliumHub.tsx` routing — it already renders `<BulletinFeed />` correctly
- Remove the voting system — restyle it, don't replace it
- Add channels/sidebar — keep the single feed with desk filter dropdown

## Verification
```bash
cd frontend && npx tsc --noEmit && npx vite build
```
Then:
1. Navigate to Boardroom > Forum
2. Verify Discord-like message layout with avatars and grouped messages
3. Post a message using the PromptBox at bottom
4. Paste an image — verify it submits and renders as thumbnail
5. Hover a message — verify action bar appears (reply, vote, copy, delete)
6. Click reply — verify thread expands inline
7. Vote — verify reaction pills update

## Changelog Entry
```typescript
{
  date: '2026-04-03T00:00:00',
  agent: 'claude-code',
  summary: 'Redesign Forum (BulletinFeed) to Discord-style layout with message grouping, hover actions, PromptBox input, reaction-pill voting, and image attachment support',
  files: [
    'frontend/components/bulletin/BulletinFeed.tsx',
    'frontend/components/bulletin/BulletinPost.tsx',
    'frontend/components/bulletin/VotingControls.tsx'
  ]
}
```
