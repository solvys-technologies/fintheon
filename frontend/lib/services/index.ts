/**
 * API Service Wrappers for Hono Backend
 *
 * These services provide a compatible interface to replace the Encore client.
 * Update the endpoint paths to match your Hono backend routes.
 */

export * from "./account";
export * from "./riskflow";
export * from "./ai";
export * from "./trading";
export * from "./voice";
export * from "./team";
export * from "./boardroom";
export * from "./narrative";
export * from "./data";
export * from "./journal";
export * from "./memory";
export * from "./editor";

import ApiClient from "../apiClient";
import { McpService } from "../mcp-service";

import { AccountService } from "./account";
import { RiskFlowService } from "./riskflow";
import { AIService, PsychService, AnalystService } from "./ai";
import {
  TradingService,
  ProjectXService,
  RithmicService,
  HyperliquidService,
  AutopilotService,
} from "./trading";
import {
  NotificationsService,
  ERService,
  VoiceService,
  EventsService,
} from "./voice";
import { PeersService } from "./team";
import { BoardroomService } from "./boardroom";
import { NarrativeService } from "./narrative";
import { EconCalendarService, NotionService, MarketDataService } from "./data";
import {
  JournalService,
  AgentPerformanceService,
  BlindspotsService,
} from "./journal";
import {
  ContextBankService,
  MiroSharkService,
  MemoryService,
  SkillsService,
  EditorSidebarService,
} from "./memory";
import { DocumentService, ResearchService, BulletinService } from "./editor";

// Main Backend Client Interface
export interface BackendClient {
  account: AccountService;
  riskflow: RiskFlowService;
  ai: AIService;
  psych: PsychService;
  analysts: AnalystService;
  trading: TradingService;
  projectx: ProjectXService;
  rithmic: RithmicService;
  hyperliquid: HyperliquidService;
  notifications: NotificationsService;
  er: ERService;
  voice: VoiceService;
  events: EventsService;
  boardroom: BoardroomService;
  narrative: NarrativeService;
  notion: NotionService;
  econCalendar: EconCalendarService;
  marketData: MarketDataService;
  mcp: McpService;
  journal: JournalService;
  blindspots: BlindspotsService;
  agentPerformance: AgentPerformanceService;
  contextBank: ContextBankService;
  autopilot: AutopilotService;
  miroshark: MiroSharkService;
  peers: PeersService;
  documents: DocumentService;
  research: ResearchService;
  bulletin: BulletinService;
  skills: SkillsService;
  memory: MemoryService;
  editorSidebar: EditorSidebarService;
}

// Create backend client from API client
export function createBackendClient(client: ApiClient): BackendClient {
  return {
    account: new AccountService(client),
    riskflow: new RiskFlowService(client),
    ai: new AIService(client),
    psych: new PsychService(client),
    analysts: new AnalystService(client),
    trading: new TradingService(client),
    projectx: new ProjectXService(client),
    rithmic: new RithmicService(client),
    hyperliquid: new HyperliquidService(client),
    notifications: new NotificationsService(client),
    er: new ERService(client),
    voice: new VoiceService(client),
    events: new EventsService(client),
    boardroom: new BoardroomService(client),
    narrative: new NarrativeService(client),
    notion: new NotionService(client),
    econCalendar: new EconCalendarService(client),
    marketData: new MarketDataService(client),
    mcp: new McpService(client),
    journal: new JournalService(client),
    blindspots: new BlindspotsService(client),
    agentPerformance: new AgentPerformanceService(client),
    contextBank: new ContextBankService(client),
    autopilot: new AutopilotService(client),
    miroshark: new MiroSharkService(client),
    peers: new PeersService(client),
    documents: new DocumentService(client),
    research: new ResearchService(client),
    bulletin: new BulletinService(client),
    skills: new SkillsService(client),
    memory: new MemoryService(client),
    editorSidebar: new EditorSidebarService(client),
  };
}
