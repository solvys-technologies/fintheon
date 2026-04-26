# S43-T3 — Hyperframes keynote script lock

**Owner**: Content/video lead (TP collaborates)
**Day**: Mon 2026-04-27
**Outputs**: Locked 90s keynote script, shot-by-shot Hyperframes prompt set, asset list, captured Fintheon UI source clips for Acts 3–6.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. The Hyperframes keynote video is the spine of `/fintheon` Acts 1, 4, and 9. T3 locks the script Mon so T6 can begin render iterations Tue. The base prompt was drafted in the orchestration chat — this track turns it into a per-shot generation plan.

## Source prompt (already drafted)

The full Kimi Code prompt sits in TP's chat history under "Kimi Code prompt — Fintheon keynote video (Hyperframes render)". Pull it verbatim, save to `~/Documents/Codebases/pricedinresearch-site/docs/keynote-source-prompt.md`.

## Brand spec (locked, applies to every shot)

- Palette: `#050402` / `#c79f4a` / `#f0ead6` ONLY
- No music, no audio
- Doto for display + numerals; grotesk for captions; mono for codes
- Locked-off or slow pushes only (max 1.08× zoom)
- Hard cuts between shots (1-frame black flash where specified)
- Banned: gradients, sparkles, lens flares, glow, blur, neon, particles, drop shadows, vignettes

## Shot table

| #   | Timestamp | Duration | Description                                    | Source                 |
| --- | --------- | -------- | ---------------------------------------------- | ---------------------- |
| 01  | 0:00–0:06 | 6s       | Black + horizontal gold line draws lower-third | Generated              |
| 02  | 0:06–0:14 | 8s       | Doto title "FIVE AGENTS. ONE SURFACE."         | Generated              |
| 03  | 0:14–0:24 | 10s      | Slow push on Consilium Boardroom still         | Captured UI screenshot |
| 04a | 0:24–0:30 | 6s       | Harper · Sanctum narrative timeline            | Captured UI loop       |
| 04b | 0:30–0:36 | 6s       | Oracle · Kalshi probability fuses              | Captured UI loop       |
| 04c | 0:36–0:42 | 6s       | Feucht · RiskFlow IV gauge                     | Captured UI loop       |
| 04d | 0:42–0:48 | 6s       | Consul · earnings catalyst card                | Captured UI loop       |
| 04e | 0:48–0:54 | 6s       | Herald · scored headline feed                  | Captured UI loop       |
| 05  | 0:54–1:06 | 12s      | Arbitrum 5-seat chamber · token traverse       | Generated              |
| 06  | 1:06–1:14 | 8s       | Execution rail · TopStepX/Kalshi/Tradovate     | Generated              |
| 07  | 1:14–1:30 | 16s      | "INTELLIGENCE THAT LEADS." closing             | Generated              |

Total: 90s.

## Per-shot Hyperframes prompts

Save each as `docs/keynote-shots/shot-{NN}.md` with the full prompt text. Each prompt is self-contained — copy-pasteable into Kimi Code without context.

### Shot 01 prompt (template — replicate for all 7)

```
Hyperframes shot 01 — Cold open.

Style: matte industrial-luxe. Bloomberg Terminal × Hodinkee × Kubrick title card.
Palette: pure black background `#050402` (warm near-black), single warm gold accent `#c79f4a`, no other colors.

Action: 6 seconds total.
- Frames 0–3.0s: pure black, dead frame, no motion
- Frames 3.0s–4.5s: a 1px horizontal gold line `#c79f4a` draws across the lower-third of the frame (centered vertically at 75% from top), left-to-right reveal, ease-out
- Frames 4.5s–6.0s: hold the line, no movement

Camera: locked off, no zoom, no shake.
Banned: gradients, glows, particles, lens flares, vignette, film grain, color other than `#050402` and `#c79f4a`.
Output: 1920×1080, 30fps, H.264, no audio.
```

### UI capture shots (03, 04a–04e)

For Shots 03 and 04a–04e, the source is real Fintheon UI — NOT Hyperframes-generated. Capture flow:

1. TP launches Fintheon desktop app on the Mac in dev mode
2. Use macOS Screen Recording (Shift+Cmd+5) at 1920×1080 source resolution
3. Capture a clean 8-second loop per surface (Sanctum, Kalshi panel, RiskFlow gauge, catalyst card, headline feed)
4. Strip cursor, strip system UI
5. Save to `docs/keynote-shots/captures/shot-{NN}.mov`
6. T6 composites these into the final keynote (numerals + labels added in Hyperframes / DaVinci)

## Asset checklist (all locked Mon EOD)

- [ ] Source prompt saved at `docs/keynote-source-prompt.md`
- [ ] 7 per-shot prompts saved at `docs/keynote-shots/shot-{01..07}.md`
- [ ] 6 UI capture clips saved at `docs/keynote-shots/captures/`
- [ ] Final cut sheet saved at `docs/keynote-shots/cut-sheet.md` with timecodes
- [ ] Poster frame timecode list: 0:00, 0:06, 0:14, 0:24, 0:54, 1:06, 1:14, 1:30

## Done means

- All 7 shot prompts written and self-contained
- All 6 UI captures recorded and stripped of cursor/system UI
- Cut sheet locked with TP signoff
- T6 can begin render iteration Tue without further input from T3

## Off-limits

- No render attempts today — T6 owns iteration
- No music/audio, ever
- No deviation from the 7-shot structure without TP signoff
