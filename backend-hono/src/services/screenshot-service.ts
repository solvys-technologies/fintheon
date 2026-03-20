// [claude-code 2026-03-10] Playwright screenshot service for QuickPulse
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface ScreenshotOptions {
  url?: string       // defaults to PULSE_APP_URL or localhost:5173
  fullPage?: boolean // defaults to true
  selector?: string  // CSS selector for element screenshot
  width?: number     // viewport width, default 1920
  height?: number    // viewport height, default 1080
}

export interface ScreenshotResult {
  base64: string
  mimeType: 'image/png'
  width: number
  height: number
}

/**
 * Take a screenshot via Playwright.
 * Spawns a minimal Node inline script — no MCP server needed for simple screenshots.
 */
export async function takeScreenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
  const url = options?.url ?? process.env.PULSE_APP_URL ?? 'http://localhost:5173'
  const width = options?.width ?? 1920
  const height = options?.height ?? 1080
  const outPath = join(tmpdir(), `pulse-screenshot-${randomUUID()}.png`)

  const selectorLine = options?.selector
    ? `await page.locator(${JSON.stringify(options.selector)}).screenshot({ path: outPath });`
    : `await page.screenshot({ path: outPath, fullPage: ${options?.fullPage ?? true} });`

  const script = `
const { chromium } = require('playwright');
const outPath = ${JSON.stringify(outPath)};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: ${width}, height: ${height} } });
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle', timeout: 15000 });
  ${selectorLine}
  await browser.close();
  console.log('SCREENSHOT_OK');
})().catch(err => { console.error('SCREENSHOT_ERR', err.message); process.exit(1); });
`

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Playwright script failed (exit ${code}): ${stderr.slice(0, 300)}`))
    })
  })

  const buf = await readFile(outPath)
  await unlink(outPath).catch(() => {})

  return {
    base64: buf.toString('base64'),
    mimeType: 'image/png',
    width,
    height,
  }
}

/**
 * Check if Playwright + Chromium are available.
 */
export async function isPlaywrightReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright', '--version'], { stdio: 'ignore', shell: true })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}
