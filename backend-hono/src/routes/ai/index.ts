/**
 * AI Routes
 * Route registration for /api/ai endpoints
 * Day 19 - Phase 5 Implementation
 */

// [claude-code 2026-03-10] Added queue + cognition routes
// [claude-code 2026-03-10] Registered /quick-pulse endpoint
import { Hono } from 'hono'
import { handleChat, handleChatStream } from './handlers/chat.js'
import { handleQuickPulse } from './handlers/quick-pulse.js'
import {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleUpdateConversation,
  handleDeleteConversation,
  handleArchiveConversation,
  handleUnarchiveConversation,
} from './handlers/conversations.js'
import { getFeatureFlags } from '../../config/feature-flags.js'
import {
  handleQueueEnqueue,
  handleQueueStatus,
  handleQueueCancel,
  handleCognitionStream,
} from './handlers/queue.js'
import { handleGetSkills } from './handlers/skills.js'

export function createAiRoutes(): Hono {
  const router = new Hono()

  // Feature flags endpoint
  router.get('/features', (c) => c.json(getFeatureFlags()))

  // Skills endpoint — dynamic skill list with enabled/disabled state
  // GET /api/ai/skills
  router.get('/skills', handleGetSkills)

  // QuickPulse — multimodal chart analysis
  // POST /api/ai/quick-pulse
  router.post('/quick-pulse', handleQuickPulse)

  // Chat endpoints
  // POST /api/ai/chat - Send message and get response
  router.post('/chat', handleChat)

  // POST /api/ai/chat/stream - Stream response (SSE)
  router.post('/chat/stream', handleChatStream)

  // Queue endpoints (max 2 messages per conversation)
  // POST /api/ai/queue/enqueue — add message to queue
  router.post('/queue/enqueue', handleQueueEnqueue)
  // GET /api/ai/queue/status/:conversationId — queue depth + job info
  router.get('/queue/status/:conversationId', handleQueueStatus)
  // DELETE /api/ai/queue/:jobId — cancel a job
  router.delete('/queue/:jobId', handleQueueCancel)

  // Cognition SSE stream
  // GET /api/ai/cognition/stream?requestId=xxx
  router.get('/cognition/stream', handleCognitionStream)

  // Conversation endpoints
  // GET /api/ai/conversations - List conversations
  router.get('/conversations', handleListConversations)

  // POST /api/ai/conversations - Create new conversation
  router.post('/conversations', handleCreateConversation)

  // GET /api/ai/conversations/:id - Get conversation with messages
  router.get('/conversations/:id', handleGetConversation)

  // PATCH /api/ai/conversations/:id - Update conversation
  router.patch('/conversations/:id', handleUpdateConversation)

  // DELETE /api/ai/conversations/:id - Delete conversation
  router.delete('/conversations/:id', handleDeleteConversation)

  // POST /api/ai/conversations/:id/archive - Archive conversation
  router.post('/conversations/:id/archive', handleArchiveConversation)

  // POST /api/ai/conversations/:id/unarchive - Unarchive conversation
  router.post('/conversations/:id/unarchive', handleUnarchiveConversation)

  return router
}
