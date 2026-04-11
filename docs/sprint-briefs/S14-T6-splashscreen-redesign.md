# S14-T6: SplashScreen Redesign

## Goal

Replace the black temple doors splash with a liquid glass loading screen. Wire it into the app so it actually renders.

## Design Spec

- **Background**: Shuffled image from `public/halftone-heroes/` rotation (same images as login screen)
- **Shuffle logic**: Reference @frontend/components/auth/AuthShell.tsx lines 6-25 for existing HERO_BACKGROUNDS array and random selection
- **Center element**: Floating liquid glass window — black tint, `backdrop-blur`, rounded corners, centered on screen
- **Inside the glass**: `public/fintheon-logo.png` (logo WITHOUT app name text, 1080x1080, sized to ~80px)
- **Below logo**: Status text messages in **Playfair Display** font (non-italicized), Solvys Gold color (#c79f4a)
- **NO**: "FINTHEON" text, NO Cinzel font, NO full-width black bars/doors
- **Fade out**: Smooth fade when app is ready
- **Timing**: Show on first-ever launch (full splash) and cold starts (after quit). NOT on resume from background

## What to Do

1. **Rewrite SplashScreen**:
   - @frontend/components/SplashScreen.tsx — full rewrite replacing temple doors with liquid glass design
   - Keep the status message rotation (Initializing Strategium, Summoning the Consilium, etc.)
   - Change font from Cinzel to Playfair Display, non-italic

2. **Wire into app**:
   - Currently SplashScreen is exported but never imported/rendered
   - Wire into @frontend/components/layout/MainLayout.tsx or App.tsx
   - Use `pompaEnabled` prop with localStorage check for cold-start-only behavior

3. **Background images** (already exist):
   - `public/halftone-heroes/hero-bg-1.png`
   - `public/halftone-heroes/hero-bg-2.png`
   - `public/halftone-heroes/hero-bg-3.png`

4. **Logo** (already exists):
   - `public/fintheon-logo.png` — standalone logo, no text

5. **Design**: Use `/the-feels`

## Verify

- Quit app fully, relaunch — liquid glass splash appears with shuffled background
- Logo renders without app name text
- Status text is Playfair Display, non-italic, Solvys Gold
- Splash fades smoothly when app loads
- Resume from background — no splash
