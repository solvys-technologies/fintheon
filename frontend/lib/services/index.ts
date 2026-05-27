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
export * from "./projectx";
export * from "./voice";
export * from "./team";
export * from "./boardroom";
export * from "./narrative";
export * from "./data";
export * from "./journal";
export * from "./memory";
export * from "./editor";
export * from "./proxvoice";

export * from "./soul";
export * from "./file-room";
export * from "./desk-inbox";

import ApiClient from "../apiClient";
import { McpService } from "../mcp-service";

import { AccountService } from "./account";
import { RiskFlowService } from "./riskflow";
import { AIService, PsychService, AnalystService } from "./ai";
import {
  TradingService,
  RithmicService,
  HyperliquidService,
  AutopilotService,
} from "./trading";
import { ProjectXService } from "./projectx";
import {
  NotificationsService,
  ERService,
  VoiceService,
  EventsService,
} from "./voice";
import { PeersService } from "./team";
import { BoardroomService } from "./boardroom";
import { NarrativeService } from "./narrative";
import { EconCalendarService, DataService, MarketDataService } from "./data";
import {
  JournalService,
  AgentPerformanceService,
  BlindspotsService,
  // [claude-code 2026-04-23] S30-T2: consolidated daily session journal
  SessionJournalService,
} from "./journal";
import {
  ContextBankService,
  AgentDeskService,
  MemoryService,
  SkillsService,
  EditorSidebarService,
} from "./memory";
import {
  DocumentService,
  ResearchService,
  BulletinService,
  StickyBulletinService,
} from "./editor";
import { SoulService } from "./soul";
import { FileRoomService } from "./file-room";
import { DeskInboxService } from "./desk-inbox";
import { ProxVoiceService } from "./proxvoice";

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
  data: DataService;
  econCalendar: EconCalendarService;
  marketData: MarketDataService;
  mcp: McpService;
  journal: JournalService;
  sessionJournal: SessionJournalService;
  blindspots: BlindspotsService;
  agentPerformance: AgentPerformanceService;
  contextBank: ContextBankService;
  autopilot: AutopilotService;
  agentDesk: AgentDeskService;
  peers: PeersService;
  documents: DocumentService;
  research: ResearchService;
  bulletin: BulletinService;
  skills: SkillsService;
  memory: MemoryService;
  editorSidebar: EditorSidebarService;
  stickyBulletin: StickyBulletinService;
  soul: SoulService;
  fileRoom: FileRoomService;
  deskInbox: DeskInboxService;
  proxVoice: ProxVoiceService;
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
    data: new DataService(client),
    econCalendar: new EconCalendarService(client),
    marketData: new MarketDataService(client),
    mcp: new McpService(client),
    journal: new JournalService(client),
    sessionJournal: new SessionJournalService(client),
    blindspots: new BlindspotsService(client),
    agentPerformance: new AgentPerformanceService(client),
    contextBank: new ContextBankService(client),
    autopilot: new AutopilotService(client),
    agentDesk: new AgentDeskService(client),
    peers: new PeersService(client),
    documents: new DocumentService(client),
    research: new ResearchService(client),
    bulletin: new BulletinService(client),
    skills: new SkillsService(client),
    memory: new MemoryService(client),
    editorSidebar: new EditorSidebarService(client),
    stickyBulletin: new StickyBulletinService(client),
    soul: new SoulService(client),
    fileRoom: new FileRoomService(client),
    deskInbox: new DeskInboxService(client),
    proxVoice: new ProxVoiceService(client),
  };
}
