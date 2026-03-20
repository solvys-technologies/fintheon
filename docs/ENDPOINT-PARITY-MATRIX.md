# Pulse Endpoint Parity Matrix

**Generated**: 2026-03-09 | **Branch**: v7.7.7 @ ca3dce6

## Summary

- **Backend endpoints**: 70+
- **Frontend API calls**: 62
- **Matched pairs**: 55
- **Mismatches**: 7 (5 missing, 1 stubbed, 1 mock)

---

## Mismatches

| Frontend Call | Service Method | Backend Status | Severity | Resolution |
|---|---|---|---|---|
| `POST /api/ai/quick-pulse` | `AIService.quickPulse()` | **MISSING** | Low — UI has fallback | Route through `/api/ai/chat` with task param, or add backend handler |
| `POST /api/ai/check-tape` | `AIService.checkTape()` | **MISSING** | Low — not on critical path | Route through `/api/ai/chat` with task param |
| `POST /api/ai/generate-daily-recap` | `AIService.generateDailyRecap()` | **MISSING** | Low — not on critical path | Route through `/api/ai/chat` with task param |
| `POST /api/agents/reports/run` | `AnalystService.runReports()` | **MISSING** — backend has `/api/agents/analyze` | Medium — naming mismatch | Align frontend to use `/api/agents/analyze` or add alias |
| `POST /api/riskflow/seed` | `RiskFlowService.seed()` | **MISSING** | Low — seed is dev-only | Add handler that triggers prefetch pipeline |
| `EventsService.list()` / `seed()` | Stubbed in frontend | **NO BACKEND** | None — returns `[]` with warning | Remove or implement when events feature ships |
| `GET /api/market/quotes/:symbol` | Registered | **MOCK DATA** | Low — placeholder | Wire to real market data provider |

---

## Matched Endpoints (Verified Parity)

### Auth & Account
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/auth/github` | OAuth flow | `handleGitHubLogin` | OK |
| `POST /api/auth/github/callback` | OAuth flow | `handleGitHubCallback` | OK |
| `POST /api/auth/github/validate` | OAuth flow | `handleValidateToken` | OK |
| `GET /api/account` | `AccountService.get()` | `handleGetAccount` | OK |
| `POST /api/account` | `AccountService.create()` | `handleCreateAccount` | OK |
| `PATCH /api/account/settings` | `AccountService.updateSettings()` | `handleUpdateSettings` | OK |
| `GET /api/account/tier` | `AccountService.getTier()` | `handleGetTier` | OK |
| `PATCH /api/account/tier` | `AccountService.updateTier()` | `handleUpdateTier` | OK |
| `POST /api/account/select-tier` | `AccountService.selectTier()` | `handleSelectTier` | OK |
| `GET /api/account/features` | `AccountService.getFeatures()` | `handleGetFeatures` | OK |

### AI Chat & Conversations
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `POST /api/ai/chat` | `useOpenClawChat` (streaming) | `handleChat` | OK |
| `GET /api/ai/conversations` | `AIService.listConversations()` | `handleListConversations` | OK |
| `POST /api/ai/conversations` | `AIService` | `handleCreateConversation` | OK |
| `GET /api/ai/conversations/:id` | `AIService.getConversation()` | `handleGetConversation` | OK |
| `PATCH /api/ai/conversations/:id` | `AIService` | `handleUpdateConversation` | OK |
| `DELETE /api/ai/conversations/:id` | `AIService` | `handleDeleteConversation` | OK |

### Boardroom
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/boardroom/messages` | `BoardroomService.getMessages()` | `handleGetBoardroomMessages` | OK |
| `GET /api/boardroom/intervention/messages` | `BoardroomService.getInterventionMessages()` | `handleGetInterventionMessages` | OK |
| `POST /api/boardroom/intervention/send` | `BoardroomService.sendIntervention()` | `handleSendInterventionMessage` | OK |
| `POST /api/boardroom/mention/send` | `BoardroomService.sendMention()` | `handleSendMentionMessage` | OK |
| `GET /api/boardroom/status` | `BoardroomService.getStatus()` | `handleGetBoardroomStatus` | OK |
| `GET /api/boardroom/meeting-schedule` | Direct fetch in `BoardroomView` | `handleGetBoardroomMeetingSchedule` | OK |
| `POST /api/boardroom/intervention/trigger` | `BoardroomService.triggerIntervention()` | `handleTriggerIntervention` | OK |
| `POST /api/boardroom/trade-idea` | `BoardroomService.postTradeIdea()` | `handlePostTradeIdea` | OK |

### RiskFlow
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/riskflow/feed` | `RiskFlowService.list()` | `handleGetFeed` | OK |
| `GET /api/riskflow/breaking` | `RiskFlowService` | `handleGetBreaking` | OK |
| `GET /api/riskflow/stream` | SSE consumer | `handleBreakingStream` | OK |
| `GET /api/riskflow/watchlist` | `RiskFlowService` | `handleGetWatchlist` | OK |
| `POST /api/riskflow/watchlist` | `RiskFlowService` | `handleUpdateWatchlist` | OK |
| `GET /api/riskflow/iv-aggregate` | `RiskFlowService` | `handleGetIVAggregate` | OK |

### Notion
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/notion/trade-ideas` | `NotionService.getTradeIdeas()` | `getTradeIdeas` | OK |
| `GET /api/notion/performance` | `NotionService.getPerformance()` | `getPerformance` | OK |
| `GET /api/notion/poll-status` | `NotionService.getPollStatus()` | `getPollStatus` | OK |
| `GET /api/notion/mdb-brief` | `NotionService.getMdbBrief()` | `fetchMDBBrief` | OK |
| `GET /api/notion/schedule` | `NotionService.getSchedule()` | `fetchSchedule` | OK |
| `GET /api/notion/econ-calendar` | `EconCalendarService.getEvents()` | econ-calendar handler | OK |
| `GET /api/notion/econ-prints` | `EconCalendarService.getPrints()` | econ-calendar handler | OK |

### Market & Trading
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/market/vix` | `RiskFlowService.fetchVIX()` | `handleGetVix` | OK |
| `GET /api/trading/positions` | `TradingService.listPositions()` | `handleGetPositions` | OK |
| `POST /api/trading/toggle-algo` | `TradingService.toggleAlgo()` | `handleToggleAlgo` | OK |
| `POST /api/trading/test-trade` | `TradingService.fireTestTrade()` | `handleTestTrade` | OK |

### Other Services
| Endpoint | Frontend | Backend | Status |
|---|---|---|---|
| `GET /api/agents/reports` | `AnalystService.getReports()` | `handleGetReports` | OK |
| `POST /api/agents/analyze` | `AnalystService` | `handleAnalyze` | OK |
| `GET /api/agents/status` | `AnalystService` | `handleGetStatus` | OK |
| `GET /api/polymarket/odds` | `PolymarketService.getOdds()` | `handleGetOdds` | OK |
| `POST /api/polymarket/sync` | `PolymarketService.sync()` | `handleSync` | OK |
| `GET /api/psych/profile` | `PsychService.getProfile()` | `handleGetProfile` | OK |
| `PUT /api/psych/profile` | `PsychService.updateProfile()` | `handleUpdateProfile` | OK |
| `POST /api/psych/scores` | `PsychService.updateScores()` | `handleUpdateScores` | OK |
| `GET /api/regimes/active` | Frontend consumer | `createRegimeRoutes` | OK |
| `GET /api/regimes` | Frontend consumer | `createRegimeRoutes` | OK |
| `POST /api/narrative/score-riskflow` | `NarrativeService` | `scoreRiskflow` | OK |
| `POST /api/narrative/score-brief` | `NarrativeService` | `scoreBrief` | OK |
| `GET /api/rithmic/status` | `RithmicService.getStatus()` | `handleGetStatus` | OK |
| `GET /api/notifications` | `NotificationsService.list()` | `handleGetNotifications` | OK |
| `GET /api/er/sessions` | `ERService.getSessions()` | `handleGetSessions` | OK |
| `POST /api/er/sessions` | `ERService.saveSession()` | `handleSaveSession` | OK |
| `POST /api/er/snapshots` | `ERService.saveSnapshot()` | `handleSaveSnapshot` | OK |
| `POST /api/er/check-overtrading` | `ERService.checkOvertrading()` | `handleCheckOvertrading` | OK |
| `POST /api/voice/transcribe` | `VoiceService.transcribe()` | `handleTranscribe` | OK |
| `POST /api/voice/speak` | `VoiceService.speak()` | `handleSpeak` | OK |
| `GET /api/projectx/accounts` | `ProjectXService.listAccounts()` | `handleGetAccounts` | OK |
| `POST /api/projectx/sync` | `ProjectXService.syncProjectXAccounts()` | `handleSyncCredentials` | OK |
| `GET /api/projectx/activity/:id` | `ProjectXService.getActivity()` | `handleGetActivity` | OK |
| `GET /api/version/check` | Version checker | `createVersionRoutes` | OK |
| `GET /health` | `GatewayProvider` (port 7787) | `healthService.checkAll` (port 8080) | OK |

---

## Polling Services

| Service | Endpoint | Interval | Context |
|---|---|---|---|
| RiskFlow | `/api/riskflow/feed` | 60s | `RiskFlowContext` |
| Notion Trade Ideas | `/api/notion/trade-ideas` | 60s | `RiskFlowContext` |
| Econ Calendar | `/api/notion/econ-calendar` | 60s | `EconCalendarContext` |
| Schedule | `/api/notion/schedule` | 60s | `ScheduleContext` |
| Boardroom Messages | `/api/boardroom/messages` | 5s | `useBoardroom` |
| Boardroom Status | `/api/boardroom/status` | 5s | `useBoardroom` |
| Gateway Health | `:7787/health` | 30s | `GatewayProvider` |
| ER Snapshots | `/api/er/snapshots` | 5s | `ERContext` |
| ER Overtrading | `/api/er/check-overtrading` | 30s | `ERContext` |
