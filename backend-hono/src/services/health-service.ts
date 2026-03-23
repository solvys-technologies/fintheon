import { pingDb } from '../db/optimized.js'
import { defaultAiConfig } from '../config/ai-config.js'
import { supabaseAuthHealth } from './supabase-auth.js'

type ComponentStatus = 'ok' | 'degraded' | 'error'

export interface HealthStatus {
  status: ComponentStatus
  timestamp: string
  components: Record<
    'database' | 'aiGateway' | 'auth',
    {
      status: ComponentStatus
      details?: Record<string, unknown>
    }
  >
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const checkDatabase = async () => {
  try {
    await pingDb()
    return { status: 'ok' as ComponentStatus }
  } catch (error) {
    // Database is optional in cloud (Supabase handles persistence) — degraded, not error
    return {
      status: 'degraded' as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

const checkAiGateway = async () => {
  const baseUrl =
    defaultAiConfig.models['openrouter-opus']?.baseUrl ??
    process.env.OPENROUTER_BASE_URL ??
    'https://openrouter.ai/api/v1'
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return {
      status: 'error' as ComponentStatus,
      details: { error: 'Missing OPENROUTER_API_KEY' }
    }
  }

  try {
    const response = await fetchWithTimeout(
      `${baseUrl.replace(/\/v1$/, '')}/v1/models`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      8000
    )

    const statusCode = response.status
    const isHealthy = statusCode >= 200 && statusCode < 400

    return {
      status: isHealthy ? ('ok' as ComponentStatus) : ('degraded' as ComponentStatus),
      details: {
        statusCode
      }
    }
  } catch (error) {
    return {
      status: 'error' as ComponentStatus,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

const checkAuth = () => {
  const details = supabaseAuthHealth()
  return {
    status: details.hasCredentials ? ('ok' as ComponentStatus) : ('degraded' as ComponentStatus),
    details
  }
}

export const createHealthService = () => {
  const checkAll = async (): Promise<HealthStatus> => {
    const [database, aiGateway, auth] = await Promise.all([
      checkDatabase(),
      checkAiGateway(),
      checkAuth()
    ])

    const components = { database, aiGateway, auth }
    const hasError = Object.values(components).some((component) => component.status === 'error')
    const hasDegraded = Object.values(components).some((component) => component.status === 'degraded')

    const status: ComponentStatus = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok'

    return {
      status,
      timestamp: new Date().toISOString(),
      components
    }
  }

  return { checkAll }
}
