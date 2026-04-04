#!/usr/bin/env node
// [claude-code 2026-04-03] Opens a full Electron BrowserWindow for platform OAuth.
// Uses persist:fintheon partition so cookies carry over to the app's webviews.
// Usage: npx electron scripts/platform-oauth.cjs <platform>
//   e.g. npx electron scripts/platform-oauth.cjs tradingview

const { app, BrowserWindow } = require("electron");

const PLATFORMS = {
  tradingview: { url: "https://www.tradingview.com/accounts/signin/", title: "TradingView" },
  topstepx:    { url: "https://www.topstepx.com",                    title: "TopStepX" },
  kalshi:      { url: "https://kalshi.com/log-in",                    title: "Kalshi" },
  tradesea:    { url: "https://app.tradesea.ai",                      title: "TradeSea" },
  tradovate:   { url: "https://trader.tradovate.com",                 title: "Tradovate" },
  tradelocker: { url: "https://app.tradelocker.com",                  title: "TradeLocker" },
};

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const platformKey = process.argv[2];
const platform = PLATFORMS[platformKey];

if (!platform) {
  console.error(`\n  Usage: npx electron scripts/platform-oauth.cjs <platform>\n`);
  console.error(`  Available platforms: ${Object.keys(PLATFORMS).join(", ")}\n`);
  process.exit(1);
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: `Sign in — ${platform.title}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:fintheon",
    },
  });

  win.webContents.setUserAgent(CHROME_UA);
  win.loadURL(platform.url);

  console.log(`\n  Opened ${platform.title} sign-in window.`);
  console.log(`  Sign in with Google, then close the window.\n`);

  win.on("closed", () => {
    console.log(`  ✓ ${platform.title} OAuth complete — session saved.`);
    app.quit();
  });
});

app.on("window-all-closed", () => app.quit());
