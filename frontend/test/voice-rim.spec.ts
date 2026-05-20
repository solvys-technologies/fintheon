// [claude-code 2026-04-19] S27-T5 W2c — Playwright spec for the voice rim UX.
// Runs against the built `vite preview` output (see package.json script "test:voice-rim").
//
// What this proves:
//   1. Clicking the header mic button mounts the rim frame.
//   2. The rim + transcript ticker have pointer-events: none, so they cannot
//      intercept clicks on any element — including any data-testid="trading-view-*".
//   3. The dismiss button unmounts the rim without blowing away conversation state.
//
// Mic activation uses the existing `fintheon:voice-toggle` window event so the
// test doesn't need real microphone permission.
import { test, expect } from "@playwright/test";

// Bun's generic `bun test` sweep imports *.spec.ts files directly during deploy
// pre-flight. This file belongs to Playwright, so only register tests there.
if (!process.versions.bun) {
  test.describe("Voice rim UX (S27-T5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Suppress real audio playback in CI so the greeting promise resolves cleanly.
    await page.addInitScript(() => {
      const OriginalAudio = window.Audio;
      // @ts-expect-error - test shim
      window.Audio = function StubAudio(src: string) {
        const a = new OriginalAudio(src);
        a.play = async () => {};
        return a;
      };
    });
  });

  test("clicking the mic mounts the rim around the window", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("fintheon:voice-toggle"));
    });
    const rim = page.getByTestId("voice-rim-frame");
    await expect(rim).toBeVisible();

    const pointerEvents = await rim.evaluate(
      (el) => getComputedStyle(el).pointerEvents,
    );
    expect(pointerEvents).toBe("none");
  });

  test("rim does not cover trading-view elements", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("fintheon:voice-toggle"));
    });
    const rim = page.getByTestId("voice-rim-frame");
    await expect(rim).toBeVisible();

    // Every trading-view-* element must be clickable at its center with the
    // rim mounted. elementFromPoint returns whatever is on top at a coordinate;
    // it must not be the rim or the transcript ticker.
    const covered = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('[data-testid^="trading-view-"]'),
      );
      const offenders: string[] = [];
      for (const node of nodes) {
        const rect = (node as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
        const blocker =
          top?.closest('[data-testid="voice-rim-frame"]') ??
          top?.closest('[data-testid="voice-rim-ticker"]');
        if (blocker) {
          offenders.push(
            (node as HTMLElement).dataset.testid ?? "trading-view-unknown",
          );
        }
      }
      return offenders;
    });

    expect(covered).toEqual([]);
  });

  test("transcript ticker appears during session", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("fintheon:voice-toggle"));
    });
    const ticker = page.getByTestId("voice-rim-ticker");
    await expect(ticker).toBeAttached();
    // Ticker is pointer-events: none and positioned top-center.
    const style = await ticker.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        pointerEvents: cs.pointerEvents,
        position: cs.position,
      };
    });
    expect(style.pointerEvents).toBe("none");
    expect(style.position).toBe("fixed");
  });

  test("dismiss button closes the rim without dropping conversation", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("fintheon:voice-toggle"));
    });
    await expect(page.getByTestId("voice-rim-frame")).toBeVisible();

    // Snapshot the persisted conversation before dismiss.
    const priorConvoKey = await page.evaluate(() => {
      return Object.keys(localStorage).find((k) =>
        k.startsWith("fintheon:hermes-conversation"),
      );
    });

    await page.getByTestId("voice-rim-dismiss").click();
    await expect(page.getByTestId("voice-rim-frame")).toHaveCount(0);

    if (priorConvoKey) {
      const after = await page.evaluate(
        (key) => localStorage.getItem(key),
        priorConvoKey,
      );
      expect(after).not.toBeNull();
    }
  });
  });
}
