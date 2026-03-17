// [claude-code 2026-03-16] Kalshi whale tracker API handlers
import type { Context } from 'hono'
import { fetchKalshiMarkets, fetchKalshiWhales, clearKalshiCache } from '../../services/kalshi-service.js'

export async function handleGetMarkets(c: Context) {
  try {
    const data = await fetchKalshiMarkets()
    return c.json(data)
  } catch (error) {
    console.error('[Kalshi] markets error:', error)
    return c.json({ error: 'Failed to fetch Kalshi markets' }, 500)
  }
}

export async function handleGetWhales(c: Context) {
  try {
    const data = await fetchKalshiWhales()
    return c.json(data)
  } catch (error) {
    console.error('[Kalshi] whales error:', error)
    return c.json({ error: 'Failed to fetch Kalshi whale alerts' }, 500)
  }
}

export async function handleSync(c: Context) {
  try {
    clearKalshiCache()
    const data = await fetchKalshiWhales()
    return c.json({ success: true, alertCount: data.alerts.length, marketCount: data.markets.length })
  } catch (error) {
    console.error('[Kalshi] sync error:', error)
    return c.json({ error: 'Failed to sync Kalshi data' }, 500)
  }
}
