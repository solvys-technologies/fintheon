// [claude-code 2026-03-22] Source of Truth fusion — Browser Control Phase 1 (read-only)
// Agent Control Layer for WebContentsView: DOM reading, screenshots, navigation.
// Security: read-only, no credential extraction, no form interaction.

const { ipcMain, WebContentsView } = require("electron");

/** @type {WebContentsView | null} */
let agentView = null;
/** @type {import('electron').BaseWindow | null} */
let parentWindow = null;

// Whitelisted domains for navigation
const ALLOWED_DOMAINS = [
  "topstep.com",
  "app.topstepx.com",
  "topstepx.com",
  "projectx.com",
  "tradingview.com",
  "investing.com",
  "forexfactory.com",
  "bls.gov",
  "bea.gov",
  "federalreserve.gov",
  "cmegroup.com",
  "kalshi.com",
  "polymarket.com",
];

function isDomainAllowed(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(d => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

// Rate limiting: max 10 DOM reads per minute
let domReadCount = 0;
setInterval(() => { domReadCount = 0; }, 60_000);

/**
 * Initialize agent view handlers.
 * Call this from main.cjs after app is ready.
 * @param {import('electron').BrowserWindow} mainWin
 */
function setupAgentViewHandlers(mainWin) {
  parentWindow = mainWin;

  // Create agent view
  ipcMain.handle("agent-view-create", async (_event, url) => {
    if (!parentWindow) return { ok: false, error: "No parent window" };
    if (!isDomainAllowed(url)) return { ok: false, error: "Domain not whitelisted" };

    // Clean up existing view
    if (agentView) {
      try { parentWindow.contentView.removeChildView(agentView); } catch {}
      agentView = null;
    }

    agentView = new WebContentsView();
    parentWindow.contentView.addChildView(agentView);

    // Position in right 40% of window
    layoutAgentView();

    await agentView.webContents.loadURL(url);
    return { ok: true };
  });

  // Close agent view
  ipcMain.handle("agent-view-close", () => {
    if (agentView && parentWindow) {
      try { parentWindow.contentView.removeChildView(agentView); } catch {}
      agentView = null;
    }
    return { ok: true };
  });

  // Navigate to URL
  ipcMain.handle("agent-view-navigate", async (_event, url) => {
    if (!agentView) return { ok: false, error: "No agent view" };
    if (!isDomainAllowed(url)) return { ok: false, error: "Domain not whitelisted" };
    await agentView.webContents.loadURL(url);
    return { ok: true };
  });

  // Read DOM element text content (read-only, text only)
  ipcMain.handle("agent-view-read-dom", async (_event, selector) => {
    if (!agentView) return null;
    if (domReadCount >= 10) return null; // Rate limit
    domReadCount++;

    try {
      // Only extract textContent — no form values, no innerHTML
      const sanitized = selector.replace(/['"\\]/g, "");
      const result = await agentView.webContents.executeJavaScript(
        `(() => {
          const el = document.querySelector('${sanitized}');
          return el ? el.textContent.trim() : null;
        })()`
      );
      return result;
    } catch {
      return null;
    }
  });

  // Batch DOM read — multiple selectors at once
  ipcMain.handle("agent-view-read-batch", async (_event, selectors) => {
    if (!agentView || !Array.isArray(selectors)) return {};
    if (domReadCount >= 10) return {};
    domReadCount++;

    try {
      const sanitized = selectors.map(s => s.replace(/['"\\]/g, ""));
      const script = `(() => {
        const results = {};
        ${sanitized.map((s, i) => `{
          const el = document.querySelector('${s}');
          results['${s}'] = el ? el.textContent.trim() : null;
        }`).join("\n")}
        return results;
      })()`;
      return await agentView.webContents.executeJavaScript(script);
    } catch {
      return {};
    }
  });

  // Screenshot capture (returns base64 data URL)
  ipcMain.handle("agent-view-screenshot", async () => {
    if (!agentView) return null;
    try {
      const image = await agentView.webContents.capturePage();
      return image.toDataURL();
    } catch {
      return null;
    }
  });

  // Get page info
  ipcMain.handle("agent-view-info", () => {
    if (!agentView) return null;
    return {
      title: agentView.webContents.getTitle(),
      url: agentView.webContents.getURL(),
      loading: agentView.webContents.isLoading(),
    };
  });

  // Is agent view active?
  ipcMain.handle("agent-view-active", () => {
    return { active: agentView !== null };
  });

  // Re-layout on window resize
  if (parentWindow) {
    parentWindow.on("resize", () => {
      if (agentView) layoutAgentView();
    });
  }
}

function layoutAgentView() {
  if (!agentView || !parentWindow) return;
  const [width, height] = parentWindow.getContentSize();
  // Agent view takes right 40% of the window
  const viewWidth = Math.floor(width * 0.4);
  agentView.setBounds({
    x: width - viewWidth,
    y: 0,
    width: viewWidth,
    height: height,
  });
}

module.exports = { setupAgentViewHandlers };
