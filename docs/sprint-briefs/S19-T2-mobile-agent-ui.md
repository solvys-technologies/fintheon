# Sprint Brief: S19-T2 -- Mobile Agent UI

## Context

The mobile chat input is a plain textarea with a send button. This track adds image attachments, RiskFlow headline injection, and inline tool approval — transforming it into a full agent interface. Depends on T1 (relay must forward extended fields and tool-approval events).

## Branch Target

`t2-mobile-agent-ui` (branched from `mobile-agent-upgrade`)

## Scope -- Included

- [ ] `mobile/components/chat/ImageAttachButton.tsx` (NEW) — camera/photo picker button
- [ ] `mobile/components/chat/ImagePreviewRow.tsx` (NEW) — thumbnail preview strip
- [ ] `mobile/components/chat/HeadlinePickerSheet.tsx` (NEW) — bottom sheet headline selector
- [ ] `mobile/components/chat/HeadlineChips.tsx` (NEW) — pill chips + formatHeadlineContext()
- [ ] `mobile/components/chat/ToolApprovalCard.tsx` (NEW) — inline approve/deny card
- [ ] `mobile/components/chat/ChatInput.tsx` — add toolbar row, attachment state, expanded onSend
- [ ] `mobile/components/chat/ChatPage.tsx` — forward extended fields, parse approval events, render ToolApprovalCard

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/` — all backend files belong to T1
- `mobile/components/chat/SessionList.tsx` — belongs to T3
- `mobile/hooks/useConversations.ts` — belongs to T3
- `frontend/` — desktop frontend not modified
- `mobile/contexts/` — contexts are read-only dependencies, not modified
- `mobile/components/home/`, `mobile/components/riskflow/`, `mobile/components/econ/`, `mobile/components/settings/` — other tabs untouched

## Known Issues to Preserve

- ChatPage uses `display:none` trick (not conditional render) so streams survive tab navigation — do NOT change this
- ChatPage uses `conversationIdRef` to avoid stale closure bugs — maintain this pattern
- Recent changelog (2026-04-16T01:30) did a full Nothing Design overhaul of these files — preserve all styling decisions
- ChatInput uses inline styles (not Tailwind) — all new components must also use inline styles
- ToolCallCard.tsx exists for read-only tool display — keep it, ToolApprovalCard is separate (for approval-gated tools)

## Implementation Steps

### 1. ImageAttachButton component (~70 lines)

**New file:** `mobile/components/chat/ImageAttachButton.tsx`

```typescript
interface ImageAttachButtonProps {
  onAdd: (dataUri: string) => void;
  disabled?: boolean;
  imageCount: number; // current count, to enforce max 4
}
```

- Renders a Camera icon button (lucide `Camera`, 20px)
- Hidden `<input type="file" accept="image/*" capture="environment">` triggered on click
- On file select: validate size (max 5MB), read as data URL via `FileReader.readAsDataURL()`
- Call `onAdd(dataUri)` on successful read
- Disabled when `imageCount >= 4` or `disabled` prop
- Inline styles matching Nothing design (transparent bg, `var(--text-secondary)` icon color)

### 2. ImagePreviewRow component (~60 lines)

**New file:** `mobile/components/chat/ImagePreviewRow.tsx`

```typescript
interface ImagePreviewRowProps {
  images: string[];
  onRemove: (index: number) => void;
}
```

- Horizontal scroll container (`overflow-x: auto`, `display: flex`, `gap: 8px`)
- Each image: 48x48 thumbnail with `object-fit: cover`, `border-radius: 6px`, `border: 1px solid var(--border-visible)`
- X button overlay: absolute positioned, 16x16, top-right corner, `var(--surface)` background
- Returns null when `images.length === 0`

### 3. HeadlinePickerSheet component (~120 lines)

**New file:** `mobile/components/chat/HeadlinePickerSheet.tsx`

Port of desktop `HeadlinePickerPopover` but using mobile's `BottomSheet` component.

```typescript
interface HeadlinePickerSheetProps {
  open: boolean;
  onClose: () => void;
  selected: HeadlineChip[];
  onToggle: (chip: HeadlineChip) => void;
  onClear: () => void;
}
```

- Import `useMobileRiskFlow` from `../../contexts/RiskFlowContext` for alerts
- Search input at top (inline styled, `var(--font-data)`)
- Scrollable list of alerts filtered by query, capped at 20
- Each row: severity dot (red for critical/high, gold for medium, zinc for low) + truncated title + checkbox
- Multi-select behavior matching desktop
- Uses `BottomSheet` from `../shared/BottomSheet` with title "ATTACH HEADLINES"

### 4. HeadlineChips component (~50 lines)

**New file:** `mobile/components/chat/HeadlineChips.tsx`

```typescript
export interface HeadlineChip {
  id: string;
  headline: string;
  severity?: string;
}

export function HeadlineChips({
  chips,
  onRemove,
}: {
  chips: HeadlineChip[];
  onRemove: (id: string) => void;
});
export function formatHeadlineContext(chips: HeadlineChip[]): string;
```

- Horizontal wrap container (`display: flex`, `flex-wrap: wrap`, `gap: 4px`)
- Each chip: pill with truncated headline (max 40 chars), X remove button
- Styled: `var(--accent)` border/text, semi-transparent accent bg
- `formatHeadlineContext()`: same logic as desktop — formats chips into `[Attached Headlines]\n- headline1\n- headline2`
- Returns null when `chips.length === 0`

### 5. ToolApprovalCard component (~120 lines)

**New file:** `mobile/components/chat/ToolApprovalCard.tsx`

```typescript
interface ToolApprovalCardProps {
  approvalId: string;
  toolName: string;
  description: string;
  toolInput?: Record<string, unknown>;
  status: "pending" | "approved" | "denied" | "auto";
  onDecision: (approvalId: string, decision: "approved" | "denied") => void;
}
```

- Full-width card in message stream, inline styles
- Header: tool name in `var(--font-data)` uppercase + status badge
- Body: description text + truncated JSON input preview (max 3 lines)
- Footer (when pending): two buttons side by side
  - Approve: `var(--accent)` background, "APPROVE" text
  - Deny: `var(--error)` border, transparent background, "DENY" text
- Resolved states: green check icon for approved, red X for denied, muted "AUTO" label for auto
- Simple opacity transition via framer-motion `AnimatePresence`

### 6. Upgrade ChatInput

**File:** `mobile/components/chat/ChatInput.tsx`

Changes:

- Expand `onSend` prop: `(text: string, opts?: { images?: string[]; riskFlowContext?: string }) => void`
- Add state: `images: string[]`, `headlineChips: HeadlineChip[]`, `headlinePickerOpen: boolean`
- Add toolbar row between label and input border box:

  ```
  [Camera icon] [Newspaper icon]     (left-aligned, gap: 12px)
  ```

  - Camera opens file picker via ImageAttachButton
  - Newspaper opens HeadlinePickerSheet

- Render ImagePreviewRow above textarea when images present
- Render HeadlineChips above textarea when chips present
- On send: call `onSend(text, { images, riskFlowContext: formatHeadlineContext(headlineChips) })`, clear images and chips
- Keep file under 200 lines by delegating to child components

### 7. Upgrade ChatPage

**File:** `mobile/components/chat/ChatPage.tsx`

Changes:

- Update `sendMessage` signature: `async (text: string, opts?: { images?: string[]; riskFlowContext?: string }) => void`
- Include `images` and `riskFlowContext` in the fetch body to `/api/relay/chat`
- Add state: `pendingApprovals: Map<string, { approvalId, toolName, description, toolInput, status }>`
- Extend SSE parser to handle new event types:
  ```typescript
  if (event.type === "tool-approval-needed") {
    // Add to pendingApprovals map
  } else if (event.type === "tool-approval-resolved") {
    // Update approval status in map
  }
  ```
- Add `handleToolDecision` function that POSTs to `/api/relay/tool-decision`
- Render ToolApprovalCard for each pending approval in the message area (below activeToolCall)
- Import: ImageAttachButton is not imported here — it's inside ChatInput. Only ToolApprovalCard is rendered in ChatPage.

## Acceptance Criteria

- [ ] Camera icon in chat toolbar opens native file picker, selected image shows as 48px thumbnail
- [ ] Multiple images (up to 4) can be attached, each with X to remove
- [ ] Newspaper icon opens bottom sheet with searchable RiskFlow headlines
- [ ] Selected headlines appear as pill chips above the textarea
- [ ] On send, images and riskFlowContext are included in the request body
- [ ] When Harper requests tool approval, ToolApprovalCard appears inline with Approve/Deny buttons
- [ ] Approving a tool call sends decision to relay and card updates to show approved state
- [ ] Denying a tool call sends decision and card shows denied state
- [ ] All new components use inline styles, Nothing design, Solvys Gold palette
- [ ] ChatInput stays under 200 lines, ChatPage stays under 400 lines

## Validation Commands

```bash
npx tsc --noEmit --project mobile/tsconfig.json
cd mobile && npx vite build
```

## Commit Format

```
feat: T2 mobile agent UI — image attach, headline picker, tool approval
```
