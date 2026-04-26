# S43-T10 — QA, Lighthouse, archive, DNS swap

**Owner**: Frontend lead / ops (TP authorizes DNS swap explicitly)
**Day**: Fri 2026-05-01 (afternoon — after T9 hands off green preview)
**Outputs**: Old site archived, DNS pointed to new Vercel project, SSL verified, OG/redirects working, live URL announced.

## Context

Parent brief: `sprint-md/S43-PIR-SITE-REDESIGN.md`. T9 hands off a green Vercel preview Friday afternoon. T10 finishes the QA pass, archives the old site, and executes the DNS swap. **DNS swap is destructive — TP must explicitly authorize before T10 runs the cutover step.**

## Inputs from T9

- Vercel preview URL (locked after TP greenlight)
- Both pages building green
- Lighthouse passing locally

## Phase 1 — QA pass (~90min)

### Cross-browser

Test on:

- Chrome 130+ (macOS + iOS)
- Safari 18+ (macOS + iOS)
- Firefox 132+ (macOS)
- Edge 130+ (Windows, via BrowserStack if no local Windows)

For each browser:

- [ ] Both pages render without layout shift
- [ ] Lenis smooth scroll active
- [ ] GSAP scroll-linked keynote scrubs smoothly on `/fintheon`
- [ ] All hover states work
- [ ] Type renders correctly (Doto, grotesk, mono)
- [ ] No console errors
- [ ] No off-palette colors visible

### Mobile real-device

Test on:

- iPhone (Safari) — TP's device
- Android (Chrome) — BrowserStack or Pixel emulator

For each:

- [ ] Pages render at 390px without overflow
- [ ] Reduced-motion path engages when iOS Reduce Motion is on
- [ ] Video posters show on `/fintheon` instead of scroll-linked playback (mobile fallback)
- [ ] Tap targets meet 44×44 minimum

### Lighthouse final

```bash
bunx lighthouse https://[vercel-preview-url] --view --preset=desktop
bunx lighthouse https://[vercel-preview-url]/fintheon --view --preset=desktop
bunx lighthouse https://[vercel-preview-url] --view
bunx lighthouse https://[vercel-preview-url]/fintheon --view
```

Required scores:

- Mobile Performance ≥ 90
- Mobile LCP < 1.8s
- Mobile CLS < 0.05
- Mobile TBT < 200ms
- Desktop Performance ≥ 95
- Accessibility ≥ 95 (both pages)
- Best Practices ≥ 95

If any score fails, T10 escalates back to T9 — no DNS swap with red Lighthouse.

### OG / share preview

- [ ] Twitter Card Validator (`https://cards-dev.twitter.com/validator`) — both URLs preview correctly with `og-image.png`
- [ ] Facebook Sharing Debugger — both URLs preview correctly
- [ ] Slack unfurl test — paste preview URL in any Slack channel, verify card

### Reduced-motion final pass

Chrome devtools → Rendering → Emulate `prefers-reduced-motion: reduce`. Reload both pages.

- [ ] All type type-on staggers replaced with instant fades
- [ ] Scroll-linked keynote replaced with static poster
- [ ] Lenis smooth scroll disabled (or at minimum no jank)
- [ ] Hover transitions still work (those are user-initiated, OK to keep)

## Phase 2 — Archive old site (~30min)

Before DNS swap, preserve current production for posterity.

```bash
mkdir -p ~/Documents/Codebases/pricedinresearch-site-archive
cd ~/Documents/Codebases/pricedinresearch-site-archive

# 1. Clone the existing source repo (TP supplies repo URL or local path)
gh repo clone [old-repo] old-site-source

# 2. Screenshot every page rendered live
mkdir -p screenshots
bunx playwright install chromium
cat > capture.mjs <<EOF
import { chromium } from 'playwright'
const urls = [
  'https://pricedinresearch.io',
  'https://pricedinresearch.io/fintheon',
]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
for (const url of urls) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  const slug = url.replace(/[^a-z0-9]/gi, '-')
  await page.screenshot({ path: \`screenshots/\${slug}.png\`, fullPage: true })
}
await browser.close()
EOF
node capture.mjs

# 3. Commit archive
git init && git add . && git commit -m "Archive of pricedinresearch.io as of 2026-05-01"
```

## Phase 3 — DNS swap (REQUIRES TP EXPLICIT AUTHORIZATION)

**Before running this phase, T10 must receive explicit "GO" from TP via iMessage or chat. Do not execute on assumed authorization.**

### Cloudflare zone update

1. Log into Cloudflare dashboard for `pricedinresearch.io`
2. Verify Vercel project `pricedinresearch-site` is in production mode (not preview)
3. Get Vercel-assigned DNS records from Vercel dashboard:
   - `A` record: `pricedinresearch.io` → Vercel IP (or `CNAME` flatten)
   - `CNAME` record: `www.pricedinresearch.io` → `cname.vercel-dns.com`
4. **DO NOT TOUCH**: `pulse.pricedinresearch.io` subdomain (existing dashboard) — leave its records untouched
5. Update apex `A` and `www` `CNAME`
6. Wait 2–5 minutes for propagation
7. Verify with `dig`:
   ```bash
   dig pricedinresearch.io +short
   dig www.pricedinresearch.io +short
   dig pulse.pricedinresearch.io +short  # confirm UNCHANGED
   ```

### SSL verification

- [ ] `https://pricedinresearch.io` resolves with valid SSL (Vercel auto-provisions Let's Encrypt)
- [ ] `https://www.pricedinresearch.io` redirects to apex (set in Vercel project settings)
- [ ] `http://pricedinresearch.io` redirects to https
- [ ] No mixed-content warnings in browser console

### Post-swap smoke test

- [ ] `/` loads with new design
- [ ] `/fintheon` loads with new design + keynote video
- [ ] `/pulse.pricedinresearch.io` (subdomain) still serves old dashboard
- [ ] OG previews work via Twitter/Facebook validators
- [ ] Lighthouse re-run on production URLs — same scores as preview

## Phase 4 — Announce (after TP greenlight)

- [ ] Tweet from PIC account (TP composes copy)
- [ ] Update LinkedIn company page (TP)
- [ ] Update email signature templates (TP)
- [ ] Notify Harper-Opus + Oracle in Fluxer Forum that the site is live
- [ ] Update changelog at `~/Documents/Codebases/pricedinresearch-site/CHANGELOG.md` with v1.0.0 entry

## Done means

- Old site archived locally with source + full-page screenshots
- DNS pointed to Vercel
- SSL valid on apex + www
- `pulse.pricedinresearch.io` untouched and still functional
- Lighthouse passing on production URLs
- TP has greenlit and announced
- Slack/iMessage ping: "S43-T10 done, pricedinresearch.io is live."

## Rollback procedure (if anything breaks post-swap)

If production breaks after DNS swap:

1. **Don't panic** — Cloudflare DNS changes propagate in 2–5min
2. Revert apex `A` + `www` `CNAME` in Cloudflare to old values (T10 must capture old values BEFORE swap to a `dns-rollback.txt` file in the archive)
3. Wait 5min, verify old site returns
4. Diagnose Vercel issue separately, redeploy, re-attempt DNS

```bash
# Capture old DNS BEFORE swap
dig pricedinresearch.io +noall +answer > ~/Documents/Codebases/pricedinresearch-site-archive/dns-rollback.txt
dig www.pricedinresearch.io +noall +answer >> ~/Documents/Codebases/pricedinresearch-site-archive/dns-rollback.txt
```

## Off-limits

- No DNS swap without explicit TP authorization
- No touching `pulse.pricedinresearch.io` subdomain records
- No deleting old repo until T+7 days post-launch (keep archive read-only)
- No Vercel project name changes after swap
- No analytics scripts injected at the eleventh hour
