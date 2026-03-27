// [claude-code 2026-03-27] S2-T4: Calibration route registration

import { Hono } from 'hono';
import {
  handleGetWeights,
  handleUpdateWeight,
  handleSeed,
  handleAnnotate,
  handleGetAnnotations,
  handleObserve,
  handleGetObservations,
  handleBulkParse,
  handleBulkIngest,
  handleUploadContext,
} from './handlers.js';

export function createCalibrationRoutes(): Hono {
  const app = new Hono();

  app.get('/weights', handleGetWeights);
  app.put('/weight/:eventType', handleUpdateWeight);
  app.post('/seed', handleSeed);
  app.post('/annotate', handleAnnotate);
  app.get('/annotations/:itemId', handleGetAnnotations);
  app.post('/observe', handleObserve);
  app.get('/observations', handleGetObservations);
  app.post('/bulk-parse', handleBulkParse);
  app.post('/bulk-ingest', handleBulkIngest);
  app.post('/upload-context', handleUploadContext);

  return app;
}
