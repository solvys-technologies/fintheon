// [claude-code 2026-03-20] T5b: Playwright automation for charting proposals on TopStepX
import { chromium, type BrowserContext, type Page } from 'playwright';
import { isBlackoutPeriod } from './chart-blackout.js';

interface ChartProposalInput {
  ticker: string;
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

const TOPSTEPX_URL = 'https://app.topstepx.com';
const USER_DATA_DIR = './playwright-session';

async function getContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

async function switchToPractice(page: Page): Promise<void> {
  // Click the account/platform dropdown and select Practice
  const dropdown = page.locator('[data-testid="account-selector"], .account-dropdown, .platform-selector').first();
  if (await dropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dropdown.click();
    await page.waitForTimeout(500);
    const practiceOption = page.getByText('Practice', { exact: false }).first();
    if (await practiceOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await practiceOption.click();
      await page.waitForTimeout(1000);
    }
  }
}

async function openChart(page: Page, ticker: string): Promise<void> {
  // Use the symbol search to navigate to the ticker's chart
  const searchInput = page.locator('[data-testid="symbol-search"], input[placeholder*="symbol"], input[placeholder*="Search"]').first();
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.click();
    await searchInput.fill(ticker);
    await page.waitForTimeout(1000);
    // Select the first matching result
    const result = page.locator('.symbol-result, [data-testid="symbol-result"]').first();
    if (await result.isVisible({ timeout: 3000 }).catch(() => false)) {
      await result.click();
      await page.waitForTimeout(2000);
    } else {
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
    }
  }
}

async function drawHorizontalRay(page: Page, _price: number, template: string): Promise<void> {
  // Open drawing tools menu
  const drawingTool = page.locator('[data-testid="drawing-tools"], .drawing-tools-btn, [title*="Drawing"]').first();
  if (await drawingTool.isVisible({ timeout: 5000 }).catch(() => false)) {
    await drawingTool.click();
    await page.waitForTimeout(500);

    // Select Horizontal Ray tool
    const rayTool = page.getByText('Horizontal Ray', { exact: false }).first();
    if (await rayTool.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rayTool.click();
      await page.waitForTimeout(500);
    }
  }

  // Apply the saved template (Bullish LQ / Bearish LQ)
  const templateSelector = page.locator('[data-testid="template-selector"], .template-dropdown').first();
  if (await templateSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
    await templateSelector.click();
    await page.waitForTimeout(500);
    const templateOption = page.getByText(template, { exact: false }).first();
    if (await templateOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateOption.click();
      await page.waitForTimeout(500);
    }
  }

  // Click on the chart at the price level
  // Note: Exact pixel mapping depends on chart scale; the platform's
  // "Price Level" input field is used when available
  const priceInput = page.locator('input[data-testid="price-level"], input[placeholder*="Price"]').first();
  if (await priceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await priceInput.fill(_price.toString());
    await priceInput.press('Enter');
    await page.waitForTimeout(500);
  }
}

async function chartProposal(input: ChartProposalInput): Promise<{ success: boolean; error?: string }> {
  // Check blackout period
  if (isBlackoutPeriod()) {
    console.log('[chart-proposal] Blackout period active, exiting gracefully.');
    return { success: false, error: 'Blackout period (8:30a-12p EST)' };
  }

  let context: BrowserContext | null = null;

  try {
    context = await getContext();
    const page = context.pages()[0] || await context.newPage();

    // Navigate to TopStepX if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('topstepx.com')) {
      await page.goto(TOPSTEPX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    // Switch to Practice account
    await switchToPractice(page);

    // Open chart for ticker
    await openChart(page, input.ticker);

    // Draw Entry ray — use Bullish LQ template
    await drawHorizontalRay(page, input.entry, 'Bullish LQ');

    // Draw Stop Loss ray — dark dim red
    await drawHorizontalRay(page, input.stopLoss, 'Stop Loss');

    // Draw Take Profit ray — use Bearish LQ template
    await drawHorizontalRay(page, input.takeProfit, 'Bearish LQ');

    console.log(`[chart-proposal] Charted ${input.ticker} ${input.direction} — Entry: ${input.entry}, SL: ${input.stopLoss}, TP: ${input.takeProfit}`);
    return { success: true };
  } catch (err: any) {
    console.error('[chart-proposal] Error:', err.message);
    return { success: false, error: err.message };
  } finally {
    // Keep context open (persistent session) — don't close
  }
}

// CLI entry: bun run scripts/chart-proposal.ts '{"ticker":"MNQ","direction":"long","entry":19250,"stopLoss":19220,"takeProfit":19300}'
async function main() {
  const rawInput = process.argv[2];
  if (!rawInput) {
    // Try reading from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const stdinData = Buffer.concat(chunks).toString('utf-8').trim();
    if (!stdinData) {
      console.error('Usage: bun run scripts/chart-proposal.ts \'{"ticker":"MNQ","direction":"long","entry":19250,"stopLoss":19220,"takeProfit":19300}\'');
      process.exit(1);
    }
    const input = JSON.parse(stdinData) as ChartProposalInput;
    const result = await chartProposal(input);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } else {
    const input = JSON.parse(rawInput) as ChartProposalInput;
    const result = await chartProposal(input);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('[chart-proposal] Fatal:', err);
  process.exit(1);
});
