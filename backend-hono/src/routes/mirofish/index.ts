// [claude-code 2026-03-23] MiroFish simulation routes — added context + history endpoints

import { Hono } from 'hono';
import { handleSimulate, handleStatus, handleReport, handleInject, handleGetContext, handleGetHistory } from './handlers.js';

export function createMirofishRoutes(): Hono {
  const app = new Hono();

  app.post('/simulate', handleSimulate);
  app.get('/status/:id', handleStatus);
  app.get('/report/:id', handleReport);
  app.post('/inject/:id', handleInject);
  app.get('/context', handleGetContext);
  app.get('/history', handleGetHistory);

  return app;
}
