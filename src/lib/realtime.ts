import { EventEmitter } from "node:events";
import type { AppLocale } from "@/lib/i18n";

export type SessionRealtimeEventType =
  | "state_sync"
  | "territory_transferred"
  | "stats_updated"
  | "diplomacy_updated"
  | "event_published"
  | "message_sent"
  | "turn_advanced"
  | "order_queued"
  | "session_rolled_back"
  | "country_selected"
  | "leader_chat_updated"
  | "leader_chat_reply"
  | "council_updated"
  | "map_marker_updated"
  | "war_operation_started"
  | "war_operation_updated"
  | "nuclear_strike"
  | "nuclear_transferred"
  | "diplomatic_provocation"
  | "advisor_chat_updated"
  | "advisor_chat_reply"
  | "player_action_triggered"
  | "mcp_status";

export interface SessionRealtimeEvent {
  type: SessionRealtimeEventType;
  sessionId: string;
  timestamp: string;
  payload?: unknown;
}

export interface PlayerActionTrigger {
  sessionId: string;
  triggerType:
    | "TURN_COMPLETED"
    | "ORDER_QUEUED"
    | "LEADER_CHAT"
    | "COUNCIL_ACTION"
    | "WAR_ACTION"
    | "ADVISOR_CHAT"
    | "MANUAL_WAKE";
  summary: string;
  timestamp: string;
}

export interface McpConnectionInfo {
  connectionId: string;
  clientName: string;
  transport: "sse" | "streamable-http";
  persistentStream: boolean;
  connectedAt: number;
  lastSeenAt: number;
}

interface AiWaiterEntry {
  waiterId: string;
  sessionId: string;
  clientName: string;
  acceptAnySession: boolean;
  startedAt: number;
  resolve: (trigger: PlayerActionTrigger) => void;
}

interface BrowserSessionActivity {
  subscriberCount: number;
  lastSeenAt: number;
}

interface RealtimeStore {
  bus: EventEmitter;
  mcpConnections: Map<string, Map<string, McpConnectionInfo>>;
  aiWaiters: Map<string, AiWaiterEntry>;
  browserSessions: Map<string, BrowserSessionActivity>;
  activeLocale: AppLocale;
  sessionLocales: Map<string, AppLocale>;
}

const globalForRealtime = globalThis as unknown as {
  __paxRealtimeStore?: RealtimeStore;
};

function getStore(): RealtimeStore {
  if (!globalForRealtime.__paxRealtimeStore) {
    const bus = new EventEmitter();
    bus.setMaxListeners(500);
    globalForRealtime.__paxRealtimeStore = {
      bus,
      mcpConnections: new Map(),
      aiWaiters: new Map(),
      browserSessions: new Map(),
      activeLocale: "tr",
      sessionLocales: new Map(),
    };
  }
  if (!globalForRealtime.__paxRealtimeStore.aiWaiters) {
    globalForRealtime.__paxRealtimeStore.aiWaiters = new Map();
  }
  if (!globalForRealtime.__paxRealtimeStore.browserSessions) {
    globalForRealtime.__paxRealtimeStore.browserSessions = new Map();
  }
  if (!globalForRealtime.__paxRealtimeStore.activeLocale) {
    globalForRealtime.__paxRealtimeStore.activeLocale = "tr";
  }
  if (!globalForRealtime.__paxRealtimeStore.sessionLocales) {
    globalForRealtime.__paxRealtimeStore.sessionLocales = new Map();
  }
  return globalForRealtime.__paxRealtimeStore;
}

const STREAMABLE_IDLE_TTL_MS = 10 * 60 * 1000;

function pruneStaleConnections(sessionId: string) {
  const store = getStore();
  const map = store.mcpConnections.get(sessionId);
  if (!map) return;
  const now = Date.now();
  for (const [key, info] of map.entries()) {
    if (!info.persistentStream && now - info.lastSeenAt > STREAMABLE_IDLE_TTL_MS) {
      map.delete(key);
    }
  }
  if (map.size === 0) {
    store.mcpConnections.delete(sessionId);
  }
}

export function getActiveWaitersForSession(sessionId: string): AiWaiterEntry[] {
  const store = getStore();
  const list: AiWaiterEntry[] = [];
  for (const entry of store.aiWaiters.values()) {
    if (entry.sessionId === sessionId || entry.acceptAnySession) {
      list.push(entry);
    }
  }
  return list;
}

export const GLOBAL_MCP_CHANNEL = "lobby";

export function getActiveMcpLocale(sessionId?: string): AppLocale {
  const store = getStore();
  if (sessionId && sessionId !== GLOBAL_MCP_CHANNEL) {
    return store.sessionLocales.get(sessionId) ?? store.activeLocale ?? "tr";
  }
  return store.activeLocale ?? "tr";
}

export function setActiveMcpLocale(
  locale: AppLocale,
  options?: { sessionId?: string; broadcast?: boolean }
) {
  const store = getStore();
  const prevGlobal = store.activeLocale;
  const targetSession =
    options?.sessionId && options.sessionId !== GLOBAL_MCP_CHANNEL
      ? options.sessionId
      : undefined;

  let changed = prevGlobal !== locale;
  store.activeLocale = locale;

  if (targetSession) {
    if (store.sessionLocales.get(targetSession) !== locale) {
      changed = true;
    }
    store.sessionLocales.set(targetSession, locale);
  } else {
    for (const sid of store.sessionLocales.keys()) {
      if (store.sessionLocales.get(sid) !== locale) {
        changed = true;
      }
      store.sessionLocales.set(sid, locale);
    }
  }

  if (changed) {
    store.bus.emit("locale:changed", { locale, sessionId: targetSession });
    if (options?.broadcast !== false) {
      broadcastMcpStatusToAllSessions(targetSession);
    }
  }
}

export function subscribeActiveMcpLocaleChange(
  listener: (payload: { locale: AppLocale; sessionId?: string }) => void
): () => void {
  const store = getStore();
  store.bus.on("locale:changed", listener);
  return () => {
    store.bus.off("locale:changed", listener);
  };
}

export function subscribeGlobalMcpStatus(
  listener: (status: ReturnType<typeof getGlobalMcpStatus>) => void
): () => void {
  const store = getStore();
  store.bus.on("global:mcp", listener);
  return () => {
    store.bus.off("global:mcp", listener);
  };
}

export function getMostActiveBrowserSessionId(): string | null {
  const store = getStore();
  let bestId: string | null = null;
  let bestSeen = -1;
  for (const [sid, info] of store.browserSessions.entries()) {
    if (sid === GLOBAL_MCP_CHANNEL) continue;
    if (info.subscriberCount > 0 && info.lastSeenAt > bestSeen) {
      bestId = sid;
      bestSeen = info.lastSeenAt;
    }
  }
  return bestId;
}

export function getGlobalMcpStatus() {
  const store = getStore();
  const seenIds = new Set<string>();
  const clients: Array<{
    connectionId: string;
    sessionId: string;
    clientName: string;
    transport: "sse" | "streamable-http";
    lastSeenAt: string;
  }> = [];

  for (const sid of Array.from(store.mcpConnections.keys())) {
    pruneStaleConnections(sid);
    const map = store.mcpConnections.get(sid);
    if (!map) continue;
    for (const c of map.values()) {
      const dedupeKey = `${sid}:${c.connectionId}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      clients.push({
        connectionId: c.connectionId,
        sessionId: sid,
        clientName: c.clientName,
        transport: c.transport,
        lastSeenAt: new Date(c.lastSeenAt).toISOString(),
      });
    }
  }

  const waiterCount = store.aiWaiters.size;
  if (clients.length === 0 && waiterCount > 0) {
    for (const w of store.aiWaiters.values()) {
      clients.push({
        connectionId: w.waiterId,
        sessionId: w.sessionId,
        clientName: w.clientName,
        transport: "sse",
        lastSeenAt: new Date().toISOString(),
      });
    }
  }

  return {
    connected: clients.length > 0 || waiterCount > 0,
    connectionCount: Math.max(clients.length, waiterCount),
    aiWaiting: waiterCount > 0,
    waitingCount: waiterCount,
    locale: getActiveMcpLocale(),
    clients,
  };
}

function emitGlobalMcpStatus() {
  const store = getStore();
  store.bus.emit("global:mcp", getGlobalMcpStatus());
}

export function getMcpConnectionStatus(sessionId: string) {
  pruneStaleConnections(sessionId);
  pruneStaleConnections(GLOBAL_MCP_CHANNEL);
  const store = getStore();
  const sessionMap = store.mcpConnections.get(sessionId);
  const lobbyMap =
    sessionId !== GLOBAL_MCP_CHANNEL
      ? store.mcpConnections.get(GLOBAL_MCP_CHANNEL)
      : undefined;

  const active = [
    ...(sessionMap ? Array.from(sessionMap.values()) : []),
    ...(lobbyMap ? Array.from(lobbyMap.values()) : []),
  ];
  const waiters = getActiveWaitersForSession(sessionId);

  const clients = active.map((c) => ({
    connectionId: c.connectionId,
    clientName: c.clientName,
    transport: c.transport,
    lastSeenAt: new Date(c.lastSeenAt).toISOString(),
  }));

  if (clients.length === 0 && waiters.length > 0) {
    clients.push({
      connectionId: waiters[0].waiterId,
      clientName: waiters[0].clientName,
      transport: "sse",
      lastSeenAt: new Date().toISOString(),
    });
  }

  return {
    connected: clients.length > 0 || waiters.length > 0,
    connectionCount: Math.max(clients.length, waiters.length),
    aiWaiting: waiters.length > 0,
    waitingCount: waiters.length,
    locale: getActiveMcpLocale(sessionId),
    clients,
  };
}

export function broadcastMcpStatusToAllSessions(targetSessionId?: string) {
  const store = getStore();
  const sessionIds = new Set<string>();
  if (targetSessionId) sessionIds.add(targetSessionId);
  for (const k of store.mcpConnections.keys()) sessionIds.add(k);
  for (const k of store.browserSessions.keys()) sessionIds.add(k);
  for (const w of store.aiWaiters.values()) sessionIds.add(w.sessionId);

  for (const sid of sessionIds) {
    emitSessionEvent(sid, "mcp_status", getMcpConnectionStatus(sid));
  }
  emitGlobalMcpStatus();
}

export function markBrowserSessionActive(
  sessionId: string,
  deltaSubscribers = 0
) {
  const store = getStore();
  const existing = store.browserSessions.get(sessionId) ?? {
    subscriberCount: 0,
    lastSeenAt: Date.now(),
  };
  existing.subscriberCount = Math.max(
    0,
    existing.subscriberCount + deltaSubscribers
  );
  existing.lastSeenAt = Date.now();
  store.browserSessions.set(sessionId, existing);
}

export function getBrowserSessionActivity(sessionId: string): BrowserSessionActivity {
  const store = getStore();
  return (
    store.browserSessions.get(sessionId) ?? {
      subscriberCount: 0,
      lastSeenAt: 0,
    }
  );
}

export function registerMcpConnection(
  sessionId: string,
  connectionId: string,
  info: Omit<McpConnectionInfo, "connectionId" | "connectedAt" | "lastSeenAt">
) {
  const store = getStore();
  let map = store.mcpConnections.get(sessionId);
  if (!map) {
    map = new Map();
    store.mcpConnections.set(sessionId, map);
  }
  const existing = map.get(connectionId);
  const now = Date.now();
  map.set(connectionId, {
    connectionId,
    clientName: existing?.clientName || info.clientName || "MCP Client",
    transport: info.transport,
    persistentStream: info.persistentStream,
    connectedAt: existing?.connectedAt ?? now,
    lastSeenAt: now,
  });

  if (sessionId === GLOBAL_MCP_CHANNEL) {
    broadcastMcpStatusToAllSessions();
  } else {
    emitSessionEvent(sessionId, "mcp_status", getMcpConnectionStatus(sessionId));
    emitGlobalMcpStatus();
  }
}

export function touchMcpConnection(
  sessionId: string,
  connectionId: string,
  clientName?: string
) {
  const store = getStore();
  const map = store.mcpConnections.get(sessionId);
  const existing = map?.get(connectionId);
  if (!existing) {
    registerMcpConnection(sessionId, connectionId, {
      clientName: clientName || "MCP Client",
      transport: "streamable-http",
      persistentStream: false,
    });
    return;
  }
  existing.lastSeenAt = Date.now();
  if (clientName) existing.clientName = clientName;
  if (sessionId === GLOBAL_MCP_CHANNEL) {
    broadcastMcpStatusToAllSessions();
  } else {
    emitSessionEvent(sessionId, "mcp_status", getMcpConnectionStatus(sessionId));
    emitGlobalMcpStatus();
  }
}

export function unregisterMcpConnection(sessionId: string, connectionId: string) {
  const store = getStore();
  const map = store.mcpConnections.get(sessionId);
  if (!map) return;
  map.delete(connectionId);
  if (map.size === 0) {
    store.mcpConnections.delete(sessionId);
  }
  if (sessionId === GLOBAL_MCP_CHANNEL) {
    broadcastMcpStatusToAllSessions();
  } else {
    emitSessionEvent(sessionId, "mcp_status", getMcpConnectionStatus(sessionId));
    emitGlobalMcpStatus();
  }
}

export function waitForPlayerActionEvent(params: {
  sessionId: string;
  clientName?: string;
  timeoutMs?: number;
  acceptAnySession?: boolean;
  signal?: AbortSignal;
  onTick?: (elapsedSec: number) => void;
}): Promise<PlayerActionTrigger | null> {
  const {
    sessionId,
    clientName = "MCP AI Game Master",
    timeoutMs = 0,
    acceptAnySession = true,
    signal,
    onTick,
  } = params;
  const store = getStore();
  const waiterId = `waiter_${sessionId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  if (signal?.aborted) {
    return Promise.resolve(null);
  }

  const connectionId = `wait_conn_${sessionId}`;
  registerMcpConnection(sessionId, connectionId, {
    clientName,
    transport: "sse",
    persistentStream: true,
  });

  return new Promise<PlayerActionTrigger | null>((resolve) => {
    let settled = false;
    const startedAt = Date.now();
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const keepAliveTimer = setInterval(() => {
      touchMcpConnection(sessionId, connectionId, clientName);
      onTick?.(Math.round((Date.now() - startedAt) / 1000));
    }, 10_000);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      clearInterval(keepAliveTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      signal?.removeEventListener("abort", onAbort);
      store.aiWaiters.delete(waiterId);
      touchMcpConnection(sessionId, connectionId, clientName);
      broadcastMcpStatusToAllSessions(sessionId);
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    // Only arm a timeout if timeoutMs > 0; <= 0 waits indefinitely until player acts
    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      }, timeoutMs);
    }

    store.aiWaiters.set(waiterId, {
      waiterId,
      sessionId,
      clientName,
      acceptAnySession,
      startedAt,
      resolve: (trigger: PlayerActionTrigger) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(trigger);
      },
    });

    broadcastMcpStatusToAllSessions(sessionId);
  });
}

export function notifyPlayerAction(
  sessionId: string,
  triggerType: PlayerActionTrigger["triggerType"],
  summary: string
) {
  const store = getStore();
  const trigger: PlayerActionTrigger = {
    sessionId,
    triggerType,
    summary,
    timestamp: new Date().toISOString(),
  };

  emitSessionEvent(sessionId, "player_action_triggered", trigger);

  const matchingWaiters: AiWaiterEntry[] = [];
  for (const entry of store.aiWaiters.values()) {
    if (entry.sessionId === sessionId || entry.acceptAnySession) {
      matchingWaiters.push(entry);
    }
  }

  for (const waiter of matchingWaiters) {
    waiter.resolve(trigger);
  }
}

export function emitSessionEvent(
  sessionId: string,
  type: SessionRealtimeEventType,
  payload?: unknown
) {
  const store = getStore();
  const event: SessionRealtimeEvent = {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    payload,
  };
  store.bus.emit(`session:${sessionId}`, event);
}

export function subscribeSessionEvents(
  sessionId: string,
  listener: (event: SessionRealtimeEvent) => void
): () => void {
  const store = getStore();
  const channel = `session:${sessionId}`;
  store.bus.on(channel, listener);
  return () => {
    store.bus.off(channel, listener);
  };
}
