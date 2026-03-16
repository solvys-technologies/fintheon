import { Hono } from 'hono'
import { handleGetMarkets, handleGetWhales, handleSync } from './handlers.js'

export function createKalshiRoutes(): Hono {
  const router = new Hono()

  router.get('/markets', handleGetMarkets)
  router.get('/whales', handleGetWhales)
  router.post('/sync', handleSync)

  return router
}
