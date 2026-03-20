// [claude-code 2026-03-06] Version check endpoint — compares local version against latest GitHub tag
import { Hono } from 'hono'

const REPO = 'solvys-technologies/pulse'
const GITHUB_API = `https://api.github.com/repos/${REPO}/tags`

// Cache to avoid hammering GitHub API (5 min TTL)
let cachedLatest: { tag: string; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

async function getLatestTag(): Promise<string | null> {
  if (cachedLatest && Date.now() - cachedLatest.fetchedAt < CACHE_TTL_MS) {
    return cachedLatest.tag
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/json', 'User-Agent': 'Fintheon-Update-Check' },
    })

    if (!res.ok) {
      console.warn(`[Version] GitHub API returned ${res.status}`)
      return cachedLatest?.tag ?? null
    }

    const tags = (await res.json()) as { name: string }[]
    if (!tags.length) return null

    // Tags are returned newest-first by GitHub
    const latest = tags[0].name
    cachedLatest = { tag: latest, fetchedAt: Date.now() }
    return latest
  } catch (err) {
    console.warn('[Version] Failed to fetch tags:', err)
    return cachedLatest?.tag ?? null
  }
}

function parseVersion(tag: string): number[] {
  return tag.replace(/^v/, '').split('.').map(Number)
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote)
  const l = parseVersion(local)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0
    const lv = l[i] ?? 0
    if (rv > lv) return true
    if (rv < lv) return false
  }
  return false
}

export function createVersionRoutes(): Hono {
  const router = new Hono()

  // GET /api/version/check
  router.get('/check', async (c) => {
    const localVersion = process.env.FINTHEON_VERSION ?? 'v2.27.9'
    const latestTag = await getLatestTag()

    if (!latestTag) {
      return c.json({ current: localVersion, latest: null, updateAvailable: false })
    }

    return c.json({
      current: localVersion,
      latest: latestTag,
      updateAvailable: isNewer(latestTag, localVersion),
    })
  })

  return router
}
