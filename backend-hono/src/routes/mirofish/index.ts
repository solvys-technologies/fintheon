// [claude-code 2026-03-16] MiroFish simulation routes

import { Hono } from 'hono';
import { handleSimulate, handleStatus, handleReport, handleInject } from './handlers.js';

export function createMirofishRoutes(): Hono {
  const app = new Hono();

  app.post('/simulate', handleSimulate);
  app.get('/status/:id', handleStatus);
  app.get('/report/:id', handleReport);
  app.post('/inject/:id', handleInject);

  return app;
}
