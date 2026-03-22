// [claude-code 2026-03-22] Setup welcome endpoint — Harper greeting for CLI onboarding
import { Hono } from 'hono';
import { handleHermesChat } from '../../services/hermes-handler.js';
import { createConversation, addMessage } from '../../services/ai/conversation-store.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Setup');

export function createSetupRoutes(): Hono {
  const router = new Hono();

  /**
   * POST /api/setup/welcome
   * Generates a Harper welcome message for the CLI setup wizard.
   * - Localhost guard: rejects non-local requests
   * - No auth middleware: registered as public route
   * - Returns plain JSON (not SSE) for easy CLI consumption
   */
  router.post('/welcome', async (c) => {
    // Localhost guard
    const host = c.req.header('host') ?? '';
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
    if (!isLocal) {
      return c.json({ error: 'This endpoint is only available on localhost' }, 403);
    }

    try {
      // Create a welcome conversation
      const conversation = await createConversation('local-setup', {
        title: 'Welcome to Fintheon',
        metadata: { source: 'cli-setup' },
      });

      const systemPrompt = [
        '[SYSTEM] Setup complete. A new team member has just finished the Fintheon CLI setup wizard.',
        'Welcome them warmly to the Priced In Capital ecosystem.',
        'Briefly introduce yourself as Harper (Chief Agentic Officer) and mention:',
        '- The key agents they can interact with (Oracle for market analysis, Sentinel for risk)',
        '- That they can ask you anything about the platform',
        '- One encouraging line about their trading journey',
        'Keep it concise (3-4 sentences max). Be warm but professional.',
      ].join(' ');

      // Store the system prompt as user message
      await addMessage(conversation.id, {
        conversationId: conversation.id,
        role: 'user',
        content: systemPrompt,
      });

      // Generate Harper's response via Hermes
      const response = await handleHermesChat({
        message: systemPrompt,
        conversationId: conversation.id,
        agentOverride: 'harper-cao',
      });

      // Store Harper's response
      await addMessage(conversation.id, {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.content,
      });

      log.info('Welcome message generated', {
        conversationId: conversation.id,
        agent: response.agent,
      });

      return c.json({
        conversationId: conversation.id,
        message: response.content,
        agent: response.agent,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log.warn('Welcome generation failed', { error: detail });
      return c.json(
        { error: 'Could not generate welcome message', detail },
        500
      );
    }
  });

  return router;
}
