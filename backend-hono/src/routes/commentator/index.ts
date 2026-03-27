// [claude-code 2026-03-26] S2-T3: Commentator route registration

import { Hono } from 'hono';
import {
  handleGetRegistry,
  handleAddCommentator,
  handleUpdateCommentator,
  handleDeleteCommentator,
  handleIdentifySpeaker,
  handleReorderCommentators,
  handleSeedCommentators,
} from './handlers.js';

export function createCommentatorRoutes(): Hono {
  const app = new Hono();

  app.get('/registry', handleGetRegistry);
  app.post('/', handleAddCommentator);
  app.put('/reorder', handleReorderCommentators);
  app.post('/seed', handleSeedCommentators);
  app.put('/:id', handleUpdateCommentator);
  app.delete('/:id', handleDeleteCommentator);
  app.post('/identify', handleIdentifySpeaker);

  return app;
}
