# S14-T9: Consilium Chat + Sidebar + Imperium UI Polish

## Goal

Fix chat interface colors, input bar behavior, sidebar formatting, rename Boardroom to Imperium, smooth transitions everywhere, team card killswitch, onboarding fix. Use `/the-feels` for all design work.

## Color & Input Fixes

1. **Chat header background** — primary color doesn't blend into theme BG like Timeline does. Match `var(--fintheon-bg)` (#050402) seamlessly:
   - @frontend/components/consilium/ConsiliumHub.tsx — fix header/background colors

2. **Gradient removal** — visible gradient in chat area, remove it:
   - @frontend/components/chat/FintheonThread.tsx — fix chat area background

3. **Chat input bar** — transparent when idle/unfocused. On click/focus: soft 1.3s glow effect on borders + send button lights up:
   - @frontend/components/ui/chatgpt-prompt-input.tsx — idle: blend into page BG. Focus: border glow animation (1.3s ease), send button illuminates

4. **Sidebar chat** — same color fixes. Fix button formatting along bottom of input bar (going off-screen)

5. **"Local" label** — remove the word "Local" from provider selector pill, icon only. Text is clipping off-screen

6. **Persona selector in sidebar** — sidebar chat routes through CAO only (no sub-analyst selection). Main Consilium chat keeps full persona calling ability

7. **Duplicate provider selector** — delete the duplicate provider selector in sidebar chat header

## Transitions

8. **Smooth matching transitions on ALL of these**:
   - New chat selection
   - Suggestion chip clicks
   - Conversation history popups open/close
   - Team onboarding modal open/close
   - Bulletin open/close
   - Footer panel expand/collapse
   - Any other UI surface that currently snaps without animation

## Renames & Restructure

9. **Boardroom tab -> Imperium**:
   - Rename "Boardroom" to "Imperium" in Consilium tab bar
   - Subheader text: "Wield the Consul"
   - Strip the OLD Imperium view from the app entirely — it's replaced by this rename
   - Agent Forum is a sub-view within the Imperium

10. **Remove timeframe toggle** from Agent Forum area within Imperium

11. **Harper Activity re-expand** — after closing Harper Activity panel, there is NO button to reopen. Add a re-expand toggle

11b. **RiskFlow in Strategium re-expand** — collapsing RiskFlow section on Dashboard has no way to bring it back. Add re-expand toggle + smooth transition when section reappears:

- @frontend/components/executive/MainDashboard.tsx

## Chat Header Cleanup

12. **Remove "What needs orchestrating today?"** subtitle text
    12b. **Remove "Claude Opus 4.6"** model label under Harper name
    12c. **Rename "Harper-Opus" -> "Harper"** everywhere: chat header, persona selector pill, sidebar chat, all references. Users see their CAO name only, never model info

## Team Cards & Onboarding

13. **RiskFlow killswitch** on team cards — between subsections, add a pill toggle row: description text left-justified, toggle right-justified, smooth toggle animation. Controls whether that user's feed polling is active:

- @frontend/components/team/TeamMemberCard.tsx

14. **Team Onboarding Step 1** — REMOVE "Login with Supabase account" step. Google OAuth is the single auth gate. One account serves all. Onboarding starts at team card creation:

- @frontend/components/team/TeamOnboarding.tsx

## Key Files

- @frontend/components/consilium/ConsiliumHub.tsx
- @frontend/components/chat/FintheonThread.tsx
- @frontend/components/ui/chatgpt-prompt-input.tsx
- @frontend/components/team/TeamMemberCard.tsx
- @frontend/components/team/TeamOnboarding.tsx
- @frontend/components/team/TeamPanel.tsx
- @frontend/components/layout/FooterToolbar.tsx
- All Imperium/Boardroom components

## Verify

- Chat header blends seamlessly like Timeline
- Click input bar — soft glow appears, send button illuminates
- Sidebar clean — no "Local" text, no duplicate provider, no persona selector
- Imperium tab renamed, subheader shows "Wield the Consul"
- All panels/modals have smooth transitions
- "Harper-Opus" -> "Harper" everywhere
- Team cards have killswitch toggle
- Onboarding starts at team card, no Supabase step
- RiskFlow section on Dashboard can be re-expanded after collapse
