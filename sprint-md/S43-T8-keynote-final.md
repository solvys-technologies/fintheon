# S43-T8 — Hyperframes keynote final render + poster export

**Owner**: Content/video lead
**Day**: Thu 2026-04-30 (morning, ~3h)
**Outputs**: Production-ready `keynote.mp4` + `keynote.webm` + 8 poster PNGs in `pricedinresearch-site/public/assets/`, ready for T9 scroll-linked playback wiring Friday.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T6 finished v3 render Wed EOD with TP greenlight. T8 takes v3 master, transcodes web copies, exports poster frames, and copies into the Next.js `public/` directory.

## Inputs

```
~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/
├─ master/keynote-v3.mov     # ProRes or H.264 12 Mbps master
├─ poster-timecodes.md       # 0:00, 0:06, 0:14, 0:24, 0:54, 1:06, 1:14, 1:30
└─ feedback.md               # iteration history (archive only)
```

## Steps

### 1. Transcode web copies (~30min)

```bash
cd ~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/master

# H.264 MP4 — Safari + Chrome fallback
ffmpeg -i keynote-v3.mov \
  -c:v libx264 -profile:v high -level 4.2 \
  -b:v 4M -maxrate 5M -bufsize 8M \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  ../keynote.mp4

# VP9 WebM — Chrome / Firefox primary
ffmpeg -i keynote-v3.mov \
  -c:v libvpx-vp9 -b:v 2.5M \
  -pix_fmt yuv420p \
  -row-mt 1 \
  -an \
  ../keynote.webm
```

Verify file sizes:

- `keynote.mp4` should be < 4.5 MB (target 4 MB)
- `keynote.webm` should be < 3 MB (target 2.5 MB)

If either exceeds the budget, drop bitrate by 0.5 Mbps and re-encode.

### 2. Export poster frames (~30min)

For each timecode in `poster-timecodes.md`, extract a single PNG at 1920×1080:

```bash
ffmpeg -ss 00:00:00 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act1.png
ffmpeg -ss 00:00:06 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act2.png
ffmpeg -ss 00:00:14 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act3.png
ffmpeg -ss 00:00:24 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act4.png
ffmpeg -ss 00:00:54 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act5.png
ffmpeg -ss 00:01:06 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act6.png
ffmpeg -ss 00:01:14 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act7.png
ffmpeg -ss 00:01:30 -i keynote-v3.mov -frames:v 1 -q:v 1 ../poster-act8.png
```

Compress each PNG to < 200 KB via `pngquant` or `oxipng`:

```bash
pngquant --quality=80-95 --output ../poster-act{1..8}.png ../poster-act{1..8}.png --force
```

### 3. OG image render (~15min)

Pull Act 7 closing frame ("INTELLIGENCE THAT LEADS.") and crop/resize to 1200×630:

```bash
ffmpeg -ss 00:01:20 -i keynote-v3.mov -frames:v 1 \
  -vf "scale=1200:-1,crop=1200:630" \
  -q:v 1 ../og-image.png
```

### 4. Copy into Next.js `public/` (~10min)

```bash
mkdir -p ~/Documents/Codebases/pricedinresearch-site/public/assets
cp ~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/keynote.mp4 \
   ~/Documents/Codebases/pricedinresearch-site/public/assets/
cp ~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/keynote.webm \
   ~/Documents/Codebases/pricedinresearch-site/public/assets/
cp ~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/poster-act{1..8}.png \
   ~/Documents/Codebases/pricedinresearch-site/public/assets/
cp ~/Documents/Codebases/pricedinresearch-site/docs/keynote-shots/renders/v3/og-image.png \
   ~/Documents/Codebases/pricedinresearch-site/public/assets/
```

### 5. Smoke test in Next.js (~30min)

Add temporary test route `app/_dev/keynote/page.tsx`:

```tsx
export default function KeynoteTest() {
  return (
    <main className="bg-bg min-h-screen flex items-center justify-center">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/assets/poster-act1.png"
        className="max-w-[1440px] w-full border border-accent"
      >
        <source src="/assets/keynote.webm" type="video/webm" />
        <source src="/assets/keynote.mp4" type="video/mp4" />
      </video>
    </main>
  );
}
```

Run `bun run dev`, hit `/_dev/keynote`, verify:

- [ ] Video autoplays muted
- [ ] Loop seamless (no black flash at boundary)
- [ ] Poster shows before video loads
- [ ] No audio track
- [ ] Palette compliant (sample 5 frames)

### 6. Commit + deploy preview

```bash
git add public/assets/
git commit -m "S43-T8: keynote final + posters"
git push
```

Vercel preview auto-deploys. Share URL with TP for last sign-off.

## Done means

- `keynote.mp4` + `keynote.webm` + 8 poster PNGs + `og-image.png` all in `public/assets/`
- File sizes within budget (MP4 < 4.5 MB, WebM < 3 MB, posters < 200 KB each)
- Smoke test route renders video correctly
- Vercel preview shared with TP
- Slack/iMessage ping: "S43-T8 done, keynote assets ready: [Vercel preview URL]/\_dev/keynote"

## Off-limits

- No re-renders — v3 is final per T6 greenlight
- No audio additions
- No alternative poster timecodes
- Don't delete `_dev/keynote` route yet — T9 keeps it for QA
