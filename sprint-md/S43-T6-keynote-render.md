# S43-T6 — Hyperframes keynote render iteration

**Owner**: Content/video lead (TP collaborates in Kimi Code sessions)
**Days**: Tue 2026-04-28 + Wed 2026-04-29
**Outputs**: Iterated keynote video drafts v1, v2, v3 — each progressively closer to final, ready for T8 lock Thu morning.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T3 locked the script Mon — 7 generated shots + 6 UI captures + cut sheet. T6 takes that into Kimi Code and renders, reviews, re-renders until TP greenlights.

## Working directory

```
~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/
├─ shot-{01..07}.md           # prompts (locked, don't edit unless TP approves)
├─ captures/                  # raw UI captures from T3
└─ renders/
   ├─ v1/                     # Tue AM render pass
   ├─ v2/                     # Tue PM render pass
   └─ v3/                     # Wed render pass — last before T8 final
```

## Daily cadence

### Tue AM session (~3h with Kimi Code)

1. Run all 7 shot prompts through Hyperframes
2. Save raw outputs to `renders/v1/shot-{NN}.mp4`
3. Composite UI capture clips (Shots 03, 04a–04e) with overlay numerals + grotesk labels in DaVinci Resolve or Premiere
4. Concatenate full 90s draft to `renders/v1/keynote-v1.mp4`
5. Review with TP — flag every shot that doesn't read as Bloomberg × Hodinkee × Kubrick
6. Note what to fix in `renders/v1/feedback.md`

### Tue PM session (~2h)

1. Re-render flagged shots with prompt tweaks (adjust pacing, lighting, type weight)
2. Save to `renders/v2/`
3. Re-concatenate to `keynote-v2.mp4`
4. Review with TP — get a "this is 90% there" or "still wrong" call

### Wed session (~3h)

1. Final pacing pass — tune cuts, dwell times, type-on stagger
2. Color grade pass to lock palette compliance (`#050402` / `#c79f4a` / `#f0ead6` only)
3. Strip any frame that violates ban list (gradients, sparkles, glow, blur)
4. Save to `renders/v3/keynote-v3.mp4`
5. TP greenlight required before EOD Wed — if not greenlit, escalate

## Quality gates per draft

Every render passes these before TP review:

- [ ] Total duration 85–95s
- [ ] Palette compliance (sample frames at 5s intervals — no off-palette pixels)
- [ ] No gradients, no sparkles, no glow, no blur, no particles, no neon
- [ ] No music, no audio (file should have empty audio track or none at all)
- [ ] Type readable at 1080p mobile viewport
- [ ] All 7 shots present at correct timecodes
- [ ] Hard cuts only (no dissolves except where specified in script)
- [ ] Camera max zoom 1.08× verified (no aggressive pushes)

## Render specs

- Master: 1920×1080, 30fps, ProRes 422 HQ or H.264 12 Mbps
- Save master to `renders/v{N}/master/keynote-v{N}.mov`
- Web copies (T8 finalizes Thu):
  - `keynote.mp4` H.264 ~4 Mbps
  - `keynote.webm` VP9 ~2.5 Mbps

## Done means (EOD Wed)

- `renders/v3/keynote-v3.mp4` exists and TP has greenlit
- All 8 poster timecodes (0:00, 0:06, 0:14, 0:24, 0:54, 1:06, 1:14, 1:30) noted in `renders/v3/poster-timecodes.md`
- Feedback log captured for each iteration
- Slack/iMessage ping: "S43-T6 v3 greenlit, ready for T8 final lock Thu"

## Off-limits

- No script changes without TP approval (T3 locked the script Mon)
- No music or audio additions, ever
- No new shots beyond the 7-shot structure
- Don't transcode web copies yet — that's T8
