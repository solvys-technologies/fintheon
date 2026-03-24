import { Hono } from 'hono';
import {
  handleGetBoardroomMessages,
  handleGetInterventionMessages,
  handleSendInterventionMessage,
  handleSendMentionMessage,
  handleGetBoardroomStatus,
  handleGetBoardroomMeetingSchedule,
  handleTriggerIntervention,
  handlePostTradeIdea,
  handleTriggerStandup,
  handleBreakingNewsTrigger,
  handleHeraldAlert,
  handleGetSchedulerStatus,
  handleGetDevelopments,
  handleGetScorecards,
  handleGetPredictions,
  handleResolvePrediction,
} from './handlers.js';

export function createBoardroomRoutes(): Hono {
  const router = new Hono();

  // Existing routes
  router.get('/messages', handleGetBoardroomMessages);
  router.get('/intervention/messages', handleGetInterventionMessages);
  router.post('/intervention/send', handleSendInterventionMessage);
  router.post('/mention/send', handleSendMentionMessage);
  router.get('/status', handleGetBoardroomStatus);
  router.get('/meeting-schedule', handleGetBoardroomMeetingSchedule);
  router.post('/intervention/trigger', handleTriggerIntervention);
  router.post('/trade-idea', handlePostTradeIdea);

  // Standup triggers (manual or cron-invoked)
  router.post('/standup/:task', handleTriggerStandup);

  // Breaking news + Herald sentinel
  router.post('/trigger/breaking-news', handleBreakingNewsTrigger);
  router.post('/herald-alert', handleHeraldAlert);

  // Scheduler status
  router.get('/scheduler/status', handleGetSchedulerStatus);

  // Consilium Intelligence Layer
  router.get('/developments', handleGetDevelopments);
  router.get('/scorecards', handleGetScorecards);
  router.get('/predictions', handleGetPredictions);
  router.post('/predictions/:id/resolve', handleResolvePrediction);

  return router;
}
