export type MapMode = "political" | "diplomacy" | "economy" | "threat";
export type DifficultyLevel =
  | "VERY_EASY"
  | "EASY"
  | "NORMAL"
  | "HARD"
  | "IMPOSSIBLE";
export type TimeJumpInterval =
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "SCENARIO_DEFAULT";

export interface CountryRecord {
  id: string;
  sessionId: string;
  code: string;
  name: string;
  flagEmoji: string;
  color: string;
  leader: string;
  ideology: string;
  economy: number;
  military: number;
  stability: number;
  treasury: number;
  infamy: number;
  warExhaustion: number;
  capitalRegionId: string | null;
  isMajor: boolean;
  description: string | null;
}

export interface RegionRecord {
  id: string;
  sessionId: string;
  regionId: string;
  regionName: string;
  ownerCountryCode: string;
  strategicStatus: string;
  baseValue: number;
  lastTransferredTurn: number | null;
  transferReason: string | null;
}

export interface DiplomacyRecord {
  id: string;
  sessionId: string;
  countryA: string;
  countryB: string;
  status:
    | "WAR"
    | "ALLIANCE"
    | "NON_AGGRESSION"
    | "VASSAL"
    | "EMBARGO"
    | "NEUTRAL"
    | string;
  treatyName: string | null;
  updatedTurn: number;
}

export interface PendingOrderRecord {
  id: string;
  sessionId: string;
  countryCode: string;
  orderType: "COMMAND" | "DIPLOMACY" | string;
  targetCountryCode: string | null;
  content: string;
  turnNumber: number;
  status: string;
  createdAt: string;
}

export interface WorldEventRecord {
  id: string;
  sessionId: string;
  turnNumber: number;
  gameDate: string;
  headline: string;
  articleBody: string;
  category: "WAR" | "DIPLOMACY" | "ECONOMY" | "INTERNAL" | "CRISIS" | string;
  involvedCountries: string[];
  createdAt: string;
}

export interface DiplomaticMessageRecord {
  id: string;
  sessionId: string;
  turnNumber: number;
  gameDate: string;
  fromCountryCode: string;
  toCountryCode: string;
  senderTitle: string;
  message: string;
  isFromPlayer: boolean;
  createdAt: string;
}

export interface LeaderChatMessageRecord {
  id: string;
  sessionId: string;
  countryCode: string;
  playerCountryCode: string;
  senderRole: "PLAYER" | "LEADER" | string;
  senderName: string;
  content: string;
  status: "PENDING_REPLY" | "DELIVERED" | string;
  turnNumber: number;
  gameDate: string;
  createdAt: string;
}

export interface DiplomacyCouncilMessageRecord {
  id: string;
  councilId: string;
  sessionId: string;
  senderCode: string;
  senderName: string;
  senderRole: "PLAYER" | "AI_LEADER" | "SYSTEM" | string;
  content: string;
  stance: string | null;
  status: string;
  turnNumber: number;
  gameDate: string;
  createdAt: string;
}

export interface DiplomacyCouncilRecord {
  id: string;
  sessionId: string;
  title: string;
  topic: string;
  councilType: "COUNCIL" | "COALITION" | "SUMMIT" | "PROTEST" | string;
  initiatorCode: string;
  participantCodes: string[];
  status: "OPEN" | "RESOLVED" | "COLLAPSED" | string;
  turnNumber: number;
  gameDate: string;
  createdAt: string;
  updatedAt: string;
  messages: DiplomacyCouncilMessageRecord[];
}

export interface TurnSnapshotSummary {
  id: string;
  turnNumber: number;
  gameDate: string;
  summary: string;
  createdAt: string;
}

export type MapMarkerCategory =
  | "INDUSTRY"
  | "MILITARY"
  | "INFRASTRUCTURE"
  | "NAVAL"
  | "RESEARCH"
  | "DIPLOMACY"
  | "INTERNAL"
  | "CRISIS";

export type MapMarkerStatus =
  | "ACTIVE"
  | "UNDER_CONSTRUCTION"
  | "DAMAGED"
  | "ALERT"
  | "COMPLETED";

export interface MapMarkerRecord {
  id: string;
  sessionId: string;
  countryCode: string;
  regionId: string | null;
  cityName: string | null;
  title: string;
  description: string;
  category: MapMarkerCategory | string;
  status: MapMarkerStatus | string;
  level: number;
  lat: number;
  lng: number;
  turnNumber: number;
  gameDate: string;
  isAnimated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorSuggestedOrder {
  title: string;
  category?: string;
  command: string;
}

export interface AdvisorChatMessageRecord {
  id: string;
  sessionId: string;
  senderRole: "PLAYER" | "AI_ADVISOR" | string;
  senderName: string;
  content: string;
  suggestedOrders: AdvisorSuggestedOrder[];
  status: "PENDING_REPLY" | "DELIVERED" | string;
  turnNumber: number;
  gameDate: string;
  createdAt: string;
}

export interface McpConnectionStatus {
  connected: boolean;
  connectionCount: number;
  aiWaiting?: boolean;
  waitingCount?: number;
  locale?: "tr" | "en";
  clients: Array<{
    connectionId: string;
    clientName: string;
    transport: "sse" | "streamable-http";
    lastSeenAt: string;
  }>;
}

export interface SessionState {
  id: string;
  name: string;
  scenarioId: string;
  playerCountryCode: string | null;
  currentDate: string;
  turnNumber: number;
  globalTension: number;
  difficulty: DifficultyLevel | string;
  timeJumpInterval: TimeJumpInterval | string;
  awaitingAiSimulation: boolean;
  lastMcpClientName: string | null;
  lastMcpActivityAt: string | null;
  scenario: {
    id: string;
    slug: string;
    title: string;
    era: string;
    turnIntervalMonths: number;
    description: string;
  };
  countries: CountryRecord[];
  regions: RegionRecord[];
  diplomacies: DiplomacyRecord[];
  orders: PendingOrderRecord[];
  events: WorldEventRecord[];
  messages: DiplomaticMessageRecord[];
  leaderChats: LeaderChatMessageRecord[];
  councils: DiplomacyCouncilRecord[];
  mapMarkers?: MapMarkerRecord[];
  advisorChats?: AdvisorChatMessageRecord[];
  snapshots: TurnSnapshotSummary[];
  mcpStatus: McpConnectionStatus;
}
