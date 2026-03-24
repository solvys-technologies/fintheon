// [claude-code 2026-03-24] Persistence refactor: added GET /latest route
// [claude-code 2026-03-24] Added rolling-window, auto-run-check, running-state routes
// [claude-code 2026-03-23] MiroFish simulation routes — added context + history endpoints

import { Hono } from 'hono';
import {
  handleSimulate, handleStatus, handleReport, handleInject,
  handleGetContext, handleGetHistory, handleGetLatest,
  handleRollingWindow, handleAutoRunCheck, handleRunningState,
} from './handlers.js';

export function createMirofishRoutes(): Hono {
  const app = new Hono();

  app.post('/simulate', handleSimulate);
  app.get('/status/:id', handleStatus);
  app.get('/report/:id', handleReport);
  app.post('/inject/:id', handleInject);
  app.get('/context', handleGetContext);
  app.get('/latest', handleGetLatest);
  app.get('/history', handleGetHistory);
  app.get('/rolling-window', handleRollingWindow);
  app.get('/auto-run-check', handleAutoRunCheck);
  app.get('/running-state', handleRunningState);

  return app;
}
