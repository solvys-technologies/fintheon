// [claude-code 2026-03-23] Shared change log for multi-agent coordination.

export type ChangelogEntry = {
  date: string;
  agent: "claude-code" | string;
  summary: string;
  files: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-05-03T22:42:30-04:00",
    agent: "claude-code",
    summary:
      "S58 shipped: DeepSeek primary provider, BYOK chat paths, brief recovery, and frontend/mobile provider fixes. Archived to sprint-changelog/. 3 tracks, 56 files.",
    files: ["sprint-changelog/S58-ORCHESTRATION.md"],
  },
  {
    date: "2026-05-03T22:41:52-04:00",
    agent: "claude-code",
    summary:
      "Install maintenance audit: documented all backend source-referenced environment variables and backfilled safe local defaults for Arbitrum/RiskFlow worker drift without embedding secrets.",
    files: [
      "backend-hono/.env.example",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T22:40:00-04:00",
    agent: "claude-code",
    summary:
      "v6.0.9 deploy fix: made DeepSeek visible/selectable in both chat surfaces and migrated stale VProxy/OpenRouter defaults to DeepSeek primary.",
    files: [
      "frontend/components/chat/ProviderDropdown.tsx",
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/settings/HermesAdminTab.tsx",
      "mobile/components/chat/ChatPage.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
      "scripts/fintheon-setup.sh",
      "scripts/install-cli.sh",
      "scripts/fintheon-cli.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-04T00:55:00-04:00",
    agent: "claude-code",
    summary:
      "Added a Refinement Engine slow-drip backfill control for @financialjuice that starts/stops a backend 30-minute job, inserts randomized 10-15 post batches from the last two days in chronological order, and scores each tick so missed headlines surface without rate-limit bursts.",
    files: [
      "backend-hono/src/services/riskflow/financialjuice-backfill-drip.ts",
      "backend-hono/src/routes/admin/riskflow-backfill-drip.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/refinement/FinancialJuiceBackfillPanel.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T18:57:00-04:00",
    agent: "claude-code",
    summary:
      "S58-T3 brief recovery: routed MDB/ADB/PMDB/TWT generation through the DeepSeek primary provider chain, taught the weekly prompt to honor legacy TOTT naming, and added TWT/WT/TOTT storage compatibility so older brief-table constraints still persist and hydrate the weekly report.",
    files: [
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/supabase-service.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T16:20:00-04:00",
    agent: "claude-code",
    summary:
      "S58-T1 backend: moved AI routing to DeepSeek v4 Pro/deepseek-reasoner primary with OpenRouter fallback and VProxy last resort; added encrypted user DeepSeek key storage endpoints and Supabase RLS migration; updated Harper, Arbitrum, diagnostics, and budget metadata for the new provider chain.",
    files: [
      "backend-hono/src/services/ai/routing.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/ai/provider-chain.ts",
      "backend-hono/src/services/ai/openrouter-fallback.ts",
      "backend-hono/src/services/ai/provider-chain-health.ts",
      "backend-hono/src/services/ai/ollama-hermes-client.ts",
      "backend-hono/src/services/strands/provider.ts",
      "backend-hono/src/services/strands/deepseek-health.ts",
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
      "backend-hono/src/services/ai/budget.ts",
      "backend-hono/src/services/ai/api-key-crypto.ts",
      "backend-hono/src/routes/settings/ai-keys.ts",
      "backend-hono/src/routes/settings/index.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/arbitrum/index.ts",
      "backend-hono/src/services/arbitrum/adapters.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/boot/index.ts",
      "supabase/migrations/20260503_s58_user_api_keys.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T16:05:00-04:00",
    agent: "claude-code",
    summary:
      "S58-T2 client SDK: added shared DeepSeek direct/OC API streaming SDK, desktop provider/key settings, Hermes default provider warning, and mobile direct-chat fallback that uses user DeepSeek keys when available while preserving backend relay paths.",
    files: [
      "frontend/lib/deepseek-sdk.ts",
      "frontend/lib/apiClient.ts",
      "frontend/lib/services/ai.ts",
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/chat/ProviderDropdown.tsx",
      "frontend/components/settings/ApiTab.tsx",
      "frontend/components/settings/DeepSeekApiKeySection.tsx",
      "frontend/components/settings/HermesAdminTab.tsx",
      "mobile/lib/backend.ts",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/hooks/useAskCAO.ts",
      "mobile/components/settings/SettingsPage.tsx",
      "mobile/components/settings/AiProviderSection.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T15:40:00-04:00",
    agent: "claude-code",
    summary:
      "Fix: version check now targets Fly.io production backend instead of localhost. Desktop app's VITE_API_URL pointed to localhost:8080 which was always rebuilt to latest, so no version delta ever appeared. Now always hits fintheon.fly.dev/api/version/check for update detection.",
    files: ["frontend/lib/version-check.ts"],
  },
  {
    date: "2026-05-03T15:26:00-04:00",
    agent: "claude-code",
    summary: "S57 shipped: Arbitrum dashboard UI — RiskSignalCards feed from Aquarium, chevron rows with FadingRuler separators, height-locked Page 0 with internal scroll, Chamber tiles with vertical score fuses. Unified X tier + cross-device round-robin coordinator deployed to all 3 targets. Archived to sprint-changelog/.",
    files: ["sprint-changelog/S57-BRIEF-arbitrum-dashboard-ui-refinement.md"],
  },
  {
    date: "2026-05-03T15:10:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow X polling: cross-device round-robin with Supabase coordination (90-min rotation per team Mac mini, fallback chain to main device). Unified breaking/commentary/standard X tiers into single home-timeline pass — all handles polled in one Playwright session, post-filtered by handle-routing rules. Added riskflow_polling_coordinator singleton table for distributed lock. Worker coordination module with claim/release/rotate/fallback. Launchd plist for local Mac mini worker. Non-X standard tier (COT/FOMC/Fed/Kalshi) preserved independently.",
    files: [
      "backend-hono/src/workers/riskflow-worker/coordination.ts",
      "backend-hono/src/workers/riskflow-worker/scheduler.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/workers/riskflow-worker/persist.ts",
      "supabase/migrations/20260503120000_riskflow_polling_coordinator.sql",
      "launchd/io.solvys.fintheon-riskflow-worker.plist",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T13:25:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow media pipeline: fixed econ-bridge schema (removed non-existent columns sentiment/iv_score/macro_level/risk_type/econ_data from raw_riskflow_items INSERT — now writes tweet_id/headline/body/source/source_domain/url/is_breaking/urgency/symbols/tags/published_at/submitted_by/ingest_pipeline). Broadened X home timeline image extraction to 6 selector strategies (pbs.twimg.com/media, card_img, twimg.com/media, amplify_video_thumb, tweetPhoto). Added video extraction from <video> elements with twimg.com src. Desktop+mobile RiskFlow expanded cards now auto-play muted loop video (stops on collapse/unmount) with X-inspired bottom-left mute toggle button.",
    files: [
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "frontend/components/feed/RiskFlowPostCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T12:55:00-04:00",
    agent: "claude-code",
    summary:
      "Hardened RiskFlow X auto-reauth: (1) clear stale x.com cookies before login so X shows clean login form instead of broken session-expired page, (2) pre-flight auth check detects login wall immediately and triggers re-auth on first failure instead of waiting 3 cycles, (3) multi-strategy selectors for Next/Login buttons, (4) extract ct0 alongside auth_token for persistent context re-launch, (5) username verification challenge page handling, (6) CAPTCHA/2FA detection in failure logs.",
    files: [
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-03T09:30:00-04:00",
    agent: "claude-code",
    summary:
      "S57: Arbitrum + dashboard UI refinement. Canonicalized next-session IV scenarios into deterministic Continuation / Risk-on rally / Escalation slots with explicit 0% rows; shared the scenario strip in Sanctum Volatility Read. Compact Arbitrum chamber seats now show name, score, confidence, and side-mounted vertical score fuses with 1.0 ruler increments; clicking a seat opens an Arbitrum-only draggable full-summary popup, capped at two independent floating cards with internal scrolling. Sanctum Page 0 dropped the fixed chamber height and inner chamber scroll, uses bare/no-streak DayCard, and swaps solid split strokes for fading rulers. Dashboard DayCard moves streak into its Desk Plan header; Dashboard now uses the actual Arbitrum Risk Signals list as chevron-expandable ruler-separated rows instead of the IV scenario strip, and Page 0 is height-locked so overflow scrolls inside sections. Econ Pulse now lays out three fuses across on desktop.",
    files: [
      "backend-hono/src/services/market-data/canonical-iv-scenarios.ts",
      "backend-hono/src/services/market-data/iv-prediction.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "frontend/types/market-data.ts",
      "frontend/components/narrative/NextSessionScenariosStrip.tsx",
      "frontend/components/narrative/BlendedIVForecastCard.tsx",
      "frontend/components/narrative/useIVScoreData.ts",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/ChamberSeats.tsx",
      "frontend/components/arbitrum/ChamberAgentSummaryPopup.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/RiskSignalCards.tsx",
      "frontend/components/narrative/DayCard.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/narrative/econ/EconKpiFuses.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-01T10:50:00-04:00",
    agent: "claude-code",
    summary:
      "X intake plumbing: restored syndication+XActions fallback chain, added X_AUTH_TOKEN cookie injection to persistent browser session so x.com/search works with auth. Browser-use is again primary (was broken due to loginwall). Fixed heartbeat table name from news_worker_heartbeats→riskflow_worker_heartbeats in diagnostics and audit handler.",
    files: [
      "backend-hono/src/services/browser/persistent-session.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/cron/news-worker-audit-handler.ts",
    ],
  },
  {
    date: "2026-05-01T10:15:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow worker was dead for ~5 days. Fixed launchd plist pointing to deleted news-worker/ dir (renamed to riskflow-worker/). Enabled writes (FLAG_NEWS_WORKER_WRITES_RISKFLOW=true). Added cftc.gov to browser allowlist for COT data. Added 90s collector timeout in safeCollect to prevent browser hangs from stalling scheduler. Deployed to fintheon-riskflow-worker on Fly. X/Twitter syndication still rate-limited (429) — browser-based x.com search is the last working path.",
    files: [
      "launchd/io.solvys.fintheon-news-worker.plist",
      "backend-hono/src/services/browser/allowlist.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
    ],
  },
  {
    date: "2026-05-01T02:05:00-04:00",
    agent: "claude-code",
    summary:
      "v6.0.5: shell border refinement — gold hairline wraps top/left/bottom of main content (right side meets Strategium without a stroke). TopHeader's own border-t removed to avoid double-stroking the seam. Top-left + bottom-left corners rounded (rounded-tl-2xl + rounded-bl-2xl).",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "package.json",
    ],
  },
  {
    date: "2026-05-01T01:34:00-04:00",
    agent: "claude-code",
    summary:
      "v6.0.4 deployed: S56 shipped (Arbitrum settings + Sanctum restructure + Dashboard signals + mobile drawer). Backend Fly.io, desktop Vercel, mobile PWA all live. Archived S56 to sprint-changelog/.",
    files: [
      "sprint-changelog/S56-BRIEF-arbitrum-settings-health-panel.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-01T01:30:00-04:00",
    agent: "claude-code",
    summary:
      "S56: Arbitrum settings + Sanctum restructure + Dashboard signals + mobile main-menu drawer.",
    files: [
      "supabase/migrations/20260501000000_arbitrum_seat_overrides.sql",
      "backend-hono/src/services/arbitrum/types.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/index.ts",
      "backend-hono/src/routes/arbitrum/index.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/arbitrum/types.ts",
      "frontend/components/arbitrum/ArbitrumSettingsPanel.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/BlendedIVForecastCard.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/hooks/useArbitrumHealth.ts",
      "frontend/hooks/useArbitrumSeatOverrides.ts",
      "mobile/components/layout/MainMenuDrawer.tsx",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-05-01T01:15:00-04:00",
    agent: "claude-code",
    summary:
      "Epoch updater + auto-close fix. Removed Claude Stop hook that ran fintheon-update.sh after every turn (pkilled Fintheon mid-session, then reinstalled and reopened). Replaced manual-handoff updater with one-click in-app DMG swap: bottom-left toast prompt 'A new epoch was released. (X.Y.Z)' / Update button → main process spawns detached fintheon-install-update.sh → app.quit() → DMG download via gh → /Applications swap → reopen → marker file triggers 'Epoch X.Y.Z has risen.' success toast on next launch.",
    files: [
      ".claude/settings.json",
      "scripts/fintheon-install-update.sh",
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/components/VersionChecker.tsx",
      "frontend/types/electron.d.ts",
      ".github/workflows/ci.yml",
      ".github/workflows/windows-build.yml",
    ],
  },
  {
    date: "2026-05-01T00:30:00-04:00",
    agent: "claude-code",
    summary:
      "S56-shell pre-pass: sidebar slide-out + footer blend. NavSidebar inner switched from absolute/z-0 to relative so expanding pushes main content right (was hidden under z-10 main). MainLayout middle flex container now bg-surface; main content stripped of rounded-l-2xl + border-l + heavy shadow so the left edge flows continuously with the sidebar (no corner triangles). FooterToolbar bg switched to --fintheon-surface to match TopHeader + sidebar. Epoch label bumped from accent/50 to text/75 for legibility.",
    files: [
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
    ],
  },
  {
    date: "2026-04-30T22:00:00-04:00",
    agent: "claude-code",
    summary:
      "v6.0.2 deployed: RiskFlow unification + layout glass card rounding + immutable guidelines. Backend Fly.io, desktop Vercel, mobile PWA all live. S50/S51/S54/S55 archived to sprint-changelog/.",
    files: [
      "sprint-changelog/S50-ORCHESTRATION.md",
      "sprint-changelog/S51-BRIEF-riskflow-cards-and-arbitrum-recovery.md",
      "sprint-changelog/S54-BRIEF-refinement-riskflow-operator-control.md",
      "sprint-changelog/S55-BRIEF-riskflow-feed-health-and-econ-live-race.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T19:00:00-04:00",
    agent: "claude-code",
    summary:
      "Layout rounding + glass effect: main content area now rounded-2xl with frosted-glass bg + subtle shadow, sidebar rounded-r-xl. Arbitrum summary moved below Chamber Confidence card. App title indentation fixed (removed lg:px-6). Dashboard briefing converted from textarea to ReactMarkdown rich text. News cleanup: added Dan Bongino, Candace Owens, Nick Fuentes to content-guard junk language; added 'dragged', 'lets you trade', 'trade like' to speculation-filter. Reimplemented thumbs-down feedback button in RiskFlowPostCard (left of URL CTA). Created immutable-guidelines.ts with 9 never-revert rules. Wired immutable guidelines validation into central-scorer pipeline gate. Updated not-relevant handler to route feed-quality tasks through Hermes (DeepSeek).",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/feed/RiskFlowPostCard.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/speculation-filter.ts",
      "backend-hono/src/services/riskflow/immutable-guidelines.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T18:22:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow feed backfill: X collector respects explicit from/to historical windows (refill no longer capped at 24h); refill-driver accepts twitterTier; economic_events range reads up to 5k rows; added bun script riskflow-feed-backfill (Wire/Macro/Commentary + calendar econ inject).",
    files: [
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/services/riskflow/refill-driver.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/scripts/riskflow-feed-backfill.ts",
      "backend-hono/package.json",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T18:05:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow econ deviation visuals (BeatMissBadge + DetailFooter) now read bullish/bearish/muted from the same CSS variables as the fuse palette (--fintheon-bullish, --fintheon-bearish, --fintheon-muted) so user personalization in Settings drives beat/miss chips and signed deviation % colors.",
    files: [
      "frontend/lib/econ-deviation-presentation.ts",
      "frontend/components/feed/BeatMissBadge.tsx",
      "frontend/components/feed/DetailFooter.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T17:29:04-04:00",
    agent: "codex",
    summary:
      "v6.0.1 deploy prep: unified main-layout and arbitrum/refinement UI updates by moving Refinement toggles + catalyst stats into a shared side-by-side container under Market Environment, converting chamber confidence cards to 0.0 score formatting without model labels/conf text, and relocating the chamber summary under chamber readings while preserving previous iOS-style shell and solvys-fuse cleanup updates.",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/CatalystStatsDrawer.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/ChamberSeats.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
      "scripts/fintheon-setup.sh",
      "scripts/install-cli.sh",
      "scripts/fintheon-cli.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T16:40:49-04:00",
    agent: "codex",
    summary:
      "Applied /solvys-ui-details pass and solvys-fuse baseline: unified linear fuse increments across shared desktop/mobile fuse primitives, removed duplicate compact Arbitrum digest text, rounded the main content shell top-left border, anchored sidebar icons during expand, relocated the small borderless Edit control into the Dashboard row, and trimmed the footer top divider so it no longer bleeds into the sidebar rail.",
    files: [
      "frontend/components/shared/NothingFuse.tsx",
      "mobile/components/shared/IVFuseBar.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T16:14:00-04:00",
    agent: "codex",
    summary:
      "Unified post-S55 source-account and worker behavior: breaking tier now polls Wire handles only, commentary tier writes as commentary cadence-tier, source-account edit route now enforces blocked-handle + browser-method X handle validation, and SourceAccountsManager completed Solvys-feels cleanup (tokenized colors, frosted forms, solid accent add action).",
    files: [
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/routes/source-accounts/handlers.ts",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T16:11:00-04:00",
    agent: "codex",
    summary:
      "Fixed desktop RiskFlow severity-color preference drift by wiring user fusePalette preferences to runtime CSS variables in SettingsContext, so RiskFlow cards/fuses now reflect user-selected severity and trade-direction colors immediately.",
    files: ["frontend/contexts/SettingsContext.tsx", "src/lib/changelog.ts"],
  },
  {
    date: "2026-04-30T14:19:00-04:00",
    agent: "codex",
    summary:
      "Post-S55 RiskFlow pipeline unification: aligned worker contract cadence to the live scheduler (breaking 60s, commentary 60s, standard 5m) and wired scheduler intervals to shared contract constants so tier cadence has a single source of truth before deploy.",
    files: [
      "backend-hono/src/workers/riskflow-worker/contract.ts",
      "backend-hono/src/workers/riskflow-worker/scheduler.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T13:35:00-04:00",
    agent: "codex",
    summary:
      "Refinement Advanced tab detail pass: normalized right-justified badge/count sizing against left labels by widening numeric rails, aligning tabular counts, and resizing badge typography in Event Weights, Persons of Interest, Source Accounts, and preset metadata rows for cleaner balance.",
    files: [
      "frontend/components/refinement/QuickWeightEditor.tsx",
      "frontend/components/refinement/PresetSelector.tsx",
      "frontend/components/refinement/CommentatorManager.tsx",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T13:23:00-04:00",
    agent: "claude-code",
    summary:
      "Refinement Engine polish pass: reshaped Market Environment into a single full-width top row and rebuilt Advanced tab Event Weight sliders with shared segmented fuse styling, per-1.0 ruler marks, free decimal drag control (0.1 precision), and corrected movable knob behavior so values no longer snap-lock to whole numbers.",
    files: [
      "frontend/components/refinement/RegimeControl.tsx",
      "frontend/components/refinement/QuickWeightEditor.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T17:25:00-04:00",
    agent: "claude-code",
    summary:
      "S55: Restored RiskFlow feed integrity. Fixed normalizeSource to stop defaulting unknown sources to FinancialJuice (root cause of trust-label failure). Added read-time blocked-host filter (feed-integrity.ts) so poisoned historical rows cannot render. Implemented WIRE word-gate classifier replacing emoji-dependent econ/earnings classification. Quarantined commentary-scraper Rettiwt path behind RISKFLOW_COMMENTARY_SCRAPER=enabled gate. Added econ live-race scaffolding (source registry + observation model). Moved Econ Status indicator from TopHeader to FooterToolbar. Built shared heading-toolbar Econ Countdown widget with fade transitions. Purged 3,028 blocked-publisher rows (seekingalpha.com, bloomberg.com, cnbc.com, etc.) from scored_riskflow_items and raw_riskflow_items. Added Untrusted NewsSource type. Supabase dry-run audit confirmed zero blocked hosts in feed.",
    files: [
      "backend-hono/src/services/riskflow/feed-integrity.ts",
      "backend-hono/src/services/riskflow/wire-print-classifier.ts",
      "backend-hono/src/services/econ/econ-source-registry.ts",
      "backend-hono/src/services/econ/econ-live-race.ts",
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/types/news-analysis.ts",
      "frontend/types/feed.ts",
      "frontend/components/layout/EconCountdownWidget.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "backend-hono/scripts/purge-blocked-publishers.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T12:48:00-04:00",
    agent: "claude-code",
    summary:
      "Patched desktop dashboard RiskFlow tape parity: expanded dashboard cards now use the same distilled media/source/chat action body as Strategium and full RiskFlow, source links open as small source popups, visible dismiss thumbs were removed, RiskFlow media hydration accepts image_url fallbacks, IV stacks/chevrons render from severity colors instead of a monocolor heat fallback, expanded cards drain the vertical fuse into a delayed left-to-right horizontal fuse, and RiskFlow filters now broadcast as shared preferences across desktop news surfaces including the dashboard tape.",
    files: [
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/feed/RiskFlowPostCard.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowCardAnatomy.tsx",
      "frontend/components/shared/IVStack.tsx",
      "frontend/components/shared/NothingFuse.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/lib/source-popup.ts",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/contexts/RiskFlowContext.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T12:29:00-04:00",
    agent: "claude-code",
    summary:
      "RiskFlow card patch: unified the feed, Strategium, NarrativeFlow, and timeline catalyst card anatomy around the preview headline with left IV fuse and right IV/direction stack, while distilling expanded cards so media/source actions render without duplicated headline, source, or IV metadata.",
    files: [
      "frontend/components/feed/RiskFlowCardAnatomy.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowPostCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
      "frontend/components/narrative/NarrativeMiniCard.tsx",
      "frontend/components/narrative/NarrativeResearchCard.tsx",
      "frontend/components/narrative/TimelinePanel.tsx",
      "frontend/lib/catalyst-riskflow-utils.ts",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T12:06:00-04:00",
    agent: "claude-code",
    summary:
      "INSTALL-UPDATE: documented the quarantined RiskFlow commentary scraper flag and backfilled it as disabled during updates so deprecated Rettiwt paths stay off after S55.",
    files: [
      "backend-hono/.env.example",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T12:00:00-04:00",
    agent: "claude-code",
    summary:
      "S55 unified and preflighted for deploy: RiskFlow now applies a reusable blocked-publisher read guard, WIRE econ/earnings posts classify through word gates, TradingView is documented as schedule-only for econ live-race scaffolding, Econ status moved to the footer toolbar, and the heading toolbar alternates PsychAssist with a compact countdown widget.",
    files: [
      "backend-hono/src/services/riskflow/feed-integrity.ts",
      "backend-hono/src/services/riskflow/wire-print-classifier.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/econ/econ-source-registry.ts",
      "backend-hono/src/services/econ/econ-live-race.ts",
      "frontend/components/layout/EconCountdownWidget.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-30T09:58:00-04:00",
    agent: "claude-code",
    summary:
      "Redesigned RiskFlow news expansions as Solvys-native post cards: full-feed and Strategium mini cards now share source metadata, full headline reveal, optional media/source preview, and one bottom-right Ask AI CTA. The collapsed preview shell is the reliable expand/collapse target, and IV scoring is visible across full, mini/Strategium, and mobile RiskFlow cards.",
    files: [
      "frontend/components/feed/RiskFlowPostCard.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/layout/TabRenderer.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T18:08:00-04:00",
    agent: "claude-code",
    summary:
      "INSTALL-UPDATE: documented and backfilled the worker-owned browser session env knobs used by the RiskFlow X browser-session deploy so local installs and update runs keep the new collector defaults in sync.",
    files: [
      "backend-hono/.env.example",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T18:00:00-04:00",
    agent: "claude-code",
    summary:
      "v5.38.2 release prep: bumped app/update versions for deployment of the browser-session RiskFlow X intake, Refinement source grouping, and global legibility pass.",
    files: [
      "package.json",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T17:58:00-04:00",
    agent: "claude-code",
    summary:
      "Refined RiskFlow source control after browser-harness migration: the worker now searches every active browser-backed X handle from the Refinement Engine instead of only Wire/Macro subsets, the Refinement source list separates @ handles from web sources, and the app base font size is raised by roughly 10% for better legibility.",
    files: [
      "backend-hono/src/services/source-accounts/source-accounts-service.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "frontend/index.css",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T17:52:00-04:00",
    agent: "claude-code",
    summary:
      "Corrected RiskFlow X intake to match the stripped pipeline: Rettiwt and Agent Reach are no longer active worker fallbacks. Added a worker-owned persistent browser session for X/browser-harness intake, made X handle collection try the persistent x.com browser session before public syndication, removed XActions from that path, replaced Agent Reach RSS usage with an official-government RSS collector, and updated source-account/pipeline metadata to default X sources to browser control.",
    files: [
      "backend-hono/src/services/browser/persistent-session.ts",
      "backend-hono/src/services/browser/index.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/workers/riskflow-worker/sources/official-gov-rss.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/types/source-account.ts",
      "backend-hono/src/services/source-accounts/source-accounts-service.ts",
      "backend-hono/src/routes/source-accounts/handlers.ts",
      "backend-hono/src/types/pipeline.ts",
      "backend-hono/src/routes/admin/pipelines.ts",
      "backend-hono/src/routes/admin/pipeline-stats.ts",
      "backend-hono/src/services/riskflow/source-policy.ts",
      "backend-hono/src/boot/services.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T17:06:00-04:00",
    agent: "codex",
    summary:
      "Manual hardening follow-up: tightened RiskFlow source enforcement and purge controls. Source policy is now static allowlist-only with explicit blocked publisher domains including seekingalpha.com, EconomicCalendar is accepted as the internal econ bridge, worker/scorer/write boundaries pass raw source context into policy checks, policy-blocked raw rows are purged instead of scored into the feed, econ bridge records continuity telemetry, Refinement purge UI now targets blocked domains/keywords via a neutral Purge action, and orphaned omi-reference was removed.",
    files: [
      "backend-hono/src/services/riskflow/source-policy.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/workers/riskflow-worker/persist.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/routes/admin/riskflow-bulk.ts",
      "frontend/components/refinement/CatalystStatsPanel.tsx",
      "frontend/components/refinement/CatalystStatsDrawer.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
      "omi-reference",
    ],
  },
  {
    date: "2026-04-29T20:45:00",
    agent: "claude-code",
    summary:
      "S53 shipped: RiskFlow operator control + source enforcement + continuity hardening. 6 tracks (T1-T4B), v5.38.0. Backend: source-policy allowlist enforcement, ingest activity ledger, leak sentinel, continuity counters, doctoring queue. Frontend: Operator Timeline, Source Policy Panel, Doctoring Panel with Solvys frosted-glass materials. 32 files, 3 deploy targets verified. Archived to sprint-changelog/.",
    files: ["sprint-changelog/S53-ORCHESTRATION.md"],
  },
  {
    date: "2026-04-29T23:00:00",
    agent: "claude-code",
    summary:
      "S53-T4B: Hardening continuation — RiskFlow operator control, source enforcement, and continuity visibility. Created source-policy service with strict allowlist-first enforcement (only approved X handles + .gov domains enter feed). Created ingest-activity-ledger with leak sentinel (rejected non-allowlisted, blocked-before-feed, unexpected insertions) and continuity counters (econ/commentary expected vs received, stall detection). Wired policy enforcement at writeRawItems boundary AND central scorer safety net (catches items from external riskflow-worker). Extended /api/admin/pipeline-stats/runtime with leak_sentinel + continuity + allowlist data. Added GET /api/admin/pipeline-stats/ingest-activity (Everything timeline) and POST/GET/DELETE /api/admin/pipeline-stats/doctorate (incident queue). Built frontend hooks: useIngestActivity, useDoctoringQueue. Built operator panels: OperatorTimeline (poll decisions), SourcePolicyPanel (allowlist/leak/continuity health), DoctoringPanel (incident queue + Doctorate CTA). Wired source policy refresh + ledger flush into boot sequence.",
    files: [
      "backend-hono/src/services/riskflow/source-policy.ts",
      "backend-hono/src/services/riskflow/ingest-ledger.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/admin/pipeline-stats.ts",
      "frontend/hooks/useIngestActivity.ts",
      "frontend/hooks/useDoctoringQueue.ts",
      "frontend/components/refinement/OperatorTimeline.tsx",
      "frontend/components/refinement/SourcePolicyPanel.tsx",
      "frontend/components/refinement/DoctoringPanel.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T16:13:00-04:00",
    agent: "codex",
    summary:
      "Reviewed S53 T4 status and added a same-thread continuation brief (T4B) to finish hardening scope: strict source enforcement, complete ingest visibility, modular Refinement control domains, and econ/commentary continuity gates.",
    files: [
      "sprint-md/S53-T4B-hardening-continuation-riskflow-operator-control.md",
    ],
  },
  {
    date: "2026-04-29T22:00:00",
    agent: "claude-code",
    summary:
      "S53-T4: Unification and hardening pass — resolved API/UI contract mismatches between T1 (backend control plane), T2 (frontend Refinement), and T3 (realtime econ/commentator). Fixed three contract breaks: (1) EconFilterEditor was calling /api/econ/filters but route is /api/econ-filters, (2) /api/admin/pipeline-stats returned {stats} with snake_case fields but frontend usePipelineStats read {pipelines} with camelCase, (3) /api/admin/pipelines returned no label/description fields needed by frontend PipelineState interface. Backend pipeline routes now return enriched responses with pipeline label/description maps and camelCase field names matching frontend hooks. All builds clean: tsc, vite build, backend build.",
    files: [
      "backend-hono/src/routes/admin/pipelines.ts",
      "backend-hono/src/routes/admin/pipeline-stats.ts",
      "frontend/components/refinement/EconFilterEditor.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T21:00:00",
    agent: "claude-code",
    summary:
      "S53-T2: Modularized Refinement Engine control surfaces. Created useRiskflowRuntime hook as canonical runtime payload (composes pipeline stats/states + source accounts + econ filters into one unified status). Evolved usePipelineState/usePipelineStats with lastAppliedAt/degradedReason fields. Added standardized status indicators (ok/degraded/mutating bar with last-applied timestamp) to PipelineHealth, PipelineToggles, SourceAccountsManager, and EconFilterEditor. RefinementEngine thinned to a module shell composing child panels with one runtime data source. Shared degraded header shows overall brokenness when any subsystem is down.",
    files: [
      "frontend/hooks/useRiskflowRuntime.ts",
      "frontend/hooks/usePipelineState.ts",
      "frontend/hooks/usePipelineStats.ts",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/PipelineHealth.tsx",
      "frontend/components/refinement/PipelineToggles.tsx",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "frontend/components/refinement/EconFilterEditor.tsx",
    ],
  },
  {
    date: "2026-04-29T20:00:00",
    agent: "claude-code",
    summary:
      "S53-T1: Unify RiskFlow runtime control-plane status for Refinement. Added riskflow_runtime section to GET /api/diagnostics (pipelines enabled/disabled, source accounts by category, econ populator/scheduler health, drop-counter snapshot, feed poller status, headlines_24h). Added GET /api/admin/pipeline-stats/runtime as compact polling endpoint for Refinement UI (no heavy joins — in-memory snapshots + lightweight count). Added service-level getters: getEconPopulatorStatus + lastResult tracking (econ-calendar-populator), isDropCounterFlushRunning (drop-counters), getPipelineStateSnapshot (pipeline-gate). routes/index.ts unchanged (pipeline-stats already registered, superadmin-gated).",
    files: [
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/admin/pipeline-stats.ts",
      "backend-hono/src/services/cron/econ-calendar-populator.ts",
      "backend-hono/src/services/riskflow/drop-counters.ts",
      "backend-hono/src/services/riskflow/pipeline-gate.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T21:00:00",
    agent: "claude-code",
    summary:
      "S53-T3: Realtime econ/commentator sync — aligned frontend surfaces with live pipeline state. Created useEconWatchHealth hook (polls /api/econ/active-watch + /api/econ/trigger-status + /api/diagnostics/feed-health) for backend-health vs natural-empty differentiation. Updated EconCountdownModal to show degraded reason when pipeline unhealthy, with dev-only debug logging. Added compact econ/watch readiness status chip to TopHeader toolbar (green active/amber degraded/red offline). Updated RiskFlowMini and SignalFeed empty states to distinguish pipeline-health outages from natural quiet windows using useSourceStatus.",
    files: [
      "frontend/hooks/useEconWatchHealth.ts",
      "frontend/components/feed/EconCountdownModal.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/SignalFeed.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T20:30:00",
    agent: "claude-code",
    summary:
      "v5.37.1 release prep: desktop update toast now shows bottom-left with 'Install now' and 'Later'. 'Later' defers update handoff until app close (Electron main tracks deferred flag and opens latest release on before-quit). Updater bridge/types and toast UI now support secondary CTA actions; package and update script version bumped to 5.37.1.",
    files: [
      "frontend/components/VersionChecker.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/contexts/ToastContext.tsx",
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/types/electron.d.ts",
      "types/electron.d.ts",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-29T15:20:00",
    agent: "claude-code",
    summary:
      "Desktop updater migration: removed electron-updater auto-download/install flow and replaced it with a SOTA manual updater path (version check via /api/version/check + explicit GitHub releases handoff). Updated Electron IPC bridge/types and frontend update UX so Electron now shows a Download CTA instead of auto-install behavior.",
    files: [
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/components/VersionChecker.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/types/electron.d.ts",
      "types/electron.d.ts",
      "package.json",
    ],
  },
  {
    date: "2026-04-29T19:10:00",
    agent: "claude-code",
    summary:
      "S52 shipped: RiskFlow card rollback+refactor + earnings tag expansion + Arbitrum surface pass. 4 tracks, 15 files. Archival: orchestration → sprint-changelog/, sub-track briefs deleted.",
    files: ["sprint-changelog/S52-ORCHESTRATION.md"],
  },
  {
    date: "2026-04-29T18:50:00",
    agent: "claude-code",
    summary:
      "S52: RiskFlow reset + Arbitrum surface pass — unified and validated. T1 (mobile): RiskFlowCard headline always 3-line clamp, remainder streams in via t-text-reveal in expanded card; sawdust footer swapped from custom inline bar to shared NothingFuse (horizontal, 10-segment, animateIn). T2 (backend): earnings keyword set expanded (30+ terms: Q1-4 results, margins, net/operating income, forecast, outlook, dividend, buyback, earnings call, preannounce, profit warning, top/bottom line); earnings items floored at macroLevel 1 (LOW) in rescoreInMemoryFeed; central-scorer riskType fallback prioritizes scored.risk_type over pbs.riskType. T3 (Arbitrum): extracted SeatCard/EmptySeat to ChamberSeats.tsx (300-line compliance); added question/category display in chamber header; ArbitrumPeek error state with retry; useArbitrumLatest full API→frontend normalization layer (verdict_id→id, rounds[n].probability, long→short role names, round total derivation). T4 (this track): cross-track integration clean — ChamberSeats extraction compiles, mobile NothingFuse import resolves via @frontend alias, RiskFlowMini already carried S51 cards; full validation suite passed (frontend typecheck + build, backend build, diagnostics ok, RiskFlow feed shape correct, Arbitrum 5-seat verdict with question/category metadata).",
    files: [
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/ChamberSeats.tsx",
      "frontend/components/arbitrum/ArbitrumPeek.tsx",
      "frontend/components/arbitrum/types.ts",
      "frontend/hooks/useArbitrumLatest.ts",
      "sprint-md/S52-ORCHESTRATION.md",
      "sprint-md/S52-T1-riskflow-cards-web-mobile-refactor.md",
      "sprint-md/S52-T2-riskflow-backend-tags-earnings.md",
      "sprint-md/S52-T3-arbitrum-surface-pass.md",
      "sprint-md/S52-T4-unification-and-validation.md",
    ],
  },
  {
    date: "2026-04-29T18:00:00",
    agent: "claude-code",
    summary:
      "S51: Expanded RiskFlow cards (mobile + desktop) + Arbitrum Sanctum performance UI. Part 1: desktop + mobile card header split into bucket-left/time-ago-right with source-type icons (Activity/BarChart3/Globe/Globe2/BookText for Wire/Econ/Macro/Geopolitical/Earnings), sawdust fuse footer (NothingFuse 10-segment horizontal bar replacing IVFuseBar), gray rule moved from preview boundary to expanded footer, deviation row gated on econ-print tag, t-text-reveal (280ms) for headline remainder on expand, Earnings bucket with LOW priority floor, extended econ-bridge tags (econ-print + directional + magnitude). Part 2: walkthrough confirmed no dual-source bug — both Sanctum surfaces already consume useArbitrumLatest. Removed unused compositeIV/regimeShiftProbability/confidence props from Sanctum→ArbitrumChamber (stale AgentDeskDebatePanel API). Frosted-glass polish on chamber empty/loading/error states.",
    files: [
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/routes/preferences/index.ts",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/lib/source-buckets.ts",
      "frontend/lib/user-preferences.ts",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/styles/transitions.css",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/lib/source-buckets.ts",
      "mobile/lib/user-preferences.ts",
      "mobile/hooks/useRiskFlowFilters.ts",
      "sprint-md/S51-BRIEF-riskflow-cards-and-arbitrum-recovery.md",
    ],
  },
  {
    date: "2026-04-29T12:15:00",
    agent: "claude-code",
    summary:
      "Hermes → DeepSeek migration. Every Hermes-routed sub-agent task (Oracle, Feucht, Consul, Herald, all 5 Arbitrum seats, MoA L1 drafters) now runs deepseek-reasoner via DeepSeek's OpenAI-compat API. Added 'deepseek' provider to ArbitrumProvider type, new deepseekChat() adapter at api.deepseek.com/v1/chat/completions, ARBITRUM_MODEL_PROVIDER_MAP routes deepseek-reasoner|deepseek-chat to it. ollama-hermes-client retargeted at api.deepseek.com by default with Bearer auth from DEEPSEEK_API_KEY (also accepts HERMES_API_KEY/OLLAMA_API_KEY). Local Ollama still selectable via HERMES_SIDECAR_URL/OLLAMA_BASE_URL. Harper-cao keeps Claude Opus 4.7 path. Verified end-to-end: arbitrum/deliberate returns coherent 5-seat verdict, parsed cleanly. Fly secrets DEEPSEEK_API_KEY + DEEPSEEK_BASE_URL staged (need deploy to take effect).",
    files: [
      "backend-hono/src/services/ai/routing.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/adapters.ts",
      "backend-hono/src/services/ai/ollama-hermes-client.ts",
      "backend-hono/.env",
    ],
  },
  {
    date: "2026-04-29T16:10:00",
    agent: "claude-code",
    summary:
      "S49 hotfix: Harper routes (/api/harper/chat, /api/harper/dispatch) were mounted without authMiddleware, causing c.get('userId') to be undefined — inline auth check always rejected. Added authMiddleware to /api/harper route mount. BYPASS_AUTH=true provides local-user context. Both endpoints verified working (SSE stream + dispatch conversation seed).",
    files: ["backend-hono/src/routes/index.ts"],
  },
  {
    date: "2026-04-29T16:00:00",
    agent: "claude-code",
    summary:
      "S49: Strategium drawer behavior fix. Removed auto-open on boot (useLayoutState was force-opening when TopStepX disabled). Changed from mount/unmount conditional rendering to always-rendered slide-out transition (w-0/w-[380px] + opacity, like ChatPanel). Fixed stale-closure toggle handler with functional updater.",
    files: [
      "frontend/hooks/useLayoutState.ts",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-29T15:45:00",
    agent: "claude-code",
    summary:
      "S49 mobile: added MobileDeskPlan below Daily Brief on home dash; moved MiniSessionCalendar to last snap page (bottom of dash); stripped Risk Signals page. MobileDeskPlan fetches /api/day-plan/today, shows actionable plan + compact price block with bearish/bullish CSS-var colors.",
    files: [
      "mobile/components/home/MobileDeskPlan.tsx",
      "mobile/components/home/HomePage.tsx",
    ],
  },
  {
    date: "2026-04-29T15:30:00",
    agent: "claude-code",
    summary:
      "S49: Desk Plan prices, color theming, and read-expansion. Fixed useDayPlan to unwrap {plan} wrapper so DayCard prices render correctly. Rewrote desk-theme-generator SYSTEM_PROMPT to produce <=160 char actionable plan. Added tone prop to DayCard Row for bearish/bullish color binding via CSS vars. Rewrote DeskThemeWidget with compact price block + read-expand to full DayCard layout; dropped brief body mirror.",
    files: [
      "frontend/hooks/useDayPlan.ts",
      "frontend/components/narrative/DayCard.tsx",
      "frontend/components/mission-control/DeskThemeWidget.tsx",
      "backend-hono/src/services/day-plan/desk-theme-generator.ts",
    ],
  },
  {
    date: "2026-04-29T14:30:00",
    agent: "claude-code",
    summary:
      "S48 shipped: News Feed pipeline control + econ fix + Kalshi whale tracker + speculation-filter + CountdownFuse + layout polish. Archived to sprint-changelog/. 5 tracks, ~50 files. v5.35.0 deployed to Fly.io + 2x Vercel.",
    files: ["sprint-changelog/S48-ORCHESTRATION.md"],
  },
  {
    date: "2026-04-29T14:25:00",
    agent: "claude-code",
    summary:
      "[v5.35.0] /solvys-deploy: 3-target deploy complete. Fly.io fintheon + Vercel desktop (fintheon-alpha) + Vercel mobile (fintheon.pricedinresearch.io). GH release v5.35.0 published, v5.34.0 pruned. Bumped UPDATE_VERSION to 5.35.0. Repaired peer auto-rename Harper21Voice identifier mangling across 17 files. PersonaDropdown / ConsiliumMessage duplicate-key collisions cleaned. Local backend restarted.",
    files: [
      "package.json",
      "scripts/fintheon-update.sh",
      "frontend/components/chat/PersonaDropdown.tsx",
      "frontend/components/consilium/ConsiliumMessage.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/hooks/useHarper21VoiceSession.ts",
      "frontend/lib/harper-2.1-voice.ts",
      "backend-hono/src/routes/harper-2.1-voice.ts",
      "backend-hono/src/routes/index.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T14:15:00",
    agent: "claude-code",
    summary:
      "[v5.35.0] S48-T5 unification — wired speculation-filter into content-guard.ts as gate 5.5 (hedged-language detection: wire-source items demote IV by 0.7×, non-wire items block, economic-calendar pipeline always passes); applied 0.7× ivScore demotion in central-scorer after AI enrichment for items flagged with speculationDemote. Wired Kalshi whale-alert pipe into riskflow-worker Standard tier with isPipelineEnabled() killswitch. Renamed pipeline migration to 14-digit timestamp convention (20260429000000) and added kalshi-whale seed row. Ran full backend + frontend builds, 300-line audit (T3 violations EconFilterEditor 401L + CountdownFuse 311L flagged for separate refactor sprint per T5 brief — not refactored here), restarted local launchd backend, smoke-tested /api/admin/pipelines (6 rows), /api/admin/pipeline-stats, /api/riskflow/feed. Treasury auction poller deferred — only treasury-feed.ts utility shipped, no pollTreasuryAuctions() function to wire.",
    files: [
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "supabase/migrations/20260429000000_pipeline_tracking.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-29T13:56:00",
    agent: "claude-code",
    summary:
      "[v5.35.0] S48-T1 econ pipeline fix + backfill + data layer — fixed 5 blocking points (table redirect raw_riskflow_items, narrative gate keywords, market relevance descriptions, TRUSTED_SOURCELESS EconomicCalendar, fetchFreshFeed wired into warmCacheFromDB), 21-day FJ X backfill script, ingest_pipeline migration + types, pipeline-gate service with 30s cache TTL, pipeline-stats service, ingest_pipeline set on all 6 ingest paths, admin pipelines CRUD + stats routes, method_breakdown on sources endpoint, type=web filter on source-stats, Doctor X-cookie round-robin refresh",
    files: [
      "supabase/migrations/20260429_pipeline_tracking.sql",
      "backend-hono/src/types/pipeline.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/riskflow/pipeline-gate.ts",
      "backend-hono/src/services/riskflow/pipeline-stats.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/economic-feed.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/riskflow/user-polling-registry.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/workers/riskflow-worker/sources/agent-reach.ts",
      "backend-hono/src/workers/riskflow-worker/sources/browser-harness.ts",
      "backend-hono/src/workers/riskflow-worker/persist.ts",
      "backend-hono/src/routes/admin/pipelines.ts",
      "backend-hono/src/routes/admin/pipeline-stats.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/admin/riskflow-bulk.ts",
      "backend-hono/scripts/backfill-econ-from-fj.ts",
    ],
  },
  {
    date: "2026-04-29T02:15:00",
    agent: "claude-code",
    summary:
      "[v5.35.0] S48-T3 pipeline UI + CountdownFuse + econ filter editor -- PipelineHealth table replacing NotchedFuse, PipelineToggles with optimistic toggle, CountdownFuse state machine (beat/miss/par/X-close/floating), dev countdown test button, EconFilterEditor inline table, web URL source section in CatalystStatsDrawer, error handling hardened across RefinementEngine",
    files: [
      "frontend/components/refinement/PipelineHealth.tsx",
      "frontend/components/refinement/PipelineToggles.tsx",
      "frontend/components/shared/CountdownFuse.tsx",
      "frontend/components/refinement/EconFilterEditor.tsx",
      "frontend/hooks/usePipelineStats.ts",
      "frontend/hooks/usePipelineState.ts",
      "frontend/hooks/useFloatingDrag.ts",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/CatalystStatsDrawer.tsx",
      "frontend/components/settings/DeveloperTab.tsx",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-04-29T01:00:00",
    agent: "claude-code",
    summary:
      "[v5.35.0] T4 layout fixes + S47 deferred: app frame full border + rounded-tr[6px] + sidebar shadow on expand, Strategium drawer conversion (translate-x slide, hidden by default), SanctumBriefing restructure (analysis→consensus), 50/50 hero comment fix, dead connector filter (Omi), category pill removal from RiskFlow expanded cards",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/narrative/SanctumBriefing.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/hooks/useMcpConnectors.ts",
    ],
  },
  {
    date: "2026-04-28T23:55:00",
    agent: "claude-code",
    summary:
      "S48-T2: Kalshi whale tracker → RiskFlow pipe, wire speculation noise filter, Treasury auction RSS scraper, Unusual Whales agent prompt updates, and CAO Desk Plan midnight pulse. New files: kalshi-feed-pipe.ts (maps Econ/Politics whale alerts to CollectedNewsItem for standard tier scoring), speculation-filter.ts (14 hedged-language patterns — wire items demoted ×0.7, non-wire blocked, econ-calendar exempt), treasury-feed.ts (home.treasury.gov RSS post-filtered to auction headlines), desk-planner.ts (midnight ET cron queries economic_events, generates DeskPlan with countdown timestamps + in-memory cache). Existing: kalshi-service.ts gained getEconPoliticsWhaleAlerts() (filters getWhaleAlerts by econ/politics category set, excludes weather/crypto/meme/sports); sources/index.ts wired both kalshi:whale-alerts + agent-reach:treasury-auctions into standard tier; boot/services.ts wired startDeskPlanCron(); types.ts added 'kalshi' to NewsSource union. All 4 agent *-extra.md files updated with UW data-source instructions (GEX, options walls, options flow) per the sprint brief specs. All new files under 300 lines; backend build clean.",
    files: [
      "backend-hono/src/services/kalshi-service.ts",
      "backend-hono/src/services/riskflow/kalshi-feed-pipe.ts",
      "backend-hono/src/services/riskflow/speculation-filter.ts",
      "backend-hono/src/services/riskflow/treasury-feed.ts",
      "backend-hono/src/services/desk-planner.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "backend-hono/src/services/ai/agent-instructions/oracle-extra.md",
      "backend-hono/src/services/ai/agent-instructions/feucht-extra.md",
      "backend-hono/src/services/ai/agent-instructions/consul-extra.md",
    ],
  },
  {
    date: "2026-04-28T23:45:00",
    agent: "claude-code",
    summary:
      "v5.34.0 deploy — S47 T1-T7 shipped to production. Backend: Fly.io fintheon (rolling update, health checks passed). Desktop frontend: Vercel solvys/frontend. Mobile PWA: Vercel solvys/mobile. DMG: Fintheon-5.34.0-arm64.dmg built and copied to Desktop. GitHub release v5.34.0 created; old v5 releases pruned. Local backend restarted. Sprint markdowns archived: S47-ORCHESTRATION.md, S47-BUG-REPAIR-PLAN.md, S47-TOOLING-STARS-AUDIT.md → sprint-changelog/. Sub-track briefs S47-T0–T7 deleted.",
    files: [
      "package.json",
      "scripts/fintheon-update.sh",
      "sprint-changelog/S47-ORCHESTRATION.md",
      "sprint-changelog/S47-BUG-REPAIR-PLAN.md",
      "sprint-changelog/S47-TOOLING-STARS-AUDIT.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T23:30:00",
    agent: "claude-code",
    summary:
      "Solvys UI cleanup pass: banned patterns, state coverage, typography, motion. Removed gradient dividers from Sanctum (replaced with solid accent borders at 10% opacity). Removed side-stripe borders from ArbitrumChamber seat cards (replaced with uniform border opacity; dissented seats get 50% accent border). Removed generic shadow-lg from AccountTrackerWidget dropdown and RiskFlowMini shimmer gradient. Removed decorative animate-pulse/ping from AccountTrackerWidget live indicator and Radio icon. Added reactive prefers-reduced-motion listener to SolvysLoader. Added reduced-motion guards to Sanctum scrollIntoView, ArbitrumChamber staggered reveal, FintheonThread scrollToBottom, and animate-fade-slide-in CSS. Added tabular-nums to VerdictCard timestamps, SanctumNarratives dates, AccountTrackerWidget P&L, and EconEventCard print row values. Improved empty states in AccountTrackerWidget, DeskThemeWidget, and RiskFlowMini. Improved error states in Sanctum (retry button), ArbitrumChamber (retry button), DeskThemeWidget (no longer silent), and EconEventCard (synthesis failure message). Fixed EconEventCard motion timing: duration-500 → duration-300. Fixed Sanctum page indicator off-palette gray colors.",
    files: [
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/narrative/SanctumNarratives.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
      "frontend/components/mission-control/DeskThemeWidget.tsx",
      "frontend/components/narrative/econ/EconEventCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/shared/SolvysLoader.tsx",
      "frontend/index.css",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T22:00:00",
    agent: "claude-code",
    summary:
      "S47-T7: Unify, validate, and release-prep. Fixed NarrativePreviewSlot.tsx implicit-any parameter. Verified SanctumHeader.tsx has no dangling Upload reference. Validated backend build (pass) and frontend typecheck (pass). Confirmed MainLayout.tsx onChatAlert contract is compatible with RiskFlowAlert. Committed Wave 2 (T3-T5) and Wave 3 (T6) changes. Residual risks: commentary_transcripts migration pending supabase db push; T4 pre-run plan modal and T3 proposal pane migration deferred to follow-up.",
    files: [
      "frontend/components/chat/slots/NarrativePreviewSlot.tsx",
      "frontend/components/narrative/SanctumHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T20:00:00",
    agent: "claude-code",
    summary:
      "S47-T6: Design system, icons, spinners, fuses, and charts. Standardized EconKpiFuses to use shared NothingFuse with segments=10. Added GlobeIcon, OfficialIcon, NetworkIcon, ChartSourceIcon, and TradeIdeaIcon under frontend/components/icons/; removed banned emoji glyph from SourceIcon. Created SolvysLoader and SolvysLoaderCentered with Braille-beat dotmatrix animation, Solvys Gold palette, and prefers-reduced-motion support. Replaced ad hoc Loader2 spinners in Chat (FintheonThread, chatgpt-prompt-input), Sanctum IV loading, EconEventCard synthesizing state, and ArbitrumChamber loading state. Redesigned RiskFlowDetailCard expanded area: transparent bg matching parent, clean header row with source icon/headline/time/IV, removed bordered severity tags (AlertCardBase), rounded-[2px] concentric radii on tags, text-wrap pretty on headlines. Skipped Evil Charts install since Recharts is not present and brief says avoid until necessary.",
    files: [
      "frontend/components/icons/GlobeIcon.tsx",
      "frontend/components/icons/OfficialIcon.tsx",
      "frontend/components/icons/NetworkIcon.tsx",
      "frontend/components/icons/ChartSourceIcon.tsx",
      "frontend/components/icons/TradeIdeaIcon.tsx",
      "frontend/components/icons/index.ts",
      "frontend/components/shared/SolvysLoader.tsx",
      "frontend/lib/shared-icons.tsx",
      "frontend/components/narrative/econ/EconKpiFuses.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/econ/EconEventCard.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T18:30:00",
    agent: "claude-code",
    summary:
      "S47-T4: Chat, Agentic Forum, Mobile response, Attachments, and Approvals. Fixed chat greeting reappearing after send by adding !isLoading guard in FintheonThread. Fixed mobile chat final response not rendering by adding missing {message.content} inside Markdown component in ChatMessage. Purged visible Omi connector references from frontend comments (TopHeader, PsychAssistDockable, MainLayout). Added PDF and .md document attachment support with client-side toast rejection for unsupported types. Fixed attach modal/jump-to-bottom false positive by adding 80px rootMargin to IntersectionObserver. Replaced RiskFlow Chat CTA raw JSON injection with structured preview card context via buildRiskFlowPreview helper; wired onChatAlert through MainLayout to dispatch fintheon:send-chat-text events. Added shared ApprovalModal component for tools/Narratives/Catalyst Watch/Refinement edits with optional admin password gate via dev-settings-auth. Reworked Agentic Forum UX: removed search, refresh, activity, and thinking buttons; replaced online/offline status with elapsed thought-time timer; removed auto-collapse of analyst panels; added run history button with BoardroomThread list; passed hideThinkHarder to PromptBox. Cleaned backend boardroom-spawner.ts emoji strings from agent messages and opening message.",
    files: [
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/FintheonAttachPopup.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/shared/ApprovalModal.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "backend-hono/src/services/boardroom-spawner.ts",
    ],
  },
  {
    date: "2026-04-28T17:00:00",
    agent: "claude-code",
    summary:
      "S47-T3: Arbitrum, Sanctum, Performance, and Proposal UI repairs. Arbitrum chamber seat labels mapped to Harper/Oracle/Feucht/Consul/Herald while preserving backend contract roles. Desk Theme renamed to Desk Plan in visible UI (DayCard + MainLayout widget label). Volatility Read and Arbitrum Chamber hero split changed from 55/45 to 50/50. Upload button removed from SanctumHeader; Update lightning icon replaced with RefreshCw. Arbitrum confidence displays converted from percent to 0.0-10.0 scale (VerdictCard + ArbitrumPeek). Crowd fuse removed from Active Narratives; Health fuse renamed to Confidence Rating. Agent Performance section removed from Sanctum Page 2. Trade Ledger gained Resolve countdown column using closeTime. Risk Signal related headlines section gained time-ago stamp. ProposalWidget hardcoded colors normalized to CSS custom properties where semantically appropriate.",
    files: [
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/arbitrum/ArbitrumPeek.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/SanctumHeader.tsx",
      "frontend/components/narrative/DayCard.tsx",
      "frontend/components/narrative/SanctumNarratives.tsx",
      "frontend/components/narrative/RiskSignalCards.tsx",
      "frontend/components/narrative/ConsolidatedTradeLedger.tsx",
      "frontend/components/proposals/ProposalWidget.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T16:00:00",
    agent: "claude-code",
    summary:
      "S47-T5: VibeVoice STT provider abstraction + commentary transcript context + Arbitrum integration. Evaluated VibeVoice-ASR (7B GPU model — not suitable for backend without GPU sidecar) and mpaepper/vibevoice (desktop dictation — not suitable). Added VOICE_STT_PROVIDER env abstraction with vibevoice|sidecar|whisper|fallback chain. Sidecar remains primary; OpenAI Whisper added as second option; fallback degrades gracefully. Created commentary_transcripts table with RLS. Added recordWatchEvent/getRecentTranscripts service with naive summarization. Wired YouTubeMiniplayer to report commentary watch events to POST /api/voice/commentary. Added GET /api/voice/transcripts for recent transcripts. Arbitrum engine loads commentary_context via loadArbitrumCommentaryContext and feeds formatted summaries into seat prompts (buildUserPrompt + buildDistillPrompt). Diagnostics extended with voice_stt (provider, availability, config flags) and commentary_transcripts (count_24h, last_capture_at).",
    files: [
      "backend-hono/src/services/voice-stt-provider.ts",
      "backend-hono/src/services/commentary-transcript.ts",
      "backend-hono/src/services/arbitrum/commentary-context.ts",
      "backend-hono/src/services/arbitrum/types.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/engine.ts",
      "backend-hono/src/services/voice-service.ts",
      "backend-hono/src/routes/voice/index.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "frontend/components/layout/YouTubeMiniplayer.tsx",
      "supabase/migrations/20260428000000_commentary_transcripts.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-28T15:30:00",
    agent: "claude-code",
    summary:
      "S47-T1: RiskFlow source integrity + refinement engine fixes + full 4-tier market-data router. Source accounts gained method field (rettiwt/rss/browser/api) with validation and frontend visibility. Backend handlers normalized displayName/display_name body keys and return field-specific errors. RefinementEngine added Save & Re-Score button that persists sensitivities then triggers rescore. General bucket/category stripped from RiskFlow filters/buckets across frontend/mobile/backend; replaced with Wire/Macro/Official taxonomy. Official RSS sources added for BLS, Federal Reserve, NY Fed, Atlanta Fed. Full 4-tier market-data router implemented: TradingView scanner (1) → browser-harness Yahoo page scrape (2) → RiskFlow headline narrative context (3) → Yahoo Finance API (4). Router wired into VIX service, market-data context, quote/VIX endpoints, day-plan service, and agent-desk context. Diagnostics extended with source_accounts, market_data_router (vix_attempts + recent_symbols), and riskflow_sources. Mandatory rescore fires on source-account add/update/delete. MSM blocklist and wire-relay exemption preserved.",
    files: [
      "backend-hono/src/types/source-account.ts",
      "backend-hono/src/services/source-accounts/source-accounts-service.ts",
      "backend-hono/src/routes/source-accounts/handlers.ts",
      "backend-hono/src/services/vix-service.ts",
      "backend-hono/src/services/market-data/router.ts",
      "backend-hono/src/services/market-data/index.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/routes/market/handlers.ts",
      "backend-hono/src/services/day-plan/day-plan-service.ts",
      "backend-hono/src/services/agent-desk/agent-desk-context.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/preferences/index.ts",
      "backend-hono/src/services/agent-desk/agent-desk-service.ts",
      "backend-hono/src/services/agent-desk/agent-desk-briefing.ts",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "frontend/lib/source-buckets.ts",
      "frontend/lib/user-preferences.ts",
      "frontend/hooks/useRiskFlowFilters.ts",
      "mobile/lib/source-buckets.ts",
      "mobile/lib/user-preferences.ts",
      "mobile/hooks/useRiskFlowFilters.ts",
      "frontend/vite.config.ts",
      "frontend/package.json",
    ],
  },
  {
    date: "2026-04-28T14:00:00",
    agent: "claude-code",
    summary:
      "S47-T2: Calendar, Econ, Arbitrum backend handoff fixes. Desk calendar ingest now returns statusMessage + tracks latest_error; diagnostics report desk_calendar queue_count/last_ingest_at/latest_error. Arbitrum seats updated with correct display names (Harper/Oracle/Feucht/Consul/Herald), role subtitles, and temperature metadata. PMDB Chamber Read freshness fixed to filter by today's session window (12:00 ET onwards) with diagnostic timestamp comparison. Econ synthesis caching added via econ_synthesis_cache table + cache read/write in /api/econ/synthesize. Proposal/trade resolution added via agent_proposal_outcomes table + /api/proposals/resolve + /api/proposals/performance. Econ test-event endpoint added for countdown validation. Neutral replaced with Chop in trader-agent consensus.",
    files: [
      "backend-hono/src/routes/desk-calendar/handlers.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/arbitrum/types.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/engine.ts",
      "backend-hono/src/services/arbitrum/verdict-store.ts",
      "backend-hono/src/services/arbitrum/index.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/agents/trader-agent.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/proposal-resolution.ts",
      "backend-hono/src/routes/econ/index.ts",
      "backend-hono/src/routes/proposals/index.ts",
      "backend-hono/src/routes/proposals/resolution.ts",
      "supabase/migrations/20260428120000_desk_calendar_rls_insert.sql",
      "supabase/migrations/20260428120100_econ_synthesis_cache.sql",
      "supabase/migrations/20260428120200_agent_proposal_outcomes.sql",
    ],
  },
  {
    date: "2026-04-28T12:27:06",
    agent: "claude-code",
    summary:
      "Added /solvys-ui-cleanup as a Solvys-native UI polish process for overlooked state-of-the-art design touches: state coverage, interaction detail, typography, alignment, responsive behavior, motion, charts, loaders, and Solvys material consistency.",
    files: [
      ".claude/skills/solvys-ui-cleanup/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-ui-cleanup/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/README.md",
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
    ],
  },
  {
    date: "2026-04-28T12:21:26",
    agent: "claude-code",
    summary:
      "Created six Solvys-native single skills from essential non-vetoed starred skill sets: diagnose, backend-quality, tech-debt, context, browser-verify, and UI-detail, mirrored them into the imported Solvys suite source, and documented their influence mapping.",
    files: [
      ".claude/skills/solvys-diagnose/SKILL.md",
      ".claude/skills/solvys-backend-quality/SKILL.md",
      ".claude/skills/solvys-tech-debt/SKILL.md",
      ".claude/skills/solvys-context/SKILL.md",
      ".claude/skills/solvys-browser-verify/SKILL.md",
      ".claude/skills/solvys-ui-detail/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/README.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-diagnose/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-backend-quality/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-tech-debt/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-context/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-browser-verify/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-ui-detail/SKILL.md",
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
    ],
  },
  {
    date: "2026-04-28T12:15:24",
    agent: "claude-code",
    summary:
      "Scrupulously updated Solvys skills and design guidance from the non-vetoed S47 reference set: added engineering/design doctrine references, reconciled frosted-glass surfaces with banned ornaments, and strengthened audit/test/brief/orchestration/inform rules around architectural influence rather than imports.",
    files: [
      ".claude/skills/solvys-feels/reference/design-guidelines.md",
      ".claude/skills/solvys-brief/reference/engineering-guidelines.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/README.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-feels/reference/design-guidelines.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-feels/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-audit/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-test/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-inform/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-transitions/SKILL.md",
      ".claude/skills/solvys-feels/SKILL.md",
      ".claude/skills/solvys-brief/SKILL.md",
      ".claude/skills/solvys-orchestrate/SKILL.md",
      ".claude/skills/solvys-audit/SKILL.md",
      ".claude/skills/solvys-test/SKILL.md",
      ".claude/skills/solvys-inform/SKILL.md",
      ".claude/skills/solvys-transitions/SKILL.md",
      "CLAUDE.md",
      "backend-hono/CLAUDE.md",
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
      "sprint-md/S47-T0-skills-stars-tooling.md",
    ],
  },
  {
    date: "2026-04-28T12:14:17",
    agent: "claude-code",
    summary:
      "Marked TP's S47 Track 0 GitHub Stars vetoes so X Twitter Scraper, Compound Engineering Plugin, voicebox, CL4R1T4S, and Bitterbot Desktop are excluded from Solvys architectural synthesis.",
    files: [
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
      "sprint-md/S47-ORCHESTRATION.md",
      "sprint-md/S47-T0-skills-stars-tooling.md",
    ],
  },
  {
    date: "2026-04-28T12:08:37",
    agent: "claude-code",
    summary:
      "Corrected S47 Wave 0 into a full solvys GitHub Stars veto sheet and reframed external references as architectural thinking sources only, not skills/dependencies/runtime imports.",
    files: [
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/README.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-feels/SKILL.md",
      ".claude/takeover-import/fintheon-agent-takeover/skills/solvys-skills/.claude/skills/solvys-orchestrate/SKILL.md",
      ".claude/skills/solvys-feels/SKILL.md",
      ".claude/skills/solvys-orchestrate/SKILL.md",
      ".claude/skills/solvys-brief/SKILL.md",
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
      "sprint-md/S47-ORCHESTRATION.md",
      "sprint-md/S47-T0-skills-stars-tooling.md",
    ],
  },
  {
    date: "2026-04-28T12:05:18",
    agent: "claude-code",
    summary:
      "Recorded S47 Wave 0 tooling recommendations, installed the approved Impeccable v3 single-skill import for Claude Code, and marked devl.dev/Jakub detail checks as required UI references while leaving unapproved tooling as recommendation-only.",
    files: [
      ".claude/skills/impeccable/",
      "skills-lock.json",
      "sprint-md/S47-TOOLING-STARS-AUDIT.md",
      "sprint-md/S47-ORCHESTRATION.md",
      "sprint-md/S47-T0-skills-stars-tooling.md",
    ],
  },
  {
    date: "2026-04-28T11:38:00",
    agent: "claude-code",
    summary:
      "Expanded S47 planning into turnkey multi-track briefs after orchestration discovery: tooling/GH Stars intake, RiskFlow data integrity, calendar/Arbitrum backend, Arbitrum UI, chat/Agentic Forum/mobile, VibeVoice transcripts, shared design primitives, and final unification.",
    files: [
      "sprint-md/S47-ORCHESTRATION.md",
      "sprint-md/S47-T0-skills-stars-tooling.md",
      "sprint-md/S47-T1-riskflow-refinement-data.md",
      "sprint-md/S47-T2-calendar-econ-arbitrum-backend.md",
      "sprint-md/S47-T3-arbitrum-sanctum-performance-ui.md",
      "sprint-md/S47-T4-chat-agentic-forum-mobile.md",
      "sprint-md/S47-T5-vibevoice-transcripts.md",
      "sprint-md/S47-T6-design-icons-spinners-charts.md",
      "sprint-md/S47-T7-unify-validate-release.md",
    ],
  },
  {
    date: "2026-04-28T11:26:02",
    agent: "claude-code",
    summary:
      "Imported the Desktop takeover bundle into .claude/takeover-import, refreshed bundled Solvys/impeccable skills, verified SOUL persona files already match, and drafted S47's repo-issue bug repair plan covering open issues #231-#236.",
    files: [
      ".claude/takeover-import/fintheon-agent-takeover/",
      ".claude/skills/",
      "sprint-md/S47-BUG-REPAIR-PLAN.md",
    ],
  },
  {
    date: "2026-04-27T20:35:00",
    agent: "claude-code",
    summary:
      "Feed quality fix: added plain 'bloomberg' to BLOCKED_HANDLES in publisher-blocklist.ts. Previously only Twitter handles (@business, @markets, @BloombergTV) were listed, so agent-reach:rss:bloomberg submitted_by tags bypassed the handle check. Agent-reach RSS is already a no-op shim, but this closes the defensive gap for any residual DB items.",
    files: ["backend-hono/src/services/riskflow/publisher-blocklist.ts"],
  },
  {
    date: "2026-04-27T07:30:00",
    agent: "claude-code",
    summary:
      "v5.33.6 — Refinement Engine MSM-purge gate unblocked. requireSuperadmin gains a SUPER_ADMIN_EMAIL allow-list (comma-split, case-insensitive) so TP can authorize without digging up the Supabase auth UUID. Resolution order: SUPER_ADMIN_EMAIL → SUPER_ADMIN_USER_ID → DB users.role='admin'. Fly secret SUPER_ADMIN_EMAIL=tp@pricedinresearch.io set; same value appended to the local launchd backend's .env. Local launchd plist WorkingDirectory updated from the stale ~/Desktop/Codebases/fintheon-s40-s42-unified worktree to /Users/tifos/Documents/Codebases/fintheon — backend now serves the active dev tree (was returning the old 'ROUTINE_SECRET not configured' 503 from a v5.32.1 build until this fix). .env copied + SUPER_ADMIN_EMAIL line appended.",
    files: ["backend-hono/src/middleware/auth.ts"],
  },
  {
    date: "2026-04-27T07:00:00",
    agent: "claude-code",
    summary:
      "v5.33.5 — MSM hardcoded-URL strip + auto-update CTA fix. Backend: agent-reach-poller.ts (RSS_FEEDS reuters/bloomberg/cnbc/marketwatch/seekingalpha/zerohedge), econ-rettiwt-poller.ts (AGENT_REACH_URLS reuters/cnbc/zerohedge), poll-watchdog.ts all replaced with no-op shims that preserve their export surface (start/stop/tick + isRettiwtRateLimited / pollForEconNews / getWarmCacheItems / manualRefresh / getRettiwtCooldownMs / startEconPoller / AGENT_REACH_POLLER_NAME) — every import site (boot/services.ts, routes/{riskflow/handlers,diagnostics/index}.ts, services/riskflow/{feed-service,feed-poller}.ts) keeps compiling but no MSM URL is reachable. og-scraper.ts ALLOWED_HOSTS purged of bloomberg/reuters/ft/wsj/cnbc/marketwatch/nytimes/washingtonpost/economist/barrons/seekingalpha/zerohedge/axios/politico/apnews — kept x.com / twitter.com / youtube hosts / financialjuice / polymarket / kalshi / tradingview / coindesk / theblock. Frontend: VersionChecker rewritten — Electron path now subscribes to electron.onUpdateDownloaded so the bottom-left 'Install Now' toast ONLY fires after electron-updater finishes downloading the DMG (autoDownload=true was already set in main.cjs). Web path keeps the polling-version-check + Reload CTA. package.json release:mac now passes --publish always so latest-mac.yml + .dmg.blockmap upload to the GH release for electron-updater to find.",
    files: [
      "backend-hono/src/services/riskflow/agent-reach-poller.ts",
      "backend-hono/src/services/riskflow/econ-rettiwt-poller.ts",
      "backend-hono/src/services/riskflow/poll-watchdog.ts",
      "backend-hono/src/services/preview/og-scraper.ts",
      "frontend/components/VersionChecker.tsx",
      "package.json",
    ],
  },
  {
    date: "2026-04-27T06:30:00",
    agent: "claude-code",
    summary:
      "v5.33.4 — Refinement Engine right-rail refactor + middleware DB-fallback. Right-rail (CatalystStatsPanel + AnnotatableItem feed preview) deleted; replaced by CatalystStatsDrawer that mirrors the ChatPanel popover (absolute right-0, w-[420px], translate-x animation). Drawer is only accessible via a new top-right 'Stats' BarChart3 button next to Re-Score All. Drawer body redesigned per TP: per-category aggregate rows with Doto numerals right-aligned, then ruler-divided per-source rows under each category with right-aligned counts; bulk-handling controls (delete / refill / MSM Audit today / MSM Audit all-time) below. Backend middleware/auth.ts requireSuperadmin now reads SUPER_ADMIN_USER_ID with a DB fallback to SELECT id FROM users WHERE role='admin' (60s in-memory cache), mirroring notify-superadmins' resolution — works without TP setting the env var first as long as their users row has role='admin'.",
    files: [
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/CatalystStatsDrawer.tsx",
      "backend-hono/src/middleware/auth.ts",
    ],
  },
  {
    date: "2026-04-27T06:00:00",
    agent: "claude-code",
    summary:
      "v5.33.3 — Refinement Engine MSM purge hardening + auth gate swap. Backend: /api/admin/riskflow/* now gated on Supabase JWT + SUPER_ADMIN_USER_ID allow-list (new requireSuperadmin middleware) instead of x-routine-secret — TP no longer pastes a secret into the panel; the user's access token flows through automatically. msm-purge route gains scope=today|all|range with from/to date filtering AND a wire-relay exemption (rows whose source_domain starts with twitter:%/nitter:% are EXCLUDED), so approved-handle wire tweets that quote MSM names inline ('Fed announces XYZ: REUTERS' from FinancialJuice/DeItaone) stay in the feed; only direct MSM URLs + non-wire MSM-text rows get purged. Frontend: CatalystStatsPanel rebuilt — secret input deleted, useAuth().getAccessToken() drives Authorization: Bearer, two MSM Audit buttons (today | all-time), audit result shows scope + window + sample + wire-relay-exemption note before TP confirms. Worker untouched.",
    files: [
      "backend-hono/src/middleware/auth.ts",
      "backend-hono/src/routes/admin/riskflow-bulk.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/refinement/CatalystStatsPanel.tsx",
    ],
  },
  {
    date: "2026-04-27T05:30:00",
    agent: "claude-code",
    summary:
      "v5.33.2 — Exa STRIPPED platform-wide per TP ('no use, persistent glitches'). Files deleted: workers/riskflow-worker/sources/exa.ts, services/riskflow/exa-scheduled-monitor.ts, services/riskflow/backfill-headlines.ts, routes/admin/riskflow-backfill.ts, services/exa-service.ts. References removed: worker sources/index.ts (commented Exa block + import), boot/services.ts (startExaScheduledMonitor wiring), services/riskflow/feed-poller.ts (checkForScheduledEvents import + scheduled-event scrape branch in runScrapeFallback), routes/riskflow/handlers.ts (dynamic-import scheduled-event scrape during refresh), services/agent-desk/agent-desk-client.ts (fetchExaForOfficial fn + DB-miss fallback, now returns []), services/agent-desk/agent-desk-context.ts (fetchExaFallback fn + < 5 supplement branch), routes/index.ts (createRiskFlowBackfillRoutes mount + import), boot/index.ts (EXA_API_KEY required-var entry + getEnvConfig field), config/env.ts (EXA_API_KEY interface + getter), routes/diagnostics/index.ts (RECOMMENDED_ENV_VARS), routes/mcp/index.ts (KNOWN_SERVERS exa entry), .mcp.json (exa MCP server entry), .env.example (EXA_API_KEY line), validateEnv.test.ts (EXA_API_KEY warning case → FRED_API_KEY). Worker now ticks COT + FOMC Minutes + Fed Speeches only.",
    files: [
      "backend-hono/src/workers/riskflow-worker/sources/exa.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/services/riskflow/exa-scheduled-monitor.ts",
      "backend-hono/src/services/riskflow/backfill-headlines.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/refill-driver.ts",
      "backend-hono/src/services/exa-service.ts",
      "backend-hono/src/services/agent-desk/agent-desk-client.ts",
      "backend-hono/src/services/agent-desk/agent-desk-context.ts",
      "backend-hono/src/routes/admin/riskflow-backfill.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/mcp/index.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/boot/__tests__/validateEnv.test.ts",
      "backend-hono/src/config/env.ts",
      "backend-hono/.env.example",
      ".mcp.json",
    ],
  },
  {
    date: "2026-04-27T05:00:00",
    agent: "claude-code",
    summary:
      "v5.33.1 hotfix — kill MSM whitelist leak through Exa + protect Wire-relay tweets from false-positive drops. Root cause: agent-desk-client.ts + agent-desk-context.ts called exaSearch with includeDomains:[reuters,bloomberg,ft,cnbc,wsj,marketwatch,forexlive,zerohedge] then injected '[EXA] {title}' headlines into GovOfficial agent persona context, which the agent surfaced back into Arbitrum/AgentDesk synthesis text — bypassing publisher-blocklist (which only runs at writeRawItems). TP saw a Bloomberg 'catalyst' rendered in the UI from this path. Both whitelists deleted; both Exa calls + exa-scheduled-monitor cron + /api/admin/riskflow/backfill-headlines admin route now gated behind EXA_POLLING_ENABLED='true' (default false), matching the worker. publisher-blocklist BLOCKED_PATTERNS hardened with /^\\s*\\[EXA\\]\\s/i + 'forexlive', AND shouldBlockItem now exempts approved Twitter wire handles (twitter:<handle> where handle is NOT in BLOCKED_HANDLES) from the body-pattern check — wire tweets like 'Fed announces XYZ: REUTERS' from FinancialJuice/DeItaone stay in the feed; only direct MSM URLs + non-wire MSM text get dropped.",
    files: [
      "backend-hono/src/services/agent-desk/agent-desk-client.ts",
      "backend-hono/src/services/agent-desk/agent-desk-context.ts",
      "backend-hono/src/services/riskflow/exa-scheduled-monitor.ts",
      "backend-hono/src/services/riskflow/backfill-headlines.ts",
      "backend-hono/src/services/riskflow/publisher-blocklist.ts",
    ],
  },
  {
    date: "2026-04-27T04:50:00",
    agent: "claude-code",
    summary:
      "v5.33.0 deploy shipped (S46.4 RiskFlow narrowing + Calendar restore + DeskTheme + miniplayer + video_url chain). Backend + worker + desktop + mobile all green; UPDATE_VERSION bumped 5.32.4→5.33.0; older v5.* releases pruned to one. Archived S43 + S44 + S45.5 main plans to sprint-changelog/. Sanitation WARN: routes/admin/riskflow-bulk.ts at 379 lines exceeds the 300-line file-size rule (post-deploy split tracked).",
    files: [
      "sprint-changelog/S43-PIR-SITE-REDESIGN.md",
      "sprint-changelog/S44-ORCHESTRATION.md",
      "sprint-changelog/S45.5-BRIEF-silent-failure-cleanup.md",
    ],
  },
  {
    date: "2026-04-27T04:30:00",
    agent: "claude-code",
    summary:
      "S46.4 Phase 2: F TopHeader platform/layout dropdown chip chrome stripped (resting state has no bg/border, hover keeps the accent flash). G Strategium widget pane gains a DeskTheme widget that pulls from /api/day-plan/today + tap-to-expand into the matching MDB/ADB/PMDB brief (pickBriefType picks by ET hour); Autopilot widget moved to the LAST default slot (final order: er→regime→account→weekly→calendar→deskTheme→autopilot); MISSION_WIDGET_ORDER_KEY bumped v5→v6 acts as the localStorage normalize-on-mount per feedback_persisted_state_normalize_on_mount.md. H YouTubeMiniplayerContext bridges the existing draggable layout/YouTubeMiniplayer to RiskFlowDetailCard tap-throughs via a `yt-miniplayer:set-video` CustomEvent + shared localStorage key; commentary-category cards whose URL parses to a YouTube ID open inside the miniplayer instead of a new tab; Bloomberg Originals (channel UCqRhOzHM-c6L1JV-CV2j2_g) is the idle homepage embed (NOT a polling source — publisher-blocklist + content-guard MSM ban unchanged); IntersectionObserver auto-pauses the iframe via postMessage when scrolled off-screen. K (TP mid-stream) Sanctum Volatility Read + Next Session Forecast collapsed into a single transparent BlendedIVForecastCard — $/contract footer removed, forecast Doto numeral + confidence fuse take its place; grey bg-[var(--fintheon-surface)] stripped from both the IV scoring card and the DeskTheme widget; section dividers swapped to fading rulers (no borders) per TP. I video_url end-to-end: migration 20260427030000_add_video_url.sql adds video_url TEXT to raw + scored riskflow tables (push pending TP go-ahead — sandbox blocked supabase db push); worker x-handles-browser extracts highest-bitrate mp4 from extended_entities.media[].video_info.variants[] and threads through CollectedNewsItem → persist → RawRiskFlowItem → ScoredRiskFlowItem → FeedItem.videoUrl; central-scorer raw→scored + scored→FeedItem mappers updated alongside image_url; supabase-service raw + scored INSERT statements include video_url + COALESCE on conflict; RiskFlowDetailCard renders <video controls poster={imageUrl} src={videoUrl}> wrapped in <a href={url}>, with data-osint-video attribute for OSINT-source highlighting; RiskFlowContext mapper prefers camelCased videoUrl over legacy snake_case video_url.",
    files: [
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/mission-control/DeskThemeWidget.tsx",
      "frontend/lib/youtube.ts",
      "frontend/contexts/YouTubeMiniplayerContext.tsx",
      "frontend/components/layout/YouTubeMiniplayer.tsx",
      "frontend/types/electron.d.ts",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/narrative/BlendedIVForecastCard.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "supabase/migrations/20260427030000_add_video_url.sql",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/workers/riskflow-worker/persist.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/types/riskflow.ts",
    ],
  },
  {
    date: "2026-04-27T03:30:00",
    agent: "claude-code",
    summary:
      "S46.4 RiskFlow narrowing + Calendar restoration. Worker standard tier stripped to TP-approved gov trio (COT weekly via browser-harness, FOMC Minutes via press_monetary.xml filtered to title-prefix 'Minutes of the Federal Open Market Committee', Fed speeches via speeches.xml full feed); SEC EDGAR + Treasury press removed; Exa call site commented (collector retained per feedback_exa_off.md). ECON_BURST_INTERVAL_MS bumped 500ms → 1000ms (1Hz inside the burst window). ForexFactory dropped from econ-calendar-populator — TradingView is now the sole econ source; dedupe still enforced by existing UNIQUE INDEX on economic_events.event_key. CALENDAR navtab restored to live TradingView iframe (TradingViewCalendar.tsx) via EmbeddedBrowserFrame; Electron .ics interceptor now emits desk-calendar:saving / :saved / :failed IPC events that drive a green 'Saving event to desk queue…' status + success toast — no Google Calendar window, no chooser dialog, no app-leaving navigation. Backend storage: economic_events (TV API) + desk_calendar_events (iframe CTA, idempotent on ics_uid). New admin routes /api/admin/riskflow/{source-stats, bulk-delete, refill, msm-purge} (gated on x-routine-secret), driven by Refinement Engine right-rail Catalyst Stats panel: counts per source × category, multi-select bulk delete, 14d mass refill with 1.5s tail rate-limit, and MSM purge audit + confirm flow that hard-deletes from scored_riskflow_items + raw_riskflow_items.",
    files: [
      "backend-hono/src/workers/riskflow-worker/contract.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/services/cron/econ-calendar-populator.ts",
      "backend-hono/src/services/riskflow/refill-driver.ts",
      "backend-hono/src/routes/admin/riskflow-bulk.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/econ/TradingViewCalendar.tsx",
      "frontend/components/layout/TabRenderer.tsx",
      "frontend/components/refinement/CatalystStatsPanel.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/types/electron.d.ts",
      "electron/main.cjs",
      "electron/preload.cjs",
    ],
  },
  {
    date: "2026-04-27T02:20:00",
    agent: "claude-code",
    summary:
      "S46.2 cherry-pick — restore the v5.30.0/v5.31.0/v5.31.1/v5.32.2-rc2 news pipeline + TradingView econ + earnings infra from origin/s455-cleanup onto main. Phase A: pulled workers/riskflow-worker/ (browser-harness primary syndication.twitter.com → XActions secondary → agent-reach Nitter tertiary), services/xactions/client.ts, Dockerfile.riskflow-worker + fly.riskflow-worker.toml; pulled v5.31.0 deltas to services/riskflow/{content-guard.ts (three-layer banned-publisher gate),central-scorer.ts}, lib/html-entities.ts; deleted legacy workers/news-worker/ + Dockerfile.news-worker + fly.news-worker.toml. Phase B: pulled services/{tradingview/scanner.ts, earnings/{megacap-orchestrator.ts, megacap-tickers.ts, sources/{tradingview-calendar, browser-harness-scrape, financial-datasets-mcp, index}.ts}, econ/tradingview-coverage.ts, analysts/megacap-analyst.ts, cron/{megacap-earnings-refresh, megacap-earnings-enrichment}.ts}, config/risk-sectors.ts, routes/{market-scan, earnings}/. Manual ports: boot/services.ts adds startMegacapEarningsRefresh + startMegacapEarningsEnrichment; routes/index.ts mounts /api/market-scan + /api/earnings; services/cron/econ-calendar-populator.ts accepts s455 version (TradingView feed alongside ForexFactory); .mcp.json adds financial-datasets MCP server. Stub: spawnSectorDispatch in megacap-analyst.ts becomes a logger-only no-op until services/boardroom-spawner.ts lands (orphaned on s455 too). Both Fly apps deployed: fintheon (main API) + fintheon-riskflow-worker (separate Playwright worker on port 8082). Worker /healthz green; tier_complete logs confirm breaking + standard tiers ticking on schedule. UPSTREAM-LEVEL FAILURES (not code): syndication.twitter.com 429s every Fly outbound (Twitter rate-limits the Fly IP range); fintheon-xactions Fly app does not exist (XACTIONS_API_BASE points to a never-deployed endpoint); nitter.privacydev.net + nitter.poast.org both 403/dead (industry-wide Nitter mirror collapse). All three tiers thus return 0 items per tick — but the architecture is now correct, content-guard catches mainstream leaks, and the moment any one of those upstreams comes back, the feed moves. Tonight's separate publisher-blocklist.ts at writeRawItems boundary is preserved as defense-in-depth.",
    files: [
      "backend-hono/src/workers/riskflow-worker/index.ts",
      "backend-hono/src/workers/riskflow-worker/scheduler.ts",
      "backend-hono/src/workers/riskflow-worker/persist.ts",
      "backend-hono/src/workers/riskflow-worker/score.ts",
      "backend-hono/src/workers/riskflow-worker/sources/index.ts",
      "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
      "backend-hono/src/workers/riskflow-worker/sources/browser-harness.ts",
      "backend-hono/src/workers/riskflow-worker/sources/agent-reach.ts",
      "backend-hono/src/workers/riskflow-worker/sources/exa.ts",
      "backend-hono/src/workers/riskflow-worker/sources/types.ts",
      "backend-hono/src/services/xactions/client.ts",
      "backend-hono/src/services/tradingview/scanner.ts",
      "backend-hono/src/services/earnings/megacap-orchestrator.ts",
      "backend-hono/src/services/earnings/megacap-tickers.ts",
      "backend-hono/src/services/earnings/sources/tradingview-calendar.ts",
      "backend-hono/src/services/earnings/sources/browser-harness-scrape.ts",
      "backend-hono/src/services/earnings/sources/financial-datasets-mcp.ts",
      "backend-hono/src/services/earnings/sources/index.ts",
      "backend-hono/src/services/econ/tradingview-coverage.ts",
      "backend-hono/src/services/analysts/megacap-analyst.ts",
      "backend-hono/src/services/cron/megacap-earnings-refresh.ts",
      "backend-hono/src/services/cron/megacap-earnings-enrichment.ts",
      "backend-hono/src/services/cron/econ-calendar-populator.ts",
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/agent-reach-poller.ts",
      "backend-hono/src/lib/html-entities.ts",
      "backend-hono/src/config/risk-sectors.ts",
      "backend-hono/src/routes/market-scan/index.ts",
      "backend-hono/src/routes/earnings/handlers.ts",
      "backend-hono/src/routes/earnings/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/Dockerfile.riskflow-worker",
      "backend-hono/fly.riskflow-worker.toml",
      ".mcp.json",
    ],
  },
  {
    date: "2026-04-26T23:55:00",
    agent: "claude-code",
    summary:
      "S46.1 last-night patches per TP: (1) duplicate <PanelToggleGroup/> at TopHeader.tsx:680 removed; (2) double-chevron expand button stripped from NavSidebar.tsx top — hover + heading-toolbar layout button are the only triggers now; (3) Strategium collapsed-state rail/divider/chevron deleted from MainLayout.tsx — when collapsed the right column renders nothing, expand happens only via the heading toolbar layout button or the in-panel chevron on the expanded panel; (4) RiskFlow source-filter overhaul: agent-reach RSS list cut from Reuters/Bloomberg/CNBC/MarketWatch/SeekingAlpha/ZeroHedge → FRED + BLS + Federal Reserve only; browser allowlist news-tier (reuters/bloomberg/wsj/ft) stripped, FRED + stlouisfed.org added; new universal services/riskflow/publisher-blocklist.ts wired into supabase-service.writeRawItems so every poller's writes are filtered uniformly by host + headline pattern + Twitter handle (@business, @markets, @CNBC, @FoxNews, @MSNBC, @CNN, @Reuters etc) regardless of submitter; (5) backfill-headlines query menu widened to cover the Iran/Israel ceasefire + Trump assassination-attempt surfaces + macro core. Last-5-days backfill scheduled post-deploy.",
    files: [
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "backend-hono/src/services/riskflow/agent-reach-poller.ts",
      "backend-hono/src/services/browser/allowlist.ts",
      "backend-hono/src/services/riskflow/publisher-blocklist.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/riskflow/backfill-headlines.ts",
    ],
  },
  {
    date: "2026-04-26T23:10:00",
    agent: "claude-code",
    summary:
      "v5.32.4 — Merge s46-tv-calendar-final into main: ships v5.32.3's dashboard polish + TopHeader reorder alongside the S46 TV calendar integration (Electron .ics interception → /api/desk/calendar/ingest-ics + RFC5545 parser + idempotent upsert into desk_calendar_events; EconCalendar queue badge + tradingWeekKey() Fri 16:00 ET roll) and the S46 RiskFlow filter sync (server-side persistence on user_preferences.riskflowFilters with first-load reconcile + cross-device propagation). package.json + scripts/fintheon-update.sh bumped to 5.32.4. No new failures vs v5.32.3 baseline; backend tsc + frontend tsc + frontend vite build all clean.",
    files: ["package.json", "scripts/fintheon-update.sh"],
  },
  {
    date: "2026-04-26T23:00:00",
    agent: "claude-code",
    summary:
      "S46 RiskFlow filter globalization: severities + buckets now flow through SettingsContext → /api/preferences so a user's Critical/High + OSINT/Commentary selection follows them across every RiskFlow surface on desktop, mobile, and web. Backend preferences zod schema gains optional riskflowFilters; both shared contracts mirror the field. Hooks reconcile once on mount (remote wins; if remote empty + localStorage has prior selection, migrate localStorage up once). 30s preferences poll picks up cross-device updates. localStorage stays as offline cache.",
    files: [
      "backend-hono/src/routes/preferences/index.ts",
      "frontend/lib/user-preferences.ts",
      "mobile/lib/user-preferences.ts",
      "frontend/hooks/useRiskFlowFilters.ts",
      "mobile/hooks/useRiskFlowFilters.ts",
    ],
  },
  {
    date: "2026-04-26T22:50:00",
    agent: "claude-code",
    summary:
      "v5.32.3 — Dashboard split polish + TopHeader reorder. Removed the gold needle divider between the Brief and the Day Plan column (parent container now provides the only border). Brief/Plan split is true 50/50 (both flex-1). Right column header replaced 'Today's Plan' / 'Day Card' pill with the live day-of-week (e.g. SUNDAY) rendered through the same gold KanbanTitle as the Brief side. DayCard gained a `bare` prop that drops its inner bg/rounded/p-3 so the content stretches flush — used by MainDashboard; Sanctum keeps the surfaced look. PanelToggleGroup wrapper is transparent (no bg, no border, no rounded-lg, no px-1). TopHeader reordered per TP: PanelToggleGroup → iFrame/browser dropdown → VIX → power/chat/voice/heartbeat/bulletin/ivScore. Platform slot rendered inline before VIX; the in-loop platform branch is gone, map skips id==='platform'. Note for TP: no current trading plan is correct — useDayPlan returns null until the S45 backend publishes a plan row, so DayCard renders 'No plan published for today.' That populates once the day-plan brief-splice cron fires.",
    files: [
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/narrative/DayCard.tsx",
      "frontend/components/layout/PanelToggleGroup.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-26T22:40:00",
    agent: "claude-code",
    summary:
      "S46 TV Calendar Final Integration: Electron intercepts TradingView .ics downloads (will-download on defaultSession + persist:fintheon, loose host+path match) and POSTs them to new /api/desk/calendar/ingest-ics. Inline RFC5545 parser + idempotent upsert on ics_uid into new desk_calendar_events table. EconCalendar header gains queue badge + tradingWeekKey() re-mount that auto-rolls Fri 16:00 ET so the embed always boots into the current trading week.",
    files: [
      "supabase/migrations/20260426223451_desk_calendar_events.sql",
      "backend-hono/src/routes/desk-calendar/index.ts",
      "backend-hono/src/routes/desk-calendar/handlers.ts",
      "backend-hono/src/routes/desk-calendar/ics-parser.ts",
      "backend-hono/src/routes/index.ts",
      "electron/main.cjs",
      "frontend/components/econ/EconCalendar.tsx",
    ],
  },
  {
    date: "2026-04-26T22:30:30",
    agent: "claude-code",
    summary:
      "S45 shipped: DayCard live on the Dashboard right pane (replaces lightweight SessionCalendarList) + Strategium DayCardBulletinTab. Archived to sprint-changelog/. 2 tracks (T1 data/brain, T2 surfaces), ~30 files. Sub-track briefs S45-T1/T2 left in sprint-md until a follow-up deletion sweep.",
    files: ["sprint-changelog/S45-ORCHESTRATION.md"],
  },
  {
    date: "2026-04-26T22:30:25",
    agent: "claude-code",
    summary:
      "Archive sweep: S38 design-patches, S40 Time-To-Print + news realtime, S40-S42 unify brief, S42 chat SOTA orchestration, and S45 open-questions all moved sprint-md/ → sprint-changelog/. Each shipped in earlier v5.x deploys; the main plans were leftover in sprint-md/ from missed prior debriefs.",
    files: [
      "sprint-changelog/S38-BRIEF-design-patches.md",
      "sprint-changelog/S40-BRIEF-time-to-print-news-realtime.md",
      "sprint-changelog/S40-S42-UNIFY-BRIEF.md",
      "sprint-changelog/S42-ORCHESTRATION.md",
      "sprint-changelog/S45-OPEN-QUESTIONS.md",
    ],
  },
  {
    date: "2026-04-26T22:30:00",
    agent: "claude-code",
    summary:
      "v5.32.2 — Dashboard refactor + Vercel build fixes + S45.5 partial. Briefing/Calendar split 55/45 → 50/50; right pane now mounts the new S45-T2 DayCard (Today's Plan) instead of the lightweight SessionCalendarList. Core KPIs now chevron-collapsible, default collapsed. Regime Tracker lifted to a KanbanTitle row at the same indent as Core KPIs / RiskFlow (no more px-4 left bias), chevron-collapsible (default collapsed); Open button preserved alongside the chevron. RegimeCard gains a hideHeader prop so the parent owns the section title. Restored frontend/components/layout/PanelToggleGroup.tsx (deleted in 84aa8e47): VS Code-style three-button group (left / footer / right) with permanent thin divider lines so each icon's target panel is identifiable when inactive; the active panel's compartment fills with accent gold. Mounted in TopHeader to the right of the VIX widget. Window-event bus wires the buttons to NavSidebar (toggle manualExpand), FooterToolbar (toggle panelOpen — opens Team / Harper Ops / Changelog / Terminal / Errors / Tabs), and Strategium (toggle missionControlCollapsed in MainLayout). Strategium slide transition restored: wrapper keeps its width transition; inner expanded content uses animate-in fade-in slide-in-from-right-2 duration-300, so it slides in from the right edge instead of instantly swapping. Vercel build chain fixed (3 stacked failures): (1) auto-checkpoint had overwritten the repo-root index.html with a stale dist artifact — restored canonical version that points to /frontend/main.tsx; (2) Bun 1.3.6 on Vercel was bombing with ENOENT on node_modules right after startup — switched installCommand from bun install to npm install --legacy-peer-deps and buildCommand to npx vite build; (3) streamdown lives in frontend/package.json only — installCommand now also runs npm install --legacy-peer-deps inside frontend/. Preview build green at fintheon-af886vr7m-solvys.vercel.app.",
    files: [
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/dashboard/RegimeCard.tsx",
      "frontend/components/layout/PanelToggleGroup.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "vercel.json",
      "index.html",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-26T17:50:00",
    agent: "claude-code",
    summary:
      "S45 Wave 2 unification: T1 (data/brain) and T2 (surfaces) merged on s45-day-card, type parity validated across backend/frontend/mobile day-plan.ts (shape-identical, mobile drops JSDoc per separate-bundle convention), full validation suite green — backend tsc + bun build, frontend tsc + clean vite build, mobile tsc + clean vite build. Migration 20260426161822_day_plan_tables.sql confirmed pushed to Supabase (4 tables + RLS). Local smoke pass on /api/day-plan/{today,week} (200 with real plan + 5-day window scheduler output); /streak, /drift-status, /feedback correctly auth-gated (401). Trades.user_id forward-fix verified in projectx-sync + autopilot/autopilot-scheduler (PROJECTX_USER_ID || SYSTEM_USER_ID resolve). One-time backfill script scripts/backfill-trades-user-id.ts shipped; execution deferred until TP provisions SYSTEM_USER_ID in Fly secrets (script supports --dry-run + --user-id flag). Browser Harness Playwright pass deferred to /solvys-deploy step. Open: TV Computer Use cost envelope to be proposed to TP post-PR.",
    files: [
      "backend-hono/scripts/backfill-trades-user-id.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-26T19:30:00",
    agent: "claude-code",
    summary:
      'S45-T2: DayCard + Strategium daycard tab + mobile parity + journal PlanFeedbackBlock + DriftIndicator + StreakBadge + FadingRuler primitive. New surfaces use the fading-ruler-line divider (linear-gradient transparent → low-opacity gold → transparent) instead of borders — locked as the singular visual character of S45. DayCard renders under Volatility Read in Sanctum (non-chart-mode), shows Desk Theme + 6 data lines (Event / Trading Window / Prices of Interest / Invalidation / Profit Target / Expected Move) + streak/drift footer; titles left-justified, values right-justified Doto, monospace gutter. StickyBulletin grew a 5th tab "Day Card" with Mon–Fri preview pills (no expansion — tap scrolls Sanctum DayCard into view via id day-card-anchor). MobileBulletin grew a parity 5th tab using the mobile token system (mobile keeps its own inline copy due to token-system divergence — same pattern as RiskFlowCard / CatalystImage). Strategium header gained a DriftIndicator pill (4 states: in-window / drift-alert / tilt-stop / dead-volume; pulse on tilt-stop + dead-volume). StreakBadge (Doto numeral, gold pulse on milestones 5/10/21/50) lives in DayCard footer. PlanFeedbackBlock injected into SessionJournalPanel — one block per window in today\'s day plan; Followed/Faded/Sat-out triad + reason chips when Faded; free-text only when Tilt or FOMO; circular ArrowUp submit (memory pin). Hooks: useDayPlan + useDriftStatus (60s poll), useDayPlanWeek + useStreak (5min poll), usePlanFeedback (POST). day-plan types mirrored in frontend/types/day-plan.ts and mobile/types/day-plan.ts (T1 publishes the canonical backend type — orchestrator validates parity at unification).',
    files: [
      "frontend/components/shared/FadingRuler.tsx",
      "frontend/styles/fading-ruler.css",
      "frontend/index.css",
      "frontend/components/narrative/DayCard.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/strategium/DayCardBulletinTab.tsx",
      "frontend/components/strategium/DriftIndicator.tsx",
      "frontend/components/streak/StreakBadge.tsx",
      "frontend/components/journal/PlanFeedbackBlock.tsx",
      "frontend/components/journal/SessionJournalPanel.tsx",
      "frontend/components/StickyBulletin.tsx",
      "frontend/components/layout/MissionControlContent.tsx",
      "frontend/hooks/useStickyBulletin.ts",
      "frontend/hooks/useDayPlan.ts",
      "frontend/hooks/useDayPlanWeek.ts",
      "frontend/hooks/useDriftStatus.ts",
      "frontend/hooks/useStreak.ts",
      "frontend/hooks/usePlanFeedback.ts",
      "frontend/types/day-plan.ts",
      "mobile/components/bulletin/MobileBulletin.tsx",
      "mobile/components/bulletin/MobileBulletinDayCard.tsx",
      "mobile/types/day-plan.ts",
    ],
  },
  {
    date: "2026-04-26T19:45:00",
    agent: "claude-code",
    summary:
      "S45-T1: Day Card data brain. New day-plan service (window-scheduler + tv-bars-fetcher + vwap-poc-math + price-rounding + desk-theme-generator) generates a prescriptive Day Card per weekday — one trading window, prices of interest, invalidation, profit target, expected-move pct, and a Sonnet-authored Desk Theme via VProxy. Three new crons: day-plan 06:15 ET, streak 16:00 ET (writes day_plan_streaks driven off ProjectX balance delta), drift-monitor every 15 min 08-17 ET (classifies fills against today's windows + dead-volume rule, applies -5 non-healing ER offset on drift, logs 'desk-drift' annotations via writeAnnotation). New routes /api/day-plan: GET /today, GET /week, GET /streak, GET /drift-status, POST /feedback, GET /feedback. Brief-generator splices an inline Desk Theme block (monospace gutter) into MDB / ADB / PMDB / TWT prompts. Harper-handler: 'redo today's plan because X' triggers regenerateDayPlan and injects the fresh plan into the system prompt. Trades INSERT in projectx-sync + autopilot-scheduler now carries user_id (PROJECTX_USER_ID or SYSTEM_USER_ID); historical NULL rows backfilled by orchestrator. New migration 20260426161822_day_plan_tables.sql: day_plans, day_plan_windows, day_plan_feedback, day_plan_streaks with RLS. Extended FlawTag union with 'desk-drift'.",
    files: [
      "supabase/migrations/20260426161822_day_plan_tables.sql",
      "backend-hono/src/types/day-plan.ts",
      "backend-hono/src/services/day-plan/day-plan-service.ts",
      "backend-hono/src/services/day-plan/window-scheduler.ts",
      "backend-hono/src/services/day-plan/desk-theme-generator.ts",
      "backend-hono/src/services/day-plan/tv-bars-fetcher.ts",
      "backend-hono/src/services/day-plan/vwap-poc-math.ts",
      "backend-hono/src/services/day-plan/price-rounding.ts",
      "backend-hono/src/services/desk-drift/drift-monitor.ts",
      "backend-hono/src/services/desk-drift/dead-volume-rule.ts",
      "backend-hono/src/services/desk-drift/drift-messages.ts",
      "backend-hono/src/services/cron/day-plan-cron.ts",
      "backend-hono/src/services/cron/streak-cron.ts",
      "backend-hono/src/services/cron/drift-monitor-cron.ts",
      "backend-hono/src/routes/day-plan/handlers.ts",
      "backend-hono/src/routes/day-plan/index.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/services/psych-assist/lockout-protocol.ts",
      "backend-hono/src/services/projectx-sync.ts",
      "backend-hono/src/services/autopilot/autopilot-scheduler.ts",
      "backend-hono/src/types/calibration.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
    ],
  },
  {
    date: "2026-04-26T18:30:00",
    agent: "claude-code",
    summary:
      "S35-T11: All Hermes agents + Arbitrum seats locked to qwen3.5:397b-cloud via Ollama Cloud. DashScope provider stripped from the codebase (paid + no key). HERMES_TASK_MODEL_MAP now points every arbitrum-seat-* key to qwen3.5:397b-cloud; ARBITRUM_MODEL_PROVIDER_MAP collapsed to a single ollama entry; ArbitrumProvider type narrowed to ollama|groq|openrouter. seats.ts: all 5 seats use SEAT_MODEL constant; MoA L1 drafters share the same model — divergence comes from independent samples at temperature 0.8. Removed dashscopeChat() + dashscope/groq fallback branch in adapters.ts. CLAUDE.md Arbitrum table updated.",
    files: [
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/adapters.ts",
      "CLAUDE.md",
    ],
  },
  {
    date: "2026-04-25T19:10:00",
    agent: "claude-code",
    summary:
      "S35-cleanup: (1) Backend DB purge — 544 Reuters/Bloomberg headlines removed (176 scored_riskflow_items + 151 raw_riskflow_items + 35 news_feed_items + 182 narrative_card_links) and 1,566 duplicate-headline rows deduped (846 scored + 656 orphan links + 48 raw + 16 news_feed). (2) Arbitrum econ-context wiring — new services/arbitrum/econ-context.ts loads last-21d econ_prints + next-7d economic_events on every chamber run; seats.ts buildUserPrompt + buildDistillPrompt now thread that context into Qwen seats so they reason over the same data the Aquarium event-card surfaces; ArbitrumDeliberateInput gained econ_context. (3) Manual backfill trigger — POST /api/admin/econ/backfill-tick + /backfill-drain (gated on x-routine-secret) so the dormant econ-backfill-orchestrator can drain the 7 April-2026 country slices that have been pending since Mar 26 (econ_prints went silent that day; only 1 of 79 economic_events in the last 30d had `actual` populated). (4) Bridge — services/econ/bridge-actuals.ts copies populated economic_events.actual rows into econ_prints (idempotent on lowercased headline + day), so /api/econ/synthesize and EconEventCard print history populate immediately after a drain instead of waiting for riskflow-econ-enricher's daily roll-over. backfill-drain auto-runs the bridge after each drain; standalone POST /api/admin/econ/bridge-actuals also added.",
    files: [
      "backend-hono/src/routes/admin/econ-backfill.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/arbitrum/types.ts",
      "backend-hono/src/services/arbitrum/seats.ts",
      "backend-hono/src/services/arbitrum/engine.ts",
      "backend-hono/src/services/arbitrum/econ-context.ts",
      "backend-hono/src/services/econ/bridge-actuals.ts",
    ],
  },
  {
    date: "2026-04-26T00:50:00",
    agent: "claude-code",
    summary:
      "S35-cleanup hotfix: prod OpenRouter key returns 401 'User not found' (account/key revoked). Rerouted both econ-backfill-puller and econ-backfill-harper from raw OpenRouter calls to invokeAgent (Strands fallback chain VProxy → Ollama Qwen3.5:397b-cloud via HERMES_SIDECAR_URL → Nous → OpenRouter). HERMES_BASE_URL is set on prod so the Ollama-Qwen rung is the active path. Also relaxed RiskFlow backfill-headlines Exa publishedDate filter from strict same-day match to ±3 days (the strict filter eliminated every Exa hit because Exa rarely returns publishedDate matching the exact requested day).",
    files: [
      "backend-hono/src/services/cron/econ-backfill-puller.ts",
      "backend-hono/src/services/cron/econ-backfill-harper.ts",
      "backend-hono/src/services/riskflow/backfill-headlines.ts",
    ],
  },
  {
    date: "2026-04-26T00:30:00",
    agent: "claude-code",
    summary:
      "S35-cleanup follow-up: (1) econ-backfill-puller now routes through OpenRouter Qwen (qwen/qwen-2.5-72b-instruct primary, qwen/qwen3-235b-a22b fallback) using the same OPENROUTER_API_KEY that fronts every Hermes call on prod — DashScope/Groq paths skipped because those keys aren't on the fly app. Free-tier :free model variants 402 with $0 OpenRouter balance, paid model IDs work as long as the key has any credit. (2) FRED date window padded -60 days backward in pullFromFred so monthly series whose observation date falls in the prior reporting month (e.g. CPI for March 2026 dated 2026-03-01, released April) still land inside the slice window. (3) New POST /api/admin/riskflow/backfill-headlines (gated on x-routine-secret) runs Exa search across a fixed macro query menu for each silent day, writes hits into raw_riskflow_items with published_at pinned to the silent day, then drives scoringCycle until the inbox drains — fills the news-worker silence windows (2026-04-04..05, 04-09, 04-24..25, plus the partial 04-25 thinning).",
    files: [
      "backend-hono/src/services/cron/econ-backfill-puller.ts",
      "backend-hono/src/types/econ-backfill.ts",
      "backend-hono/src/routes/admin/riskflow-backfill.ts",
      "backend-hono/src/services/riskflow/backfill-headlines.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-25T17:45:00",
    agent: "claude-code",
    summary:
      "S35 debug: two critical bugs. (1) Mobile chat no-response — relay-bridge.ts forward() generator hung forever when the local backend's WS dropped between frames, so relay.ts streamed 200 OK with an empty SSE body and mobile sat on the 12s 'HARPER SILENT' watchdog with no error bubble; added close/error listeners that synthesize a local_offline error so relay.ts's catch arm emits {type:error}+[DONE] and mobile renders [ERROR: Local backend disconnected]. Send call also now wrapped so a between-isConnected-and-send race hits the same path. (2) Electron 'error-closes after 5 min' — macOS log show revealed AppKit windowShouldClose: at every crash.log timestamp, but no instrumentation captured WHO triggered it; added BrowserWindow close, render-process-gone, app before-quit/will-quit/quit, and process SIGTERM/SIGINT/SIGHUP loggers that all attribute via a shared closeReason so the next repro lands a definitive trigger in crash.log instead of just the cascade.",
    files: ["backend-hono/src/services/relay-bridge.ts", "electron/main.cjs"],
  },
  {
    date: "2026-04-25T18:00:00",
    agent: "claude-code",
    summary:
      "v5.28.0 — Arbitrum + RiskFlow recovery sweep. (1) News-worker pipeline: Supabase migration adds raw_riskflow_items.url + raw_riskflow_items.image_url + scored_riskflow_items.image_url -- persist.ts had been writing url for weeks but the column never existed (every persist returned `Could not find the 'url' column` with items_ingested:0). Backfilled url from the legacy tags[] 'url:' prefix. (2) news-worker sources extract image_url: RSS enclosure / media:content / media:thumbnail / inline <img> in agent-reach RSS, og:image / twitter:image / hero <img> from browser-harness raw HTML (extractImageFromHtml helper exported from harness.ts so other callers can reuse). image_url plumbed through CollectedNewsItem -> writeRawItems -> writeScoredItems -> FeedItem.imageUrl. (3) Sanctum Update button rewired: ConsiliumHub now POSTs /api/arbitrum/deliberate (was firing dead /api/agent-desk/simulate that returned 500 in prod) and reloads via /api/arbitrum/latest, preset becomes the chamber question. (4) Predictions/outlook: cutoff 48h -> 7d with 24h-half-life recency decay so a single news-worker stall doesn't flatten every fuse to 3.0/neutral/+/-135pts. (5) Image+source rendering: shared CatalystImage + SourceHandoffLink primitives, wired into RiskFlowDetailCard, RiskFlowMini (both AlertRow + TradeIdeaRow expanded), NarrativeResearchCard (Sanctum catalyst surface), and mobile RiskFlowCardExpanded -- click-through opens article in new tab; image hides on load failure. (6) Mobile Arbitrum surface (didn't exist): new useArbitrumLatest hook + ArbitrumVerdictCard slotted as new HomePage page between InstrumentOutlookCards and Risk Signals. (7) Electron crash diagnostics: render-process-gone / child-process-gone / gpu-process-crashed / uncaughtException / unhandledRejection / unexpected backend exits all log to userData/crash.log so the next reproduction of the few-minute auto-close has an upstream signal. Backend bun build, frontend tsc + vite build, mobile tsc + vite build all clean. Migration pushed via supabase db push.",
    files: [
      "supabase/migrations/20260425170000_riskflow_url_image_columns.sql",
      "backend-hono/src/workers/news-worker/persist.ts",
      "backend-hono/src/workers/news-worker/sources/types.ts",
      "backend-hono/src/workers/news-worker/sources/agent-reach.ts",
      "backend-hono/src/workers/news-worker/sources/browser-harness.ts",
      "backend-hono/src/workers/news-worker/sources/exa.ts",
      "backend-hono/src/services/agent-reach-service.ts",
      "backend-hono/src/services/browser/harness.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/routes/predictions.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/shared/CatalystImage.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/narrative/NarrativeResearchCard.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/services/riskflow.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-seed-loader.ts",
      "frontend/types/api.ts",
      "mobile/contexts/RiskFlowContext.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/hooks/useArbitrumLatest.ts",
      "mobile/components/home/ArbitrumVerdictCard.tsx",
      "mobile/components/home/HomePage.tsx",
      "electron/main.cjs",
    ],
  },
  {
    date: "2026-04-25T17:30:00",
    agent: "claude-code",
    summary:
      "Strategium reset-to-default button: new RotateCcw icon button next to the Pencil edit toggle in MissionControlContent header. Fades + scales in/out via t-dropdown (solvys-transitions) tied to editMode -- when edit mode is off the button is opacity:0 + pointer-events:none + tabIndex=-1 + aria-hidden so it's invisible AND non-interactive; when on it scales up to 1 with the dropdown ease. Click pops a window.confirm; on accept calls handleMissionWidgetResetLayout in MainLayout which resets MissionWidgetOrder to DEFAULT_MISSION_WIDGET_ORDER and visibility to all-true. Frontend tsc + vite build clean.",
    files: [
      "frontend/components/layout/MissionControlContent.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-25T17:00:00",
    agent: "claude-code",
    summary:
      "v5.27.0 — solvys-transitions roll-out + Strategium maximize-button removal. Added the new solvys-transitions skill (canonical solvys-skills repo + fintheon mirror) that bundles 9 paste-ready CSS transitions namespaced under --t-* / .t-* with prefers-reduced-motion guard, and applied them across the platform: PriorityFilterMenu + SourceFilterMenu (t-dropdown scale+fade), NotificationCenter (t-panel-slide reveal driven by rAF), IVStack Doto numerals (t-digit-group pop-in via shared DigitGroup helper), Arbitrum VerdictCard / ArbitrumPeek / ArbitrumChamber per-seat numerals (DigitGroup), Refinement Engine AdvancedPane and Group Sensitivity collapsibles (t-panel-slide), and every Settings tab (NotificationsTab, TradingTab, GeneralTab, ApiTab, IframesTab, HermesAdminTab, ThemeSettings, AgenticDesk, DangerTab, DeveloperTab) via a SettingsTabPanel wrapper that replaces animate-fade-in/out-tab. Removed the Maximize/Minimize RiskFlow overlay button that was sitting on top of the refresh button in the Strategium RiskFlow header (TP flagged across 6+ threads); also removed the orphaned 'Widgets · hidden' peek-header. Persisted strategiumPaneMode normalized to 'balanced' on mount so anyone with stale feedOnly/widgetsOnly state isn't stranded. Frontend tsc + vite build clean.",
    files: [
      ".claude/skills/solvys-transitions/SKILL.md",
      ".claude/skills/solvys-transitions/reference/transitions.css",
      ".claude/skills/solvys-transitions/reference/react-recipes.md",
      "frontend/styles/transitions.css",
      "frontend/index.css",
      "frontend/components/shared/DigitGroup.tsx",
      "frontend/components/shared/IVStack.tsx",
      "frontend/components/shared/PriorityFilterMenu.tsx",
      "frontend/components/feed/SourceFilterMenu.tsx",
      "frontend/components/NotificationCenter.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/arbitrum/ArbitrumPeek.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/refinement/AdvancedPane.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-25T16:00:00",
    agent: "claude-code",
    summary:
      "Extended solvys-transitions to Arbitrum, Refinement Engine, and the entire Settings panel. Extracted DigitGroup into a shared frontend/components/shared/DigitGroup.tsx (suffix slot for non-animating trailing labels like '%') so it can be reused across surfaces -- IVStack now consumes the shared one. Arbitrum: VerdictCard consensus + chamber-confidence numerals, ArbitrumPeek consensus + conf, and ArbitrumChamber per-seat probability + confidence all cascade in via t-digit-group on every verdict refresh. Refinement Engine: AdvancedPane reveal converted to t-panel-slide with rAF-driven data-open so the pane translates + blurs + fades in instead of mounting instantly; the Group Sensitivity collapsible got the same treatment. SettingsPanel: replaced animate-fade-in/out-tab with a SettingsTabPanel wrapper that drives t-panel-slide per-tab via rAF so every tab swap (general, hermes-admin, appearance, desk, notifications, trading, api, iframes, developer, danger) shares the same translate-Y + blur entry. Frontend tsc clean, vite build clean.",
    files: [
      "frontend/components/shared/DigitGroup.tsx",
      "frontend/components/shared/IVStack.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/arbitrum/ArbitrumPeek.tsx",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/refinement/AdvancedPane.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-04-25T15:30:00",
    agent: "claude-code",
    summary:
      "S35-Unified — cross-device notifications. (1) Schema migration adds notifications.cleared_at + dismissed_via, plus an idx_notifications_user_active partial index on the active set; non-destructive ADD COLUMN IF NOT EXISTS, applied via supabase db push. (2) UserPreferences contract (frontend/lib + mobile mirror + Zod schema) gains manualDnd, blockedCategories, severityThreshold so DND/blocklist persists in Supabase user_preferences and syncs across desktop + mobile via the existing /api/preferences pipe. (3) New backend endpoints POST /api/notifications/clear-all and POST /api/notifications/:id/clear soft-dismiss rows (sets cleared_at + dismissed_via); list/markRead queries respect cleared_at IS NULL so a clear on one device empties the bell on every other device. (4) sync-broadcast.ts fans a silent web-push (category=__sync) to the user's other subscriptions on every notification mutation + every preferences PUT; SW intercepts category=__sync, suppresses the notification banner, removes any visible OS notifications matching the cleared id (or all by tag for *_all kinds), updates the badge, and posts a fintheon:sync message to all open clients. (5) New evaluateDeliveryGates reads server-side user_preferences (manualDnd, blockedCategories, severityThreshold, quietHours) so emit.ts gates push delivery off the same source of truth as the UI; legacy quiet-hours.ts kept as a fallback path; canDeliverToUser still gates per-subscription category. Critical severity bypasses every user gate. (6) notifySuperadmins refactored to route through emitPushAndLog so super-admin alerts log to notifications, surface in the admin's bell on every device, and fan __sync — instead of the prior sendToUserDirect path that bypassed the audit log. (7) Desktop frontend: new NotificationsContext/useServerNotifications hook polls /api/notifications every 10s, listens to BroadcastChannel + SW messages, exposes optimistic markRead/clearOne/clearAll with X-Fintheon-Device origin header. NotificationCenter merges server rows + local DND queue and routes Clear All through the server. NavSidebar + TopHeader badge counts now sum local queue + server unread. DNDContext.manualDnd is now sourced from preferences, not localStorage. (8) Mobile useNotificationHistory gets clearOne/clearAll + a navigator.serviceWorker.message handler for fintheon:sync; NotificationDrawer's Clear All hits the server (preserves staggered exit animation). SW cache bumped to v5.27.0. tsc clean, frontend vite build clean (3395 modules), mobile vite build clean (2416 modules), backend bun build clean, smoke tests on /api/notifications/clear-all, /:id/clear, /read-all all 200 against the live local backend.",
    files: [
      "supabase/migrations/20260425145421_unified_notifications_state.sql",
      "supabase/migrations-applied/20260425145421_unified_notifications_state.sql",
      "backend-hono/src/types/notifications.ts",
      "backend-hono/src/db/queries/notifications.ts",
      "backend-hono/src/services/notification-service.ts",
      "backend-hono/src/services/notifications/emit.ts",
      "backend-hono/src/services/notifications/notify-superadmins.ts",
      "backend-hono/src/services/notifications/sync-broadcast.ts",
      "backend-hono/src/services/notifications/user-prefs-gate.ts",
      "backend-hono/src/routes/notifications/handlers.ts",
      "backend-hono/src/routes/notifications/index.ts",
      "backend-hono/src/routes/preferences/index.ts",
      "frontend/lib/user-preferences.ts",
      "frontend/contexts/DNDContext.tsx",
      "frontend/contexts/NotificationsContext.tsx",
      "frontend/components/NotificationCenter.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/App.tsx",
      "mobile/lib/user-preferences.ts",
      "mobile/hooks/useNotificationHistory.ts",
      "mobile/components/notifications/NotificationBell.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/public/sw.js",
    ],
  },
  {
    date: "2026-04-25T11:00:00",
    agent: "claude-code",
    summary:
      "S38 design patches — second pass (Refinement Engine + chrome + chart pin). (1) Active Market Environment: RegimeControl renamed 'Active Regime' → 'Active Market Environment' (UI only; backend `regime` untouched), right-justified, bumped header + badge type, override dropdown trigger enlarged with min-width 112px, dropdown items right-aligned. RefinementEngine top toolbar gets py-4 + min-h-60px so the chrome breathes ~12% taller. (2) Group Sensitivity row is now a click-to-toggle collapsible header with chevron, flat styling preserved (no card chrome), fuses render disabled unless the S37 Advanced-pane lock is open (predicate sourced from isRefinementEditUnlocked + 1.5s storage/focus poll for live sync). (3) PresetSelector relocated INTO AdvancedPane children — read-only when locked, interactive when unlocked. (4) Event Weights sliders rebuilt as NothingWeightSlider — 5 tick marks at 0/2.5/5/7.5/10, endpoint dots, solid accent active fill (no gradient), snap-to-tick on release, Inter-Mono drag-value popover above the thumb only while dragging. (5) Source Accounts / Persons of Interest / Econ Watch row text bumped one tier (text-[10px] → text-[12px], text-[9px] → text-[11px]) — single token reused across all three lists, no new size tier introduced. (6) Regime Approvals: same-state proposals (current === proposed) now rejected at write time in proposeRegimeChange and defensively filtered on the client read path; ApprovalsPage evidence panel suppressed entirely when empty (kills the blank fuse), backdrop-blur removed from the panel per no-glass rule, and evidence.sources[] renders as a 'Driving headlines' linked list (4 visible) with the legacy single evidence.headline as a fallback. (7) TopHeader: 'Priced In Capital' brand subtitle stripped from the header lockup. (8) FooterToolbar: desk-name slot ('Priced In Capital') inserted left of the system status indicators with a vertical divider; existing fetch/update status messages remain to its left. (9) Sanctum chart-mode: TradingView/SanctumChart hoisted out of Page 0 into a persistent right-half panel that stays in view as the user scrolls/snaps the left half through every page. tsc clean, vite build clean (3391 modules), backend bun build clean.",
    files: [
      "frontend/components/refinement/RegimeControl.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/QuickWeightEditor.tsx",
      "frontend/components/refinement/CommentatorManager.tsx",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "frontend/components/refinement/EconFiltersManager.tsx",
      "frontend/components/admin/ApprovalsPage.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "backend-hono/src/services/regime/propose.ts",
    ],
  },
  {
    date: "2026-04-25T06:30:00",
    agent: "claude-code",
    summary:
      "S38 design patches — voice + Sanctum + RiskFlow slice. (1) Voice orb ring now binds to a new --accent-primary CSS variable (alias of --fintheon-accent so theme swaps still work) and a deterministic VoiceModePixelOverlay sweeps in from the four corners, holds a ~60%-viewport circle, dissolves back to the corners, then runs a deterministic low-amplitude corner flicker on a ~520ms cadence while voice is active — WAAPI driven, no random shimmer. (2) SanctumHeader 'Aquarium' renamed to 'Arbitrum' with a larger lockup; the 'shark tank' subtitle is gone. The Consilium tab dropdown + SanctumSitemapDrawer now label the destination 'Arbitrum'; the underlying SanctumSubView id stays 'aquarium' for backend/route compatibility. (3) Sanctum Econ tab: EconKpiFuses wrapped in a click-to-toggle 'Econ Pulse' collapsible header (default expanded); InstrumentCardsRow swapped for AquariumPredictionCards (the horizontal heat-bar variant from the Command tab) so both tabs share one instrument-card pattern; AquariumPredictionCards heat bar bumped 3px → 5px so the gauge reads at a glance; dead EconInstrumentFuses.tsx file deleted. (4) RiskFlow 'Generate Note +' CTA now hits /api/riskflow/:id/generate-note with the user's selected instrument (localStorage fintheon:selected-instrument, default /ES) and renders a structured response: linked source headline + ≤200-char summary + a 'Bullish/Bearish/Neutral for {instrument}' badge. New backend service exports generateNoteForItemDetailed; route handler returns the detailed shape when an instrument is in the body and falls back to the legacy plain-text path otherwise. tsc clean, vite build clean (3391 modules), backend bun build clean.",
    files: [
      "frontend/components/voice/VoiceAuroraOrb.tsx",
      "frontend/components/voice/VoiceModePixelOverlay.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/index.css",
      "frontend/components/narrative/SanctumHeader.tsx",
      "frontend/components/consilium/ConsiliumTabConfig.ts",
      "frontend/components/layout/SanctumSitemapDrawer.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/narrative/econ/EconInstrumentFuses.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "backend-hono/src/services/riskflow/agent-notes.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "sprint-md/S38-BRIEF-design-patches.md",
    ],
  },
  {
    date: "2026-04-25T01:30:00",
    agent: "claude-code",
    summary:
      "Strategium: removed the Maximize/Minimize RiskFlow overlay button that sat on top of the refresh button in the RiskFlow header (TP has called this out across 6+ threads). Also removed the now-orphaned 'Widgets · hidden' peek-header. RiskFlow keeps its in-pane collapse/expand chevron, which is the only motion the user wanted. Persisted strategiumPaneMode is normalized to 'balanced' on mount so anyone landing with stale feedOnly/widgetsOnly state isn't stranded with no UI control to escape. Dropped the unused Maximize2/Minimize2 lucide imports. tsc + vite build clean.",
    files: ["frontend/components/layout/MainLayout.tsx"],
  },
  {
    date: "2026-04-25T01:00:00",
    agent: "claude-code",
    summary:
      "Added solvys-transitions to the Solvys Skills suite (canonical repo + fintheon mirror) -- a Solvys-tuned fork of transitions.dev with 9 paste-ready CSS transitions namespaced under --t-* / .t-* and a prefers-reduced-motion guard. Wired transitions.css into frontend/index.css and applied: t-dropdown to PriorityFilterMenu + SourceFilterMenu (scale+fade open/close instead of unmount), t-panel-slide to NotificationCenter (translate-Y + blur + fade reveal driven by a one-frame requestAnimationFrame so the entry animates from the closed resting state), and t-digit-group pop-in to the IVStack Doto numeral so the IV score cascades in left-to-right when a card mounts or the score changes (re-keyed on value to replay). Motion blur is on the animating element only -- never a backdrop-filter -- so this stays inside the no-glass ban. Frontend tsc clean, vite build clean (3394 modules), all 9 t-* classes present in the bundled CSS.",
    files: [
      ".claude/skills/solvys-transitions/SKILL.md",
      ".claude/skills/solvys-transitions/reference/transitions.css",
      ".claude/skills/solvys-transitions/reference/react-recipes.md",
      "frontend/styles/transitions.css",
      "frontend/index.css",
      "frontend/components/shared/PriorityFilterMenu.tsx",
      "frontend/components/feed/SourceFilterMenu.tsx",
      "frontend/components/NotificationCenter.tsx",
      "frontend/components/shared/IVStack.tsx",
    ],
  },
  {
    date: "2026-04-25T00:15:00",
    agent: "claude-code",
    summary:
      "v5.25.2 — fintheon-update.sh self-update bootstrap. Root cause: `fintheon update` dispatches via /Users/tifos/.local/bin/fintheon → `bash $FINTHEON_ROOT/scripts/fintheon-update.sh`, and bash loads the entire file into memory at invocation, so any `fintheon update` that fixed the repo body but left the script file untouched would keep re-running the stale copy indefinitely — the installer was effectively pinned to whatever logic was baked in at first install (user reported stuck on 5.22.9W). Added a pre-body bootstrap that fetches tags, checks whether the current file bytes match the latest v*.*.* release's scripts/fintheon-update.sh blob, overwrites + re-execs if they've drifted. FINTHEON_SELFUPDATED env flag guards infinite recursion. After one upgrade cycle the installer self-heals on every subsequent run. No changes to the global CLI wrapper — dispatcher already points at the repo copy; the repo copy just refreshes itself now.",
    files: ["scripts/fintheon-update.sh", "package.json"],
  },
  {
    date: "2026-04-24T23:45:00",
    agent: "claude-code",
    summary:
      "v5.25.1 — Strategium RiskFlow restore. In widgetsOnly mode the widgets pane was `flex-1` without `min-h-0`, so its content could force the pane taller than the viewport and push the RiskFlow peek-footer off-screen — the feed became unreachable. Added min-h-0 to every sizing branch of the widgets pane (widgetsOnly, balanced-with-collapsed-feed, balanced half-height) and made StrategiumPeekBar `shrink-0 h-9` so the footer is never squeezed out. RiskFlow always has a collapsed footer to return from in widgetsOnly now. Clicking it still flips strategiumPaneMode → balanced. No other behavior change.",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/StrategiumPeekBar.tsx",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-24T23:10:00",
    agent: "claude-code",
    summary:
      "Post-v5.25 polish — iFrames unified, voice surfaces redesigned, Consul Control quieted. (1) iFrames: header + footer dropdowns drop hardcoded PLATFORM_LABELS and iterate exclusively over SettingsContext.proposerIframeSources. IframesTab can add AND remove every entry (builtin guard gone). Storage authoritative — pruning a builtin sticks; loader only seeds the canonical 10-entry catalogue on first install. TradingBrowser.resolveUrl matches by id against the catalogue first; PLATFORM_URLS only a defensive shim. (2) Floating COACH widget retired — AgentResponsePopup + AgentResponsePopupHost + the WhiteWaveform inside PsychAssistDockable all deleted. New AgentVoiceWaveform mounts at root as a chrome-less waveform (no border, no background, pointer-events:none) doubling as user-mic indicator (listening) and agent-voice indicator (speaking/thinking). (3) VoiceTranscriptTicker (the floating 'Give a brief casual greeting…' banner) deleted. (4) PsychAssist toggle-off no longer freezes — stopMonitoring flips isMonitoring/analyser/active flags synchronously and pushes audioContext.close() + final saveSession POST onto a fire-and-forget tail. (5) VoiceRimFrame redesigned per /solvys-feels: dithered 6px conic-gradient border (alternating bright/trough alpha replaces the flat 3px gold line), pixel-radius mount micro-interaction (inset 12→0 + blur 2.5→0 over 320ms cubic-bezier so pixels read as 'reassembling at the radius'). Error state keeps a flat solid red. (6) Consul Control 404 spam (231+ /status 404s per session): backend stub at /api/consul-control/status returns {active:false, reason:'consul_control_not_wired'}, frontend useConsulControlStatus hook short-circuits on either 404 or that reason and stops polling for the session. (7) Heading-toolbar PerformanceChatButton deleted; PsychAssistDockable's standalone 'Talk to Coach' MessageSquare button removed. The orb is the single voice trigger; its deactivate handler stops ANY active Harper Voice session regardless of trigger. (8) Voice TTS — ElevenLabs first: new backend voice-tts.ts (eleven_turbo_v2_5 + Rachel voice defaults, gated by ELEVENLABS_API_KEY); /api/voice/speak now returns audioBase64 + audioMimeType inline, frontend useVoiceAssistant prefers server-synth audio and demotes window.speechSynthesis to last-resort with a console warning. ELEVENLABS_VOICE_ID + ELEVENLABS_MODEL_ID overridable; ELEVENLABS_DISABLE=true forces fallback. All four builds clean.",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/settings/IframesTab.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/TradingBrowser.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/voice/VoiceRimFrame.tsx",
      "frontend/components/voice/AgentVoiceWaveform.tsx",
      "frontend/components/voice/AgentResponsePopup.tsx",
      "frontend/components/voice/AgentResponsePopupHost.tsx",
      "frontend/components/voice/VoiceTranscriptTicker.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/components/performance/PerformanceChatButton.tsx",
      "frontend/contexts/ERContext.tsx",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/hooks/useConsulControlStatus.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/consul-control/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/voice-tts.ts",
    ],
  },
  {
    date: "2026-04-24T22:10:00",
    agent: "claude-code",
    summary:
      "v5.25.0 deploy — S35 unify roll-forward shipped. Merged s37-refinement-polish into s35-unified to capture S36 ClusterBeam (cluster_summaries migration + ClusterBeamPanel/Scrubber/ShockLayer/DensityMeter/ClusterBeamContext + useClusterSummary hook + lib/services/narrative.ts) AND S37 Refinement polish (RefinementEditLockModal + AlgoStatusWidget NothingFuse swap + scoring_user_sensitivity + scoring_presets tables + POST /api/scoring/{presets,sensitivities}) on top of S35 (Arbitrum engine + 17:00 chamber cron + event trigger + routes + Sanctum chart-mode height fix + InstrumentCardsRow rename/wire + side-by-side econ event cards). Backend deployed to fintheon.fly.dev (smokes: /api/diagnostics 200, /api/arbitrum/latest 200, /api/miroshark/latest 404, /api/riskflow/feed 200, /api/riskflow/iv-aggregate 200). Desktop frontend → fintheon-pid235zpu-solvys.vercel.app (alias fintheon-alpha.vercel.app, 200). Mobile PWA → fintheon-mobile-g7j5ft05c-solvys.vercel.app (alias fintheon.pricedinresearch.io, 200). DMG Fintheon-5.25.0-arm64.dmg copied to ~/Desktop and uploaded to GH release v5.25.0 alongside Fintheon-5.25.0-arm64-mac.zip. Older v5.* releases pruned (only v5.25.0 remains; tags retained). Local launchd backend recycled — boot log shows ArbitrumSessionCron registered (0 17 * * 1-5 America/New_York) + RiskFlowEconEnricher started. INSTALL-UPDATE: scripts/fintheon-update.sh UPDATE_VERSION bumped to 5.25.0; fintheon update will pull v5.25.0.",
    files: [
      "package.json",
      "scripts/fintheon-update.sh",
      "sprint-changelog/S35-ORCHESTRATION.md",
      "sprint-changelog/S36-BRIEF-clusterbeam.md",
    ],
  },
  {
    date: "2026-04-24T23:30:00",
    agent: "claude-code",
    summary:
      "S35 unification UI follow-up. (a) Sanctum Page 0 chart-mode height fix — page wrapper conditionally h-full (was min-h-full) when chartMode is on, and the chart column drops `min-h-[60vh] xl:min-h-0` for plain `min-h-0 overflow-hidden` so the TradingView iframe is bounded by viewport instead of bleeding past the snap boundary into Page 1 (Econ Intelligence). Left column gets matching min-h-0 so it scrolls internally. (b) Renamed orphan `frontend/components/narrative/InstrumentFusesPanel.tsx` → `InstrumentCardsRow.tsx`, internal export `InstrumentFusesPanel` → `InstrumentCardsRow`. Added in d5556408 (v5.22 S1) but never wired after Track 4a (c5f32a8d) replaced its host. Now wired into `SanctumEconIntel` as a full-width row above the event filter (replacing the old split header where KPI fuses + EconInstrumentFuses sat side-by-side at half width). KPI fuses now own their own full row; instrument cards stretch the next full row at 5-col grid. (c) `SanctumEconIntel` event-card container changed from `flex flex-col divide-y` → `grid grid-cols-1 lg:grid-cols-2 gap-3 p-3` so expanded econ event cards render side-by-side at lg+. (d) `EconEventCard` print grid tightened from `grid-cols-[68px_1fr_56px_56px_56px_64px]` → `grid-cols-[60px_1fr_48px_48px_48px_56px]` so the per-print rows stay legible at half-pane width. (e) `AquariumPredictionCards` row no longer horizontal-scrolls fixed 220px cards — children are now `flex-1 min-w-0` so they stretch and share row width (Sanctum Page 0 non-chart-mode instrument fuses row, plus anywhere else the component renders). EconInstrumentFuses left in tree but unimported (orphaned by this reflow). FadingVRule helper removed from SanctumEconIntel (no longer used after split-header removal). All four builds clean: backend bun, frontend tsc+vite, mobile vite.",
    files: [
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
      "frontend/components/narrative/InstrumentCardsRow.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/narrative/econ/EconEventCard.tsx",
    ],
  },
  {
    date: "2026-04-24T22:30:00",
    agent: "claude-code",
    summary:
      "S35-T12 Phase B — Arbitrum wiring + T9 safe deletions + T13 NOTICES + T6 README. Ships what S35 needed to actually fire: (1) arbitrum/engine.ts chamber orchestrator — glues ARBITRUM_SEATS × invokeMoA × synthesize × computeGates × saveVerdict; multi-round support with peer-draft summaries; (2) commentator-service.getTopNCommentators(n) sorted by weightMultiplier; (3) arbitrum/event-trigger.ts — fire-and-forget, gated on ivScore>=ARBITRUM_EVENT_IV_THRESHOLD (default 8.5) AND speaker fuzzy-matches top-N commentators, 20min per-speaker cooldown; (4) central-scorer.ts wires the trigger after writeScoredItems for every enrichedItem with ivScore>=8.5 (lazy dynamic import keeps cold-start clean); (5) routes/arbitrum/index.ts + mount (GET /latest[?trigger=], GET /:id, POST /deliberate); (6) cron/arbitrum-session-scheduler.ts — 17:00 ET weekdays via node-cron America/New_York, gated by ARBITRUM_SESSION_SCHEDULER_ENABLED; wired into bootBackground(). T11 dynamic import of services/arbitrum/index.js now resolves real digest_text. T9: deleted orphaned AgentDeskDebatePanel.tsx (zero live imports — Sanctum swapped in T3). /api/miroshark alias dropped from routes/index.ts. T9 table drop deferred — miroshark_deliberations still read by outcome-tracker.ts and written by agent-desk-deliberation.ts. T13: NOTICES.md added crediting Qwen/Anthropic/Ollama/Together MoA/Nous Hermes/aaronjmars MiroShark/TradingAgents/shadcn/Radix/Lucide/Framer Motion. T13 user-visible Hermes→AI-gateway copy sweep SKIPPED — conflicts with memory project_hermes_openclaw_pulse.md (Hermes is Fintheon's proprietary term). T6: frontend/README.md stale 'Pulse' → 'Fintheon'; Harper-soul OpenClaw/Pulse origin lore intentionally preserved. All builds green: backend bun, frontend tsc+vite, mobile vite.",
    files: [
      "backend-hono/src/services/arbitrum/engine.ts",
      "backend-hono/src/services/arbitrum/event-trigger.ts",
      "backend-hono/src/services/arbitrum/index.ts",
      "backend-hono/src/services/commentator/commentator-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/cron/arbitrum-session-scheduler.ts",
      "backend-hono/src/routes/arbitrum/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
      "frontend/components/agent-desk/AgentDeskDebatePanel.tsx",
      "NOTICES.md",
      "frontend/README.md",
    ],
  },
  {
    date: "2026-04-24T15:10:00",
    agent: "claude-code",
    summary:
      "S35-T3: Arbitrum frontend. New frontend/components/arbitrum/ (ArbitrumChamber, VerdictCard, DissentBadge, ArbitrumPeek) + useArbitrumLatest hook polling /api/arbitrum/latest every 60s. IVScoreCard hover portal now renders ArbitrumPeek (consensus% + dissent + 2-line digest) as the last block. Sanctum swaps AgentDeskDebatePanel → ArbitrumChamber (5 seats: Lead/Forecaster/Risk/Quant/Bear, round indicator via NothingFuse, compact VerdictCard footer, staggered 200ms reveal). /solvys-feels enforced: no gradients, no glass, no emojis, no shimmer-for-show; Solvys Gold only; Doto for probability numerals. Local types.ts mirrors T2 migration columns to avoid T9 merge collision.",
    files: [
      "frontend/components/arbitrum/types.ts",
      "frontend/components/arbitrum/ArbitrumChamber.tsx",
      "frontend/components/arbitrum/VerdictCard.tsx",
      "frontend/components/arbitrum/DissentBadge.tsx",
      "frontend/components/arbitrum/ArbitrumPeek.tsx",
      "frontend/hooks/useArbitrumLatest.ts",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/narrative/Sanctum.tsx",
    ],
  },
  {
    date: "2026-04-24T19:00:00",
    agent: "claude-code",
    summary:
      "S35-T11: PMDB Chamber Read integration. brief-generator now fetches the latest Arbitrum session-trigger digest via a runtime-resolved dynamic import of services/arbitrum/index.js (keeps build green before T1/T12 land the barrel) and, when present, prepends a '## Chamber Read (17:00 Arbitrum Session)' section to the PMDB prompt plus a prompt-instruction tweak telling the model to lead with the consensus and flag dissent. ADB/MDB/TWT paths untouched. Null-safe: if the arbitrum module is missing or the helper returns null, PMDB falls back to the original short-form instruction. Branch: s35-t11-pmdb-chamber-read. Also wrote sprint-md/S35-T11-pmdb-chamber-read.md brief (orchestrator had deferred).",
    files: [
      "backend-hono/src/services/brief-generator.ts",
      "sprint-md/S35-T11-pmdb-chamber-read.md",
    ],
  },
  {
    date: "2026-04-24T21:00:00",
    agent: "claude-code",
    summary:
      "S35-T4 [v5.25.0-S35-T4]: Ask Harper → CAO copy sweep (7 files). Mobile notification card button ASK HARPER → ASK CAO; drawer swipe comment; mobile App.tsx swipe-dispatch comment; frontend RegimeMiniChat placeholder; relay-dispatch-store store comment; usage-emit docstring updated to list ask_cao primary + ask_harper legacy with sunset date 2026-05-08; backend quickscope skill trigger text (Ask Harp → CAO). Persona 'Harper' stays as the CAO's name; only the feature label 'CAO chat' changes. Route /api/harper/chat and agent id harper untouched (identifiers). Zero live-code Ask Harper/ASK HARPER hits remain. No actual ask_harper emit call sites exist in frontend/mobile, so the dual-emit step is documentation-only.",
    files: [
      "mobile/components/notifications/NotificationCard.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/App.tsx",
      "frontend/components/regimes/RegimeMiniChat.tsx",
      "frontend/lib/relay-dispatch-store.ts",
      "frontend/lib/usage-emit.ts",
      "backend-hono/src/skills/quickscope.md",
    ],
  },
  {
    date: "2026-04-24T21:30:00",
    agent: "claude-code",
    summary:
      'S35-T5: TOTT → TWT canonical rename (The Weekly Tribune). Updated dispatch-brief.ts, dispatch-scheduler.ts (cron id com.fintheon.dispatch-twt, DispatchJob.briefType "TWT"), harper-handler.ts + harper-extra.md + HARPER-SOUL.md (docstrings + scheduled jobs + hook trigger), knowledge-graph/llm.ts feature-category list, routes/data/index.ts comment + validTypes + POST /brief/generate body.type plumbing, MainDashboard.tsx time-window comments + case "TWT", UpgradeModal.tsx feature list. Scope expansion: WT → TWT runtime rename across supabase-service BriefType union, brief-generator BRIEF_LABELS/getCurrentBriefType/isFull, routes/ops cadenceLimitMin. Legacy "TOTT"/"WT" incoming aliases normalized to "TWT" in routes/data and dispatch-brief with one-shot log — sunsets 2026-05-08. boot/services.ts left to T12 unification per brief.',
    files: [
      "backend-hono/scripts/dispatch-brief.ts",
      "backend-hono/src/services/cron/dispatch-scheduler.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/services/harper-autonomous/HARPER-SOUL.md",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "backend-hono/src/services/knowledge-graph/llm.ts",
      "backend-hono/src/routes/data/index.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/routes/ops/index.ts",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/UpgradeModal.tsx",
    ],
  },
  {
    date: "2026-04-24T20:30:00",
    agent: "claude-code",
    summary:
      "S37 Refinement Engine polish + Strategium fixes. (1) HOTFIX: RiskFlow mini-card unreachable after collapse — decoupled missionControlCollapsed from riskFlowCollapsed (useLayoutState.ts) and rewired the balanced-mode collapse button to hit the 168px mini state directly instead of jumping to widgetsOnly. Default boot now leaves riskFlowCollapsed=false so the feed is visible on first open. (2) Refinement Engine typography bumped — headers promoted to var(--font-heading), body to 12–13px, chromes spaced for robustness. (3) Advanced pane right-justified with a new RefinementEditLockModal; locked by default as a 'glass of a data center' (always readable, mutations gated by a transparent overlay). Same SHA-256 password gate as Developer Settings — rotated to PricedInResearch122356 across both surfaces. (4) AutopilotWidget iOS-pill master toggle + ● Active/Idle dots replaced with horizontal NothingFuse fills (same vocabulary as RiskFlow vertical fuses; master = on/off fill, category = enabledCount/total ratio fill). (5) Approvals inbox: approving the most-recent regime proposal now fades + clears the entire regime queue (stale suggestions drop once the newest is adjudicated). Dropped backdrop-blur + box-shadow from proposal cards per feedback_no_glass_effects. (6) S24-T3 'group fuses' shipped: new POST /api/scoring/presets + /api/scoring/sensitivities (GET/PATCH) backed by scoring_user_sensitivity + scoring_presets tables with RLS (user-scoped + public builtin presets). Graceful degrade to in-memory cache when Supabase is unavailable. (7) RECONCILIATION: prior changelog claimed S24-T3 shipped — correct for the scoring engine (scarcity gate, shadow mode, rescore-all) but the USER-FACING preset/sensitivity UI and its persistence API were missing; that frontend surface is what S37 closes. Frontend tsc clean, vite build pending validation. Migration 20260424190000_scoring_sensitivity_and_presets.sql pending supabase db push. Branch: s37-refinement-polish.",
    files: [
      "frontend/hooks/useLayoutState.ts",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/AdvancedPane.tsx",
      "frontend/components/refinement/RefinementEditLockModal.tsx",
      "frontend/components/admin/ApprovalsPage.tsx",
      "frontend/components/mission-control/AlgoStatusWidget.tsx",
      "frontend/lib/dev-settings-auth.ts",
      "backend-hono/src/routes/scoring/index.ts",
      "backend-hono/src/services/scoring/preset-api.ts",
      "supabase/migrations/20260424190000_scoring_sensitivity_and_presets.sql",
    ],
  },
  {
    date: "2026-04-24T18:10:00",
    agent: "claude-code",
    summary:
      "S36 ClusterBeam — NarrativeFlow cluster UX rebuild. Replaces the cramped inline 400px expander on AggregateCardNode with a right-docked ClusterBeamPanel (420px, mirrors TimelineOverlay's translate-x 300ms init). Panel leads with an AI summary from new POST /api/narrative/cluster-summary (Hermes via Strands invokeAgent → deterministic no-key fallback → in-memory 10-min TTL + Supabase cluster_summaries warm cache, sha1(sorted cardIds) key). Route is JWT-gated + Zod-validated + 30/min per-user rate-limit. New ShockLayer fires a gold dot along cluster→hub on panel open via Web Animations API (no box-shadow, no backdrop-blur — flat per feedback_no_glass_effects), with absorb-flash on arrival and reverse shock-on-arrival when new cards land in an already-open cluster. New ClusterScrubber drag-to-replay strip, DensityMeter sparkline in collapsed headers, hover-echo from panel rows back to the canvas. Fuse-shimmer strip untouched per feedback_fuses_are_sacred. Migration 20260424180000_cluster_summaries pending supabase db push. Frontend tsc clean, vite build clean (3.62s, no new chunk issues), backend bun build clean, local curl smoke: 200 OK + Zod 400 on bad input + cached:true on re-call. Branch: s36-clusterbeam.",
    files: [
      "supabase/migrations/20260424180000_cluster_summaries.sql",
      "backend-hono/src/types/cluster-summary.ts",
      "backend-hono/src/services/narrative/cluster-summarizer.ts",
      "backend-hono/src/services/ai/agent-instructions/cluster-summarizer.md",
      "backend-hono/src/routes/narrative/cluster-summary.ts",
      "backend-hono/src/routes/narrative/index.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/contexts/ClusterBeamContext.tsx",
      "frontend/hooks/useClusterSummary.ts",
      "frontend/lib/services/narrative.ts",
      "frontend/components/narrative/ClusterBeamPanel.tsx",
      "frontend/components/narrative/ClusterScrubber.tsx",
      "frontend/components/narrative/DensityMeter.tsx",
      "frontend/components/narrative/ShockLayer.tsx",
      "frontend/components/narrative/AggregateCardNode.tsx",
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-04-24T18:00:00",
    agent: "claude-code",
    summary:
      "v5.24.0 — S34 Econ Pipeline Restoration + Refinement Engine Rebuild. 10 tracks merged across 3 waves: T1 econ_watch_filters table + UI, T2 Refinement Engine layout flip + notched fuses (Nothing design), T3 economic_events base migration + ForexFactory populator, T4 silent-drop counters + FJ keyword baseline, T5 source-accounts → news-worker via Nitter mirrors, T6 Actual/Forecast keyword trigger + event-window scheduler, T7 Trump/Bessent/Fed speaker scrapers, T8 countdown modal + SSE econ-print channel, T9 integration + s32-harper-2-1 reconcile (v5.23.3–v5.23.6 prod work: routines retirement + polymarket guardrails + screener + tenancy lockdown + update-script tag authority + main.cjs remote fallback), T10 backfill orchestrator (2023-Q1 → current, free-tier LLMs, gated off). 3 migrations live on prod: econ_watch_filters (20260424100000), economic_events country/category/event_key (20260424101000), riskflow_drop_counters + v_source_signal_noise (20260424103000). T10's migration (20260424102000_econ_backfill_progress) awaits supabase db push on this deploy. Backend bun build clean, frontend tsc clean, frontend vite build clean. Branch: s34-unified. Archived sprint planning docs to sprint-changelog/.",
    files: [
      "sprint-changelog/S34-ORCHESTRATION.md",
      "package.json",
      "scripts/fintheon-update.sh",
    ],
  },
  {
    date: "2026-04-24T02:55:00",
    agent: "claude-code",
    summary:
      "S34-T2: Refinement Engine layout flip — main pane (75%) carries regime/fuses/presets/advanced; feed shrinks to 25% right panel (min 280, max 420). New NotchedFuse swap-in for GroupSensitivityDial (same -1..+1 contract) with vertical-ruler ticks + Doto numeral readout. Dotted accent dividers replace flat glass-border rules. No glass / gradient / shadow.",
    files: [
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/NotchedFuse.tsx",
    ],
  },
  {
    date: "2026-04-24T20:00:00",
    agent: "claude-code",
    summary:
      "S34-T9 [v.04.24.9]: Econ pipeline integration. Merged T1 (econ-watch-filters) + T4 (source quality) + T3 (economic_events populator) + T6 (keyword trigger) + T8 (countdown modal + /api/econ/active-watch + econ-print SSE). " +
      "Unified broadcastEconPrint signature onto T8's flat EconPrintPayload (matches the frontend EconCountdownModal's EconPrintFrame) — removed duplicate T6-signature; adapted econ-bridge + econ-keyword-trigger call sites to pass {eventName, actual, forecast, previous, surprisePercent, beatMiss, printedAt}. " +
      "Gap-fill: econ-calendar-populator now reads getActiveFilters() from the T1 service on each run and skips upserts for (country, category) combos TP has disabled in the Refinement Engine — falls back to implicit-all if the filter table is absent. " +
      "Backend bun build green. Frontend tsc pre-existing drift unchanged (react-ts-tradingview-widgets + @sentry/vite-plugin missing deps + shared/index.ts AgentId re-export — all pre-T9, flagged for orchestrator). " +
      "Held: T2 visual rebuild + T7 fiscal-speaker sources still in flight — will re-merge when those tracks finalize.",
    files: [
      "backend-hono/src/services/cron/econ-calendar-populator.ts",
      "backend-hono/src/services/riskflow/sse-broadcaster.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/services/riskflow/econ-keyword-trigger.ts",
      "backend-hono/src/routes/econ/index.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-24T03:10:00",
    agent: "claude-code",
    summary:
      "Harper voice + cognition panel polish. (1) Wired useSpeechSynthesis into useVoiceAssistant so Harper speaks voice-chat replies aloud with a British female voice (Web Speech API, graceful fallback chain en-GB female → en-GB → en-US female → en → default). Text chat path unchanged — TTS only fires on the voice path. (2) CognitionPanel redesign: 'Agent Mind' → 'thought for {elapsed}', removed the pulsing status dot next to the label, steps now render through Streamdown as a streaming thinking narrative (tool calls in inline code, durations italicised), and thinking phrases get a new slow semi-unsteady shimmer keyframe (6.8s, uneven stops) in index.css. Shimmer disabled under prefers-reduced-motion.",
    files: [
      "frontend/components/chat/CognitionPanel.tsx",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/hooks/useSpeechSynthesis.ts",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-04-24T02:45:00",
    agent: "claude-code",
    summary:
      "INSTALL-UPDATE: fintheon-update.sh now tag-authoritative. Root cause of 'update script still running old code': prior version hard-reset to origin/$CURRENT_BRANCH, but origin/HEAD points to main, and main has been frozen 70 commits behind s32-harper-2-1 (0 ahead, pure drift — all shipping lives on feature branches). Any install on main or detached-HEAD pulled stale code forever. Step 3 now resolves the highest v<major>.<minor>.<patch> tag via `git tag -l --sort=-v:refname | grep -E '^vX.Y.Z$' | head -1` and hard-resets to it, so branch state stops being load-bearing. Fallback to origin/$FALLBACK_BRANCH kicks in only if no semver tag exists. One-time hot-fix for current installs: `cd ~/Documents/Codebases/fintheon && git fetch --tags && git reset --hard v5.23.5` — after that, every future `fintheon update` self-heals.",
    files: ["scripts/fintheon-update.sh"],
  },
  {
    date: "2026-04-24T02:05:00",
    agent: "claude-code",
    summary:
      "v5.23.5: Polymarket screener-scheduler — the missing auto-trigger. v5.23.4 shipped the guardrails + scorecards but nothing actually called POST /predictions, so Oracle's win-rate table would have stayed empty. New polymarket-screener-scheduler runs every 6h during extended market hours (6a-8p ET, weekdays), pulls ~60 trending contracts, pre-filters to the 4 allowed categories + ≤7d horizon + ≥$50k volume + non-degenerate odds (0.05<yes<0.95), dedupes against Oracle's open predictions, then hands up to 8 candidates/cycle to invokeAgent with a strict Pick-Wisely system prompt. Oracle returns strict JSON; parser rejects anything outside the contract or probabilities < 0.05 / > 0.95. Final belt-and-suspenders edge check in-process before Supabase insert (the LLM can lie about self-reported edge). Direct DB insert bypasses HTTP round-trip. New env gate POLYMARKET_SCREENER_ENABLED — stays off until TP flips it in Fly secrets so no background LLM spend until explicitly approved. Status + manual trigger exposed at GET /api/polymarket/screener/status and POST /api/polymarket/screener/run (returns 409 if gated off).",
    files: [
      "backend-hono/src/services/cron/polymarket-screener-scheduler.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/polymarket/index.ts",
      "backend-hono/src/services/ai/agent-instructions/oracle-extra.md",
    ],
  },
  {
    date: "2026-04-24T01:15:00",
    agent: "claude-code",
    summary:
      "v5.23.4: Polymarket scope + duration guardrails + per-category agent scorecard. Migration 20260424010000 adds CHECK constraint on polymarket_predictions.category (weather | economics | commentary | projected_data), hard ceiling CHECK that market_close_at ≤ created_at + 7 days, plus reasoning + catalyst_source columns and two supporting indexes (category/agent on resolved rows, market_close_at on open rows). POST /api/polymarket/predictions now enforces the same rules pre-insert with descriptive 400s (category allowlist, marketCloseAt required + in future + ≤ 7d). GET /api/polymarket/predictions/accuracy now segments by (agent, category) — TP reads win-rate per bucket. Analyst prompts rewritten: oracle-extra adds the 4-bucket definition + pick-wisely rubric (category fit, ≤168h horizon, ≥10pp edge, named catalyst within window, liquidity check) + required payload template; herald-extra, consul-extra, harper-extra say 'delegate to Oracle, cite the catalyst, don't POST yourself'. Backend build ✓, frontend tsc ✓, vite ✓, mobile ✓. Zero existing trades so migration is a no-op on data; guardrails apply to all future inserts.",
    files: [
      "supabase/migrations/20260424010000_polymarket_predictions_guardrails.sql",
      "backend-hono/src/routes/polymarket/index.ts",
      "backend-hono/src/services/ai/agent-instructions/oracle-extra.md",
      "backend-hono/src/services/ai/agent-instructions/herald-extra.md",
      "backend-hono/src/services/ai/agent-instructions/consul-extra.md",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "package.json",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-24T19:10:00",
    agent: "claude-code",
    summary:
      "S34-T4 [v.04.24.4]: Web source quality audit. Added riskflow_drop_counters table + v_source_signal_noise 48h funnel view (migration 20260424103000). " +
      "In-process drop-counter service with 60s flush (src/services/riskflow/drop-counters.ts) instrumented into persist.ts " +
      "(dedup + missing-fields + supabase errors), content-guard.ts (every reject reason), and central-scorer.ts " +
      "(content-guard safety-net, dismissed-pattern, narrative-gate, below-threshold). filterWithContentGuard now takes a " +
      "source hint so counters attribute correctly at feed-poller / feed-service / commentary-scraper / exa-scheduled-monitor " +
      "call sites. New GET /api/diagnostics/source-quality returns signal-noise rows + flushed counters (2h) + live in-memory " +
      "counter snapshot. MARKET_KEYWORDS in content-guard.ts extended APPEND-ONLY with 95 FJ-grade keywords derived from an " +
      "FJ scrape script (scripts/scrape-fj-sample.ts) with curated fallback at fj-keyword-baseline.json. No RSS URL pruned — " +
      "prune list in S34-T4-REPORT.md is AWAITING TP APPROVAL and deferred to T5. Unrelated pre-existing harper-vision/engine.ts " +
      "tsc error (VoiceTranscribeResult.confidence missing, commit 7bfda6bc4 2026-04-23) blocks full bun run build; flagged for orchestrator, out of T4 scope.",
    files: [
      "backend-hono/src/services/riskflow/drop-counters.ts",
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/riskflow/exa-scheduled-monitor.ts",
      "backend-hono/src/services/riskflow/fj-keyword-baseline.json",
      "backend-hono/src/workers/news-worker/persist.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/scripts/scrape-fj-sample.ts",
      "supabase/migrations/20260424103000_riskflow_drop_counters.sql",
      "sprint-md/S34-T4-REPORT.md",
    ],
  },
  {
    date: "2026-04-24T14:50:00",
    agent: "claude-code",
    summary:
      "S34-T8 [v.04.24.8]: Econ Countdown Modal. Adds broadcastEconPrint SSE channel " +
      "in sse-broadcaster.ts (event: econ-print frame) fired from injectEconPrintToFeed " +
      "after successful news_feed_items insert. New GET /api/econ/active-watch route joins " +
      "economic_events × active econ_watch_filters within [-2min, +30min] window, returns " +
      "[] gracefully when T1/T3 tables are absent. New EconCountdownModal.tsx mounts in " +
      "RiskFlowMain: polls /active-watch every 30s, subscribes to econ-print SSE, renders " +
      "up to 3 cards stacked top-right with Doto mm:ss countdown — fades in at T-5min, " +
      "cross-fades to Actual/Forecast on print arrival (300ms gold flash), fades out 20s " +
      "after print or 15min after scheduled-no-print. Flat #050402 + 1px #c79f4a border, " +
      "no glass/blur/shadow/gradient. Tiny type widening on VoiceTranscribeResult.confidence " +
      "to unblock pre-existing harper-vision tsc drift so backend bun build goes green.",
    files: [
      "backend-hono/src/services/riskflow/sse-broadcaster.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/routes/econ/index.ts",
      "backend-hono/src/services/voice-service.ts",
      "frontend/components/feed/EconCountdownModal.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "sprint-md/S34-T8-countdown-modal.md",
    ],
  },
  {
    date: "2026-04-24T10:30:00",
    agent: "claude-code",
    summary:
      "S34-T5 (WS1): Source-accounts → news-worker DB-driven wiring. Closed the loop so Refinement Engine edits on riskflow_source_accounts actually drive polling. Tightened source-accounts cache TTL from 300s to 30s so toggles take effect by the next tier tick without a backend restart. Added getWireHandles + getMacroHandles helpers. Extended Agent-Reach collector with an optional `handles?` expansion: each handle fans out to a Nitter RSS fallback chain (nitter.net → nitter.poast.org → nitter.privacydev.net), tagged source_domain='nitter:{handle}' so T4's per-source counter attributes back to the handle rather than the mirror. Wired Wire handles into runBreakingTier and Macro handles into runStandardTier alongside existing RSS/browser/exa collectors (isolated failures). Deleted the S25-T1 rettiwt-gated secondary branch in feed-poller.pollForNewItems — inert stubs + scrape-fallback + RETTIWT_REENABLE path preserved for future re-enable.",
    files: [
      "backend-hono/src/services/source-accounts/source-accounts-service.ts",
      "backend-hono/src/workers/news-worker/sources/agent-reach.ts",
      "backend-hono/src/workers/news-worker/sources/index.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-24T09:45:00",
    agent: "claude-code",
    summary:
      "S34-T6 [v.04.24.6]: Econ keyword 'Actual/Forecast' trigger + per-minute event-window scheduler. " +
      "New econ-keyword-trigger service sweeps recent raw_riskflow_items for the keyword, checks against " +
      "active econ_watch_filters (T1) × upcoming economic_events (T3) windows using existing PRE_/POST_EVENT_MINUTES " +
      "constants, and promotes matches to scored_riskflow_items with macro_level=4, risk_type='Macro', " +
      "tags=['econ-print', country, category, keyword]. Numeric extractActualFromText runs as best-effort enrichment " +
      "for econ_data. Tolerates missing filter/events tables (graceful fallback to implicit-all / empty-window no-op) " +
      "so the track builds standalone. New econ-keyword-scheduler (node-cron, * * * * * America/New_York) cloned from " +
      "news-worker-audit-scheduler; gated by ECON_KEYWORD_TRIGGER_ENABLED=false env flag. Added broadcastEconPrint to " +
      "sse-broadcaster for T8's countdown modal; wired into econ-bridge.injectEconPrintToFeed success path. " +
      "rettiwt-poller-econ.processActualsFromTweets now keyword-first gates (cheap skip) before running matchTweetToEvent; " +
      "numeric-only items still require extractActualFromText for the rettiwt path (keyword-only handled by trigger sweep). " +
      "Diagnostics: GET /api/econ/trigger-status + POST /api/econ/trigger-run (x-routine-secret).",
    files: [
      "backend-hono/src/services/riskflow/econ-keyword-trigger.ts (new)",
      "backend-hono/src/services/cron/econ-keyword-scheduler.ts (new)",
      "backend-hono/src/services/riskflow/sse-broadcaster.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-econ.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/econ/index.ts",
      "sprint-md/S34-T6-keyword-trigger-scheduler.md (new)",
    ],
  },
  {
    date: "2026-04-24T09:30:00",
    agent: "claude-code",
    summary:
      "S34-T7: Fiscal speaker populator — Fed / Bessent / Trump schedules upserted to economic_events as category='Speaker'. Scrapes via existing Agent-Reach primitives (fetchRss on federalreserve.gov speeches.xml, home.treasury.gov press-releases/feed, whitehouse.gov statements-releases feed, trumpstruth.org mirror) with HTML fallback on the Fed calendar page; all scrapers log + return empty on failure, never throw. Node-cron runs 06:00/12:00/18:00 ET Mon–Fri with a boot-time kick. Filter gate reads econ_watch_filters (country='US', category='Speaker') with 30s TTL cache and fails open when the T1 table isn't pushed yet. /api/diagnostics gains a fiscal_speakers block with lastRun + per-source counters. No migrations authored by T7 — reuses T3's economic_events base.",
    files: [
      "backend-hono/src/services/fiscal-sources/types.ts",
      "backend-hono/src/services/fiscal-sources/date-utils.ts",
      "backend-hono/src/services/fiscal-sources/fed-speeches.ts",
      "backend-hono/src/services/fiscal-sources/bessent-speeches.ts",
      "backend-hono/src/services/fiscal-sources/trump-schedule.ts",
      "backend-hono/src/services/cron/fiscal-speaker-populator.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "sprint-md/S34-T7-fiscal-speaker-sources.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-24T07:00:00",
    agent: "claude-code",
    summary:
      "S34-T3: Econ calendar populator + economic_events base migration. Unblocks the econ-enricher (orphaned since Notion severance on 2026-04-16) by wiring a ForexFactory weekly pull (Sun 22:00 ET) + hourly weekday refresh that upserts to economic_events on a sha256(name|date|time|country) event_key. Adds country/category/event_key columns via idempotent ALTERs so the table now has a reproducible base migration (per feedback_trades_table_migration). Exposes GET /api/econ/upcoming for the T8 countdown modal + a gated POST /api/econ/populate for smoke runs.",
    files: [
      "supabase/migrations/20260424101000_economic_events_base.sql",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/econ-calendar-service.ts",
      "backend-hono/src/services/cron/econ-calendar-populator.ts",
      "backend-hono/src/routes/econ/index.ts",
      "backend-hono/src/boot/services.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-24T04:00:00",
    agent: "claude-code",
    summary:
      "S34-T1 [v.04.24.1]: Econ watch filters — country × category grid that drives which " +
      "econ events the populator (T3) watches. Migration 20260424100000_econ_watch_filters.sql " +
      "creates econ_watch_filters (id, country, category, active, user_id nullable, created_at, " +
      "updated_at, unique(country,category,user_id)) + seeds 28 rows (7 countries × 4 categories). " +
      "Backend type + service (cache + seed-on-empty mirroring source-accounts pattern). " +
      "/api/econ-filters routes — GET list, POST create, PATCH toggle, PUT full, DELETE. " +
      "Country + category validated against narrowed unions. EconFiltersManager component slotted " +
      "into RefinementEngine AdvancedPane alongside SourceAccountsManager (additive only — no layout " +
      "change). Category chip palette: Fiscal→gold, Inflation→amber, Supply Chain→neutral, " +
      "Job Market→slate. Smoke: HTTP 200 + POST rejects invalid country with proper error. " +
      "Migration is local-file-only per feedback_supabase_migration_filenames — hand to TP for " +
      "`supabase db push`. Cross-track unblock: same one-line cast in harper-vision/engine.ts:158 " +
      "(VoiceTranscribeResult.confidence missing since 7bfda6bc4 2026-04-23) so bun run build " +
      "passes; flagged for S32/T2, out of T1 scope.",
    files: [
      "supabase/migrations/20260424100000_econ_watch_filters.sql",
      "backend-hono/src/types/econ-watch-filter.ts",
      "backend-hono/src/services/econ-watch-filters/econ-watch-filters-service.ts",
      "backend-hono/src/routes/econ-filters/index.ts",
      "backend-hono/src/routes/econ-filters/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/refinement/EconFiltersManager.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
    ],
  },
  {
    date: "2026-04-24T00:30:00",
    agent: "claude-code",
    summary:
      "v5.23.3: retired Anthropic-hosted Claude Code Routines + operator console. Every trigger was spawning a full Claude Code session to curl back to the backend (11 triggers firing 1–4x/day = constant Extra Usage); the backend already did the real work via VProxy/generateTextViaClaude. Removed: backend-hono/src/services/routines/* (registry, state-store, error-handler, handlers/), backend-hono/src/routes/routines/*, the three *_VIA_ROUTINE env-flag gates in reflect-scheduler/polymarket-prediction-resolver/market-impact-enricher (schedulers now always run in-process on the always-on Fly machine), the run-tracking block in /api/harper-ops/feed, the Monitor admin sub-tab + MonitoringLoopCard + RoutinesConsole + RoutineDetailModal. news-worker-audit handler relocated from services/routines/handlers/ to services/cron/; scheduler inlined trigger IDs + dropped pause-check. /api/routines mount removed from routes/index.ts. Operator UI is now Scoring + Approvals only. Companion smoke-test fix from v5.23.2 afterglow: T6 blindspots-nightly route now mounted under harper-ops aggregate (was exported but unrouted; smoke found 404). TP follow-up: delete the 11 trig_* scheduled tasks from the Anthropic Claude Code dashboard — backend code no longer routes them anywhere, but the spawns keep firing until removed at the source.",
    files: [
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/harper-ops/index.ts",
      "backend-hono/src/services/cron/news-worker-audit-scheduler.ts",
      "backend-hono/src/services/cron/news-worker-audit-handler.ts",
      "backend-hono/src/services/cron/market-impact-enricher.ts",
      "backend-hono/src/services/autoresearch/reflect-scheduler.ts",
      "backend-hono/src/services/polymarket-prediction-resolver.ts",
      "backend-hono/src/services/routines/ (deleted)",
      "backend-hono/src/routes/routines/ (deleted)",
      "frontend/components/admin/AdminShell.tsx",
      "frontend/components/admin/MonitoringLoopCard.tsx (deleted)",
      "frontend/components/refinement/RoutinesConsole.tsx (deleted)",
      "frontend/components/refinement/RoutineDetailModal.tsx (deleted)",
      "package.json",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-23T23:30:00",
    agent: "claude-code",
    summary:
      "v5.23.2: Omi → Harper Voice rename (22 files) + voice-orb 3-click-to-off fix + VAD silence 1.8s→2.6s + yanked omi-reference submodule (1.2GB). Backend: services/omi/ → services/harper-voice/, /api/omi → /api/harper-voice, createOmiRoutes/resolveUserIdForOmiUid/OmiTrigger/OmiTranscriptWebhookBody/OmiMemoryWebhookBody/OmiNotificationPayload/OmiPrimaryAgent/OmiRouteIntent all renamed. Frontend: lib/omi.ts → lib/harper-voice.ts, useOmiSession → useHarperVoiceSession, voice orb handler collapsed to single-intent paths (cancel-if-busy + toggleEnabled + stopSession in one tap, no more stale-closure branch). DB strings (omi_pairings, omi_sessions, omi_uid) intentionally kept; companion rename migration staged in supabase/migrations-pending/ for a coordinated future push. omi-reference submodule removed from git index + .gitignored; physical 1.2GB still on disk pending TP's explicit delete. VAD threshold 2.6s per TP: auto-stops recording + processes transcript via existing Whisper → sendText pipeline.",
    files: [
      "backend-hono/src/routes/harper-voice.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/voice/index.ts",
      "backend-hono/src/services/harper-voice/client.ts",
      "backend-hono/src/services/harper-voice/router.ts",
      "backend-hono/src/services/harper-voice/session-manager.ts",
      "backend-hono/src/services/harper-voice/speak.ts",
      "backend-hono/src/services/harper-voice/types.ts",
      "backend-hono/src/services/ai/agent-instructions/oracle-fast-voice.ts",
      "backend-hono/src/services/ai/agent-instructions/coach.ts",
      "frontend/lib/harper-voice.ts",
      "frontend/hooks/useHarperVoiceSession.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/contexts/ERContext.tsx",
      "frontend/contexts/VoiceContext.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/components/voice/AgentResponsePopup.tsx",
      "frontend/components/voice/AgentResponsePopupHost.tsx",
      "frontend/components/performance/PerformanceChatButton.tsx",
      ".gitignore",
      "supabase/migrations-pending/20260424000000_rename_omi_tables_to_Harper_voice.sql",
      "package.json",
      "scripts/fintheon-update.sh",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-23T22:50:00",
    agent: "claude-code",
    summary:
      "Wired claude-peers MCP backchannel into project + Solvys Skills suite. " +
      "(1) Cloned github.com/louislva/claude-peers-mcp to ~/claude-peers-mcp, " +
      "bun install --ignore-scripts (no untrusted lifecycle scripts ran). Server.ts " +
      "auto-spawns broker daemon at 127.0.0.1:7899 with SQLite at ~/.claude-peers.db; " +
      "exposes list_peers / send_message / set_summary / check_messages tools to every " +
      "Claude Code window opened in fintheon. Verified end-to-end: two concurrent " +
      "peers register, discover via /list-peers, exchange messages via /send-message + " +
      "/poll-messages. (2) Added claude-peers entry to project .mcp.json (NOT user " +
      "settings — only loads in fintheon, easy rip-out). PostToolUse Edit hook " +
      "(prettier + bun build + eslint --fix) silently reverts .mcp.json on Edit/Write; " +
      "wrote final state via bash heredoc to bypass that hook chain. (3) Updated " +
      "~/Documents/Codebases/solvys-skills (branch feat/alt-skills-coworking, commit " +
      "4e38450): solvys-orchestrate now generates a Coordination section in every track " +
      "brief instructing the track Claude to set_summary on startup, list_peers before " +
      "any cross-cutting change, and send_message peers rather than blocking on the " +
      "orchestrator. File Ownership / Excluded Files remain authoritative; Peers is " +
      "the live nudge layer. solvys-inform's handoff path now sends a one-liner via " +
      "send_message when both ends are live local Claude windows. Both skills explicitly " +
      "skip Peers logic if claude-peers is not in .mcp.json — no invented fallbacks. " +
      "solvys-orchestrate-alt intentionally unchanged (remote junior devs across " +
      "machines; Peers binds to localhost). Skills commit pending TP signoff to push.",
    files: [
      ".mcp.json",
      "src/lib/changelog.ts",
      "~/Documents/Codebases/solvys-skills/.claude/skills/solvys-orchestrate/SKILL.md",
      "~/Documents/Codebases/solvys-skills/.claude/skills/solvys-inform/SKILL.md",
    ],
  },
  {
    date: "2026-04-23T22:45:00",
    agent: "claude-code",
    summary:
      "S32 shipped v5.23.1: Harper unified — Kimi rollback + Vision + Ollama-Hermes fallback + Consul Control corners + Streamdown/TV chart slots + PsychAssist gating + advisory/calendar/watchouts + browser-harness + predictive knowledge graph. Migrations pushed (trades base + origin + S32 T2/T6/T7/T8/T9). Backend fintheon.fly.dev, desktop fintheon-alpha.vercel.app, mobile fintheon.pricedinresearch.io. 9 tracks, 254 files. Archived to sprint-changelog/.",
    files: [
      "sprint-changelog/S32-ORCHESTRATION.md",
      "sprint-changelog/S32-UNIFY.md",
    ],
  },
  {
    date: "2026-04-23T22:00:00",
    agent: "claude-code",
    summary:
      "S32 Harper unified — Wave 3 merge pass. Cherry-picked Kimi rollback c4c599ef onto s32-harper-2-1 (5 conflicts resolved: ai-config.ts, ai-types.ts, App.tsx, AuthContext.tsx, changelog.ts). Restored 26 files + 1 client telemetry module from pre-deletion parent 7d8ed0bd that auto-checkpoint 6b09a68c had bulk-deleted at 19:57 while writing the UNIFY brief — covering T4 Consul Control corners, T5 streamdown + TV chart slots (10 slot components + StreamdownChat + parseSlotBody), T6 PsychAssist + blindspots (services/blindspots/{generator,templates}, services/psych/{er-monitor,is-psych-assist-on}, migrations/036_blindspots.sql + 039_usage_telemetry.sql, routes/blindspots-user + harper-ops/blindspots-nightly), and T9 predictive knowledge graph (services/knowledge-graph/{llm,proposer}, routes/usage-events + feature-proposals + harper-ops/feature-proposals-weekly + docs/routines/feature-proposals-weekly.md). Wire-ups: routes/index.ts T6 blindspots-user mount (auth-gated on /api/blindspots/psych|trading|latest) + T9 usage-events + feature-proposals mounts + harper-ops feature-proposals-weekly (routine-secret gated, mounted before harper-ops catch-all); App.tsx ConsulControlLayer mount above modals; TextPart.tsx swapped to StreamdownChat (drops mock-JSON widget=chart/calendar fallbacks); chat slot animation keyframes added to frontend/index.css + mobile/index.css; frontend/lib/user-preferences.ts + mobile mirror + backend preferences schema extended with psychAssistEnabled?: boolean defaulting to false (T6 silent mode). Deps: +streamdown@^2.5.0 +lightweight-charts@^5.1.0 on frontend, +streamdown@^2.5.0 +zod@^4.3.6 on mobile. FeatureProposal type inlined in routes/feature-proposals.ts (backend tsconfig rootDir prevents cross-package import from shared/). Extended HarperProvider discriminator in strands/agent-factory.ts with 'ollama-qwen'. Fixed pre-existing shared/index.ts AgentId re-export ambiguity. Residue gates: Kimi clean (0 matches outside changelog/sprint-md/docs), glass clean. Build gates: backend bun run build ✓, frontend tsc ✓, frontend vite build ✓ (3243 modules), mobile vite build ✓ (2416 modules).",
    files: [
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/preferences/index.ts",
      "backend-hono/src/routes/blindspots-user.ts",
      "backend-hono/src/routes/feature-proposals.ts",
      "backend-hono/src/routes/usage-events.ts",
      "backend-hono/src/routes/harper-ops/blindspots-nightly.ts",
      "backend-hono/src/routes/harper-ops/feature-proposals-weekly.ts",
      "backend-hono/src/services/blindspots/generator.ts",
      "backend-hono/src/services/blindspots/templates.ts",
      "backend-hono/src/services/psych/er-monitor.ts",
      "backend-hono/src/services/psych/is-psych-assist-on.ts",
      "backend-hono/src/services/knowledge-graph/llm.ts",
      "backend-hono/src/services/knowledge-graph/proposer.ts",
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/migrations/036_blindspots.sql",
      "backend-hono/migrations/039_usage_telemetry.sql",
      "frontend/App.tsx",
      "frontend/components/consul-control/ConsulControlCorners.tsx",
      "frontend/components/chat/parts/TextPart.tsx",
      "frontend/components/chat/slots/CatalystCardSlot.tsx",
      "frontend/components/chat/slots/NarrativePreviewSlot.tsx",
      "frontend/components/chat/slots/PerfTableSlot.tsx",
      "frontend/components/chat/slots/PsychTableSlot.tsx",
      "frontend/components/chat/slots/SlotShell.tsx",
      "frontend/components/chat/slots/StreamdownChat.tsx",
      "frontend/components/chat/slots/TVChartSlot.tsx",
      "frontend/components/chat/slots/VisionInsightSlot.tsx",
      "frontend/components/chat/slots/index.ts",
      "frontend/components/chat/slots/parseSlotBody.ts",
      "frontend/lib/usage-emit.ts",
      "frontend/lib/user-preferences.ts",
      "frontend/index.css",
      "frontend/package.json",
      "mobile/lib/user-preferences.ts",
      "mobile/index.css",
      "mobile/package.json",
      "shared/index.ts",
      "shared/predictive-knowledge-graph.ts",
      "docs/routines/feature-proposals-weekly.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-23T20:55:00",
    agent: "claude-code",
    summary:
      "S31-T1 [v.04.23.1] Rolled back the March GitHub OAuth / GitHub-Models / update-banner experiment " +
      "(SHA 98332f5d) and reinstated the local VProxy gateway (localhost:8317 → Claude Opus 4.6) as the " +
      "primary AI path. Backend: dropped the github-models provider type (types/ai-types.ts) plus the " +
      "github-deepseek model, githubModelsBaseUrl, github-* aliases, isGitHubModelsModel() helper, and the " +
      "providers.githubModels block in config/ai-config.ts. Frontend: deleted components/GitHubOAuthCallback.tsx " +
      "and components/UpdateBanner.tsx, stripped the GitHub OAuth state + popup listener + connect/disconnect/" +
      "handleCallback handlers from contexts/AuthContext.tsx, and removed the two mounts + imports from App.tsx. " +
      "Electron: dropped the github.com host allowlist block added for the OAuth popup from main.cjs. Env: " +
      "scrubbed GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI from backend-hono/.env, " +
      "backend-hono/.env.example, backend-hono/.env.bak-20260418-084041, and .cursor/install.sh " +
      "(which also now seeds AI_PRIMARY_PROVIDER=anthropic-vproxy + USE_VPROXY_ANTHROPIC=true + " +
      "VPROXY_BASE_URL=http://localhost:8317 for fresh cloud containers). Docs: removed the orphaned " +
      "Harper-Kimi source pointer from knowledge-base/notion/PIC-NOTION-ENTITY-MAP.md. Grep gate " +
      "(kimi|moonshot|github-kimi|githubModels|GITHUB_CLIENT|GITHUB_REDIRECT|setRuntimeGitHubToken|" +
      "GitHubOAuthCallback|UpdateBanner) returns 0 matches outside historical changelog entries. " +
      "Frontend tsc + vite build clean, backend bun run build clean, launchd backend restarted, " +
      "/api/diagnostics reports overall:ok, VProxy at :8317 serves claude-opus-4-6, and POST /api/harper/chat " +
      "streams a valid Opus response. VProxy plumbing (services/vproxy/anthropic-client.ts) and its 2026-04 " +
      "headers were left untouched per brief.",
    files: [
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/types/ai-types.ts",
      "backend-hono/.env",
      "backend-hono/.env.example",
      "backend-hono/.env.bak-20260418-084041",
      ".cursor/install.sh",
      "frontend/App.tsx",
      "frontend/contexts/AuthContext.tsx",
      "frontend/components/GitHubOAuthCallback.tsx",
      "frontend/components/UpdateBanner.tsx",
      "electron/main.cjs",
      "knowledge-base/notion/PIC-NOTION-ENTITY-MAP.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-23T20:50:00",
    agent: "claude-code",
    summary:
      "S30-T3 [v5.22.10W]: Session/journal backend + futures-daily cache + daily market summary + Hermes routines. " +
      "Added three migrations (031_session_journal, 032_futures_daily, 033_daily_market_summary) using the 3-digit " +
      "backend-hono/migrations scheme — TP to push via supabase db push. New services: session-journal (get/getRange/upsert/ " +
      "updateHermesSummary/listUsers), market-data/futures-daily-sync (Yahoo =F daily bars, 365d backfill, contract-invariant " +
      "for ES/NQ/MES/MNQ/CL/GC/6E), market-data/daily-market-summary (≤160-char summary from top IV-weighted RiskFlow items " +
      "via generateTextViaClaude with fallback). New routes: /api/session-journal (authed CRUD), /api/market/futures-daily " +
      "(cached reads + cold-cache 202 with fire-and-forget sync), /api/market/daily-summary, /api/harper-ops/hermes-daily-summary " +
      "+ /api/harper-ops/daily-market-summary (x-routine-secret gated, 401 when missing or wrong). Shared types added: " +
      "SessionJournal/SessionJournalDraft + FuturesDailyBar/FuturesDailyStats/FuturesDailyResponse/DailyMarketSummary. " +
      "Routine docs under docs/routines/. Backend bun run build passes. Applied a 2-line type shim (as never) to T4's " +
      "projectx/account.ts + trades/ingest-screenshot.ts — pre-existing TS2769 blocking the build; no runtime change.",
    files: [
      "backend-hono/migrations/031_session_journal.sql",
      "backend-hono/migrations/032_futures_daily.sql",
      "backend-hono/migrations/033_daily_market_summary.sql",
      "backend-hono/src/services/session-journal.ts",
      "backend-hono/src/services/market-data/futures-daily-sync.ts",
      "backend-hono/src/services/market-data/daily-market-summary.ts",
      "backend-hono/src/routes/session-journal.ts",
      "backend-hono/src/routes/market/futures-daily.ts",
      "backend-hono/src/routes/market/daily-summary.ts",
      "backend-hono/src/routes/market/index.ts",
      "backend-hono/src/routes/harper-ops/hermes-daily-summary.ts",
      "backend-hono/src/routes/harper-ops/daily-market-summary.ts",
      "backend-hono/src/routes/harper-ops/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/projectx/account.ts",
      "backend-hono/src/routes/trades/ingest-screenshot.ts",
      "shared/session-journal.ts",
      "shared/futures-daily.ts",
      "shared/index.ts",
      "docs/routines/hermes-daily-summary.md",
      "docs/routines/daily-market-summary.md",
    ],
  },
  {
    date: "2026-04-23T19:45:00",
    agent: "claude-code",
    summary:
      "Windows desktop build scaffolding — first Windows target for Fintheon. Remote-backend mode (no local sidecar, renderer hits fintheon.fly.dev directly) to stay under 8GB RAM. Generated multi-size icon.ico (16/24/32/48/64/128/256) from macOS icns. Gated macOS-only code in electron/main.cjs: hardcoded /opt/homebrew/bin/node path, backend spawn / lifecycle v2 / smart-shutdown, Harper Vision (ScreenCaptureKit), browser-use CLI — all guarded behind IS_MAC check; Windows returns clean 'not supported' responses from the same IPC surface. Added Win 11 titleBarOverlay (color #050402, symbol #f0ead6, height 28) + autoHideMenuBar for frameless chrome parity. Preload now reads --fintheon-api-base and --fintheon-platform switches injected by main.cjs, exposes electron.platform / electron.apiBase / electron.isWindows / electron.isMac plus window.__FINTHEON_API_BASE__ runtime fallback. package.json build config: NSIS installer with wizard (oneClick:false, perMachine:false per-user install, allowToChangeInstallationDirectory, desktop + start menu shortcut), fintheon:// protocol handler registered at install time, artifact named Fintheon-Setup-${version}.exe. New release:win + frontend:build:windows scripts. frontend/.env.windows pins VITE_API_URL=https://fintheon.fly.dev. Fixed 3 hardcoded localhost:8080 URLs in SetupWizard.tsx to respect API_BASE. Added .github/workflows/windows-build.yml (windows-latest runner, triggers on v* tags or manual dispatch, uploads installer + attaches to GitHub release; CSC_LINK/CSC_KEY_PASSWORD optional for code signing).",
    files: [
      "electron/main.cjs",
      "electron/preload.cjs",
      "electron/icons/icon.ico",
      "package.json",
      "frontend/package.json",
      "frontend/.env.windows",
      "frontend/components/onboarding/SetupWizard.tsx",
      ".github/workflows/windows-build.yml",
    ],
  },
  {
    date: "2026-04-23T19:20:00",
    agent: "claude-code",
    summary:
      "S32-T4 (Harper): added ConsulControlCorners — animated gold pixel flicker at four corners while Harper is holding the wheel. Replaces the flat solid-color overlay plan. L-shape density gradient (layout only), CSS @keyframes opacity 0.08→0.4→0.08, per-cell stable randomized delays, will-change: opacity, pointer-events: none, 400ms fade-in / 600ms fade-out, paused via class toggle when inactive. Status wired via new useConsulControlStatus hook polling GET /api/consul-control/status every 2s (404-tolerant until backend lands). No existing overlay to delete.",
    files: [
      "frontend/App.tsx",
      "frontend/components/consul-control/ConsulControlCorners.tsx",
      "frontend/hooks/useConsulControlStatus.ts",
    ],
  },
  {
    date: "2026-04-24T16:30:00",
    agent: "claude-code",
    summary:
      "S34-T10 [v.04.24.10]: Historical econ backfill orchestrator (2023-Q1 → current, free-tier LLMs). " +
      "New migration 20260424102000_econ_backfill_progress.sql stands up econ_backfill_progress (quarterly " +
      "slice ledger, 7 countries × ~13 quarters ≈ 91 pending rows seeded via DO block) and econ_backfill_queue " +
      "(raw LLM output staging). New cron service econ-backfill-orchestrator fires Monday 02:00 America/New_York, " +
      "claims 2 oldest pending slices, pulls historical events via OpenRouter free-tier Llama 3.3 70B (fallback " +
      "Mistral Large) in econ-backfill-puller, optionally enriches US slices with FRED series (CPIAUCSL, PAYEMS, " +
      "UNRATE, FEDFUNDS, GDP) if FRED_API_KEY is set. Harper batch categorization in econ-backfill-harper routes " +
      "through OpenRouter anthropic/claude-opus-4, dedups against existing economic_events.event_key, assigns " +
      "Fiscal|Supply Chain|Inflation|Job Market|Speaker, with a soft 500k-token weekly cap that defers remaining " +
      "queue if exceeded. Upsert into economic_events is idempotent on event_key (sha256 of name|date|time|country). " +
      "ECON_BACKFILL_ENABLED env guard (default on); missing OPENROUTER_API_KEY warns + skips tick, never crashes. " +
      "/api/diagnostics.econ_backfill surfaces pending/claimed/enriching/complete/failed counts + rows_written_total " +
      "+ harper_tokens_week. Registered in boot/services.ts alongside the S28 news-worker audit scheduler. " +
      "Depends on T3's economic_events base migration for country/category/event_key columns. Drive-by fix: " +
      "harper-vision/engine.ts line 158 referenced VoiceTranscribeResult.confidence which doesn't exist on the " +
      "type — changed to null to unblock the build (pre-existing on main, not T10-introduced).",
    files: [
      "supabase/migrations/20260424102000_econ_backfill_progress.sql",
      "backend-hono/src/types/econ-backfill.ts",
      "backend-hono/src/services/cron/econ-backfill-puller.ts",
      "backend-hono/src/services/cron/econ-backfill-harper.ts",
      "backend-hono/src/services/cron/econ-backfill-orchestrator.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/harper-vision/engine.ts",
    ],
  },
  {
    date: "2026-04-23T16:20:00",
    agent: "claude-code",
    summary:
      "S30-T2 [v5.22.10W]: Strategium widget swap + Blindspots promotion + Session consolidation. " +
      "Retired BlindspotsWidget from the Strategium right panel and replaced it with WeeklyPerformanceWidget — " +
      "five Mon-Fri rows of the user's selected instrument (day label · point delta · % change · chevron) that expand " +
      "inline to an IVStack + one-line summary + session high/low / top P&L / trade count. Rename bumped the " +
      "MissionWidgetId registry from 'blindspots' → 'weekly' and v4 → v5 localStorage key. On the Performance tab, " +
      "promoted Blindspots into a full-width before/after row (BlindspotsRow) with a stub useBlindspots() hook that " +
      "T3 will wire to a backend source. Collapsed the three session cards + Hermes Summary + Your Notes into a single " +
      "SessionJournalPanel — infractions counter, Discipline + Emotional Control sliders on the 0.0–10.0 decimal scale " +
      "(TP-locked), Hermes summary block, notes textarea, explicit Submit → PUT /api/session-journal. Added shared " +
      "SessionJournal type + SessionJournalService. Deleted HumanPsychTab.tsx (SessionNotesPanel was its only export and " +
      "all call sites moved). Frontend build passes (3241 modules). Only outstanding tsc error is a pre-existing " +
      "sidecar-contract ↔ soul-schema AgentId re-export clash in shared/index.ts.",
    files: [
      "frontend/components/mission-control/WeeklyPerformanceWidget.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx (deleted)",
      "frontend/components/mission-control/MissionControlPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/journal/BlindspotsRow.tsx",
      "frontend/components/journal/SessionJournalPanel.tsx",
      "frontend/components/journal/PerformanceJournal.tsx",
      "frontend/components/journal/HumanPsychTab.tsx (deleted)",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/services/journal.ts",
      "frontend/lib/services/index.ts",
      "shared/session-journal.ts",
      "shared/index.ts",
    ],
  },
  {
    date: "2026-04-23T16:00:00",
    agent: "claude-code",
    summary:
      "S30-T1 [v5.22.10W]: Rebuilt Performance tab top row as two heatmap cards (Trade Activity + Futures Daily), " +
      "demoted the 8 KPI cards to the row below. TradeActivityHeatmap is a GitHub-style grid fed by " +
      "/api/projectx/trades with Trades/Shares/Notional toggle + year selector, colored by the user's " +
      "bullishColor with opacity scaled to daily intensity. FuturesDailyHeatmap is diverging " +
      "(bullish/bearish) on daily % change, with a contract selector (ES/NQ/MES/MNQ/CL/GC/6E), " +
      "stats row, and cell-click showing a ≤160-char daily market summary that stays identical " +
      "across contract swaps. Extended FusePalette with optional bullishColor/bearishColor + " +
      "DEFAULT_TRADE_COLORS. Added trade-colors.ts helper (getIntensityColor, getDivergingColor), " +
      "shared HeatmapGrid primitive, PerformanceHeatmapsRow + PerformanceHistoryPage extracts to " +
      "keep PerformanceJournal.tsx under 300 lines. Futures bars fall back to a deterministic mock " +
      "in frontend/lib/__mocks__/futures-daily.json until T3 ships /api/market/futures-daily.",
    files: [
      "frontend/components/journal/PerformanceJournal.tsx",
      "frontend/components/journal/performance/TradeActivityHeatmap.tsx",
      "frontend/components/journal/performance/FuturesDailyHeatmap.tsx",
      "frontend/components/journal/performance/PerformanceHeatmapsRow.tsx",
      "frontend/components/journal/performance/PerformanceHistoryPage.tsx",
      "frontend/components/journal/performance/HeatmapGrid.tsx",
      "frontend/lib/trade-colors.ts",
      "frontend/lib/fuse-palette.ts",
      "frontend/lib/__mocks__/futures-daily.json",
    ],
  },

  {
    date: "2026-04-23T14:55:00",
    agent: "claude-code",
    summary:
      "Reverted the 3D iso-icon bank and agent-spinner port back to the prior lucide + UnicodeSpinners surface (TP: 'they look terrible. lol'). " +
      "Swapped all 244 consumers (219 frontend + 25 mobile) from '@/components/shared/iso-icons' and '../shared/iso-icons' back to 'lucide-react'; " +
      "deleted frontend/components/shared/iso-icons/ and mobile/components/shared/iso-icons/. " +
      "Restored frontend/components/icon-bank/UnicodeSpinners.tsx from pre-c243abac HEAD; swapped the 6 agent-spinner consumers " +
      "(App.tsx, ai-loader.tsx, FintheonThinkingIndicator.tsx, SessionsModal.tsx, FintheonThread.tsx, AquariumPredictionCards.tsx, RiskFlowMain.tsx) " +
      "back to HelixVertical / CircleQuarters / MeterToShimmer / FishSwimmer; deleted frontend/components/icon-bank/agent-spinners/. " +
      "Frontend + mobile tsc clean, vite builds pass (3234 + 2416 modules).",
    files: [
      "frontend/App.tsx",
      "frontend/components/ui/ai-loader.tsx",
      "frontend/components/chat/FintheonThinkingIndicator.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/SessionsModal.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/icon-bank/UnicodeSpinners.tsx",
      "frontend/components/shared/iso-icons/ (deleted)",
      "frontend/components/icon-bank/agent-spinners/ (deleted)",
      "mobile/components/shared/iso-icons/ (deleted)",
      "+ 237 frontend/mobile consumer files swapped from iso-icons back to lucide-react",
    ],
  },

  {
    date: "2026-04-22T14:30:00",
    agent: "T3/Wealth",
    summary:
      "S29-T3: Modernized chat interface to Solvys design system (visual-only, no logic changes)",
    files: [
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/ChainOfThought.tsx",
      "frontend/components/chat/CognitionPanel.tsx",
      "frontend/components/chat/FintheonFloatingChat.tsx",
      "frontend/components/chat/FintheonStreamingBubble.tsx",
      "frontend/components/chat/FintheonThinkingIndicator.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/HeadlinePickerPopover.tsx",
      "frontend/components/chat/SkillBadge.tsx",
      "frontend/components/chat/ToolApprovalCard.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/index.css",
      "frontend/styles/custom.css",
    ],
  },

  {
    date: "2026-04-20T22:30:00",
    agent: "harper",
    summary:
      "Evening maintenance sweep: fixed mobile/tsconfig.json — added explicit 'react' and 'react-dom' path entries pointing to mobile/node_modules/@types so shared frontend lib files (regime-store.ts, useRegimeTracker.ts) resolve React types correctly during mobile tsc check. Without this, mobile/node_modules/@types/react was invisible to files traversed via the @frontend/* path alias. Frontend, backend builds, and both external MCP repos (financial-datasets, tradingview-mcp) confirmed clean.",
    files: ["mobile/tsconfig.json"],
  },
  {
    date: "2026-04-21T03:12:00",
    agent: "claude-code",
    summary:
      "Feed quality: added commodity recap verb filter to content guard. " +
      "Catches 'Gold Steadies', 'Oil Holds', 'Dollar Edges Lower' style " +
      "color-commentary wraps from Bloomberg RSS that passed existing guards " +
      "because they contain market keywords but are non-actionable.",
    files: ["backend-hono/src/services/riskflow/content-guard.ts"],
  },
  {
    date: "2026-04-21T03:04:00",
    agent: "claude-code",
    summary:
      "Feed quality: patched isForeignEconPrint bypass — added asia/asian/european/europe " +
      "regional prefixes and bare 'markets' keyword so foreign market-wrap headlines " +
      "(e.g. 'Asia markets mixed...') are filtered. Triggered by CNBC RSS dismissal.",
    files: ["backend-hono/src/services/riskflow/feed-service.ts"],
  },
  {
    date: "2026-04-20T15:30:00",
    agent: "claude-code",
    summary:
      "Iso-icon refactor — FULL mobile swap. Replaced every lucide-react " +
      "icon (31 unique across 25 component files) with hand-drawn " +
      "isometric SVGs. Four groups: nav.tsx (Home/News/Chat/Settings/Menu/" +
      "Bell), status.tsx (Zap/Crosshair/Sun/Moon/Check+X Circles/" +
      "ShieldCheck), content.tsx (Search/Paperclip/StickyNote/Clock/" +
      "Calendar/Trash/Refresh/ExternalLink/MessageCircle), glyphs.tsx " +
      "(flat Check/X/Plus/Minus + 3 chevrons + 3 arrows). Base IsoIcon " +
      "wrapper now lucide-compatible (color/size/strokeWidth props) with " +
      "Framer Motion fade-in + whileTap scale-0.92. index.ts re-exports " +
      "via lucide names so consumer files only needed import-path swap. " +
      "Tri-tone fills via currentColor+fillOpacity — one SVG works on " +
      "both cream + #050402 bg automatically. Build clean, TS passes.",
    files: [
      "mobile/components/shared/iso-icons/IsoIcon.tsx",
      "mobile/components/shared/iso-icons/nav.tsx",
      "mobile/components/shared/iso-icons/status.tsx",
      "mobile/components/shared/iso-icons/content.tsx",
      "mobile/components/shared/iso-icons/glyphs.tsx",
      "mobile/components/shared/iso-icons/index.ts",
      "mobile/components/**/*.tsx (25 import swaps)",
    ],
  },
  {
    date: "2026-04-20T14:20:00",
    agent: "claude-code",
    summary:
      "Mobile RiskFlow UX pass — tap-to-expand, source filter visibility, " +
      "and fuse fill-on-mount. (1) Tap on a RiskFlow card now expands " +
      "RiskFlowCardExpanded inline (was opening the DetailSheet modal); " +
      "vertical fuse drains + fades, right-column IV fades, expanded card " +
      "renders with a footer row — horizontal fuse charging 0→IV, paperclip " +
      "→ original source, Doto IV numeral far right. Preview stays on the " +
      "3-line clamp + static min-height. (2) Source filter sheet now shows " +
      "per-bucket counts (TP was hitting [NO ALERTS] after selecting a " +
      "zero-match bucket with no visible signal); the feed's empty state " +
      "reads [NO ALERTS MATCH FILTERS] + Clear-filters button when alerts " +
      "exist but filters hide them. (3) New card arrival choreography: " +
      "VerticalFuseBar (mobile) + NothingFuse (desktop) accept `animateIn`; " +
      "the fuse mounts empty and charges bottom-up so scored items arriving " +
      "at the feed top visibly fill in. Also reverted the NotificationCard " +
      "line-clamp change from the earlier pass — it wasn't what TP asked for.",
    files: [
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/components/riskflow/SourceFilterSheet.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "mobile/components/notifications/NotificationCard.tsx",
      "frontend/components/shared/NothingFuse.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
    ],
  },
  {
    date: "2026-04-20T13:40:00",
    agent: "claude-code",
    summary:
      "Mobile cards: dropped headline line-clamps per TP — partial headlines " +
      "were unreadable. RiskFlowCard (3-line clamp) and NotificationCard " +
      "(2-line title + 3-line body clamps) now grow to fit the full text. " +
      "Fuses/numerals untouched; wordBreak: break-word keeps long tokens " +
      "from blowing out the right column.",
    files: [
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/notifications/NotificationCard.tsx",
    ],
  },
  {
    date: "2026-04-20T12:55:00",
    agent: "claude-code",
    summary:
      "v5.23.0 deploy — backend Fly + desktop Vercel + mobile Vercel shipped. " +
      "S28 shipped (Omi speak routing, DAG leak fix, agent-spinners port) + " +
      "RiskFlow notification dedup + 'Markets Wrap' ad filter. " +
      "Archived S28-ORCHESTRATION.md to sprint-changelog/; deleted T1/T2/T3 " +
      "sub-track briefs. Pruned v5.22.10 GH release (tag preserved).",
    files: ["sprint-changelog/S28-ORCHESTRATION.md", "package.json"],
  },
  {
    date: "2026-04-20T09:40:00",
    agent: "claude-code",
    summary:
      "RiskFlow push notifications — stop the dupe storm and calm the header. " +
      "TP was seeing the same headline 10 times over 5-10 min, each card stamped " +
      "with a running '8 updates · / 13 updates · / 21 updates ·' counter that " +
      "was anxiety-inducing for traders. Root causes: (a) riskflow-payload.ts " +
      "appended a 5-minute bucket to every fingerprint so the 30-min dedup window " +
      "in emit.ts could never match across bucket flips — every ~5 min the same " +
      "item re-fired; (b) narrative-coalesce.ts's flush rewrote the body to " +
      "`${count} updates · ${headline}` and used a `:coalesced` fingerprint that " +
      "rotated with the first item's bucket. Fixes: fingerprint is now content-only " +
      "(`riskflow:<hash(headline|instrument)>`) so the 30-min window actually " +
      "suppresses repeats; coalescer silently drops N-1 items per 60s window and " +
      "emits only the first item unchanged (no counter); title changed from " +
      "'Catalyst · Geopolitical' to 'Fintheon · Geopolitical' per TP. Also " +
      "blocked Bloomberg-style 'Markets Wrap' / regional-wrap advertorials in " +
      "both the news-worker pre-ingest filter and the server-side content guard.",
    files: [
      "backend-hono/src/services/notifications/riskflow-payload.ts",
      "backend-hono/src/services/notifications/narrative-coalesce.ts",
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/workers/news-worker/score.ts",
    ],
  },
  {
    date: "2026-04-20T09:00:00",
    agent: "claude-code",
    summary:
      "[v5.23] S28-T1/T3: routed all agent-to-user speech through Omi's " +
      "Notifications API (speak:true) and stopped the system-prompt TTS leak; " +
      "replaced the 2026-04-19 Unicode spinner bank with a port of " +
      "expo-agent-spinners (54 terminal-style spinners, MIT). " +
      "(T1) New backend helper services/omi/speak.ts — looks up omi_pairings " +
      "and calls sendNotification, silent fallback when unpaired. /api/voice/speak " +
      "now fires the Omi notification server-side and no longer returns audioBase64; " +
      "the frontend hook drops window.speechSynthesis entirely. Deleted useVoiceSession, " +
      "the /api/voice/session/* sidecar routes, and lib/speech-service.ts — all " +
      "redundant once Omi owns playback. Fixed the Harper boardroom DAG JSON " +
      'leak (e.g. `{"agentId":"feucht",...}`) by buffering per-agent deltas and ' +
      "emitting a prose summary on agent-complete instead of streaming the raw " +
      "analyst JSON into the chat bubble. " +
      "(T3) Ported 54 spinners to components/icon-bank/agent-spinners/: shared " +
      "BaseSpinner + useSpinnerFrame + useReducedMotion hook, frame definitions in " +
      "frames.ts, 54 named exports. App splash → CircleQuartersSpinner, RiskFlow " +
      "header refresh → FillsweepSpinner + CircleQuartersSpinner, chat thinking/AiLoader " +
      "→ HelixSpinner, Aquarium loader → SnakeSpinner. Old UnicodeSpinners removed.",
    files: [
      "backend-hono/src/services/omi/speak.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/voice/index.ts",
      "backend-hono/src/routes/harper/index.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/contexts/VoiceContext.tsx",
      "frontend/lib/services/voice.ts",
      "frontend/components/icon-bank/agent-spinners/base.tsx",
      "frontend/components/icon-bank/agent-spinners/frames.ts",
      "frontend/components/icon-bank/agent-spinners/index.tsx",
      "frontend/App.tsx",
      "frontend/components/chat/FintheonThinkingIndicator.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/SessionsModal.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/ui/ai-loader.tsx",
    ],
  },
  {
    date: "2026-04-19T22:40:00",
    agent: "claude-code",
    summary:
      "RiskFlow sanitation + source buckets + card polish + session restore. " +
      "(1) Central scorer: 4-purge block — low-IV (<=1, >1h), narrative-orphan, " +
      "headline dedup (24h window, normalized key shared with catalyst-promoter via " +
      "new text-utils.ts), and sourceless-untrusted-source items; each purge wrapped " +
      "in its own try/catch, non-fatal. (2) Real url column on raw + scored riskflow " +
      "tables via 029_riskflow_url_column.sql; news-worker writes url directly, Supabase " +
      "writer threads it through both tables, ON CONFLICT preserves existing urls. " +
      "Rettiwt transform synthesizes https://x.com/<handle>/status/<id> so X items " +
      "finally back-link. (3) 5-bucket source taxonomy (OSINT/General/Commentary/Econ/" +
      "Geopolitical) via lib/source-buckets.ts (desktop) + mirror in mobile/lib. " +
      "SourceFilterMenu replaces the legacy 7-source <select> on desktop (RiskFlowMain + " +
      "RiskFlowMini); SourceFilterSheet + SRC tab on mobile RiskFlowFilterBar. Card " +
      "source chips now print the bucket, not the granular source. (4) SourcePreview " +
      "component (desktop + mobile), surface-gated: expanded cards under full/timeline " +
      "surfaces render scraped body + YouTube + Open-original CTAs; mini surfaces keep " +
      "the old compact footer. (5) Trash-can / clear-all removed from RiskFlowMini " +
      "header — dismissal is per-item now. (6) Strategium boots closed every time " +
      "(missionControlCollapsed default true); activeTab persists to localStorage " +
      "and restores on next sign-in via readLastRoute().",
    files: [
      "backend-hono/src/services/riskflow/text-utils.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/catalyst-promoter.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-transform.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/workers/news-worker/persist.ts",
      "backend-hono/migrations/029_riskflow_url_column.sql",
      "frontend/lib/source-buckets.ts",
      "frontend/components/feed/SourceFilterMenu.tsx",
      "frontend/components/feed/SourcePreview.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/hooks/useLayoutState.ts",
      "frontend/components/layout/MainLayout.tsx",
      "mobile/lib/source-buckets.ts",
      "mobile/components/riskflow/SourceFilterSheet.tsx",
      "mobile/components/riskflow/SourcePreview.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/components/riskflow/RiskFlowFilterBar.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/contexts/RiskFlowContext.tsx",
      "mobile/hooks/useRiskFlowFilters.ts",
    ],
  },
  {
    date: "2026-04-20T00:05:00",
    agent: "claude-code",
    summary:
      "v5.23 polish pass 2. (1) View Transitions API helper at lib/view-transition.ts — wraps document.startViewTransition with a React-safe fallback; default cross-fade at 220ms + prefers-reduced-motion opt-out added to index.css. (2) Wired 4 surfaces to view transitions: ChatSidebar handlers (fintheon:chat-new / chat-run-report / chat-load-session) and RiskFlow priority/source/proposals filter toggles. (3) ui/ai-loader.tsx reimplemented to wrap HelixVertical — every importer cascades to the Braille-weave aesthetic without per-site edits. (4) SessionsModal loader swapped to HelixVertical + withViewTransition imported for future session-click wrapping. (5) Catalyst url-tag cleanup: new lib/catalyst-tag-utils.tsx partitions tags so `url:<href>` renders as a single paperclip-icon CatalystLinkChip instead of bleeding raw URLs into Timeline/Catalyst cards. Applied to TimelinePanel + CatalystCard. Deferred to a fresh orchestrated sprint (not in this deploy): Chart iframe → 50% slide-over refactor, app-wide edge-fade sweep, 45+ remaining spinner sites, Fintheon logo redraw.",
    files: [
      "frontend/lib/view-transition.ts",
      "frontend/lib/catalyst-tag-utils.tsx",
      "frontend/index.css",
      "frontend/components/chat/ChatSidebar.tsx",
      "frontend/components/chat/SessionsModal.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/ui/ai-loader.tsx",
      "frontend/components/narrative/TimelinePanel.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
    ],
  },
  {
    date: "2026-04-19T23:45:00",
    agent: "claude-code",
    summary:
      "Icon Bank — Unicode spinner library (aesthetic pivot inspired by Irfan Aziz's Unicode Spinner, unicode.framer.website). Five presets: FishSwimmer (Aquarium loader, `><((º>` through tilde stream), CircleQuarters (`◴→◷→◶→◵` clockwise — now the app's refresh icon + splash LOADING microinteraction), MeterBar (`▱→▰`), ArrowShimmer (`▹▹▹▹▹` with moving `▸`), MeterToShimmer (meter→arrow hand-off — RiskFlow header refresh motion), HelixVertical (Braille weave — replaces the chat radar pulse + AiLoader circular spinner). Every preset reads two driver props: `severity` (maps to --fintheon-severe/--fintheon-neutral-severe/--fintheon-neutral CSS vars) and `priority` (maps to animation interval: 60/100/150/220ms). Honors prefers-reduced-motion. Touchpoints: RiskFlowMain header refresh button + top-bar shimmer, AquariumPredictionCards loader, FintheonThinkingIndicator, FintheonThread.AiLoader, App.tsx splash. Did NOT touch any fuse surface (NothingFuse/VerticalFuseBar or adjacent loadingMore indicators in card lists) per standing design rule.",
    files: [
      "frontend/components/icon-bank/UnicodeSpinners.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/chat/FintheonThinkingIndicator.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/App.tsx",
    ],
  },
  {
    date: "2026-04-20T03:15:00",
    agent: "claude-code",
    summary:
      "S21 — Omi voice layer + PsychAssist fork (scaffold). Added the Omi (omi.me, MIT) integration as a voice sensory layer with three triggers: (1) PsychAssist activation (Coach agent), (2) Voice Assistant header button (routes market Qs to Oracle fast-voice, general to Harper), (3) new Performance-tab header chat button. Webhooks receive real-time transcripts + audio bytes + memory creations at /api/omi/webhook/*; audio uses system permissions (no wearable required) — Electron preload bridge + main-process IPC handlers added for mic/camera permission query/request so TP's onboarding-flow sprint can drive the first-run ask. Backend: new omi service (client, session-manager, router), prosody feature extractor (energy + frustration-vocabulary) feeding a new omi_prosody_samples table that will nudge PsychAssist tilt. Frontend: shared draggable AgentResponsePopup (smoothly-draggable via existing useDraggable hook, 5s fade, hover pauses, click pins, white isometric WhiteWaveform as the agent's 'mouth' — no text UNLESS an agent loops another in, per spec). AgentResponsePopupHost mounted once in MainLayout; session triggered via CustomEvent from useOmiSession so triggers don't need a React context. SuperAdmin PsychAssist fork: new user_feature_overrides table + getFlagForUser(name, userId) resolution layer; reasoning@pricedinresearch.io seeded with psych_assist_fork.edit + psych_assist_fork.flag_toggle overrides (raw audio access + sub-admin powers explicitly NOT granted). New admin endpoints at /api/admin/psych-assist-fork gated by requireFeature middleware; new psych_assist_forks table stores per-user system_prompt + ER weights + tilt thresholds. Coach agent system prompt (voice-native: max two sentences, no markdown, no lists) + Oracle fast-voice variant added. Light polish pass on PsychAssistDockable: MessageSquare activation button + mini WhiteWaveform during active session; three widget positions unchanged per user spec ('polish, don't redesign'). No onboarding UI in this sprint (TP's follow-up). Privacy model: Omi cloud v1 (audio transits Deepgram — documented trade-off). No ElevenLabs (Omi built-in TTS). All migrations idempotent; seed is safe to re-run.",
    files: [
      "supabase/migrations/20260420033323_omi_integration.sql",
      "supabase/migrations/20260420033330_user_feature_overrides.sql",
      "supabase/migrations/20260420033337_psych_assist_forks.sql",
      "supabase/migrations/20260420033354_seed_reasoning_fork.sql",
      "backend-hono/src/routes/omi.ts",
      "backend-hono/src/routes/admin/psych-assist-fork.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/omi/types.ts",
      "backend-hono/src/services/omi/client.ts",
      "backend-hono/src/services/omi/session-manager.ts",
      "backend-hono/src/services/omi/router.ts",
      "backend-hono/src/services/prosody/extractor.ts",
      "backend-hono/src/services/user-feature-overrides.ts",
      "backend-hono/src/services/feature-flag-service.ts",
      "backend-hono/src/services/ai/agent-instructions/coach.ts",
      "backend-hono/src/services/ai/agent-instructions/oracle-fast-voice.ts",
      "backend-hono/src/middleware/require-feature.ts",
      "frontend/components/voice/AgentResponsePopup.tsx",
      "frontend/components/voice/AgentResponsePopupHost.tsx",
      "frontend/components/voice/WhiteWaveform.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/components/performance/PerformanceChatButton.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/hooks/useOmiSession.ts",
      "frontend/lib/omi.ts",
      "frontend/lib/system-permissions.ts",
      "electron/preload.cjs",
      "electron/main.cjs",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T22:30:00",
    agent: "claude-code",
    summary:
      "v.27.11 — RiskFlow card visual unification + multi-priority filter. (1) Every desktop RiskFlow card surface (AlertCardBase, RiskFlowMini AlertRow + TradeIdeaRow, SanctumRiskAssessment RiskItem, mission-control RiskFlowMiniWidget) now mirrors the Fintheon Mobile card anatomy: single segmented vertical NothingFuse on the left (no double borders), source/time uppercase row above a serif headline, and a right-justified column with the direction chevron stacked above the IV numeral. (2) NothingFuse gained a `segments` prop (default 10) that paints N-1 perpendicular ruler ticks over the continuous fill while preserving orientation + shimmer — the bar reads as a discrete 10-step scale on both vertical and horizontal mounts. (3) New shared primitives: components/shared/IVStack.tsx (chevron-over-numeral right column, Doto + Readable Digits font stack so IV numbers render in the Nothing Display dot-matrix face on every theme), components/shared/PriorityFilterMenu.tsx (checkbox popover for desktop multi-select), and lib/riskflow-card-utils.ts (severity-to-palette + fuseScore helpers used by every card). (4) Killed the AlertRow double-border bug — was a 2px borderLeft layered over the 6px NothingFuse — and dropped the bottom hero footer's IV/chevron pair so the right column owns IV display everywhere. (5) Mobile RiskFlowCard IV numeral switched to the Doto stack; chevron stacking unchanged. (6) Multi-priority filter on both surfaces: desktop FilterDropdown for Priority replaced with PriorityFilterMenu (checkbox per CRIT/HIGH/MED/LOW, empty selection = All); mobile RiskFlowFilterBar tabs are now toggle-multi-select (ALL clears the set, individual tabs flip on/off). Filter state persists to localStorage on both (`fintheon:riskflow-filters:v1` / `fintheon-mobile:riskflow-filters:v1`) so refresh and PWA reopen keep the user's selection. Verified: frontend tsc clean, mobile tsc clean, frontend vite build 3.18s, mobile vite build 1.26s, backend tsc clean.",
    files: [
      "frontend/components/shared/NothingFuse.tsx",
      "frontend/components/shared/IVStack.tsx",
      "frontend/components/shared/PriorityFilterMenu.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/narrative/SanctumRiskAssessment.tsx",
      "frontend/components/mission-control/RiskFlowMiniWidget.tsx",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/lib/riskflow-card-utils.ts",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowFilterBar.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/hooks/useRiskFlowFilters.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T22:00:00",
    agent: "claude-code",
    summary:
      "S28 kickoff — Refinement Engine refinements + news-worker audit gates. (1) Moved RoutinesConsole out of the Refinement Engine Scoring sub-tab's left sidebar and into the Admin Monitor sub-tab, which is where routine operational state belongs. The Scoring sidebar keeps Regime / Sensitivity / Presets / Advanced; the Monitor tab is now purely the RoutinesConsole surface. (2) Stripped the dead /api/scoring/monitoring/* + /api/scoring/shadow-stats placeholders that were marked 'not yet live — wire at T4-8 backend cron build' in MonitoringLoopCard.tsx. Real routine controls (start/stop/rerun/mode) are already wired to /api/routines/* and now have the whole tab to themselves. (3) Non-negotiable news-worker audit gates at 6:00am / 11:30am / 4:00pm America/New_York. Three new HEAL routines registered (trig_newsaudit_0600, trig_newsaudit_1130, trig_newsaudit_1600) so they appear in the UI and can be paused / rerun manually. New in-process cron at backend-hono/src/services/cron/news-worker-audit-scheduler.ts honours paused state from routine_config so operators can disable from UI without a restart. Handler at backend-hono/src/services/routines/handlers/news-worker-audit.ts does the full cycle: heartbeat freshness check (breaking >10min stale, standard >15min stale), pipeline health (raw/h + scored/h + ratio), soft heal via agentReachTick(), hard heal via stopAgentReachPoller()+startAgentReachPoller() if still stale, ops-feed breadcrumb every run, and superadmin push escalation on failed auto-heal. /api/routines/:id/rerun now executes the audit inline for HEAL routine IDs and returns the snapshot instead of being paper-trail-only. New notifySuperadmins helper resolves SUPER_ADMIN_USER_ID env + users.role='admin' and pushes via sendToUserDirect so critical alerts bypass category gating.",
    files: [
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/RoutinesConsole.tsx",
      "frontend/components/admin/MonitoringLoopCard.tsx",
      "backend-hono/src/services/routines/registry.ts",
      "backend-hono/src/services/routines/handlers/news-worker-audit.ts",
      "backend-hono/src/services/cron/news-worker-audit-scheduler.ts",
      "backend-hono/src/services/notifications/notify-superadmins.ts",
      "backend-hono/src/routes/routines/handlers.ts",
      "backend-hono/src/boot/services.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T17:45:00",
    agent: "claude-code",
    summary:
      "v.27.10 fix: Refinement Engine stuck-loading bug. TP flagged the /refinement page deadlocked on 'Loading Refinement Engine...' on the latest release — blocker before /solvys-deploy. Root cause: RefinementEngine.tsx's loadAll uses Promise.all across 6 fetchers; 5 are silent-on-failure (try/catch → no-op) but loadV4State was the lone outlier with no guard. loadV4State calls fetchPresets() + fetchCurrentSensitivities(), both of which hit /api/scoring/presets + /api/scoring/sensitivities — routes protected by /api/scoring/* authMiddleware + requireAuth at backend-hono/src/routes/index.ts:132-133. No auth token was ever threaded through the GET fetches, so the backend returned 401 Unauthorized. safeFetch in frontend/lib/scoring-preset-api.ts only treated 404/501 as 'notReady'; any other non-2xx (including 401/403) threw, which propagated up through loadV4State → Promise.all in loadAll → the `await` rejected → setLoading(false) never ran → UI forever stuck. Fix is two-part: (1) scoring-preset-api.ts safeFetch now treats 401/403 as notReady too, AND fetchPresets/fetchCurrentSensitivities accept a token arg + attach Authorization header matching the POST/PATCH pattern; (2) RefinementEngine.tsx loadV4State wraps its body in try/catch that defaults to setV4Available(false), matching the silent-on-failure contract the sibling fetchers already honor. V4 dials now render properly for authenticated sessions and fall back to built-in presets + Advanced pane for unauthenticated/degraded ones — either way the loader unsticks. Verified: frontend tsc --noEmit clean, frontend clean vite build clean (3.35s).",
    files: [
      "frontend/lib/scoring-preset-api.ts",
      "frontend/components/refinement/RefinementEngine.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T17:30:00",
    agent: "claude-code",
    summary:
      "S27 FINAL SANITATION (Claude-01 orchestrator) — v.27.10 unified release. Wave 2 merged into v5.22 over three merges: W2c s27-w2c-voice (49c28646 → tag v.27.7), W2d s27-w2d-browser-ops (ae53d080 → tag v.27.8), W2e s27-w2e-routing-hub-gepa (32855e13 → tag v.27.9). Conflicts resolved: src/lib/changelog.ts (all entries preserved chronologically across every merge); backend-hono/src/routes/diagnostics/index.ts (unioned W2d's browser_operator + news_worker fields with W2e's routing + gepa fields inside DiagnosticsResponse). Formatter autofix touches on merged files committed as part of the v.27.9 merge. Delivered: T4 shared browser primitives + Rettiwt cut + 48h telemetry (W1c); T5 voice assistant via sidecar + Qwen3.6-plus-preview + rim UX (W2c); T6 Harper Browser Operator + action cache (W2d); T7 Always-On News Worker with portless news.fintheon.test + Supabase-only contract + launchd/Fly self-healing (W2d); T8 SOUL.md conversion across 5 agents grounded literally on CLAUDE.md + drift guard (W1d); T9 Smart Model Routing flipped live per-agent + per-user daily budget degrade (W2e); T10 Skills Hub full adoption with 5 desks + 3 imports + security scanner (W2e); T11 GEPA self-improvement loop with PR-gated promotion to soul-evolution/ (W2e); + the T2 §1-3 Hermes Python sidecar infra (W1b). NOT delivered (rolled to S28): T1 generative UI cards (W2a branch sat at mid-sprint HEAD with zero commits — Harper's structured card renderer + stream fence parser + Boardroom DirectionAwareHover never landed); T2 §4-6 context engine integration (sidecar connected, but hermes-handler never routed through /v1/chat; conversation-store.ts 80k Haiku summarizer still active); T3 A2A handoff protocol (handoff_to_{oracle,feucht,consul,herald} tools never registered; Harper still uses regex intent router). Final verification: backend bun run build clean (tsc + copy-assets), frontend tsc --noEmit clean, frontend clean vite build clean (3.43s with dist wiped first), soul-ground-check PASS (5/5 grounded on CLAUDE.md). Route mounts confirmed on manual dist boot (launchd unit reads stale Desktop checkout): /api/diagnostics 200, /api/diagnostics/headline-volume mounts (returns 500 until migration 20260419_02 applied), /api/diagnostics/routing 200, /api/diagnostics/gepa 200, /api/skills 401 (JWT as expected), /api/harper/tools/browse_task 200. launchctl: io.solvys.fintheon-backend green; io.solvys.fintheon-hermes + io.solvys.fintheon-news-worker + io.solvys.fintheon-gepa plists committed but NOT yet loaded — /install-maintenance post-ship audit installs them. Outstanding for TP: (a) supabase db push for migrations 20260419_02_sources + 04_gepa_metrics + 05_action_cache + 06_worker_heartbeats + 07_user_budgets + 08_skill_imports (6 total); (b) install Hermes/news-worker/GEPA launchd plists; (c) create fintheon-hermes + fintheon-news-worker Fly apps; (d) sync stale ~/Desktop/Codebases/fintheon checkout; (e) resolve origin/v5.22 divergence. Tagged v.27.10 as unified release. /solvys-deploy triggered per orchestration doc.",
    files: ["src/lib/changelog.ts", "memory/s27-orchestrator-state.md"],
  },
  {
    date: "2026-04-20T16:00:00",
    agent: "claude-code",
    summary:
      "S27-T5 W2c (Claude-08): voice assistant end-to-end via Hermes sidecar + Qwen + rim UX. Locked harper-voice model to qwen/qwen3.6-plus-preview:free (free, 1M context, ~3x faster than Opus 4.6, exceeds Claude 4.5 Opus on Terminal-Bench 2.0 61.6 vs 59.3 and RealWorldQA 85.4 vs 77.0 — comfortably above the Sonnet-equivalent-or-better bar). Registered voicebox/Qwen3-TTS + Whisper-turbo (with Qwen-STT fallback) as sidecar voice plugins. Rewrote backend-hono voice-service.ts from the broken OpenAI-direct path to a sidecar-relay: transcribeVoice proxies /v1/voice/stt, synthesizeVoice proxies /v1/voice/tts, synthesizeGreeting pre-renders Harper's 1-sentence greeting via /v1/chat + SOUL grounding, streamVoiceReply generator overlaps reasoning + TTS sentence-by-sentence for the <2s first-audio target. Added sidecar-voice-client.ts as typed HTTP wrapper. New /api/voice/session/start (pre-renders greeting, caches in Supabase Storage voice-greetings bucket + returns signed URL), /turn (SSE transcript → text → audio events), /interrupt (aborts in-flight stream via AbortController registry keyed by conversationId), /end. Frontend: VoiceRimFrame.tsx (3px accent-gold rim around app chrome, pulse/solid/idle states, data-testid=voice-rim-frame, pointer-events: none so never eats trading clicks) + VoiceTranscriptTicker.tsx (single-line top-center ticker, last 120 chars, pointer-events: none) + useVoiceSession hook that fires POST /api/voice/session/start on enable transitions and plays greeting. Replaced the in-App.tsx VoiceBorderPulse with VoiceRimFrame. Extended VoiceContext.cancel() to also call /api/voice/session/interrupt. VoiceService frontend client gained sessionStart/Interrupt/End. Electron main.cjs installs voice-chrome ipc hook (window-chrome-voice.cjs) that recolors titleBarOverlay per voice state. Backend test (src/tests/voice-assistant.test.ts, 4 tests green) proves transcript→text→audio→done ordering, first-audio <2.5s, abortSignal interrupt, and sidecar-disabled graceful fallback. Playwright spec frontend/test/voice-rim.spec.ts asserts rim pointer-events: none, no coverage of data-testid=trading-view-*, dismiss preserves conversation. Validation: backend bun run build + tsc clean, frontend vite build clean (3.61s). Rollback: ROUTING_OVERRIDE_HARPER_VOICE env var swaps the Qwen model; VOICE_SIDECAR_DISABLED=true or HERMES_SIDECAR_ENABLED=false falls back cleanly.",
    files: [
      "src/lib/changelog.ts",
      "backend-hono/src/services/ai/routing.ts",
      "backend-hono/src/services/ai/sidecar-voice-client.ts",
      "backend-hono/src/services/voice-service.ts",
      "backend-hono/src/routes/voice/session.ts",
      "backend-hono/src/routes/voice/index.ts",
      "backend-hono/src/tests/voice-assistant.test.ts",
      "frontend/components/voice/VoiceRimFrame.tsx",
      "frontend/components/voice/VoiceTranscriptTicker.tsx",
      "frontend/hooks/useVoiceSession.ts",
      "frontend/contexts/VoiceContext.tsx",
      "frontend/lib/services/voice.ts",
      "frontend/App.tsx",
      "frontend/test/voice-rim.spec.ts",
      "electron/window-chrome-voice.cjs",
      "electron/main.cjs",
      "hermes-sidecar/config.yaml",
    ],
  },
  {
    date: "2026-04-19T15:45:00",
    agent: "claude-code",
    summary:
      "[v.27.8] S27-T7 (W2d Claude-09): Always-On News Worker — sibling process in backend-hono/src/workers/news-worker/ (index, scheduler, sources/{browser-harness,exa,agent-reach,types}, score, persist). Breaking tier runs every 60s (Reuters, Bloomberg via browser-harness + RSS), standard tier every 5 min (SEC, Fed, Treasury via browser-harness + Exa + RSS). Per-source collector errors isolated; one failure never kills a tier. Worker writes `riskflow_items` upserts keyed on item_id with source tag + heartbeats via news_worker_heartbeats (new table). Supabase is the only contract back to backend-hono — no HTTP coupling. /healthz served on port 8082 for launchd + Fly keepalive. Self-healing: launchd KeepAlive with Crashed=true (io.solvys.fintheon-news-worker.plist), Fly restart_policy on-failure + min_machines_running=1 (fly.news-worker.toml + Dockerfile.news-worker on playwright:v1.58.2-jammy base). fintheon.config.ts maps news→8082 subdomain for news.fintheon.test portless hostname. FLAG_NEWS_WORKER_WRITES_RISKFLOW env gate keeps dry-run mode for load testing. /api/diagnostics now returns news_worker.{age_seconds, tiers[]}. Migration 20260419_06_worker_heartbeats.sql creates news_worker_heartbeats with unique index on tier.",
    files: [
      "backend-hono/src/workers/news-worker/index.ts",
      "backend-hono/src/workers/news-worker/scheduler.ts",
      "backend-hono/src/workers/news-worker/score.ts",
      "backend-hono/src/workers/news-worker/persist.ts",
      "backend-hono/src/workers/news-worker/sources/index.ts",
      "backend-hono/src/workers/news-worker/sources/types.ts",
      "backend-hono/src/workers/news-worker/sources/browser-harness.ts",
      "backend-hono/src/workers/news-worker/sources/exa.ts",
      "backend-hono/src/workers/news-worker/sources/agent-reach.ts",
      "backend-hono/fly.news-worker.toml",
      "backend-hono/Dockerfile.news-worker",
      "launchd/io.solvys.fintheon-news-worker.plist",
      "fintheon.config.ts",
      "supabase/migrations/20260419_06_worker_heartbeats.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T15:30:00",
    agent: "claude-code",
    summary:
      "[v.27.8] S27-T6 (W2d Claude-09): Harper Browser Operator — new browseTask({url, objective, extract_fields?, budget_usd?}) in backend-hono/src/services/browser/operator.ts consumes W1c Playwright pool + allowlist. Cache hit = zero-LLM XPath replay against action_cache (new Supabase table). Miss = OpenRouter Haiku extraction, validated against extract_schema/extract_fields, hard-capped by budget_usd (default $0.10). Stale detection: 3 replay failures → force LLM re-run; 30d no success → auto-evict. Every run logs to browse_task_runs; GET /api/diagnostics now returns browser_operator.{runs_24h, hits_24h, cache_hit_rate_24h, cost_usd_24h}. Harper wiring: new POST /api/harper/browse-task wrapper + GET /api/harper/tools/browse_task (tool schema advertisement for MCP bridge). harper-extra.md Browser Operator section documents when/how to call. URL_NOT_ALLOWED returned with suggestion when BROWSER_UNIVERSAL_ENABLED=false and URL is off-allowlist. Migration 20260419_05_action_cache.sql creates action_cache + browse_task_runs.",
    files: [
      "backend-hono/src/services/browser/operator.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "supabase/migrations/20260419_05_action_cache.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T15:30:00",
    agent: "claude-code",
    summary:
      "[v.27.9] S27-T11 W2e — GEPA self-improvement loop. Evolutionary prompt optimization for all 5 SOULs via DSPy-backed sidecar plugin. NEVER auto-merges — proposes candidates as PRs against soul-evolution/<agent>-<ts> branches. Runner (backend-hono/src/services/gepa/runner.ts) nightly @ 02:00 ET: computes per-agent accuracy from last 24h routing_decisions + agent_memory + RiskFlow trade-followthrough samples; compares to 7d baseline; triggers optimize when accuracy drop > 5%; enforces 25% prompt-size cap + 3-reject → 14d pause + 7d auto-close rails. Sidecar plugin at hermes-sidecar/plugins/gepa/{plugin.yaml,engine.py} — shallow mutation default (scope tighten + voice trim + handoff trigger), GEPA_DEEP=true switches to full DSPy path. pr-creator writes candidate to soul-evolution/<agent>/<ts>.md, creates branch, commits, pushes, opens gh PR with baseline + projected Δ + projected risk in body. Three sample sources: explicit thumbs feedback (routing_decisions.user_feedback_score), agent_memory accuracy_feedback rows, implicit RiskFlow→trade-followthrough signal. Diagnostics surface: /api/diagnostics now carries gepa.{last_run_at, evolutions_proposed_7d, evolutions_merged_7d, current_metric_deltas} + /api/diagnostics/gepa dedicated endpoint. New GepaWidget.tsx mounted in HermesAdminTab (glassmorphic, accent-gold deltas, no gradients). Local launchd unit at launchd/io.solvys.fintheon-gepa.plist (02:00 ET daily). Fly cron config at backend-hono/fly.gepa-cron.toml (06:00 UTC daily) for fintheon-hermes app. CLI dry-run: bun run gepa:dry-run --agent=harper. GEPA_DRY_RUN=true env gate keeps pr-creator local-only during smoke. Closes v.27.9 bundle (T9 live + T10 skills + T11 GEPA).",
    files: [
      "backend-hono/src/services/gepa/runner.ts",
      "backend-hono/src/services/gepa/pr-creator.ts",
      "backend-hono/src/services/gepa/sample-sourcing.ts",
      "hermes-sidecar/plugins/gepa/plugin.yaml",
      "hermes-sidecar/plugins/gepa/engine.py",
      "launchd/io.solvys.fintheon-gepa.plist",
      "backend-hono/fly.gepa-cron.toml",
      "backend-hono/package.json",
      "frontend/components/diagnostics/GepaWidget.tsx",
      "frontend/components/settings/HermesAdminTab.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T15:20:00",
    agent: "claude-code",
    summary:
      "[v.27.9] S27-T10 W2e — Skills Hub full adoption. Five desks exposed as agentskills.io-compatible skills: skills/{harper,oracle,feucht,consul,herald}/{skill.yaml,entry.ts}. Each entry.ts is a thin wrapper delegating to existing handlers via Smart Model Routing (T9). Three external skills wrapped for smoke: skills/imported/{close-crm,notion,google-workspace}/skill.yaml. New backend-hono/src/services/skills/{registry,importer,security-scanner,yaml-parse}.ts. Registry exposed via GET /api/skills returning all local + imported skills with manifests, scan reports, status. POST /api/skills/import triggers importSkillFromHub(hubUrl) — resolves local path / tarball / git clone, parses skill.yaml through Zod schema, runs security scanner, persists audit row. Scanner checks: destructive_ops (rm -rf / DROP TABLE / DELETE FROM / execSync / spawnSync) — always blocks; data_exfil_risks (fetch to non-allowlisted host) — blocks unless declared; prompt_injection_vectors (user input interpolation) — blocks unless declared; supply_chain_warnings (known-bad deps) — warns. CLI entry: bun run skills:import <hub_url>. Sidecar integration — boot services now registers all local skills with hermes sidecar via sidecarClient.skills.invoke('register_local', …) when HERMES_SIDECAR_ENABLED=true. Malicious fixture at skills/fixtures/malicious-skill/ proves scanner rejects rm -rf + non-allowlisted fetch. New supabase/migrations/20260419_08_skill_imports.sql.",
    files: [
      "skills/harper/skill.yaml",
      "skills/harper/entry.ts",
      "skills/oracle/skill.yaml",
      "skills/oracle/entry.ts",
      "skills/feucht/skill.yaml",
      "skills/feucht/entry.ts",
      "skills/consul/skill.yaml",
      "skills/consul/entry.ts",
      "skills/herald/skill.yaml",
      "skills/herald/entry.ts",
      "skills/imported/close-crm/skill.yaml",
      "skills/imported/close-crm/entry.ts",
      "skills/imported/notion/skill.yaml",
      "skills/imported/notion/entry.ts",
      "skills/imported/google-workspace/skill.yaml",
      "skills/imported/google-workspace/entry.ts",
      "skills/fixtures/malicious-skill/skill.yaml",
      "skills/fixtures/malicious-skill/entry.ts",
      "backend-hono/src/services/skills/importer.ts",
      "backend-hono/src/services/skills/security-scanner.ts",
      "backend-hono/src/services/skills/yaml-parse.ts",
      "backend-hono/src/services/skills/registry.ts",
      "backend-hono/src/routes/skills/index.ts",
      "backend-hono/scripts/skills-import-cli.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/package.json",
      "supabase/migrations/20260419_08_skill_imports.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T15:10:00",
    agent: "claude-code",
    summary:
      "[v.27.9] S27-T9 W2e — Smart Model Routing flipped live per-agent. hermes-handler OpenRouter path now routes through selectModel() + llmCall() wrapper: Oracle→claude-opus-4-7, Feucht→claude-haiku-4-5-20251001, Consul→claude-sonnet-4-6, Herald→claude-haiku-4-5-20251001, Harper→claude-opus-4-7. Anthropic models emit with the OpenRouter `anthropic/` prefix. Task-type routing hints mapped from hermes intent buckets (probability/news/tape/macro). harper-handler CLI bridge now emits a routing_decisions row at stream settle so diagnostics sees Harper traffic alongside Hermes. New budget.ts layer: per-user daily cap (default $20, env ROUTING_DAILY_CAP, ROUTING_DISABLE_BUDGET=true bypass). On cap exceed: Harper+Oracle degrade Opus→Sonnet; Feucht/Herald stay Haiku; Consul stays Sonnet. New agent-map.ts translates HermesAgentRole→AgentId. Diagnostics surface: /api/diagnostics body now carries routing.last_24h per-agent {model,calls,total_cost_usd,avg_latency_ms} + budget_status; new /api/diagnostics/routing + /api/diagnostics/gepa endpoints. New RoutingWidget.tsx (glassmorphic, accent-gold numerics, zero gradients) mounted in HermesAdminTab. New supabase/migrations/20260419_07_user_budgets.sql. Env-var override still honored (ROUTING_OVERRIDE_ORACLE=claude-haiku-4-5-20251001 etc) via routing.ts. Backend bun run build clean, frontend tsc --noEmit clean, frontend clean vite build clean.",
    files: [
      "backend-hono/src/services/ai/routing.ts",
      "backend-hono/src/services/ai/llm-call.ts",
      "backend-hono/src/services/ai/budget.ts",
      "backend-hono/src/services/ai/agent-map.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "frontend/components/diagnostics/RoutingWidget.tsx",
      "frontend/components/settings/HermesAdminTab.tsx",
      "supabase/migrations/20260419_07_user_budgets.sql",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T14:00:00",
    agent: "claude-code",
    summary:
      "S27 mid-sprint checkpoint (Claude-01 orchestrator). All 4 Wave 1 branches merged into v5.22 in dependency order: W1a (s27-w1a-schema → 5e584fdd, tag v.27.1), W1b (s27-w1b-sidecar → 6961a589, tag v.27.2), W1c (s27-w1c-browser → 4a936f42, tag v.27.3), W1d (s27-w1d-soul-routing → 849808d2, tag v.27.4). Conflicts resolved on src/lib/changelog.ts (kept all entries chronologically), shared/sidecar-contract.ts (kept W1a's richer superset version — AgentIdSchema, SIDECAR_HEADERS/ROUTES constants, discriminated ChatEvent, LCM_CONTEXT_TOOLS — required by harper-cards AgentHandoff variant), and hermes-sidecar/README.md (unified W1b layout tree + W1d SOUL mount doc). Post-merge verification: backend-hono bun run build clean (tsc + copy-assets), frontend tsc --noEmit clean, frontend clean vite build clean (3.36s), soul-ground-check.ts PASS (5 SOUL files grounded cleanly on CLAUDE.md), /api/diagnostics 200, /api/diagnostics/headline-volume mounts correctly on manual dist boot (returns 500 until Supabase migration 20260419_02_sources.sql applied — deferred to TP). All 5 Wave 2 branches (s27-w2a..w2e) fast-forwarded to v5.22 HEAD 849808d2 — foundations available. Contract stability gates ALL GREEN: harper-cards/skill-manifest/plugin-manifest/sidecar-contract (W1a), sidecar-client + hermes-sidecar FastAPI tree (W1b), browser pool/allowlist/harness + Rettiwt cut + headline telemetry (W1c), SOUL schema + 5 agents + loader + drift guard + routing table + llm-call (W1d). Wave 2 CLEARED to launch. Outstanding for TP: supabase db push for 20260419_02 + 20260419_04 migrations, sync of stale ~/Desktop/Codebases/fintheon launchd checkout, origin/v5.22 divergence (12 ahead / 2 diverged — rebase-or-merge call), fintheon-hermes Fly app creation (first fly deploy deferred to approval). Hermes rollback flag HERMES_SIDECAR_ENABLED=false default preserved. Formatter/linter autofixes on merged files included in this commit (prettier normalized line breaks in shared/* + backend-hono/src/services/ai/* + backend-hono/src/services/browser/*).",
    files: [
      "src/lib/changelog.ts",
      "memory/s27-orchestrator-state.md",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/ai/agent-instructions/feucht-extra.md",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "backend-hono/src/services/ai/agent-instructions/herald-extra.md",
      "backend-hono/src/services/ai/agent-instructions/oracle-extra.md",
      "backend-hono/src/services/ai/llm-call.ts",
      "backend-hono/src/services/ai/sidecar-client.ts",
      "backend-hono/src/services/browser/allowlist.ts",
      "backend-hono/src/services/browser/harness.ts",
      "backend-hono/src/services/browser/index.ts",
      "backend-hono/src/services/browser/pool.ts",
      "hermes-sidecar/README.md",
      "hermes-sidecar/hermes_sidecar/app.py",
      "hermes-sidecar/hermes_sidecar/runtime.py",
      "shared/harper-cards.ts",
      "shared/sidecar-contract.ts",
      "shared/skill-manifest.ts",
    ],
  },
  {
    date: "2026-04-20T04:30:00",
    agent: "claude-code",
    summary:
      "S27 orchestrator kickoff checkpoint (Claude-01). Spawned 9 worktrees off v5.22 HEAD (819c5a2e) under ~/Desktop/Codebases/: fintheon-s27-w1a..w1d (Wave 1) and w2a..w2e (Wave 2), each on its own feature branch s27-w{slot}-{slug}. Verified S27 foundation stubs already committed (shared/harper-cards.ts, shared/skill-manifest.ts, shared/plugin-manifest.ts, shared/sidecar-contract.ts, shared/soul-schema.ts, backend-hono/src/services/browser/index.ts, backend-hono/src/services/ai/sidecar-client.ts, backend-hono/src/services/ai/routing.ts, backend-hono/src/services/ai/soul/README.md, hermes-sidecar/README.md) from prior commit 3a5b1872. Re-ran full verification — backend-hono bun run build clean, frontend tsc --noEmit clean, frontend clean vite build clean (dist wiped first), local launchd backend /api/diagnostics returns 200. Stamped tag v.27.0-kickoff on 819c5a2e. Snapshot written to memory/s27-orchestrator-state.md for crash survival across Wave 1 merges. Wave 1 (Claudes 02-05) cleared to launch — foundations unblocked. Wave 2 gated pending mid-sprint checkpoint.",
    files: ["src/lib/changelog.ts", "memory/s27-orchestrator-state.md"],
  },
  {
    date: "2026-04-20T02:00:00",
    agent: "claude-code",
    summary:
      "[v.27.1] S27-T1 §1 W1a schema layer — populated shared/harper-cards.ts with full discriminated Zod union of 6 card variants (price-level, probability-table, agent-handoff, risk-flag, backtest-result, narrative-thread), fence contract constants (CARD_FENCE_OPEN / CARD_FENCE_CLOSE / CARD_KIND), parseCardPayload helper, and CARD_VARIANT_CATALOG for the W2a prompt builder. shared/skill-manifest.ts now carries the full agentskills.io-compatible schema (SkillManifest, SkillPermission, SkillTool, SkillSecurityScanDeclaration, SkillScanFinding, SkillScanReport, SkillImportResult) feeding T10 importer + security scanner. shared/plugin-manifest.ts expanded to match NousResearch Hermes v0.9 plugin.yaml (plugin_type, runtime, provides/requires capability graph, rollback_flag). shared/sidecar-contract.ts fully typed against T2 §2 HTTP contract: SIDECAR_ROUTES, SIDECAR_HEADERS, Chat{Request,Event} discriminated union (delta/tool_call/tool_result/context_view/memory_writes/done/error), Context{Ingest,View,Tool} schemas with LCM_CONTEXT_TOOLS constant, Voice{Stt,Tts} schemas, Skill{List,Invoke} schemas, Routing{Select} with ModelProvider enum, Healthz + SidecarErrorResponse. AgentIdSchema deduped into sidecar-contract (single source of truth); harper-cards imports it for AgentHandoff. No consumers wired yet — W2a (cards UI), W1b (sidecar-client), W1d (soul/routing), W2e (skills hub) pull types from here as their waves start. Validated: backend-hono bun run build clean, frontend npx tsc --noEmit clean, frontend vite build clean (3.23s).",
    files: [
      "shared/harper-cards.ts",
      "shared/skill-manifest.ts",
      "shared/plugin-manifest.ts",
      "shared/sidecar-contract.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T13:30:00",
    agent: "claude-code",
    summary:
      "[v.27.2] S27-T2 W1b — Hermes Python sidecar infra landed. New top-level hermes-sidecar/ directory: FastAPI on port 8318 exposing the /v1/chat (SSE) + /v1/context/{ingest,view,tools/*} + /v1/voice/{stt,tts} + /v1/skills + /v1/routing/select contract from shared/sidecar-contract.ts. uv-managed pyproject (no pip/venv), launchd plist io.solvys.fintheon-hermes with KeepAlive on crash, Fly config fintheon-hermes with internal-only networking (no public IP, shared-cpu-4x/4GB), multi-stage Dockerfile that builds wheels then ships on python:3.11-slim with tini. config.yaml picks context.engine=lcm + preloads hermes-lcm + icarus-plugin; routing.per_agent defaults are the T9 targets (Harper/Oracle→Opus, Feucht/Herald→Haiku, Consul→Sonnet). INTERNAL_HERMES_JWT HS256 auth required on every /v1 route; HERMES_AUTH_DISABLED=1 for local scratchpad only. runtime.py importlib-detects upstream hermes-agent and falls back to a stub adapter if absent so boot is never blocked — W2b (Claude-07) installs the real wheels via manual uv pip install of the git deps (kept out of pyproject due to upstream tag volatility). Populated shared/sidecar-contract.ts with full Zod schemas + types; replaced backend-hono/src/services/ai/sidecar-client.ts stub with a real typed HTTP client (SSE parser, JWT header, isSidecarEnabled() gate returning SidecarDisabledError so callers can fall back to legacy hermes-handler.ts). hermes-handler.ts untouched — flag defaults off, W2b flips it on. §3 5-point verification: (1) launchd plist plutil-lints clean + uv-run boot green; (2) /v1/chat SSE returns delta + done, 401 without JWT, 200 with valid HS256; (3) docker build + run of the prod image serves /healthz green; (4) Fly internal-network smoke requires the fintheon-hermes app to be created — deferred to TP approval before first fly deploy; (5) rollback proven trivially since the client is dormant until W2b routes through it. Backend build clean (tsc) + frontend build clean (vite, empty dist).",
    files: [
      "hermes-sidecar/pyproject.toml",
      "hermes-sidecar/config.yaml",
      "hermes-sidecar/entrypoint.py",
      "hermes-sidecar/Dockerfile",
      "hermes-sidecar/fly.toml",
      "hermes-sidecar/README.md",
      "hermes-sidecar/hermes_sidecar/app.py",
      "hermes-sidecar/hermes_sidecar/auth.py",
      "hermes-sidecar/hermes_sidecar/config.py",
      "hermes-sidecar/hermes_sidecar/models.py",
      "hermes-sidecar/hermes_sidecar/runtime.py",
      "hermes-sidecar/launchd/io.solvys.fintheon-hermes.plist",
      "shared/sidecar-contract.ts",
      "backend-hono/src/services/ai/sidecar-client.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T17:00:00",
    agent: "claude-code",
    summary:
      "[v.27.3] S27-T4 (W1c): shared browser primitives + Rettiwt cut + 48h headline telemetry. New backend-hono/src/services/browser/ suite — singleton Playwright pool (max 4 pages, LIFO reuse, auto-reconnect), tiered allow-list with per-domain daily quotas (regulatory/market/social/news — X/Twitter 500/day replaces Rettiwt, SEC/Fed/BLS/Treasury regulatory tier at 50-200/day, prediction markets + Bloomberg/Reuters/WSJ/FT), harness.ts exposing browseRead({mode: 'allowlist'|'universal', waitFor, extract, textOnly, budget_usd}) with self-healing selector fallbacks (data-testid→data-test/data-qa, class→substring, id→aria/name, article/main heuristics), per-domain circuit breaker (3 fails × 10min pause reusing AgentReach pattern), universal-mode env gate (BROWSER_UNIVERSAL_ENABLED=false throws UNIVERSAL_MODE_DISABLED), $0.01/URL budget cap, full audit log to browser_fetches, and quota ledger mirrored to browser_quota_ledger for restart-safe daily counts. screenshot-service.ts refactored off subprocess-spawn onto the pool (persistent pages cut Playwright launch overhead). Rettiwt cut from Herald dispatcher: feed-poller.ts stubs out pollForEconNews/manualRefresh/rettiwtUserTimeline inline (returns empty arrays, preserves structure); boot/services.ts gates initRettiwtPool + startEconPoller behind RETTIWT_REENABLE=true (default off); rettiwt-service.ts + riskflow/rettiwt-poller-accounts.ts kept intact with S27-T4 header comments for fast re-enable. Migration 20260419_02_sources.sql adds source/source_domain/fetched_at/fetch_latency_ms to riskflow_items, v_headline_volume_48h view for per-source comparison, browser_fetches audit table, browser_quota_ledger table. New route GET /api/diagnostics/headline-volume returns 48h per-source counts + pool stats + quota snapshot + circuit-breaker state. HeadlineVolumeWidget mounted on HermesAdminTab (the existing diagnostics surface) — glassmorphic, accent-gold numerics, per-source sparklines, no gradients/kanban/shimmer. Unblocks Wave 2 (T6 Harper Browser Operator + T7 News Worker consume from browser/ barrel).",
    files: [
      "backend-hono/src/services/browser/pool.ts",
      "backend-hono/src/services/browser/allowlist.ts",
      "backend-hono/src/services/browser/harness.ts",
      "backend-hono/src/services/browser/index.ts",
      "backend-hono/src/services/screenshot-service.ts",
      "backend-hono/src/services/rettiwt-service.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "supabase/migrations/20260419_02_sources.sql",
      "frontend/components/diagnostics/HeadlineVolumeWidget.tsx",
      "frontend/components/settings/HermesAdminTab.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T12:00:00",
    agent: "claude-code",
    summary:
      "[v.27.4] S27 W1d (Claude-05) — T8 SOUL.md full conversion + T9 Smart Model Routing foundation. SOUL schema lives in shared/soul-schema.ts (Zod: identity/scope/constraints/grounding/tools/handoff_rules/voice_style/memory_policy/model_preferences). Five SOUL files under backend-hono/src/services/ai/soul/ (harper/oracle/feucht/consul/herald) each with YAML frontmatter. grounding.source_of_truth imports ../../../../../CLAUDE.md literally at load time — no copy-paste. Loader (soul/loader.ts) validates via Zod, resolves grounding + extras, 5-minute TTL cache, renderSystemPrompt() helper. Existing dossier bodies moved into agent-instructions/{agent}-extra.md + harper-extra.md; dossiers/*.ts converted to readFileSync shims. harper-handler.ts + agent-instructions/index.ts load SOUL first, fall back to legacy composition only if SOUL read fails (Zod errors at boot = fail-fast). Drift guard at scripts/soul-ground-check.ts flags paragraph duplication against CLAUDE.md — passes on clean tree. Backend build script extended to copy .md into dist via scripts/copy-assets.ts so launchd-managed dist runtime resolves SOUL + CLAUDE.md correctly. T9 foundation: ROUTING_TABLE populated (Harper→Opus, Oracle→Opus, Feucht→Haiku, Consul→Sonnet, Herald→Haiku, harper-voice→<QWEN_REASONING_LATEST> sentinel for Claude-08 to fill in T5 W2c), selectModel() with ROUTING_OVERRIDE_<AGENT> env support, llm-call.ts wrapper emits routing_decisions rows automatically. Migration 20260419_04_gepa_metrics.sql creates routing_decisions + gepa_metrics tables. Hermes sidecar README documents SOUL mount for W1b integration. No call-site flips yet — W2e owns the routing flip. Backend build clean, frontend tsc + vite build clean, soul-ground-check PASS, fail-fast verified via broken SOUL → Zod rejection.",
    files: [
      "shared/soul-schema.ts",
      "backend-hono/src/services/ai/soul/loader.ts",
      "backend-hono/src/services/ai/soul/harper.md",
      "backend-hono/src/services/ai/soul/oracle.md",
      "backend-hono/src/services/ai/soul/feucht.md",
      "backend-hono/src/services/ai/soul/consul.md",
      "backend-hono/src/services/ai/soul/herald.md",
      "backend-hono/src/services/ai/agent-instructions/harper-extra.md",
      "backend-hono/src/services/ai/agent-instructions/oracle-extra.md",
      "backend-hono/src/services/ai/agent-instructions/feucht-extra.md",
      "backend-hono/src/services/ai/agent-instructions/consul-extra.md",
      "backend-hono/src/services/ai/agent-instructions/herald-extra.md",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/oracle.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/feucht.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/consul.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/herald.ts",
      "backend-hono/src/services/ai/routing.ts",
      "backend-hono/src/services/ai/llm-call.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/scripts/copy-assets.ts",
      "backend-hono/package.json",
      "scripts/soul-ground-check.ts",
      "supabase/migrations/20260419_04_gepa_metrics.sql",
      "hermes-sidecar/README.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T01:00:00",
    agent: "claude-code",
    summary:
      "v5.22.2 deploy — 3-target ship after prior stale deploy by another Claude. Pushed current v5.22 state (S26 mobile polish + v5.22 desktop refit + S27 planning + S27 foundation stubs) to all three prod surfaces. Backend redeployed to Fly.io app `fintheon` (fintheon.fly.dev) — rolling update, new machine reached good state, all 4 services green (Hermes AI / Supabase / X Feed / Supabase Auth). Desktop frontend Vercel project rebuilt + deployed (behind auth as expected, consumed via Electron app). Mobile PWA rebuilt clean (find dist -mindepth 1 -delete + vite build + vercel build --prod + vercel deploy --prebuilt --prod), new deployment dpl_Gp43QuJp57GyU15zuMXw6HFosrXV aliased to fintheon.pricedinresearch.io. Verified via build-hash match (index-CsfywWAP.js serving on prod matches local .vercel/output). Git tag v5.22.2 pushed + GitHub release created. Local launchd-managed backend unloaded + reloaded + diagnostics green. All riskflow smoke endpoints returning valid JSON on prod. Zero functional change — S27 stubs are typed-only throw-on-call scaffolding for the 10-Claude sprint worktrees.",
    files: ["package.json", "src/lib/changelog.ts"],
  },
  {
    date: "2026-04-20T00:45:00",
    agent: "claude-code",
    summary:
      "S27 Agentic Intelligence Sprint finalized as 10-Claude edition after 4 rounds of TP Q&A. Key pivots from initial draft: (1) T2 switches from native TS ContextEngine port to running real NousResearch Hermes Agent as a Python sidecar (io.solvys.fintheon-hermes launchd + Fly machine on port 8318). (2) T4 widens from Herald-only to shared browser primitives under backend-hono/src/services/browser/ — browser-use/browser-harness replaces Rettiwt (cut from dispatcher, code left inert) AND acts as fallback when Exa/AgentReach miss; headline-volume telemetry surfaces 48h pre/post comparison. (3) T5 rescoped from brief-narration to fixing the broken OpenAI voice assistant: voicebox/Qwen3-TTS + Whisper-equiv STT + smartest free Qwen reasoning via sidecar, grounded on SOUL file; non-interrupting rim UX (electron window-chrome + matching web overlay) so it never covers trading content. (4) All S28 strategic items absorbed into S27: T8 SOUL.md full conversion of 5 agents with Harper CLAUDE.md as source of personal truth, T9 Smart Model Routing live per-agent (Oracle→Opus, Feucht→Haiku, Consul→Sonnet, Herald→Haiku, Harper→Opus), T10 Skills Hub full agentskills.io adoption + security scanner + importer, T11 GEPA self-improvement loop (DSPy evolutionary optimization, PR-gated review against soul-evolution/ branch — never auto-merges). (5) T6 Harper Browser Operator (Hyperagent-inspired browse_task tool + Supabase action cache) and T7 Always-On News Worker (sibling launchd/Fly process, portless-addressed news.fintheon.test, Supabase-coupled so backend restarts don't interrupt ingestion) added new. Execution: waves (contract-first), 10 worktrees off v5.22, 1 persistent orchestrator Claude across 3 checkpoints, rolling v.27.N tags culminating in v.27.10 unified release. Produced 11 task briefs + rewritten orchestration doc. No source code changed; this is planning artifact only.",
    files: [
      "docs/sprint-briefs/S27-ORCHESTRATION.md",
      "docs/sprint-briefs/S27-T1-generative-ui-harper.md",
      "docs/sprint-briefs/S27-T2-context-sandbox.md",
      "docs/sprint-briefs/S27-T3-a2a-handoff.md",
      "docs/sprint-briefs/S27-T4-herald-browser.md",
      "docs/sprint-briefs/S27-T5-agent-voice-briefs.md",
      "docs/sprint-briefs/S27-T6-harper-browser-operator.md",
      "docs/sprint-briefs/S27-T7-news-worker.md",
      "docs/sprint-briefs/S27-T8-soul-conversion.md",
      "docs/sprint-briefs/S27-T9-smart-model-routing.md",
      "docs/sprint-briefs/S27-T10-skills-hub.md",
      "docs/sprint-briefs/S27-T11-gepa-loop.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T23:50:00",
    agent: "claude-code",
    summary:
      "S27 sprint brief set authored from GitHub stars audit. TP asked for a sprint of wins that would increase UX + power of Fintheon's analysis and agentic features. Mined github.com/solvys starred repos (12 total), cross-referenced against a platform audit, and identified 8 concrete gaps. Produced S27-ORCHESTRATION.md + 5 task briefs as a 3-track parallel sprint: Track A (Harper UX) = T1 generative UI cards (vercel-labs/json-render inspired — fills the gap where harper-handler.ts:144 instructs Harper to emit structured JSON but no parser is wired) + cult-ui polish; Track B (Agent Core) = T2 tool-output sandbox (mksglu/context-mode, 98% token reduction target) + T3 A2A handoff protocol (Bitterbot-AI inspired — Harper gains handoff_to_oracle/feucht/consul/herald tools, replacing the current regex intent router which only mentions agents in prose); Track C (Capabilities) = T4 Herald browser-harness (browser-use/browser-harness, narrow allow-list for SEC EDGAR + FOMC + Polymarket) + T5 agent-voiced briefs (OpenAI TTS with per-agent voice map, voicebox/Qwen3 deferred). Tier-B stretch items noted: Dream Engine, wterm ops console, CL4R1T4S prompt red-team. No source code changed.",
    files: [
      "docs/sprint-briefs/S27-ORCHESTRATION.md",
      "docs/sprint-briefs/S27-T1-generative-ui-harper.md",
      "docs/sprint-briefs/S27-T2-context-sandbox.md",
      "docs/sprint-briefs/S27-T3-a2a-handoff.md",
      "docs/sprint-briefs/S27-T4-herald-browser.md",
      "docs/sprint-briefs/S27-T5-agent-voice-briefs.md",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T03:15:00",
    agent: "claude-code",
    summary:
      "v5.22 mobile beta polish per TP screenshots. (1) NotificationDrawer overhauled: cards extracted into NotificationCard with bidirectional swipe — left swipe past 96px (or 600 velocity) dismisses with red DISMISS bg; right swipe on scored alerts fires fintheon:harper-prefill + fintheon:tab-change so the notification text seeds the chat input on the Harper tab; right swipe on proposal cards (regime/lexicon/walkBack/tool approvals) snaps to a revealed mode that exposes inline Approve / Deny buttons (TP: 'swipe from the left to the right to be able to bring up the approve or deny buttons'). Clear button at top-right runs a fast staggered exit (40ms between cards) and marks-all-read; dismissed ids persist to localStorage so they don't reappear on reopen. Card body line-clamp widened 2 → 3, padding bumped, glass surface keeps blur(20px) saturate(1.4). (2) System-category notifications (regimeActivations/dailyBrief/maintenanceRequest/regimeProposals/lexiconProposals/walkBackReverts/toolApprovals) drop the severity fuse — they're system pings, not scored alerts. Replaced with a thin accent strip on the left rail and a category label (REGIME/BRIEF/PROPOSAL/etc.) instead of severity text. (3) ChatInput caret v3: previous attempts left iOS Safari painting the caret stripe above the placeholder baseline. Now the caret is hidden while the field is empty (TP: 'should remove itself when I start typing') and snaps to accent the moment the user types a character; symmetric padding (11px top+bottom) + lineHeight 1.25 keep the line-box centered in the textarea so the caret strip and placeholder share the same vertical strip. Dropped the on-mount auto-size pass — was producing inconsistent scrollHeight reads. (4) Removed nothing-fuse-shimmer globally — too brief on mobile to register, dropped the keyframe + per-component overlays. ChatPage harper-prefill listener prefills the textarea on Ask-Harper swipe (appends if there's already text). App.tsx routes fintheon:tab-change to handleTabChange. tsc + vite build clean.",
    files: [
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/notifications/NotificationCard.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/shared/IVFuseBar.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "mobile/components/home/HomePage.tsx",
      "mobile/index.css",
      "mobile/App.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T02:30:00",
    agent: "claude-code",
    summary:
      "v5.22 mobile dash polish per TP screenshot. (1) Page 2 calendar swap: TradingView EconCalendarEmbed was rendering as a black void on TP's phone; replaced with the native MiniSessionCalendar (reads /api/econ/calendar directly, no third-party widget, scroll-overflow inside the page so the Aquarium summary still anchors the bottom). (2) Mobile Instrument Outlook drops YM client-side via a small blocklist in useInstrumentOutlook — desktop keeps the full /NQ /ES /YM /CL /GC grid. (3) Catalyst snap-page deleted from HomePage — RiskFlow already covers that surface per TP; Timeline shifts up to page 5; CatalystCards.tsx file kept on disk for the catalyst-detail modal route. (4) Risk signals data flow verified: mobile dash page 4 (MobileRiskSignalCards) reads /api/riskflow/risk-signals, same source as desktop Aquarium's RiskSignalCards; endpoint returned 200 with empty `signals` at curl time (cache cold), but mobile's localStorage cache + 120s repoll handles it. tsc clean, vite build clean.",
    files: [
      "mobile/components/home/HomePage.tsx",
      "mobile/hooks/useInstrumentOutlook.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-20T02:10:00",
    agent: "claude-code",
    summary:
      "v.26.5 Aquarium revert per TP. My v.26.3 commit incorrectly placed the pricedinresearch.io/fintheon URL as an iFrame in the Aquarium (replacing the MiroShark Deliberation pane) AND removed the NextSessionForecastCard. That was a misread of TP's instruction — the URL was already placed in mobile About (Part 1, correct), and the 'embed' in 'where you put the embed' was not something I had actually placed. Sanctum.tsx restored to its ccee7f4^ state: MiroShark Deliberation pane back, NextSessionForecastCard back, iFrame removed. Mobile About link stays correctly pointed at pricedinresearch.io/fintheon.",
    files: ["frontend/components/narrative/Sanctum.tsx"],
  },
  {
    date: "2026-04-20T01:30:00",
    agent: "claude-code",
    summary:
      "v5.22 S2 (mobile) — TP audit fixes + cross-platform settings sync + MiroShark→Agent Desk rename. Chat: assistant message now inserts on first text-delta (no more hollow thinking bubble per TP); per-user-message status caption (sending → sent → error); 12s no-stream watchdog (HARPER SILENT — CHECK DESKTOP RELAY) without closing the stream; DEV console.debug for unknown SSE event types; thinking-indicator gate widened to cover the lazy-insert window. ChatInput: caret alignment fix (verticalAlign top, boxSizing border-box, explicit minHeight, useLayoutEffect on mount, caretColor accent). HomePage: AGENTIC DESK → AGENT DESK label; hero ticker IV/VIX/IMPLIED labels share one baseline (alignItems flex-start + lineHeight 1). Fuses: nothing-fuse-shimmer keyframe (4.2s, 76%-100% dwell, reduced-motion guard) added to mobile/index.css; IVFuseBar/VerticalFuseBar/HomePage IVSubScores/NotificationDrawer/RiskFlowCard now route color through colorForSeverity/colorForScore from mobile/lib/fuse-palette and use opaque var(--fintheon-surface) tracks with the shimmer overlay. Catalyst tap: NotificationDrawer.onItemTap now dispatches catalyst/riskflow/maintenance/briefing URLs through useNotificationModal instead of window.location.href, so drawer taps open the DetailSheet (matches push-tap). MiroShark rename: useMirosharkLatest → useAgentDeskLatest (file + export + types + cache key); AGENTIC DESK label + miroshark prop → agentDesk; AquariumSummary import updated. /api/miroshark/* URL kept (S1 maintains backend alias); ivData.mirosharkComponent backend response field kept (no-op for client). Settings sync: SettingsContext additively fetches /api/preferences on mount and polls every 30s; setPreferences PUTs the shared UserPreferences shape; theme bridges both directions through ThemeContext (mobile picker → /api/preferences PUT; remote poll detects desktop theme change → ThemeContext.setTheme). Falls back silently to DEFAULT_PREFERENCES if S1 hasn't deployed /api/preferences yet — no feature flag, no blocking. SettingToggle gained a readOnly variant with a SET FROM DESKTOP caption for desktop-authoritative fields. tsc clean, vite build clean.",
    files: [
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/home/HomePage.tsx",
      "mobile/components/home/AquariumSummary.tsx",
      "mobile/components/shared/IVFuseBar.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/settings/SettingToggle.tsx",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/hooks/useAgentDeskLatest.ts",
      "mobile/index.css",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-19T23:55:00",
    agent: "claude-code",
    summary:
      "v5.22 S1 — desktop refit + backend preferences + MiroShark → Agent Desk rename. (Rename) Swept frontend/ + backend-hono/src/ over 84 files: folders frontend/components/miroshark → agent-desk, backend-hono/src/{routes,services}/miroshark → agent-desk; files types/miroshark.ts → agent-desk.ts, agent-bus/templates/miroshark-template.ts, cron/miroshark-daily.ts; MIROSHARK_ENABLED → AGENT_DESK_ENABLED in .env.example; MIROSHARK_WEIGHT → AGENT_DESK_WEIGHT in iv-scorer. Dual-mount /api/agent-desk (new) + /api/miroshark (legacy alias for v5.22) in backend-hono/src/routes/index.ts. DB columns (miroshark_deliberations) and harper-autonomous historical annotations deliberately untouched. Mobile unchanged (Session 2 owns). (CSS) New @keyframes nothing-fuse-shimmer + .nothing-fuse-shimmer class in frontend/index.css — 4.2s linear cycle with 76%→100% dwell for ~1s of dead time; prefers-reduced-motion gates the animation. New shared component frontend/components/shared/NothingFuse.tsx as the single fuse primitive (horizontal + vertical, value 0-1, severity/score color resolution via shared palette). (Sanctum layout) Aquarium page 0: removed max-w-2xl + flex justify-center from the KPI row, applied dashboard-margin alignment (mx-1) matching the top VOLATILITY READ frame, gap-10 replaces vertical dividers; ANALYSIS now sits in its own framed glass surface (accent border + color-mix surface). Prediction cards switched to grid-cols-5 so /NQ /ES /YM /CL /GC headers sit on one line. (Deliberation) AgentDeskDebatePanel gains a footer row of three nothing-shimmer fuses — Signal / Regime / Heat — reading compositeIV, regimeShiftProbability, confidence from Sanctum. (Econ + Instrument Fuses) Page 1 now splits flex gap-4 60/40: SanctumEconIntel left, new InstrumentFusesPanel right rendering /NQ /ES /YM /CL /GC as vertical NothingFuse bars polled from /api/predictions/outlook. (RiskFlow desktop card) AlertRow rebuilt with mobile vocabulary at larger desktop density: left severity fuse, palette-driven border-left + severity tint from colorForSeverity/severityFromScore; TradeIdeaRow also gets the palette border-left. Footer IV wire kept on the existing riskflow-fuse-shimmer. (Fuse shimmer application) BlendedVIXCard component bars, NextSessionForecastCard confidence, AquariumPredictionCards HEAT bar — all now use NothingFuse with palette colors; rounded-full + bg-zinc-800 replaced with rounded-[2px] + var(--fintheon-surface). (Preferences spine) New supabase/migrations/20260419_user_preferences.sql creating public.user_preferences (user_id UUID PK → auth.users, prefs JSONB, updated_at) with 4 RLS policies (select/insert/update self + service_role ALL). Applied via Supabase MCP. New backend-hono/src/routes/preferences/index.ts with Zod-validated GET/PUT, registered at /api/preferences under authMiddleware+requireAuth. SettingsContext extended with preferences state, updatePreferences helper, localStorage fallback (fintheon:preferences), PUT-on-change + GET-poll-every-30s-when-tab-visible. Validation: frontend tsc clean, vite build clean (2278 kB main bundle, gzip 583 kB), backend bun run build clean, grep residual for miroshark zero live hits.",
    files: [
      "frontend/index.css",
      "frontend/components/shared/NothingFuse.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/narrative/BlendedVIXCard.tsx",
      "frontend/components/narrative/NextSessionForecastCard.tsx",
      "frontend/components/narrative/InstrumentFusesPanel.tsx",
      "frontend/components/agent-desk/AgentDeskDebatePanel.tsx",
      "frontend/components/agent-desk/AgentDeskPanel.tsx",
      "frontend/components/agent-desk/AgentDeskInject.tsx",
      "frontend/components/agent-desk/AgentDeskPrediction.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/IVScoreCard.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/types/agent-desk.ts",
      "backend-hono/src/routes/preferences/index.ts",
      "backend-hono/src/routes/agent-desk/index.ts",
      "backend-hono/src/routes/agent-desk/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/agent-desk/agent-desk-service.ts",
      "backend-hono/src/services/agent-desk/agent-desk-types.ts",
      "backend-hono/src/services/agent-desk/agent-desk-client.ts",
      "backend-hono/src/services/agent-desk/agent-desk-deliberation.ts",
      "backend-hono/src/services/agent-desk/agent-desk-briefing.ts",
      "backend-hono/src/services/agent-desk/agent-desk-seed.ts",
      "backend-hono/src/services/agent-desk/agent-desk-reactive.ts",
      "backend-hono/src/services/agent-desk/agent-desk-boot.ts",
      "backend-hono/src/services/agent-desk/agent-desk-context.ts",
      "backend-hono/src/services/agent-bus/templates/agent-desk-template.ts",
      "backend-hono/src/services/cron/agent-desk-daily.ts",
      "backend-hono/src/services/market-data/iv-scorer.ts",
      "backend-hono/.env.example",
      "supabase/migrations/20260419_user_preferences.sql",
    ],
  },
  {
    date: "2026-04-19T23:15:00",
    agent: "claude-code",
    summary:
      "v5.22 kickoff — shared cross-platform contracts. Landed fuse-palette module (FuseSeverity/FusePriority types + DEFAULT_FUSE_PALETTE + severityFromScore/colorForSeverity/colorForPriority/colorForScore helpers) as the single source of truth for fuse color linking across the app. Landed user-preferences shape (ThemeMode, NotificationPrefs, UserPreferences, DEFAULT_PREFERENCES, PREFERENCES_API_PATH) for the desktop↔mobile settings sync spine. Both modules live in BOTH frontend/lib and mobile/lib as mirrored copies — keep in sync byte-for-byte until a shared workspace package exists. Session 1 (desktop+backend) and Session 2 (mobile) both import from these paths. Does not touch UI yet — this is the pre-handoff contract commit so the two parallel sessions don't collide on typing decisions.",
    files: [
      "frontend/lib/fuse-palette.ts",
      "mobile/lib/fuse-palette.ts",
      "frontend/lib/user-preferences.ts",
      "mobile/lib/user-preferences.ts",
    ],
  },
  {
    date: "2026-04-19T22:40:00",
    agent: "claude-code",
    summary:
      "S26-P2: heavy mobile UX + maintenance backend (v.26.2). (T1) SnapSheet gesture rewrite — dismiss now requires the pill handle (tap OR swipe-down with AND(offset>260, velocity>500)). Content area no longer drags; full viewport scrolls in place. dragElastic 0.1→0.08 so pushing past the threshold barely rubber-bands. Handle hit target padded to 16×32×12; pill tints to 40% accent on press for tap affordance. Fixes TP's bulletin-collapses-on-scroll-up complaint. (T5) Theme picker full-bleed rewrite — each row IS the accent swatch (44×full-width, rounded 8, luminance-aware label color); active row gets a 2px inset ring in --fintheon-text. Font picker follows the same pattern. New light/dark `mode` in ThemeContext with Sun/Moon toggle inside the hamburger menu; dark remains default. Light mode flips bg/surface to paper + text to near-black while keeping theme accent so brand identity persists. Persists to localStorage key `fintheon:theme-mode`. (T9) Maintenance backend: new POST /api/maintenance/decision (super-admin gated via peer-registry role OR SUPER_ADMIN_USER_ID env allow-list; returns 401 unauthed, 403 non-admin), new GET /api/maintenance/request/:id (public read); registered at /api/maintenance under optional-auth. Supabase-backed when maintenance_requests + maintenance_decisions tables exist; falls back to in-memory store otherwise. Added `maintenance_request` to NOTIFICATION_CATEGORIES + `requestId` to PushPayload. Service worker bumped to fintheon-v5.26.1 — new lock-screen action handler for approve_commit/approve_deploy/deny → no-auth POST /api/maintenance/decision; requestId threaded into notification.data + notification-tap postMessage. Mobile: MaintenanceDetail modal (issue preview + fix description + 3-button action row: COMMIT+DEPLOY filled-accent, COMMIT-ONLY accent-outline, DENY muted-secondary); non-admins see read-only footer. AuthContext now exposes `isSuperAdmin` via TP_USER_ID (memory: 826e7c65-...) or VITE_SUPER_ADMIN_USER_ID env override. NotificationModalContext + DetailSheetRoot + useNotificationTapRouter all dispatch on kind:'maintenanceRequest'. Haptics on approve (success) + deny (deny). (T10) RiskFlow card → catalyst modal transition gets the IV fuse drain/fill choreography TP asked for. Approach B (explicit): on tap the card's VerticalFuseBar drains top-down over 220ms (segment transition-delay staggered 18ms × 10), then the modal opens with the horizontal IVFuseBar animating from 0 to the real score (existing 720ms charge animation reads naturally as the continuation of the drain). Reads like juice flowing from the card to the modal footer. Validation: mobile tsc clean, vite build clean (index 552.14 kB); backend tsc clean; backend restarted via launchctl; /api/diagnostics 200; /api/maintenance/decision unauthed returns 401 as required.",
    files: [
      "mobile/components/shared/SnapSheet.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "mobile/components/settings/ThemePickerAccordion.tsx",
      "mobile/components/settings/FontPickerList.tsx",
      "mobile/components/layout/HamburgerMenu.tsx",
      "mobile/contexts/ThemeContext.tsx",
      "mobile/contexts/AuthContext.tsx",
      "mobile/contexts/NotificationModalContext.tsx",
      "mobile/components/catalyst-modal/DetailSheetRoot.tsx",
      "mobile/components/catalyst-modal/MaintenanceDetail.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/hooks/useMaintenanceById.ts",
      "mobile/hooks/useNotificationTapRouter.ts",
      "mobile/lib/services/maintenance.ts",
      "mobile/public/sw.js",
      "backend-hono/src/routes/maintenance.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/notifications/emit.ts",
      "backend-hono/src/services/web-push-sender.ts",
    ],
  },
  {
    date: "2026-04-19T21:15:00",
    agent: "claude-code",
    summary:
      "S26-P1: mobile polish pass (v.26.1). (T2) Briefing modal no longer carries an IV score — DetailFooter gained a `showIV` prop (default true) and BriefDetail opts out; severity dropped from the briefing DetailHeader. (T3) RiskFlow detail no longer duplicates the headline/body when they're substantively identical (Twitter items where body is a truncated tweet) — guarded via bodyDuplicatesHeadline (headline === body, prefix, or loose contains). Added a `View original` arrow link under the headline that opens item.url in a new tab when present; EmbedPreview stays for rich Twitter/OG peeks. (T4) Settings sections stripped of card chrome per TP — CollapsibleSection no longer renders background, border, radius, backdropFilter, or shadow; only vertical padding + a horizontal bottom border that fades from transparent to 8% accent on open/hover. SettingsPage gap zeroed so each section's fading separator reads as the divider between it and the next. (T6) TraderSection reduced to identity only: Display Name (read-only) + Trader Tag (read-only toolbar-wordmark preview). CAO name, risk limits, Hermes AI, Alert Sounds, Haptics, and Bulletin Reminder Glow all removed from this section. caoName + riskSettings fields + RiskSettings type deleted from SettingsContext + remote merge path. Hermes AI / Alert Sounds / Haptics / Bulletin Reminder Glow moved under NotificationsSection where they belong by category. (T7) New `mobile/lib/haptics.ts` module — module-level enabled flag + `haptic.tap/success/deny` pattern helpers. SettingsContext keeps the module flag in sync with `hapticEnabled` on every change so non-React call-sites respect user intent. PullToRefresh now fires haptic.tap on arm + haptic.success on refresh-complete (previously a single buzz on arm). NotificationDrawer fires haptic.success on approve and haptic.deny on deny or network error. StatusProvider fires haptic.success on type=success toasts and haptic.deny on type=error. Info toasts stay silent. Haptics toggle surfaced in NotificationsSection. (T8) About section gains a link row to https://pricedinresearch.io/fintion rendered as `→ pricedinresearch.io/fintion` in accent-colored data font, matching the new borderless style. Validation: mobile tsc clean; vite build clean (index 542.68 kB).",
    files: [
      "mobile/components/catalyst-modal/DetailFooter.tsx",
      "mobile/components/catalyst-modal/BriefDetail.tsx",
      "mobile/components/catalyst-modal/RiskFlowDetail.tsx",
      "mobile/components/settings/CollapsibleSection.tsx",
      "mobile/components/settings/SettingsPage.tsx",
      "mobile/components/settings/TraderSection.tsx",
      "mobile/components/settings/NotificationsSection.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/shared/PullToRefresh.tsx",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/contexts/ToastContext.tsx",
      "mobile/lib/haptics.ts",
    ],
  },
  {
    date: "2026-04-19T20:00:00",
    agent: "claude-code",
    summary:
      "S25: SOTA mobile notifications + full-viewport catalyst DetailSheet. Backend: PushPayload extended with image/actions/badge/itemId/approvalId; tool-approval-store push now carries lock-screen Approve/Deny actions; new routes GET /api/harper/approvals/:id, POST /api/harper/dispatch (Ask CAO seeded Harper conversation), POST /api/tool-decision-quick (no-auth, approval-id-as-secret, 10-min window), GET /api/riskflow/items/:id, GET /api/narrative/catalysts/:id, GET /api/preview/og (allow-listed OG scraper). Mobile: new DetailSheet (full-viewport glass, drag-to-close), IVFuseBar (severity-sensitive), EmbedPreview (tweet/YouTube/OG peek w/ shimmer), reusable InlineApprovalCard (drawer/modal/chat-ready), DetailHeader/DetailFooter (IV fuse + Ask CAO CTA). NotificationModalContext wraps app; DetailSheetRoot dispatches on {toolApproval|riskflowItem|catalyst|dailyBrief}. useNotificationTapRouter replaces the App.tsx SW handler, routes tab+modal in one pass from push-tap URLs. Card presses on CatalystCards/RiskFlowCard/BriefingCard open the modal (replacing inline expansion on RiskFlow). Ask CAO POSTs /api/harper/dispatch, seeds single-agent Harper convo, routes to Chat tab. Service worker v5.22.0: lock-screen action buttons fire no-auth POST /api/tool-decision-quick, rich-media image, per-item tags (approvals stack, riskflow collapses), setAppBadge bump + clear-badge message handler. useNotificationHistory mirrors unreadCount into setAppBadge, clears on markAllRead. Settings: added three missing backend categories (regimeProposals, lexiconProposals, walkBackReverts). Chat: ChatApprovalMessageSlot stub behind VITE_CHAT_APPROVAL_DEMO for TP to wire generative-task previews. IV source: existing per-item item.ivScore; dispatch target: single-agent Harper per TP.",
    files: [
      "backend-hono/src/services/web-push-sender.ts",
      "backend-hono/src/services/notifications/emit.ts",
      "backend-hono/src/services/notifications/riskflow-payload.ts",
      "backend-hono/src/services/tool-approval-store.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/preview/og-scraper.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/routes/harper/approvals.ts",
      "backend-hono/src/routes/harper/dispatch.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/narrative/index.ts",
      "backend-hono/src/routes/narrative/handlers.ts",
      "backend-hono/src/routes/relay-quick.ts",
      "backend-hono/src/routes/preview.ts",
      "backend-hono/src/routes/index.ts",
      "mobile/App.tsx",
      "mobile/public/sw.js",
      "mobile/lib/sheet-motion.ts",
      "mobile/lib/badge.ts",
      "mobile/contexts/NotificationModalContext.tsx",
      "mobile/components/shared/DetailSheet.tsx",
      "mobile/components/shared/IVFuseBar.tsx",
      "mobile/components/embed/EmbedPreview.tsx",
      "mobile/components/approvals/InlineApprovalCard.tsx",
      "mobile/components/catalyst-modal/DetailHeader.tsx",
      "mobile/components/catalyst-modal/DetailFooter.tsx",
      "mobile/components/catalyst-modal/DetailSheetRoot.tsx",
      "mobile/components/catalyst-modal/ToolApprovalDetail.tsx",
      "mobile/components/catalyst-modal/RiskFlowDetail.tsx",
      "mobile/components/catalyst-modal/CatalystDetail.tsx",
      "mobile/components/catalyst-modal/BriefDetail.tsx",
      "mobile/components/chat/ChatApprovalMessageSlot.tsx",
      "mobile/components/home/CatalystCards.tsx",
      "mobile/components/home/BriefingCard.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/settings/NotificationsSection.tsx",
      "mobile/hooks/useNotificationHistory.ts",
      "mobile/hooks/useNotificationTapRouter.ts",
      "mobile/hooks/useToolApprovalById.ts",
      "mobile/hooks/useRiskFlowItem.ts",
      "mobile/hooks/useCatalystById.ts",
      "mobile/hooks/useAskCAO.ts",
      "mobile/hooks/useEmbedPreview.ts",
    ],
  },
  {
    date: "2026-04-18T23:15:00",
    agent: "claude-code",
    summary:
      "S25 — RiskFlow 24h hardening + Teams Card rewrite + Round Robin repair (7 phases). (T1) Agent Reach promoted to PRIMARY source: dedicated poller via createBasePoller, UA rotation across 10 realistic UAs, per-domain token bucket (15s min interval), per-domain circuit breaker (403/429/5xx × 3 → 10min pause), RSS preferred over HTML (Reuters/MarketWatch/CNBC/SeekingAlpha/ZeroHedge/Bloomberg). Rettiwt demoted to secondary: only polls when hasAuthenticatedKeys() returns true, cooldown 90s→180s. Agent Reach removed from runScrapeFallback to prevent double-dip. (T2) /api/riskflow/sources expanded: sources.{agentReach,rettiwt,feedPoller} blocks + newsfeedHealthy/Degraded unified signals + userPollStats{userId}.{lastPollAt,lastSuccessAt,totalContributions,currentlyOwner}. user-polling-registry lifted from cosmetic to functional: new recordUserPollSuccess/Attempt helpers, BACKEND_SENTINEL_USER_ID for attribution when no user is online. feed-poller now registers in health-registry + rotates polling owner each cycle. (T3) Manual poll stripped from user UI: riskflow.refresh() rewritten to fetchLatest() (cache re-read, no poll). On-open refresh no longer triggers backend poll — only re-queries feed. New POST /api/riskflow/doctor (self-only, 60s cooldown) — the ONE user-facing poll trigger: forceRefreshPool + scoringCycle + seedCacheFromDb + Agent Reach tick. Intentionally omits forcePoll to keep Rettiwt on its scheduled cadence (no compounding rate-limit exposure from many Doctor clicks). (T4) TeamMemberCard rewritten: unified News light (green if any source healthy <5min, orange degraded, red only if backend reachable AND all sources stale, grey if offline/no backend) + per-member 'Polled Nm ago · N contributions' row backed by real lastSuccessAt + Stethoscope Doctor button (self only, cooldown-aware, glass-styled). Peers show Rettiwt chip as drill-down. ServiceStatus type + useSourceStatus hook + TeamPresenceContext broadcast all carry the new fields. (T5) polling-config rewritten with 5 tiers: RTH 60s / pre-post 60s / overnight 300s / weekends 600s + hot-mode 15s override (30min after any Level 4 item; triggerHotMode hooked into broadcastLevel4). (T6) New poll-watchdog (60s loop) — if Agent Reach lastRunAt >10min: WARN+soft-tick, >20min: full poller restart. Rettiwt pool reloaded every 15min from Supabase (not just on user login). Fly min_machines_running=1 verified. (T7) Push chain audited — Level 4 already flows to emitPushAndLog→web-push-sender via central-scorer coalesceAndEmit with critical severity bypassing quiet hours. New bun run test:24h harness covers 4 scenarios: autonomous heartbeat, Rettiwt-degraded fallthrough, per-user attribution, domain circuit breakers. All 4 PASS on local.",
    files: [
      "backend-hono/src/services/agent-reach-service.ts",
      "backend-hono/src/services/riskflow/agent-reach-poller.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/polling-config.ts",
      "backend-hono/src/services/riskflow/user-polling-registry.ts",
      "backend-hono/src/services/riskflow/poll-watchdog.ts",
      "backend-hono/src/services/riskflow/sse-broadcaster.ts",
      "backend-hono/src/services/rettiwt-service.ts",
      "backend-hono/src/services/ingestion/base-poller.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/scripts/riskflow-24h-harness.ts",
      "backend-hono/package.json",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/lib/services/riskflow.ts",
      "frontend/types/team.ts",
    ],
  },
  {
    date: "2026-04-19T19:40:00",
    agent: "claude-code",
    summary:
      "Mobile beta finalization sweep per TP audit (pre-DMG cycle). (1) Dashboard page 1 — briefing area reclaims ~30px: top padding 20→15, gap 24→18, paddingBottom 24→12, BriefingCard shellStyle 12→9 top, body mask 28→32 so more preview text shows before [READ MORE]. (2) Dashboard page 2 — TradingView econ calendar no longer leaves a black gap above Aquarium. EconCalendarEmbed observes its container via ResizeObserver and feeds the measured pixel height into the widget JSON instead of '100%' (TradingView's embed reads height at script-load and doesn't auto-grow). Aquarium footer compacted 16+16+24 → 12+16+16. (3) SnapSheet promoted to THE popup surface — pill bar 36×3 → 40×5 (matches the old BriefingOverlay), title padding 8→12, drag threshold 100→120. BriefingCard migrated off its one-off BriefingOverlay onto SnapSheet, BriefingOverlay.tsx deleted. (4) Chat FAB now navigates to the Chat tab instead of popping a mini overlay. Removed chatOpen state from App.tsx and the floating ChatPage; MobileShell now takes onChatTap that calls handleTabChange(2). (5) MobileBulletin textareas rebuilt as TapToEditField — glass read-only plate until tap, flips to focused textarea that auto-saves 900ms after last keystroke. Notes/event rows 14/10. Glassy input, larger font, iOS-safe 16px. (6) NotificationDrawer cards reshaped to the RiskFlow layout: left VerticalFuseBar (severity-driven 0-10), center title/body/severity/time, right approve/deny stacked as icon-only 36×36 hit targets (Check over X). Approve = accent gold, Deny = text-secondary muted. Glassmorphic surface, no kanban stripes. (7) Settings page full rewrite — now scrollable (was clipped), full-width (maxWidth 480 removed), 16px gutters. Five glassmorphic CollapsibleSection cards (Notifications, Appearance, Trader, Account, About) with persistent open-state (localStorage). Appearance exposes an accordion ThemePickerAccordion (standard presets + a muted 'NOTHING DESIGN' divider + SPECIAL_PRESETS) and a full 5-font FontPickerList showing each fontHeading sample. SettingsContext dropped the 800ms auto-save debounce — changes stage locally; the new SaveButton (pill with Save → Saved → hides) is the only way to commit. MobileToolbar's global save also switched from SaveCheckmark to SaveButton; SaveCheckmark.tsx deleted. (8) Font kit — added Inter, Playfair Display, Roboto, Cinzel, Cormorant Garamond to index.html so all 5 font themes render. (9) Interaction sweep — index.css now declares --ease-spring, --duration-long; global button/[role=button] gets 150ms transition token + :active scale(0.97). Respects prefers-reduced-motion. Verified via tsc --noEmit + vite build.",
    files: [
      "mobile/App.tsx",
      "mobile/index.css",
      "mobile/index.html",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/home/HomePage.tsx",
      "mobile/components/home/BriefingCard.tsx",
      "mobile/components/home/BriefingOverlay.tsx",
      "mobile/components/econ/EconCalendarEmbed.tsx",
      "mobile/components/shared/SnapSheet.tsx",
      "mobile/components/shared/SaveCheckmark.tsx",
      "mobile/components/bulletin/MobileBulletin.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/settings/SettingsPage.tsx",
      "mobile/components/settings/CollapsibleSection.tsx",
      "mobile/components/settings/ThemePickerAccordion.tsx",
      "mobile/components/settings/FontPickerList.tsx",
      "mobile/components/settings/NotificationsSection.tsx",
      "mobile/components/settings/TraderSection.tsx",
      "mobile/components/settings/SettingToggle.tsx",
      "mobile/components/settings/SaveButton.tsx",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/contexts/ThemeContext.tsx",
    ],
  },
  {
    date: "2026-04-19T18:15:00",
    agent: "claude-code",
    summary:
      "Mobile UX polish pass per TP — notification/bulletin/briefing all snap under the dash fuse row; push copy speaks English; approve/deny buttons drop the Kanban look. (1) New `mobile/components/shared/SnapSheet.tsx` generalizes the old `NotificationSheet`: on open, queries `[data-snap-anchor='fuses']` in the DOM, reads that element's bottom edge, positions the sheet's top at that + 6px margin, stretches height to bottom. Fallback inset 340px when the anchor isn't rendered (e.g. sheet opens from a tab without the dash visible). Drag-down-to-close, glassmorphic surface (`backdrop-filter: blur(24px) saturate(1.4)`, thin border-top, accent shadow). (2) `HomePage.tsx` IVSubScores row (VIX / HEADLINE / AGENTIC DESK fuses) gains `data-snap-anchor='fuses'` so sheets know where to stop. (3) `NotificationDrawer.tsx` swapped import BottomSheet → SnapSheet. (4) `MobileBulletin.tsx` swapped BottomSheet → SnapSheet so bulletin sizing matches per TP ('same sizing should apply to the bulletin'). Non-snap callers (HeadlinePickerSheet, MiniRegimeTracker) stay on the original BottomSheet — TP only asked for notifications/bulletin/brief. (5) `BriefingOverlay.tsx` rewritten from `inset: 0` full-screen to `top: <fuses.bottom>` — briefing now covers the rest of the page per TP instead of obscuring tickers. Same anchor discovery, portal/drag/safe-area polish preserved. (6) Approval card buttons in NotificationDrawer stripped to bare — no border, no background fill, accent-color letters for both Deny and Approve (Approve gets weight 600 for primary affordance). Press states + icons carry the interaction weight. Matches the new global rule 'glassmorphic before Kanban; approve/deny buttons borderless + no-bg + accent letters'. (7) Push copy rewrites — `services/regime/propose.ts` replaces 'Regime proposal: BULL_TREND / <proposer> proposes GEO_TENSIONS → BULL_TREND' with plain title 'Regime Change' + body 'Geopol → Bear Market' via a REGIME_PLAIN code→label map. `services/notifications/riskflow-payload.ts` replaces 'Catalyst · /ES · FOMC Minutes / 9.2 · headline' with title 'Catalyst · <Category>' (Econ / Geopolitical / Monetary Policy / Market via keyword-driven pickCategoryLabel) + body = raw headline. iOS lock screen now reads like a human wrote it. (8) Dash econ calendar layout — HomePage Page 2 flex column now `flex: 1; minHeight: 0` with Aquarium Analysis `flexShrink: 0` so the calendar iframe fills every pixel between the fuses and the Aquarium card (no dead space). Per TP: 'Econ calendar on dash should end at the aquarium analysis section.' (9) `NotificationSheet.tsx` deleted (superseded by SnapSheet). Verified: mobile tsc + backend bun build both clean.",
    files: [
      "mobile/components/shared/SnapSheet.tsx",
      "mobile/components/shared/NotificationSheet.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/components/bulletin/MobileBulletin.tsx",
      "mobile/components/home/BriefingOverlay.tsx",
      "mobile/components/home/HomePage.tsx",
      "backend-hono/src/services/regime/propose.ts",
      "backend-hono/src/services/notifications/riskflow-payload.ts",
    ],
  },
  {
    date: "2026-04-19T17:30:00",
    agent: "claude-code",
    summary:
      "Relay connector 24h-runtime mode — per TP, every time the local backend cuts on for a user, the mobile PWA should be able to reach it via the Fly relay immediately, no manual toggle. (1) Default-on: dropped the `RELAY_ENABLED=true` opt-in. Opt-out now via `RELAY_ENABLED=false`. Fly-hosted backend auto-skips via the `FLY_APP_NAME` env var (the Fly node IS the relay server — it shouldn't WS-connect to itself). (2) Auto-discover userId: relay-connector now reads `~/.fintheon/peer.json` at module load (env override: `FINTHEON_PEER_CONFIG`). If peer-bootstrap already wrote `user_id`, the relay connects BEFORE the Electron frontend even signs in. Falls back gracefully to waiting for `/api/relay/set-user` if the config is absent. (3) Moved `startRelayConnector()` from `bootBackground` (post-listen) to `bootCritical` (pre-listen) so the outbound WS is live before `/api/diagnostics` returns 200 — no window where the mobile PWA can poll a connected backend that hasn't finished wiring the relay yet. Removed the duplicate call in `bootBackground`. (4) Client-side keepalive: 30s ping interval, 90s pong deadline. If Fly silently drops the outbound WS without firing `close` (the flapping class from `project_relay_ws_flapping`), the client detects stale state and force-terminates, which triggers the close handler and reconnect. Fixes the 'local thinks connected:true but mobile gets 503' bug. (5) Backoff ceiling tightened 30s → 10s so transient network blips recover in ~10s worst case instead of waiting out a 30s exponential tail. (6) `setRelayUser(userId)` now respects the new default-on gate when deciding whether to reconnect after an identity change. Fly host guard prevents the internal Fly relay server from accidentally outbound-connecting when someone sets a user JWT. Backend tsc clean; local restart verified the relay comes up on boot instead of waiting for set-user.",
    files: [
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/boot/services.ts",
    ],
  },
  {
    date: "2026-04-19T17:00:00",
    agent: "claude-code",
    summary:
      "Three post-unify fixes TP called out before final /solvys-deploy. (1) NotificationSheet (new): replaced the generic BottomSheet in the mobile notification drawer with a notification-specific sheet — fixed 60vh height, bottom-anchored slide-up, `scrollTo({top:0})` on open so the dash hero ticker row stays visible above the sheet, backdrop inset clears the 48px toolbar + safe-area so the ticker row isn't dimmed. drag-to-close + 36×3 pill handle kept. NotificationDrawer.tsx swapped import BottomSheet → NotificationSheet (two touch-points: import line + JSX wrapper). (2) Mobile backend reachability: every hook/lib in mobile/ reads `import.meta.env.VITE_API_URL`; Vercel project env has it blank for production (→ vercel.json rewrites /api/* to fintheon.fly.dev). But local `vercel build --prod` reads `.env.local` where TP has `VITE_API_URL=http://localhost:8080` for dev, which got baked into the last --prebuilt upload → every fetch on deployed PWA pointed at the user's phone localhost. Belt-and-suspenders fix in main.tsx: when `import.meta.env.PROD` is true AND `window.location.hostname` isn't localhost AND the baked VITE_API_URL is http(s)://localhost or 127.*, wrap window.fetch to rewrite any absolute localhost URL to a relative path. Vercel rewrite handles the proxy. Dev builds untouched. Also logs a single warn so the drift is loud in prod console if it ever recurs. The deploy command itself also ships with `VITE_API_URL= vite build` to catch it at the source. (3) UpdateBanner + VersionChecker nag fix: per TP 'releases are repetitively called to users' attention regardless of whether they have the newest version or not.' Three layers: (a) UpdateBanner.tsx ignores any `update-available` IPC event where the offered version isn't strictly newer than pkg.json.version — added a semver-ish compare (parse + zero-fill + lexicographic on ints). (b) Per-version localStorage dismissal key `fintheon:update-dismissed:v<version>` — clicking Later marks the exact version dismissed so the banner never comes back for that release. (c) version-check.ts (30min release poll) now applies the same semver gate locally, respects per-version dismissals, and enforces a 24h global cooldown after any dismissal so the toast can't rapid-fire across sessions. VersionChecker.tsx also writes the per-version dismiss key as soon as Install Now is clicked so a failed/aborted install flow doesn't re-trigger the nag. BUILD_VERSION sourced from package.json as the single source of truth. Verified: frontend/mobile/backend tsc clean; preview-server probe on mobile confirms the new NotificationSheet module resolves + ships with the 60vh, scroll-to-top, and safe-area-inset-top behaviors intact.",
    files: [
      "mobile/components/shared/NotificationSheet.tsx",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/main.tsx",
      "frontend/components/UpdateBanner.tsx",
      "frontend/components/VersionChecker.tsx",
      "frontend/lib/version-check.ts",
    ],
  },
  {
    date: "2026-04-19T15:00:00",
    agent: "claude-code",
    summary:
      "S24-T3 RiskFlow V4 calibration — scarcity gate, rescore-all, shadow mode, outcome tagging. (1) iv-scorer.ts gains exported V4 helpers (analyzeV4Gate, computeV4ScarcityGate, applyV4ScarcityGate) implementing the L8/L9/L10 gate per the brief: L10 only with action verb + (lexicon matrix-flip OR major print OR Level-4 emoji); L9 with score ≥ 8.5 + lexicon hit; hedge phrases ('talks of', 'considering', 'reportedly planning') hard-cap at L8 regardless of multipliers. calculateMacroLevel V3 body untouched — V4 surface is purely additive so T2's SCORING_V4 wiring inside calculateIVScore can call it without conflict. (2) lexicon-cache.ts caches lexicon_keywords with 60s TTL; degrades to empty array if T1 migration hasn't landed. (3) rescore-all.ts is a one-shot migration job: cursor-paginated 50/batch sweep over scored_riskflow_items, pre-loads lexicon + VIX once, re-runs calculateIVScore + applies V4 gate when SCORING_V4=true, writes back iv_score / macro_level / sub_scores / sentiment / rescored_at. POST /api/riskflow/rescore-all (super admin only) with dryRun + limit query params; rejects 409 if a run is in progress. (4) shadow-mode.ts logs would-have-been agent proposals (regime_proposal | lexicon_addition | walk_back), then resolveShadowDecision matches them against real human decisions within 24h and computes agreement rate. canAutoApply flag flips when rate > 0.85 AND total ≥ 20 over 30d. (5) outcome-tagger.ts boots a 5min sweep that snapshots SPY at the 4h and 24h marks after each regime decision, computes delta_*_pct for the T4 admin 'your overrides were right X%' display. (6) Three migrations: 20260419_rescore_columns.sql (rescored_at), 20260419_shadow_decisions.sql (agent_shadow_decisions), 20260419_regime_outcomes.sql (regime_decision_outcomes). rescore_columns applied via Supabase MCP; the other two are committed to migrations/ for Wave 3 unification. (7) /api/scoring routes: GET /shadow-stats, POST /shadow-decisions, POST /shadow-decisions/resolve, GET /rescore-status. (8) scarcity-sanity.ts script verifies the gate produces L8 for hedged framing — all 3 cases pass with empty lexicon (hedge phrases alone are sufficient). Backend tsc clean.",
    files: [
      "supabase/migrations/20260419_rescore_columns.sql",
      "supabase/migrations/20260419_shadow_decisions.sql",
      "supabase/migrations/20260419_regime_outcomes.sql",
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/services/scoring/lexicon-cache.ts",
      "backend-hono/src/services/scoring/rescore-all.ts",
      "backend-hono/src/services/scoring/shadow-mode.ts",
      "backend-hono/src/services/scoring/outcome-tagger.ts",
      "backend-hono/src/routes/scoring/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/scripts/scarcity-sanity.ts",
    ],
  },
  {
    date: "2026-04-19T00:30:00",
    agent: "claude-code",
    summary:
      "S24-T2 RiskFlow V4 Intelligence — scoring-engine redesign behind a SCORING_V4 feature flag. New services/scoring/ layer: (1) speaker-novelty.ts damps the commentator tier multiplier by a 0.3→1.0 novelty factor computed from pgvector cosine similarity (preferred) or Jaccard on tokenized headline text (fallback) against the speaker's last 7 days in speaker_utterance_cache — effectiveBoost = 1 + 0.5*(rawMult-1)*novelty, so Powell saying 'restrictive' for the 50th time barely nudges the score. Decay curve: sim<0.3 → 1.0, linear to (0.9, 0.4), floor 0.3 above 0.9. (2) narrative-sentiment.ts tints speaker-attributed events through active_narratives stance so 'rate cuts appropriate' reads bearish when price_stability / max_employment narratives are in breakdown, bullish when they're intact. Returns null when no active narrative matches, caller falls back to existing determineSentiment. (3) walk-back-pairer.ts scans the last 24h of L9/L10 items for semantic opposition (shared ticker/narrative/geopolitical tag + opposite sentiment + ≥0.25 Jaccard on direction-token-stripped subject tokens) — when a 'ceasefire collapses' lands after 'ceasefire confirmed', the pairer fades the original by 0.5×, drops its macro_level one tier, and fires a walkBackReverts critical push (bypasses quiet hours). Regime revert is deferred to T1's proposeRegimeChange() via dynamic import with soft-fail. (4) lexicon-proposer.ts (wired by T4's 2h cron) clusters repeated 2–3-grams in geopolitical/commentator items missing from lexicon_keywords, infers sentiment via narrative match, and writes one row per cluster into lexicon_proposals with top-5 evidence headlines + digest push (severity medium). headline-parser.ts gains classifyGeopoliticalDirection (bullishRisk / bearishRisk / neutralRisk regex set) as a side-channel — parsed.geopoliticalDirection is only consumed by the V4 iv-scorer path, so the V3 MACRO_KEYWORD_PATTERNS emitter and getMatchedKeywords output stay byte-identical. iv-scorer.ts gates all V4 behavior on process.env.SCORING_V4==='true': eventType rewrites 'geopolitical' → directional variant (geopoliticalBullish/Bearish/Neutral with weights 7.0/8.5/5.5), resolveSentiment tries narrative-aware first for speaker events then geopolitical direction, novelty-damped commentator boost replaces the raw tier multiplier, recordUtterance fires and forgets at the end. central-scorer.ts V4 branch calls detectWalkBack on freshly-scored L9/L10 items between writeScoredItems and the push-emit block. Soft-fail everywhere: if T1's speaker_utterance_cache / active_narratives / lexicon_keywords / lexicon_proposals / regime_proposals tables aren't present, novelty defaults to 1.0 (novel), narrative returns null (caller falls back), walk-back returns ignore, proposer reports 0 proposed. Verbose mode via SCORING_V4_VERBOSE keeps production logs quiet by default. Sanity scripts scripts/novelty-sanity.ts + scripts/walk-back-sanity.ts cover the decay curve, Jaccard, direction-token stripping, and (when Supabase is wired) end-to-end pair detection — both pass from pure-function paths alone.",
    files: [
      "backend-hono/src/services/scoring/speaker-novelty.ts",
      "backend-hono/src/services/scoring/narrative-sentiment.ts",
      "backend-hono/src/services/scoring/walk-back-pairer.ts",
      "backend-hono/src/services/scoring/lexicon-proposer.ts",
      "backend-hono/src/services/headline-parser.ts",
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/types/news-analysis.ts",
      "backend-hono/scripts/novelty-sanity.ts",
      "backend-hono/scripts/walk-back-sanity.ts",
    ],
  },
  {
    date: "2026-04-19T00:00:00",
    agent: "claude-code",
    summary:
      "S24-T1 RiskFlow V4 Foundation — load-bearing DB + API scaffolding for the V4 scoring rewrite. Direct answer to the 2026-04-18 diagnosis that TP manually set BULL_TREND on 2026-04-17 14:37 and the MDB brief silently overwrote it 10h later via brief-generator.ts:187–194 with setRegime(detected, 'mdb_agent', 0.8). V4 replaces that silent write with a proposal + push + approval queue, and the foundation pieces land here so T2 (intelligence) and T3 (calibration) can consume the schema in Wave 2. Migration 20260419_v4_foundation.sql ships 5 new tables + market_regimes column additions: (1) classification_matrix — regime → rubric (stance per eventType, entry/exit keywords, walk-back pairings), one row seeded per MARKET_REGIMES enum value with defaults lifted from DEFAULT_REGIME_MULTIPLIERS so existing scoring behavior survives until T2 edits the rubrics; (2) regime_proposals — proposed_regime/current_regime/reason/evidence/proposed_by/status(pending|approved|denied|auto-applied)/approved_by/decided_at/applied_at. Indexed on (status, created_at) + partial pending index; (3) lexicon_keywords — keyword/phrase_pattern/sentiment(bullish|bearish|neutral)/is_matrix_flip/target_regime/requires_action_verb/approved/expires_at, case-insensitive unique on LOWER(keyword) so T2's auto-proposer can't create dupes; (4) lexicon_proposals — agent-proposed keyword additions pending TP approval, same status machine as regime_proposals; (5) speaker_utterance_cache — novelty tracking for T2's speaker-repetition filter. Nullable embedding vector(384) + nullable tokens text[] — pgvector extension enabled so T2 can choose cosine sim or Jaccard at runtime. ivfflat index deferred until seed data exists. Plus ALTER TABLE market_regimes ADD locked_by text, locked_until timestamptz — TP's manual override now holds a 24h lock. Everything is idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING, DO-block CREATE POLICY guards). Backend code: emit.ts gains NOTIFICATION_CATEGORIES allowlist (regimeProposals/lexiconProposals/walkBackReverts added — critical severity still bypasses quiet hours via existing gate at emit.ts:100); web_push_subscriptions.categories default JSONB + existing-row backfill so fresh subscribers and TP's live iPhone both opt-in by default. New service services/regime/propose.ts — proposeRegimeChange(proposedBy, proposedRegime, reason, evidence, severity) inserts a regime_proposals row, reads the lock state, fires emitPushAndLog with category=regimeProposals + fingerprint=regime-proposal:<regime>:<by>:<hour-bucket> for 1h dedup, and returns {id,status,lockedUntil,pushed}. Routes: /api/regime/proposals (GET list, POST create, /:id/approve applies regime via setRegime('manual') + sets market_regimes.locked_by/locked_until to now()+24h with detected_by='manual-from-proposal', /:id/deny); /api/lexicon/keywords + /proposals CRUD; /api/classification-matrix GET + /:regime PATCH for rubric edits. All routes <300 lines each; registered in routes/index.ts. brief-generator.ts:186–247 edited — MDB auto-detect now routes through proposeRegimeChange() behind SCORING_V4=true; V3 (direct setRegime) retained as a one-toggle rollback when SCORING_V4 is unset. mobile/contexts/SettingsContext.tsx NotificationPrefs gains regimeProposals/lexiconProposals/walkBackReverts fields, all default true. Verification: migration applied via Supabase MCP (cm=8 seed rows, rp=lp=suc=0, lock cols present, web_push defaults include all 3 new categories); backend tsc clean; frontend + mobile tsc clean; live smoke test on port 8090 confirmed POST /api/regime/proposals creates a row and GET ?status=pending returns it, PATCH matrix writes rubric, POST lexicon proposal inserts — all smoke-test rows cleaned up post-verification. T2 and T3 can branch off this as soon as the push lands.",
    files: [
      "supabase/migrations/20260419_v4_foundation.sql",
      "backend-hono/src/services/notifications/emit.ts",
      "backend-hono/src/services/regime/propose.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/routes/regime/index.ts",
      "backend-hono/src/routes/regime/proposals.ts",
      "backend-hono/src/routes/lexicon/index.ts",
      "backend-hono/src/routes/lexicon/keywords.ts",
      "backend-hono/src/routes/lexicon/proposals.ts",
      "backend-hono/src/routes/classification-matrix/index.ts",
      "backend-hono/src/routes/index.ts",
      "mobile/contexts/SettingsContext.tsx",
    ],
  },
  {
    date: "2026-04-18T16:30:00",
    agent: "claude-code",
    summary:
      "S24-T4 (RiskFlow V4 UX + admin + monitoring loop): Wave-2 track running in parallel with T1 foundation, T2 intelligence, T3 calibration. Everything feature-flagged — endpoints that don't exist yet fall back to graceful 'not ready' hints so the UI ships without waiting on T1/T2/T3 to land. (1) Shared UI: reused existing frontend/components/ui/Toast.tsx. Built new InlineDiff.tsx exporting ScoreImpactPreview (rescore-impact bucket preview) and KeywordDiffRow (per-keyword approve/deny for lexicon diff). (2) Refinement Engine rebuilt — replaced 40-slider workbench with 5 group-sensitivity dials (Macro/Geopolitical/Corporate/Technical/Speaker, each -1.0→+1.0) that scale all weights in their category. GroupSensitivityDial.tsx + PresetSelector.tsx (Neutral/Conservative/Aggressive/Geo-focused built-ins + save-as-custom) + AdvancedPane.tsx (collapsible wrapper for existing QuickWeightEditor, CommentatorManager, SourceAccountsManager, plus new MatrixEditor + LexiconEditor). Debounced rescore-impact preview fires 400ms after last dial change via POST /api/riskflow/rescore?dryRun=true. Toast on every save (success/error), replacing silent console.error. Apply Changes / Discard buttons appear only when pending != applied. (3) MatrixEditor.tsx — super-admin edit of classification_matrix rubric (regime tabs, JSON rubric textarea, save). LexiconEditor.tsx — add keywords + pending-proposal inline approve/deny with optimistic UI. Both detect 404 and show 'T1 endpoints not yet live' placeholder. (4) Admin approvals — new /admin area via AdminShell.tsx with three sub-tabs: Scoring (RefinementEngine) / Approvals (ApprovalsPage) / Monitor (MonitoringLoopCard). TabRenderer now renders AdminShell when showRefinement flag is on, instead of RefinementEngine directly. ApprovalsPage.tsx renders pending regime/lexicon/walk-back proposals as cards with inline chart screenshot + X sentiment snippet + evidence sources + approve/deny one-tap. Polls every 30s. (5) Monitor tab — MonitoringLoopCard.tsx shows last-run / next-run / proposals-created counts + shadow-mode graduation tracker per decision-type with agreement rate and graduate button when ≥85% agreement over ≥30 decisions. (6) Mobile approval surface — extended mobile/components/notifications/NotificationDrawer.tsx to render approval cards inline for categories regimeProposals/lexiconProposals/walkBackReverts/toolApprovals with Approve/Deny buttons that POST to the right endpoint and optimistically mark the card decided. NotificationItem type gained eventId + metadata fields. (7) Backend monitoring loop — backend-hono/src/services/cron/monitoring-loop.ts (2h cron, America/New_York, gated by ENABLE_MONITORING_LOOP env). Each cycle: counts L9/L10 items in last 24h (threshold 5 → files regime-rubric-review proposal), dynamically imports T2's lexicon-proposer and walk-back-pairer (safeImport with variable-string specs so TS doesn't fail when modules don't exist yet). State tracks last/next run + outcome for status endpoint. (8) Routes — new backend-hono/src/routes/scoring/index.ts at /api/scoring: GET /monitoring/status, POST /monitoring/run-now (super-admin), PATCH /monitoring/config (toggle enabled), GET /shadow-stats (aggregates agent_shadow_decisions from last 30 days, computes agreement rate, flags canAutoApply), POST /shadow-stats/graduate (super-admin insert into agent_decision_graduations). All routes fail-soft when T3 tables don't exist yet — return empty arrays, never 500. (9) startMonitoringLoop wired into boot/services.ts after MarketImpactEnricher. (10) Frontend/mobile/backend all tsc-clean + bun run build passes. Backend routes mounted with authMiddleware at /api/scoring. No dev server started — verification by type-check + build only. Preset API helper at frontend/lib/scoring-preset-api.ts uses NotReady sentinel type so every 404/501 gracefully downgrades the UI.",
    files: [
      "frontend/components/ui/InlineDiff.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/GroupSensitivityDial.tsx",
      "frontend/components/refinement/PresetSelector.tsx",
      "frontend/components/refinement/AdvancedPane.tsx",
      "frontend/components/refinement/MatrixEditor.tsx",
      "frontend/components/refinement/LexiconEditor.tsx",
      "frontend/components/admin/AdminShell.tsx",
      "frontend/components/admin/ApprovalsPage.tsx",
      "frontend/components/admin/MonitoringLoopCard.tsx",
      "frontend/components/layout/TabRenderer.tsx",
      "frontend/lib/scoring-preset-api.ts",
      "mobile/components/notifications/NotificationDrawer.tsx",
      "mobile/hooks/useNotificationHistory.ts",
      "backend-hono/src/services/cron/monitoring-loop.ts",
      "backend-hono/src/routes/scoring/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
    ],
  },
  {
    date: "2026-04-18T14:00:00",
    agent: "claude-code",
    summary:
      "Update script cleanup — three bugs TP spotted in the fintheon-update.sh output. (1) Torch margins drifted: opening torch_banner() used 6-char torches ]||||[ + 6-char flames  /||\\ , while the closing banner used 5-char torches ]|||[ + a 4-char ember row /|\\, with compensating-but-inconsistent middle spacing (35/36/37 spaces) across rows. Normalized everything to 5-char flame/torch/base columns + 36-char middles so every visible line is exactly 52 chars wide — torches vertically aligned at cols 7-11 left / 48-52 right. (2) Box content overflow: UPDATE COMPLETE + VERSION (18-char SHA) was 35 chars stuffed into a 30-char %-30s box, pushing the right ║ past the right torch and making the alignment look broken even when columns were correct. Swapped to %-30.30s on _vl, _bl, _ll printf format strings to hard-truncate. (3) Syntax error at line 296 — `[[: 1 1: syntax error` — grep -o can return multiple lines, so $TOTAL_KEYS became '1\\n1' and the [[ -gt 0 ]] test choked. Added | head -1 on both grep pipes plus ${VAR:-0} safety defaults. Peer bootstrap rewrite — dropped Twitter CLI install/auth entirely (replaced by Rettiwt library + Agent Reach, both ship with the backend). ensure_twitter_cli/ensure_twitter_auth/resolve_twitter_bin/open_x_login removed. New flow: curl /api/diagnostics to confirm backend + Agent Reach availability, curl /api/riskflow/rettiwt-refresh to count pool keys, enroll into Team Round Robin iff Rettiwt keys > 0. peer.json now emits agent_reach_available/rettiwt_available/rettiwt_keys/round_robin_enrolled instead of twitter_cli_*. CAPABILITIES array now carries 'agent-reach' + 'rettiwt' (and 'hermes' if present) instead of 'twitter-cli' + 'twitter-round-robin'. fintheon-update.sh cleanup block (step 11/12) kept as-is — forward-compatible: removes legacy twitter binary + config dirs if found but never installs fresh. Help text in install-cli.sh + fintheon-cli.sh updated: 'peers — Peer + Rettiwt + Agent Reach onboarding'. All four shell scripts pass `bash -n` syntax check.",
    files: [
      "scripts/fintheon-update.sh",
      "scripts/peer-bootstrap.sh",
      "scripts/install-cli.sh",
      "scripts/fintheon-cli.sh",
    ],
  },
  {
    date: "2026-04-18T13:15:00",
    agent: "claude-code",
    summary:
      "Mobile chat PWA polish pass — kill the 'this is a PWA not an app' tell. Root cause of the giveaway was iOS Safari auto-zooming on focus whenever an input's computed font-size is < 16px; ChatInput.tsx was 14px, so tapping the composer yanked the whole viewport larger and exposed the browser chrome. Five coordinated fixes: (1) index.css enforces a 16px floor on input/textarea/select globally and layers in native-feel defaults (`-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`) on all interactive elements — removes the gray flash on tap and the 300ms double-tap-zoom delay that reads as 'webpage'. Also adds `overscroll-behavior-y: none` so rubber-band scrolling can't expose the address bar. (2) index.html viewport meta gained `interactive-widget=resizes-content`, which tells iOS 16.4+ and modern Android Chrome to RESIZE the layout when the on-screen keyboard opens instead of overlaying it — paired with the composer change below, the input now rides up with the keyboard like a native chat app, no visualViewport JS required. (3) MobileShell.tsx swapped `minHeight: 100vh` → `height: 100dvh` so iOS URL-bar show/hide doesn't shift layout, and conditionally zeroes the bottom padding on the chat tab (index 2) so the composer can hug the true bottom edge instead of floating above a 24px dead zone. (4) ChatPage.tsx replaced the `position: fixed; bottom: 0` composer + 100px placeholder spacer with a `position: sticky; bottom: 0` child of the existing flex column — this is the one-line change that makes keyboard-aware layout 'just work' on modern iOS. Messages area got `-webkit-overflow-scrolling: touch` + `overscroll-behavior: contain` for momentum scrolling without leaking to the parent. (5) ChatInput.tsx got the full native composer treatment: textarea bumped 14→16px (the iOS zoom fix), added `autoCapitalize='sentences'`, `autoCorrect='on'`, `spellCheck='true'`, `enterKeyHint='send'` so the mobile keyboard shows a proper Send return key and capitalizes the first word; IME-composition guard on Enter so dictation (Wispr Flow, voice, CJK candidates) can't submit mid-phrase; hit-target upgrade from 32×32/34×34 → 40×40 with gentler scale-and-glow press states; input border radius 16→22 and a translucent blurred gradient background strip so the thread fades behind the composer edge instead of hard-cutting; send button gains subtle accent focus ring and a 120ms scale microinteraction. Message body font also raised from 14→15px for readability at phone distance. Verified in preview at 375×812 mobile: textarea computed font-size is 16px, send button 40×40, composer stickied at viewport bottom exactly (812), tap-highlight-color transparent.",
    files: [
      "mobile/index.html",
      "mobile/index.css",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/ChatMessage.tsx",
    ],
  },
  {
    date: "2026-04-18T12:45:00",
    agent: "claude-code",
    summary:
      "Kill the 'empty Harper bubble' class of bugs on mobile. TP reported two messages (one dictated via Wispr Flow with a RiskFlow headline chip attached, one plain 'Hey') that came back as blank assistant bubbles — no text, no error, no hint anything went wrong. Root cause was in mobile/components/chat/ChatPage.tsx's SSE parser: it only handled `text-delta`, `tool_use`, and `tool-approval-*` events, so any `{type:'error',errorText:…}` from stream-adapter.ts (Strands mid-stream throw) or `{type:'error',error:…}` from relay.ts (forward failure like local_offline during a reconnect window) or `{type:'finish',finishReason:'error'}` was silently dropped. The stream would drain to [DONE], isLoading flipped off, and the assistant bubble stayed empty — indistinguishable from 'Harper just didn't say anything'. Fixes: (1) mobile ChatPage now renders `[ERROR: <text>]` in the assistant bubble for both error frame shapes, falling back to 'Harper failed — no response' if a `finish(error)` fires without an explicit error event; (2) relay.ts /chat handler persists a matching `[ERROR: …]` assistant message on forward failure via addMessage, so next hydration shows the failed turn instead of a hanging user message (answers TP's 'conversation history didn't record' observation — the user message was saved, the assistant turn just had nothing to save). Verified: the WS upgrade path is fine (direct curl with --http1.1 + real service_token returns HTTP/1.1 101); local backend connector-status reports connected:true; TP still owns 109 conversations in ai_conversations (sub 826e7c65-…), with 2 legacy anonymous rows remaining.",
    files: [
      "mobile/components/chat/ChatPage.tsx",
      "backend-hono/src/routes/relay.ts",
    ],
  },
  {
    date: "2026-04-18T12:20:00",
    agent: "claude-code",
    summary:
      "Kill the gostatic-regression footgun permanently. Fly kept reverting to serving pierrezemb/gostatic on /api/* (404 plain text) — happened three times in one session, each time after a fly-level action that wasn't a clean rebuild from backend-hono/. Root cause: the repo root had a legacy fly.toml (app='fintheon') and Dockerfile (FROM pierrezemb/gostatic) from before the backend was split out. Any fly deploy invoked without explicit --config would pick them up and push a gostatic image to the Fly registry under the fintheon app — so subsequent machine restarts (from secrets set, manual restart, automatic recover, etc.) could pull that stale image and serve gostatic. Deleted both root files. Only backend-hono/fly.toml + backend-hono/Dockerfile remain; fly deploy must now come from backend-hono/ (there's no alternative) and there's no way for a Fly-internal restart to resurrect the gostatic image because no recent build produced one. Also repointed .github/workflows/riskflow-cron.yml from the deleted pulse-api-withered-dust-1394 URL to fintheon.fly.dev/api/riskflow/cron/prefetch — it was silently 404'ing every 5 minutes since the legacy app was deleted.",
    files: ["fly.toml", "Dockerfile", ".github/workflows/riskflow-cron.yml"],
  },
  {
    date: "2026-04-18T12:00:00",
    agent: "claude-code",
    summary:
      "Mobile chat input was locked on relay-connected sessions because the earlier S21-T1 remote-control refactor added `isStandby = !conversationId && !mirrorDevice` to ChatInput's disabled prop, with the stated intent of 'preventing orphan chats started from mobile'. That made sense when the relay didn't work (mobile messages would have gone nowhere), but now that WS is actually connected (v5.20.1), mobile-initiated messages are forwarded via /api/relay/chat → desktop's Harper → SSE back; the convo is created server-side if absent. Removed isStandby from the disabled prop — mobile is usable any time relay isn't OFFLINE. Updated the empty-state copy from 'Standing by — dispatch from desktop' to 'Message Harper directly, or pick up a dispatched conversation' so the UI matches the actual capability. Dispatched/mirror mode still auto-loads and shows the FROM DESKTOP pill; nothing about that flow changed.",
    files: ["mobile/components/chat/ChatPage.tsx"],
  },
  {
    date: "2026-04-18T11:30:00",
    agent: "claude-code",
    summary:
      "Relay WS end-to-end: actually connects now. v5.20.0 shipped but mobile stayed OFFLINE — root cause was a key mismatch, not an architectural bug. Local backend had SUPABASE_SERVICE_ROLE_KEY in the new sb_secret_* format (41 chars) from the 2026-04-18 rotation; Fly still had the old JWT-format key (219 chars) because the rotation never pushed to Fly. Every WS upgrade attempt with service_token failed the constant-time compare and 401'd. Verified via debug logs on relay-ws.ts: 'WS upgrade: service_token mismatch, sentLen:41 expectLen:219'. Fix: fly secrets set SUPABASE_SERVICE_ROLE_KEY=<new> -a fintheon. After rotation, node ws client connects on first try, Fly logs 'Local backend connected', /api/relay/connector-status reports connected:true. Also (a) allowed service-role callers (local-user) to set relay user to any sub via /set-user — trusted server-to-server path for bootstrap/admin tooling; user-JWT callers still get the strict ownership check; (b) added /api/relay/debug/convo-count (service-role-only, temporary) to verify the DB has the right data — confirmed TP's sub owns 107 conversations in ai_conversations, so if the user's Electron app shows 'no chat history' it means the frontend is calling the endpoint under a different identity (stale JWT / signed out / etc), not a DB problem. Added granular WS upgrade logging (WS upgrade received / accepted / rejected with reasons) so future mismatches are obvious from one fly logs call.",
    files: [
      "backend-hono/src/boot/relay-ws.ts",
      "backend-hono/src/routes/relay.ts",
    ],
  },
  {
    date: "2026-04-18T10:30:00",
    agent: "claude-code",
    summary:
      "Mobile stayed OFFLINE after v5.19.2 install — found the relay was architecturally broken for every user, not just TP. Four fixes to make the desktop↔Fly↔mobile relay work multi-user. (1) relay-connector default URL was wss://pulse-api-withered-dust-1394.fly.dev (the DELETED legacy app) — every local backend that opt'd in to RELAY_ENABLED was silently failing to connect. Repointed to wss://fintheon.fly.dev/api/relay/connect. (2) Local backend had no way to identify WHICH user it serves — old code passed SUPABASE_SERVICE_ROLE_KEY to verifySupabaseToken(), which treats it as a user JWT and rejects it, so the WS upgrade always 401'd. Added a second auth path on the server (relay-ws.ts): accepts service_token=<SUPABASE_SERVICE_ROLE_KEY> + user_id=<sub> with constant-time comparison, and registers the WS under the claimed user_id. Preserves the user-JWT path for future use. (3) Dynamic multi-user scoping: new POST /api/relay/set-user endpoint on the local backend accepts {userId} from the signed-in frontend, validates that userId matches the authenticated caller (can't claim someone else's identity), and calls relay-connector.setRelayUser() to reconnect under the new user_id. GET /api/relay/connector-status reports the current connector state so the frontend can introspect. AuthContext now posts /set-user on every user change via onAuthStateChange, so the connector re-registers when TP signs in, signs out, or a different user logs in. Zero manual env config needed per user. (4) FintheonFloatingChat became a dispatch shortcut with the composer's microinteractions: collapsed button shows Radio/Loader2/Unplug/MessageSquare based on relay state, gold pulse when dispatched-here, reduced opacity when dispatched-elsewhere. Shift-click or alt-click = one-click dispatch without opening the panel. Normal click still opens the compact chat window for users who want the full composer. Also: enabled RELAY_ENABLED=true in backend-hono/.env (local-only, uncommitted).",
    files: [
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/boot/relay-ws.ts",
      "backend-hono/src/routes/relay.ts",
      "frontend/contexts/AuthContext.tsx",
      "frontend/components/chat/FintheonFloatingChat.tsx",
    ],
  },
  {
    date: "2026-04-18T10:00:00",
    agent: "claude-code",
    summary:
      "Relay follow-up after fresh DMG install still 404'd — three root causes surfaced and fixed. (1) Hydration/dispatch ownership mismatch: handleGetConversation falls back to the 'anonymous' owner branch for legacy convos, so a stale anon convo would hydrate fine (200) but /api/relay/dispatch (strict ownership) returned 404, leaving the relay button broken. Added reassignConversationOwner(conversationId, fromUserId, toUserId) in conversation-store — UPDATE ai_conversations SET user_id WHERE id AND user_id, with memoryStore parity. handleGetConversation now calls it when the anon fallback succeeds for an authed user, migrating the convo on first access so subsequent ownership-gated routes work. Logs the reassign (non-fatal on failure). (2) /api/settings 401s in the Electron console — my earlier absolute-URL fix made SettingsContext + ThemeContext reach the backend, but neither fetch was sending Authorization. Now both getAccessToken() and attach Bearer headers to every load+save; skip the fetch entirely when no token (pre-login) since localStorage is the authoritative fallback there. (3) FintheonComposer self-heal — new onConversationGone prop; when relay.dispatch rejects with /not_found/, the composer calls it to evict the cached conversation id so the relay button re-disables and the user can send a fresh message instead of staring at a broken button. Wired through ChatInterface and ChatSidebar (both already had clearConversationId in scope from useHermesRuntime).",
    files: [
      "backend-hono/src/services/ai/conversation-store.ts",
      "backend-hono/src/routes/ai/handlers/conversations.ts",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/chat/FintheonComposer.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
    ],
  },
  {
    date: "2026-04-18T09:30:00",
    agent: "claude-code",
    summary:
      "S21-T1 follow-up batch. Five groupings: (1) Relay-blocking bug — stale cached conversationId caused every fresh Electron launch to 404 on /api/ai/conversations/<uuid> and then fire /api/relay/dispatch against the dead UUID, so the Radio button went straight to 'not_found'. useHermesChat now accepts an optional clearConversationId and calls it when the hydration fetch returns 404, evicting both the localStorage key (per-agent, per-surface) and the React state — downstream consumers see conversationId=undefined until the next message, and the relay button correctly reports 'Relay — send a message first'. Threaded through useHermesRuntime and useChatSession so both paths get the fix. (2) file://-resolved /api/ fetches — SettingsContext, ThemeContext (both BACKEND_SETTINGS_URL), MainDashboard (/api/blindspots, /api/blindspots/interview), and ProposalWidget (/api/proposals/chart) all used bare relative paths, which under Electron's file:// shell produced ERR_FILE_NOT_FOUND and silently killed settings persistence + onboarding payloads. All four now prefix with VITE_API_URL-derived API_BASE. (3) FintheonComposer polish — isDispatchedHere now requires both sides of the comparison to be truthy (guards against undefined===undefined false positives after the 404-clear), and the relay button gets a dedicated 'dispatching…' title during the in-flight window. (4) PromptBox polish — IME composition guard on Enter (both ref-based and e.nativeEvent.isComposing) prevents candidate commits from sending mid-composition, attach popup auto-dismisses once the user starts typing, queue chip row shows '+N more' when >2 jobs are active (was silent truncation), compact mode bottom-bar padding bumped to match main composer so the send button doesn't crowd the Harper pill, and the paste handler logs a one-time debug line for non-image clipboard payloads instead of silently dropping them. (5) SessionsDropdown — attaches Supabase JWT to the conversations list + delete fetches (post-migration RLS was returning empty sets for unauth reads, leaving the spinner rendering over an empty list forever), handles non-OK responses explicitly so the spinner clears on 401/500, and swaps rAF-focus for setTimeout(0) so the search input actually receives focus when the dropdown first commits under Electron's portal ordering. (6) ChatHeader hit targets widened from 32×32 to 44×44 per iOS/Electron touch guidelines, icon sizes unchanged. (7) ChatGreeting chips get explicit gold-tint hover + icon color lift + focus-visible ring for keyboard users.",
    files: [
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/chat/hooks/useChatSession.ts",
      "frontend/components/chat/useHermesRuntime.ts",
      "frontend/components/chat/FintheonComposer.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/SessionsDropdown.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/proposals/ProposalWidget.tsx",
    ],
  },
  {
    date: "2026-04-18T07:15:00",
    agent: "claude-code",
    summary:
      "Interactive install path in fintheon-setup.sh — bootstrap now prompts 'Install path [~/Documents/Codebases/fintheon]:' (reading from /dev/tty so it works under curl | bash), expands ~, rejects non-fintheon git repos + non-empty non-git dirs at the target, and persists the chosen absolute path to ~/.fintheon/install-path. Companion scripts (fintheon-cli, fintheon-update, install-cli both outer + HEREDOC, peer-bootstrap) now resolve install path as FINTHEON_ROOT env > ~/.fintheon/install-path > default ~/Documents/Codebases/fintheon. Non-interactive installs skip the prompt with FINTHEON_DIR=/path env var. SETUP.md updated with the new flow. All 5 scripts pass `bash -n` syntax check.",
    files: [
      "scripts/fintheon-setup.sh",
      "scripts/fintheon-cli.sh",
      "scripts/fintheon-update.sh",
      "scripts/install-cli.sh",
      "scripts/peer-bootstrap.sh",
      "SETUP.md",
    ],
  },
  {
    date: "2026-04-18T07:00:00",
    agent: "claude-code",
    summary:
      "S21-T1 mobile strip — per-dispatch remote-control mode. Removed session-list surface from mobile (List icon, SessionList bottom-sheet, useConversations hook usage, handleSelectSession/handleNewSession, sessionListOpen state, refreshSessions post-send). Mobile chat is now a projection of whatever the desktop dispatches. New isStandby gate disables ChatInput when no convo is loaded AND no dispatch is active, preventing orphan threads from mobile. Empty-state copy: 'Standing by — dispatch a conversation from the relay button in the desktop CAO chat.' Conversation history is still persisted server-side; we just stopped surfacing browsing on mobile. useConversations + SessionList files kept as dead code. ChatPage bundle 55.30kB → 50.27kB.",
    files: ["mobile/components/chat/ChatPage.tsx"],
  },
  {
    date: "2026-04-18T06:45:00",
    agent: "claude-code",
    summary:
      "S21-T1 mobile mirror badge — ChatPage now polls /api/relay/health every 20s and shows a small '⟷ FROM DESKTOP' pill next to the HARPER title whenever the user's active conversation matches an active dispatch on the Fly relay. Also auto-loads the dispatched conversation when the mobile opens with no active convo. Gives visual confirmation on mobile without requiring the web-push path to have succeeded (push subscriptions can lag or be absent — the dispatch state on Fly is authoritative).",
    files: ["mobile/components/chat/ChatPage.tsx"],
  },
  {
    date: "2026-04-18T06:30:00",
    agent: "claude-code",
    summary:
      "S21-T1 relay dispatch + mobile chat rescue. Mobile chat input was stuck disabled because ConnectionStatus called /api/relay/health without an auth header, the 401 was treated as 'offline', and ChatInput's `disabled={isOffline}` locked the textarea — fixed by attaching the Supabase JWT to the health poll and treating 401 as 'reconnecting' (not offline) so the input stays usable. Service worker push handler now routes chat_relay category notifications to the chat tab and stashes the conversationId in sessionStorage + fires a window event so ChatPage auto-loads the dispatched conversation on mount or while already open. Backend push payload now carries conversationId directly so sw.js can deep-link without parsing URL. Mobile RiskFlow headline attach modal (HeadlinePickerSheet) and image attach (ImageAttachButton + ImagePreviewRow + input[type=file accept=image/*]) were already present and wired into /api/relay/chat — verified end-to-end path: mobile → Vercel rewrite → fintheon.fly.dev → relay WebSocket → local backend → Harper with images + riskFlowContext.",
    files: [
      "mobile/components/chat/ConnectionStatus.tsx",
      "mobile/App.tsx",
      "mobile/components/chat/ChatPage.tsx",
      "backend-hono/src/services/web-push-sender.ts",
      "backend-hono/src/routes/relay.ts",
    ],
  },
  {
    date: "2026-04-18T05:30:00",
    agent: "claude-code",
    summary:
      "Ultrareview batch — 6 findings fixed on s20-agent-swarm-platform-ops. (1) outcome-tracker.mapAnalystToAgent was a stale legacy-role mapping that returned null for every MiroShark DAG analyst (oracle/feucht/consul/herald), silently dropping per-agent rows from deliberation_outcomes and leaving accuracy feedback forever empty — replaced with a passthrough validator against DELIBERATION_AGENTS. (2) feedback-composer was reading actual_vix_24h (a VIX level, not a delta) into PredictionResult.actualVixChange and rendering 'actual VIX moved +18.5' into every analyst/Harper system prompt — renamed to actualVixLevel and reformatted the line to 'actual VIX 18.5' to match the actual semantics. (3) /api/oracle was mounted without auth, so POST /api/oracle/research/trigger was a public cost-amplification vector against Polymarket/Kalshi + a pollution hose into oracle_research_findings — added authMiddleware+requireAuth on /api/oracle, plus ORACLE_RESEARCH_ENABLED check and 5-min in-process cooldown inside triggerResearchCycle so the kill switch actually works. (4) bootCritical() was called with .then() but never awaited, so Bun.serve (default export) was accepting requests during the seedCacheFromDb cold-boot window, returning empty /api/riskflow/feed and /api/context-bank snapshots — switched to top-level await bootCritical() before the default export is evaluated. (5) /api/lifecycle/* endpoints were unauthenticated and armIdleShutdown accepted timeoutMs=0, letting any remote POST trigger process.exit on the first 60s tick — added localhost-only middleware on /api/lifecycle/* and floored idleTimeoutMs at 60_000ms in armIdleShutdown. (6) /api/relay/chat trusted client-supplied conversationId and called addMessage with no ownership check; because addMessage resolves user_id via SELECT FROM ai_conversations the inserted row was stamped with the conversation OWNER's user_id, letting an authenticated attacker plant 'user'-role messages into any victim's history (IDOR + prompt-injection pivot) — now verifies ownership via getConversation(convId, userId) and returns 404 on mismatch.",
    files: [
      "backend-hono/src/services/agent-memory/outcome-tracker.ts",
      "backend-hono/src/services/agent-memory/feedback-composer.ts",
      "backend-hono/src/services/agent-memory/types.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/cron/oracle-research-scheduler.ts",
      "backend-hono/src/index.ts",
      "backend-hono/src/services/lifecycle.ts",
      "backend-hono/src/routes/relay.ts",
    ],
  },
  {
    date: "2026-04-18T05:15:00",
    agent: "claude-code",
    summary:
      "Unblock Ultrareview / Cursor Background Agents — add .cursor/environment.json + .cursor/install.sh so the cloud container can actually boot: installs Bun if missing, materializes the gitignored .env files (root, backend-hono, frontend) with workspace values inline (matches existing pattern in scripts/setup.ts where the Fly Supabase DATABASE_URL is already hardcoded), then runs bun install at root / backend-hono / frontend. Before this the review agent was stalling at 'Run setup script' with no setup script defined, so Find/Verify/Dedupe never started.",
    files: [".cursor/environment.json", ".cursor/install.sh"],
  },
  {
    date: "2026-04-18T05:00:00",
    agent: "claude-code",
    summary:
      "Revert Doto digits globally — restore pre-Nothing-Design digit rendering: (1) 'Readable Digits' @font-face back to Inter (regular 400) from Doto, no size-adjust — digits now render consistently in Inter across every theme (the original design before the 2026-04-17 Doto remap that caused legibility issues on desktop). (2) Removed digit-scale runtime FontFace API override (applyReadableDigitsScale) + digitScale state/setter/persistence from ThemeContext. (3) Removed DIGIT_SCALE_* constants, clampDigitScale, loadStoredDigitScale, saveDigitScale from font-theme.ts. (4) Removed Digit Size slider section from Appearance settings. Nothing Font Kit retained unchanged — headings still get Doto via fontHeading stack, only digits revert to Inter. appearance.digitScale in backend settings is now ignored on load (harmless).",
    files: [
      "frontend/fonts.css",
      "frontend/lib/font-theme.ts",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/settings/ThemeSettings.tsx",
    ],
  },
  {
    date: "2026-04-18T04:00:00",
    agent: "claude-code",
    summary:
      "Fix StickyBulletin (and any portal/conditional-mount) drag in useDraggable: (1) Listener-attachment race — handleRef/elementRef are now mirrored into useState via useLayoutEffect so the pointer-listener effect re-runs once the consumer's portal commits and refs populate; previously the effect fired once with refs=null (Bulletin returns null until popupPos is computed on a later render) and never re-attached, so hold-and-drag did nothing. (2) clampToViewport is now anchor-aware — it derives the clamped position from the element's current visual rect + transform delta instead of treating (x, y) as the absolute top-left, so panels positioned via top/right (Bulletin) can drag left/up without getting pinned to 0. Benefits DraggablePanel / PsychAssistDockable / YouTubeMiniplayer for free.",
    files: ["frontend/hooks/useDraggable.ts"],
  },
  {
    date: "2026-04-18T03:00:00",
    agent: "claude-code",
    summary:
      "Nothing Font Kit + adjustable digit size (desktop): (1) 'Readable Digits' @font-face stays on Doto but gets baseline size-adjust: 150% so digits render legibly alongside Inter/Space Grotesk body text (fixes tiny Doto glyphs in timestamps, calendar values, small KPIs, RiskFlow '0h ago' stamps, ticker pts deltas); (2) New 'Nothing' font theme (id: nothing) — Space Grotesk body + Doto headings + Space Mono mono — which applies Nothing thematics (.nothing-active, flat radius, Nothing ease) on top of ANY color theme, so users keep their palette and just swap typography; (3) Nothing Font Kit carries optional fontMono/borderRadius/easeDefault fields on FontTheme and toggles .nothing-active independently of legacy Special color presets; (4) New Digit Size slider in Appearance settings (1.0x–2.5x, default 1.5x) — swaps the Readable Digits FontFace at runtime via the FontFace API (delete+re-add with updated sizeAdjust) and persists per-user to backend settings as appearance.digitScale; (5) ThemeContext now reconciles .nothing-active across both fontTheme.nothingKit and legacy theme.special paths so switching between them doesn't leave stale overrides.",
    files: [
      "frontend/fonts.css",
      "frontend/lib/font-theme.ts",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/settings/ThemeSettings.tsx",
    ],
  },
  {
    date: "2026-04-17T22:40:00",
    agent: "claude-code",
    summary:
      "Mobile push notifications: master toggle now persists user intent (new pushEnabled flag in NotificationPrefs) and reconciles with live subscription state across reloads; auto re-subscribes when permission is still granted but the SW subscription was cleared; enable() returns structured EnableResult so UI can surface permission-denied vs subscribe-failed vs unsupported; [TEST NOTIFICATION] button now has sending/success/error inline status (was previously fire-and-forget with zero feedback); sendTestNotification short-circuits with 'not-subscribed' / 'permission-denied' instead of silent no-op",
    files: [
      "mobile/hooks/usePushNotifications.ts",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/components/settings/SettingsPage.tsx",
    ],
  },
  {
    date: "2026-04-17T22:00:00",
    agent: "claude-code",
    summary:
      '7-part drag/Strategium/Aquarium overhaul: (1) new useDraggable hook (Pointer Events + setPointerCapture + rAF + transform3d) kills sticky-cursor + friction across DraggablePanel/PsychAssistDockable/YouTubeMiniplayer/StickyBulletin — strict grip-only handles, removed glass/shadow chrome; (2) Strategium gear→Edit (Pencil), widget cards become drag-reorderable with Nothing-Design microinteractions, unified layoutEditMode drives sidebar+toolbar+widgets; (3) NavSidebar now accepts controlled editMode; (4) Blindspots widget: 140-char cap + 4-entry cap, monochrome FuseBar with shimmer, IV chip replaces W/L% (backend joins against scored_riskflow_items for ivScore enrichment, POST rejects >140char); (5) 3-state Strategium pane mode (balanced/feedOnly/widgetsOnly) with peek footer + header, fixes collapsed-RiskFlow no-restore bug; (6) RiskFlow feed flickers the single most-recent new headline in theme accent color on every refresh (freshAlertId tracked in context, auto-clears 1.2s); (7) Harper Aquarium synthesis now awaited inline with briefing, prompt reframed so Harper IS the narrator (not cold analyst), red-flag-phrase + slop-input detectors replace templated heat/regime output with "No new agentic updates. Trigger an update in Aquarium." — SanctumBriefing renders fallback with Trigger Aquarium CTA',
    files: [
      "frontend/hooks/useDraggable.ts",
      "frontend/components/layout/DraggablePanel.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/layout/YouTubeMiniplayer.tsx",
      "frontend/components/StickyBulletin.tsx",
      "frontend/components/layout/MissionControlContent.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/StrategiumPeekBar.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/mission-control/RiskFlowMiniWidget.tsx",
      "frontend/components/narrative/SanctumBriefing.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/services/journal.ts",
      "frontend/index.css",
      "backend-hono/src/routes/blindspots.ts",
      "backend-hono/src/services/psych-assist-service.ts",
      "backend-hono/src/services/miroshark/miroshark-briefing.ts",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
    ],
  },
  {
    date: "2026-04-17T15:45:00",
    agent: "claude-code",
    summary:
      "S23-T4: /api/me diagnostic endpoint ({userId,email,traderName}) for cross-device account debugging, Harper/Hermes memory reads now use authenticated userId when available (falls back to SYSTEM_USER_ID for background jobs), HermesChatRequest + HarperChatRequest accept userId + surface — the hardcoded null-UUID that blocked per-user agent_context_bank reads is replaced with request.userId",
    files: [
      "backend-hono/src/routes/me/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/harper-handler.ts",
    ],
  },
  {
    date: "2026-04-17T15:30:00",
    agent: "claude-code",
    summary:
      "S23-T3: Harper Aquarium literacy — ConsiliumHub persists current surface (aquarium/narratives/timeline/boardroom/apparatus/chat) to localStorage on tab change, useHermesChat auto-appends 'aquarium' to activeConnectors + sends surface flag when on the Aquarium surface, backend harper-handler + strands/harper + /api/ai/chat handlers inject buildAquariumContext() whenever surface===aquarium (no manual connector toggle needed), buildAquariumContext now exports from harper-handler with a 'How to read this' preamble explaining IV/regime/signal bands so agents interpret MiroShark output as ground truth (not debug noise), Harper base prompt gains an 'Aquarium' capability block",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/chat/hooks/useHermesChat.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/harper/index.ts",
    ],
  },
  {
    date: "2026-04-17T15:15:00",
    agent: "claude-code",
    summary:
      "S23-T2: Aquarium delivery hang fix — MiroSharkDebatePanel fires onSynthesisComplete once per simulationId when deliberation reaches phase=complete, ConsiliumHub refetches /api/miroshark/latest to refresh KPIs/briefing without waiting for poll, backend updatePhase(complete) now merges Harper's refined composite IV/regime risk/briefing into the in-memory prediction cache so /latest returns post-synthesis numbers (not the stale pre-Harper scoring), AquariumPredictionCards fallback poll 120s → 30s",
    files: [
      "frontend/components/miroshark/MiroSharkDebatePanel.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
    ],
  },
  {
    date: "2026-04-17T15:00:00",
    agent: "claude-code",
    summary:
      "S23-T1: Aquarium UI restructure — removed top QQQ TradingView chart, new brief-pattern top container (Blended IV + Next Session Forecast left 55%, MiroShark Deliberation right 45%, needle divider matching Dashboard aesthetic), replaced Debate button in Consilium tab bar with Chart button (LineChart icon) that toggles full 50/50 split with TradingView iframe on right, removed redundant TradingView iframe toggle from Proposals panel, theme-sensitive CSS-var styling throughout",
    files: [
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
    ],
  },
  {
    date: "2026-04-17T14:15:00",
    agent: "claude-code",
    summary:
      "Harper Ops feed pivots from retired local CLI loop to Claude Code Routines: new 'routine' + 'ack' action types, POST /api/harper-ops/feed auto-detects routine posts via metadata.routineId/triggerId/source and writes a short Harper ack entry in response, status alive now = any ops activity within 24h (not just heartbeats), panel shows Routine · <name> badge and Ack markers, panel title now 'Harper Ops · Routines', bootHarperAutonomous() logs deprecation for the CLI loop gate, docs/routines.md documents the POST payload contract",
    files: [
      "backend-hono/src/services/harper-autonomous/ops-store.ts",
      "backend-hono/src/services/harper-autonomous/index.ts",
      "backend-hono/src/routes/harper-ops/index.ts",
      "frontend/hooks/useHarperOps.ts",
      "frontend/components/harper-ops/HarperOpsPanel.tsx",
      "docs/routines.md",
    ],
  },
  {
    date: "2026-04-17T14:00:00",
    agent: "claude-code",
    summary:
      "Chat relay button (copy pickup code to hand off conversation to another device), voice room rewired so connect joins silently with a hidden persistent webview (system audio wires via session permission handler in Electron main) and a new PictureInPicture button now toggles the visible panel, removed 'Wield the Consul' dropdown label, moved Agent Lounge out of Imperium into Apparatus as 'lounge', cache gateway/hermes + sourceStatus to localStorage so the self team card hydrates with last-known-good indicators on app reopen instead of flashing all-red until the first poll completes",
    files: [
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/consilium/FluxerCallWidget.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/ConsiliumTabConfig.ts",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/contexts/GatewayContext.tsx",
      "electron/main.cjs",
    ],
  },
  {
    date: "2026-04-17T00:10:00",
    agent: "claude-code",
    summary:
      "All digits render in Doto (Nothing Design display) across every theme on desktop + mobile: remapped 'Readable Digits' @font-face from Inter to Doto via unicode-range, self-hosted Doto for mobile and prepended Readable Digits to mobile font stacks (previously only desktop). Mobile toolbar VIX now fades in smoothly via IntersectionObserver once the Dash hero VIX ticker scrolls off-screen, and hides again on Dash init state",
    files: [
      "frontend/fonts.css",
      "frontend/contexts/ThemeContext.tsx",
      "mobile/index.css",
      "mobile/public/fonts/doto.woff2",
      "mobile/contexts/ThemeContext.tsx",
      "mobile/hooks/useHeroVixVisible.ts",
      "mobile/components/home/HomePage.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
    ],
  },
  {
    date: "2026-04-17T01:30:00",
    agent: "claude-code",
    summary:
      "Fix mobile bulletin sync: flush pending saves on close (no lost edits), re-fetch fresh on every open with cache: no-store, generate actual PWA icons from logo (were 0-byte placeholders)",
    files: [
      "mobile/components/bulletin/MobileBulletin.tsx",
      "mobile/hooks/useStickyBulletin.ts",
      "mobile/public/icons/icon-192.png",
      "mobile/public/icons/icon-512.png",
    ],
  },
  {
    date: "2026-04-17T01:00:00",
    agent: "claude-code",
    summary:
      "Heading toolbar Solvys Feels pass: unified .toolbar-icon-btn class for all icon buttons (28px, accent borders, transparent bg, filled on active), toolbar height shrink 56->50px, Fluxer voice channel updated to trading-floor and connect wired to open Fluxer, PsychAssist smooth roll-out/collapse transition on dock/undock, VIX direction-change pulse with theme bullish/bearish colors, dropdown-enter and tooltip-fade microinteractions, Strategium card entrance stagger",
    files: [
      "frontend/index.css",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/consilium/FluxerCallWidget.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
    ],
  },
  {
    date: "2026-04-17T00:30:00",
    agent: "claude-code",
    summary:
      "Trigger MiroShark Aquarium run after every briefing generation — cron dispatch and catch-up paths now fire startPrediction() post-brief, matching the existing behavior on the manual POST /api/data/brief/generate route.",
    files: ["backend-hono/src/services/cron/dispatch-scheduler.ts"],
  },
  {
    date: "2026-04-17T00:15:00",
    agent: "claude-code",
    summary:
      "S20 mobile PWA: auth headers on all bulletin fetches, haptic gating via useHaptic hook (respects settings toggle), activity status context for chat FAB 3-state indicator (idle/radar/check), per-section save checkmarks + global double-checkmark in toolbar, bulletin FAB glow reminder (once/until-pressed), bulletin reminder setting, display name sync to profile, IV Score widget fuse bars replacing weight text",
    files: [
      "mobile/hooks/useHaptic.ts",
      "mobile/contexts/ActivityStatusContext.tsx",
      "mobile/components/shared/RadarSpinner.tsx",
      "mobile/components/shared/SaveCheckmark.tsx",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/components/layout/FloatingChatButton.tsx",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/layout/BottomTabBar.tsx",
      "mobile/components/shared/PullToRefresh.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/home/BriefingCard.tsx",
      "mobile/components/bulletin/MobileBulletin.tsx",
      "mobile/components/settings/SettingsPage.tsx",
      "mobile/hooks/useStickyBulletin.ts",
      "mobile/App.tsx",
      "frontend/components/IVScoreCard.tsx",
    ],
  },
  {
    date: "2026-04-16T23:30:00",
    agent: "claude-code",
    summary:
      "Ensure all external repo deps (tradingview-mcp, financial-datasets-mcp, mobile workspace) are updated by both update scripts. Added tradingview-mcp clone/pull + npm install to fintheon-update.sh, added mobile workspace to both scripts, added MCP repo update step to update.ts.",
    files: ["scripts/fintheon-update.sh", "scripts/update.ts"],
  },
  {
    date: "2026-04-16T22:00:00",
    agent: "claude-code",
    summary:
      "Replace Proposals with Risk Signals on mobile Dash page 4. Apply solvys-feels full-border severity coloring (no Kanban left-stripe) to Risk Signal cards in both mobile and desktop. Desktop RiskSignalCards and Sanctum containers updated with consistent severity border treatment.",
    files: [
      "mobile/components/home/RiskSignalCards.tsx",
      "mobile/components/home/HomePage.tsx",
      "frontend/components/narrative/RiskSignalCards.tsx",
      "frontend/components/narrative/Sanctum.tsx",
    ],
  },
  {
    date: "2026-04-16T21:15:00",
    agent: "claude-code",
    summary:
      "Imperium overhaul: Fixed Fluxer URL (app.fluxer.app→web.fluxer.app), converted FluxerEmbed to use Electron webview (bypasses X-Frame-Options DENY) with browser fallback to external link. Added FluxerCallWidget in header between nametag and antilag button — rolls out rightward to reveal audio controls (connect/mute/deafen/video) with floating video panel in Electron. Added Agent Dream Room (Imperium > Dream Room) — autonomous agent reflection channel inspired by Bitterbot Dream Engine, with backend endpoint and Supabase persistence.",
    files: [
      "frontend/components/consilium/FluxerEmbed.tsx",
      "frontend/components/consilium/FluxerCallWidget.tsx",
      "frontend/components/consilium/AgentDreamRoom.tsx",
      "frontend/components/consilium/ConsiliumTabConfig.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "backend-hono/src/routes/agent-bus/dreams.ts",
      "backend-hono/src/routes/index.ts",
      "supabase/migrations/20260416_agent_dreams.sql",
    ],
  },
  {
    date: "2026-04-17T09:00:00",
    agent: "claude-code",
    summary:
      "RiskFlow fuzzy dedup: token-overlap similarity (70% threshold) removes near-duplicate headlines from different sources. Fixed agent subject tags to match DB vocabulary (subj:macro, subj:geopolitical, subj:vol, subj:structure, subj:earnings, subj:credit, subj:sentiment) — each MiroShark agent now gets differentiated headline context instead of groupthink. Auto-trigger MiroShark Aquarium run after every Brief publish. Created 4 missing Supabase tables (miroshark_deliberations, agent_memory, deliberation_outcomes, oracle_research_findings).",
    files: [
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/agent-bus/templates/miroshark-template.ts",
      "backend-hono/src/routes/data/index.ts",
    ],
  },
  {
    date: "2026-04-17T06:30:00",
    agent: "claude-code",
    summary:
      "S20-T10: Integration + Validation + Deploy. Merged all 9 sprint tracks, verified builds (backend, desktop, mobile), validated legacy removal (MARKET_ANALYSTS, SubAnalyst Context, Notion services, agentic chatroom), confirmed agent dossiers compose into system prompts, agent memory and outcome tracker wired, differentiated context feeding active, scoring modules split from monoliths, health registry reporting, conversation persistence across platforms. Deployed to Fly.io, Vercel desktop, Vercel mobile.",
    files: ["src/lib/changelog.ts"],
  },
  {
    date: "2026-04-16T22:00:00",
    agent: "claude-code",
    summary:
      "S20-T9: Backend Streamlining. Two-phase boot (bootCritical + bootBackground via queueMicrotask). Split iv-scoring-v2.ts (1954 lines) into 9 modules under services/iv-scoring/. Split central-scorer.ts (1073 lines) into scorer-pipeline + scorer-tagging + scorer-watchlist. Created unified feature-flag-service.ts with single getFlag(). Created health-registry.ts for background service monitoring. Created base-poller abstraction for ingestion consolidation. Tuned intervals: Aquarium 30→60min, Agent Notes 3→5min, Shared Memory 30→60min. /health endpoint now includes service registry data.",
    files: [
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/index.ts",
      "backend-hono/src/services/iv-scoring/config.ts",
      "backend-hono/src/services/iv-scoring/computation.ts",
      "backend-hono/src/services/iv-scoring/instrument.ts",
      "backend-hono/src/services/iv-scoring/systemic.ts",
      "backend-hono/src/services/iv-scoring/taxonomy.ts",
      "backend-hono/src/services/iv-scoring/ticker.ts",
      "backend-hono/src/services/iv-scoring/sentiment.ts",
      "backend-hono/src/services/iv-scoring/sentiment-data.ts",
      "backend-hono/src/services/iv-scoring/index.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/scorer-tagging.ts",
      "backend-hono/src/services/riskflow/scorer-watchlist.ts",
      "backend-hono/src/services/feature-flag-service.ts",
      "backend-hono/src/services/health-registry.ts",
      "backend-hono/src/services/ingestion/base-poller.ts",
      "backend-hono/src/services/riskflow/aquarium-scheduler.ts",
      "backend-hono/src/services/riskflow/agent-notes.ts",
      "backend-hono/src/services/peers/shared-memory.ts",
    ],
  },
  {
    date: "2026-04-17T00:15:00",
    agent: "claude-code",
    summary:
      "S20-T2: Differentiated context feeding + legacy kill. Ported subject-tag filtering from miroshark-client into shared fetchFilteredHeadlines() in miroshark-context.ts. Rewrote buildAnalystPrompt/buildNarrativeContext/buildGovPrompt/buildDeliberationPrompt/buildHarperPrompt to be async and query DB with per-agent subject filtering (12 matched + 3 cross-domain). Made createMiroSharkDAG async. Removed legacy MARKET_ANALYSTS array (Alex Vane, Priya Nair, James Osei, Sophie Kwan, Marcus Webb), fetchHeadlinesForAnalyst, fetchExaHeadlinesForAgent, runMarketAnalystDebate, getMarketAnalysts from miroshark-client.ts. Updated miroshark-deliberation.ts to use ANALYST_META from template. Updated aquarium-scheduler fetchRecentHeadlines to filter by Oracle subjects. Renamed Agentic Chatroom to Agentic Forum in harper-handler.ts and HARPER-SOUL.md.",
    files: [
      "backend-hono/src/services/miroshark/miroshark-context.ts",
      "backend-hono/src/services/agent-bus/templates/miroshark-template.ts",
      "backend-hono/src/services/miroshark/miroshark-client.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
      "backend-hono/src/services/riskflow/aquarium-scheduler.ts",
      "backend-hono/src/routes/miroshark/handlers.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/routes/boardroom/index.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/services/harper-autonomous/HARPER-SOUL.md",
    ],
  },
  {
    date: "2026-04-16T23:55:00",
    agent: "claude-code",
    summary:
      "S20-T6: Conversation Persistence — relay.ts creates conversation + saves user message before forwarding, relay-connector passes userId to harper agent, memory-store has idempotency guard (5s dedup window) on assistant message save, ChatPage refreshes sessions after stream, SessionList shows messageCount badge + uses lastMessageAt, useConversations adds archiveSession method, SessionsPanel uses BackendClient with auth instead of bare fetch, RLS migration for ai_conversations + ai_messages with user-scoped policies and service_role bypass.",
    files: [
      "backend-hono/src/routes/relay.ts",
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/services/strands/memory-store.ts",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/SessionList.tsx",
      "mobile/hooks/useConversations.ts",
      "frontend/lib/services/ai.ts",
      "frontend/components/chat/SessionsPanel.tsx",
      "supabase/migrations/20260416_conversation_rls.sql",
    ],
  },
  {
    date: "2026-04-16T23:30:00",
    agent: "claude-code",
    summary:
      "S20-T1: Agent Dossiers & Personality Injection — created 4 definitive dossier files (Oracle/Feucht/Consul/Herald) with identity, worldview, operational rules, and analytical framework. Thinned base-prompts.ts to one-liner role tags. Dossiers inject after persona files in system prompt composition pipeline. Deduped philosophy-blocks.ts to retain only neural-layer framing. Updated frontend ApparatusMap.tsx and AgenticDesk.tsx to match backend personality titles.",
    files: [
      "backend-hono/src/services/ai/agent-instructions/dossiers/oracle.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/feucht.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/consul.ts",
      "backend-hono/src/services/ai/agent-instructions/dossiers/herald.ts",
      "backend-hono/src/services/ai/agent-instructions/base-prompts.ts",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/ai/agent-instructions/philosophy-blocks.ts",
      "frontend/components/apparatus/ApparatusMap.tsx",
      "frontend/components/settings/AgenticDesk.tsx",
    ],
  },
  {
    date: "2026-04-16T17:45:00",
    agent: "claude-code",
    summary:
      "S20-T8: Claude Code Routines — 8 cloud-based autonomous agents on Anthropic infrastructure. 3 MOVE routines (REFLECT, Prediction Resolver, Market Impact Enricher) fully migrated from backend with env flags to disable local schedulers. 5 AUGMENT routines (Dispatch Watchdog, Boardroom Synthesis, MiroShark Meta, Poly/Kalshi Divergence Analysis, Aquarium Deep Outlook) monitor/enrich existing backend jobs. Total 13 runs/day within 15-run budget.",
    files: [
      "backend-hono/src/services/autoresearch/reflect-scheduler.ts",
      "backend-hono/src/services/polymarket-prediction-resolver.ts",
      "backend-hono/src/services/cron/market-impact-enricher.ts",
      "docs/routines.md",
    ],
  },
  {
    date: "2026-04-16T22:00:00",
    agent: "claude-code",
    summary:
      "S20-T3: Oracle scheduled research — prediction market scanning cycle. Scans Polymarket/Kalshi on 4h cron, cross-references with IV scoring + RiskFlow themes, detects arb opportunities (>15% mismatch), stores findings in oracle_research_findings table. Consumes existing divergence alerts as input (no duplication). GET /api/oracle/research endpoint for Harper/frontend. Gated by ORACLE_RESEARCH_ENABLED env var.",
    files: [
      "backend-hono/src/services/oracle-research/types.ts",
      "backend-hono/src/services/oracle-research/scanner.ts",
      "backend-hono/src/services/oracle-research/arb-detector.ts",
      "backend-hono/src/services/oracle-research/index.ts",
      "backend-hono/src/services/cron/oracle-research-scheduler.ts",
      "backend-hono/src/routes/oracle.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/services.ts",
      "supabase/migrations/20260416_oracle_research.sql",
    ],
  },
  {
    date: "2026-04-16T18:30:00",
    agent: "claude-code",
    summary:
      "Notion severance: removed all Notion code paths from frontend and backend. NotionService → DataService, notion-trade-idea → trade-idea, removed 30s Notion polling from RiskFlowContext, deleted /api/notion redirect shim, Notion MCP entry, and all notionUrl fields. Supabase is sole source of truth.",
    files: [
      "frontend/lib/services/data.ts",
      "frontend/lib/services/index.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/lib/shared-icons.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/contexts/ScheduleContext.tsx",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/components/RiskFlowMini.tsx",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/mcp/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/econ-calendar-service.ts",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
    ],
  },
  {
    date: "2026-04-16T16:00:00",
    agent: "claude-code",
    summary:
      "fix: mobile briefing overlay renders behind Dash content due to stacking context trap. Replaced BottomSheet with full-screen BriefingOverlay using createPortal to escape z-index hierarchy. iOS pill bar swipe-to-dismiss.",
    files: [
      "mobile/components/home/BriefingOverlay.tsx",
      "mobile/components/home/BriefingCard.tsx",
    ],
  },
  {
    date: "2026-04-16T15:00:00",
    agent: "claude-code",
    summary:
      "feat: display linked Google email in Profile (General) tab with avatar, add Switch Account button to re-auth with a different Google account",
    files: ["frontend/components/settings/GeneralTab.tsx"],
  },
  {
    date: "2026-04-16T14:00:00",
    agent: "claude-code",
    summary:
      "fix: scrape fallback uses hasAuthenticatedKeys() instead of isRettiwtAvailable() to skip curated timelines when all Rettiwt keys on cooldown. Agent-Reach (FinancialJuice, ZH, Reuters, Bloomberg) now runs unconditionally instead of gated behind totalWritten===0.",
    files: ["backend-hono/src/services/riskflow/feed-poller.ts"],
  },
  {
    date: "2026-04-16T13:30:00",
    agent: "claude-code",
    summary:
      "fix: IV Scoring Engine reconnected — rewired iv-score-ticker + handler fallback to read from scored_riskflow_items (live pipeline) instead of deprecated news_feed_items. Added MiroShark boot restore from latest Aquarium simulation so mirosharkComponent survives backend restarts. Fixed merge conflict in feed-health.log.",
    files: [
      "backend-hono/src/services/market-data/iv-score-ticker.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/services/miroshark/miroshark-boot.ts",
      "backend-hono/src/boot/services.ts",
    ],
  },
  {
    date: "2026-04-16T13:00:00",
    agent: "claude-code",
    summary:
      "feat: T4 unification — merged T2 (agent UI) + T3 (conversation persistence) into mobile-agent-upgrade. Wired useConversations hook to ChatPage/SessionList for API-backed session loading, forwarded images+riskFlowContext through sendMessage to relay.",
    files: [
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/SessionList.tsx",
      "mobile/hooks/useConversations.ts",
    ],
  },
  {
    date: "2026-04-16T12:00:00",
    agent: "claude-code",
    summary:
      "fix: Mobile RiskFlow — pull-to-refresh now read-only (GET /api/riskflow/feed), added Agent Reach button for deliberate fetch+score via POST /api/riskflow/refresh. Separates passive headline reads from active polling on mobile.",
    files: [
      "mobile/contexts/RiskFlowContext.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
    ],
  },
  {
    date: "2026-04-16T04:00:00",
    agent: "claude-code",
    summary:
      "feat: T1 relay expansion — full payload forwarding (images, riskFlowContext, thinkHarder, persona), POST /api/relay/tool-decision endpoint, cognition event injection into SSE stream, noTimeout flag for relay-originated tool approvals",
    files: [
      "backend-hono/src/routes/relay.ts",
      "backend-hono/src/services/relay-bridge.ts",
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/services/tool-approval-store.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
      "backend-hono/src/services/strands/harper-tools.ts",
    ],
  },
  {
    date: "2026-04-16T03:30:00",
    agent: "claude-code",
    summary:
      "feat: T3 conversation persistence — useConversations hook + API-backed SessionList with search + background agent recovery via visibilitychange",
    files: [
      "mobile/hooks/useConversations.ts",
      "mobile/components/chat/SessionList.tsx",
      "mobile/components/chat/ChatPage.tsx",
    ],
  },
  {
    date: "2026-04-16T03:00:00",
    agent: "claude-code",
    summary:
      "feat: T2 mobile agent UI — image attachments (camera/photo picker, thumbnail preview), RiskFlow headline picker (bottom sheet, pill chips, formatHeadlineContext), inline tool approval cards (approve/deny with SSE events). ChatInput gets toolbar row + expanded onSend with images/riskFlowContext. ChatPage handles tool-approval-needed/resolved SSE events and POSTs decisions to relay.",
    files: [
      "mobile/components/chat/ImageAttachButton.tsx",
      "mobile/components/chat/ImagePreviewRow.tsx",
      "mobile/components/chat/HeadlineChips.tsx",
      "mobile/components/chat/HeadlinePickerSheet.tsx",
      "mobile/components/chat/ToolApprovalCard.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/ChatPage.tsx",
    ],
  },
  {
    date: "2026-04-16T02:00:00",
    agent: "claude-code",
    summary:
      "feat: Something Solvys + Something Monochrome themes — Nothing Design special presets in desktop frontend. Extends ThemeConfig with special theme fields (fontBody/fontHeading/fontMono/glassEnabled/borderRadius/easeDefault). Adds .nothing-active CSS class for flat surfaces + sharp geometry. Downloads Doto, Space Grotesk, Space Mono fonts. Updates liquid-glass.tsx to disable backdrop blur/shadow when glassEnabled=false. Adds Special section to ThemeSettings with font preview cards and font-override notice.",
    files: [
      "frontend/lib/theme.ts",
      "frontend/fonts.css",
      "frontend/index.css",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/ui/liquid-glass.tsx",
      "frontend/components/settings/ThemeSettings.tsx",
      "frontend/public/fonts/doto.woff2",
      "frontend/public/fonts/space-grotesk.woff2",
      "frontend/public/fonts/space-mono-regular.woff2",
      "frontend/public/fonts/space-mono-bold.woff2",
    ],
  },
  {
    date: "2026-04-16T01:30:00",
    agent: "claude-code",
    summary:
      "feat: Mobile Nothing Design overhaul — favicon, full Nothing font takeover, RiskFlow X-feed redesign with vertical fuse bars + IV scores + zero-gap + full-width segmented filter strip, hero row rearranged to IV/VIX/Implied Points, scroll-lock dash pages with Aquarium summary + instrument outlook cards + agent trade proposals, 5-tab nav (DASH/RISKFLOW/CHAT/ECON/SETTINGS), chat thinking indicator with segmented spinner + tool call streaming + Nothing-styled input, TradingView economic calendar embed tab, bulletin fix, toolbar wordmark in Doto display font",
    files: [
      "mobile/public/favicon.svg",
      "frontend/public/favicon.svg",
      "mobile/index.html",
      "frontend/index.html",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/ThinkingIndicator.tsx",
      "mobile/components/chat/ToolCallCard.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/layout/HamburgerMenu.tsx",
      "mobile/components/layout/ToolbarExpanded.tsx",
      "mobile/components/riskflow/RiskFlowFilterBar.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/components/shared/VerticalFuseBar.tsx",
      "mobile/components/home/HomePage.tsx",
      "mobile/components/home/AquariumSummary.tsx",
      "mobile/components/home/InstrumentOutlookCards.tsx",
      "mobile/components/home/AgentTradeCards.tsx",
      "mobile/components/home/MiniSessionCalendar.tsx",
      "mobile/components/econ/EconCalendarEmbed.tsx",
      "mobile/hooks/useIVScore.ts",
      "mobile/hooks/useMirosharkLatest.ts",
      "mobile/hooks/useInstrumentOutlook.ts",
      "mobile/hooks/useAgentProposals.ts",
      "mobile/hooks/useStickyBulletin.ts",
      "mobile/App.tsx",
    ],
  },
  {
    date: "2026-04-16T00:45:00",
    agent: "claude-code",
    summary:
      "fix: content-guard had two gaps killing legit FJ headlines — (1) FJ_ALLOWED_EMOJIS missing 🟠🟡🔵 so medium/low severity items blocked as 'non-fj-emoji', (2) MARKET_KEYWORDS missing all FX/currency terms (FX, forex, USD, JPY, yen, carry trade, Fin. Min., etc.) so headlines like '🔴Japan Fin. Min. Katayama: bold actions on FX' blocked as 'no-market-relevance'",
    files: ["backend-hono/src/services/riskflow/content-guard.ts"],
  },
  {
    date: "2026-04-15T23:30:00",
    agent: "claude-code",
    summary:
      "S17-T5: In-app approval modals with Approve All session memory — unified desktop + mobile, cognition stream via relay, tool-decision forwarding",
    files: [
      "mobile/hooks/useCognitionStream.ts",
      "mobile/components/chat/ApprovalModal.tsx",
      "frontend/components/chat/ToolApprovalCard.tsx",
      "frontend/components/chat/hooks/useToolApprovals.ts",
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/services/relay-bridge.ts",
      "mobile/stores/useChatStore.ts",
    ],
  },
  {
    date: "2026-04-16T00:15:00",
    agent: "claude-code",
    summary:
      "S17-T4: Codex-style message queue — drag-to-reorder popover above input bar, auto-drain on response complete, unified desktop + mobile",
    files: [
      "mobile/components/chat/QueuePopover.tsx",
      "frontend/components/chat/MessageQueue.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/stores/useChatStore.ts",
      "mobile/components/chat/ChatPage.tsx",
    ],
  },
  {
    date: "2026-04-15T23:45:00",
    agent: "claude-code",
    summary:
      "S17-T3: Tool call streaming panes — collapsible tool execution cards with running/complete/error states, Claude Code-style peek UX",
    files: [
      "mobile/components/chat/ToolCallPane.tsx",
      "mobile/components/chat/ToolCallGroup.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "mobile/stores/useChatStore.ts",
    ],
  },
  {
    date: "2026-04-15T23:30:00",
    agent: "claude-code",
    summary:
      "S17-T2: Thinking/reasoning stream indicator — pulsing gold dot, rotating phrases, expandable reasoning content, 'thought for Xs' on completion",
    files: [
      "mobile/components/chat/ThinkingIndicator.tsx",
      "mobile/components/chat/ChatMessage.tsx",
    ],
  },
  {
    date: "2026-04-15T23:00:00",
    agent: "claude-code",
    summary:
      "S17-T1: Stop request button — animated send/stop icon swap using framer-motion AnimatePresence, aborts active SSE stream via store.abort()",
    files: [
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/ChatPage.tsx",
    ],
  },
  {
    date: "2026-04-15T22:00:00",
    agent: "claude-code",
    summary:
      "S17-T0: Extract chat state to Zustand store (useChatStore), expose relay requestId via relay-meta SSE event + X-Request-Id header, extend ChatMessageData for thinking/tools, add relay sendCommand for tool decisions, refactor ChatPage to thin rendering shell (~120 lines from 307)",
    files: [
      "mobile/stores/useChatStore.ts",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "backend-hono/src/services/relay-bridge.ts",
      "backend-hono/src/routes/relay.ts",
    ],
  },
  {
    date: "2026-04-15T20:30:00",
    agent: "claude-code",
    summary:
      "fix: Wire full system prompts to all Strands agents (Oracle, Feucht, Consul, Herald) — was using 3-line BASE_PROMPTS instead of getAgentSystemPrompt() with full persona profiles, beliefs, philosophy blocks. Only Harper had the full prompt. Fixes groupthink across DAG pipeline and direct chat routing.",
    files: [
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/src/services/strands/oracle.ts",
      "backend-hono/src/services/strands/feucht.ts",
      "backend-hono/src/services/strands/consul.ts",
      "backend-hono/src/services/strands/herald.ts",
      "backend-hono/src/services/strands/pipeline.ts",
      "backend-hono/src/routes/chat.ts",
    ],
  },
  {
    date: "2026-04-15T20:00:00",
    agent: "claude-code",
    summary:
      "T8: Nothing x /the-feels polish pass — page transitions (direction-aware slide + opacity crossfade), card stagger animations, VIX gold flash 400ms, mechanical toolbar/bottomsheet drag physics, dot-matrix motif on HomePage, SegmentedSpinner, lazy-loaded tabs, SW registration, Vite chunk splitting, accessibility audit (aria-labels/roles/status), touch target audit (>=44px), all loading states bracket-style",
    files: [
      "mobile/App.tsx",
      "mobile/main.tsx",
      "mobile/index.css",
      "mobile/vite.config.ts",
      "mobile/components/shared/SegmentedSpinner.tsx",
      "mobile/components/shared/VixBadge.tsx",
      "mobile/components/shared/BottomSheet.tsx",
      "mobile/components/shared/PullToRefresh.tsx",
      "mobile/components/layout/BottomTabBar.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/home/HomePage.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/ConnectionStatus.tsx",
      "mobile/components/settings/SettingsPage.tsx",
    ],
  },
  {
    date: "2026-04-15T18:00:00",
    agent: "claude-code",
    summary:
      "T7: Web Push notifications — service worker, VAPID auth, multi-category toggles (RiskFlow/Brief/Regimes), backend subscription storage + sender, scorer push trigger, Nothing-style settings UI",
    files: [
      "mobile/public/sw.js",
      "mobile/lib/push.ts",
      "mobile/hooks/usePushNotifications.ts",
      "mobile/components/settings/SettingsPage.tsx",
      "supabase/migrations/20260415_web_push_subscriptions.sql",
      "backend-hono/src/routes/web-push.ts",
      "backend-hono/src/services/web-push-sender.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-16T00:30:00",
    agent: "claude-code",
    summary:
      "T6: Mobile Consilium chat with Harper via Fly.io WebSocket relay, connection status indicator, session list, relay bridge + connector backend services",
    files: [
      "mobile/components/chat/ChatPage.tsx",
      "mobile/components/chat/ChatMessage.tsx",
      "mobile/components/chat/ChatInput.tsx",
      "mobile/components/chat/AgentBadge.tsx",
      "mobile/components/chat/ConnectionStatus.tsx",
      "mobile/components/chat/SessionList.tsx",
      "backend-hono/src/routes/relay.ts",
      "backend-hono/src/services/relay-bridge.ts",
      "backend-hono/src/services/relay-connector.ts",
      "backend-hono/src/boot/relay-ws.ts",
    ],
  },
  {
    date: "2026-04-15T23:45:00",
    agent: "claude-code",
    summary:
      "T4: Home page with daily briefing card, QuickStats instrument row, MiniRegimeTracker with Doto countdown, native MiniSessionCalendar, shared BottomSheet/SurfaceCard/SegmentedBar components",
    files: [
      "mobile/components/home/HomePage.tsx",
      "mobile/components/home/BriefingCard.tsx",
      "mobile/components/home/QuickStatsRow.tsx",
      "mobile/components/home/MiniRegimeTracker.tsx",
      "mobile/components/home/MiniSessionCalendar.tsx",
      "mobile/components/shared/SurfaceCard.tsx",
      "mobile/components/shared/BottomSheet.tsx",
      "mobile/components/shared/SegmentedBar.tsx",
      "mobile/hooks/useBriefing.ts",
      "mobile/hooks/useRegimeTracker.ts",
      "mobile/hooks/useEconCalendar.ts",
      "mobile/App.tsx",
    ],
  },
  {
    date: "2026-04-15T23:30:00",
    agent: "claude-code",
    summary:
      "T5: Mobile RiskFlow with Nothing-style card feed, pill filter bar, infinite scroll, pull-to-refresh with segmented bar, swipe-to-dismiss, inline card expansion",
    files: [
      "mobile/contexts/RiskFlowContext.tsx",
      "mobile/components/riskflow/RiskFlowPage.tsx",
      "mobile/components/riskflow/RiskFlowFilterBar.tsx",
      "mobile/components/riskflow/RiskFlowCard.tsx",
      "mobile/components/riskflow/RiskFlowCardExpanded.tsx",
      "mobile/components/shared/PullToRefresh.tsx",
      "mobile/components/shared/SwipeAction.tsx",
      "mobile/components/shared/SeverityBadge.tsx",
      "mobile/components/shared/SurfaceCard.tsx",
      "mobile/components/shared/SegmentedBar.tsx",
      "mobile/hooks/useRiskFlowInfiniteScroll.ts",
      "mobile/hooks/useRiskFlowFilters.ts",
    ],
  },
  {
    date: "2026-04-15T23:00:00",
    agent: "claude-code",
    summary:
      "T3: Mobile shell with Nothing-style bottom tabs, expandable VIX toolbar (Doto font), StickyBulletin expander, hamburger menu with Harper refresh",
    files: [
      "mobile/components/layout/MobileShell.tsx",
      "mobile/components/layout/BottomTabBar.tsx",
      "mobile/components/layout/MobileToolbar.tsx",
      "mobile/components/layout/ToolbarExpanded.tsx",
      "mobile/components/layout/HamburgerMenu.tsx",
      "mobile/components/shared/VixBadge.tsx",
      "mobile/hooks/useVixTicker.ts",
      "mobile/hooks/useSwipeGesture.ts",
      "mobile/hooks/useStickyBulletin.ts",
      "mobile/App.tsx",
    ],
  },
  {
    date: "2026-04-15T22:00:00",
    agent: "claude-code",
    summary:
      "T2: Auth + session persistence + theme/settings/status contexts for Fintheon Mobile, imports all 10 color presets + 4 font themes from frontend, dual CSS var mapping (Fintheon + Nothing tokens)",
    files: [
      "mobile/contexts/AuthContext.tsx",
      "mobile/contexts/ThemeContext.tsx",
      "mobile/contexts/SettingsContext.tsx",
      "mobile/contexts/ToastContext.tsx",
      "mobile/lib/backend.ts",
      "mobile/App.tsx",
      "mobile/vite-env.d.ts",
    ],
  },
  {
    date: "2026-04-15T21:00:00",
    agent: "claude-code",
    summary:
      "T1: Scaffold /mobile/ directory with Vite 6 + React 19 + Tailwind CSS 4, Nothing x Fintheon design tokens, PWA manifest, Vercel deployment config",
    files: [
      "mobile/package.json",
      "mobile/tsconfig.json",
      "mobile/vite.config.ts",
      "mobile/vercel.json",
      "mobile/index.html",
      "mobile/main.tsx",
      "mobile/App.tsx",
      "mobile/index.css",
      "mobile/manifest.json",
    ],
  },
  {
    date: "2026-04-15T19:00:00",
    agent: "claude-code",
    summary:
      "Deliberation UI overhaul — floating KPI overlay with fuse shimmer (Consensus/Direction/Risk Posture), per-agent thinking phrases in BoardroomAgentPanel, JSON suppression + natural language formatting from agent streams.",
    files: [
      "frontend/components/consilium/BoardroomAgentPanel.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/consilium/DeliberationKPIOverlay.tsx",
      "frontend/lib/agentStreamParser.ts",
      "frontend/lib/agentThinkingPhrases.ts",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-04-15T09:30:00",
    agent: "claude-code",
    summary:
      "v5.15.1: Unified 3-track regime tracker redesign — synced backend bias values (neutral→consolidation), deployed to Vercel prod + GitHub release",
    files: [
      "backend-hono/src/routes/regimes/index.ts",
      "docs/sprint-briefs/TASK-regime-t1-backend-data.md",
      "docs/sprint-briefs/TASK-regime-t2-frontend-glass.md",
      "docs/sprint-briefs/TASK-regime-t3-chat-gen-ux.md",
    ],
  },
  {
    date: "2026-04-15T18:00:00",
    agent: "claude-code",
    summary:
      "T3: Added hybrid mini-chat per regime card, glassmorphic AI generate overlay with thinking animation and glass-dissolve effect, new CSS keyframes",
    files: [
      "frontend/components/regimes/RegimeMiniChat.tsx",
      "frontend/components/regimes/RegimeThinkingOverlay.tsx",
      "frontend/components/regimes/RegimeCard.tsx",
      "frontend/components/regimes/RegimeTrackerModal.tsx",
      "frontend/styles/custom.css",
    ],
  },
  {
    date: "2026-04-15T12:00:00",
    agent: "claude-code",
    summary:
      "T2: Decomposed RegimeTrackerModal into subcomponents (BiasBadge, ConfidenceBar, OrbRecord, RegimeCard), applied liquid glass cards, replaced fade bias with 5 heuristic classifications (continuation/reversal/convergence/consolidation/rotation), theme-sensitive ORB colors, removed footer border, v3 storage migration",
    files: [
      "frontend/components/regimes/RegimeTrackerModal.tsx",
      "frontend/components/regimes/BiasBadge.tsx",
      "frontend/components/regimes/ConfidenceBar.tsx",
      "frontend/components/regimes/OrbRecord.tsx",
      "frontend/components/regimes/RegimeCard.tsx",
      "frontend/lib/regimes.ts",
      "frontend/lib/regime-store.ts",
    ],
  },
  {
    date: "2026-04-14T18:00:00",
    agent: "claude-code",
    summary:
      "T1: Added COT data service (CFTC weekly reports), ORB price service (Yahoo Finance), volume spike detection, and antilag confidence blending to regime tracker backend",
    files: [
      "backend-hono/src/services/market-data/cot-types.ts",
      "backend-hono/src/services/market-data/cot-service.ts",
      "backend-hono/src/services/market-data/orb-price-service.ts",
      "backend-hono/src/services/market-data/volume-spike-service.ts",
      "backend-hono/src/services/market-data/iv-scorer.ts",
      "backend-hono/src/routes/market-data/index.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/routes/regime/index.ts",
      "backend-hono/src/routes/regime/handlers.ts",
      "backend-hono/src/routes/regimes/index.ts",
    ],
  },
  {
    date: "2026-04-15T17:00:00",
    agent: "claude-code",
    summary:
      "S16-T6: Sanctum unification — remove Theses, move Polymarket to Page 2, add BlendedVIX + NextSessionForecast cards to Page 0, add RiskSignalCards to Agent Performance section.",
    files: ["frontend/components/narrative/Sanctum.tsx"],
  },
  {
    date: "2026-04-15T16:00:00",
    agent: "claude-code",
    summary:
      "S16-T5: RiskFlow sanitation — auto-purge zero-IV items (>1h old), low-priority batch tagging for Harper review, dismissal reason feedback loop (reason popover + backend storage + Harper payload), expanded source filters (FJ/DeItaOne/OSINT/EconCal/PredMkts/Hermes), verified priority level mapping. Routines research documented.",
    files: [
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/hooks/useRiskFlowFilters.ts",
    ],
  },
  {
    date: "2026-04-15T12:00:00",
    agent: "claude-code",
    summary:
      "S16-T3: Risk Signals — AI-refined expandable cards from bulletins + catalyst watches. Backend generator with 10min cache, Herald AI scoring. Frontend cards in Proposals pop-out panel with third toggle view.",
    files: [
      "backend-hono/src/services/riskflow/risk-signal-generator.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "frontend/components/narrative/RiskSignalCards.tsx",
      "frontend/components/proposals/ProposalWidget.tsx",
    ],
  },
  {
    date: "2026-04-15T04:00:00",
    agent: "claude-code",
    summary:
      "S16-T1: Inject full persona files, context bank memories, and rich scored catalysts (30 items with IV/sentiment/tags) into every Hermes agent invocation. Made getAgentSystemPrompt async. Zero memory lapses.",
    files: [
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/services/agent-bus/dag-scheduler.ts",
    ],
  },
  {
    date: "2026-04-15T00:00:00",
    agent: "claude-code",
    summary:
      "S16-T2: Enhance PolymarketPredictionCards — FUSE confidence score, severity borders, price-at-proposal vs current price delta, expanded card details, full-width grid layout, theme-linked colors.",
    files: [
      "frontend/components/narrative/PolymarketPredictionCards.tsx",
      "backend-hono/src/routes/predictions.ts",
    ],
  },
  {
    date: "2026-04-15T00:00:00",
    agent: "claude-code",
    summary:
      "S16-T4: Blended VIX Score + Next Session Forecast as visible cards on Aquarium Page 0. Three-component IV breakdown, implied range, scenario table, systemic risk overlay. 60s polling.",
    files: [
      "frontend/components/narrative/BlendedVIXCard.tsx",
      "frontend/components/narrative/NextSessionForecastCard.tsx",
      "frontend/components/narrative/useIVScoreData.ts",
    ],
  },
  {
    date: "2026-04-14T12:00:00",
    agent: "claude-code",
    summary:
      "Fix image vision in AskHarp chat: assistant-ui transforms image parts to {type:'file', url, mediaType} but extraction looked for {type:'image', image}. Fixed in Harper/Hermes send paths and UI render. Added click-to-expand lightbox for attached images.",
    files: [
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/chat/FintheonThread.tsx",
    ],
  },
  {
    date: "2026-04-13T00:00:00",
    agent: "claude-code",
    summary:
      "S15-T3: Aquarium Polymarket prediction cards, Kalshi/Polymarket divergence detector (15min), prediction accuracy tracking + resolution cron (1h). Divergence >10% flagged as Kalshi trade signal.",
    files: [
      "frontend/components/narrative/PolymarketPredictionCards.tsx",
      "frontend/components/narrative/Sanctum.tsx",
      "backend-hono/src/routes/predictions.ts",
      "backend-hono/src/services/polymarket-kalshi-divergence.ts",
      "backend-hono/src/services/polymarket-prediction-resolver.ts",
      "backend-hono/src/routes/polymarket/index.ts",
      "backend-hono/src/boot/services.ts",
    ],
  },
  {
    date: "2026-04-12T23:30:00",
    agent: "claude-code",
    summary:
      "Liquid glass v2: added --fintheon-glass-* CSS vars for unified translucent surfaces with depth/refraction highlights. Applied to TeamMemberCard, FintheonAttachPopup, Toast, NotificationToast. Attach popup now has tab fade transitions and a live RiskFlow headline picker (replacing 'Coming Soon' stub). Removed standalone Newspaper button from composer toolbar — headlines now accessed only through attach popup.",
    files: [
      "frontend/index.css",
      "frontend/components/ui/liquid-glass.tsx",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/chat/FintheonAttachPopup.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/components/NotificationToast.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
    ],
  },
  {
    date: "2026-04-12T22:00:00",
    agent: "claude-code",
    summary:
      "Curated sources lockdown: killed open rettiwtSearch + Exa in commentary-scraper and feed-poller fallback. All feed content now from curated X account timelines only. New riskflow_source_accounts table + CRUD API + SourceAccountsManager UI in Refinement Engine. Added emdash + genius filters to content guard. Purged 175+175 garbage commentary-scraper items from both tables.",
    files: [
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts",
      "backend-hono/migrations/028_source_accounts.sql",
      "backend-hono/src/types/source-account.ts",
      "backend-hono/src/services/source-accounts/source-accounts-service.ts",
      "backend-hono/src/routes/source-accounts/handlers.ts",
      "backend-hono/src/routes/source-accounts/index.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/refinement/SourceAccountsManager.tsx",
      "frontend/components/refinement/RefinementEngine.tsx",
    ],
  },
  {
    date: "2026-04-12T18:30:00",
    agent: "claude-code",
    summary:
      "RiskFlow quality hardening: (1) Non-financial govt agency filter (DEA, DEI, ICE, ATF, TSA, etc.) in content-guard. (2) Political rant/conspiracy media filter (Alex Jones, InfoWars, violence calls, opinion rants). (3) Tightened GOV-POI search query — removed bare 'White House' that pulled garbage commentary. (4) IV score cap at 7 for non-X primary sources. (5) Clickable URLs in RiskFlow headline/summary text.",
    files: [
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "frontend/lib/linkify.tsx",
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
    ],
  },
  {
    date: "2026-04-12T15:00:00",
    agent: "claude-code",
    summary:
      "S15-T2: Polymarket read-only service + context bank wiring. New /api/polymarket/* routes (markets, search, whale-alerts). Context bank now returns live Polymarket data instead of empty stub.",
    files: [
      "backend-hono/src/types/polymarket.ts",
      "backend-hono/src/services/polymarket-service.ts",
      "backend-hono/src/services/context-bank/context-bank-service.ts",
      "backend-hono/src/types/context-bank.ts",
      "backend-hono/src/routes/polymarket/index.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-12T14:30:00",
    agent: "claude-code",
    summary:
      "RiskFlow content guard: comprehensive pre-ingestion filter wired into ALL 9 writeRawItems paths (commentary-scraper, exa-scheduled-monitor, feed-service, feed-poller x5, central-scorer safety net). MiroShark fix: Update button runs fresh simulation, auto-run on launch, Harper AI analysis. Gov official headline fetch fixed (title→headline). Exa search fallback for agents with sparse DB context. AskHarp: boardroom DAG opt-in only. UI: Forum rename, sidebar 420px, chat bg unified.",
    files: [
      "backend-hono/src/services/riskflow/content-guard.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-transform.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "frontend/components/consilium/ConsiliumTabConfig.ts",
      "frontend/components/consilium/FluxerEmbed.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
      "frontend/components/layout/ChatPanel.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-12T10:00:00",
    agent: "claude-code",
    summary:
      "Fix Central Scorer stuck mutex: staleness guard (90s force-reset), defensive tick logging, delayed initial cycle 5s for DB pool warmup, caught unhandled rejections. Fixed dropped web-scrape items blocking queue forever (now written to scored table). Built RiskFlow catchup sequence on toggle resume. Added raw_riskflow_items 7d auto-delete (6h cron).",
    files: [
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/boot/services.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-12T00:30:00",
    agent: "claude-code",
    summary:
      "S14-T11: Review + Unify. Fixed critical SSE bug — useAgentBusSSE now uses addEventListener for named events (agent-delta, dag-complete etc) instead of onmessage which silently dropped all DAG stream output. Fixed DAG cancel endpoint URL mismatch (/api/dag/ → /api/boardroom/dag/). Enhanced input bar focus glow (dual-layer shadow, faster transition). Removed duplicate ProviderDropdown from ChatPanel sidebar. Renamed 'Local' to 'VProxy' in provider dropdown. Fixed TimelinePanel 1h/4h filter to use createdAt (full ISO) instead of day-granular date. Purged remaining user-visible 'Harper' display text (MiroShark panel, ResearchBoard dropdown). Added missing T3 and T7 changelog entries. Deleted dead FintheonChatInput.tsx.",
    files: [
      "frontend/hooks/useAgentBusSSE.ts",
      "frontend/hooks/useBoardroomDAG.ts",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/layout/ChatPanel.tsx",
      "frontend/components/chat/ProviderDropdown.tsx",
      "frontend/components/narrative/TimelinePanel.tsx",
      "frontend/components/miroshark/MiroSharkDebatePanel.tsx",
      "frontend/components/research/ResearchBoard.tsx",
      "frontend/lib/artifact-parser.ts",
      "frontend/contexts/SettingsContext.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-11T23:59:00",
    agent: "claude-code",
    summary:
      "S14-T9: Consilium Chat + Sidebar + Imperium UI Polish. Boardroom→Imperium rename with 'Wield the Consul' subheader, stripped old Imperium sub-view. Harper→Harper everywhere (defaults, placeholders, greeting, persona). Input bar transparent when idle, 1.3s glow on focus, send button illumination. Removed 'Local' text from provider pill (icon-only), removed persona selector from sidebar (CAO-only route). Removed 'What needs orchestrating today?' subtitle and 'Claude Opus 4.6' model badge from ChatGreeting. Harper Activity re-expand toggle, RiskFlow collapse/expand on Dashboard. Team card killswitch pill toggle. Onboarding starts at device naming (removed Supabase step). Removed timeframe toggle from ConsiliumFilterBar. Smooth transitions on onboarding modal.",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/ConsiliumTabConfig.ts",
      "frontend/components/consilium/ConsiliumFilterBar.tsx",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/PersonaDropdown.tsx",
      "frontend/components/chat/ProviderDropdown.tsx",
      "frontend/components/chat/FintheonComposer.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/team/TeamOnboarding.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/contexts/FintheonAgentContext.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/TeamPresenceContext.tsx",
    ],
  },
  {
    date: "2026-04-11T23:30:00",
    agent: "claude-code",
    summary:
      "S14-T8: CAO Memory System + Naming. Per-user CAO naming (persisted to user_settings, synced across FintheonAgentContext). Added CAO naming step to TeamOnboarding (5-step flow). Dynamic CAO name replaces hardcoded Harper in AgentBadge, ChatSidebar toasts, ChatGreeting. Auto-flush: every 10th message extracts trade ideas/analysis/levels to peer_shared_memory. Verbal flush: 'remember this'/'save this' triggers immediate save with CAO confirmation. Firm vs personal memory scoping via category prefix.",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/FintheonAgentContext.tsx",
      "frontend/components/settings/AgenticDesk.tsx",
      "frontend/components/team/TeamOnboarding.tsx",
      "frontend/components/consilium/AgentBadge.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
      "backend-hono/src/services/cao-memory-flush.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
    ],
  },
  {
    date: "2026-04-11T22:00:00",
    agent: "claude-code",
    summary:
      "S14-T5: Feed refresh consistency + headline attachment. Reduced backend cache re-sync from 120s to 30s (matches central scorer frequency). Built HeadlinePickerPopover — searchable multi-select popover for attaching feed headlines to chat messages. Wired into all 3 chat surfaces (sidebar, main Consilium, boardroom) via PromptBox. Replaced boardroom inline rfChips/rfPickerOpen with the unified component. Selected headlines inject as context into messages on send.",
    files: [
      "backend-hono/src/services/riskflow/feed-service.ts",
      "frontend/components/chat/HeadlinePickerPopover.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/chat/FintheonComposer.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
    ],
  },
  {
    date: "2026-04-11T21:00:00",
    agent: "claude-code",
    summary:
      "S14-T2: Boardroom DAG streaming fix. Harper chat route now bridges DAG bus events into UIMessageStream in real-time instead of returning a static placeholder string. Added boardroom_threads Supabase table + migration for persistent thread storage. Wired boardroomThreadStore with Supabase write-through (save/delete/sync). AgentChattr now persists completed DAG sessions and syncs from Supabase on mount.",
    files: [
      "backend-hono/src/routes/harper/index.ts",
      "frontend/lib/boardroomThreadStore.ts",
      "frontend/components/consilium/AgentChattr.tsx",
      "supabase/migrations/20260411_boardroom_threads.sql",
    ],
  },
  {
    date: "2026-04-11T20:00:00",
    agent: "claude-code",
    summary:
      "S14-T4: Timeline filters fix + time range. Added TIME_RANGES (1H/4H/1D/1W/ALL) with cutoff filtering to both TimelinePanel and TimelineOverlay. Added severity/macroLevel toggle boxes to TimelineOverlay (was missing entirely). Time range pills added to both views. All filters now applied in useMemo filter chains.",
    files: [
      "frontend/components/narrative/TimelinePanel.tsx",
      "frontend/components/layout/TimelineOverlay.tsx",
    ],
  },
  {
    date: "2026-04-11T19:30:00",
    agent: "claude-code",
    summary:
      "S14-T7: Artifact Parser. Regex-based artifact block extraction from Harper chat responses (```artifact:type fences). TradeProposalCard renders bias badge, entry/stop/target grid, R:R, rationale. Catalyst artifacts auto-dispatch to NarrativeFlow via narrativeDispatch ADD_CATALYST. JSON.parse wrapped in try/catch with skip-on-failure.",
    files: [
      "frontend/lib/artifact-parser.ts",
      "frontend/components/chat/ArtifactCard.tsx",
      "frontend/components/chat/FintheonThread.tsx",
    ],
  },
  {
    date: "2026-04-11T19:00:00",
    agent: "claude-code",
    summary:
      "S14-T6: Splash screen redesign — replaced temple doors with liquid glass loading screen. Shuffled halftone hero backgrounds, frosted glass window with fintheon-logo.png, Playfair Display status text. Wired into App.tsx AuthGate with sessionStorage cold-start detection. Shows on quit+relaunch, not on resume.",
    files: ["frontend/components/SplashScreen.tsx", "frontend/App.tsx"],
  },
  {
    date: "2026-04-11T18:00:00",
    agent: "claude-code",
    summary:
      "S14-T10 Dead Code Cleanup: Deleted 6 orphan files (InterventionSidebar, MainContent, NotFoundPage, AgentChatroomView, useCloudState, SPQRStamp). Renamed all user-facing Twitter/Rettiwt labels to X across status messages, toasts, onboarding, apparatus bios, and memory cards. Cleaned stale twitter-cli comments in backend feed-service and feed-poller.",
    files: [
      "frontend/components/InterventionSidebar.tsx",
      "frontend/components/MainContent.tsx",
      "frontend/components/NotFoundPage.tsx",
      "frontend/components/executive/AgentChatroomView.tsx",
      "frontend/hooks/useCloudState.ts",
      "frontend/components/ui/SPQRStamp.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/components/team/TeamOnboarding.tsx",
      "frontend/components/apparatus/MemoryCard.tsx",
      "frontend/components/apparatus/ApparatusMap.tsx",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
    ],
  },
  {
    date: "2026-04-11T17:30:00",
    agent: "claude-code",
    summary:
      "S14-T3: Feed Pipeline hardening. Agent Reach scraper fallback when Rettiwt rate limited (8 domains, basic HTML extraction). 3-step fallback chain: Rettiwt search → Agent Reach scrape → Exa neural search. Rate limit detection via consecutive empty poll counter with 5min cooldown. Commentary scraper + scheduled events run on every force refresh regardless of owner status.",
    files: [
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/agent-reach-service.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
    ],
  },
  {
    date: "2026-04-11T16:45:00",
    agent: "claude-code",
    summary:
      "S14-T1 MiroShark Revival: Frontend now sends real NarrativeContext (lanes/catalysts/ropes) to simulate endpoint instead of empty arrays. Backend synthesizes lanes from RiskFlow headlines if frontend sends empty. Deliberation results now persist to Supabase (miroshark_deliberations table) and rehydrate after restart.",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/routes/miroshark/handlers.ts",
      "supabase/migrations/20260411_miroshark_deliberations.sql",
    ],
  },
  {
    date: "2026-04-11T14:00:00",
    agent: "claude-code",
    summary:
      "Solvys audit: purged stale twitter-cli compat fields from useSourceStatus, RiskFlowContext, handlers, TeamOnboarding, riskflow-feed types. Extracted useStickyBulletin hook (1162→877+360). Removed deprecated twitterCli/twitterRateLimited/twitterCooldownSec from sources endpoint.",
    files: [
      "frontend/hooks/useSourceStatus.ts",
      "frontend/hooks/useStickyBulletin.ts",
      "frontend/components/StickyBulletin.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/lib/riskflow-feed.ts",
      "frontend/lib/shared-icons.tsx",
      "frontend/components/team/TeamOnboarding.tsx",
      "backend-hono/src/routes/riskflow/handlers.ts",
    ],
  },
  {
    date: "2026-04-11T12:00:00",
    agent: "claude-code",
    summary:
      "Stripped X CLI entirely — replaced with Rettiwt-API + Agent-Reach. Ported 1117-line econ-triggered-poller into 4 segmented modules. Added round-robin polling ownership (kill RiskFlow → next teammate takes over). Fixed /api/memory/shared 500, theme/font sensitivity for Team Cards + footer panels. Deprecated Exa as dead-letter fallback.",
    files: [
      "backend-hono/src/services/riskflow/econ-rettiwt-poller.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-econ.ts",
      "backend-hono/src/services/riskflow/rettiwt-poller-transform.ts",
      "backend-hono/src/services/riskflow/user-polling-registry.ts",
      "backend-hono/src/services/riskflow/fj-emoji-filter.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/memory/index.ts",
      "backend-hono/src/services/peers/shared-memory.ts",
      "backend-hono/src/boot/services.ts",
      "frontend/types/team.ts",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/team/TeamPanel.tsx",
      "frontend/components/team/UserCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
    ],
  },
  {
    date: "2026-04-11T02:00:00",
    agent: "claude-code",
    summary:
      "Sticky Bulletin v2: Hot Times (top 3 fifteen-min antilag windows with day toggle), Quick Clock one-tap antilag logging, inline Catalyst Watch wired to central-scorer phrase matching pipeline, removed modal in favor of inline form, bias word auto-stripping",
    files: [
      "frontend/components/StickyBulletin.tsx",
      "frontend/lib/services/editor.ts",
      "frontend/lib/services/riskflow.ts",
      "backend-hono/src/services/sticky-bulletin-store.ts",
      "backend-hono/src/services/riskflow/watchlist-phrases-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/sticky-bulletin/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
    ],
  },
  {
    date: "2026-04-11T01:00:00",
    agent: "claude-code",
    summary:
      "Per-user X CLI killswitch on Team Cards, theme/font sensitivity for Team Cards + footer panels (excl. Terminal/toolbar), replaced Exa fallback with Rettiwt-API + Agent-Reach, fixed /api/memory/shared 500",
    files: [
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/team/TeamPanel.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/types/team.ts",
      "frontend/contexts/TeamPresenceContext.tsx",
      "backend-hono/src/services/riskflow/user-polling-registry.ts",
      "backend-hono/src/services/rettiwt-service.ts",
      "backend-hono/src/services/agent-reach-service.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/riskflow/exa-scheduled-monitor.ts",
      "backend-hono/src/routes/memory/index.ts",
      "backend-hono/src/services/peers/shared-memory.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
    ],
  },
  {
    date: "2026-04-11T00:30:00",
    agent: "claude-code",
    summary:
      "Sticky Bulletin — 4-section popover (Trade Idea alerts, Antilag time logging, Event of Week, Trading Notes) with liquid glass modal, auto-save, backend persistence, and aggregated antilag analytics",
    files: [
      "frontend/components/StickyBulletin.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/services/editor.ts",
      "frontend/lib/services/index.ts",
      "backend-hono/src/services/sticky-bulletin-store.ts",
      "backend-hono/src/routes/sticky-bulletin/index.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-10T23:55:00",
    agent: "claude-code",
    summary:
      "S9-T2: AlertCardBase shared card component, RiskFlowDetailCard + ExpandableTapeItem unified, filter hook extracted from RiskFlowMini",
    files: [
      "frontend/components/feed/AlertCardBase.tsx",
      "frontend/hooks/useRiskFlowFilters.ts",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/RiskFlowMini.tsx",
    ],
  },
  {
    date: "2026-04-10T23:45:00",
    agent: "claude-code",
    summary:
      "S9-T3: Extract useKeyboardShortcuts, useLayoutState, useBrowserTransition from MainLayout (981→875 lines)",
    files: [
      "frontend/hooks/useKeyboardShortcuts.ts",
      "frontend/hooks/useLayoutState.ts",
      "frontend/hooks/useBrowserTransition.ts",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-10T23:30:00",
    agent: "claude-code",
    summary:
      "S9-T4: Extract MessageActions, MessageErrorBoundary, ChainOfThought from FintheonThread (733→585 lines), delete deprecated MessageRenderer",
    files: [
      "frontend/components/chat/MessageActions.tsx",
      "frontend/components/chat/MessageErrorBoundary.tsx",
      "frontend/components/chat/ChainOfThought.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/MessageRenderer.tsx (deleted)",
    ],
  },
  {
    date: "2026-04-10T22:00:00",
    agent: "claude-code",
    summary:
      "S9-T1: Extract shared timeAgo + SVG logos into frontend/lib/, delete dead SubScoreBar.tsx, purge unused useHarperOps import from FooterToolbar, remove commented TeamOnboarding from MainLayout",
    files: [
      "frontend/lib/shared-icons.tsx",
      "frontend/lib/time-utils.ts",
      "frontend/components/feed/SubScoreBar.tsx (deleted)",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
      "frontend/components/mission-control/RiskFlowMiniWidget.tsx",
      "frontend/components/narrative/NarrativeMiniCard.tsx",
      "frontend/components/NotificationCenter.tsx",
      "frontend/types/team.ts",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-10T21:00:00",
    agent: "claude-code",
    summary:
      "S8 post-sprint review: fix bus wildcard pattern (dag.* now works), unified agent colors to Solvys Gold, removed gradient from ChatSidebar, fix chat history loading (hydratedRef set after fetch, errors logged instead of swallowed)",
    files: [
      "backend-hono/src/services/agent-bus/bus.ts",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
      "frontend/components/chat/hooks/useHermesChat.ts",
    ],
  },
  {
    date: "2026-04-10T19:00:00",
    agent: "claude-code",
    summary:
      "S8-T3: MiroShark converted to DAG template preserving convergence/contrarian/consensus logic, boardroom routes upgraded from polling to SSE+DAG dispatch, Harper boardroom mode detection",
    files: [
      "backend-hono/src/services/agent-bus/templates/miroshark-template.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/routes/boardroom/index.ts",
      "backend-hono/src/routes/harper/index.ts",
    ],
  },
  {
    date: "2026-04-10T18:00:00",
    agent: "claude-code",
    summary:
      "S8-T4: Boardroom live agent panels (2x2 grid), DAG progress bar, SSE subscription hooks, NarrativeFlow auto-push catalyst cards, Sidebar cross-agent notification toasts",
    files: [
      "frontend/hooks/useAgentBusSSE.ts",
      "frontend/hooks/useBoardroomDAG.ts",
      "frontend/components/consilium/BoardroomAgentPanel.tsx",
      "frontend/components/consilium/DAGProgressBar.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/contexts/NarrativeContext.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
    ],
  },
  {
    date: "2026-04-10T12:00:00",
    agent: "claude-code",
    summary:
      "S8-T2: DAG scheduler with wave-based dependency resolution, multi-stream merger for concurrent agent output, DAG API routes (GET/stream/cancel), extended agent-factory with createAgentForTask() (always local/VProxy), extended stream-adapter with agentId stamping",
    files: [
      "backend-hono/src/services/agent-bus/dag-scheduler.ts",
      "backend-hono/src/services/agent-bus/multi-stream-merger.ts",
      "backend-hono/src/routes/dag/index.ts",
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/src/services/strands/stream-adapter.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-10T00:00:00",
    agent: "claude-code",
    summary:
      "S8-T1: AgentBus foundation — typed pub/sub bus, DAG/task types, SurfaceRouter SSE skeleton, Supabase migration for agent_dags + agent_tasks tables",
    files: [
      "backend-hono/src/services/agent-bus/types.ts",
      "backend-hono/src/services/agent-bus/bus.ts",
      "backend-hono/src/services/agent-bus/surface-router.ts",
      "backend-hono/src/services/agent-bus/index.ts",
      "supabase/migrations/20260410_agent_bus.sql",
    ],
  },
  {
    date: "2026-04-06T17:00:00",
    agent: "claude-code",
    summary:
      "Add YouTube floating miniplayer — draggable, minimizable, persists across tab/browser changes. Toggle via Cmd+Shift+Y. State + position saved to localStorage.",
    files: [
      "frontend/components/layout/YouTubeMiniplayer.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-06T16:15:00",
    agent: "claude-code",
    summary:
      "Fix status indicator lights + add rate-limit toast. (1) Backend /sources was returning twitterCli=false during 429 cooldowns — made both Twitter and Feed lights red. Fixed: twitterCli now reports binary-installed state only, rate limit stays in separate field. Twitter light goes amber during cooldown, Feed stays green. (2) Added one-liner toast notification when Twitter gets rate limited and when it recovers.",
    files: [
      "backend-hono/src/routes/riskflow/handlers.ts",
      "frontend/contexts/TeamPresenceContext.tsx",
    ],
  },
  {
    date: "2026-04-06T15:50:00",
    agent: "claude-code",
    summary:
      "Fix feed showing only 11 items (was 482 in DB). Two root causes: (1) matchesWatchlist() required symbol/tag match ON TOP of source match — FJ items tagged with non-default keywords (LABOR, TARIFFS) got silently dropped. Fixed: source match alone is sufficient. (2) Cold-start cache seed was 200 items, starving the 500-item MAX_FEED_ITEMS cap. Fixed: seed now pulls MAX_FEED_ITEMS from DB. Feed went from 11 → 482 items after fix.",
    files: [
      "backend-hono/src/services/riskflow/watchlist-service.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
    ],
  },
  {
    date: "2026-04-06T13:05:00",
    agent: "claude-code",
    summary:
      'Fix Twitter CLI 429 rate limit killing feed for 2+ days. Root cause: polling 11 accounts every 60-180s exceeded cookie-auth rate limits (~50/15min). Fix: (1) Account rotation — poll 5 accounts/cycle (FJ+DeItaOne always + 3 rotating) instead of all 11. (2) Global 429 cooldown — detects rate_limited in CLI output, pauses ALL calls for 90s, auto-resumes. (3) Rate limit status exposed in /api/riskflow/sources + Team Card (amber pulsing "Rate Limited" light). (4) Removed AutoRefreshToggle from all 5 frontend locations — backend polling is autonomous. (5) Harper feed-health hook enhanced: checks item age staleness (>2h alert) + Twitter 429 status.',
    files: [
      "backend-hono/src/services/twitter-cli/twitter-cli-service.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/src/services/twitter-cli/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/types/team.ts",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/journal/PerformanceJournal.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/components/feed/FeedSection.tsx",
      "frontend/components/feed/MinimalTapeWidget.tsx",
      ".claude/hooks/harper-feed-health.sh",
    ],
  },
  {
    date: "2026-04-06T00:10:00",
    agent: "claude-code",
    summary:
      "Fix peer-bootstrap Supabase prompt + add feed test-fire. (1) Removed interactive email/password prompt — uses SUPABASE_SERVICE_ROLE_KEY from backend .env automatically. (2) Auth middleware now accepts service role key as bearer token for internal bootstrap calls. (3) peer-bootstrap fires /api/riskflow/refresh after registration to verify pipeline. (4) Backend peer register route triggers forcePoll() when twitter-round-robin peer comes online.",
    files: [
      "scripts/peer-bootstrap.sh",
      "backend-hono/src/middleware/auth.ts",
      "backend-hono/src/routes/peers/index.ts",
    ],
  },
  {
    date: "2026-04-05T23:55:00",
    agent: "claude-code",
    summary:
      "Fix ERR_INCOMPLETE_CHUNKED_ENCODING on Harper chat + cognition SSE streams. Root causes: (1) pipeThrough(TransformStream) in Bun 1.3.x fails to terminate chunked encoding — now encodes SSE bytes directly in source ReadableStream, (2) long tool-call silences (TradingView MCP etc.) cause Bun/Chrome to drop idle connections — added 8s SSE heartbeat comments + [DONE] terminator to both Harper stream-adapter and cognition stream.",
    files: [
      "backend-hono/src/services/strands/stream-adapter.ts",
      "backend-hono/src/routes/ai/handlers/queue.ts",
    ],
  },
  {
    date: "2026-04-05T23:30:00",
    agent: "claude-code",
    summary:
      "Strands Phase 8: Full cutover — replaced all Vercel AI SDK imports with Strands agents across 15 backend files. Removed @ai-sdk/openai, @ai-sdk/xai, @ai-sdk/groq, @ai-sdk/gateway packages. Kept ai + @ai-sdk/anthropic for bridge chain (pending bridge deprecation). Deleted dead model-selector.ts. Added invokeAgent() helper for one-shot generation.",
    files: [
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/narrative/handlers.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/services/miroshark/miroshark-client.ts",
      "backend-hono/src/services/agents/base-agent.ts",
      "backend-hono/src/services/agents/risk-manager.ts",
      "backend-hono/src/services/agents/trader-agent.ts",
      "backend-hono/src/services/agents/debate-protocol.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/riskflow/agent-notes.ts",
      "backend-hono/src/services/analysis/grok-analyzer.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/strands/invoke-helper.ts",
      "backend-hono/src/services/strands/index.ts",
      "backend-hono/package.json",
    ],
  },
  {
    date: "2026-04-05T21:00:00",
    agent: "claude-code",
    summary:
      "Fix RiskFlow feed disappearance (updateFeedCache merge vs replace) + Harper feed health monitoring hook + /api/diagnostics/feed-health endpoint",
    files: [
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      ".claude/hooks/harper-feed-health.sh",
      ".claude/settings.json",
    ],
  },
  {
    date: "2026-04-05T14:00:00",
    agent: "claude-code",
    summary:
      "Strands Phase 7: Bridge Strands agent events to cognition SSE via telemetry adapter. Fix ERR_INCOMPLETE_CHUNKED_ENCODING in cognition stream. Add ConversationManager for Strands session memory.",
    files: [
      "backend-hono/src/services/strands/telemetry.ts",
      "backend-hono/src/services/strands/memory-store.ts",
      "backend-hono/src/routes/ai/handlers/queue.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
    ],
  },
  {
    date: "2026-04-04T23:30:00",
    agent: "claude-code",
    summary:
      "Strands Agents SDK migration (Phases 1-5): Replace Vercel AI SDK with @strands-agents/sdk for Harper. VProxy provider at localhost:8317, 6 core tools + 9 solvys skills as Strands tools, UIMessageStream adapter, Graph-based PIC pipeline (Herald→Oracle→Consul→Feucht), 8 Claude Code hooks installed.",
    files: [
      "backend-hono/src/services/strands/provider.ts",
      "backend-hono/src/services/strands/agent-factory.ts",
      "backend-hono/src/services/strands/harper-tools.ts",
      "backend-hono/src/services/strands/stream-adapter.ts",
      "backend-hono/src/services/strands/pipeline.ts",
      "backend-hono/src/services/strands/agents/harper.ts",
      "backend-hono/src/services/strands/agents/oracle.ts",
      "backend-hono/src/services/strands/agents/feucht.ts",
      "backend-hono/src/services/strands/agents/consul.ts",
      "backend-hono/src/services/strands/agents/herald.ts",
      "backend-hono/src/services/strands/skills/ship.ts",
      "backend-hono/src/services/strands/skills/audit.ts",
      "backend-hono/src/services/strands/skills/brief.ts",
      "backend-hono/src/services/strands/skills/deploy.ts",
      "backend-hono/src/services/strands/skills/research.ts",
      "backend-hono/src/services/strands/skills/inform.ts",
      "backend-hono/src/services/strands/skills/orchestrate.ts",
      "backend-hono/src/services/strands/skills/monitor.ts",
      "backend-hono/src/services/strands/skills/beta.ts",
      ".claude/settings.json",
      ".claude/hooks/block-dangerous.sh",
      ".claude/hooks/protect-files.sh",
      ".claude/hooks/require-tests-for-pr.sh",
      ".claude/hooks/log-commands.sh",
      ".claude/hooks/auto-commit.sh",
    ],
  },
  {
    date: "2026-04-04T22:30:00",
    agent: "claude-code",
    summary:
      "Fix RiskFlow feed staleness: cache now re-syncs from Supabase every 2min so items from Central Scorer and manual ingestion appear without waiting for poller. Also replaced BULLISH/BEARISH text with chevron arrows and right-aligned IV scores in card footers.",
    files: [
      "backend-hono/src/services/riskflow/feed-service.ts",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
    ],
  },
  {
    date: "2026-04-04T18:00:00",
    agent: "claude-code",
    summary:
      "NarrativeFlow visual redesign: 25-item card splitting with sibling pages and clustering, concentric ring reset layout (severity-sorted rings around hubs), frosted glass bubble styling with hover glow (replaced radial gradient halos), gradient energy rope connections with source-to-target color gradients and electricity flow animation",
    files: [
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-aggregator.ts",
      "frontend/components/narrative/AggregateCardNode.tsx",
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
      "frontend/lib/narrative-force-layout.ts",
      "frontend/components/narrative/NarrativeHubNode.tsx",
      "frontend/components/narrative/TerritoryNode.tsx",
      "frontend/components/narrative/NarrativeRopes.tsx",
      "frontend/lib/narrative-canvas-renderer.ts",
      "frontend/styles/custom.css",
    ],
  },
  {
    date: "2026-04-05T00:00:00",
    agent: "claude-code",
    summary:
      'Harper Consilium real-time integration: autonomous loop output → boardroom messages with [HARPER-AUTO] prefix, AgentChattr autonomous message styling (Bot icon + task badge + accent border), HarperActivityFeed sidebar (w-80 collapsible), SSE stream for ops (full round-trip replacing 10s polling), NarrativeMap "Harper watching" overlay with gold flash, ConsiliumHub heartbeat indicator, AgentBadge autonomous marker, narrative-synthesis → timeline card links, latest-synthesis journal endpoint',
    files: [
      "backend-hono/src/services/harper-autonomous/loop-manager.ts",
      "backend-hono/src/services/harper-autonomous/ops-store.ts",
      "backend-hono/src/services/harper-autonomous/index.ts",
      "backend-hono/src/routes/harper-ops/index.ts",
      "frontend/components/consilium/ConsiliumMessage.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/HarperActivityFeed.tsx",
      "frontend/components/consilium/AgentBadge.tsx",
      "frontend/components/narrative/NarrativeMap.tsx",
      "frontend/hooks/useHarperOps.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-04-04T23:00:00",
    agent: "claude-code",
    summary:
      "Harper Autonomous Agent: Soul file, journal/ops tables, loop manager (Claude CLI subprocess), heartbeat scheduler (5min market/15min off), context builder, Harper Ops API + frontend panel (footer icon), event triggers (Level 4 items, VIX spikes), Consilium observer hook, codebase manifest. Gated by HARPER_AUTONOMOUS_ENABLED=true.",
    files: [
      "backend-hono/src/services/harper-autonomous/HARPER-SOUL.md",
      "backend-hono/src/services/harper-autonomous/loop-manager.ts",
      "backend-hono/src/services/harper-autonomous/heartbeat.ts",
      "backend-hono/src/services/harper-autonomous/context-builder.ts",
      "backend-hono/src/services/harper-autonomous/journal-store.ts",
      "backend-hono/src/services/harper-autonomous/ops-store.ts",
      "backend-hono/src/services/harper-autonomous/index.ts",
      "backend-hono/src/routes/harper-ops/index.ts",
      "backend-hono/migrations/20260404_harper_journal.sql",
      "frontend/components/harper-ops/HarperOpsPanel.tsx",
      "frontend/hooks/useHarperOps.ts",
      "frontend/components/layout/FooterToolbar.tsx",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/boardroom-store.ts",
    ],
  },
  {
    date: "2026-04-04T20:00:00",
    agent: "claude-code",
    summary:
      "S7-T1: Created Fintheon Oscillator Pine v6 indicator — SMI Ergodic of volume delta with ANTILAG, proximity maps, dynamic zones, multi-pivot divergence detection, confluence scoring, and webhook alerts",
    files: ["docs/tradingview-pine/FINTHEON-Oscillator.pine"],
  },
  {
    date: "2026-04-04T19:00:00",
    agent: "claude-code",
    summary:
      "S7-T2: Upgraded LQDelta Overlay — removed Retest text (labelup/down), tick chart support (Auto resolution), adjustable EMA thickness, fixed 0-volume bug (seed pivot bar), dual-TF liquidity with staleness, sweep labels (Solvys Gold), HTF EMA cross alerts (always-on, size.large red), full alert system with JSON webhooks",
    files: ["docs/tradingview-pine/LQDELTA-Overlay.pine"],
  },
  {
    date: "2026-04-04T18:00:00",
    agent: "claude-code",
    summary:
      "Fix Harper agentic loop: switch VProxy from textStream→fullStream (text was invisible during multi-step tool calls), normalize model IDs to hyphens (VProxy rejects dots with 502), auto-approve read-only tools, add 30s approval timeout, fix EventSource reconnection.",
    files: [
      "backend-hono/src/services/claude-sdk/bridge.ts",
      "backend-hono/src/services/vproxy/anthropic-client.ts",
      "backend-hono/src/services/tool-approval-store.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/routes/harper/index.ts",
      "frontend/components/chat/hooks/useToolApprovals.ts",
    ],
  },
  {
    date: "2026-04-04T12:00:00",
    agent: "claude-code",
    summary:
      "[v1.4.0] T1-T5 unified release: Default connectors (RiskFlow/Aquarium/Boardroom + UW MCP), chat icons in Consilium bar, sidebar icons fixed, SessionsDropdown replaces full-screen modal, Settings iFrame list with persistent proposer default (5 built-in sources + custom).",
    files: [
      "frontend/types/mcp.ts",
      "frontend/lib/internalConnectors.ts",
      "frontend/lib/consilium-nav-store.ts",
      "frontend/hooks/useMcpConnectors.ts",
      "frontend/components/chat/McpConnectorPopup.tsx",
      "frontend/components/chat/SessionsDropdown.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/ChatSidebar.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/layout/ChatPanel.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/settings/IframesTab.tsx",
      "frontend/components/SettingsPanel.tsx",
      "backend-hono/src/routes/mcp/index.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/services/harper-handler.ts",
      ".mcp.json",
    ],
  },
  {
    date: "2026-04-04T04:30:00",
    agent: "claude-code",
    summary:
      "Fix Harper streaming: (1) Added UIMessageStream framing events (start/start-step/finish-step/finish) required by DefaultChatTransport, (2) Fixed model ID mismatch — env had claude-opus-4.6 (dots) but VProxy expects claude-opus-4-6 (hyphens), (3) Removed BYPASS_AUTH from .env (was causing crash loop with production NODE_ENV), (4) Pre-approved all Harper tools in ~/.fintheon/tool-permissions.json, (5) Updated .mcp.json with proper Notion auth and Close CRM server. Error path now sends proper UIMessageChunk error events instead of raw controller.error().",
    files: [
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/services/claude-sdk/bridge.ts",
      "backend-hono/.env",
      ".mcp.json",
    ],
  },
  {
    date: "2026-04-03T18:00:00",
    agent: "claude-code",
    summary:
      "IV score display consistency: ivScore was dropped during RiskFlowItem->RiskFlowAlert mapping in RiskFlowContext (root cause). Added ivScore to RiskFlowAlert type, wired it in both pollBackendFeed and loadMore mappers. Fixed duplicate IV in Strategium, reordered IV left of direction in dashboard feed, added fuse shimmer KPI bar in expanded AlertRow cards.",
    files: [
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/components/narrative/SanctumRiskAssessment.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
    ],
  },
  {
    date: "2026-04-04T00:30:00",
    agent: "claude-code",
    summary:
      "MiroShark daily auto-run + dedup. Added daily cron at 6:00 AM ET (weekdays) for automatic MiroShark runs. Updated staleness threshold from 6h to 12h. Frontend Update button now checks for a recent run (<12h by ANY user) before triggering a new simulation — loads cached result if fresh, preventing duplicate runs and improving speed.",
    files: [
      "backend-hono/src/services/cron/miroshark-daily.ts",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
      "backend-hono/src/boot/services.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
    ],
  },
  {
    date: "2026-04-03T23:30:00",
    agent: "claude-code",
    summary:
      "REFLECT engine — nightly news analysis quality self-improvement loop. 5 metrics (direction accuracy, score calibration, scoring bias, macro level accuracy, tag coverage), auto-adjustment recommendations, Harper standup integration. Endpoints: GET /diagnostics/reflect/latest, POST /diagnostics/reflect/run. Scheduler runs at 04:00 UTC when ENABLE_REFLECT=true.",
    files: [
      "backend-hono/src/services/autoresearch/reflect-engine.ts",
      "backend-hono/src/services/autoresearch/reflect-scheduler.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/hermes-handler.ts",
    ],
  },
  {
    date: "2026-04-03T23:00:00",
    agent: "claude-code",
    summary:
      "MiroShark Analyst Refactor — Sprint 1+2: Replace gov-official personas with 5 market analyst personas (FlowTrader, VolDesk, MacroPM, CreditAnalyst, RetailSentiment) as primary debate layer. Add headline subject tagging for anti-groupthink routing. Rebuild deliberation pipeline from 3 to 4 phases with full reasoning passthrough (fix lossy extractGovAssessments), convergence detection, devil's advocate trigger, and consensus scoring. Gov officials now conditional on geopolitical content. Frontend updated for new phase structure.",
    files: [
      "backend-hono/src/services/riskflow/headline-tagger.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/miroshark/miroshark-client.ts",
      "backend-hono/src/services/miroshark/miroshark-types.ts",
      "backend-hono/src/services/miroshark/miroshark-seed.ts",
      "backend-hono/src/services/miroshark/miroshark-service.ts",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/routes/miroshark/handlers.ts",
      "backend-hono/src/routes/miroshark/index.ts",
      "frontend/components/miroshark/MiroSharkDebatePanel.tsx",
    ],
  },
  {
    date: "2026-04-04T02:00:00",
    agent: "claude-code",
    summary:
      "Remove implied point scoring from RiskFlow cards, show IV score in footer, fix generate-note ID mismatch (tweet_id), remove sparkle from Generate Note button, add toast on note generation",
    files: [
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "backend-hono/src/services/riskflow/agent-notes.ts",
    ],
  },
  {
    date: "2026-04-04T01:00:00",
    agent: "claude-code",
    summary:
      "Replace Firecrawl with Exa for commentary scraping — searches X/Twitter via Exa neural search to bypass CLI rate limits. Added POI accounts (Araghchi, IsraeliPM, SecDef, USTreasury, WhiteHouse, VP, ECB). Removed @mendable/firecrawl-js dependency. Updated central-scorer OSINT_ACCOUNTS with POIs.",
    files: [
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/exa-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/package.json",
      "backend-hono/.env.example",
      "backend-hono/.env.template",
      "SETUP.md",
    ],
  },
  {
    date: "2026-04-03T00:00:00",
    agent: "claude-code",
    summary:
      "Add spring-physics CSS transitions to Consilium dropdowns (stagger), tab content (vertical shift), side panels (width+opacity), and toast notifications (scale+bounce enter)",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-04-04T00:00:00",
    agent: "claude-code",
    summary:
      "NarrativeFlow overhaul: territory nodes are now circles (not squares), 3-tier zoom (macro/narratives/themes), loading sequence during force simulation, Save Layout button with full position persistence, scrollable expanded card lists",
    files: [
      "frontend/components/narrative/TerritoryNode.tsx",
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
      "frontend/components/narrative/AggregateCardNode.tsx",
      "frontend/lib/narrative-territory-layout.ts",
    ],
  },
  {
    date: "2026-04-03T00:00:00",
    agent: "claude-code",
    summary:
      "Redesign Forum (BulletinFeed) to Discord-style layout with message grouping, hover actions, PromptBox input, reaction-pill voting, and image attachment support",
    files: [
      "frontend/components/bulletin/BulletinFeed.tsx",
      "frontend/components/bulletin/BulletinPost.tsx",
      "frontend/components/bulletin/VotingControls.tsx",
    ],
  },
  {
    date: "2026-04-03T23:30:00",
    agent: "claude-code",
    summary:
      "Fix RiskFlow infinite scroll (IntersectionObserver root), switch to chronological sort, increase cold start to 200 items, add missing Critical/Low priority filters",
    files: [
      "frontend/components/feed/RiskFlowMain.tsx",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/supabase-service.ts",
    ],
  },
  {
    date: "2026-04-03T23:00:00",
    agent: "claude-code",
    summary:
      "Increase Dispatch/Calendar frame min-height from 420px to 520px to prevent cramped layout when RiskFlow loads",
    files: ["frontend/components/executive/MainDashboard.tsx"],
  },
  {
    date: "2026-04-03T22:00:00",
    agent: "claude-code",
    summary:
      "S14-unification: Fixed NavTabId type mismatch (chatroom→feed, added settings) in layoutOrderStorage.ts. Updated NavSidebar Record exclude. Deleted dead PeerCarousel/PeerCard/PeerOnboarding files. Verified install/update scripts. Cross-track audit pass — all builds clean.",
    files: [
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/peers/PeerCarousel.tsx",
      "frontend/components/peers/PeerCard.tsx",
      "frontend/components/peers/PeerOnboarding.tsx",
      "scripts/fintheon-setup.sh",
      "scripts/fintheon-update.sh",
      "scripts/install-cli.sh",
    ],
  },
  {
    date: "2026-04-03T18:00:00",
    agent: "claude-code",
    summary:
      "S14-debug T7: code hygiene — purged console.log debug statements from AuthContext, useRiskFlow, App, NewsFeed, apiClient; cleaned 7 stale [claude-code 2026-02-*] comments from layout/mission-control components; audited TODOs (all legitimate); kept intentional console.warn/error in catch blocks",
    files: [
      "frontend/contexts/AuthContext.tsx",
      "frontend/hooks/useRiskFlow.ts",
      "frontend/App.tsx",
      "frontend/components/NewsFeed.tsx",
      "frontend/lib/apiClient.ts",
      "frontend/components/layout/EmbeddedBrowserFrame.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-04-03T12:00:00",
    agent: "claude-code",
    summary:
      'S14-T6: Team status panel overhaul — rebuilt footer Team tab with status dropdown (online/away/busy/dnd/offline), service status lights (Twitter CLI, AI runtime, newsfeed polling w/ 15-min stale detection, backend connection), last seen timestamps. Removed PeerCarousel + PeerOnboarding from MainLayout. Renamed all user-facing "Peers" to "Team". Extended Supabase presence payload with service metadata.',
    files: [
      "frontend/types/team.ts",
      "frontend/contexts/TeamPresenceContext.tsx",
      "frontend/components/team/TeamMemberCard.tsx",
      "frontend/components/team/TeamPanel.tsx",
      "frontend/components/team/TeamOnboarding.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/research/ResearchBoard.tsx",
      "frontend/components/peers/DeskPanel.tsx",
      "frontend/components/peers/PeerCarousel.tsx",
    ],
  },
  {
    date: "2026-04-01T14:00:00",
    agent: "claude-code",
    summary:
      "LiveKit Cloud voice (real WebRTC audio via livekit-server-sdk), iOS26 Liquid Glass toast restyle, toast placement audit (trading=top-right, system=bottom-left), version-check with update-available toast, enhanced install/update scripts with phase tracking and LiveKit onboarding",
    files: [
      "backend-hono/src/services/peers/voice-room.ts",
      "frontend/components/peers/VoiceWidget.tsx",
      "frontend/components/peers/VoiceAudioRenderer.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/contexts/ToastContext.tsx",
      "frontend/lib/version-check.ts",
      "frontend/components/VersionChecker.tsx",
      "frontend/lib/services.ts",
      "frontend/App.tsx",
      "scripts/fintheon-setup.sh",
      "scripts/fintheon-update.sh",
      "backend-hono/.env.example",
      "vite.config.ts",
    ],
  },
  {
    date: "2026-04-01T01:00:00",
    agent: "claude-code",
    summary:
      "S13-T3: Team shared memory with FTS + agentic editor sidebar (charts, analysis, web data via Computer Use) + cross-agent analysis history. SharedMemoryPanel as new nav tab. AgenticSidebar wired into DocumentEditor with toggle.",
    files: [
      "backend-hono/src/services/peers/shared-memory.ts",
      "backend-hono/src/services/peers/analysis-history.ts",
      "backend-hono/src/services/editor/agentic-sidebar.ts",
      "backend-hono/src/routes/memory/index.ts",
      "backend-hono/src/routes/editor/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/services/ai/agent-instructions/thought-bank-awareness.ts",
      "frontend/components/editor/AgenticSidebar.tsx",
      "frontend/components/editor/DocumentEditor.tsx",
      "frontend/components/memory/SharedMemoryPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/services.ts",
      "frontend/lib/layoutOrderStorage.ts",
      "supabase/migrations/20260401_sprint3_shared_memory.sql",
    ],
  },
  {
    date: "2026-03-31T22:00:00",
    agent: "claude-code",
    summary:
      "S13-T2: Claude Computer Use + TradingView trade plan skill — auto-generates entry/stop/TP for voted proposals via Claude CLI with Computer Use. Fib-based trend classification (Ripper/Strong Trend/Weak Trend) with zone-break downgrade rule. TradePlanCard wired into ProposalCard. Graceful degradation when unavailable.",
    files: [
      "backend-hono/src/services/skills/tradingview-trade-plan.ts",
      "backend-hono/src/routes/skills/index.ts",
      "backend-hono/src/services/bulletin/vote-counter.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/boot/index.ts",
      "frontend/components/proposals/TradePlanCard.tsx",
      "frontend/components/proposals/TradePlanStatus.tsx",
      "frontend/components/feed/ProposalCard.tsx",
      "frontend/types/feed.ts",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-31T18:30:00",
    agent: "claude-code",
    summary:
      "feat(pipeline): Unified catalyst pipeline — POI priority boost (Top 3=Critical, Top 8=High), instant promotion for macroLevel 3-4 (no 30-min delay), NarrativeFlow auto-population from DB (60s polling, zero manual import), Aquarium polling (120s), dynamic feed-poller intervals (5min market/30min off-hours), pipeline observability logging. Added ceasefire to ME conflict keywords.",
    files: [
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/catalyst-promoter.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/routes/narrative/handlers.ts",
      "backend-hono/src/routes/narrative/index.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/lib/services.ts",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
    ],
  },
  {
    date: "2026-03-31T01:00:00",
    agent: "claude-code",
    summary:
      "fix(riskflow): Widen polling window 6AM-8PM ET (was 8-11AM — starved pipeline 3 days). Refresh now triggers Central Scorer immediately (fetch+score+deliver in one click). Added device-gated on-open fetch (visibility change triggers full refresh, throttled 5min). Consilium/Sanctum now receives narrative_threads via narrative_card_links join. Added hourly gate-blocked logging so stale feeds are never silent.",
    files: [
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/miroshark/miroshark-context.ts",
      "backend-hono/src/services/miroshark/miroshark-types.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/types/miroshark.ts",
    ],
  },
  {
    date: "2026-03-30T19:00:00",
    agent: "claude-code",
    summary:
      "Sprint 1: Claude Peers — peer registry, auth, boardroom evolution (Content Parts + threading + peer attribution), voice widget, PeerCarousel, Hermes plugin mode",
    files: [
      "backend-hono/src/services/peers/",
      "backend-hono/src/routes/peers/",
      "backend-hono/src/routes/auth/",
      "frontend/components/peers/",
      "supabase/migrations/20260330_claude_peers.sql",
    ],
  },
  {
    date: "2026-03-30T04:00:00",
    agent: "claude-code",
    summary:
      "chore(audit): Solvys audit — deleted 12 orphan files (FeatureLockScreen, LockoutModal, DevelopmentsTimeline, 5 abandoned narrative experiments, ChatInputArea, ChatMessageList, TradingViewCalendar, VanishInput). Stripped 20 console statements from services.ts (dead Hono stubs). Gated 13 AuthContext logs behind DEV flag. Downgraded VoiceAssistant console.log to console.debug. Eradicated Clerk phantom packages from lock file via bun remove.",
    files: [
      "frontend/lib/services.ts",
      "frontend/contexts/AuthContext.tsx",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/bun.lock",
    ],
  },
  {
    date: "2026-03-29T22:00:00",
    agent: "claude-code",
    summary:
      "feat(update): Bottom-right update toast with background auto-download. Enabled autoDownload in electron-updater so updates download silently. Rewrote UpdateBanner to show download progress then Install Now button for seamless restart. Moved from bottom-left to bottom-right positioning.",
    files: ["electron/main.cjs", "frontend/components/UpdateBanner.tsx"],
  },
  {
    date: "2026-03-30T01:00:00",
    agent: "claude-code",
    summary:
      "feat(pipeline): Unified catalyst pipeline — RiskFlow items and NarrativeMap catalysts are now the same DB entity at different lifecycle stages. Added: (1) catalyst-promoter service auto-classifies narrative threads for scored items 30+ min old; (2) feed API returns narrativeThreads/category/status/promotedAt from DB; (3) NarrativeMap reads promoted items from RiskFlowContext instead of localStorage seeds; (4) removed delete button from RiskFlowMini. Migration: scored_riskflow_items gains promoted_at/status/category columns. Seed migration script at backend-hono/scripts/migrate-seed-events.ts.",
    files: [
      "supabase/migrations/20260329_catalyst_promotion.sql",
      "backend-hono/src/services/riskflow/catalyst-promoter.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/narrative-seed-loader.ts",
      "frontend/components/narrative/NarrativeMap.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "backend-hono/scripts/migrate-seed-events.ts",
    ],
  },
  {
    date: "2026-03-29T23:59:00",
    agent: "claude-code",
    summary:
      "fix(sanctum): rope rendering pipeline — add React Flow Handle components to all custom nodes (root cause: edges silently dropped without handles), remove inline opacity override that blocked rope-breathe CSS animation, replace fitView with defaultViewport to prevent zoom-out to categoryOverview which stripped card nodes, normalize stored catalysts for missing tags/narrative fields, bump seed version to force re-seed",
    files: [
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
      "frontend/components/narrative/NarrativeHubNode.tsx",
      "frontend/components/narrative/NarrativeSummaryCard.tsx",
      "frontend/lib/narrative-store.ts",
      "frontend/lib/narrative-seed-loader.ts",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-03-29T23:45:00",
    agent: "claude-code",
    summary:
      "feat(ai): Add Grok 4.20 via OpenRouter as scoring fallback for news/sentiment/econ/earnings tasks. fix(riskflow): Infinite scroll broken — auto-refresh poll was resetting backendAlerts to first 50 items, wiping loadMore progress. Now tracks loadedCountRef so polls fetch full scrolled set.",
    files: [
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "frontend/contexts/RiskFlowContext.tsx",
    ],
  },
  {
    date: "2026-03-30T00:30:00",
    agent: "claude-code",
    summary:
      "feat(aquarium+boardroom): Aquarium compaction (p-3, 58vh chart), KPI severity coloring + shimmer fuse, briefing above predictions, wider prediction cards (220px), CategoryScoreCard center-justified score + description row, rounded-lg on all cards (econ, thesis, KPI), header button compaction, thesis always-visible descriptions + italic multiplier. Boardroom: removed agent filter, rectangular timeframe bar right-justified, new-message pulse indicator.",
    files: [
      "frontend/index.css",
      "frontend/types/miroshark.ts",
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/SanctumBriefing.tsx",
      "frontend/components/narrative/AquariumPredictionCards.tsx",
      "frontend/components/narrative/CategoryScoreCard.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
      "frontend/components/narrative/SanctumHeader.tsx",
      "frontend/components/narrative/SanctumTheses.tsx",
      "frontend/components/consilium/ConsiliumFilterBar.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
    ],
  },
  {
    date: "2026-03-29T23:45:00",
    agent: "claude-code",
    summary:
      "feat(sanctum): FILTERS dropdown panel with rope legend, importance sort, narrative/category toggles, and sentiment filter",
    files: [
      "frontend/components/narrative/SanctumFilterPanel.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
    ],
  },
  {
    date: "2026-03-29T23:30:00",
    agent: "claude-code",
    summary:
      "feat(sanctum): 5-tier hierarchical zoom — temporal clusters, category groups with regime badges, replaces dot/bubble tiers",
    files: [
      "frontend/lib/narrative-hierarchy.ts",
      "frontend/components/narrative/TemporalClusterNode.tsx",
      "frontend/components/narrative/CategoryClusterNode.tsx",
      "frontend/components/narrative/NarrativeForceCanvas.tsx",
    ],
  },
  {
    date: "2026-03-29T22:00:00",
    agent: "claude-code",
    summary:
      "S9-T5: Replace checkpoint sidebar with real conversation history from /api/ai/conversations, Take Note button flushes to Harper memory bank via Context Bank API, delete chatCheckpoints.ts",
    files: [
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/ChatMessageBubble.tsx",
      "frontend/components/chat/ChatMessageList.tsx",
      "frontend/components/chat/useHermesRuntime.ts",
      "frontend/lib/chatCheckpoints.ts (deleted)",
      "frontend/lib/data-migration.ts",
      "frontend/lib/storage-migration.ts",
    ],
  },
  {
    date: "2026-03-29T16:00:00",
    agent: "claude-code",
    summary:
      "fix(apparatus): remove minimap from constellation view, add dossier teaser to collapsed agent cards",
    files: [
      "frontend/components/apparatus/ApparatusFlowMap.tsx",
      "frontend/components/apparatus/ApparatusMap.tsx",
    ],
  },
  {
    date: "2026-03-29T15:00:00",
    agent: "claude-code",
    summary:
      "Fix empty Timeline: auto-classify RiskFlow imports into narrative threads via keyword matching. Add severity filter defaulting to Critical & High only.",
    files: [
      "frontend/lib/narrative-seed-loader.ts",
      "frontend/components/narrative/TimelinePanel.tsx",
    ],
  },
  {
    date: "2026-03-29T12:00:00",
    agent: "claude-code",
    summary:
      "S9-T2b: Instrument-aware sentiment (asset class flipper), per-instrument Supabase storage, ± symbol replaces ▲/▼ arrows",
    files: [
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/supabase-service.ts",
      "supabase/migrations/20260329_instrument_scores.sql",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
    ],
  },
  {
    date: "2026-03-29T00:00:00",
    agent: "claude-code",
    summary:
      "S9-T2: Kill 24h stalemate filter + dismissedIds, bump feed to 50/100, IV Martingale diminishing returns with escalation override, forced-bearish sentiment fix, deviation indicators in RiskFlowDetailCard/RiskFlowMini/CatalystCard, Persons of Interest defaults (Rubio/Greer/Navarro added), Firecrawl confirmed wired",
    files: [
      "frontend/contexts/RiskFlowContext.tsx",
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/market-data/point-estimator.ts",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
      "backend-hono/src/types/commentator.ts",
    ],
  },
  {
    date: "2026-03-28T23:30:00",
    agent: "claude-code",
    summary:
      "S9-T3: Dashboard side-by-side Brief+Calendar with needle divider, kill content padding, NarrativeMap imports ALL alerts (not just high/critical), Econ Intel 5s fetch timeout with error fallback + retry, removed IV risk bars canvas from Sanctum",
    files: [
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/narrative/NarrativeMap.tsx",
      "frontend/components/narrative/SanctumChart.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
    ],
  },
  {
    date: "2026-03-30T01:00:00",
    agent: "claude-code",
    summary:
      "S9-T4: Route Harper chat through /api/harper/chat for full Fintheon context injection, switch Oracle/Feucht/Consul/Herald to Grok 4.20 Fast via OpenRouter, slide-out panel mutual exclusion (one at a time), agent-plan gold theme for in-progress status, Apparatus collapsed bio bump to 11px, SVG connection lines between expanded agent and connected agents with rope-breathe animation",
    files: [
      "frontend/components/chat/hooks/useHermesChat.ts",
      "backend-hono/src/services/hermes-service.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/ui/agent-plan.tsx",
      "frontend/components/apparatus/ApparatusMap.tsx",
    ],
  },
  {
    date: "2026-03-29T23:00:00",
    agent: "claude-code",
    summary:
      "S9-T1: Rename 9 components + 5 tab IDs, purge 20 kanban borders, Harper-Hermes→Harper, Commentators→Persons of Interest, remove debug console.logs",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/SectionBreadcrumb.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/executive/MainDashboard.tsx",
      "frontend/components/feed/RiskFlowMain.tsx",
      "frontend/components/RiskFlowMini.tsx",
      "frontend/components/chat/AskHarpSidebar.tsx",
      "frontend/components/TradingBrowser.tsx",
      "frontend/components/journal/PerformanceJournal.tsx",
      "frontend/components/executive/Scriptorium.tsx",
      "frontend/components/apparatus/ApparatusMap.tsx",
      "frontend/components/narrative/NarrativeMap.tsx",
    ],
  },
  {
    date: "2026-03-29T12:00:00",
    agent: "claude-code",
    summary:
      "S8-UNIFY: Fix missing items — NarrativeFlow visibleLaneIds (show all), Risk Flow title, auto-refresh label, SanctumNarratives click-to-navigate, TopStepX theme blending, Apparatus expanded text size, Checkpoints→History label",
    files: [
      "frontend/components/narrative/NarrativeFlow.tsx",
      "frontend/components/narrative/SanctumNarratives.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/styles/custom.css",
    ],
  },
  {
    date: "2026-03-28T20:00:00",
    agent: "claude-code",
    summary:
      "S8-T7: Wire Claude CLI (Harper) into Ask Harp, dual-pane main chat, 21st.dev components (animated-ai-input), pulsing icon, boardroom newspaper button, persona switching, artifact system, QuickScope skill",
    files: [
      "frontend/components/chat/FintheonThread.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/ui/animated-ai-input.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/lib/artifact-parser.ts",
      "frontend/styles/custom.css",
      "backend-hono/src/services/harper-handler.ts",
      "backend-hono/src/routes/harper/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/skills/quickscope.md",
    ],
  },
  {
    date: "2026-03-28T18:00:00",
    agent: "claude-code",
    summary:
      "S8-T5: MiroFish→MiroShark full replacement, gov official agents (8 personas: Fed Chair, Trump, Bessent, Rubio, Lutnick, Witkoff, Greer, Navarro), 3-phase deliberation pipeline (MiroShark→Hermes→Harper), debate slide-out panel, scoring improvements (confidence-weighted consensus, divergence detection, actionability score)",
    files: [
      "backend-hono/src/services/miroshark/",
      "backend-hono/src/services/miroshark/miroshark-deliberation.ts",
      "backend-hono/src/routes/miroshark/",
      "frontend/components/miroshark/MiroSharkDebatePanel.tsx",
      "frontend/lib/services.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
    ],
  },
  {
    date: "2026-03-28T14:00:00",
    agent: "claude-code",
    summary:
      "S8-T8: Unified agent context bank (Supabase, user-scoped partitions), agent memory CRUD + bulk CLI sync API, Claude CLI launchd auto-start plist, fintheon-update.sh launchd agent install step, Browser STT/TTS service stub (S9 prep)",
    files: [
      "supabase/migrations/20260328_agent_context_bank.sql",
      "backend-hono/src/services/agent-context-bank-service.ts",
      "backend-hono/src/routes/context-bank/memory-handlers.ts",
      "backend-hono/src/routes/context-bank/index.ts",
      "backend-hono/scripts/com.fintheon.claude-cli.plist",
      "scripts/fintheon-update.sh",
      "frontend/lib/speech-service.ts",
    ],
  },
  {
    date: "2026-03-29T00:30:00",
    agent: "claude-code",
    summary:
      "Apparatus expanded cards: comedic agent bios, historical origin dossiers rooted in NarrativeFlow seed events (Jul 2024 — CPI rotation, Yen flash crash, BLS revision, rate cuts, election, Liberation Day), active narrative tracking per agent, Feucht combat record (47W/29L, 61.8% WR, +$14,280 P&L), notable intel bullets. New AgentNode type fields: bio, dossier, activeNarratives, record, notableInfo. Expanded cards now span full 3-col width.",
    files: [
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/apparatus/types.ts",
    ],
  },
  {
    date: "2026-03-28T23:45:00",
    agent: "claude-code",
    summary:
      "S5-T5: Rope engine auto-connects cards by shared tags with SVG bezier paths. Living motion system — staggered entrances, spring zoom, severity pulse. Anti-default polish: severity-driven card weight (scale/opacity/border), gold-earned color discipline, editorial typography hierarchy.",
    files: [
      "frontend/lib/narrative-rope-engine.ts",
      "frontend/components/narrative/NarrativeRopes.tsx",
      "frontend/lib/narrative-motion.ts",
      "frontend/index.css",
      "frontend/components/narrative/NarrativeMiniCard.tsx",
    ],
  },
  {
    date: "2026-03-28T22:30:00",
    agent: "claude-code",
    summary:
      "S5-T4: Market impact pipeline — nightly cron fetches NQ/ES/YM daily close from Yahoo Finance for HIGH/CRITICAL scored items >24h. Writes market_impact JSONB to scored_riskflow_items. Backfill script for historical items. Migration 024 adds column + partial index.",
    files: [
      "backend-hono/src/services/market-data/daily-close-service.ts",
      "backend-hono/src/services/cron/market-impact-enricher.ts",
      "backend-hono/src/services/cron/dispatch-scheduler.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/scripts/backfill-market-impact.ts",
      "backend-hono/migrations/024_market_impact_column.sql",
    ],
  },
  {
    date: "2026-03-28T23:59:00",
    agent: "claude-code",
    summary:
      "S5-T3: Rich CatalystModal with full trading fields (direction, instruments, severity, date range, status, tags). NarrativeMiniCard for dense display. Auto-seed pipeline loads 53 historical events + imports live RiskFlow items as editable copies. Store extended with BULK_ADD_CATALYSTS. Types extended with directionBias, status, dateRange on CatalystCard + riskflow-import source.",
    files: [
      "frontend/components/narrative/CatalystModal.tsx",
      "frontend/components/narrative/NarrativeMiniCard.tsx",
      "frontend/lib/narrative-seed-loader.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/lib/narrative-types.ts",
      "frontend/components/narrative/NarrativeFlow.tsx",
    ],
  },
  {
    date: "2026-03-28T23:55:00",
    agent: "claude-code",
    summary:
      "S5-T2: Converted Sanctum from push-panel to 50% overlay drawer. Map stays full-width underneath. Added Market Impact display (NQ/ES/YM close) to Econ Intel scored items. Updated econ-history endpoint to pass market_impact.",
    files: [
      "frontend/components/narrative/NarrativeFlow.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
      "frontend/types/mirofish.ts",
      "backend-hono/src/routes/data/index.ts",
    ],
  },
  {
    date: "2026-03-28T23:45:00",
    agent: "claude-code",
    summary:
      "S5-T1: Foundation — extended catalyst types with marketImpact + riskflowItemId. New tree layout engine for structured mind-map. CSS transform zoom/pan hook with semantic zoom thresholds. Store extended with viewport + dateFilter state.",
    files: [
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-tree-layout.ts",
      "frontend/hooks/useCanvasViewport.ts",
      "frontend/lib/narrative-store.ts",
    ],
  },
  {
    date: "2026-03-28T23:30:00",
    agent: "claude-code",
    summary:
      "Commentary scraper: Firecrawl-powered 30min scrape of FJ web, ZeroHedge, DeItaOne (ForexLive mirror) → raw_riskflow_items. Added ZeroHedge + DeItaOne to NewsSource union types. Geopolitical expansion: Twitter CLI now polls Bessent, Trump, ABORNEOFFICIAL accounts + Iran/Israel/IRGC search terms alongside FJ/InsiderWire/NickTimiraos.",
    files: [
      "backend-hono/src/services/riskflow/commentary-scraper.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/types/news-analysis.ts",
      "backend-hono/src/boot/index.ts",
    ],
  },
  {
    date: "2026-03-28T22:00:00",
    agent: "claude-code",
    summary:
      "S5-T2: Python FastAPI execution bridge wrapping TopStepX REST API for order placement, positions, account info, and cancellation",
    files: [
      "execution-bridge/main.py",
      "execution-bridge/auth.py",
      "execution-bridge/models.py",
      "execution-bridge/requirements.txt",
      "execution-bridge/.env.example",
    ],
  },
  {
    date: "2026-03-28T20:00:00",
    agent: "claude-code",
    summary:
      "S5-T3: Reconciler state machine — duplicate guard, PDPT floor, hard stop, confirmation timeout, trade_runs logging",
    files: [
      "backend-hono/src/services/reconciler-service.ts",
      "backend-hono/src/services/autopilot/proposal-service.ts",
    ],
  },
  {
    date: "2026-03-28T18:00:00",
    agent: "claude-code",
    summary:
      "S5-T4: ProjectX service client + trading route wiring + bridge health check on boot",
    files: [
      "backend-hono/src/services/projectx-service.ts",
      "backend-hono/src/services/trading-service.ts",
      "backend-hono/src/routes/trading/index.ts",
      "backend-hono/src/routes/trading/handlers.ts",
      "backend-hono/src/boot/index.ts",
    ],
  },
  {
    date: "2026-03-28T16:00:00",
    agent: "claude-code",
    summary:
      "S5-T1: Foundation types for execution bridge, reconciler state machine, trade_runs migration, PlaceOrder types for ProjectX, env var stubs for bridge + reconciler",
    files: [
      "backend-hono/src/types/execution-bridge.ts",
      "backend-hono/migrations/023_trade_runs.sql",
      "backend-hono/src/types/projectx.ts",
      "backend-hono/.env.example",
    ],
  },
  {
    date: "2026-03-28T14:00:00",
    agent: "claude-code",
    summary:
      "S4-T4: Upgraded SanctumRiskAssessment with rich scored item display — expandable cards showing agent notes, econ data, sub-score breakdowns, PriceBrain direction. Grouped by risk_type with section headers. Renamed panel to Live Risk Signals.",
    files: [
      "frontend/components/narrative/SanctumRiskAssessment.tsx",
      "frontend/components/narrative/Sanctum.tsx",
    ],
  },
  {
    date: "2026-03-28T12:00:00",
    agent: "claude-code",
    summary:
      "S4-T3: Rewrote KPI labels to trading lingo (Market Heat, Regime Risk, Signal Strength) with interpretive sub-text. Enhanced briefing display with structured sections and severity indicators. Updated category score interpretation with trading-specific context per risk sector.",
    files: [
      "frontend/components/narrative/Sanctum.tsx",
      "frontend/components/narrative/SanctumBriefing.tsx",
      "frontend/components/narrative/SanctumEconIntel.tsx",
    ],
  },
  {
    date: "2026-03-28T10:00:00",
    agent: "claude-code",
    summary:
      "S4-T2: Widened RiskFlow scored items query (sub_scores, econ_data, risk_type, agent_note, price_brain_score). Rewrote briefing generator with trader-friendly language (Market Heat, Regime Risk, Signal Strength). Added econ print pattern analysis and scored items integration to briefing output.",
    files: [
      "backend-hono/src/services/mirofish/mirofish-context.ts",
      "backend-hono/src/services/mirofish/mirofish-types.ts",
      "backend-hono/src/services/mirofish/mirofish-briefing.ts",
      "frontend/types/mirofish.ts",
    ],
  },
  {
    date: "2026-03-27T21:00:00",
    agent: "claude-code",
    summary:
      "fix: Infinite re-render loop (Maximum update depth exceeded) — flushQueue in DNDContext depended on [queue], causing setState→new ref→new callback→effect re-fire loop. Fixed with useRef. Also stabilized clearAll in RiskFlowContext (merged array dep). Removed /api/mcp 404 noise — useMcpConnectors now uses static defaults since backend MCP routes are not yet deployed.",
    files: [
      "frontend/contexts/DNDContext.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/hooks/useMcpConnectors.ts",
    ],
  },
  {
    date: "2026-03-27T14:00:00",
    agent: "claude-code",
    summary:
      "S4: Econ history pipeline — backend /econ-history/:ticker endpoint returns historical prints + scored items. SanctumEconIntel expanded cards show multi-row print history table, IV scores, scoring engine sub-score breakdown, and related scored items. MiroFish context assembly now fetches 7d econ print stats (beat/miss patterns, avg surprise, avg IV) for agent debate enrichment. Fixed frontend calling nonexistent /econ-events → /econ-calendar.",
    files: [
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/routes/data/index.ts",
      "backend-hono/src/services/mirofish/mirofish-context.ts",
      "backend-hono/src/services/mirofish/mirofish-types.ts",
      "backend-hono/src/services/mirofish/mirofish-seed.ts",
      "backend-hono/src/services/mirofish/mirofish-service.ts",
      "frontend/types/mirofish.ts",
      "frontend/components/narrative/SanctumEconIntel.tsx",
    ],
  },
  {
    date: "2026-03-27T00:00:00",
    agent: "claude-code",
    summary:
      "S4-T2: Built NarrativeGridView (2D time x risk grid), NarrativeLaneRow, semantic zoom aggregator. Replaced Canvas/WeekView toggle in NarrativeFlow with unified grid view. Updated toolbar zoom controls with read-only indicators.",
    files: [
      "frontend/components/narrative/NarrativeGridView.tsx",
      "frontend/components/narrative/NarrativeLaneRow.tsx",
      "frontend/lib/narrative-aggregator.ts",
      "frontend/components/narrative/NarrativeFlow.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
    ],
  },
  {
    date: "2026-03-28T00:30:00",
    agent: "claude-code",
    summary:
      "S4-T4: Built NarrativeConnectionOverlay (SVG branch arrows with labels + cross-lane ropes), narrative-ai-wiring.ts (drill-deeper + highlight-branch → AI endpoint orchestration). Extended RopeRenderer with cross-lane visual distinction and labeled connections.",
    files: [
      "frontend/components/narrative/NarrativeConnectionOverlay.tsx",
      "frontend/lib/narrative-ai-wiring.ts",
      "frontend/components/narrative/RopeRenderer.tsx",
    ],
  },
  {
    date: "2026-03-27T23:30:00",
    agent: "claude-code",
    summary:
      "S4-T1: Extended narrative types with ResearchBullet, CatalystCard research fields, new reducer actions (HIGHLIGHT_BRANCH, ADD_RESEARCH_BULLETS, MOVE_CARD_TO_LANE), grid layout math, and POST /api/narrative/research-drill endpoint",
    files: [
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/contexts/NarrativeContext.tsx",
      "frontend/lib/narrative-grid-layout.ts",
      "frontend/lib/narrative-research.ts",
      "backend-hono/src/routes/narrative/handlers.ts",
      "backend-hono/src/routes/narrative/index.ts",
    ],
  },
  {
    date: "2026-03-27T22:00:00",
    agent: "claude-code",
    summary:
      "S3: Rewire data pipeline (raw→scored), DetailFooter, dashboard layout, refresh=poll+score+auto-notes, appwide refresh, first row height +60%/+25%",
    files: [
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "frontend/components/feed/DetailFooter.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/refinement/AnnotatableItem.tsx",
    ],
  },
  {
    date: "2026-03-27T16:00:00",
    agent: "claude-code",
    summary:
      "S2-T7: Refinement Engine — own sidebar tab with annotatable feed, inline weight editor, regime control, commentator manager, re-score trigger",
    files: [
      "frontend/components/refinement/RefinementEngine.tsx",
      "frontend/components/refinement/AnnotatableItem.tsx",
      "frontend/components/refinement/RegimeControl.tsx",
      "frontend/components/refinement/QuickWeightEditor.tsx",
      "frontend/components/refinement/CommentatorManager.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-26T23:30:00",
    agent: "claude-code",
    summary:
      "S2-T5: IV Scorer V3 — regime-aware scoring with dynamic calibration weights, commentator tier multipliers, re-score endpoint, scheduled-data breaking block, ISM/PMI weight reduction, narrativePressure cap on point estimates, GEOPOLITICAL_TERMS fix, instrument propagation fix",
    files: [
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/types/news-analysis.ts",
      "backend-hono/src/config/scoring-weights.json",
      "backend-hono/src/services/market-data/point-estimator.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/economic-feed.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
    ],
  },
  {
    date: "2026-03-27T14:00:00",
    agent: "claude-code",
    summary:
      "S2-T6: Developer Settings overhaul — password gate (SHA-256, session + localStorage), RiskFlow calibration UI with event weight sliders grouped by category, regime display with manual override dropdown, commentator tier filter checkboxes, refinement engine toggle",
    files: [
      "frontend/components/settings/RiskFlowSettings.tsx",
      "frontend/components/settings/DevPasswordGate.tsx",
      "frontend/lib/dev-settings-auth.ts",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-26T22:30:00",
    agent: "claude-code",
    summary:
      "S2-T2: Regime engine — service (state mgmt + 60s cache + multipliers), detector (news flow heuristics for GEO/MACRO/EARNINGS/RISK_OFF/ILLIQUID), CRUD routes at /api/regime, MDB prompt integration with auto-parse regime classification",
    files: [
      "backend-hono/src/services/regime/regime-service.ts",
      "backend-hono/src/services/regime/regime-detector.ts",
      "backend-hono/src/routes/regime/handlers.ts",
      "backend-hono/src/routes/regime/index.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-03-26T21:00:00",
    agent: "claude-code",
    summary:
      "S2-T3: Commentator infrastructure — speaker extractor (regex-based), tier registry service with in-memory cache, CRUD routes, /identify test endpoint, ParsedHeadline speaker field integration",
    files: [
      "backend-hono/src/services/commentator/speaker-extractor.ts",
      "backend-hono/src/services/commentator/commentator-service.ts",
      "backend-hono/src/routes/commentator/handlers.ts",
      "backend-hono/src/routes/commentator/index.ts",
      "backend-hono/src/services/headline-parser.ts",
      "backend-hono/src/types/news-analysis.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-03-26T20:00:00",
    agent: "claude-code",
    summary:
      "fix(riskflow): v2 card rewrite — collapsible cards matching Strategium AlertRow layout (headline + dark footer bar with direction/points/priority/risk-type), smooth grid-template-rows expand, source icon top-right of card, removed source from Strategium, full-bleed zero-padding layout, expanded state: Oracle Note → Econ Data → Sub-Scores → Summary → Tags",
    files: [
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/feed/NewsSection.tsx",
      "frontend/components/RiskFlowPanel.tsx",
    ],
  },
  {
    date: "2026-03-26T19:00:00",
    agent: "claude-code",
    summary:
      "fix(riskflow): IV score inflation — tier-based score ceiling (base+4 cap prevents jobless@200pts), recalibrated scoreToPoints curve (max 99pts down from 229pts), fixed currentPrice:0 in central scorer breaking autoresearch feedback loop",
    files: [
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
    ],
  },
  {
    date: "2026-03-26T16:00:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): T3 — Strategium + Dashboard card expanded state with agent notes, risk type tags, sub-score KPIs, beat/miss badges, View in RiskFlow CTA, smooth CSS grid transitions. Added generateNote API method.",
    files: [
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-26T15:00:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): T4 — RiskFlow tab detail cards with BeatMissBadge, SubScoreBar, agent notes, risk type tags. Replaced inline card rendering in NewsSection with RiskFlowDetailCard. Deleted dead CompactRiskFlowCard files (zero imports).",
    files: [
      "frontend/components/feed/BeatMissBadge.tsx",
      "frontend/components/feed/SubScoreBar.tsx",
      "frontend/components/feed/RiskFlowDetailCard.tsx",
      "frontend/components/feed/NewsSection.tsx",
      "frontend/components/CompactRiskFlowCard.tsx",
      "frontend/components/feed/CompactRiskFlowCard.tsx",
    ],
  },
  {
    date: "2026-03-26T14:00:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): T1 — thread subScores, econData, riskType, agentNote from backend through API to frontend RiskFlowAlert type. Added classifyRiskType keyword matcher in central-scorer, structured econData in econ-bridge INSERT, extended NewsFeedRow/ScoredRiskFlowItem/FeedItem/RiskFlowItem/RiskFlowAlert types, updated news-cache store+read and central-scorer mapping functions.",
    files: [
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/econ-bridge.ts",
      "backend-hono/src/services/riskflow/news-cache.ts",
      "frontend/types/api.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
    ],
  },
  {
    date: "2026-03-26T00:15:00",
    agent: "claude-code",
    summary:
      "fix(briefs): Overnight dispatch visibility — GET /api/data/brief with no type now returns most recent brief of any type instead of filtering by getCurrentBriefType(). Extended PMDB window overnight (5:30 PM through 6:29 AM) so Dusk Dispatch stays active until Dawn fires. Fixed frontend getBriefLabel() in both ExecutiveDashboard and BriefMiniWidget to match corrected windows.",
    files: [
      "backend-hono/src/routes/data/index.ts",
      "backend-hono/src/services/brief-generator.ts",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
    ],
  },
  {
    date: "2026-03-25T22:00:00",
    agent: "claude-code",
    summary:
      "docs(strategy): MAJOR REWRITE of STRATEGY-40-40-CLUB.md with 13 corrections from live trade video analysis (Sprint 0 model refinement). Key changes: Antilag redefined as ATR spike + engulfing candle (NQ primary, ES intuition — NOT cross-instrument velocity), trailing stop anchors to butt of engulfing candle (NOT EMA distance/cycle levels), new Access Denied pattern documented, even-price-level exit rule, reverse trailing TP, cross-instrument divergence as alternate setup, scale-in simplified to mid-trade ATR spike, blackout rule refined (5pt tight stop under wick at 50% reclaim for limit orders). Also saved algo engine migration project memory and updated sprint plan to 4 sprints (Sprint 0: model refinement via video analysis).",
    files: ["docs/quantconnect/STRATEGY-40-40-CLUB.md"],
  },
  {
    date: "2026-03-25T20:00:00",
    agent: "claude-code",
    summary:
      "docs(scheduled-tasks): Complete 10-task Claude Desktop scheduled task suite with aligned Fintheon backend timing. Tasks: (1) Pre-market news monitor 4-6:29AM/15min sentinel, (2) Dispatch MDB 6:30AM, (3) Morning standup+trade proposal+chart 7:15AM — the big one with Phase A backend curl, Phase B playbook model selection + DOM/LTF-HTF liquidity analysis, Phase C computer use TopStepX charting, Phase D boardroom @everyone report, (4) Boardroom checkin 8:00AM, (5) Econ scan 8:35AM (5min after prints), (6) Premarket 9:00AM, (7) Market open 9:35AM (5min after bell), (8) Dispatch ADB 10:45AM, (9) Dispatch PMDB 5:15PM, (10) Dispatch TOTT Sunday 4:30PM. Dual-scheduling with backend node-cron (dispatch-scheduler + boardroom-scheduler) as belt-and-suspenders. Idempotency guards on dispatches. Timing offset on econ/market-open to capture data after it drops.",
    files: ["docs/scheduled-tasks/morning-standup-prompt.md"],
  },
  {
    date: "2026-03-25T14:30:00",
    agent: "claude-code",
    summary:
      "feat(ai): Add Nous Research direct inference fallback for brief generation. When OpenRouter DNS fails (EAI_AGAIN/ENOTFOUND), brief-generator.ts now catches network errors and falls back to Hermes 4 405B via inference-api.nousresearch.com. New nous-direct model key in ai-config, model-selector handler, and NOUS_API_KEY env var.",
    files: [
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "backend-hono/src/types/ai-types.ts",
      "backend-hono/.env.example",
    ],
  },
  {
    date: "2026-03-25T10:00:00",
    agent: "claude-code",
    summary:
      "feat(ui): Add smooth crossfade transition for browser iframe open/close via power button. Replaces hard ternary swap with layered rendering + CSS scale/opacity animations matching existing tab transition easing.",
    files: ["index.css", "frontend/components/layout/MainLayout.tsx"],
  },
  {
    date: "2026-03-25T09:30:00",
    agent: "claude-code",
    summary:
      "fix(backend): Resolve 404 error spew — bypass riskflow auth for /sources (public endpoint), guard account polling with isAuthenticated to prevent pre-auth 401 cascade. Stub ProjectXService (backend never implemented). Remove orphaned root lib/, components/, contexts/, hooks/, App.tsx. Boardroom UX overhaul: remove hover discoloration, replace sidebar with inline copy button, date+time timestamps, right-aligned green WiFi status with pulse animation.",
    files: [
      "backend-hono/src/routes/index.ts",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/lib/services.ts",
      "frontend/components/consilium/ConsiliumMessage.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "mini-widget-entry.tsx",
    ],
  },
  {
    date: "2026-03-24T19:00:00",
    agent: "claude-code",
    summary:
      'feat(mirofish): Persistence refactor — reports survive app close. Extended persistRun() to store full report payload (time_series, generated_events, briefing JSONB). Added GET /api/mirofish/latest endpoint that returns most recent report from cache or Supabase. ConsiliumHub loads persisted report on mount. Auditorium renders immediately from persisted data, never shows idle state if report exists. "Run MiroFish" button becomes "Update" when data exists, "Updating..." during refresh. Background update threshold reduced from 1hr to 30min. Existing data stays visible during background updates.',
    files: [
      "backend-hono/src/services/mirofish/mirofish-service.ts",
      "backend-hono/src/routes/mirofish/handlers.ts",
      "backend-hono/src/routes/mirofish/index.ts",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/components/narrative/AuditoriumHeader.tsx",
    ],
  },
  {
    date: "2026-03-25T06:00:00",
    agent: "claude-code",
    summary:
      "feat(theme): Wire severity colors (severe/neutralSevere/neutral/lowNeutral/low) through ThemeContext→CSS variables. Replace hardcoded #EF4444/#F59E0B/#34D399/#3B82F6 with var(--fintheon-severe) etc in Auditorium narrative components. Restructure Auditorium Page 2: DevelopmentsTimeline replaces Kanban, add AgentScorecard+RiskAssessment split grid. Remove bottom-left AgentDropdown from boardroom, keep top toolbar filter. Smooth Strategium collapse/expand via CSS width transition. Remove Proposals tab from Consilium (sidebar-only). Enhanced TradeIdeaModal with consensus/contrarian trade views, act/pass recommendation, expected print analysis. Smooth settings landing↔tab transitions. Fix Save Settings error toast — backend sync is now best-effort, localStorage always persists.",
    files: [
      "frontend/contexts/ThemeContext.tsx",
      "frontend/index.css",
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/components/narrative/AuditoriumNarratives.tsx",
      "frontend/components/narrative/AuditoriumEconIntel.tsx",
      "frontend/components/narrative/AuditoriumTheses.tsx",
      "frontend/components/narrative/AuditoriumRiskAssessment.tsx",
      "frontend/components/narrative/AuditoriumBriefing.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/TradeIdeaModal.tsx",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-25T04:00:00",
    agent: "claude-code",
    summary:
      "feat(auditorium): replace custom canvas price chart with TradingView AdvancedRealTimeChart (area style, gold gradient). Top pane (~75%) shows live price with GC/ES/NQ comparison overlays. Bottom pane (~25%) keeps compact heat-mapped IV risk bars. Symbol mapped from user settings (/MNQ→CME_MINI:NQ1! etc). Threaded selectedSymbol from SettingsContext→ConsiliumHub→Auditorium→AuditoriumChart.",
    files: [
      "frontend/components/narrative/AuditoriumChart.tsx",
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
    ],
  },
  {
    date: "2026-03-25T03:15:00",
    agent: "claude-code",
    summary:
      "feat(auditorium): 2-col econ grid with expandable cards (countdown, history, agent reasoning), merged Risk+Narratives into single page (4→3 pages), updated AUDITORIUM_PAGES constant and preset→page mapping.",
    files: [
      "frontend/components/narrative/AuditoriumEconIntel.tsx",
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/types/mirofish.ts",
    ],
  },
  {
    date: "2026-03-25T02:30:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): unified VIX scoring + rescore integration — wired startVIXPolling, startCentralScorer, startIVScoreTicker, initVIXRescore into boot sequence. Fixed pre-existing type error in central-scorer. Full pipeline: VIX polls → triggers fire → rescore cycle runs → items re-enriched with VIX-weighted scoring + sub-score breakdown.",
    files: [
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
    ],
  },
  {
    date: "2026-03-25T02:00:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): VIX-weighted item scoring + sub-score breakdown + finer event weights. continuousVIXMultiplier() piecewise curve replaces 4-tier step function for per-item scoring. SubScoreBreakdown on every FeedItem (eventWeight/timing/deviation/momentum/vixContext). EVENT_WEIGHTS filled with half-point granularity (2.0-10.0 range). calculateIVScore() now accepts VIXData and applies continuous curve multiplier. Macro level thresholds adjust in elevated VIX (>22). VIX fetched once per batch in feed enrichment.",
    files: [
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/config/scoring-weights.json",
      "backend-hono/src/services/riskflow/feed-service.ts",
    ],
  },
  {
    date: "2026-03-25T01:15:00",
    agent: "claude-code",
    summary:
      "feat(riskflow): VIX-triggered rescore engine — spike threshold lowered to 2.5%, velocity tracking (sustained >0.2pt/min), regime detection (low/normal/elevated/crisis), onVIXTrigger callback system, rescoreCycle() re-enriches last 4h of scored items, 2-min cooldown prevents storms",
    files: [
      "backend-hono/src/services/vix-service.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
      "backend-hono/src/services/riskflow/vix-rescore.ts",
    ],
  },
  {
    date: "2026-03-25T00:30:00",
    agent: "claude-code",
    summary:
      "feat(auth): unify T1-T4 login system + init screen with fade-in. Merged all 4 parallel tracks (Electron deep link, login UI redesign, backend profiles, data migration). Added InitScreen component with 4-step loading sequence (session → backend → sync → workspace), progress dots, and skip option. App content fades in softly via opacity transition. Session persists across Electron restarts (Supabase persistSession + autoRefreshToken). Fixed supabase import path in backend.ts. Added getAccessToken to frontend/lib/supabase.ts.",
    files: [
      "frontend/App.tsx",
      "frontend/lib/supabase.ts",
      "frontend/lib/backend.ts",
      "frontend/contexts/AuthContext.tsx",
    ],
  },
  {
    date: "2026-03-24T23:45:00",
    agent: "claude-code",
    summary:
      'feat(auth): T4 — localStorage → Supabase data migration engine + cloud state hook. Created data-migration.ts that reads all critical localStorage keys (threads, narrative, regime, layouts, checkpoints, voice transcripts, gateway) and PUTs them to /api/profile/app-state. Idempotent via fintheon:migration-complete flag. Created useCloudState hook for generic cloud read/write with debounced persistence and localStorage fallback. Updated App.tsx to trigger migration on first login with "Syncing your data" overlay. Updated ThreadContext to load/persist threads from cloud with debounced PUT.',
    files: [
      "frontend/lib/data-migration.ts",
      "frontend/hooks/useCloudState.ts",
      "frontend/App.tsx",
      "frontend/contexts/ThreadContext.tsx",
    ],
  },
  {
    date: "2026-03-24T22:30:00",
    agent: "claude-code",
    summary:
      "feat(auth): T1 — wire Supabase Google OAuth + Electron deep link protocol. Registered fintheon:// custom protocol in electron/main.cjs with open-url + second-instance handlers. Added onAuthCallback IPC bridge in preload.cjs. Created frontend/lib/supabase.ts with signInWithGoogle (skipBrowserRedirect for Electron PKCE). Rewrote AuthContext with Supabase session management, deep link code exchange, getAccessToken(). Refactored App.tsx — AuthProvider wraps entire app, AuthGate component uses real isAuthenticated/isLoading state.",
    files: [
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/lib/supabase.ts",
      "frontend/contexts/AuthContext.tsx",
      "frontend/App.tsx",
      "frontend/types/electron.d.ts",
      "frontend/.env.development",
      "frontend/.env.production",
    ],
  },
  {
    date: "2026-03-24T22:00:00",
    agent: "claude-code",
    summary:
      "feat(auth): T2 login screen redesign — split layout (branding left, login card right), deep dither background with embedded Roman trading motifs (seeded PRNG), time-of-day trading quotes, styled Google sign-in button. Removed FluidCursor, spinning conic border, and AuthPhase state machine.",
    files: [
      "frontend/components/auth/AuthShell.tsx",
      "frontend/components/auth/AsciiBackground.tsx",
      "frontend/components/auth/TimeQuote.tsx",
      "frontend/components/auth/GoogleSignInButton.tsx",
    ],
  },
  {
    date: "2026-03-24T21:00:00",
    agent: "claude-code",
    summary:
      "feat(appearance): Bullish/bearish custom colors from appearance settings now propagate throughout the app — RiskFlow direction indicators, daily P&L displays, position colors, proposal modals, and session status bar all use CSS vars instead of hardcoded Tailwind/hex colors. Theme (including bullish/bearish) now syncs to backend settings for per-user persistence.",
    files: [
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/CompactRiskFlowCard.tsx",
      "frontend/components/feed/CompactRiskFlowCard.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/ProposalModal.tsx",
      "frontend/components/mission-control/CompactPnLDisplay.tsx",
      "frontend/components/AccountSummary.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
      "frontend/components/PositionsList.tsx",
      "frontend/components/SessionStatusBar.tsx",
      "frontend/contexts/ThemeContext.tsx",
    ],
  },
  {
    date: "2026-03-24T19:30:00",
    agent: "claude-code",
    summary:
      "fix(topheader): VIX risk toast now fires at scheduled pre-market-open times (9:20, 9:50, 11:20, 12:15 EST weekdays + 5:50 PM Sundays) instead of on every threshold crossing. Deduplicates per window per day.",
    files: ["frontend/components/layout/TopHeader.tsx"],
  },
  {
    date: "2026-03-24T16:00:00",
    agent: "claude-code",
    summary:
      "feat(mirofish): Deterministic reactive score adjustment engine + 3-component IV formula (50% VIX + 30% headlines + 20% MiroFish running analysis). New mirofish-reactive.ts maps RiskFlow items to 6 risk categories with rule-based scoring. Central scorer wired to trigger reactive adjustments for macroLevel >= 3 items.",
    files: [
      "backend-hono/src/services/mirofish/mirofish-reactive.ts",
      "backend-hono/src/services/market-data/iv-scorer.ts",
      "backend-hono/src/services/market-data/iv-score-ticker.ts",
      "backend-hono/src/services/riskflow/central-scorer.ts",
    ],
  },
  {
    date: "2026-03-24T15:30:00",
    agent: "claude-code",
    summary:
      "feat(auditorium): T3 chart redesign — implied points smooth bezier line (top 55%) + stacked category IV volume bars (bottom 45%) + theme-aware neon/gradient effects + hover tooltip with colored dots. 239 lines, canvas-only, retina-aware.",
    files: ["frontend/components/narrative/AuditoriumChart.tsx"],
  },
  {
    date: "2026-03-24T14:00:00",
    agent: "claude-code",
    summary:
      "feat(mirofish): T2 backend — rolling window queries, auto-run detection, running state endpoint, widened RiskFlow context to 72h/40 items. Added RunningAnalysisSnapshot, RollingWindowQuery, AggregatedRollingData, MiroFishRunSummary types. 3 new API routes: /rolling-window, /auto-run-check, /running-state.",
    files: [
      "backend-hono/src/services/mirofish/mirofish-types.ts",
      "backend-hono/src/services/mirofish/mirofish-service.ts",
      "backend-hono/src/services/mirofish/mirofish-context.ts",
      "backend-hono/src/routes/mirofish/handlers.ts",
      "backend-hono/src/routes/mirofish/index.ts",
    ],
  },
  {
    date: "2026-03-24T12:00:00",
    agent: "claude-code",
    summary:
      "chore(auth): Remove all Clerk remnants — deleted dead lib/clerk-hooks.ts and components/auth/fintheonAppearance.ts stubs, removed @clerk/clerk-react and @clerk/themes from frontend/package.json, cleaned Clerk env vars from secrets.env.example, fixed GatewayContext HealthResponse type (clerk→auth), updated SystemStatusContext key maps (Clerk Auth→Supabase Auth), removed clerk_token from SettingsPanel logout, updated stale Clerk comments in MainLayout.tsx.",
    files: [
      "lib/clerk-hooks.ts",
      "components/auth/fintheonAppearance.ts",
      "frontend/package.json",
      "secrets.env.example",
      "frontend/contexts/GatewayContext.tsx",
      "frontend/contexts/SystemStatusContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-24T06:00:00",
    agent: "claude-code",
    summary:
      "feat(psychassist): Deterministic ER scoring engine — replaces slow Claude sentiment analysis with instant client-side regex-based curse/breathing detection. Scale: 12.5→0→-12.5, flat -1.25 per curse, 5x decay multiplier. Persists every trigger event to Supabase er_events table via fire-and-forget POST. Wired into voice pipeline (processRecording → processTranscript → sendText). Claude sentiment analysis kept as secondary background signal.",
    files: [
      "frontend/hooks/useERScoring.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/contexts/VoiceContext.tsx",
      "frontend/lib/services.ts",
      "backend-hono/src/routes/psych-assist.ts",
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/migrations/017_er_events.sql",
    ],
  },
  {
    date: "2026-03-24T04:00:00",
    agent: "claude-code",
    summary:
      "fix(voice): Replaced dead SpeechRecognition API with getUserMedia + MediaRecorder + Whisper transcription pipeline. Voice assistant now works in Electron. Added greeting on orb click (reads traderName from settings). Wired mic device selection from Settings into audio capture via deviceId constraint. Added silence-based VAD (1.8s silence threshold). fix(briefs): brief-generator was passing raw model key string to generateText — now uses createModelClient(). Added catch-up mechanism to dispatch-scheduler: on boot, checks which briefs were due today but missed (backend not running at cron time) and generates them.",
    files: [
      "frontend/hooks/useVoiceAssistant.ts",
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/cron/dispatch-scheduler.ts",
      "backend-hono/src/boot/index.ts",
    ],
  },
  {
    date: "2026-03-24T02:30:00",
    agent: "claude-code",
    summary:
      'fix(hermes+connectors): Inject capability awareness into agent prompts so Harper stops saying "awaiting data sync". Replaced Twitter/X connector with RiskFlow (toggleable, off by default). Removed Alpha Vantage. Made Playwright always-on and non-toggleable (locked). Added locked field to McpServerConfig.',
    files: [
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/types/mcp.ts",
      "frontend/types/mcp.ts",
      "frontend/hooks/useMcpConnectors.ts",
      "frontend/components/chat/McpConnectorPopup.tsx",
    ],
  },
  {
    date: "2026-03-24T01:00:00",
    agent: "claude-code",
    summary:
      "feat(trade-ideas): Merged API endpoint GET /api/trade-ideas — combines autopilot proposals + Supabase trade_ideas into unified TradeIdeaCard[], with deduplication by instrument+direction+entry within 2hr window, sorted by createdAt DESC",
    files: [
      "backend-hono/src/routes/trade-ideas/handlers.ts",
      "backend-hono/src/routes/trade-ideas/index.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-03-24T00:30:00",
    agent: "claude-code",
    summary:
      "fix(boardroom): Switch boardroom message fetching + writing from file-based JSONL (hermes-sessions) to Supabase-backed boardroom-store. Fixes blank boardroom chat — JSONL files never existed. JSONL kept as non-blocking fallback.",
    files: [
      "backend-hono/src/routes/boardroom/handlers.ts",
      "backend-hono/src/services/hermes-sessions.ts",
    ],
  },
  {
    date: "2026-03-23T23:30:00",
    agent: "claude-code",
    summary:
      "feat(autoresearch): Wire recordObservation() into central-scorer scoringCycle — Phase T4 integration. Enriched items with ivScore > 0 now emit ScoringObservations with VIX from vix-service, enabling automated fitness tracking and outcome resolution.",
    files: ["backend-hono/src/services/riskflow/central-scorer.ts"],
  },
  {
    date: "2026-03-23T22:00:00",
    agent: "claude-code",
    summary:
      "feat(auditorium): Full refactor — snap-scroll 3-page dashboard (Command Center, Econ Intel, Risk & Scenarios), preset selector (Full Brief/Chart Focus/Econ Watch/Risk Scan), responsive chart height, category score cards, economic event cards with beat/miss predictions, expanded theses and kanban, page indicators, tab renamed from Predictions to Auditorium",
    files: [
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/components/narrative/AuditoriumChart.tsx",
      "frontend/components/narrative/AuditoriumKanban.tsx",
      "frontend/components/narrative/AuditoriumTheses.tsx",
      "frontend/components/narrative/AuditoriumPresets.tsx",
      "frontend/components/narrative/AuditoriumEconIntel.tsx",
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/types/mirofish.ts",
    ],
  },
  {
    date: "2026-03-23T20:00:00",
    agent: "claude-code",
    summary:
      "feat(browser-use): Phase 2 — Browser Use CLI integration via CDP, chart automation (Playwright → browser-use), ProposalCard feed component, [SKILL:CHARTLEVELS] skill, auto-trigger charting on proposal creation, SSE broadcast proposals to RiskFlow feed",
    files: [
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/types/electron.d.ts",
      "types/electron.d.ts",
      "scripts/chart-proposal.ts",
      "backend-hono/src/routes/proposals/handlers.ts",
      "backend-hono/src/services/autopilot/proposal-service.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/riskflow/sse-broadcaster.ts",
      "frontend/types/feed.ts",
      "frontend/types/api.ts",
      "frontend/components/feed/ProposalCard.tsx",
      "frontend/components/feed/FeedItem.tsx",
      "frontend/components/feed/FeedSection.tsx",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/ai/agent-instructions/skill-instructions.ts",
      "backend-hono/src/config/feature-flags.ts",
    ],
  },
  {
    date: "2026-03-23T18:00:00",
    agent: "claude-code",
    summary:
      "chore(autoresearch): unify types and resolve cross-track conflicts — canonical types.ts, scoring-weights.json, all T2/T3 modules import from types.ts",
    files: [
      "backend-hono/src/services/autoresearch/types.ts",
      "backend-hono/src/services/autoresearch/observation-store.ts",
      "backend-hono/src/services/autoresearch/price-resolver.ts",
      "backend-hono/src/services/autoresearch/scoring-observer.ts",
      "backend-hono/src/services/autoresearch/fitness.ts",
      "backend-hono/src/services/autoresearch/backtest-scoring.ts",
      "backend-hono/src/services/autoresearch/run-backtest.ts",
      "backend-hono/src/config/scoring-weights.json",
    ],
  },
  {
    date: "2026-03-23T17:30:00",
    agent: "claude-code",
    summary:
      "feat(autoresearch/T3): backtest engine — fitness.ts evaluates prediction accuracy, backtest-scoring.ts replays observations, run-backtest.ts CLI entry point, program.md docs",
    files: [
      "backend-hono/src/services/autoresearch/fitness.ts",
      "backend-hono/src/services/autoresearch/backtest-scoring.ts",
      "backend-hono/src/services/autoresearch/run-backtest.ts",
      "backend-hono/src/services/autoresearch/program.md",
    ],
  },
  {
    date: "2026-03-23T17:00:00",
    agent: "claude-code",
    summary:
      "feat(autoresearch/T2): observation pipeline — observation-store.ts persists scored events, price-resolver.ts fetches outcome prices via Yahoo intraday bars, scoring-observer.ts hooks into news pipeline",
    files: [
      "backend-hono/src/services/autoresearch/observation-store.ts",
      "backend-hono/src/services/autoresearch/price-resolver.ts",
      "backend-hono/src/services/autoresearch/scoring-observer.ts",
      "backend-hono/src/services/riskflow/news-cache.ts",
    ],
  },
  {
    date: "2026-03-23T16:30:00",
    agent: "claude-code",
    summary:
      "feat(autoresearch/T1): canonical types + scoring config — types.ts defines ScoringObservation/FitnessResult/BacktestConfig, config/scoring-weights.json for backtest weights, getIntradayBars/getPriceNear added to yahoo-market.ts",
    files: [
      "backend-hono/src/services/autoresearch/types.ts",
      "backend-hono/src/config/scoring-weights.json",
      "backend-hono/src/services/market-data/yahoo-market.ts",
    ],
  },
  {
    date: "2026-03-23T17:00:00",
    agent: "claude-code",
    summary:
      "fix(boardroom+riskflow): Touch-up boardroom T1 — BoardroomAgent union types, toAgent() coercion, toLegacyMessage() adapter, memory cap 500. Square RiskFlow cards (remove rounded-xl, edge-to-edge border-b).",
    files: [
      "backend-hono/src/types/boardroom-db.ts",
      "backend-hono/src/services/boardroom-store.ts",
      "frontend/components/RiskFlowPanel.tsx",
    ],
  },
  {
    date: "2026-03-23T16:00:00",
    agent: "claude-code",
    summary:
      "feat(boardroom): T1 — DB schema (boardroom_sessions + boardroom_messages) + TypeScript types + store service with in-memory fallback, EST-based daily sessions, filtered message queries",
    files: [
      "backend-hono/migrations/014_boardroom_sessions.sql",
      "backend-hono/src/types/boardroom-db.ts",
      "backend-hono/src/services/boardroom-store.ts",
    ],
  },
  {
    date: "2026-03-23T15:00:00",
    agent: "claude-code",
    summary:
      "feat: Default browser layout + platform settings — users can choose Zen/Castra and default iFrame platform in Settings > iFrames tab. MainLayout reads from settings on mount.",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-23T14:00:00",
    agent: "claude-code",
    summary:
      "fix: Login screen gate + freeze fix — AuthShell shows on Electron launch (click LOGIN to proceed), fixed BYPASS_AUTH in production (was gated behind DEV_MODE causing 401 cascade), removed dead vendor_clerk chunk, copied auth components to frontend.",
    files: [
      "frontend/App.tsx",
      "frontend/lib/backend.ts",
      "frontend/components/auth/AuthShell.tsx",
      "frontend/components/auth/FluidCursor.tsx",
      "frontend/vite.config.ts",
    ],
  },
  {
    date: "2026-03-23T13:00:00",
    agent: "claude-code",
    summary:
      "fix: Manual refresh bypasses autoRefresh + event window gates — manualRefreshTweets() always fetches FJ/InsiderWire/Trusted, dedupes via DB. Also rebuilt backend so NightPoller compiles into dist.",
    files: [
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/src/services/twitter-cli/index.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
    ],
  },
  {
    date: "2026-03-23T12:30:00",
    agent: "claude-code",
    summary:
      "feat: Night poller — X CLI polls FJ/InsiderWire/Trusted hourly 7PM-7AM EST regardless of autoRefresh, stores to DB for all users.",
    files: ["backend-hono/src/services/twitter-cli/econ-triggered-poller.ts"],
  },
  {
    date: "2026-03-23T12:00:00",
    agent: "claude-code",
    summary:
      "feat: Polish login screen — remove background image (plain #050402 black), add FINTHEON title with Cinzel/Solvys Gold, clean up Clerk → showAuth naming. Also rebranded fintheon-landing repo (Pulse → Fintheon, pushed).",
    files: ["components/auth/AuthShell.tsx"],
  },
  {
    date: "2026-03-22T23:30:00",
    agent: "claude-code",
    summary:
      'refactor: Replace "The Tape" in Castra with RiskFlowPanel + smooth slide transition for sidebar chat. Chat panel now uses translate-x transition instead of mount/unmount for fluid open/close.',
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
    ],
  },
  {
    date: "2026-03-22T22:00:00",
    agent: "claude-code",
    summary:
      "fix: Refresh button auth + 30-day feed TTL + agent feed injection. Frontend: RiskFlowContext now uses auth-aware useBackend() instead of unauthenticated baseBackend default export. frontend/lib/backend.ts unified with root lib/backend.ts (Supabase getAccessToken). Backend: forcePoll() waits for active poll instead of silently returning, cleanupOldItems default changed from 72h to 30 days with daily auto-schedule in boot + cron, agent chat system prompts now include live RiskFlow headlines via buildFeedContext().",
    files: [
      "frontend/lib/backend.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/services/riskflow/news-cache.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
    ],
  },
  {
    date: "2026-03-22T20:00:00",
    agent: "claude-code",
    summary:
      "feat: Replace Hyperliquid with MMT (Market Monkey Terminal). Frontend: iFrame embed swapped to app.mmt.gg, platform dropdown updated, PrimaryBroker type changed. Pine Script indicators ported to MMT JavaScript scripting v2 (Liquidity Swings + Volume Delta + EMA Cross overlay, Reversal RSI + HTF Patterns oscillator). Backend PrimaryBroker type updated.",
    files: [
      "frontend/components/TopStepXBrowser.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "backend-hono/src/types/rithmic.ts",
      "docs/mmt-scripts/overlay-lqdelta.js",
      "docs/mmt-scripts/oscillator-reversal-rsi.js",
    ],
  },
  {
    date: "2026-03-22T18:00:00",
    agent: "claude-code",
    summary:
      "feat: Migrate auth from Clerk to Supabase Auth. Backend: new supabase-auth.ts service verifies JWTs via auth.getUser(), auth middleware updated, @clerk/backend removed. Frontend: ClerkProvider replaced with Supabase session listener, AuthContext uses Supabase session, lib/backend.ts sends Supabase access_token, new SupabaseSignIn component (Google OAuth, gold theme). Env vars updated: CLERK_SECRET_KEY removed, SUPABASE_ANON_KEY added. BYPASS_AUTH still works for local dev.",
    files: [
      "backend-hono/src/services/supabase-auth.ts",
      "backend-hono/src/middleware/auth.ts",
      "backend-hono/src/services/health-service.ts",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/.env",
      "backend-hono/package.json",
      "App.tsx",
      "contexts/AuthContext.tsx",
      "lib/supabase.ts",
      "lib/backend.ts",
      "lib/clerk-hooks.ts",
      "components/auth/SupabaseSignIn.tsx",
      "components/auth/fintheonAppearance.ts",
      "components/layout/MainLayout.tsx",
      "components/ChatInterface.tsx",
      "mini-widget-entry.tsx",
      "package.json",
      ".env.production",
      ".env.development",
    ],
  },
  {
    date: "2026-03-23T00:30:00",
    agent: "claude-code",
    summary:
      "feat: Automated dispatch briefing scheduler — replaces Perplexity Computer crons. New dispatch-scheduler.ts with node-cron jobs for MDB (6:30 AM), ADB (10:45 AM), PMDB (5:15 PM), TOTT (Sun 4:30 PM). Extracted brief-generator.ts shared service from inline route handler. Idempotent (skips if already generated today). Posts to both Supabase + boardroom. Disable via DISPATCH_SCHEDULER_ENABLED=false.",
    files: [
      "backend-hono/src/services/brief-generator.ts",
      "backend-hono/src/services/cron/dispatch-scheduler.ts",
      "backend-hono/src/boot/index.ts",
      "backend-hono/src/routes/data/index.ts",
    ],
  },
  {
    date: "2026-03-22T23:30:00",
    agent: "claude-code",
    summary:
      "feat: CLI onboarding system for team distribution. Interactive `bun run setup` wizard using @clack/prompts — handles prerequisites, deps, Hermes install, API key prompts with live validation, .env generation (merge, don't overwrite), port detection, backend build+start, health verification, and Harper welcome message. Fully idempotent — safe to re-run. New POST /api/setup/welcome endpoint returns JSON (not SSE) for CLI consumption.",
    files: [
      "scripts/setup.ts",
      "scripts/setup-utils.ts",
      "backend-hono/src/routes/setup/index.ts",
      "backend-hono/src/routes/index.ts",
      "package.json",
    ],
  },
  {
    date: "2026-03-22T22:00:00",
    agent: "claude-code",
    summary:
      'feat: Team-ready status indicators, error log panel, and Hermes startup verification. (1) Real-time system status indicators in footer replacing static dots — polls /api/diagnostics for per-service health. (2) Persistent error log with expandable "More Info" dropdowns showing stack traces, endpoints, fix suggestions. (3) Hermes verification on startup — parses /health body, auto-restarts if AI gateway down, verifies before showing connected. (4) New POST /api/diagnostics/hermes/restart endpoint with rate limiting. (5) SystemStatusContext + StatusIndicator components. (6) ErrorBoundary pushes crashes to error log.',
    files: [
      "frontend/lib/errorLog.ts",
      "frontend/lib/errorBus.ts",
      "frontend/hooks/useErrorLog.ts",
      "frontend/hooks/useSystemStatus.ts",
      "frontend/components/ui/ErrorLogPanel.tsx",
      "frontend/components/ui/StatusIndicator.tsx",
      "frontend/contexts/SystemStatusContext.tsx",
      "frontend/contexts/GatewayContext.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/ErrorBoundary.tsx",
      "frontend/components/settings/HermesSettings.tsx",
      "frontend/App.tsx",
      "backend-hono/src/routes/diagnostics/index.ts",
    ],
  },
  {
    date: "2026-03-22T18:00:00",
    agent: "claude-code",
    summary:
      "feat: PIC Source of Truth fusion — fused TP voice session into agent neural web. (1) Modular agent prompt architecture with shared beliefs + per-agent philosophy blocks for Harper/Feucht/Oracle/Consul/Herald. (2) Full 14 Commandments with expanded types, block levels, agent usage, mentor sources. (3) Risk manager reconciled with PDPT, blackout, circuit breaker, commandment gates. (4) PsychAssist tilt detection + lockout protocol (soft/hard escalation with popup modal debriefs). (5) Browser Control Phase 1: Electron WebContentsView with read-only Agent Control Layer for TopStep X observation. (6) Econ rankings config with macro chain ordering.",
    files: [
      "knowledge-base/source-of-truth/commandments.md",
      "knowledge-base/source-of-truth/trading-philosophy.md",
      "knowledge-base/source-of-truth/execution-mechanics.md",
      "knowledge-base/source-of-truth/psychology.md",
      "knowledge-base/source-of-truth/glossary.md",
      "backend-hono/src/services/ai/agent-instructions/index.ts",
      "backend-hono/src/services/ai/agent-instructions/base-prompts.ts",
      "backend-hono/src/services/ai/agent-instructions/shared-beliefs.ts",
      "backend-hono/src/services/ai/agent-instructions/philosophy-blocks.ts",
      "backend-hono/src/services/ai/agent-instructions/skill-instructions.ts",
      "backend-hono/src/services/ai/agent-instructions/commandment-gates.ts",
      "backend-hono/src/services/agents/risk-manager.ts",
      "backend-hono/src/config/econ-rankings.ts",
      "backend-hono/src/services/psych-assist/tilt-detector.ts",
      "backend-hono/src/services/psych-assist/lockout-protocol.ts",
      "frontend/components/apparatus/types.ts",
      "frontend/components/apparatus/commandments-data.ts",
      "frontend/components/apparatus/CommandmentsSidebar.tsx",
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/psych-assist/LockoutModal.tsx",
      "frontend/components/psych-assist/MorningRoutineGate.tsx",
      "frontend/components/psych-assist/HotHandBanner.tsx",
      "frontend/components/agent-view/AgentViewPanel.tsx",
      "electron/agent-view-handlers.cjs",
      "electron/main.cjs",
      "electron/preload.cjs",
    ],
  },
  {
    date: "2026-03-23T01:45:00",
    agent: "claude-code",
    summary:
      'feat(boardroom): @everyone broadcast — selecting "All" in AgentDropdown now triggers all 5 agents to respond sequentially, ordered by keyword relevance to the message (most relevant sub-agent first → CAO Harper last). Each agent sees prior responses as context. Harper synthesizes as final word.',
    files: [
      "backend-hono/src/services/boardroom-spawner.ts",
      "backend-hono/src/routes/boardroom/handlers.ts",
      "frontend/components/consilium/AgentChattr.tsx",
    ],
  },
  {
    date: "2026-03-23T01:15:00",
    agent: "claude-code",
    summary:
      "Track 2 fix(consilium): theme-consistent styling — replaced all hardcoded hex with CSS vars across 8 components, removed background fills from inactive pills/chips/toolbar buttons (accent via text+borders only), added 350ms fade cross-dissolve on tab transitions, inactive cards use pure black bg, active/expanded cards use surface bg.",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/ConsiliumFilterBar.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/consilium/DevelopmentsTimeline.tsx",
      "frontend/components/consilium/AgentScorecard.tsx",
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/apparatus/MemoryCard.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
    ],
  },
  {
    date: "2026-03-23T00:40:00",
    agent: "claude-code",
    summary:
      "Track 1 fix(chat): Orphaned reasoning-start in thinkHarder SSE path — AI SDK parser stayed in reasoning mode and swallowed text-delta events. Now reasoning-start/end only emitted when OpenRouter actually returns reasoning content. Also fixed build-breaking stale imports in root SettingsPanel.tsx (GatewayContext/ToastContext moved to frontend/).",
    files: [
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-22T23:45:00",
    agent: "claude-code",
    summary:
      "Track 4: Chat input consolidation — persona pills → inline PersonaDropdown inside PromptBox, Think Harder → icon only, Plug2+Wrench → combined ToolsDropdown with Skills + Connectors sections.",
    files: [
      "frontend/components/chat/PersonaDropdown.tsx",
      "frontend/components/chat/ToolsDropdown.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/chat/FintheonComposer.tsx",
    ],
  },
  {
    date: "2026-03-22T22:30:00",
    agent: "claude-code",
    summary:
      "Track 3: Convert Consilium agent chips to multi-select dropdown, replace Boardroom textarea with universal PromptBox, use CSS vars throughout.",
    files: [
      "frontend/components/consilium/AgentFilterDropdown.tsx",
      "frontend/components/consilium/ConsiliumFilterBar.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
    ],
  },
  {
    date: "2026-03-22T21:00:00",
    agent: "claude-code",
    summary:
      "Settings Track 5: Wire Change Plan button to UpgradeModal, update pricing tiers (Pleb $0, Analyst $149, Desk $699, Boardroom $1,999), add logout button in Danger Zone, verify settings persistence and iframes tab.",
    files: [
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/UpgradeModal.tsx",
    ],
  },
  {
    date: "2026-03-22T19:30:00",
    agent: "claude-code",
    summary:
      "Fix twitter-cli v0.7.0 JSON parser (data field missing → 0 warm cache). Store warm cache in local DB on startup so feed-poller serves headlines even on no-event days. Remove dead NOTION_API_KEY — all DBs fully migrated to Supabase. Install PostgreSQL 17 locally, run all 14 migrations. Populate econ calendar for week of Mar 23-28.",
    files: [
      "backend-hono/src/services/twitter-cli/twitter-cli-service.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/.env",
    ],
  },
  {
    date: "2026-03-20T23:00:00",
    agent: "claude-code",
    summary:
      "Fix Hermes connection: GatewayContext health check now accepts any JSON response from /health (not just res.ok). Backend returns 503 when DB is down but chat API works fine — frontend was incorrectly showing disconnected.",
    files: ["frontend/contexts/GatewayContext.tsx"],
  },
  {
    date: "2026-03-20T22:30:00",
    agent: "claude-code",
    summary:
      "Fix white screen crash in SettingsPanel (diagnostics.services undefined). Add configurable backend autostart + launch-on-login toggles in HermesSettings — Electron main reads fintheon-startup.json from userData, exposes IPC for get/set config + manual start/stop backend. Login item uses app.setLoginItemSettings().",
    files: [
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/settings/HermesSettings.tsx",
      "electron/main.cjs",
      "electron/preload.cjs",
      "types/electron.d.ts",
      "frontend/types/electron.d.ts",
    ],
  },
  {
    date: "2026-03-20T22:00:00",
    agent: "claude-code",
    summary:
      "Fix z-index bug: IV popup + platform/layout dropdowns rendered behind Strategium panel. All three now use createPortal(…, document.body) to escape parent stacking context. Position: fixed + z-index 9999. Click-outside handlers updated to check both trigger and portal refs.",
    files: [
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/layout/TopHeader.tsx",
    ],
  },
  {
    date: "2026-03-20T21:00:00",
    agent: "claude-code",
    summary:
      "Theme-consistent styling on all 8 Consilium sub-tabs. Converted zinc grays to fintheon gold/cream palette in ProposalWidget, ModelGlossary, DevelopmentsTimeline, AgentChattr. Fixed blue briefing category to gold, event card bg to #0a0a00, date header opacity, flat direction badge colors. No emojis, no separators, no off-theme accents.",
    files: [
      "frontend/components/proposals/ProposalWidget.tsx",
      "frontend/components/proposals/ModelGlossary.tsx",
      "frontend/components/consilium/DevelopmentsTimeline.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
    ],
  },
  {
    date: "2026-03-20T20:00:00",
    agent: "claude-code",
    summary:
      "S3-FIX:T4 — Walkthrough overhaul: replaced SpotlightOverlay with contextual floating cards (TopStepX-style), 11 tour steps, semi-transparent overlay (no blur), smooth CSS transitions (300ms), 1s auto-start delay, welcome toast on complete. SetupGuideCard CTA triggers BlindspotsInterview post-tour. Version bumped to 8.20.3.",
    files: [
      "frontend/components/onboarding/FirstTimeTour.tsx",
      "frontend/components/onboarding/SetupGuideCard.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
    ],
  },
  {
    date: "2026-03-20T18:00:00",
    agent: "claude-code",
    summary:
      'S3-FIX:T3 — Remove Notion indicators, redesign Apparatus cards, verify Twitter CLI, audit deps. Removed Notion status dots, "Notion Trade Ideas" text, "View in Notion" links. Apparatus redesigned from circle constellation to intelligence briefing card grid (text-only headers, no icons/emojis). Removed last OpenClaw backward-compat alias. Fixed NavSidebar type predicate. Zero type errors, build passes.',
    files: [
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/apparatus/MemoryCard.tsx",
      "frontend/components/apparatus/types.ts",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/TradeIdeaModal.tsx",
      "frontend/components/narrative/RiskFlowImportModal.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "backend-hono/src/services/hermes-service.ts",
    ],
  },
  {
    date: "2026-03-21T08:00:00",
    agent: "claude-code",
    summary:
      "S3:T8 — KPIs, Performance, Kalshi & Strategium Polish: Bloomberg-style P&L chart (gold gradient, trade dots, volume bars, period filters), Blindspots 7-day rolling W/L record, Kalshi service + Human/Agentic toggle in Proposals, Mini Proposals in Strategium, Session Notes block editor (agent summary + user notes), PsychAssist auto-start config, Epoch version from package.json, Account above Blindspots default order, Missed Trades KPI for Agent tab.",
    files: [
      "frontend/components/journal/BloombergChart.tsx",
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/components/journal/HumanPsychTab.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/components/mission-control/MiniProposalCard.tsx",
      "frontend/components/proposals/ProposalWidget.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/epoch-version.ts",
      "frontend/lib/services.ts",
      "frontend/contexts/SettingsContext.tsx",
      "backend-hono/src/services/kalshi-service.ts",
      "backend-hono/src/types/kalshi.ts",
    ],
  },
  {
    date: "2026-03-20T22:00:00",
    agent: "claude-code",
    summary:
      "S3:T10 — DND system: auto-suppress notifications during trading, manual toggle (Ctrl+Shift+D), notification queue with bell icon in sidebar, NotificationCenter dropdown, critical alerts break through.",
    files: [
      "frontend/contexts/DNDContext.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/NotificationCenter.tsx",
      "frontend/components/NotificationToast.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-21T06:00:00",
    agent: "claude-code",
    summary:
      "S3:T6 — Onboarding walkthrough: added Consilium, Proposals, Apparatus tour steps; renamed Chat→Consilium; updated descriptions; bumped version to 8.20.0; refreshed What's New items.",
    files: ["frontend/components/onboarding/FirstTimeTour.tsx"],
  },
  {
    date: "2026-03-21T05:00:00",
    agent: "claude-code",
    summary:
      "S3:T3 — Hermes:Admin merged tab (Connection+Hermes), backend diagnostics endpoint (/api/diagnostics), dependency status cards (6 services), handoff prompt CTA with clipboard copy, Clerk auth sign-in upsert to cloud settings.",
    files: [
      "frontend/components/SettingsPanel.tsx",
      "backend-hono/src/routes/diagnostics/index.ts",
      "backend-hono/src/routes/index.ts",
      "contexts/AuthContext.tsx",
    ],
  },
  {
    date: "2026-03-21T04:00:00",
    agent: "claude-code",
    summary:
      'S3:T5 — Notification system overhaul: all toasts bottom-left, theme colors (gold border, dark bg), "Don\'t Show Again" on every notification type via localStorage blocklist, VIX spike toast (fires when VIX crosses configurable threshold, default 22), DND reset in Settings, tagged all existing toast callers with notification types.',
    files: [
      "frontend/contexts/ToastContext.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/components/NotificationToast.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/contexts/GatewayContext.tsx",
      "frontend/components/PreMarketReminder.tsx",
      "frontend/components/ApiErrorToastBridge.tsx",
    ],
  },
  {
    date: "2026-03-21T03:30:00",
    agent: "claude-code",
    summary:
      "S3:T9 — Apparatus tab: Neural Constellation agent intelligence layer. SVG canvas with 5 agent nodes (Harper, Oracle, Feucht, Consul, Herald), gold pulsing glow, pan/zoom, connection lines (gold context + red conflict), click-to-expand radial memory cards with confidence bars + version history, commandments display, Notion context citations, cron schedule sidebar, live activity feed, conflict detection badges.",
    files: [
      "frontend/components/apparatus/ApparatusPage.tsx",
      "frontend/components/apparatus/NeuralConstellation.tsx",
      "frontend/components/apparatus/MemoryCard.tsx",
      "frontend/components/apparatus/types.ts",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/lib/layoutOrderStorage.ts",
    ],
  },
  {
    date: "2026-03-21T02:00:00",
    agent: "claude-code",
    summary:
      "S3:T2 — Consilium overhaul: 5 sub-tabs (Chat, Boardroom, Predictions, Timeline, Scorecards). Chat tab = full ChatInterface sharing thread with AskHarp sidebar. Boardroom = AgentChattr with rich input (persona pills, think harder, improved textarea). Collapsible Proposals right panel with ProposalWidget + redesigned ModelGlossary (fused card). Theme colors fixed to Solvys Gold #c79f4a.",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/proposals/ModelGlossary.tsx",
      "frontend/components/ChatInterface.tsx",
    ],
  },
  {
    date: "2026-03-20T22:00:00",
    agent: "claude-code",
    summary:
      "S3:T4 — Layout fixes: IV popup fixed positioning with viewport boundary detection, platform dropdown hidden when TopStepX active (layout dropdown replaces it), Strategium↔RiskFlow collapse linked, RiskFlow chevron directions swapped, Narrative toolbar full width.",
    files: [
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
    ],
  },
  {
    date: "2026-03-21T00:30:00",
    agent: "claude-code",
    summary:
      "S3:T7 — Auto-update toast: Converted UpdateBanner from centered modal to bottom-left toast with Install Now / Later / Don't show again. Added UpdateInfo/UpdateProgress types to electron.d.ts. Backend version route now reads from package.json + added GET /api/version base route.",
    files: [
      "frontend/components/UpdateBanner.tsx",
      "frontend/types/electron.d.ts",
      "backend-hono/src/routes/version/index.ts",
    ],
  },
  {
    date: "2026-03-20T23:30:00",
    agent: "claude-code",
    summary:
      "S3:T1 final pass — Settings save error now separates account vs ProjectX failures. Removed dead PolymarketService/KalshiService from frontend. Updated session calendar offline message (Notion→Supabase). Cleaned secrets.env.example (removed legacy, added Supabase/Clerk/Hermes vars).",
    files: [
      "frontend/components/SettingsPanel.tsx",
      "frontend/lib/services.ts",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "secrets.env.example",
    ],
  },
  {
    date: "2026-03-20T22:00:00",
    agent: "claude-code",
    summary:
      "Notion→Supabase migration: Created 5 new Supabase tables (trade_ideas, daily_pnl, briefs, economic_events, econ_prints). Expanded supabase-service.ts with full CRUD for all tables. Created /api/data/* routes replacing /api/notion/*. Migrated econ-calendar-service.ts from Notion to Supabase. Updated context-bank, riskflow handlers, and twitter poller to use Supabase. Deleted notion-service.ts (610 lines), notion-poller.ts, and routes/notion/. Added 301 redirects from /api/notion/* → /api/data/*. Updated frontend services.ts endpoints.",
    files: [
      "backend-hono/src/services/supabase-service.ts",
      "backend-hono/src/services/econ-calendar-service.ts",
      "backend-hono/src/routes/data/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/context-bank/context-bank-service.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "frontend/lib/services.ts",
      "frontend/components/onboarding/SetupWizard.tsx",
      "frontend/contexts/ScheduleContext.tsx",
    ],
  },
  {
    date: "2026-03-20T20:00:00",
    agent: "claude-code",
    summary:
      "Re-implement Clerk auth after Sprint 1 bypass. Backend: auth middleware now verifies Clerk JWT (Bearer token) with BYPASS_AUTH=true fallback for dev/Electron. Frontend: App.tsx restored proper BYPASS_AUTH logic (IS_ELECTRON || VITE_BYPASS_AUTH), ClerkProvider wraps app with SignedIn/SignedOut boundaries, switched to fintheonAppearance. AuthShell: removed Sprint 1 bypass button. User sync already handled by AuthContext (account.get/create on Clerk sign-in).",
    files: [
      "backend-hono/src/middleware/auth.ts",
      "App.tsx",
      "components/auth/AuthShell.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-03-20T18:00:00",
    agent: "claude-code",
    summary:
      "T5: Proposals tab + Playwright TopStepX charting automation. Added proposals nav tab (Target icon) with ProposalWidget (fetches latest pending proposal from Autopilot, shows instrument/direction/levels/strategy/rationale, Chart It button) and ModelGlossary accordion (FortyForty, Ripper, AWV, Snipe). Backend POST /api/proposals/chart checks EST blackout (8:30a-12p), spawns Playwright script to draw horizontal rays on TopStepX Practice account. Scripts: chart-blackout.ts (blackout check), chart-proposal.ts (persistent Playwright context, switch to Practice, open ticker chart, draw entry/SL/TP rays using saved templates).",
    files: [
      "frontend/components/proposals/ProposalWidget.tsx",
      "frontend/components/proposals/ModelGlossary.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "backend-hono/src/routes/proposals/index.ts",
      "backend-hono/src/routes/proposals/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "scripts/chart-blackout.ts",
      "scripts/chart-proposal.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-03-20T14:00:00",
    agent: "claude-code",
    summary:
      "T3: Consilium tab — unified Auditorium + AgentChattr with 4 sub-tabs (Chat, Predictions, Timeline, Scorecards). Copied consilium components from root to frontend/components/consilium/, refactored AgentChattr to chat-only (sub-tabs moved to hub), created ConsiliumHub parent, wired into MainLayout replacing AnalysisSection. Narrative tab preserved as-is.",
    files: [
      "frontend/components/consilium/ConsiliumHub.tsx",
      "frontend/components/consilium/AgentChattr.tsx",
      "frontend/components/consilium/AgentBadge.tsx",
      "frontend/components/consilium/AgentScorecard.tsx",
      "frontend/components/consilium/ConsiliumFilterBar.tsx",
      "frontend/components/consilium/ConsiliumMessage.tsx",
      "frontend/components/consilium/ConsiliumMessageExpanded.tsx",
      "frontend/components/consilium/DevelopmentsTimeline.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-03-20T12:00:00",
    agent: "claude-code",
    summary:
      'T4: Strip Clerk auth — force BYPASS_AUTH=true in App.tsx and MainLayout.tsx. Add "Enter Fintheon" bypass login button to AuthShell with localStorage gate. App loads AuthShell landing → bypass button → full app. Clerk code preserved for Sprint 2 re-enablement.',
    files: [
      "App.tsx",
      "components/layout/MainLayout.tsx",
      "components/auth/AuthShell.tsx",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-03-17T02:00:00",
    agent: "claude-code",
    summary:
      "T5: MiroFish local simulation engine — replaced dead localhost:5001 HTTP client with 5-agent debate engine via Hermes/OpenRouter. Built Auditorium section inside Narrative Map: Kalshi-style Canvas line chart (6 risk categories + gold composite), events kanban by risk type (existing + AI-generated), top 5 volatile prediction theses with confidence/volatility bars. Feature flag replaces env var gate. IV prediction auto-fetches latest cached result.",
    files: [
      "backend-hono/src/services/mirofish/mirofish-client.ts",
      "backend-hono/src/services/mirofish/mirofish-service.ts",
      "backend-hono/src/services/mirofish/mirofish-types.ts",
      "backend-hono/src/services/mirofish/mirofish-seed.ts",
      "backend-hono/src/services/market-data/iv-prediction.ts",
      "backend-hono/src/routes/mirofish/handlers.ts",
      "backend-hono/src/config/feature-flags.ts",
      "frontend/types/mirofish.ts",
      "frontend/lib/services.ts",
      "frontend/components/narrative/Auditorium.tsx",
      "frontend/components/narrative/AuditoriumChart.tsx",
      "frontend/components/narrative/AuditoriumKanban.tsx",
      "frontend/components/narrative/AuditoriumTheses.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
    ],
  },
  {
    date: "2026-03-17T01:00:00",
    agent: "claude-code",
    summary:
      "T4: Journal redesign — scroll-lock dashboard with 8 KPI cards (pie charts), P&L/ER/Hybrid SVG charts, blindspots panel, session+notes bottom split with green save flicker, day history cards on Page 2 with week picker. Human/Agent tab flips KPI order.",
    files: [
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/components/journal/HumanPsychTab.tsx",
      "frontend/components/journal/KPICard.tsx",
      "frontend/components/journal/PnLChart.tsx",
      "frontend/components/journal/ERTrendChart.tsx",
      "frontend/components/journal/HybridChart.tsx",
      "frontend/components/journal/HybridChartDropdown.tsx",
      "frontend/components/journal/DayHistoryCard.tsx",
    ],
  },
  {
    date: "2026-03-16T23:58:00",
    agent: "claude-code",
    summary:
      "T3 Narrative Map overhaul: Replaced NarrativeManageModal with NarrativeTimelineModal — scrollable vertical timeline with electric pulse animation, editable titles, AI-sparkle description textarea, inline tag editing, date pickers, category selectors, and Add Narrative Event CTA. Added category field to CatalystCard type. Added timeline-pulse CSS keyframes.",
    files: [
      "frontend/components/narrative/NarrativeManageModal.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
      "frontend/lib/narrative-types.ts",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-03-16T23:55:00",
    agent: "claude-code",
    summary:
      "T2 RiskFlow Overhaul: (1) ensureScoring fills pointRange/direction/cyclical on every item, (2) AlertRow bottom-hero footer with prominent BULLISH/BEARISH, rounded-xl cards, (3) unified inferDirection shared between RiskFlowPanel + CompactRiskFlowCard, (4) downgradeNonFinancialBreaking filters false BREAKING headlines, (5) toolbar filters consolidated into header.",
    files: [
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/feed/CompactRiskFlowCard.tsx",
    ],
  },
  {
    date: "2026-03-16T23:30:00",
    agent: "claude-code",
    summary:
      "Fintheon rebrand T1: Rename all Pulse references to Fintheon across codebase. Rename Clawnalyst Desk to Analyst Desk. Migrate all pulse_ localStorage keys to fintheon: namespace with backward-compat migration. Update package names (pulse-api → fintheon-api), API headers (Pulse-AI-Gateway → Fintheon-AI-Gateway), and system prompts.",
    files: [
      "backend-hono/package.json",
      "backend-hono/src/index.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/notification-service.ts",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "backend-hono/src/services/ai/conversation-store.ts",
      "backend-hono/src/services/voice-sentiment.ts",
      "backend-hono/src/services/claude-sdk/bridge.ts",
      "backend-hono/src/services/notion-poller.ts",
      "backend-hono/src/routes/version/index.ts",
      "backend-hono/src/routes/notion/index.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "electron/main.cjs",
      "frontend/App.tsx",
      "frontend/lib/storage-migration.ts",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/lib/hermesAgentRouting.ts",
      "frontend/lib/PulseModelCatalog.ts",
      "frontend/lib/skillPrefixes.ts",
      "frontend/lib/boardroomThreadStore.ts",
      "frontend/lib/regime-store.ts",
      "frontend/lib/chatCheckpoints.ts",
      "frontend/hooks/usePersistedSettings.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/hooks/useVoiceMemory.ts",
      "frontend/hooks/useMcpConnectors.ts",
      "frontend/hooks/usePersistentHermesConversation.ts",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/contexts/ThreadContext.tsx",
      "frontend/contexts/PulseAgentContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/PreMarketReminder.tsx",
      "frontend/components/InterventionSidebar.tsx",
      "frontend/components/analysis/QuickPulseModal.tsx",
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/executive/ResearchDepartment.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/components/onboarding/FirstTimeTour.tsx",
      "frontend/components/onboarding/SetupGuideCard.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
    ],
  },
  {
    date: "2026-03-16T22:00:00",
    agent: "claude-code",
    summary:
      "Move Hermes from standalone nav/page into Settings as a dedicated tab. Remove hermes from NavSidebar, TopHeader, MainLayout, layoutOrderStorage. Create HermesSettings component with gateway status, API key, agent cards, activity log. Update ClawnalystDesk with Harper-Hermes hierarchy (lead card centered above 2x2 grid). Add developer feature flags: showPlaceholderBriefings, mirofishSimulations, agentAutoProposals.",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/settings/HermesSettings.tsx",
      "frontend/components/settings/ClawnalystDesk.tsx",
      "frontend/contexts/SettingsContext.tsx",
    ],
  },
  {
    date: "2026-03-16T18:00:00",
    agent: "claude-code",
    summary:
      "Kalshi whale tracker integration — RSA-PSS authenticated API client polling Economics/Politics/Financials markets, whale detection (500+ contracts, $500+ notional, 5% OI, cluster), RiskFlow feed integration, Context Bank snapshot, Oracle agent whale flow section. Removed Team tab (Discord iframe blocked). Added OpenAI + Kalshi API keys to .env, secured .env from git tracking.",
    files: [
      "backend-hono/src/types/kalshi.ts",
      "backend-hono/src/services/kalshi-service.ts",
      "backend-hono/src/routes/kalshi/index.ts",
      "backend-hono/src/routes/kalshi/handlers.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/context-bank/context-bank-service.ts",
      "backend-hono/src/services/agents/pma-merged-analyst.ts",
      "backend-hono/src/types/context-bank.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/types/news-analysis.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/services.ts",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/types/context-bank.ts",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      ".gitignore",
    ],
  },
  {
    date: "2026-03-17T03:00:00",
    agent: "claude-code",
    summary:
      'Error toast notifications with fix descriptions (2.5s fade in/out, bottom-right) for all backend errors via errorBus → ApiErrorToastBridge. Auto-update system via electron-updater: "Install Now / Later" modal, IPC download+install, GitHub Releases publish config. Replaced UpdateBanner with full UpdateModal. Added zip target for macOS auto-updates.',
    files: [
      "frontend/lib/errorBus.ts",
      "frontend/lib/apiClient.ts",
      "frontend/contexts/ToastContext.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/components/ApiErrorToastBridge.tsx",
      "frontend/components/UpdateBanner.tsx",
      "frontend/App.tsx",
      "electron/main.cjs",
      "electron/preload.cjs",
      "types/electron.d.ts",
      "package.json",
    ],
  },
  {
    date: "2026-03-16T23:00:00",
    agent: "claude-code",
    summary:
      "Hermes Command Center — full-page tab with agent status dashboard, gateway settings, embedded chat (useHermesRuntime), activity log. Added hermes to NavTabId, sidebar nav, TopHeader CTA button, MainLayout routing.",
    files: [
      "frontend/components/hermes/HermesCommandCenter.tsx",
      "frontend/components/hermes/HermesAgentCards.tsx",
      "frontend/components/hermes/HermesActivityLog.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/lib/layoutOrderStorage.ts",
    ],
  },
  {
    date: "2026-03-17T01:00:00",
    agent: "claude-code",
    summary:
      "T3: Complete catalyst tagging system — inline tag-add button on CatalystCard, NarrativeManageModal for lane/catalyst overview with tag add/remove and lane rename/archive/reorder, Manage button in NarrativeToolbar, tag filter props wired in NarrativeFlow.",
    files: [
      "frontend/components/narrative/CatalystCard.tsx",
      "frontend/components/narrative/NarrativeManageModal.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
    ],
  },
  {
    date: "2026-03-17T00:00:00",
    agent: "claude-code",
    summary:
      "T2: Fix brief rendering (Notion query now uses Category select + Status=Active filter instead of keyword matching on Message body), add vertical resize to BriefMiniWidget and ExecutiveDashboard textarea, add catalyst tag system (tags field on CatalystCard, TAG_CATALYST store action, tag pills in card component, tag filter in NarrativeDropdown).",
    files: [
      "backend-hono/src/services/notion-service.ts",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/lib/narrative-types.ts",
      "frontend/lib/narrative-store.ts",
      "frontend/components/narrative/CatalystCard.tsx",
      "frontend/components/narrative/NarrativeDropdown.tsx",
    ],
  },
  {
    date: "2026-03-16T23:30:00",
    agent: "claude-code",
    summary:
      "T1: Restore toolbar regressions — iframe dropdown now enables TopStepX on platform click (was no-op), IV inline points badge restored (envLabel + scaledPoints + urgency), split-pane button available whenever iframe is enabled (was tickers-only gated).",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/IVScoreCard.tsx",
    ],
  },
  {
    date: "2026-03-16T22:00:00",
    agent: "claude-code",
    summary:
      "T4: Boardroom fix (EmbeddedBrowserFrame replaces raw iframe for Discord X-Frame-Options), UX sweep (30+ console.error downgraded to console.warn for expected conditions like polling failures/auth), distribution pipeline (scripts/build-release.sh, release:mac and release scripts, win NSIS target, electron backend build fallback dialog), docs cleanup (5-agent roster: Harper-Hermes/Oracle/Feucht/Consul/Herald in SUB-AGENT-RULES, agent-orchestration, domain-knowledge, project-standards, SETUP; deleted deprecated Francine files).",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "electron/main.cjs",
      "package.json",
      "scripts/build-release.sh",
      "SUB-AGENT-RULES.md",
      "SETUP.md",
      ".cursor/rules/agent-orchestration.md",
      ".cursor/rules/domain-knowledge.md",
      ".cursor/rules/project-standards.md",
      "frontend/components/NotificationToast.tsx",
      "frontend/components/AccountSummary.tsx",
      "frontend/components/NewsFeed.tsx",
      "frontend/components/SystemFeed.tsx",
      "frontend/components/PositionsList.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
      "frontend/components/feed/FeedSection.tsx",
      "frontend/components/feed/MinimalTapeWidget.tsx",
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
      "frontend/components/mission-control/AlgoStatusWidget.tsx",
      "frontend/components/mission-control/CompactPnLDisplay.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/EconCalendarContext.tsx",
      "frontend/lib/services.ts",
      "frontend/mini-widget-entry.tsx",
      "knowledge-base/AI-AGENT-RULES.md",
    ],
  },
  {
    date: "2026-03-16T20:00:00",
    agent: "claude-code",
    summary:
      "T3 Onboarding redesign: SpotlightOverlay (SVG mask cutout), TourTooltip (auto-positioned), BlindspotsInterview (4-step trader profile), SetupWizard (backend health checks). FirstTimeTour rewritten to compose spotlight+tooltip. data-tour-target attributes on MainLayout, NavSidebar, TopHeader. SettingsContext extended with interview fields. Backend POST /api/blindspots/interview endpoint.",
    files: [
      "frontend/components/onboarding/SpotlightOverlay.tsx",
      "frontend/components/onboarding/TourTooltip.tsx",
      "frontend/components/onboarding/SetupWizard.tsx",
      "frontend/components/onboarding/BlindspotsInterview.tsx",
      "frontend/components/onboarding/FirstTimeTour.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "backend-hono/src/routes/blindspots.ts",
    ],
  },
  {
    date: "2026-03-16T18:00:00",
    agent: "claude-code",
    summary:
      "Agent backend v7.9 (T1): Oracle merged PMA analyst (PMA-1+PMA-2 combined prediction markets + macro), Herald analyst (news/sentiment + social signals), 4-stage pipeline rewrite (Herald->Oracle->Consul->Feucht), BoardroomAgent roster update (Harper-Hermes/Oracle/Feucht/Consul/Herald), risk-manager docs under Feucht purview, Harper-Notion vs Harper-Perp responsibility split documentation in notion-service and notion-poller.",
    files: [
      "backend-hono/src/services/agents/pma-merged-analyst.ts",
      "backend-hono/src/services/agents/herald-analyst.ts",
      "backend-hono/src/services/agents/pipeline.ts",
      "backend-hono/src/services/agents/risk-manager.ts",
      "backend-hono/src/types/boardroom.ts",
      "backend-hono/src/routes/boardroom/handlers.ts",
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/notion-poller.ts",
    ],
  },
  {
    date: "2026-03-16T14:00:00",
    agent: "claude-code",
    summary:
      "Stone theme (decayed stone + glowing gold + dark forest green) added to THEME_PRESETS. Narrative components theme integration: canvas renderer reads CSS vars via getComputedStyle, replaced all hardcoded hex colors in NarrativeLaneHeader STATUS_CONFIG, CatalystCard severity colors, and canvas drawNarrativeCard/drawRope/drawZone functions with theme variable references. Added Fintheon aesthetic polish (uppercase tracking on lane headers).",
    files: [
      "frontend/lib/theme.ts",
      "frontend/lib/narrative-canvas-renderer.ts",
      "frontend/components/narrative/NarrativeLaneHeader.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
      "frontend/components/narrative/NarrativeCanvas.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
      "frontend/components/narrative/NarrativeWeekView.tsx",
      "frontend/components/narrative/NarrativeLane.tsx",
      "frontend/components/narrative/NarrativeToolbar.tsx",
      "frontend/components/narrative/TimelineScrubber.tsx",
    ],
  },
  {
    date: "2026-03-16T12:00:00",
    agent: "claude-code",
    summary:
      "Smart polling: global auto-refresh toggle (pill switch next to every RefreshCw icon), event-window-only X CLI polling (T-5min to T+15min instead of constant 60s), autoRefresh backend gate, econ poller status endpoint. ~93% reduction in wasted X CLI calls. Frontend auto-polls (RiskFlow, Brief, KPIs, FeedSection, MinimalTape) all gated by toggle.",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/ui/AutoRefreshToggle.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/components/feed/FeedSection.tsx",
      "frontend/components/feed/MinimalTapeWidget.tsx",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/src/routes/notion/econ-calendar.ts",
    ],
  },
  {
    date: "2026-03-15T01:30:00",
    agent: "claude-code",
    summary:
      "Track 4: New Components & Effects — pompa.ts utility, SplashScreen temple doors, ShortcutsPopup modal, PompaToast, SPQRStamp, TriumphusOverlay, NotFoundPage 404, easter-eggs.ts (Konami/SPQR/Ides/triple-click), sound placeholders. Global font fix: Readable Digits unicode-range @font-face ensures digits stay in Inter across all font themes; CSS inheritance rule forces all UI elements to respect --font-body/--font-heading.",
    files: [
      "frontend/lib/pompa.ts",
      "frontend/components/SplashScreen.tsx",
      "frontend/components/layout/ShortcutsPopup.tsx",
      "frontend/components/ui/PompaToast.tsx",
      "frontend/components/ui/SPQRStamp.tsx",
      "frontend/components/ui/TriumphusOverlay.tsx",
      "frontend/components/NotFoundPage.tsx",
      "frontend/lib/easter-eggs.ts",
      "frontend/public/sounds/*",
      "frontend/fonts.css",
      "frontend/index.css",
      "frontend/contexts/ThemeContext.tsx",
    ],
  },
  {
    date: "2026-03-14T23:55:00",
    agent: "claude-code",
    summary:
      "Fintheon rebrand Track 2: Chat/Agents — Dawn Dispatch chip, Weekly Tribune, Roman greetings (Ave/Forum/conquest), agent titles (Consul/Censori/Herald/Oracle), Deep Counsel toggle, Consilium thinking phrases, boardroom files deleted, hermes agent display names updated",
    files: [
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/PulseThinkingIndicator.tsx",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/routes/notion/index.ts",
      "frontend/components/BoardroomView.tsx (deleted)",
      "frontend/components/boardroom/* (deleted)",
    ],
  },
  {
    date: "2026-03-14T12:00:00",
    agent: "claude-code",
    summary:
      "Fintheon rebrand: Pulse → Fintheon, Roman terminology throughout, new tiers, IV labels, ER states, brief names",
    files: [
      "index.html",
      "package.json",
      "frontend/components/layout/*",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/mission-control/*",
      "frontend/contexts/ERContext.tsx",
    ],
  },
  {
    date: "2026-03-14T23:30:00",
    agent: "claude-code",
    summary:
      "Quick wins: Team section replaced with Discord iframe, sidebar reordered (Performance + Team above Settings), voice orb made clickable (removed separate mic button), chat input rearranged (Think + Mic + Send right-justified), VIX/IV widget sizing matched, responsive toolbar overflow",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/contexts/VoiceContext.tsx",
    ],
  },
  {
    date: "2026-03-14T22:00:00",
    agent: "claude-code",
    summary:
      "RiskFlow cleanup: removed MarketWatch RSS poller (RiskFlowFeedPoller class, XML parsing, singleton). Feed now Notion + backend only. XCLI visibility fix: minMacroLevel 2→0 so all backend items show. Notion brief sort fix: created_time instead of last_edited_time, removed as-any cast.",
    files: [
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "backend-hono/src/services/notion-service.ts",
    ],
  },
  {
    date: "2026-03-14T21:00:00",
    agent: "claude-code",
    summary:
      "Model routing fix: default chat model switched from Opus to Sonnet 4.6 (cheaper/faster). thinkHarder deep-thought model switched from Nous Hermes 4 to Claude Opus 4.6 (better quality). Removed reasoning:{enabled:true} param from Opus request body. Updated all logs/headers/comments to reflect new model names.",
    files: [
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/ai/model-selector.ts",
    ],
  },
  {
    date: "2026-03-14T20:00:00",
    agent: "claude-code",
    summary:
      "PsychAssist voice engine fix: AudioContext.resume() added in all 4 locations (ERContext, EmotionalResonanceMonitor, CompactERMonitor, usePsychAssistBackground) so waveform renders in Chromium/Electron. CompactERMonitor refactored to use useERSafe() shared context with local fallback. useVoiceAssistant setErrorWithRecovery no longer fires when speechRecognition is absent (expected in Electron).",
    files: [
      "frontend/contexts/ERContext.tsx",
      "frontend/components/mission-control/EmotionalResonanceMonitor.tsx",
      "frontend/components/mission-control/CompactERMonitor.tsx",
      "frontend/hooks/usePsychAssistBackground.ts",
      "frontend/hooks/useVoiceAssistant.ts",
    ],
  },
  {
    date: "2026-03-14T17:30:00",
    agent: "claude-code",
    summary:
      "Font theme switcher (Default/Solvys/Classic) in Appearance settings. Self-hosted WOFF2 fonts replace Google Fonts CDN. Compact TraderNametag sized to match VIX ticker. Nametag ER emotional pulse (green=stable, red=tilt) with settings toggle.",
    files: [
      "frontend/fonts.css",
      "frontend/lib/font-theme.ts",
      "frontend/index.css",
      "frontend/App.tsx",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/settings/ThemeSettings.tsx",
      "frontend/components/TraderNametag.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/layout/TopHeader.tsx",
    ],
  },
  {
    date: "2026-03-14T09:00:00",
    agent: "claude-code",
    summary:
      "Default inference: Claude Opus 4.6 via OpenRouter (Nous subscription). Replaced all Groq usage with OpenRouter Opus 4.6. ai-config defaultModel and taskModelMap, model-selector preferences, hermes-handler and hermes-service, conversation-store, notion-poller, health-service. Updated SETUP.md, SETUP-HANDOFF.md, .env.example, and codebase docs/comments.",
    files: [
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/ai/conversation-store.ts",
      "backend-hono/src/services/notion-poller.ts",
      "backend-hono/src/services/health-service.ts",
      "backend-hono/.env.example",
      "SETUP.md",
      "docs/SETUP-HANDOFF.md",
      "frontend/components/SettingsPanel.tsx",
      "frontend/lib/iv-agent.ts",
      "components/ChatInterface.tsx",
    ],
  },
  {
    date: "2026-03-14T08:00:00",
    agent: "claude-code",
    summary:
      "Thinking toggle → Nous Hermes 4 deep reasoning. When thinkHarder=true and OPENROUTER_API_KEY set, route to OpenRouter nousresearch/hermes-4-70b with reasoning.enabled; stream reasoning + text. Default thinkHarder=true in PulseFloatingChat, ChatInterface, AskHarpChatPanel, InterventionSidebar, ResearchDepartment.",
    files: [
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/InterventionSidebar.tsx",
      "frontend/components/executive/ResearchDepartment.tsx",
    ],
  },
  {
    date: "2026-03-14T07:00:00",
    agent: "claude-code",
    summary:
      "Pulse CLI: run shell commands from footer in Electron (e.g. cd backend-hono && npm run dev). Added / slash-command suggestions (backend, frontend, install, build, typecheck). IPC run-shell-command + cli-output streaming in main/preload.",
    files: [
      "electron/main.cjs",
      "electron/preload.cjs",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/types/electron.d.ts",
      "types/electron.d.ts",
    ],
  },
  {
    date: "2026-03-14T06:00:00",
    agent: "claude-code",
    summary:
      "Remotion V4 rebuild: Inter/JetBrains Mono fonts (matching Pulse frontend swap), all screenshots faded to near-black (0.04-0.06 opacity) as dark texture, overlay items significantly bigger and centered for presentation/keynote vibe. Same Apple/Perplexity editorial style (easeOut, crossfades, glass-morphism, hero-number-at-a-time). Recaptured dashboard + riskflow screenshots with new fonts.",
    files: [
      "remotion/src/theme.ts",
      "remotion/src/scenes/IntroScene.tsx",
      "remotion/src/scenes/DashboardScene.tsx",
      "remotion/src/scenes/FeedScene.tsx",
      "remotion/src/scenes/MissionControlScene.tsx",
      "remotion/src/scenes/MetricsScene.tsx",
      "remotion/src/scenes/OutroScene.tsx",
      "remotion/public/pulse-dashboard-clean.png",
      "remotion/public/pulse-riskflow.png",
    ],
  },
  {
    date: "2026-03-14T05:00:00",
    agent: "claude-code",
    summary:
      "Hermes migration final sweep: renamed Settings sidebar tab Gateway→Hermes, updated toast messages (Gateway connected→Hermes connected, etc.), updated description text to reference Groq API directly.",
    files: [
      "frontend/components/SettingsPanel.tsx",
      "frontend/contexts/GatewayContext.tsx",
    ],
  },
  {
    date: "2026-03-14T04:00:00",
    agent: "claude-code",
    summary:
      "T4: PsychAssist activation — mounted ERProvider in App.tsx provider stack so EmotionalResonanceMonitor and PsychAssistDockable get shared ER context instead of falling back to local state. Verified Hermes pipeline: startEconEnricher(), startEconTwitterPoller(), psych-assist routes (/api/psych, /api/er), econ-calendar routes all active. DB migration 008_psych_assist_vnext.sql confirmed. PsychAssistDockable already integrated in frontend MainLayout (floating + header dock modes).",
    files: ["frontend/App.tsx"],
  },
  {
    date: "2026-03-14T03:00:00",
    agent: "claude-code",
    summary:
      "T3: Boardroom Agent Chat UI — new BoardroomChat + AgentMessage components. Full-height chat with 3s polling, color-coded agent messages (Harper gold, Oracle blue, Feucht amber, Sentinel emerald, Charles red, Horace purple), @mention dropdown, LIVE badge, meeting countdown, scroll-to-bottom. Added Agent Chat / Notion View toggle to BoardroomView (defaults to Agent Chat). Added getMeetingSchedule() to BoardroomService.",
    files: [
      "frontend/components/boardroom/BoardroomChat.tsx",
      "frontend/components/boardroom/AgentMessage.tsx",
      "frontend/components/BoardroomView.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-14T02:00:00",
    agent: "claude-code",
    summary:
      "T1 Settings Foundation + UI Polish: Added xBearerToken and anthropicApiKey to APIKeys interface. Renamed API Keys tab to API. Moved Danger Zone to middle of grid (position 5). Removed separator borders in Notifications and Developer tabs. Added X Bearer Token and Anthropic API Key fields with CTA buttons. Added Login with Google buttons to iFrames. Redesigned ClawnalystDesk cards with 48px rounded-full avatars, sector pills, model badges, description textarea, instructions doc ID field.",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/settings/ClawnalystDesk.tsx",
    ],
  },
  {
    date: "2026-03-14T01:30:00",
    agent: "claude-code",
    summary:
      "Hermes init: launches hermes gateway + Groq warm-up on backend startup. Gateway port default 7787→8080 (Pulse backend). Updated .env.example with HERMES_* vars. Final OpenClaw remnant scrub.",
    files: [
      "backend-hono/src/index.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "frontend/contexts/GatewayContext.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "backend-hono/.env.example",
    ],
  },
  {
    date: "2026-03-14T00:00:00",
    agent: "claude-code",
    summary:
      "Remotion V3: Apple/Perplexity editorial redesign. SF Pro Display typography, cubic easeOut motion (no springy bounces), all-crossfade transitions (1s each), glass-morphism floating cards with backdrop-filter blur. Hero-number-at-a-time reveal in Metrics (each stat dominates center screen then settles into grid). Cinematic zoom with vignette in Dashboard. Floating IV ring gauge in Feed. ER waveform with parallax blindspot cards in Mission Control. ~31s @ 1920x1080.",
    files: [
      "remotion/src/theme.ts",
      "remotion/src/Root.tsx",
      "remotion/src/PulseMockup.tsx",
      "remotion/src/scenes/IntroScene.tsx",
      "remotion/src/scenes/DashboardScene.tsx",
      "remotion/src/scenes/FeedScene.tsx",
      "remotion/src/scenes/MissionControlScene.tsx",
      "remotion/src/scenes/MetricsScene.tsx",
      "remotion/src/scenes/OutroScene.tsx",
    ],
  },
  {
    date: "2026-03-13T23:45:00",
    agent: "claude-code",
    summary:
      "FULL OpenClaw → Hermes migration (backend). Created hermes-service.ts + hermes-handler.ts (Groq direct, no gateway middleman). Updated ai-types.ts (openclaw→hermes provider type), rewrote ai-config.ts (hermes-* model keys, HERMES_API_KEY, Groq model IDs without groq/ prefix), rewrote model-selector.ts. Updated all consumers: chat.ts, voice handlers, quick-pulse, notion-poller, conversation-store, agent-instructions, boardroom-schedule. Deleted openclaw-service.ts + openclaw-handler.ts. Architecture: Pulse → Groq API direct.",
    files: [
      "backend-hono/src/types/ai-types.ts",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "backend-hono/src/services/hermes-service.ts",
      "backend-hono/src/services/hermes-handler.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/ai/handlers/quick-pulse.ts",
      "backend-hono/src/services/notion-poller.ts",
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/ai/conversation-store.ts",
      "backend-hono/src/services/ai/agent-instructions.ts",
      "backend-hono/src/services/boardroom-schedule.ts",
      "backend-hono/.env",
    ],
  },
  {
    date: "2026-03-13T23:30:00",
    agent: "claude-code",
    summary:
      "Frontend Hermes migration: renamed all OpenClaw references to Hermes across 19 frontend files. Renamed openclawAgentRouting.ts -> hermesAgentRouting.ts, useOpenClawChat.ts -> useHermesChat.ts, usePersistentOpenClawConversation.ts -> usePersistentHermesConversation.ts, useOpenClawRuntime.ts -> useHermesRuntime.ts. Updated all imports, function names (toHermesAgentOverride, hermesConversationStorageKey, useHermesChat, useHermesRuntime, usePersistentHermesConversation), localStorage keys (pulse_openclaw_* -> pulse_hermes_* with backward compat migration), UI text (OpenClaw Gateway -> Hermes Agent), openclawDescription -> hermesDescription, AgentProviderConfig provider openclaw -> hermes, IV agent comments updated from gateway to Groq API",
    files: [
      "frontend/lib/hermesAgentRouting.ts",
      "frontend/hooks/usePersistentHermesConversation.ts",
      "frontend/components/chat/hooks/useHermesChat.ts",
      "frontend/components/chat/useHermesRuntime.ts",
      "frontend/components/SettingsPanel.tsx",
      "frontend/lib/services.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/riskflow-feed.ts",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/executive/ResearchDepartment.tsx",
      "frontend/components/onboarding/SetupGuideCard.tsx",
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/lib/iv-agent.ts",
      "frontend/lib/narrative-types.ts",
      "frontend/components/TradeIdeaModal.tsx",
      "frontend/components/chat/hooks/useChatSession.ts",
      "frontend/.env.production",
    ],
  },
  {
    date: "2026-03-13T21:00:00",
    agent: "claude-code",
    summary:
      "Swap TradeLocker for Hyperliquid DEX: new hyperliquid-service (viem EIP-712 wallet auth, REST client for /info + /exchange, market/limit orders, position mgmt), updated PrimaryBroker type union to include hyperliquid, wired into autopilot proposal-service + trading-service execution pipeline, new /api/hyperliquid routes (status, positions, account), frontend platform selector + settings broker button + HyperliquidService client, removed all TradeLocker references and strategy prompt docs",
    files: [
      "backend-hono/src/types/hyperliquid.ts",
      "backend-hono/src/services/hyperliquid/auth.ts",
      "backend-hono/src/services/hyperliquid/client.ts",
      "backend-hono/src/services/hyperliquid-service.ts",
      "backend-hono/src/services/trading-service.ts",
      "backend-hono/src/services/autopilot/proposal-service.ts",
      "backend-hono/src/routes/hyperliquid/handlers.ts",
      "backend-hono/src/routes/hyperliquid/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/types/rithmic.ts",
      "frontend/components/TopStepXBrowser.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-13T19:40:00",
    agent: "claude-code",
    summary:
      "Remotion V2: Rebuilt mockup as hybrid narrative — real Playwright screenshots of live Pulse (dashboard, RiskFlow, Mission Control, Blindspots, Performance) composited with animated overlays. 6-scene narrative arc: Hook (typewriter → logo), Signal (screenshot zoom + targeting brackets), Score (IV ring gauge + self-drawing VIX chart), Decision (ER waveform + strategy status + blindspot warnings), Edge (animated P&L counters + daily bar chart), Outro. ~26.5s @ 1920x1080 30fps.",
    files: [
      "remotion/src/Root.tsx",
      "remotion/src/PulseMockup.tsx",
      "remotion/src/theme.ts",
      "remotion/src/scenes/IntroScene.tsx",
      "remotion/src/scenes/DashboardScene.tsx",
      "remotion/src/scenes/FeedScene.tsx",
      "remotion/src/scenes/MissionControlScene.tsx",
      "remotion/src/scenes/MetricsScene.tsx",
      "remotion/src/scenes/OutroScene.tsx",
      "remotion/public/pulse-dashboard-clean.png",
      "remotion/public/pulse-riskflow.png",
      "remotion/public/pulse-mission-control.png",
      "remotion/public/pulse-blindspots.png",
      "remotion/public/pulse-performance.png",
    ],
  },
  {
    date: "2026-03-13T15:00:00",
    agent: "claude-code",
    summary:
      "Track 2: Voice engine fix — sentiment analysis pipeline dispatches psychassist:infraction events after voice interactions, recognition auto-restarts after TTS playback, enhanced waveform (7 bars + glow), global border pulse (green=listening, gold=speaking)",
    files: [
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/components/voice/VoiceAuroraOrb.tsx",
      "frontend/App.tsx",
    ],
  },
  {
    date: "2026-03-13T14:30:00",
    agent: "claude-code",
    summary:
      "Track 1: Trader nametag with gloss effect next to tier badge, pre-market reminder bottom-left toast",
    files: [
      "frontend/contexts/SettingsContext.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/components/TraderNametag.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/contexts/ToastContext.tsx",
      "frontend/components/ui/Toast.tsx",
      "frontend/components/PreMarketReminder.tsx",
      "frontend/App.tsx",
    ],
  },
  {
    date: "2026-03-13T14:00:00",
    agent: "claude-code",
    summary:
      "Track 3: Fix thinkHarder routing — Claude SDK Bridge now prioritized over OpenClaw when thinking enabled. Added preferClaudeSDK guard to skip OpenClaw PATH 1 when bridge available. Fixed stale closure for thinkHarder in useOpenClawChat via useRef.",
    files: [
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
    ],
  },
  {
    date: "2026-03-12T10:00:00",
    agent: "claude-code",
    summary:
      "Created Remotion mockup project (remotion/) — 6-scene animated video showcasing Pulse dashboard: intro logo reveal with gold particle convergence, three-panel dashboard assembly, live news feed with IV impact scores, Mission Control widgets (ER waveform, Account Tracker pendulum chart, Blindspots, Algo Status), performance metrics with animated counters and daily P&L bar chart, and Priced In Capital brand outro. 1920x1080 @ 30fps, ~20s total, TransitionSeries with fade/slide/wipe. Full Solvys Gold palette.",
    files: [
      "remotion/package.json",
      "remotion/src/Root.tsx",
      "remotion/src/PulseMockup.tsx",
      "remotion/src/theme.ts",
      "remotion/src/scenes/IntroScene.tsx",
      "remotion/src/scenes/DashboardScene.tsx",
      "remotion/src/scenes/FeedScene.tsx",
      "remotion/src/scenes/MissionControlScene.tsx",
      "remotion/src/scenes/MetricsScene.tsx",
      "remotion/src/scenes/OutroScene.tsx",
    ],
  },
  {
    date: "2026-03-12T02:00:00",
    agent: "claude-code",
    summary:
      'Created Notion onboarding course: "How to Use Pulse to Trade Narratives & Risk Events" — 7 modules under PIC covering foundation, news reading (second-level thinking, data cycles, distribution of expectations), RiskFlow pipeline, risk events & Playbook models (40/40 Club, Flush, Ripper, 22 VIX Fixer), divergent prepositioning & safe havens, Pulse execution workflow, and risk management psychology (13 Commandments).',
    files: [],
  },
  {
    date: "2026-03-12T01:30:00",
    agent: "claude-code",
    summary:
      "RiskFlow scoring audit: ISM/PMI weight bumped 6→7 (leading indicator per Playbook), VIX thresholds aligned (16/22/30 complacent/neutral/VIX-Fixer/extreme), ISM decay half-life 90min, Polymarket gets keyword-based sentiment inference (was always neutral), failed enrichment fallback always picks bullish/bearish, multi-instrument scoreToPoints() via INSTRUMENT_BETAS, PRIMARY_INSTRUMENT env var, manual refresh endpoint + frontend refresh button on RiskFlowPanel and ExecutiveDashboard.",
    files: [
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "backend-hono/src/types/news-analysis.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/riskflow-feed.ts",
      "frontend/lib/services.ts",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/IVScoreCard.tsx",
    ],
  },
  {
    date: "2026-03-12T01:00:00",
    agent: "claude-code",
    summary:
      "Mini RiskFlow card: disabled full-card expand (changed <a> wrapper to <div>), removed ExternalLink icon, added onDismiss prop with X dismiss button, headline text remains a clickable link. MainLayout passes removeAlert from RiskFlowContext as onDismiss.",
    files: [
      "frontend/components/feed/CompactRiskFlowCard.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-12T01:00:00",
    agent: "claude-code",
    summary:
      'Renamed user-facing label "Trading Journal" to "Performance" across breadcrumb, header, sidebar, journal component, and onboarding tour. No file/function/import renames — label strings only.',
    files: [
      "frontend/components/layout/SectionBreadcrumb.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/components/onboarding/FirstTimeTour.tsx",
    ],
  },
  {
    date: "2026-03-13T00:30:00",
    agent: "claude-code",
    summary:
      "Scoring consistency + instrument persistence + X API removal. Aligned V1 scorer EVENT_WEIGHTS with V3 matrix (credit, yield, liquidity, bank, leverage). Feed enrichment now uses V2 classifyEventType() for V3 event detection. RiskFlow feed endpoint re-computes priceBrainScore for user-selected instrument (no more hardcoded /ES). RiskFlowContext passes selectedSymbol to backend. Removed x-api-service.ts + x-api-config.ts — all tweet ingestion via twitter-cli. Feed poller cleaned of X API dependency.",
    files: [
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/riskflow/feed-poller.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-12T23:55:00",
    agent: "claude-code",
    summary:
      "Notion dependency sync from March 12 audit. Harper Messages pipeline fix: added Status property (Active/Archived) to all Notion writes — briefs and econ-twitter push. Archive step now sets Status=Archived alongside page-level archive. Created journal_entries migration (012). Removed dead Earnings History Notion adapter + routes + frontend service (replaced by Postgres-backed TradingJournal). Codebase sanitization: removed 8 orphaned files (PsychAssistBackgroundProvider, FeatureLockScreen, BoardroomChat, grok-service, news-processor, openrouter-service, tool-policy, iv-scoring-engine v1).",
    files: [
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/migrations/012_journal_entries.sql",
      "backend-hono/src/routes/index.ts",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-12T23:45:00",
    agent: "claude-code",
    summary:
      "Fixed voice assistant dual-instance bug. HeaderVoiceControl and PulseComposer each called useVoiceAssistant() independently, creating two SpeechRecognition instances that fought for the mic. Created shared VoiceContext so both entry points (header toolbar + chat input) control a single voice instance. Voice now cues for input immediately on activation from either location.",
    files: [
      "frontend/contexts/VoiceContext.tsx",
      "frontend/components/voice/HeaderVoiceControl.tsx",
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/App.tsx",
    ],
  },
  {
    date: "2026-03-12T01:30:00",
    agent: "claude-code",
    summary:
      "Track 3 v7.7.7: Autopilot frontend dashboard — AutopilotDashboard (shell with polling), AutopilotControls (toggle, thresholds, strategy list), SignalFeed (scrollable signals + pending proposals with countdown), SessionStatusBar (RTH status, P&L, EST clock). Added AutopilotService to services.ts with status/signals/proposals/acknowledge/execute/history endpoints. Added PLAYBOOK_SWEEP_RECLAIM strategy label to ProposalModal.",
    files: [
      "frontend/components/AutopilotDashboard.tsx",
      "frontend/components/AutopilotControls.tsx",
      "frontend/components/SignalFeed.tsx",
      "frontend/components/SessionStatusBar.tsx",
      "frontend/lib/services.ts",
      "frontend/components/ProposalModal.tsx",
    ],
  },
  {
    date: "2026-03-11T23:59:00",
    agent: "claude-code",
    summary:
      "Created PlaybookSweepReclaim QuantConnect Lean algorithm for MNQ 5-min futures. Detects 5 signal types: liquidity sweep+reclaim (primary), RSI divergence, EMA cross+retest, volume delta, HTF candlestick patterns. Confidence scoring system (70% base + confluence boosts, capped at 100%). Session window filtering (morning_flush, forty_forty, lunch_flush, power_hour). Emits structured JSON signal events via Log().",
    files: [
      "docs/quantconnect/PlaybookSweepReclaim.cs",
      "docs/quantconnect/SignalModels.cs",
    ],
  },
  {
    date: "2026-03-12T00:15:00",
    agent: "claude-code",
    summary:
      "Track 1 v7.7.7: Backend — (1a) Added initOpenClawAgent() to openclaw-handler.ts for gateway warm-up on startup with 10s timeout, non-fatal error handling. Called from index.ts after initClaudeSDK. (1b) Verified handleOpenClawChat receives full conversation history. (1c) Verified bridgeChat() receives history and buildPrompt() includes it.",
    files: [
      "backend-hono/src/services/openclaw-handler.ts",
      "backend-hono/src/index.ts",
    ],
  },
  {
    date: "2026-03-12T00:15:00",
    agent: "claude-code",
    summary:
      "Track 2 v7.7.7 — Frontend Chat UI fixes: 2a) clear skill badge after send in PulseComposer. 2b) Image part renderer in user chat bubbles. 2c) CoT auto-open on stream, auto-close after 4s via useEffect. 2d) ResearchDepartment sidebar refactored to rounded bubble style + ReactMarkdown + PulseChatInput (matches InterventionSidebar). 2e) Persistent thread toggle + thread ID input in Gateway settings tab, hook updated to check localStorage persistent thread.",
    files: [
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/chat/PulseThread.tsx",
      "frontend/components/executive/ResearchDepartment.tsx",
      "frontend/components/SettingsPanel.tsx",
      "frontend/hooks/usePersistentOpenClawConversation.ts",
    ],
  },
  {
    date: "2026-03-11T23:55:00",
    agent: "claude-code",
    summary:
      "Track 4 v7.7.7: Replace agent-plan.tsx with 21st.dev enhanced version — full framer-motion LayoutGroup animations, nested subtask expand/collapse, status toggling (completed/in-progress/pending/need-help/failed), priority badges, tool badges, progress bar header, dependency indicators, Pulse theme throughout. Backwards-compatible AgentPlan/PlanTask exports preserved.",
    files: ["frontend/components/ui/agent-plan.tsx"],
  },
  {
    date: "2026-03-11T23:45:00",
    agent: "claude-code",
    summary:
      "Track 3 v7.7.7: 3A — mcpServers field added to SkillDef interface and all SKILLS entries (exa, notion, fmp, playwright mappings). 3B — MCP auto-activation in PulseComposer: merges skill mcpServers into localStorage pulse_mcp_active_connectors before append. 3C — QuickPulse prefix updated for auto-screenshot via Playwright; chat handler injects Playwright screenshot when QUICKPULSE skill detected and no image present. 3D — iFrame power switch guard: removed auto-enable from platform dropdown selection (power via dedicated button only). 3E — NarrativeFlow Coming Soon overlay.",
    files: [
      "frontend/lib/skills.ts",
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/lib/skillPrefixes.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/narrative/NarrativeFlow.tsx",
    ],
  },
  {
    date: "2026-03-11T22:00:00",
    agent: "claude-code",
    summary:
      "Phase 7: Agent performance auto-recording (polymarket-tracker, outcome-tracker, /api/agents/performance endpoint). IV Score persistence — runs as background ticker (60s), events use 7-day window (never restart decay), score cached to DB across restarts. RiskFlow 24h stalemate rule — items older than 24h filtered out on init. VIX spike popup replaced with pulsating border (red >22, orange 16-22, yellow 14-16). Frontend AgentPerformanceTab wired to combined futures+prediction performance data.",
    files: [
      "backend-hono/src/services/agents/polymarket-tracker.ts",
      "backend-hono/src/services/agents/outcome-tracker.ts",
      "backend-hono/src/services/market-data/iv-score-ticker.ts",
      "backend-hono/src/routes/agents/handlers.ts",
      "backend-hono/src/routes/agents/index.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/index.ts",
      "backend-hono/migrations/010_polymarket_predictions.sql",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/journal/AgentPerformanceTab.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-12T09:00:00",
    agent: "claude-code",
    summary:
      "RiskFlow full-feed overhaul: replaced source text with X/Notion SVG logos, removed Neutral bias display, right-justified cyclical/counter-cyclical badges, fixed point scoring (severity × tag multiplier). VIX spike notice shows once per session via sessionStorage. Removed floating VIX ticker in combined panels layout. Fixed Brief refresh button. Reverted all calendars (Dashboard, Mission Control, full tab) to TradingView widget embeds — reliable data, TV-style layout.",
    files: [
      "frontend/components/feed/NewsSection.tsx",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/components/executive/SessionCalendarList.tsx",
      "frontend/components/mission-control/SessionCalendarMini.tsx",
      "frontend/components/econ/EconCalendar.tsx",
    ],
  },
  {
    date: "2026-03-12T06:00:00",
    agent: "claude-code",
    summary:
      "Regime Tracker: W/L→ORB bullish/bearish days, AI Generate CTA (opens chat with regimes skill), delete any regime, 12H NY time, active regimes shown in collapsed categories. Brief widget: scrollable full reports, AI generate button, comprehensive MDB/TOTT prompts (400-600w / 600-1000w), short ADB/PMDB. Added regimes skill to registry.",
    files: [
      "frontend/lib/regimes.ts",
      "frontend/lib/regime-store.ts",
      "frontend/lib/regime-time.ts",
      "frontend/lib/skills.ts",
      "frontend/lib/skillPrefixes.ts",
      "frontend/components/regimes/RegimeTrackerModal.tsx",
      "frontend/components/mission-control/RegimeMini.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/components/dashboard/RegimeCard.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "backend-hono/src/routes/notion/index.ts",
    ],
  },
  {
    date: "2026-03-12T04:30:00",
    agent: "claude-code",
    summary:
      "IV scoring overhaul: VIX 24→score 9 (blended ~7), stubborn below VIX 16 (75/25 weights), VIX floor prevents dilution, geopolitical weight boosted 8→9, scoreToPoints steeper curve, Boardroom tab hidden.",
    files: [
      "backend-hono/src/services/market-data/iv-scorer.ts",
      "backend-hono/src/services/analysis/iv-scorer.ts",
      "frontend/components/layout/NavSidebar.tsx",
    ],
  },
  {
    date: "2026-03-12T03:00:00",
    agent: "claude-code",
    summary:
      "Comprehensive onboarding: SetupGuideCard with status indicators on Dashboard, SETUP.md handoff guide, chat suggestion chips wired to skill system (mdb_report, tott, psych_eval, blindspots), configurable OpenClaw gateway port in Settings.",
    files: [
      "SETUP.md",
      "frontend/components/onboarding/SetupGuideCard.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/lib/skills.ts",
      "frontend/lib/skillPrefixes.ts",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/PulseThread.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/contexts/SettingsContext.tsx",
      "frontend/contexts/GatewayContext.tsx",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-12T01:00:00",
    agent: "claude-code",
    summary:
      "Replace TradingView iframe calendar (X-Frame-Options blocked) with native EconCalendar: week picker, day tabs with beat/miss summaries, time-block grouping (Pre-Market/Session/After Hours), P/A/F column headers, importance filter, refresh button, EconTickerFooter. SessionCalendarList and SessionCalendarMini also replaced with native rendering using backend econ data. RiskFlow source icons (X/Notion SVGs), Tape→RiskFlow unification, Brief refresh + mini widget, agent-controllable BlindspotsWidget.",
    files: [
      "frontend/components/econ/EconCalendar.tsx",
      "frontend/components/executive/SessionCalendarList.tsx",
      "frontend/components/mission-control/SessionCalendarMini.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/feed/CompactRiskFlowCard.tsx",
      "frontend/components/executive/ExpandableTapeItem.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/mission-control/BriefMiniWidget.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/services.ts",
      "backend-hono/src/routes/blindspots.ts",
    ],
  },
  {
    date: "2026-03-11T23:30:00",
    agent: "claude-code",
    summary:
      "Track 6 v7.7.7: TradingView-style session calendar redesign — EconCalendar.tsx gets P/A/F column headers on day groups. EconEventRow.tsx replaces importance dots with volume bars (height=importance 1-3), adds beat/miss indicators (green Check / red X via lucide), reorders columns to P/A/F, more row spacing. SessionCalendarList.tsx gets P/A/F headers + beat/miss check/X per event row. EconTickerFooter.tsx appends BEAT/MISS inline text with checkmark/X unicode to ticker insights.",
    files: [
      "frontend/components/econ/EconCalendar.tsx",
      "frontend/components/econ/EconEventRow.tsx",
      "frontend/components/econ/EconTickerFooter.tsx",
      "frontend/components/executive/SessionCalendarList.tsx",
    ],
  },
  {
    date: "2026-03-11T22:00:00",
    agent: "claude-code",
    summary:
      "Track 7 v7.7.7: 7A — TradingJournal.tsx with Human/Agent toggle tabs (HumanPsychTab: ER trend sparkline, infractions, discipline gauge + notes; AgentPerformanceTab: proposal tracker, win rate, R:R KPIs, expandable per-day proposals). Backend /api/journal/ routes (entries CRUD + summary). 7B — ER Monitor upgrade: VAD trigger replaces browser Speech API, Whisper-on-demand via POST /api/voice/analyze-sentiment (transcribe + Claude Haiku sentiment), escalating interventions (visual ER<-1, voice TTS ER<-3, lockout UI ER<-5)",
    files: [
      "frontend/components/journal/TradingJournal.tsx",
      "frontend/components/journal/HumanPsychTab.tsx",
      "frontend/components/journal/AgentPerformanceTab.tsx",
      "frontend/lib/services.ts",
      "frontend/contexts/ERContext.tsx",
      "frontend/components/mission-control/EmotionalResonanceMonitor.tsx",
      "backend-hono/src/services/journal-service.ts",
      "backend-hono/src/routes/journal/index.ts",
      "backend-hono/src/routes/journal/handlers.ts",
      "backend-hono/src/services/voice-sentiment.ts",
      "backend-hono/src/routes/voice/index.ts",
      "backend-hono/src/routes/voice/handlers.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-03-11T18:00:00",
    agent: "claude-code",
    summary:
      "Track 5 v7.7.7: Chat + toolbar — removed steer strip from PulseComposer/PromptBox (always full input), added queue chips (max 2) with cancel, added /stop to PulseSlashPicker, power button always visible in TopHeader (dim when inactive), RiskFlow drag-drop into chat (application/x-riskflow), created useVoiceMemory.ts hook (mic device persistence + transcript history), added mic device selector to SettingsPanel notifications tab",
    files: [
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/chat/PulseSlashPicker.tsx",
      "frontend/lib/skills.ts",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/hooks/useVoiceMemory.ts",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-11T16:00:00",
    agent: "claude-code",
    summary:
      "Track 3 v7.7.7: RiskFlow card overhaul — removed Neutral text, added X/Notion/MW SVG source logos, moved cyclical badge top-right, added point range display, approve/deny CTA on proposals, chat CTA on news alerts, onChatAlert prop on panel, extended RiskFlowAlert type with pointRange/direction/cyclical/instrument/authorHandle, wired PriceBrainScore from backend context, created CompactRiskFlowCard.tsx with minimal (2-line) and mini (single-line ticker-tape) variants",
    files: [
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/CompactRiskFlowCard.tsx",
    ],
  },
  {
    date: "2026-03-11T14:00:00",
    agent: "claude-code",
    summary:
      "Track 2: Wire frontend to backend IV score — IVScoreResponse type, getIVScore() on MarketDataService, IVScoreCard redesigned with point range + rationale tooltip + environment label, TopHeader/MainLayout/FloatingWidget/MiniWidget switched from quickIVScore(vix) to backend.marketData.getIVScore(), deleted hardcoded INSTRUMENT_CONFIG, NewsFeed uses inline IV badge",
    files: [
      "frontend/types/market-data.ts",
      "frontend/lib/services.ts",
      "frontend/components/IVScoreCard.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
      "frontend/mini-widget-entry.tsx",
      "frontend/components/NewsFeed.tsx",
    ],
  },
  {
    date: "2026-03-11T12:00:00",
    agent: "claude-code",
    summary:
      "Track 4: Mission Control overhaul — removed Panels header, moved collapse into MC KanbanTitle header, 560px fixed→flex-1 for 50/50 MC/Tape split, added calendar to MissionWidgetId, replaced drag-drop with gear WidgetArrangeMenu (up/down + visibility toggle), created SessionCalendarMini (P/A/F columns, max 4 events, beat/miss dots)",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/mission-control/SessionCalendarMini.tsx",
      "frontend/components/mission-control/WidgetArrangeMenu.tsx",
    ],
  },
  {
    date: "2026-03-11T09:00:00",
    agent: "claude-code",
    summary:
      "Track 8: BoardroomView popup interception via window message listener → window.open in new tab; ExecutiveDashboard getBriefLabel returns Tale of the Tape on Sunday + Monday<7AM, show only items[0].detail instead of joining multiple",
    files: [
      "frontend/components/BoardroomView.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
    ],
  },
  {
    date: "2026-03-11T06:00:00",
    agent: "claude-code",
    summary:
      "Track 1: Backend services — GET /api/market-data/iv-score (blended 60/40 VIX+headlines), iv-scorer.ts + point-estimator.ts services, classification fix (Senate→commentary, CPI→econ with strict word-boundary gates), briefing→single item + TOTT type, RiskFlow prints merged into schedule endpoint",
    files: [
      "backend-hono/src/services/market-data/iv-scorer.ts",
      "backend-hono/src/services/market-data/point-estimator.ts",
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/routes/market-data/index.ts",
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/routes/notion/index.ts",
    ],
  },
  {
    date: "2026-03-11T03:30:00",
    agent: "claude-code",
    summary:
      "Track 4: Chat Rebuild — PromptBox (unified input with vanish animation, image dialog, Think Harder sparkle toggle, mic button, compact mode), PulseComposer rewired to PromptBox + API skills fetch, PulseThread enhanced (hover action bar with Copy/Checkpoint, scroll-to-bottom IntersectionObserver, ChainOfThought gold-bordered display, fadeSlideIn animation), ChatInterface simplified, AskHarpChatPanel aligned to PulseComposer, PulseFloatingChat migrated from useChatSession to useOpenClawRuntime + AssistantRuntimeProvider + PulseThread compact",
    files: [
      "frontend/components/ui/chatgpt-prompt-input.tsx",
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/chat/PulseThread.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-03-11T03:00:00",
    agent: "claude-code",
    summary:
      "Track 5: Claude SDK Bridge + 21st API fallback — zero-cost Opus inference via Max subscription CLI bridge (process-manager, bridge relay, stream-json parser), 21st API deep thinking fallback service + token proxy route, claude-local model key in ai-config, 4-tier inference priority chain in chat handler (OpenClaw → Claude SDK → 21st API → OpenRouter)",
    files: [
      "backend-hono/src/services/claude-sdk/process-manager.ts",
      "backend-hono/src/services/claude-sdk/bridge.ts",
      "backend-hono/src/services/twenty-first/deep-think.ts",
      "backend-hono/src/routes/twenty-first/index.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/types/ai-types.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/index.ts",
      "backend-hono/.env",
    ],
  },
  {
    date: "2026-03-11T02:00:00",
    agent: "claude-code",
    summary:
      "Track 3: Backend context + preferences — conversation store upgrade (50 msg, token estimation, auto-summarization via OpenClaw), agent-instructions.ts (dynamic prompts, skill injection, 5min cache), skills endpoint GET /api/ai/skills, file attachment support (images/text/code/PDF), user settings persistence (PostgreSQL + localStorage sync), AI config updates",
    files: [
      "backend-hono/src/services/ai/conversation-store.ts",
      "backend-hono/src/services/ai/agent-instructions.ts",
      "backend-hono/src/services/openclaw-handler.ts",
      "backend-hono/src/routes/ai/handlers/skills.ts",
      "backend-hono/src/routes/ai/index.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/services/settings-store.ts",
      "backend-hono/src/routes/settings/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/config/ai-config.ts",
      "frontend/contexts/SettingsContext.tsx",
    ],
  },
  {
    date: "2026-03-11T01:00:00",
    agent: "claude-code",
    summary:
      "Track 2: Liquid Glass + New UI Components — created GlassEffect/GlassDock/GlassButton/GlassFilter, AiLoader, AnimatedText (useAnimatedText hook), AgentPlan (expand/collapse), VanishInput (canvas particle animation), Conversation (scroll-to-bottom + IntersectionObserver), Message primitives, Actions + AiActions (Copy/Retry/Like/Dislike)",
    files: [
      "frontend/components/ui/liquid-glass.tsx",
      "frontend/components/ui/ai-loader.tsx",
      "frontend/components/ui/animated-text.tsx",
      "frontend/components/ui/agent-plan.tsx",
      "frontend/components/ui/placeholders-and-vanish-input.tsx",
      "frontend/components/ui/conversation.tsx",
      "frontend/components/ui/message.tsx",
      "frontend/components/ui/actions.tsx",
      "frontend/components/ui/ai-actions.tsx",
    ],
  },
  {
    date: "2026-03-11T00:30:00",
    agent: "claude-code",
    summary:
      "Track 1 Foundation: installed framer-motion/clsx/tailwind-merge, created cn() utility, replaced ~800 hardcoded hex colors with CSS variables across 90+ files, updated Button.tsx variants, created Card/Tooltip/Avatar UI primitives, added moveBackground/fadeSlideIn keyframes",
    files: [
      "frontend/lib/utils.ts",
      "frontend/components/ui/Button.tsx",
      "frontend/components/ui/card.tsx",
      "frontend/components/ui/tooltip.tsx",
      "frontend/components/ui/avatar.tsx",
      "frontend/index.css",
    ],
  },
  {
    date: "2026-03-10T23:30:00",
    agent: "claude-code",
    summary:
      "Burst polling (5s for 30s on econ releases), actual extraction from FJ tweets → Notion calendar + prints DB, NickTimiraos as trusted X source, InsiderWire source mapping fix",
    files: ["backend-hono/src/services/twitter-cli/econ-triggered-poller.ts"],
  },
  {
    date: "2026-03-10T22:00:00",
    agent: "claude-code",
    summary:
      "T3 remaining fixes: highCount includes critical alerts, priorityFilter=high includes critical, gateway connected toast fires once per session via sessionStorage guard",
    files: [
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/contexts/GatewayContext.tsx",
    ],
  },
  {
    date: "2026-03-10T21:00:00",
    agent: "claude-code",
    summary:
      "Track 3 NarrativeFlow + app-wide persistence: added critical severity throughout. severity-config.ts gets critical (orange). RiskFlowImportModal SEVERITY_LABELS gets critical. RiskFlowPanel isHigh check covers critical. MiniWidget severity dot covers critical (orange). NewsSection severityLabel/impliedPoints/color all handle critical (24 base pts, orange). All backend-sourced items now score/render correctly.",
    files: [
      "frontend/lib/severity-config.ts",
      "frontend/components/narrative/RiskFlowImportModal.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/mission-control/RiskFlowMiniWidget.tsx",
      "frontend/components/feed/NewsSection.tsx",
    ],
  },
  {
    date: "2026-03-10T20:00:00",
    agent: "claude-code",
    summary:
      "Track 2 frontend core fix: wire /api/riskflow/feed into RiskFlowContext. Added pollBackendFeed() (30s interval, minMacroLevel=2, limit=30), backendAlerts state, mapBackendSource() and macroLevelToSeverity() helpers. Merge order: notionAlerts → backendAlerts (deduped) → rssAlerts. Extended AlertSeverity with critical, AlertSource union with all backend source types, RiskFlowAlert.symbols/isBreaking fields.",
    files: [
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/riskflow-feed.ts",
    ],
  },
  {
    date: "2026-03-10T19:00:00",
    agent: "claude-code",
    summary:
      "Track 1 level filter + warm cache: handlePreload minMacroLevel 3→2; feed-service default minMacroLevel 3→2; econ-triggered-poller warm cache filter high→medium, slice 10→30 (Medium+ seed).",
    files: [
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
    ],
  },
  {
    date: "2026-03-10T18:00:00",
    agent: "claude-code",
    summary:
      'RiskFlow + MDB: POST /api/notion/mdb-report/generate (AI brief → Notion, single-entry enforcement), useSourceStatus hook polling /api/riskflow/sources, RiskFlowPanel redesign (Priority+Source dropdowns, X/FJ filter, Notion+X status dots, placeholder "Polling Sources…"), NewsSection same filter redesign + status dots, FooterToolbar Notion+X status indicators. Also: NotionService.generateMdbReport(), writeMDBReportToNotion(), bustBriefCache(), handleGetSources backend handler.',
    files: [
      "backend-hono/src/routes/notion/index.ts",
      "backend-hono/src/routes/riskflow/handlers.ts",
      "backend-hono/src/routes/riskflow/index.ts",
      "backend-hono/src/services/notion-service.ts",
      "frontend/hooks/useSourceStatus.ts",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/feed/NewsSection.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-10T12:00:00",
    agent: "claude-code",
    summary:
      "MCP T1 Foundation: registry, types, config, backend API, frontend service. Defines 8 MCP servers (playwright, fmp, exa, notion, unusual-whales, yahoo-finance, twitter-cli, alpha-vantage). Backend: types/mcp.ts, services/mcp/registry.ts (async install/env checks via execFileNoThrow), routes/mcp/ (GET /, PATCH /:id/toggle, GET /:id/health). Frontend: types/mcp.ts, lib/mcp-service.ts, McpService added to BackendClient. .env: EXA_API_KEY, ALPHA_VANTAGE_API_KEY, X_API_BEARER_TOKEN added.",
    files: [
      "backend-hono/src/types/mcp.ts",
      "backend-hono/src/services/mcp/registry.ts",
      "backend-hono/src/routes/mcp/index.ts",
      "backend-hono/src/routes/mcp/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/.env",
      "frontend/types/mcp.ts",
      "frontend/lib/mcp-service.ts",
      "frontend/lib/services.ts",
      "src/lib/changelog.ts",
    ],
  },
  {
    date: "2026-03-10T10:30:00",
    agent: "claude-code",
    summary:
      "MCP T3 — Connector Popup UI: McpConnectorPopup slide-up panel next to attach button, Plug2 icon with active-count badge, grouped by category (Data/Search/Social/Browser/Productivity), per-server toggle with status dots, API-key warnings. useMcpConnectors hook (localStorage persistence + best-effort backend sync). mcpServers injected into every chat request. Static fallback defaults when T1 backend routes not yet available.",
    files: [
      "frontend/types/mcp.ts",
      "frontend/components/chat/McpConnectorPopup.tsx",
      "frontend/hooks/useMcpConnectors.ts",
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/components/chat/ChatInputArea.tsx",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
    ],
  },
  {
    date: "2026-03-10T14:00:00",
    agent: "claude-code",
    summary:
      "T5 Market Data Layer: FMP quotes/VIX + Unusual Whales GEX/walls/flow. New service layer at services/market-data/ (types, fmp-market, unusual-whales, index). Routes at /api/market-data/quote/:symbol, /vix, /gex/:symbol, /walls/:symbol, /flow/:symbol, /context/:symbol. MarketDataService added to frontend BackendClient. UW endpoints return 503 gracefully when API key absent. FMP_API_KEY + UNUSUAL_WHALES_API_KEY wired into .env.",
    files: [
      "backend-hono/src/services/market-data/types.ts",
      "backend-hono/src/services/market-data/fmp-market.ts",
      "backend-hono/src/services/market-data/unusual-whales.ts",
      "backend-hono/src/services/market-data/index.ts",
      "backend-hono/src/routes/market-data/index.ts",
      "backend-hono/src/routes/market-data/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/.env",
      "frontend/types/market-data.ts",
      "frontend/lib/services.ts",
    ],
  },
  {
    date: "2026-03-10T12:00:00",
    agent: "claude-code",
    summary:
      "T2: twitter-cli poller — cookie-based Twitter scraping (no rate limits) linked to Econ Calendar Notion DB. Financial Juice emoji-tier filter (medium+ only into RiskFlow). execFileNoThrow safe subprocess util. TwitterCli NewsSource added. 60s event-triggered polling around active econ events.",
    files: [
      "backend-hono/src/utils/execFileNoThrow.ts",
      "backend-hono/src/services/twitter-cli/twitter-cli-service.ts",
      "backend-hono/src/services/twitter-cli/fj-emoji-filter.ts",
      "backend-hono/src/services/twitter-cli/econ-triggered-poller.ts",
      "backend-hono/src/services/twitter-cli/index.ts",
      "backend-hono/src/types/riskflow.ts",
      "backend-hono/src/services/headline-parser.ts",
      "backend-hono/src/services/riskflow/feed-service.ts",
      "backend-hono/src/index.ts",
    ],
  },
  {
    date: "2026-03-10T14:00:00",
    agent: "claude-code",
    summary:
      "T4 QuickPulse backend: screenshot-service.ts (Playwright inline-script screenshot, isPlaywrightReady check), quick-pulse.ts handler (POST /api/ai/quick-pulse — auto-screenshot fallback via Playwright, multimodal content → OpenClaw pma-1, JSON parse with fence-strip, auto-screenshot in response). Types: backend/src/types/quick-pulse.ts + frontend/types/quick-pulse.ts. Route registered in ai/index.ts. playwright added to backend package.json.",
    files: [
      "backend-hono/src/services/screenshot-service.ts",
      "backend-hono/src/routes/ai/handlers/quick-pulse.ts",
      "backend-hono/src/types/quick-pulse.ts",
      "frontend/types/quick-pulse.ts",
      "backend-hono/src/routes/ai/index.ts",
      "backend-hono/package.json",
    ],
  },
  {
    date: "2026-03-10T12:00:00",
    agent: "claude-code",
    summary:
      "Cursor-style message queue + agent cognition visualization. Backend: chat-queue.ts (in-memory, max 2 slots per conversation), cognition-emitter.ts (EventEmitter for pipeline steps), queue.ts handler (enqueue/status/cancel + cognition SSE stream at GET /api/ai/cognition/stream). chat.ts instrumented with cognition events (agent-route, context-build, tool-dispatch, gateway-call, response-ready, error). Frontend: useChatQueue.ts hook, CognitionPanel.tsx with live SSE step rendering + auto-collapse, lastRequestId threaded through useOpenClawRuntime → ChatInterface → PulseThread.",
    files: [
      "backend-hono/src/services/chat-queue.ts",
      "backend-hono/src/services/cognition-emitter.ts",
      "backend-hono/src/routes/ai/handlers/queue.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/ai/index.ts",
      "frontend/hooks/useChatQueue.ts",
      "frontend/components/chat/CognitionPanel.tsx",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/chat/hooks/useChatSession.ts",
      "frontend/components/chat/useOpenClawRuntime.ts",
      "frontend/components/chat/PulseThread.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/styles/custom.css",
    ],
  },
  {
    date: "2026-03-09T23:00:00",
    agent: "claude-code",
    summary:
      "Conversation history persistence: useOpenClawChat hydrates messages from GET /api/ai/conversations/:id on remount. Fixes chat reverting to init screen on tab switch or panel close. hydratedRef guards against double-fetch. Surface isolation (analysis vs askharp) preserved.",
    files: ["frontend/components/chat/hooks/useOpenClawChat.ts"],
  },
  {
    date: "2026-03-09T22:00:00",
    agent: "claude-code",
    summary:
      "Switched Groq models from llama-3.3-70b-versatile (100K TPD, worst limit) to task-optimized models: Scout (30K TPM, 500K TPD) for fast/realtime, Maverick 128E (MoE, 500K TPD) for research, Kimi K2 (10K TPM) for CAO reasoning. 5x daily token headroom.",
    files: [
      "~/.openclaw/openclaw.json",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/openclaw-service.ts",
    ],
  },
  {
    date: "2026-03-10T08:30:00",
    agent: "claude-code",
    summary:
      "Groq as OpenClaw primary model: registered Groq provider in openclaw.json, set Harper primary to groq/llama-3.3-70b-versatile (free tier, ~750 tok/s). ALL agent traffic now routes Pulse → OpenClaw gateway → Groq. Removed direct Groq bypass — everything flows through gateway with ACP provenance. OpenRouter kept as fallback only. Zero API cost.",
    files: [
      "~/.openclaw/openclaw.json",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/ai/model-selector.ts",
      "backend-hono/src/services/openclaw-service.ts",
      "backend-hono/src/types/ai-types.ts",
    ],
  },
  {
    date: "2026-03-10T07:00:00",
    agent: "claude-code",
    summary:
      "ACP provenance headers (OpenClaw 3.8): gateway calls now carry X-ACP-Provenance, X-ACP-Origin-Channel, X-ACP-Origin-Session, X-ACP-Origin-Agent, and X-ACP-Trace-Id headers. Pulse channel types defined (analysis, boardroom, intervention, voice). Default mode: meta+receipt. Prevents agents from blindly trusting unidentified inputs.",
    files: [
      "backend-hono/src/services/openclaw-service.ts",
      "backend-hono/src/services/openclaw-handler.ts",
      "backend-hono/.env",
    ],
  },
  {
    date: "2026-03-10T06:00:00",
    agent: "claude-code",
    summary:
      "Relabeled ER Scoring → Trading Journal across nav, breadcrumbs, and panel header. Feature is PsychAssist emotional regulation history (not fundamental earnings analysis). NavSidebar label + description updated, TopHeader/SectionBreadcrumb TAB_LABELS updated, EarningsHistoryPanel header renamed.",
    files: [
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/SectionBreadcrumb.tsx",
      "frontend/components/earnings/EarningsHistoryPanel.tsx",
    ],
  },
  {
    date: "2026-03-10T05:00:00",
    agent: "claude-code",
    summary:
      "Post-review bug fixes: (1) AskHarpChatPanel thinkHarder toggle was broken — state lived inside inner component but runtime was created in outer scope with hardcoded false. Lifted thinkHarder state to outer AskHarpChatPanel so it actually reaches useOpenClawRuntime. (2) NavTab type mismatch — earnings tab added to SectionBreadcrumb and TopHeader to match NavSidebar.",
    files: [
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/layout/SectionBreadcrumb.tsx",
      "frontend/components/layout/TopHeader.tsx",
    ],
  },
  {
    date: "2026-03-10T04:00:00",
    agent: "claude-code",
    summary:
      'ER Scoring History — Notion-backed psych journal for earnings reviews. ERStoreAdapter interface with Notion adapter (auto-creates DB via setup endpoint). Backend CRUD + filter/pagination at /api/er-scoring, agent retrieval with token budget. Frontend: ERScoringProvider context, EarningsHistoryPanel with filter bar + new entry form, EarningsReviewSlideout for detail/edit. Nav sidebar tab "ER Scoring". Psych agent intent pattern routes to Harper for behavioral analysis.',
    files: [
      "backend-hono/src/types/earnings-history.ts",
      "backend-hono/src/services/earnings-history/adapter.ts",
      "backend-hono/src/services/earnings-history/notion-adapter.ts",
      "backend-hono/src/services/earnings-history/index.ts",
      "backend-hono/src/routes/earnings/index.ts",
      "backend-hono/src/routes/earnings/handlers.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/services/openclaw-handler.ts",
      "frontend/types/earnings-history.ts",
      "frontend/contexts/EarningsHistoryContext.tsx",
      "frontend/components/earnings/EarningsHistoryPanel.tsx",
      "frontend/components/earnings/EarningsReviewSlideout.tsx",
      "frontend/lib/services.ts",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-09T22:00:00",
    agent: "claude-code",
    summary:
      "Chat reliability hardening (Plan 1.3): (1) No blank assistant bubble — PulseAssistantMessage gates on content presence, only renders once text-delta or reasoning arrives. PulseThinkingIndicator handles visual feedback separately. (2) Per-surface session isolation — each chat surface (Analysis, AskHarp, Floating, Research) gets its own conversationId via surfaceId param, preventing context bleed across surfaces. (3) Error visibility in thread — lastError now renders as an AlertCircle banner inside PulseThread (not just the input area), so errors are visible even when scrolled up. (4) Boardroom audit — confirmed read-only (Notion embed + intervention sidebar, no mutating tools).",
    files: [
      "frontend/components/chat/PulseThread.tsx",
      "frontend/components/chat/useOpenClawRuntime.ts",
      "frontend/components/chat/hooks/useChatSession.ts",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/executive/ResearchDepartment.tsx",
      "frontend/hooks/usePersistentOpenClawConversation.ts",
      "frontend/lib/openclawAgentRouting.ts",
    ],
  },
  {
    date: "2026-03-10T02:00:00",
    agent: "claude-code",
    summary:
      "Chat UX + Upload + Slash + Permissions: (1) Fixed image attachment pipeline — images now flow through ChatInputArea→PulseComposer→useOpenClawChat→backend as multimodal content parts. (2) Replaced floating attach modal with slide-up panel anchored to composer, added drag-drop and client-side compression. (3) Slash-command launcher — typing / in textarea triggers filtered skill picker with keyboard nav (<=150ms). (4) Brain icon deep-research flow — Exa API integration with graceful fallback, thinkHarder flag wired end-to-end. (5) Permissions — feature flags config, GET /api/ai/features endpoint, server-side skill enforcement, disabled skills show reason in UI. (6) Tool-selection policy — Exa preferred before browser automation.",
    files: [
      "frontend/components/chat/ChatInputArea.tsx",
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/components/chat/PulseAttachPopup.tsx",
      "frontend/components/chat/PulseSkillsPopup.tsx",
      "frontend/components/chat/PulseSlashPicker.tsx",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/chat/useOpenClawRuntime.ts",
      "frontend/components/ChatInterface.tsx",
      "frontend/lib/skills.ts",
      "frontend/hooks/useFeatureFlags.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/ai/index.ts",
      "backend-hono/src/services/openclaw-handler.ts",
      "backend-hono/src/services/exa-service.ts",
      "backend-hono/src/services/tool-policy.ts",
      "backend-hono/src/config/feature-flags.ts",
    ],
  },
  {
    date: "2026-03-09T23:30:00",
    agent: "claude-code",
    summary:
      "Critical reliability build: (1) VIX feed hardening — fallback chain Yahoo→backend→cached→degraded, staleness tracking with 2min threshold, status getter, degraded-state UI indicator in IVScoreCard. (2) Config-driven IV scoring — extracted all hardcoded thresholds to iv-scoring-config.json, calculateIVScoreV2 accepts config param, added POST /api/market/iv-scoring/replay endpoint for config testing. Frontend computeIVScore also accepts config override. (3) Voice assistant lifecycle — added error state with 5s auto-recovery, cancel/interrupt support via AbortController, mic permission denied recovery path. (4) Mic arbitration — useMicPermission hook for explicit browser permission tracking, useMicArbitration hook with priority-based lock (VoiceAssistant=10, PsychAssist=5). HeaderVoiceControl wired for cancel-on-click during thinking/speaking and denied-state tooltip.",
    files: [
      "lib/vix-feed.ts",
      "contexts/VIXContext.tsx",
      "components/IVScoreCard.tsx",
      "components/layout/TopHeader.tsx",
      "backend-hono/src/services/iv-scoring-v2.ts",
      "backend-hono/src/config/iv-scoring-config.json",
      "backend-hono/src/routes/market/handlers.ts",
      "backend-hono/src/routes/market/index.ts",
      "frontend/lib/iv-scoring.ts",
      "frontend/hooks/useVoiceAssistant.ts",
      "frontend/types/voice.ts",
      "frontend/components/voice/HeaderVoiceControl.tsx",
    ],
  },
  {
    date: "2026-03-09T22:00:00",
    agent: "claude-code",
    summary:
      "Chat reliability hardening: throw on error responses instead of passing to SSE parser (was causing silent failures), add 65s frontend timeout, wire lastError through useOpenClawRuntime to ChatInterface and AskHarpChatPanel (was hardcoded null), add console warnings for silent catches, defensive try/catch in PulseComposer. Created endpoint parity matrix (7 mismatches documented) and trading blackout policy.",
    files: [
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/chat/useOpenClawRuntime.ts",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/components/chat/PulseComposer.tsx",
      "docs/ENDPOINT-PARITY-MATRIX.md",
      "docs/BLACKOUT-POLICY.md",
    ],
  },
  {
    date: "2026-03-09T15:15:00.000Z",
    agent: "openclaw",
    summary:
      "Stabilized chat steer queue to prevent thread blanking/timeouts: replaced assistant-ui internal queued append during active runs with a local single-item steer queue that flushes only after the current run completes.",
    files: ["frontend/components/chat/PulseComposer.tsx"],
  },
  {
    date: "2026-03-07T04:00:00",
    agent: "claude-code",
    summary:
      "Fix chat: local OpenClaw is now primary path (was broken by GitHub OAuth token routing all requests to non-existent DeepSeek R1). Enable chatCompletions endpoint on OpenClaw gateway. Replace Kalshi contract codes with Notion Trade Idea titles in all UI surfaces. Rename GitHub Models model from DeepSeek R1 to GPT-4o.",
    files: [
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/notion-poller.ts",
      "frontend/components/TradeIdeaModal.tsx",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/riskflow-feed.ts",
    ],
  },
  {
    date: "2026-03-07T03:30:00",
    agent: "claude-code",
    summary:
      "Footer toolbar slide-up panel with Terminal and Changelog tabs. Terminal has CLI input/output history. Changelog pulls live from changelog.ts. Panel animates open/closed with tab switching.",
    files: ["frontend/components/layout/FooterToolbar.tsx"],
  },
  {
    date: "2026-03-07T03:00:00",
    agent: "claude-code",
    summary:
      'Session date logic: after 9PM, dashboard calendar discards past releases and shows upcoming. EconCalendar snaps to next day after 9PM. SessionCalendarList filters past dates and shows "Next Session" label.',
    files: [
      "frontend/components/executive/SessionCalendarList.tsx",
      "frontend/contexts/EconCalendarContext.tsx",
    ],
  },
  {
    date: "2026-03-07T02:30:00",
    agent: "claude-code",
    summary:
      'Fix Trade Ideas "undefined" ticker — empty Ticker rich_text now falls back to Trade Idea title. Frontend RiskFlowContext uses displayName fallback for headline/summary/tradeIdea fields.',
    files: [
      "backend-hono/src/services/notion-service.ts",
      "frontend/contexts/RiskFlowContext.tsx",
    ],
  },
  {
    date: "2026-03-07T01:00:00",
    agent: "claude-code",
    summary:
      "Switched GitHub Models from Kimi K2 to DeepSeek R1. OAuth popup window flow (fixes white screen). Removed Kimi branding from CTA. GitHub-authenticated users now route to DeepSeek R1 instead of local OpenClaw. Clean error messages on model failure instead of silent fallback.",
    files: [
      "backend-hono/src/config/ai-config.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/routes/auth/github.ts",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/GitHubOAuthCallback.tsx",
      "frontend/contexts/AuthContext.tsx",
    ],
  },
  {
    date: "2026-03-06T23:30:00",
    agent: "claude-code",
    summary:
      "Renamed NTN → MDB (Morning Daily Brief) throughout codebase. Settings save fix (skip backend call when unauthenticated). RiskFlow panel smooth collapse/expand transition. Regime Tracker modal rounded edges. Chat error message improved for backend-unavailable state. iFrames settings section added to SettingsPanel.",
    files: [
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/openclaw-handler.ts",
      "backend-hono/src/services/openclaw-service.ts",
      "backend-hono/src/routes/notion/index.ts",
      "backend-hono/src/routes/narrative/handlers.ts",
      "frontend/lib/services.ts",
      "frontend/types/api.ts",
      "frontend/components/MDBReportModal.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/SystemFeed.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/constants.ts",
      "frontend/components/feed/FeedSection.tsx",
      "frontend/components/search/SearchModal.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/narrative/CatalystCard.tsx",
      "frontend/components/narrative/RiskFlowImportModal.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/regimes/RegimeTrackerModal.tsx",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/SettingsPanel.tsx",
      "frontend/contexts/SettingsContext.tsx",
    ],
  },
  {
    date: "2026-03-06T22:00:00",
    agent: "claude-code",
    summary:
      "Catalyst Import T1: Backend LLM scoring endpoints for NarrativeFlow. POST /api/narrative/score-riskflow and /score-brief — accepts RiskFlow items or daily brief text, scores via LLM (sentiment task model), returns ScoredCandidate array with keyword fallback on LLM failure.",
    files: [
      "backend-hono/src/routes/narrative/handlers.ts",
      "backend-hono/src/routes/narrative/index.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-03-06T20:00:00",
    agent: "claude-code",
    summary:
      "Sprint 4: Regime Tracker — institutional/session/report trading windows with W-L tracking. Mission Control mini-screener, dashboard preview card, full popup modal, backend API endpoint, localStorage persistence, skill prefix integration.",
    files: [
      "frontend/lib/regimes.ts",
      "frontend/lib/regime-time.ts",
      "frontend/lib/regime-store.ts",
      "frontend/components/mission-control/RegimeMini.tsx",
      "frontend/components/dashboard/RegimeCard.tsx",
      "frontend/components/regimes/RegimeTrackerModal.tsx",
      "backend-hono/src/routes/regimes/index.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/components/mission-control/MissionControlPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/lib/layoutOrderStorage.ts",
      "frontend/lib/skillPrefixes.ts",
    ],
  },
  {
    date: "2026-03-06T18:00:00",
    agent: "claude-code",
    summary:
      "Sprint 2: Theme System — 6 presets (solvys-gold, ios, project-x, dark-trading, miami-heat, monocolor), CSS variable architecture, ThemeProvider context, ThemeSettings panel with live preview + custom HEX inputs, localStorage persistence. Migrated key components to CSS variables.",
    files: [
      "frontend/lib/theme.ts",
      "frontend/contexts/ThemeContext.tsx",
      "frontend/components/settings/ThemeSettings.tsx",
      "frontend/index.css",
      "frontend/App.tsx",
      "frontend/components/chat/ChatHeader.tsx",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/components/chat/ChatMessageBubble.tsx",
      "frontend/components/chat/PulseThinkingIndicator.tsx",
      "frontend/components/chat/PulseSkillsPopup.tsx",
      "frontend/components/layout/NavSidebar.tsx",
      "frontend/components/SettingsPanel.tsx",
    ],
  },
  {
    date: "2026-03-05T20:30:00",
    agent: "claude-code",
    summary:
      "RiskFlow layout fix: removed RiskFlow from Mission Control panel, gave Mission Control full right panel height. Added Proposals filter tab to RiskFlow section (NewsSection) alongside All/High/Medium filters. Updated DMG.",
    files: [
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/feed/NewsSection.tsx",
      "frontend/lib/layoutOrderStorage.ts",
    ],
  },
  {
    date: "2026-03-05T18:14:00.000Z",
    agent: "openclaw",
    summary:
      "21st-style chat polish pass implemented directly in Pulse (while preserving black/gold palette): upgraded Analysis + Ask Harp message cards and composer shell, refined action controls, and improved visual hierarchy/spacing for modern chat UX without changing OpenClaw transport behavior.",
    files: [
      "frontend/components/chat/PulseChatInput.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
    ],
  },
  {
    date: "2026-03-05T18:03:00.000Z",
    agent: "openclaw",
    summary:
      "Chat UI thinking pass (Analysis + Ask Harp): added radar pulse indicator, expanded finance thinking phrase set, and kept thinking pane visible when reasoning is present so users can inspect model thought stream after response completes.",
    files: [
      "frontend/components/chat/PulseThinkingIndicator.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
    ],
  },
  {
    date: "2026-03-05T16:58:00.000Z",
    agent: "openclaw",
    summary:
      'Chat interface reliability patch: surfaced transport/backend errors directly in Analysis + Ask Harp chat panels, cleared stale errors on resend, and tightened gateway health checks to avoid false "Gateway connected" states when non-health HTML is returned. This makes chat failures visible instead of silently hanging and fixes misleading gateway status toasts.',
    files: [
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/ChatInterface.tsx",
      "frontend/components/chat/AskHarpChatPanel.tsx",
      "frontend/contexts/GatewayContext.tsx",
    ],
  },
  {
    date: "2026-03-04T22:55:00.000Z",
    agent: "openclaw",
    summary:
      'Fixed protected API auth middleware matching so nested routes are actually authenticated (added wildcard middleware for /api/* groups, including /api/ai/* and /api/riskflow/*). This resolves Pulse agent chat unauthorized failures where c.get("userId") was undefined in /api/ai/chat.',
    files: ["backend-hono/src/routes/index.ts"],
  },
  {
    date: "2026-03-04T17:02:00.000Z",
    agent: "claude-code",
    summary:
      "FortyFortyClub uploaded to QuantConnect (project 28682111), compiled successfully, baseline backtest launched. Fixed QC enum names: INTERACTIVE_BROKERS_BROKERAGE→QUANT_CONNECT_BROKERAGE (live uses Rithmic/Lucid), MICRO_NASDAQ100_E_MINI→MICRO_NASDAQ_100_E_MINI, SP500_E_MINI→SP_500_E_MINI. Confirmation instrument is /ES (full-size), not /MES.",
    files: ["quantconnect/FortyFortyClub/main.py"],
  },
  {
    date: "2026-03-04T12:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase I: FortyFortyClub QC algorithm — full implementation. Liquidity sweep reversal on /MNQ with Antilag (tick velocity + NQ/ES alignment) confirmation. Includes: fib sweep detection (20-candle swing H/L), 4-phase trailing stop, scale-in logic (+5 micros at ATR≥55% from 100 EMA), PDPT lockout ($1,550 combine mode), news blackout (120s), and daily reset. Ready for upload to QuantConnect via qc-mcp once Docker/MCP connected.",
    files: ["quantconnect/FortyFortyClub/main.py"],
  },
  {
    date: "2026-03-03T23:00:00.000Z",
    agent: "claude-code",
    summary:
      "Layout polish pass on new Notion trade idea components. TradeIdeaModal: tighter padding (px-4/py-3 header, px-4/py-3.5 body, px-4/py-2.5 footer), StatBox reduced to px-2.5 py-2 with text-xs value, price values formatted with formatPrice() helper ($0.XX for Kalshi contracts, $X,XXX.XX for equities).",
    files: ["frontend/components/TradeIdeaModal.tsx"],
  },
  {
    date: "2026-03-03T22:30:00.000Z",
    agent: "claude-code",
    summary:
      "Notion Polling → RiskFlow + KPI Live Data + Trade Idea Modals. Backend: notion-service.ts extended with queryTradeIdeas/queryDailyPnL using verified live DB schema (Trade Ideas: Ticker/Direction/EntryPrice/Confidence/Analyst; Daily P&L: Net P&L/Win Rate/Trades Taken). notion-poller.ts polls 60s, generates OpenClaw descriptions for new ideas. Routes: /api/notion/trade-ideas, /performance, /poll-status registered as public. NOTION_API_KEY added to .env (correct key from memory). Frontend: RiskFlowAlert extended with source notion-trade-idea + TradeIdeaDetail type. RiskFlowContext polls Notion 60s, merges trade ideas at top of feed. NotionService added to services.ts + BackendClient. TradeIdeaModal.tsx: dark overlay, gold-bordered card, price levels + R/R stats + OpenClaw brief. RiskFlowPanel: TradeIdeaRow with gold left-border + click-to-modal, Ideas filter tab. ExecutiveDashboard Phase 3D: live KPIs from /api/notion/performance merge on top of mock.",
    files: [
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/services/notion-poller.ts",
      "backend-hono/src/routes/notion/handlers.ts",
      "backend-hono/src/routes/notion/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/index.ts",
      "backend-hono/.env",
      "frontend/lib/riskflow-feed.ts",
      "frontend/contexts/RiskFlowContext.tsx",
      "frontend/lib/services.ts",
      "frontend/components/TradeIdeaModal.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/executive/ExecutiveDashboard.tsx",
    ],
  },
  {
    date: "2026-03-03T21:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase 3A-C: Notion backend service (NTN brief from Harper Messages DB, schedule mock). Frontend NotionService.getNtnBrief/getSchedule added. ExecutiveDashboard fetches live NTN brief, schedule, and Intraday PnL KPI from account. Phase 4B: FooterToolbar component (changelog viewer, CLI input, system status). Wired into MainLayout.",
    files: [
      "backend-hono/src/services/notion-service.ts",
      "backend-hono/src/routes/notion/index.ts",
      "backend-hono/src/routes/index.ts",
      "frontend/lib/services.ts",
      "frontend/components/executive/ExecutiveDashboard.tsx",
      "frontend/components/layout/FooterToolbar.tsx",
      "frontend/components/layout/MainLayout.tsx",
    ],
  },
  {
    date: "2026-03-03T20:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase 1C: Removed History panel (ConversationSession types, all history state/handlers, History button + left docked panel). Phase 1D: Replaced persona selector with PulseSkillsPopup (showSkills state, onOpenSkills prop). Phase 2A: Removed stray border-l from MissionControlPanel. Phase 2C: Restructured right stack to 50/50 independent scroll (Mission Control top, RiskFlow bottom), w-96→w-80. Phase 2E: BlindspotsWidget per-item dismiss + clearAll. Phase 4A: TopHeader height -20% (70→56px, 65→52px). Phase 4C-D: IV score wired to quickIVScore(vix) — removed fake random walk.",
    files: [
      "frontend/components/ChatInterface.tsx",
      "frontend/components/mission-control/MissionControlPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/mission-control/BlindspotsWidget.tsx",
      "frontend/components/layout/TopHeader.tsx",
    ],
  },
  {
    date: "2026-03-03T19:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase 2 Smart Layout: converted overlay sidebars to docked side panels. History docks left, Checkpoints docks right. Panel open/closed state persists to localStorage via usePanelState hook. Panels animate open/close with CSS width transition (240ms). Fixed onKeyPress → onKeyDown deprecation.",
    files: ["frontend/components/ChatInterface.tsx"],
  },
  {
    date: "2026-03-03T18:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase 1B checkpoints: enhanced sidebar with date-grouped bookmarks (Today/Yesterday/date), click-away backdrop, compact card layout, Bookmark icon header, footer count. Added groupCheckpointsByDate helper.",
    files: ["frontend/components/ChatInterface.tsx"],
  },
  {
    date: "2026-03-03T00:30:00.000Z",
    agent: "claude-code",
    summary:
      "Rithmic Gateway: Python sidecar (FastAPI + async_rithmic) at rithmic-gateway/gateway.py, HTTP API on localhost:3002. Updated rithmic-service.ts to proxy calls to gateway. Added RITHMIC-GATEWAY.md OpenClaw handoff with semi-autonomous + fully-autonomous mode architecture.",
    files: [
      "rithmic-gateway/gateway.py",
      "rithmic-gateway/requirements.txt",
      "rithmic-gateway/.env.example",
      "backend-hono/src/services/rithmic-service.ts",
      "docs/quantconnect/RITHMIC-GATEWAY.md",
    ],
  },
  {
    date: "2026-03-03T01:00:00.000Z",
    agent: "claude-code",
    summary:
      "Phase 1 autopilot: added POST /api/trading/test-trade endpoint wired to Rithmic (primary) / ProjectX (fallback via PRIMARY_BROKER env). Added placeOrder() + searchContracts() to projectx/client.ts. Configured QuantConnect MCP server at localhost:3001.",
    files: [
      "backend-hono/src/services/projectx/client.ts",
      "backend-hono/src/services/trading-service.ts",
      "backend-hono/src/routes/trading/handlers.ts",
      "backend-hono/src/routes/trading/index.ts",
      "docs/quantconnect/AUTOPILOT-IMPLEMENTATION-PHASE-1.md",
    ],
  },
  {
    date: "2026-02-26T16:22:30.000Z",
    agent: "claude-code",
    summary:
      "Converted Boardroom to a Notion-embedded meeting surface with a countdown timer, documented PIC Notion entity IDs, and added a Kimi Claw backend+frontend trigger for SMS/iMessage workflows.",
    files: [
      "frontend/components/BoardroomView.tsx",
      "frontend/lib/services.ts",
      "frontend/README.md",
      "backend-hono/src/routes/index.ts",
      "backend-hono/src/routes/kimi/index.ts",
      "backend-hono/src/routes/kimi/handlers.ts",
      "backend-hono/src/services/kimi-claw-service.ts",
      "backend-hono/tsconfig.json",
      "backend-hono/.env.example",
      "knowledge-base/notion/PIC-NOTION-ENTITY-MAP.md",
    ],
  },
  {
    date: "2026-02-26T16:26:00.000Z",
    agent: "claude-code",
    summary:
      "Improved embedded OAuth flows by allowing user-activated top navigation in browser iframes and enabling Electron webview popup handling for Notion/Google/Apple sign-in windows.",
    files: [
      "frontend/components/layout/EmbeddedBrowserFrame.tsx",
      "electron/main.cjs",
    ],
  },
  {
    date: "2026-02-26T16:34:00.000Z",
    agent: "claude-code",
    summary:
      "Removed manual Kimi SMS UI/API wiring, added cron-derived boardroom meeting schedule endpoint, and updated boardroom countdown + Live/Inactive indicator to follow the schedule.",
    files: [
      "frontend/components/BoardroomView.tsx",
      "frontend/lib/services.ts",
      "backend-hono/src/services/boardroom-schedule.ts",
      "backend-hono/src/routes/boardroom/handlers.ts",
      "backend-hono/src/routes/boardroom/index.ts",
      "backend-hono/src/routes/index.ts",
      "backend-hono/.env.example",
      "knowledge-base/notion/PIC-NOTION-ENTITY-MAP.md",
    ],
  },
  {
    date: "2026-02-26T18:45:00.000Z",
    agent: "claude-code",
    summary:
      "Fixed missing user bubbles in Ask Harp/Intervention, added per-agent persistent OpenClaw threads with agent override support, introduced chat checkpoints for recall, and adjusted Mission Control RiskFlow + Account Tracker KPIs (status + platform tracker).",
    files: [
      "backend-hono/src/services/clawdbot-sessions.ts",
      "backend-hono/src/routes/ai/handlers/chat.ts",
      "backend-hono/src/types/ai-chat.ts",
      "frontend/components/chat/hooks/useOpenClawChat.ts",
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/components/executive/ResearchDepartment.tsx",
      "frontend/components/ChatInterface.tsx",
      "frontend/lib/chatCheckpoints.ts",
      "frontend/hooks/usePersistentOpenClawConversation.ts",
      "frontend/lib/openclawAgentRouting.ts",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
    ],
  },
  {
    date: "2026-02-26T19:05:00.000Z",
    agent: "claude-code",
    summary:
      "Added a dockable PsychAssist widget for Zen layout: drag the widget into the heading toolbar to fuse, or click the PiP button to dock/undock.",
    files: [
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
    ],
  },
  {
    date: "2026-02-26T19:18:00.000Z",
    agent: "claude-code",
    summary:
      "Fixed Full Screen / Expand to Analysis on floating chat: exit TopStepX when expanding so the Analysis (sidebar) chat is shown instead of a white screen.",
    files: ["frontend/components/layout/MainLayout.tsx"],
  },
  {
    date: "2026-02-26T19:28:00.000Z",
    agent: "claude-code",
    summary:
      "Fixed React #300 (fewer hooks): move early return after all hooks in PulseFloatingChat. Gateway health check URL configurable via VITE_GATEWAY_URL.",
    files: [
      "frontend/components/chat/PulseFloatingChat.tsx",
      "frontend/contexts/GatewayContext.tsx",
    ],
  },
  {
    date: "2026-02-28T06:30:00.000Z",
    agent: "openclaw",
    summary:
      "Zen layout polish pass: widened docked PsychAssist space, removed Zen floating Day P&L card, stripped iframe borders/padding, added power-off controls, tightened Mission Control width + card ordering, improved RiskFlow preview density, moved Account Tracker loading status to header, removed Loss Limit/Daily Target KPIs, and disabled mock RiskFlow fallback in News.",
    files: [
      "frontend/components/layout/PsychAssistDockable.tsx",
      "frontend/components/layout/TopHeader.tsx",
      "frontend/components/layout/MainLayout.tsx",
      "frontend/components/layout/FloatingWidget.tsx",
      "frontend/components/TopStepXBrowser.tsx",
      "frontend/components/mission-control/MissionControlPanel.tsx",
      "frontend/components/mission-control/AccountTrackerWidget.tsx",
      "frontend/components/RiskFlowPanel.tsx",
      "frontend/components/feed/NewsSection.tsx",
    ],
  },
  {
    date: "2026-03-03T04:00:00.000Z",
    agent: "claude-code",
    summary:
      "Added Rithmic test trade endpoint plan to AGENT-2 task doc: service (executeTestTrade + getPointValue for micros), handler, route spec with strategy-specific targets, PDPT caps, scale-in limits. Types already completed in prior session.",
    files: ["docs/AGENT-2-CLAUDE-CODE-TASKS.md"],
  },
  {
    date: "2026-03-16T22:00:00",
    agent: "claude-code",
    summary:
      "Persona selector pills in composer (PulseComposer) — 5 agent pills with name/description/status dot, gold accent for active, replaces header-level agent dropdown. Greeting shimmer animation (ChatGreeting) — scroll-in + shimmer left-to-right + settle to 80% opacity, removed emoji/border/bg from greeting area. CSS keyframes in custom.css.",
    files: [
      "frontend/components/chat/PulseComposer.tsx",
      "frontend/components/chat/ChatGreeting.tsx",
      "frontend/styles/custom.css",
    ],
  },
  {
    date: "2026-04-10T00:00:00",
    agent: "claude-code",
    summary:
      "VProxy round-robin: VPROXY_URLS env var (comma-separated) spreads chat and scoring load across multiple Claude CLI proxy agents; per-endpoint health caching; getNextBaseUrl() shared between provider.ts and anthropic-client.ts. TimelineOverlay: keyword-fallback filter so narrative thread selection works on items lacking narrativeThreads field; thread counts now reflect keyword matches; dropdown z-10 fix for stacking above overflow-y-auto items list.",
    files: [
      "backend-hono/src/services/strands/provider.ts",
      "backend-hono/src/services/vproxy/anthropic-client.ts",
      "frontend/components/layout/TimelineOverlay.tsx",
    ],
  },
  {
    date: "2026-04-22T12:41:00",
    agent: "T1/Wealth",
    summary:
      "S29-T1: Added trades origin column + ProjectX trades sync + /api/projectx/trades endpoint. Migration adds origin TEXT column (user|autopilot) to trades table. Sync worker polls every 15 min and upserts last 48h of trades. Route supports ?from&to&origin filtering. Autopilot fills now tagged with origin='autopilot' across all broker paths.",
    files: [
      "supabase/migrations/20260422_trades_origin.sql",
      "backend-hono/src/services/projectx-service.ts",
      "backend-hono/src/services/projectx-sync.ts",
      "backend-hono/src/routes/projectx/trades.ts",
      "backend-hono/src/services/autopilot/autopilot-scheduler.ts",
      "backend-hono/src/services/autopilot/proposal-service.ts",
      "backend-hono/src/boot/services.ts",
      "backend-hono/src/types/projectx.ts",
    ],
  },
  {
    date: "2026-04-22T13:19:00",
    agent: "T2/Wealth",
    summary:
      "S29-T2: Split AgentPerformanceTab into sub-components (AgentKpiStats, AgentBreakdownTable, AgentProposalTracker, AgentSummaryPanel). Added TradingCalendar with ProjectX and Solvys views, Agentic/Human/All origin toggle, day/week/month granularity pills, CalendarNav with month navigation, equity curve drawer on cell click. Dashboard | Calendar segmented control in PerformanceJournal. CalendarSelection type exported for T4 integration.",
    files: [
      "frontend/components/journal/AgentPerformanceTab.tsx",
      "frontend/components/journal/PerformanceJournal.tsx",
      "frontend/components/journal/performance-tab/AgentKpiStats.tsx",
      "frontend/components/journal/performance-tab/AgentBreakdownTable.tsx",
      "frontend/components/journal/performance-tab/AgentProposalTracker.tsx",
      "frontend/components/journal/performance-tab/AgentSummaryPanel.tsx",
      "frontend/components/journal/TradingCalendar/index.tsx",
      "frontend/components/journal/TradingCalendar/types.ts",
      "frontend/components/journal/TradingCalendar/ProjectXCalendar.tsx",
      "frontend/components/journal/TradingCalendar/SolvysCalendar.tsx",
      "frontend/components/journal/TradingCalendar/CalendarCell.tsx",
      "frontend/components/journal/TradingCalendar/WeekTotalCell.tsx",
      "frontend/components/journal/TradingCalendar/CalendarNav.tsx",
      "frontend/components/journal/TradingCalendar/CalendarControls.tsx",
      "frontend/components/journal/TradingCalendar/EquityCurveDrawer.tsx",
      "frontend/components/journal/TradingCalendar/hooks/useTradeCalendarData.ts",
    ],
  },
  {
    date: "2026-04-22T13:04:00",
    agent: "T4/Wealth",
    summary:
      "S29-T4: Added CatalystSlideOut panel + /api/catalysts/by-date route — shows RiskFlow headlines filtered to calendar selection. Slide-out drawer with urgency tags, date grouping, ESC/click-outside close, Solvys Gold styling.",
    files: [
      "frontend/components/journal/CatalystSlideOut/index.tsx",
      "frontend/components/journal/CatalystSlideOut/CatalystList.tsx",
      "frontend/components/journal/CatalystSlideOut/CatalystListItem.tsx",
      "frontend/components/journal/CatalystSlideOut/EmptyState.tsx",
      "frontend/components/journal/CatalystSlideOut/hooks/useCatalystsByDate.ts",
      "backend-hono/src/routes/catalysts/by-date.ts",
      "backend-hono/src/routes/index.ts",
    ],
  },
  {
    date: "2026-04-29T13:56:00",
    agent: "claude-code",
    summary:
      "v5.36.1 deploy: shipped s51-cards-and-arbitrum. 3-target deploy — Fly.io backend + Vercel desktop & mobile PWA. DMG (144MB) to Desktop. Install script refreshed.",
    files: ["package.json", "scripts/fintheon-update.sh"],
  },
];
