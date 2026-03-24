// Federal Reserve FOMC simulation routes

import { Hono } from 'hono';
import {
  handleSimulateFed,
  handleGetSession,
  handleGetSignal,
  handleGetFedHistory,
  handleAutoRunCheckFed,
} from './handlers.js';

export function createFedReserveRoutes(): Hono {
  const app = new Hono();

  app.post('/simulate', handleSimulateFed);
  app.get('/session/:id', handleGetSession);
  app.get('/signal', handleGetSignal);
  app.get('/history', handleGetFedHistory);
  app.get('/auto-run-check', handleAutoRunCheckFed);

  return app;
}
