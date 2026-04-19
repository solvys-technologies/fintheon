// [claude-code 2026-04-19] S27-T4: refactored to use the shared browser pool. No more
// subprocess spawn per screenshot — persistent pooled pages cut Playwright launch overhead.
// [claude-code 2026-03-10] Playwright screenshot service for QuickFintheon
import { acquirePage, isPlaywrightReady as poolReady } from "./browser/pool.js";

export interface ScreenshotOptions {
  url?: string; // defaults to FINTHEON_APP_URL or localhost:5173
  fullPage?: boolean; // defaults to true
  selector?: string; // CSS selector for element screenshot
  width?: number; // viewport width, default 1920
  height?: number; // viewport height, default 1080
}

export interface ScreenshotResult {
  base64: string;
  mimeType: "image/png";
  width: number;
  height: number;
}

/**
 * Take a screenshot via the shared Playwright pool.
 */
export async function takeScreenshot(
  options?: ScreenshotOptions,
): Promise<ScreenshotResult> {
  const url =
    options?.url ?? process.env.FINTHEON_APP_URL ?? "http://localhost:5173";
  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const handle = await acquirePage({ viewport: { width, height } });
  try {
    await handle.page.setViewportSize({ width, height });
    await handle.page.goto(url, {
      waitUntil: "networkidle",
      timeout: 15_000,
    });

    const buf = options?.selector
      ? await handle.page
          .locator(options.selector)
          .screenshot({ type: "png" })
      : await handle.page.screenshot({
          type: "png",
          fullPage: options?.fullPage ?? true,
        });

    return {
      base64: buf.toString("base64"),
      mimeType: "image/png",
      width,
      height,
    };
  } finally {
    await handle.release();
  }
}

/**
 * Check if Playwright + Chromium are available via the pool.
 */
export async function isPlaywrightReady(): Promise<boolean> {
  return poolReady();
}
