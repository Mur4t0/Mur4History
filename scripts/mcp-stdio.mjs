#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BASE_URL = (
  process.env.MUR4HISTORY_URL ||
  process.env.PAX_HISTORIA_URL ||
  "http://127.0.0.1:3000"
).replace(/\/+$/, "");

let pinnedSessionId =
  process.env.MUR4HISTORY_SESSION_ID || process.env.PAX_SESSION_ID || null;
let bootPromise = null;
let currentLocale = "tr";

const STDIO_LOCALE_COPY = {
  tr: {
    resources: {
      "world-state": { title: "World State", desc: "Mevcut tarih, tur, küresel tansiyon, dil tercihi (TÜRKÇE) ve savaşlar." },
      countries: { title: "Countries", desc: "Tüm ülkelerin ekonomi, askeri güç, istikrar ve lider verileri." },
      "map-ownership": { title: "Map Ownership", desc: "270 bölgenin sahiplik ve stratejik statü haritası." },
      "pending-orders": { title: "Pending Orders", desc: "Oyuncunun bekleyen serbest metin emirleri." },
      "chronicle-history": { title: "Chronicle History", desc: "Önceki turların gazete ve diplomasi kronolojisi." },
      "pending-leader-chats": { title: "Leader Diplomacy Chats", desc: "Oyuncunun ülke başkanlarıyla başlattığı bire bir sohbetler." },
      "diplomatic-councils": { title: "Diplomatic Councils", desc: "Çok uluslu konseyler, koalisyonlar ve hak savunusu zirveleri." },
      "map-markers": { title: "Map Facilities & Beacons", desc: "Şehir veya eyalet bazında haritada kurulan animasyonlu tesisler, üsler ve kriz işaretleri." },
      "advisor-chat": { title: "AI Advisor & Strategy Chat", desc: "Oyuncunun yapay zeka ile fikir aldığı ve mesajlaştığı strateji danışman odası." },
      "war-theater": { title: "Live War Theater & Probabilities", desc: "Aktif savaşlar, haritada ilerleyen animasyonlu kuşatmalar, tank/piyade harekatları ve savaş çıkma olasılıkları." },
    },
    tools: {
      list_game_sessions: { title: "List Game Sessions", description: "Mur4History sunucusundaki aktif oyun oturumlarını, tur durumlarını, aktif dili, tarayıcı sekmesini ve seçili ülkeleri listeler." },
      switch_game_session: { title: "Switch Active Game Session", description: "MCP bağlantısını belirtilen oyun oturumu ID'sine geçirir ve harita arayüzündeki MCP Durumu rozetini o oturumda yeşile çevirir." },
      wait_for_player_action: { title: "Wait Indefinitely for Player Button Click (Zero Idle Token Burn)", description: "MCP bağlantısını açık tutarak oyuncunun web arayüzünde 'Turu Tamamla', 'Başkana Gönder', 'Konseye Gönder' veya 'AI Danışman' butonuna basmasını SÜRESİZ bekler." },
      read_game_context: { title: "Read Game World Resources or Wait for Player Action", description: "Aktif oyun oturumunun MCP kaynaklarını okur veya wait_for_action=true verildiğinde oyuncunun butona basmasını süresiz bekler." },
      transfer_territory: { title: "Transfer Territory", description: "Savaş, ilhak, satın alma veya barış antlaşması sonucunda haritadaki bölgelerin sahipliğini değiştirir ve web haritasını canlı günceller." },
      update_country_stats: { title: "Update Country Statistics", description: "Alınan kararların ülkelerin ekonomisine, ordusuna, iç istikrarına (0-100 ölçeği) ve ideolojisine etkisini işler." },
      manage_diplomacy: { title: "Manage Diplomacy", description: "İki ülke arasındaki diplomatik statüyü günceller (WAR, ALLIANCE, NON_AGGRESSION, VASSAL, EMBARGO, NEUTRAL)." },
      publish_world_event: { title: "Publish World Newspaper Event", description: "Dönem atmosferine uygun gazete manşeti ve tarih kaydı oluşturup arayüzdeki Dünya Gazetesi akışına canlı basar." },
      send_diplomatic_message: { title: "Send Diplomatic Leader Message", description: "Diğer ülkelerin liderleri ağzından oyuncunun diplomatik hamlelerine ve bire bir lider sohbetlerine karakterine uygun yanıt gönderir." },
      reply_leader_chat: { title: "Reply as Foreign Country Leader", description: "Oyuncunun bire bir lider sohbet penceresinden gönderdiği mesaja ilgili ülke başkanı olarak yanıt verir ve gerekiyorsa diplomatik statüyü günceller." },
      convene_diplomatic_council: { title: "Convene Multi-Nation Diplomatic Council / Coalition", description: "Birden fazla ülke aynı sorun veya hak savunusu için rahatsız olduğunda otomatik grup konseyi/koalisyon zirvesi kurar." },
      reply_diplomatic_council: { title: "Post Multi-Leader Debate Responses in Council", description: "Konsey odasında birden fazla liderin birbirine ve oyuncuya karşı argümanlarını ekler." },
      manage_map_markers: { title: "Manage Map Facilities, Landmarks & Animated Beacons", description: "Haritada belirli bir şehirde veya eyalette kurulan fabrika, askeri üs, tersane, demiryolu, nükleer tesis veya kriz noktasını animasyonlu nokta olarak oluşturur, günceller veya kaldırır." },
      reply_advisor_chat: { title: "Reply in AI Strategy Advisor & Brainstorm Chat", description: "Oyuncunun Danışman & Fikir Odası'nda sorduğu sorulara ve fikir isteklerine yanıt verir, isterse tek tıkla emre dönüşen suggested_orders kartları önerir (turu ilerletmez)." },
      provoke_country: { title: "Ülke Kışkırt / Üçüncü Ülkeleri Birbirine Düşür", description: "Sınır tacizi, diplomatik hakaret, isyancı desteği veya sahte bayrak operasyonuyla savaş olasılığını yükseltir ve ülkeler arasında gerçek savaş başlatır." },
      trigger_war_operation: { title: "Canlı Animasyonlu Kuşatma / Taarruz Başlat", description: "Haritada hedef eyalete doğru yürüyen askerler, zırhlı tanklar, hava akını veya deniz çıkarması harekatı başlatır/ilerletir." },
      launch_nuclear_strike: { title: "Stratejik Nükleer Saldırı Düzenle", description: "Seçili hedef eyalete/şehre balistik füze rotası, mantar bulutu animasyonu, krater işareti ve ağır hasar ile nükleer başlık fırlatır." },
      advance_turn: { title: "Advance Turn & Snapshot World", description: "Turu sonlandırır, takvimi ilerletir, bekleyen emirleri temizler ve geri alma snapshot'ı oluşturur." },
    },
    prompt: { title: "Mur4History Game Master Directive (Türkçe)", description: "Bağlı yapay zekaya Game Master simülasyon kurallarını Türkçe yükler." },
    waitingProgress: "Mur4History: Oyuncu hamlesi/mesajı süresiz bekleniyor...",
    readContextNote: "Oyuncunun bir sonraki hamle butonunu canlı beklemek ve MCP bağlantısını açık tutmak için wait_for_player_action aracını çağırın. Yanıt dili: TÜRKÇE.",
    langDirective: "ÖNEMLİ DİL KURALI: Arayüz dili TÜRKÇE. Tüm olayları, mesajları, yanıtları, harita etiketlerini ve tur özetlerini TÜRKÇE üret.",
    noSessionsErr: "Aktif oyun oturumu bulunamadı. Tarayıcıda http://localhost:3000 üzerinden bir senaryo başlatın.",
  },
  en: {
    resources: {
      "world-state": { title: "World State", desc: "Current date, turn, global tension, active language preference (ENGLISH), and wars." },
      countries: { title: "Countries", desc: "Economy, military power, domestic stability, and leader data for all nations." },
      "map-ownership": { title: "Map Ownership", desc: "Ownership and strategic status map across all 270 provinces." },
      "pending-orders": { title: "Pending Orders", desc: "Player's queued free-text orders awaiting simulation." },
      "chronicle-history": { title: "Chronicle History", desc: "Newspaper headlines and diplomatic chronicle from previous turns." },
      "pending-leader-chats": { title: "Leader Diplomacy Chats", desc: "Direct 1-on-1 diplomacy threads initiated by the player with foreign leaders." },
      "diplomatic-councils": { title: "Diplomatic Councils", desc: "Multi-nation councils, coalitions, and diplomatic protest summits." },
      "map-markers": { title: "Map Facilities & Beacons", desc: "Animated city/province factories, bases, shipyards, R&D centers, and crisis beacons." },
      "advisor-chat": { title: "AI Advisor & Strategy Chat", desc: "Live strategy advisor brainstorm room with one-click order suggestions." },
      "war-theater": { title: "Live War Theater & Probabilities", desc: "Active wars, animated sieges, tank/infantry operations, tension scores, and outbreak probabilities." },
    },
    tools: {
      list_game_sessions: { title: "List Game Sessions", description: "Lists active Mur4History game sessions, turn states, UI language, active browser tab, and selected nations." },
      switch_game_session: { title: "Switch Active Game Session", description: "Switches the active MCP session target to the given session ID and lights up its status badge." },
      wait_for_player_action: { title: "Wait Indefinitely for Player Button Click (Zero Idle Token Burn)", description: "Keeps the MCP connection open INDEFINITELY at zero idle tokens until the player clicks Complete Turn, Leader Send, Council Send, or AI Advisor in the web UI." },
      read_game_context: { title: "Read Game World Resources or Wait for Player Action", description: "Reads the active session's MCP resources or waits indefinitely for the player's next click when wait_for_action=true." },
      transfer_territory: { title: "Transfer Territory", description: "Transfers province ownership on the world map after war, annexation, purchase, or peace treaties." },
      update_country_stats: { title: "Update Country Statistics", description: "Applies economy, military, stability % (0-100), infamy, war exhaustion, and ideology updates." },
      manage_diplomacy: { title: "Manage Diplomacy", description: "Updates bilateral diplomacy status (WAR, ALLIANCE, NON_AGGRESSION, VASSAL, EMBARGO, NEUTRAL)." },
      publish_world_event: { title: "Publish World Newspaper Event", description: "Publishes an era-fitting newspaper headline and article to the live World Chronicle feed." },
      send_diplomatic_message: { title: "Send Diplomatic Leader Message", description: "Sends an in-character diplomatic dispatch from a foreign leader to the player." },
      reply_leader_chat: { title: "Reply as Foreign Country Leader", description: "Replies in character inside a 1-on-1 leader chat and optionally updates bilateral relations." },
      convene_diplomatic_council: { title: "Convene Multi-Nation Diplomatic Council / Coalition", description: "Convenes a multilateral council or coalition summit when multiple countries react to an event." },
      reply_diplomatic_council: { title: "Post Multi-Leader Debate Responses in Council", description: "Posts multi-leader debate statements responding to the player and each other inside a council." },
      manage_map_markers: { title: "Manage Map Facilities, Landmarks & Animated Beacons", description: "Creates, updates, or removes animated facilities (factories, military bases, shipyards, R&D hubs, crises) on the map." },
      reply_advisor_chat: { title: "Reply in AI Strategy Advisor & Brainstorm Chat", description: "Answers player questions in the Strategy Advisor room with optional one-click suggested_orders cards (does NOT advance turn)." },
      provoke_country: { title: "Provoke Nation / Incite Third-Party War", description: "Escalates tension and war outbreak probability via skirmishes, insults, sponsored rebels, or third-party war instigation." },
      trigger_war_operation: { title: "Launch or Advance Animated Siege / Operation", description: "Deploys animated marching infantry, tank blitz, air strikes, or naval invasions on the live world map." },
      launch_nuclear_strike: { title: "Launch Strategic Nuclear Strike", description: "Launches a strategic nuclear warhead with missile trajectory, mushroom cloud animation, and fallout crater marker." },
      advance_turn: { title: "Advance Turn & Snapshot World", description: "Finalizes the turn, advances the calendar, clears pending orders, and captures a rollback snapshot." },
    },
    prompt: { title: "Mur4History Game Master Directive (English)", description: "Loads full Game Master simulation rules and English output instructions into the connected AI." },
    waitingProgress: "Mur4History: Waiting indefinitely for player action/message...",
    readContextNote: "Call wait_for_player_action (or read_game_context wait_for_action=true) to wait live for the player's next click. Response language: ENGLISH.",
    langDirective: "IMPORTANT LANGUAGE RULE: Player UI language is ENGLISH. Write ALL world events, diplomatic messages, leader replies, council speeches, advisor analyses, map markers, and turn summaries in ENGLISH.",
    noSessionsErr: "No active game session found. Start a scenario from http://localhost:3000 in the browser first.",
  },
};

function getLocaleCopy() {
  return STDIO_LOCALE_COPY[currentLocale === "en" ? "en" : "tr"];
}

const stdioResourceHandles = new Map();
const stdioToolHandles = new Map();
let stdioPromptHandle = null;

function applyStdioLocaleMetadata(nextLocale) {
  const normalized = nextLocale === "en" ? "en" : "tr";
  if (currentLocale === normalized) return;
  currentLocale = normalized;
  const copy = getLocaleCopy();
  for (const [name, handle] of stdioResourceHandles.entries()) {
    const r = copy.resources[name];
    if (r) {
      handle.update({
        metadata: { title: r.title, description: r.desc, mimeType: "application/json" },
      });
    }
  }
  for (const [name, handle] of stdioToolHandles.entries()) {
    const t = copy.tools[name];
    if (t) {
      handle.update({ title: t.title, description: t.description });
    }
  }
  if (stdioPromptHandle) {
    stdioPromptHandle.update({
      title: copy.prompt.title,
      description: copy.prompt.description,
    });
  }
  if (server?.isConnected()) {
    try {
      server.sendResourceListChanged();
      server.sendToolListChanged();
      server.sendPromptListChanged();
    } catch {
      // Ignore transient notification failure
    }
  }
}

async function syncLocaleFromServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/mcp/status`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.locale === "tr" || data?.locale === "en") {
      applyStdioLocaleMetadata(data.locale);
    }
  } catch {
    // Ignore transient poll error
  }
}

/**
 * Pool of persistent SSE connections keyed by game sessionId so all active
 * browser tabs keep a green "MCP: Bağlı" badge without dropping.
 * @type {Map<string, { client: Client, transport: SSEClientTransport, connecting?: Promise<any> }>}
 */
const sessionPool = new Map();

async function isServerAlive() {
  try {
    const res = await fetch(`${BASE_URL}/api/sessions`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerRunning() {
  if (await isServerAlive()) return;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    console.error(`[Mur4History-MCP] Sunucu başlatılıyor (${BASE_URL})...`);
    const nextBin = path.join(
      PROJECT_ROOT,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next"
    );
    const child = spawn(process.execPath, [nextBin, "start", "--port", "3000"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (await isServerAlive()) return;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`Mur4History sunucusu başlatılamadı: ${BASE_URL}`);
  })().finally(() => {
    bootPromise = null;
  });

  return bootPromise;
}

async function fetchSessions() {
  await ensureServerRunning();
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Oturumlar alınamadı (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.sessions ?? [];
}

async function pickTargetSessionId(explicitSessionId) {
  if (explicitSessionId) return explicitSessionId;
  const sessions = await fetchSessions();
  if (sessions.length === 0) {
    throw new Error(getLocaleCopy().noSessionsErr);
  }

  // 1. Respect an explicitly switched/pinned session first
  if (pinnedSessionId && sessions.some((s) => s.id === pinnedSessionId)) {
    return pinnedSessionId;
  }

  // 2. Prefer any session currently open in the player's browser tab
  const browserOpen = sessions
    .filter((s) => s.browserActive)
    .sort((a, b) => {
      if (a.awaitingAiSimulation !== b.awaitingAiSimulation) {
        return a.awaitingAiSimulation ? -1 : 1;
      }
      return (b.lastBrowserSeenAt || 0) - (a.lastBrowserSeenAt || 0);
    });
  if (browserOpen.length > 0) {
    return browserOpen[0].id;
  }

  // 3. Prefer any waiting session, or fall back to most recently updated
  const waiting = sessions.find((s) => s.awaitingAiSimulation);
  if (waiting) return waiting.id;

  return sessions[0].id;
}

async function closeSessionConnection(sessionId) {
  const entry = sessionPool.get(sessionId);
  if (!entry) return;
  sessionPool.delete(sessionId);
  if (entry.client) {
    await entry.client.close().catch(() => undefined);
  }
  if (entry.transport) {
    await entry.transport.close().catch(() => undefined);
  }
}

async function closeAllConnections() {
  const ids = Array.from(sessionPool.keys());
  for (const id of ids) {
    await closeSessionConnection(id);
  }
}

async function connectSingleSession(targetId) {
  const existing = sessionPool.get(targetId);
  if (existing?.client) {
    return { client: existing.client, sessionId: targetId };
  }
  if (existing?.connecting) {
    await existing.connecting;
    const after = sessionPool.get(targetId);
    if (after?.client) {
      return { client: after.client, sessionId: targetId };
    }
  }

  const connectingPromise = (async () => {
    await closeSessionConnection(targetId);
    const transport = new SSEClientTransport(
      new URL(`${BASE_URL}/api/mcp/${targetId}/sse`)
    );
    const client = new Client(
      { name: "Antigravity-Mur4HistoryGM", version: "1.0.0" },
      { capabilities: {} }
    );
    transport.onclose = () => {
      const current = sessionPool.get(targetId);
      if (current && current.transport === transport) {
        sessionPool.delete(targetId);
      }
    };
    transport.onerror = () => {
      const current = sessionPool.get(targetId);
      if (current && current.transport === transport) {
        sessionPool.delete(targetId);
      }
    };
    await client.connect(transport);
    sessionPool.set(targetId, { client, transport });
    console.error(`[Mur4History-MCP] Bağlandı -> Oturum: ${targetId}`);
  })();

  sessionPool.set(targetId, {
    client: null,
    transport: null,
    connecting: connectingPromise,
  });

  try {
    await connectingPromise;
  } catch (err) {
    sessionPool.delete(targetId);
    throw err;
  }

  const ready = sessionPool.get(targetId);
  return { client: ready.client, sessionId: targetId };
}

async function getConnectedClient(explicitSessionId) {
  const targetId = await pickTargetSessionId(explicitSessionId);
  return connectSingleSession(targetId);
}

async function syncAllActiveSessions() {
  try {
    await ensureServerRunning();
    await syncLocaleFromServer();

    // Always maintain a live lobby MCP presence even before a game session is created
    const pooledLobby = sessionPool.get("lobby");
    if (!pooledLobby?.client) {
      await connectSingleSession("lobby").catch(() => undefined);
    }

    const sessions = await fetchSessions();
    if (sessions.length === 0) return;
    const candidates = sessions.slice(0, 6);
    for (const s of candidates) {
      const pooled = sessionPool.get(s.id);
      const serverSeesConnected = Boolean(s.mcpStatus?.connected);
      if (!pooled?.client || !serverSeesConnected) {
        await connectSingleSession(s.id).catch(() => undefined);
      }
    }
  } catch {
    // Server may be restarting; next tick will reconnect automatically
  }
}

async function readUpstreamResource(resourceName, explicitSessionId) {
  const { client, sessionId } = await getConnectedClient(explicitSessionId);
  const uri = `game://session/${sessionId}/${resourceName}`;
  const res = await client.readResource({ uri });
  const text = res.contents?.[0]?.text ?? "{}";
  return { sessionId, uri, text };
}

async function runWaitForPlayerActionLoop(
  explicitSessionId,
  timeoutSeconds = 0,
  extra = undefined
) {
  const numericTimeout = Number(timeoutSeconds);
  const isInfinite =
    !Number.isFinite(numericTimeout) || numericTimeout <= 0;
  const deadline = isInfinite
    ? Infinity
    : Date.now() + Math.max(1, Math.min(86400, numericTimeout)) * 1000;

  let lastResult = null;
  let tick = 0;
  const progressToken = extra?._meta?.progressToken;

  const emitProgress = async (msg) => {
    if (progressToken === undefined || !extra?.sendNotification) return;
    tick += 1;
    await extra
      .sendNotification({
        method: "notifications/progress",
        params: {
          progressToken,
          progress: tick,
          message: msg,
        },
      })
      .catch(() => undefined);
  };

  while (!extra?.signal?.aborted) {
    if (!isInfinite && Date.now() >= deadline) {
      break;
    }

    const chunkSec = isInfinite
      ? 45
      : Math.max(1, Math.min(45, Math.ceil((deadline - Date.now()) / 1000)));

    await emitProgress(getLocaleCopy().waitingProgress);

    try {
      const { client } = await getConnectedClient(explicitSessionId);
      const toolRes = await client.callTool(
        {
          name: "wait_for_player_action",
          arguments: { timeout_seconds: chunkSec },
        },
        undefined,
        {
          timeout: (chunkSec + 30) * 1000,
          signal: extra?.signal,
          resetTimeoutOnProgress: true,
        }
      );

      const rawText = toolRes?.content?.[0]?.text;
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          lastResult = toolRes;
          if (parsed.triggered) {
            if (parsed.sessionId) {
              pinnedSessionId = parsed.sessionId;
            }
            return toolRes;
          }
          // If finite timeout mode expired, break cleanly; otherwise keep waiting silently!
          if (!isInfinite && Date.now() >= deadline) {
            break;
          }
        } catch {
          return toolRes;
        }
      } else {
        return toolRes;
      }
    } catch (err) {
      if (extra?.signal?.aborted) {
        break;
      }
      // Transient HTTP/server hiccup during indefinite wait: reconnect cleanly without burning AI tokens
      if (!isInfinite && Date.now() >= deadline) {
        throw err;
      }
      console.error(
        "[Mur4History-MCP] Bekleme bağlantısı yenileniyor:",
        err instanceof Error ? err.message : String(err)
      );
      await closeAllConnections();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return (
    lastResult ?? {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              triggered: false,
              status: extra?.signal?.aborted
                ? "WAIT_ABORTED"
                : "HEARTBEAT_CONTINUE_WAITING",
              next_required_tool: "wait_for_player_action",
            },
            null,
            2
          ),
        },
      ],
    }
  );
}

const server = new McpServer({
  name: "mur4history-gm",
  version: "1.0.0",
});

// ============================================================
// RESOURCES (Active Session Proxied)
// ============================================================

for (const name of Object.keys(STDIO_LOCALE_COPY.tr.resources)) {
  const { title, desc } = getLocaleCopy().resources[name];
  const handle = server.registerResource(
    name,
    `game://session/active/${name}`,
    { title, description: desc, mimeType: "application/json" },
    async () => {
      const { uri, text } = await readUpstreamResource(name);
      return {
        contents: [{ uri, mimeType: "application/json", text }],
      };
    }
  );
  stdioResourceHandles.set(name, handle);
}

// ============================================================
// SESSION MANAGEMENT, WAIT LOOP & RESOURCE READER TOOLS
// ============================================================

stdioToolHandles.set(
  "list_game_sessions",
  server.registerTool(
    "list_game_sessions",
    {
      ...getLocaleCopy().tools.list_game_sessions,
      inputSchema: {},
    },
    async () => {
      await syncLocaleFromServer();
      const copy = getLocaleCopy();
      const sessions = await fetchSessions();
      const activeTarget = await pickTargetSessionId().catch(() => null);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                preferredLanguage: currentLocale,
                languageDirective: copy.langDirective,
                activeSessionId: activeTarget,
                pinnedSessionId,
                connectedSessionIds: Array.from(sessionPool.keys()),
                sessions: sessions.map((s) => ({
                  id: s.id,
                  name: s.name,
                  scenario: s.scenario?.title,
                  playerCountryCode: s.playerCountryCode,
                  currentDate: s.currentDate,
                  turnNumber: s.turnNumber,
                  difficulty: s.difficulty,
                  globalTension: s.globalTension,
                  awaitingAiSimulation: s.awaitingAiSimulation,
                  browserActive: s.browserActive,
                  mcpConnected: s.mcpStatus?.connected ?? false,
                  aiWaiting: s.mcpStatus?.aiWaiting ?? false,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  )
);

stdioToolHandles.set(
  "switch_game_session",
  server.registerTool(
    "switch_game_session",
    {
      ...getLocaleCopy().tools.switch_game_session,
      inputSchema: {
        session_id: z.string().describe("Target game session ID."),
      },
    },
    async ({ session_id }) => {
      pinnedSessionId = session_id;
      const { sessionId } = await getConnectedClient(session_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, connectedSessionId: sessionId }),
          },
        ],
      };
    }
  )
);

stdioToolHandles.set(
  "wait_for_player_action",
  server.registerTool(
    "wait_for_player_action",
    {
      ...getLocaleCopy().tools.wait_for_player_action,
      inputSchema: {
        timeout_seconds: z
          .number()
          .min(0)
          .max(86400)
          .optional()
          .describe("Default 0 = Indefinite Wait until player acts."),
        session_id: z.string().optional(),
      },
    },
    async ({ timeout_seconds, session_id }, extra) => {
      await syncLocaleFromServer();
      return runWaitForPlayerActionLoop(session_id, timeout_seconds ?? 0, extra);
    }
  )
);

stdioToolHandles.set(
  "read_game_context",
  server.registerTool(
    "read_game_context",
    {
      ...getLocaleCopy().tools.read_game_context,
      inputSchema: {
        resource: z
          .enum([
            "world-state",
            "countries",
            "map-ownership",
            "map-markers",
            "advisor-chat",
            "pending-orders",
            "chronicle-history",
            "pending-leader-chats",
            "diplomatic-councils",
            "wait-for-action",
            "all",
          ])
          .default("all"),
        wait_for_action: z
          .boolean()
          .optional()
          .describe(
            "If true, holds open indefinitely until the player triggers an action in the UI."
          ),
        timeout_seconds: z.number().min(0).max(86400).optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ resource, wait_for_action, timeout_seconds, session_id }, extra) => {
      await syncLocaleFromServer();
      if (wait_for_action || resource === "wait-for-action") {
        return runWaitForPlayerActionLoop(session_id, timeout_seconds ?? 0, extra);
      }

      if (resource !== "all") {
        const { sessionId, text } = await readUpstreamResource(
          resource,
          session_id
        );
        return {
          content: [
            {
              type: "text",
              text: `Session: ${sessionId}\nResource: ${resource}\n${text}`,
            },
          ],
        };
      }

      const [ws, countries, orders, chronicle, leaderChats, councils, markers, advisorChat] =
        await Promise.all([
          readUpstreamResource("world-state", session_id),
          readUpstreamResource("countries", session_id),
          readUpstreamResource("pending-orders", session_id),
          readUpstreamResource("chronicle-history", session_id),
          readUpstreamResource("pending-leader-chats", session_id),
          readUpstreamResource("diplomatic-councils", session_id),
          readUpstreamResource("map-markers", session_id),
          readUpstreamResource("advisor-chat", session_id),
        ]);

      const copy = getLocaleCopy();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                preferredLanguage: currentLocale,
                languageDirective: copy.langDirective,
                sessionId: ws.sessionId,
                worldState: JSON.parse(ws.text),
                pendingOrders: JSON.parse(orders.text),
                pendingLeaderChats: JSON.parse(leaderChats.text),
                diplomaticCouncils: JSON.parse(councils.text),
                mapMarkers: JSON.parse(markers.text),
                advisorChat: JSON.parse(advisorChat.text),
                countriesCount: JSON.parse(countries.text).length,
                majorCountries: JSON.parse(countries.text).filter(
                  (c) => c.is_major
                ),
                chronicleHistory: JSON.parse(chronicle.text),
                note: copy.readContextNote,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  )
);

// ============================================================
// GAME MASTER MUTATION TOOLS (PROXIED TO LIVE SESSION)
// ============================================================

stdioToolHandles.set(
  "transfer_territory",
  server.registerTool(
    "transfer_territory",
    {
      ...getLocaleCopy().tools.transfer_territory,
      inputSchema: {
        region_ids: z.array(z.string()).min(1),
        new_owner_country_id: z.string(),
        reason: z.string(),
        session_id: z.string().optional(),
      },
    },
    async ({ region_ids, new_owner_country_id, reason, session_id }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "transfer_territory",
        arguments: { region_ids, new_owner_country_id, reason },
      });
    }
  )
);

stdioToolHandles.set(
  "update_country_stats",
  server.registerTool(
    "update_country_stats",
    {
      ...getLocaleCopy().tools.update_country_stats,
      inputSchema: {
        country_id: z.string(),
        economy_delta: z.number(),
        military_delta: z.number(),
        stability_delta: z.number(),
        infamy_delta: z.number().optional(),
        war_exhaustion_delta: z.number().optional(),
        new_ideology: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({
      country_id,
      economy_delta,
      military_delta,
      stability_delta,
      infamy_delta,
      war_exhaustion_delta,
      new_ideology,
      session_id,
    }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "update_country_stats",
        arguments: {
          country_id,
          economy_delta,
          military_delta,
          stability_delta,
          infamy_delta,
          war_exhaustion_delta,
          new_ideology,
        },
      });
    }
  )
);

stdioToolHandles.set(
  "manage_diplomacy",
  server.registerTool(
    "manage_diplomacy",
    {
      ...getLocaleCopy().tools.manage_diplomacy,
      inputSchema: {
        country_a: z.string(),
        country_b: z.string(),
        relation_status: z.enum([
          "WAR",
          "ALLIANCE",
          "NON_AGGRESSION",
          "VASSAL",
          "EMBARGO",
          "NEUTRAL",
        ]),
        treaty_name: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ country_a, country_b, relation_status, treaty_name, session_id }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "manage_diplomacy",
        arguments: { country_a, country_b, relation_status, treaty_name },
      });
    }
  )
);

stdioToolHandles.set(
  "publish_world_event",
  server.registerTool(
    "publish_world_event",
    {
      ...getLocaleCopy().tools.publish_world_event,
      inputSchema: {
        headline: z.string(),
        article_body: z.string(),
        category: z.enum(["WAR", "DIPLOMACY", "ECONOMY", "INTERNAL", "CRISIS"]),
        involved_countries: z.array(z.string()),
        session_id: z.string().optional(),
      },
    },
    async ({
      headline,
      article_body,
      category,
      involved_countries,
      session_id,
    }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "publish_world_event",
        arguments: { headline, article_body, category, involved_countries },
      });
    }
  )
);

stdioToolHandles.set(
  "send_diplomatic_message",
  server.registerTool(
    "send_diplomatic_message",
    {
      ...getLocaleCopy().tools.send_diplomatic_message,
      inputSchema: {
        from_country_id: z.string(),
        to_country_id: z.string(),
        sender_title: z.string(),
        message: z.string(),
        session_id: z.string().optional(),
      },
    },
    async ({
      from_country_id,
      to_country_id,
      sender_title,
      message,
      session_id,
    }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "send_diplomatic_message",
        arguments: { from_country_id, to_country_id, sender_title, message },
      });
    }
  )
);

stdioToolHandles.set(
  "reply_leader_chat",
  server.registerTool(
    "reply_leader_chat",
    {
      ...getLocaleCopy().tools.reply_leader_chat,
      inputSchema: {
        target_country_id: z.string(),
        leader_name: z.string().optional(),
        reply_message: z.string(),
        relation_status: z
          .enum([
            "WAR",
            "ALLIANCE",
            "NON_AGGRESSION",
            "VASSAL",
            "EMBARGO",
            "NEUTRAL",
          ])
          .optional(),
        treaty_name: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({
      target_country_id,
      leader_name,
      reply_message,
      relation_status,
      treaty_name,
      session_id,
    }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "reply_leader_chat",
        arguments: {
          target_country_id,
          leader_name,
          reply_message,
          relation_status,
          treaty_name,
        },
      });
    }
  )
);

stdioToolHandles.set(
  "convene_diplomatic_council",
  server.registerTool(
    "convene_diplomatic_council",
    {
      ...getLocaleCopy().tools.convene_diplomatic_council,
      inputSchema: {
        title: z.string(),
        topic: z.string(),
        council_type: z.enum(["COUNCIL", "COALITION", "SUMMIT", "PROTEST"]),
        initiator_country_id: z.string(),
        participant_country_ids: z.array(z.string()).min(1),
        opening_statements: z
          .array(
            z.object({
              country_id: z.string(),
              message: z.string(),
              stance: z
                .enum([
                  "SUPPORTIVE",
                  "CRITICAL",
                  "THREATENING",
                  "NEUTRAL",
                  "MEDIATOR",
                ])
                .optional(),
            })
          )
          .min(1),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "convene_diplomatic_council",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "reply_diplomatic_council",
  server.registerTool(
    "reply_diplomatic_council",
    {
      ...getLocaleCopy().tools.reply_diplomatic_council,
      inputSchema: {
        council_id: z.string(),
        responses: z
          .array(
            z.object({
              country_id: z.string(),
              leader_name: z.string().optional(),
              message: z.string(),
              stance: z
                .enum([
                  "SUPPORTIVE",
                  "CRITICAL",
                  "THREATENING",
                  "NEUTRAL",
                  "MEDIATOR",
                ])
                .optional(),
            })
          )
          .min(1),
        council_status: z.enum(["OPEN", "RESOLVED", "COLLAPSED"]).optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "reply_diplomatic_council",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "manage_map_markers",
  server.registerTool(
    "manage_map_markers",
    {
      ...getLocaleCopy().tools.manage_map_markers,
      inputSchema: {
        action: z.enum(["CREATE", "UPDATE", "REMOVE"]),
        marker_id: z.string().optional(),
        country_id: z.string().optional(),
        region_id: z.string().optional(),
        city_name: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z
          .enum([
            "INDUSTRY",
            "MILITARY",
            "INFRASTRUCTURE",
            "NAVAL",
            "RESEARCH",
            "DIPLOMACY",
            "INTERNAL",
            "CRISIS",
          ])
          .optional(),
        status: z
          .enum([
            "ACTIVE",
            "UNDER_CONSTRUCTION",
            "DAMAGED",
            "ALERT",
            "COMPLETED",
          ])
          .optional(),
        level: z.number().min(1).max(5).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        is_animated: z.boolean().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "manage_map_markers",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "reply_advisor_chat",
  server.registerTool(
    "reply_advisor_chat",
    {
      ...getLocaleCopy().tools.reply_advisor_chat,
      inputSchema: {
        reply_message: z.string(),
        suggested_orders: z
          .array(
            z.object({
              title: z.string(),
              category: z
                .enum([
                  "COMMAND",
                  "ECONOMY",
                  "MILITARY",
                  "DIPLOMACY",
                  "COVERT",
                  "INTERNAL",
                  "NOTE_TO_AI",
                ])
                .optional(),
              command: z.string(),
            })
          )
          .optional(),
        advisor_title: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "reply_advisor_chat",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "provoke_country",
  server.registerTool(
    "provoke_country",
    {
      ...getLocaleCopy().tools.provoke_country,
      inputSchema: {
        actor_country_id: z.string(),
        target_country_id: z.string(),
        instigate_with_country_id: z.string().optional(),
        action_type: z.enum([
          "BORDER_SKIRMISH",
          "DIPLOMATIC_INSULT",
          "SPONSOR_REBELS",
          "INCITE_THIRD_PARTY_WAR",
          "DECLARE_WAR",
        ]),
        target_region_id: z.string().optional(),
        custom_note: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "provoke_country",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "trigger_war_operation",
  server.registerTool(
    "trigger_war_operation",
    {
      ...getLocaleCopy().tools.trigger_war_operation,
      inputSchema: {
        mode: z.enum(["LAUNCH", "ADVANCE"]).default("LAUNCH"),
        attacker_country_id: z.string().optional(),
        defender_country_id: z.string().optional(),
        target_region_id: z.string().optional(),
        operation_type: z
          .enum([
            "SIEGE",
            "ASSAULT",
            "TANK_BLITZ",
            "AIR_STRIKE",
            "NAVAL_INVASION",
            "REBEL_UPRISING",
          ])
          .optional(),
        unit_type: z.enum(["INFANTRY", "ARMOR", "AIR", "NAVAL"]).optional(),
        intensity: z.number().min(10).max(100).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "trigger_war_operation",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "launch_nuclear_strike",
  server.registerTool(
    "launch_nuclear_strike",
    {
      ...getLocaleCopy().tools.launch_nuclear_strike,
      inputSchema: {
        attacker_country_id: z.string(),
        defender_country_id: z.string(),
        target_region_id: z.string().optional(),
        title: z.string().optional(),
        session_id: z.string().optional(),
      },
    },
    async ({ session_id, ...args }) => {
      const { client } = await getConnectedClient(session_id);
      return client.callTool({
        name: "launch_nuclear_strike",
        arguments: args,
      });
    }
  )
);

stdioToolHandles.set(
  "advance_turn",
  server.registerTool(
    "advance_turn",
    {
      ...getLocaleCopy().tools.advance_turn,
      inputSchema: {
        new_date: z.string(),
        turn_summary: z.string(),
        wait_for_next_action: z
          .boolean()
          .optional()
          .describe(
            "Optional: if true, immediately waits indefinitely for player action after advancing turn."
          ),
        session_id: z.string().optional(),
      },
    },
    async ({ new_date, turn_summary, wait_for_next_action, session_id }, extra) => {
      const { client, sessionId } = await getConnectedClient(session_id);
      const res = await client.callTool({
        name: "advance_turn",
        arguments: { new_date, turn_summary },
      });
      if (wait_for_next_action) {
        return runWaitForPlayerActionLoop(sessionId, 0, extra);
      }
      return res;
    }
  )
);

// ============================================================
// GAME MASTER PROMPT
// ============================================================

stdioPromptHandle = server.registerPrompt(
  "pax_game_master_prompt",
  {
    ...getLocaleCopy().prompt,
    argsSchema: {
      player_focus: z.string().optional(),
    },
  },
  async ({ player_focus }) => {
    await syncLocaleFromServer();
    const target = await getConnectedClient().catch(() =>
      connectSingleSession("lobby")
    );
    return target.client.getPrompt({
      name: "pax_game_master_prompt",
      arguments: player_focus ? { player_focus } : {},
    });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Mur4History-MCP] Stdio köprüsü hazır.");

  // Immediately connect to all recent active sessions so the UI badge is always green
  syncAllActiveSessions().catch((err) => {
    console.error(
      "[Mur4History-MCP] İlk otomatik bağlantı bekliyor:",
      err.message
    );
  });

  // Periodic 3s heartbeat & auto-reconnect if Next.js restarts or new sessions are created
  const pollTimer = setInterval(() => {
    void syncAllActiveSessions();
  }, 3000);
  if (!process.argv.includes("--daemon")) {
    pollTimer.unref();
  }

  process.on("SIGINT", async () => {
    await closeAllConnections();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await closeAllConnections();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Mur4History-MCP] Başlatma hatası:", err);
  process.exit(1);
});
