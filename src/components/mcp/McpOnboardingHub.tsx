"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Lock,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Terminal,
  Unlock,
} from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface GlobalMcpStatusPayload {
  connected: boolean;
  connectionCount: number;
  aiWaiting: boolean;
  waitingCount: number;
  locale?: "tr" | "en";
  clients: Array<{
    connectionId: string;
    sessionId: string;
    clientName: string;
    transport: "sse" | "streamable-http";
    lastSeenAt: string;
  }>;
}

interface McpOnboardingHubProps {
  mcpStatus: GlobalMcpStatusPayload;
  projectRoot?: string;
  sessionId?: string;
  variant?: "welcome" | "gate-overlay";
  highlightPulse?: boolean;
}

export function buildMasterSetupAndGamePrompt(params: {
  locale: "tr" | "en";
  origin: string;
  stdioScriptPath: string;
  sessionId?: string;
}): string {
  const { locale, origin, stdioScriptPath, sessionId } = params;
  const normalizedPath = stdioScriptPath.replace(/\\/g, "/");
  const streamableLobbyUrl = `${origin}/api/mcp/lobby`;
  const sseLobbyUrl = `${origin}/api/mcp/lobby/sse`;
  const targetHttpUrl = sessionId
    ? `${origin}/api/mcp/${sessionId}`
    : streamableLobbyUrl;

  if (locale === "en") {
    return `You are receiving this instruction to automatically connect yourself via Model Context Protocol (MCP) to **Mur4History** and act as its autonomous **Head Game Master & World Simulation AI**.

====================================================================
PART 1: AUTOMATIC MCP INSTALLATION & CONNECTION
====================================================================
Please detect what environment/IDE you are running inside (Antigravity, Cursor, Claude Desktop, Windsurf, Cline, or any MCP-compatible host) and configure the **\`mur4history\`** MCP server for the user automatically:

1. **Method A — Local Stdio Bridge (Recommended if Mur4History runs locally on this PC)**
   - Script path: \`${normalizedPath}\`
   - Add this entry into the user's MCP config without deleting existing servers:
     \`\`\`json
     {
       "mcpServers": {
         "mur4history": {
           "command": "node",
           "args": ["${normalizedPath}"]
         }
       }
     }
     \`\`\`
   - Common config file locations:
     * Antigravity: \`~/.gemini/antigravity/mcp_config.json\`
     * Cursor: \`.cursor/mcp.json\` or \`~/.cursor/mcp.json\`
     * Claude Desktop (Windows): \`%APPDATA%\\Claude\\claude_desktop_config.json\`
     * Claude Desktop (macOS): \`~/Library/Application Support/Claude/claude_desktop_config.json\`

2. **Method B — Direct HTTP / SSE Endpoint (Recommended for remote, Docker, or URL-capable MCP clients)**
   - Streamable HTTP Lobby URL (auto-tracks active campaign): \`${targetHttpUrl}\`
   - Legacy SSE URL: \`${sseLobbyUrl}\`
   - JSON config example:
     \`\`\`json
     {
       "mcpServers": {
         "mur4history": {
           "url": "${targetHttpUrl}"
         }
       }
     }
     \`\`\`
   - If your host only supports stdio -> remote bridging, use: \`npx -y mcp-remote ${targetHttpUrl}\`.

3. **Verify Connection Immediately**:
   - If you have file/command access, write or update the MCP configuration file right away (or instruct the user cleanly if manual approval/reload is needed).
   - Once the connection handshake reaches \`${streamableLobbyUrl}\`, the Mur4History browser lock opens automatically in real time!
   - As soon as your \`mur4history\` MCP tools become active, call \`list_game_sessions\`. If a session exists, call \`read_game_context\` and \`pax_game_master_prompt\`; if none exists yet, immediately call \`wait_for_player_action\` with \`timeout_seconds: 0\` (indefinite wait, zero idle token burn) until the player launches a scenario and sends their first action.

====================================================================
PART 2: FULL GAME OVERVIEW — WHAT IS MUR4HISTORY?
====================================================================
- **Identity**: **Mur4History** is a **Turkish-made (Made in Türkiye)** open-source Alternate History & Grand Strategy sandbox crafted with **Vibe Coding**. It intentionally runs with **0 server-side LLM API fees** because YOUR MCP AI acts directly as the Game Master simulation engine.
- **Map & World Engine**:
  * Interactive **MapLibre GL** world map with **270 geopolitical provinces** (\`region_id\`), capitals, borders, 14 live cartographic map themes (\`Pax Imperial Atlas\`, \`Mur4History Classic\`, \`Victoria Parchment (1836)\`, etc.), and 8 Web Audio ambient soundtracks.
- **12 Official Historical Preset Scenarios**:
  \`2026\` (Modern Geopolitics), \`1991\` (End of the Cold War), \`1962\` (Cold War), \`1942\` (Stalingrad & El Alamein), \`1939\` (World War II), \`1936\` (Gathering Storm), \`1919\` (Turkish War of Independence), \`1914\` (World War I), \`1877\` (93 War & Plevna), \`1812\` (Napoleonic Wars), \`1526\` (Age of Suleiman), and \`1444\` (Dawn of Empires).
- **Difficulty Tiers & Time Jumps**:
  * 5 Difficulty Tiers (\`VERY_EASY\`, \`EASY\`, \`NORMAL\`, \`HARD\`, \`IMPOSSIBLE\`) govern treaty acceptance odds, coalition tolerance, and AI geopolitical resistance.
  * Configurable time jump intervals (\`1W\`, \`1M\`, \`3M\`, \`6M\`, \`1Y\`, or scenario default).
- **Gameplay Mechanics Visible to the Player**:
  * **Order Console**: Players submit freeform orders in 7 categories (\`COMMAND\`, \`ECONOMY\`, \`MILITARY\`, \`DIPLOMACY\`, \`COVERT\`, \`INTERNAL\`, \`NOTE_TO_AI\`).
  * **Animated Map Landmarks**: Factories, military bases, shipyards, research hubs, infrastructure corridors, summits, and crises pulse visibly at exact cities/provinces.
  * **Diplomacy Hall**: Live 1-on-1 chats with world leaders AND multi-nation **Diplomatic Councils / Coalitions / Protests** when multiple states react to player actions.
  * **AI Strategy Advisor**: In-game brainstorm room where the player asks strategy questions and receives 1-click actionable \`suggested_orders\` cards without advancing the turn.
  * **Smart World Gazette & Rollback**: Categorized headlines (\`LATEST\` / \`OLD\`), diplomatic cables, turn snapshots with full time-travel rollback, and portable \`.mur4history.json\` / browser IndexedDB save files.

====================================================================
PART 3: MCP RESOURCES, TOOLS & GAME MASTER RULES
====================================================================
- **9 Read-Only MCP Resources**:
  \`world-state\`, \`countries\`, \`map-ownership\`, \`pending-orders\`, \`chronicle-history\`, \`pending-leader-chats\`, \`diplomatic-councils\`, \`map-markers\`, \`advisor-chat\`.
- **12+ MCP Mutation & Orchestration Tools**:
  * \`list_game_sessions\`, \`read_game_context\` — Inspect sessions and full active world state.
  * \`transfer_territory\` — Annexations, peace treaties, occupations, land transfers (\`region_ids\`, \`new_owner_country_id\`, \`reason\`).
  * \`update_country_stats\` — Adjust \`economy_delta\`, \`military_delta\`, \`stability_delta\`, \`infamy_delta\`, \`war_exhaustion_delta\`, \`new_ideology\`.
  * \`manage_diplomacy\` — Set \`WAR\`, \`ALLIANCE\`, \`NON_AGGRESSION\`, \`VASSAL\`, \`EMBARGO\`, or \`NEUTRAL\`.
  * \`manage_map_markers\` — Place/update/remove animated city/province landmarks (\`INDUSTRY\`, \`MILITARY\`, \`INFRASTRUCTURE\`, \`NAVAL\`, \`RESEARCH\`, \`DIPLOMACY\`, \`INTERNAL\`, \`CRISIS\`). ALWAYS add/update markers whenever construction, bases, summits, or battles happen!
  * \`publish_world_event\` — Publish 1–3 crisp grouped World Gazette articles per turn (never spam 10 tiny fragments).
  * \`send_diplomatic_message\` & \`reply_leader_chat\` — Respond in character as foreign heads of state.
  * \`convene_diplomatic_council\` & \`reply_diplomatic_council\` — Summon multi-nation protests/coalitions/summits when 2+ powers react to aggression or crises.
  * \`reply_advisor_chat\` — Answer questions in the AI Advisor room (can attach \`suggested_orders\`). **NEVER call \`advance_turn\` for advisor or leader chat replies!**
  * \`advance_turn\` — Finalize turn, advance date, clear order queue, and save rollback snapshot (only when resolving an actual turn completion).
  * \`wait_for_player_action\` — Always call with no timeout (\`timeout_seconds: 0\`) whenever you finish a turn/reply or have nothing pending. It stays asleep indefinitely with zero token burn until the player clicks an action in the UI!

Begin setup now and report clearly once Mur4History MCP is active and standing by.`;
  }

  return `Bu talimatı **Mur4History** oyununu Model Context Protocol (MCP) üzerinden otomatik olarak kendi ortamına bağlaman ve ardından oyunun baş **Game Master (Dünya Simülatörü)** yapay zekası olarak göreve başlaman için paylaşıyorum.

====================================================================
BÖLÜM 1: OTOMATİK MCP KURULUMU VE BAĞLANTI ADIMLARI
====================================================================
Lütfen şu an çalıştığın IDE / yapay zeka istemcisini tespit et (Antigravity, Cursor, Claude Desktop, Windsurf, Cline vb.) ve **\`mur4history\`** MCP sunucusunu kullanıcı için otomatik kur:

1. **Yöntem A — Lokal Stdio Köprüsü (Mur4History bu bilgisayarda çalışıyorsa EN ÖNERİLEN yöntem)**
   - Köprü dosya yolu: \`${normalizedPath}\`
   - Mevcut MCP sunucularını bozmadan config dosyana şu sunucuyu ekle:
     \`\`\`json
     {
       "mcpServers": {
         "mur4history": {
           "command": "node",
           "args": ["${normalizedPath}"]
         }
       }
     }
     \`\`\`
   - Yaygın MCP ayar dosyası konumları:
     * Antigravity: \`~/.gemini/antigravity/mcp_config.json\`
     * Cursor: \`.cursor/mcp.json\` veya \`~/.cursor/mcp.json\`
     * Claude Desktop (Windows): \`%APPDATA%\\Claude\\claude_desktop_config.json\`
     * Claude Desktop (macOS): \`~/Library/Application Support/Claude/claude_desktop_config.json\`

2. **Yöntem B — Doğrudan HTTP / SSE Bağlantısı (Dosya yolu gerekmeden veya Docker / uzak istemciler için)**
   - Streamable HTTP Lobi Adresi (aktif oturumu otomatik algılar): \`${targetHttpUrl}\`
   - Legacy SSE Adresi: \`${sseLobbyUrl}\`
   - JSON ayarı:
     \`\`\`json
     {
       "mcpServers": {
         "mur4history": {
           "url": "${targetHttpUrl}"
         }
       }
     }
     \`\`\`
   - Sadece stdio destekleyen istemcilerde \`npx -y mcp-remote ${targetHttpUrl}\` kullanabilirsin.

3. **Bağlantıyı Hemen Doğrula & Beklemeye Geç**:
   - Dosya düzenleme / terminal yetkin varsa yukarıdaki MCP ayarını doğrudan yaz ve sunucuyu başlat; yetkin yoksa kullanıcıya kendi istemcisi için tam JSON bloğunu ve yapıştıracağı dosya yolunu açıkça ver.
   - Bağlantı \`${streamableLobbyUrl}\` ucuna ulaştığı anda web sitesindeki **"MCP Bağlanmadan Girilmez"** kilidi otomatik olarak canlı açılacaktır!
   - Bağlantı aktif olur olmaz \`list_game_sessions\` çağır: Eğer açık bir oyun oturumu varsa \`read_game_context\` ile dünyayı incele ve ardından **DERHAL \`wait_for_player_action\` (\`timeout_seconds: 0\` = SÜRESİZ BEKLEME)** aracını çağırarak oyuncunun hamlesini sıfır token tüketimiyle beklemeye başla.

====================================================================
BÖLÜM 2: OYUNUN TAM TANITIMI — MUR4HISTORY NEDİR?
====================================================================
- **Kimlik & Köken**: **Mur4History**, **Türk yapımı** açık kaynaklı, baştan sona **Vibe Coding** yaklaşımıyla geliştirilmiş, sunucu tarafında hiçbir LLM API anahtarı veya ek token ücreti gerektirmeyen bir **Alternatif Tarih & Büyük Strateji MCP Simülasyon Platformudur**.
- **Harita ve Atmosfer**:
  * **MapLibre GL** tabanlı, **270 etkileşimli dünya eyaleti** (\`region_id\`), kıta kabartma gölgelemeleri, kavisli ülke isimleri, **14 farklı canlı harita teması** (\`Pax Imperial Atlas\`, \`Mur4History Klasik\`, \`Victoria Parchment (1836)\` vb.) ve **8 dahili Web Audio fon müziği** sunar.
  * **Türkçe ve İngilizce** iki dilli arayüzü tarayıcı diline göre otomatik seçer.
- **12 Resmi Tarihsel Preset Senaryo**:
  \`2026\` (Modern Jeopolitik), \`1991\` (Soğuk Savaş'ın Sonu), \`1962\` (Soğuk Savaş), \`1942\` (Stalingrad & El Alamein), \`1939\` (II. Dünya Savaşı), \`1936\` (Fırtına Öncesi), \`1919\` (Türk Kurtuluş Savaşı), \`1914\` (I. Dünya Savaşı), \`1877\` (93 Harbi & Plevne), \`1812\` (Napolyon Savaşları), \`1526\` (Kanuni & Mohaç) ve \`1444\` (Yeni Çağ).
- **Zorluk Modları & Oynanış Döngüsü**:
  * 5 Zorluk Seviyesi (\`VERY_EASY\`, \`EASY\`, \`NORMAL\`, \`HARD\`, \`IMPOSSIBLE\`) AI'nın antlaşma kabul oranını ve diplomatik direncini doğrudan belirler.
  * **Emir Konsolu**: Oyuncu 7 kategoride serbest metin direktifler yazar (\`COMMAND\`, \`ECONOMY\`, \`MILITARY\`, \`DIPLOMACY\`, \`COVERT\`, \`INTERNAL\`, \`NOTE_TO_AI\`) ve *"Turu Tamamla"* butonuna basar.
  * **Animasyonlu Harita Tesisleri & İşaretleri**: Şehir veya eyaletlerde kurulan fabrikalar, askeri üsler, tersaneler, AR-GE merkezleri, altyapı projeleri, zirveler ve kriz noktaları harita üzerinde canlı parlayan işaretçilerle gösterilir.
  * **Diplomasi Salonu & Çok Uluslu Konseyler**: Yabancı ülke başkanlarıyla 1'e 1 canlı mesajlaşma ve birden fazla ülkenin aynı kriz veya ittifak için toplandığı Çok Uluslu Konsey / Koalisyon / Protesto masaları bulunur.
  * **AI Strateji Danışmanı & Fikir Odası**: Oyuncu turu bitirmeden stratejik fikir sorabilir ve tek tıkla emir kutusuna aktarılabilen öneri kartları (\`suggested_orders\`) alır.
  * **Akıllı Gazete, Kronoloji, Rollback & Kayıt Sistemi**: \`GÜNCEL\` / \`ESKİ\` damgalı gazete ve telgraf arşivi, turları geri alma (Zaman Yolculuğu), tarayıcı içi (IndexedDB) + \`.mur4history.json\` sürükle-bırak kayıt/içe aktarma sistemi.

====================================================================
BÖLÜM 3: MCP KAYNAKLARI, ARAÇLARI & GAME MASTER KURALLARI
====================================================================
- **9 Salt Okunur MCP Kaynağı (Resources)**:
  \`world-state\`, \`countries\`, \`map-ownership\`, \`pending-orders\`, \`chronicle-history\`, \`pending-leader-chats\`, \`diplomatic-councils\`, \`map-markers\`, \`advisor-chat\`.
- **12+ Canlı Dünya Yönetimi Aracı (Tools)**:
  * \`list_game_sessions\`, \`read_game_context\`: Oturumları ve dünya durumunu okur.
  * \`transfer_territory\`: Savaş, ilhak veya barış antlaşması ile eyalet (\`region_ids\`) sahipliğini haritada canlı değiştirir.
  * \`update_country_stats\`: Ekonomi, ordu, istikrar %, agresiflik (infamy), savaş yorgunluğu ve ideoloji günceller.
  * \`manage_diplomacy\`: \`WAR\`, \`ALLIANCE\`, \`NON_AGGRESSION\`, \`VASSAL\`, \`EMBARGO\`, \`NEUTRAL\` statülerini işler.
  * \`manage_map_markers\`: Haritadaki şehir/eyalet tesislerini (\`INDUSTRY\`, \`MILITARY\`, \`INFRASTRUCTURE\`, \`NAVAL\`, \`RESEARCH\`, \`DIPLOMACY\`, \`INTERNAL\`, \`CRISIS\`) oluşturur, geliştirir veya kaldırır. İnşa/üs/zirve/çatışma kararlarında MUTLAKA kullan!
  * \`publish_world_event\`: Dünya Gazetesi'nde tur başına 1-3 toplu, net kategorili manşet yayınlar.
  * \`send_diplomatic_message\` & \`reply_leader_chat\`: Yabancı devlet başkanları ağzından karakterine uygun yanıt verir.
  * \`convene_diplomatic_council\` & \`reply_diplomatic_council\`: Oyuncunun hamlesi 2+ ülkeyi rahatsız ettiyse otomatik çok uluslu konsey/koalisyon kurup liderleri konuşturur.
  * \`reply_advisor_chat\`: AI Danışman odasındaki soruları analiz + \`suggested_orders\` ile yanıtlar. **DİKKAT: Danışman veya lider sohbeti yanıtlarken \`advance_turn\` ÇAĞIRMA!**
  * \`advance_turn\`: Yalnızca tur tamamlama emirleri işlendiğinde tarihi ilerletip snapshot alır.
  * \`wait_for_player_action\`: Her işlemden sonra veya bekleyen işlem yokken parametresiz (\`timeout_seconds: 0\`) çağır! Oyuncu bir şey yapana kadar sıfır gereksiz token harcamadan süresiz bekler; yeni aksiyon geldiği an uyanır.

Şimdi lütfen kurulum adımlarını uygula, bağlantıyı kur ve bana hazır olduğunu bildir!`;
}

export function McpOnboardingHub({
  mcpStatus,
  projectRoot,
  sessionId,
  variant = "welcome",
  highlightPulse = false,
}: McpOnboardingHubProps) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [showManualConfigs, setShowManualConfigs] = useState(
    !mcpStatus.connected || variant === "gate-overlay"
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const resolvedRoot =
    projectRoot || (isEn ? "/path/to/Mur4History" : "C:/.../Mur4History");
  const normalizedScriptPath = `${resolvedRoot.replace(/\\/g, "/")}/scripts/mcp-stdio.mjs`;
  const lobbyHttpUrl = sessionId
    ? `${origin}/api/mcp/${sessionId}`
    : `${origin}/api/mcp/lobby`;
  const lobbySseUrl = sessionId
    ? `${origin}/api/mcp/${sessionId}/sse`
    : `${origin}/api/mcp/lobby/sse`;

  const stdioConfigJson = JSON.stringify(
    {
      mcpServers: {
        mur4history: {
          command: "node",
          args: [normalizedScriptPath],
        },
      },
    },
    null,
    2
  );

  const httpConfigJson = JSON.stringify(
    {
      mcpServers: {
        mur4history: {
          url: lobbyHttpUrl,
        },
      },
    },
    null,
    2
  );

  const claudeRemoteJson = JSON.stringify(
    {
      mcpServers: {
        mur4history: {
          command: "npx",
          args: ["-y", "mcp-remote", lobbyHttpUrl],
        },
      },
    },
    null,
    2
  );

  const sseConfigJson = JSON.stringify(
    {
      mcpServers: {
        mur4history: {
          url: lobbySseUrl,
        },
      },
    },
    null,
    2
  );

  const masterPrompt = buildMasterSetupAndGamePrompt({
    locale,
    origin,
    stdioScriptPath: normalizedScriptPath,
    sessionId,
  });

  const copyValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const activeClientLabel =
    mcpStatus.clients[0]?.clientName ||
    (isEn ? "MCP AI Client" : "MCP AI İstemcisi");

  return (
    <section
      id="mcp-onboarding-gate"
      data-testid="mcp-onboarding-hub"
      className={`w-full rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
        highlightPulse
          ? "ring-2 ring-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.28)]"
          : ""
      } ${
        mcpStatus.connected
          ? "border-emerald-500/35 bg-[#080d16]/90 shadow-[0_16px_50px_rgba(0,0,0,0.65)]"
          : "border-amber-500/50 bg-[#080c15]/95 shadow-[0_20px_65px_rgba(245,158,11,0.14)]"
      }`}
    >
      {/* Top Gate Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              mcpStatus.connected
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : "border-amber-400/50 bg-amber-500/15 text-amber-300"
            }`}
          >
            {mcpStatus.connected ? (
              <Unlock className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-base font-bold text-white sm:text-lg">
                {mcpStatus.connected
                  ? isEn
                    ? "MCP Connected — Ready to Enter Mur4History"
                    : "MCP Bağlandı — Mur4History Oyuna Giriş Açık"
                  : isEn
                    ? "Connect MCP First — Game Entry Locked"
                    : "Önce MCP Bağlayın — Oyuna Giriş Kilitli"}
              </h2>
              <Badge
                data-testid="mcp-gate-status-badge"
                variant={mcpStatus.connected ? "success" : "warning"}
              >
                {mcpStatus.connected
                  ? `${isEn ? "Active" : "Aktif"}: ${activeClientLabel}`
                  : isEn
                    ? "Waiting for MCP Client..."
                    : "MCP İstemcisi Bekleniyor..."}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              {mcpStatus.connected
                ? isEn
                  ? "Your AI Game Master is linked cleanly via Model Context Protocol. Use the setup tutorial & full game prompt below anytime if you switch clients."
                  : "Yapay zeka Game Master istemciniz MCP üzerinden başarıyla bağlı. İsterseniz başka bir AI istemcisine geçmek için aşağıdaki kurulum rehberini ve tanıtım promptunu kopyalayabilirsiniz."
                : isEn
                  ? "Mur4History runs with zero server-side AI fees by connecting directly to your own AI assistant via MCP. You cannot enter a campaign until an MCP client is connected — paste the AI Setup Prompt below into your AI to unlock immediately!"
                  : "Mur4History sunucu tarafında API ücreti almadan doğrudan sizin kendi yapay zekanızı Game Master olarak kullanır. MCP bağlantısı kurulmadan oyuna veya senaryolara girilemez — aşağıdaki AI Promptunu yapay zekanıza yapıştırdığınız anda kilit otomatik açılır!"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowManualConfigs((v) => !v)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/35 hover:text-white"
        >
          <PlugZap className="h-3.5 w-3.5 text-amber-300" />
          {showManualConfigs
            ? isEn
              ? "Hide Guide & Configs"
              : "Rehberi & Ayarları Gizle"
            : isEn
              ? "Show MCP Tutorial & AI Prompt"
              : "MCP Tutorial & AI Promptunu Aç"}
          {showManualConfigs ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {showManualConfigs && (
        <div className="space-y-5 p-5">
          {/* 3-Step Visual Tutorial */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#0d1320]/85 p-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-amber-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 font-mono text-[11px]">
                  1
                </span>
                {isEn ? "Copy AI Prompt or JSON" : "AI Promptunu / Config'i Al"}
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-300">
                {isEn
                  ? "Copy the All-in-One AI Setup & Game Intro Prompt right below and paste it into Antigravity, Cursor, Claude, or Windsurf — your AI handles setup and learns every game rule automatically."
                  : "Aşağıdaki tek tıkla kopyalanan Uzun AI Kurulum & Oyun Tanıtım Promptunu Antigravity, Cursor, Claude veya Cline sohbetine yapıştırın; AI hem MCP kurulumunu yapar hem tüm oyunu öğrenir."}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d1320]/85 p-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-sky-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-400/20 font-mono text-[11px]">
                  2
                </span>
                {isEn ? "Live Auto-Handshake" : "Otomatik MCP El Sıkışması"}
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-300">
                {isEn
                  ? "As soon as your AI client activates Mur4History via stdio bridge or `/api/mcp/lobby`, this page receives the live signal automatically (no refresh needed)."
                  : "İstemciniz stdio köprüsü veya `/api/mcp/lobby` üzerinden bağlandığı saniye yukarıdaki rozet yeşile döner; sayfa yenilemeye bile gerek kalmadan oyun erişimi açılır."}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d1320]/85 p-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-emerald-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 font-mono text-[11px]">
                  3
                </span>
                {isEn ? "Zero-Token Game Master Loop" : "Sıfır Token Game Master Döngüsü"}
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-300">
                {isEn
                  ? "Enter any era, pick your country, queue orders, talk 1-on-1 with leaders, and watch AI beacons light up on the map while `wait_for_player_action` idles at 0 tokens."
                  : "Senaryonu seç, ülkenin başına geç, emir ver, haritada parlayan tesisleri izle; AI yalnızca sen butona bastığında uyanıp simülasyonu işler."}
              </p>
            </div>
          </div>

          {/* Giant Master Prompt Card */}
          <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-[#0c121e] to-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>
                    {isEn
                      ? "All-in-One AI Setup & Full Game Introduction Prompt"
                      : "Yapay Zekaya Otomatik Kurulum & Tam Oyun Tanıtım Promptu"}
                  </span>
                  <Badge variant="outline">
                    <Sparkles className="mr-1 h-3 w-3 text-amber-300" />
                    {isEn ? "Recommended" : "Önerilen"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {isEn
                    ? "Paste this single comprehensive prompt into any AI assistant: it instructs the AI how to configure Mur4History MCP automatically AND introduces all 12 scenarios, 270 provinces, 9 resources, 14 tools, and GM rules."
                    : "Bu tek ve kapsamlı promptu doğrudan AI sohbetine yapıştır: yapay zekaya hem kendi MCP ayarını nasıl kuracağını adım adım yaptırır, hem de 12 senaryoyu, 270 eyaleti, 14 harita temasını, tüm MCP araçlarını ve Game Master kurallarını eksiksiz öğretir."}
                </p>
              </div>

              <Button
                type="button"
                data-testid="copy-master-ai-prompt"
                onClick={() => void copyValue("masterPrompt", masterPrompt)}
                className="shrink-0 bg-gradient-to-r from-[#efe3c8] to-[#cf7f56] font-bold text-[#090b10] shadow-lg hover:opacity-95"
              >
                {copiedKey === "masterPrompt" ? (
                  <Check className="h-4 w-4 text-emerald-800" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedKey === "masterPrompt"
                  ? isEn
                    ? "Prompt Copied!"
                    : "Uzun Prompt Kopyalandı!"
                  : isEn
                    ? "Copy AI Setup + Game Prompt"
                    : "AI Kurulum + Oyun Promptunu Kopyala"}
              </Button>
            </div>

            <pre
              data-testid="master-ai-prompt-preview"
              className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#05080f] p-3.5 font-mono text-[11px] leading-relaxed text-emerald-200/95"
            >
              {masterPrompt}
            </pre>
          </div>

          {/* Manual Client Config Tutorial Tabs */}
          <div className="rounded-xl border border-white/10 bg-[#0b101b] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Terminal className="h-4 w-4 text-sky-400" />
                {isEn
                  ? "Manual MCP Config Tutorial (Choose Your AI Client)"
                  : "Manuel MCP Kurulum Rehberi (Kullandığın AI İstemcisini Seç)"}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isEn ? "Lobby Endpoint:" : "Evrensel Lobi Ucu:"}{" "}
                <code className="rounded bg-black/50 px-1.5 py-0.5 text-amber-200">
                  {lobbyHttpUrl}
                </code>
              </span>
            </div>

            <Tabs defaultValue="stdio">
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="stdio">
                  {isEn ? "Local Bridge (Stdio)" : "Lokal Köprü (Önerilen)"}
                </TabsTrigger>
                <TabsTrigger value="cursor">
                  Cursor / Streamable HTTP
                </TabsTrigger>
                <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
                <TabsTrigger value="sse">Cline / Legacy SSE</TabsTrigger>
              </TabsList>

              <TabsContent value="stdio" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    {isEn ? (
                      <>
                        Best for Antigravity, Cursor, or local Claude Code. Add
                        to <code>~/.gemini/antigravity/mcp_config.json</code> or{" "}
                        <code>.cursor/mcp.json</code>:
                      </>
                    ) : (
                      <>
                        Antigravity, Cursor veya lokal Claude için en stabil yol.{" "}
                        <code>~/.gemini/antigravity/mcp_config.json</code> veya{" "}
                        <code>.cursor/mcp.json</code> içine ekleyin:
                      </>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyValue("stdio", stdioConfigJson)}
                  >
                    {copiedKey === "stdio" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {isEn ? "Copy Stdio JSON" : "Stdio JSON Kopyala"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#05080f] p-3 font-mono text-xs text-emerald-300">
                  {stdioConfigJson}
                </pre>
              </TabsContent>

              <TabsContent value="cursor" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    {isEn ? (
                      <>
                        Zero-path URL config (great for Docker or remote hosts).
                        Add to <code>.cursor/mcp.json</code>:
                      </>
                    ) : (
                      <>
                        Dosya yolu gerektirmeyen doğrudan URL ayarı (Docker /
                        uzak sunucu için ideal):
                      </>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyValue("http", httpConfigJson)}
                  >
                    {copiedKey === "http" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {isEn ? "Copy HTTP JSON" : "HTTP JSON Kopyala"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#05080f] p-3 font-mono text-xs text-emerald-300">
                  {httpConfigJson}
                </pre>
              </TabsContent>

              <TabsContent value="claude" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    {isEn ? (
                      <>
                        Paste into{" "}
                        <code>claude_desktop_config.json</code> and restart Claude
                        Desktop:
                      </>
                    ) : (
                      <>
                        <code>claude_desktop_config.json</code> içine yapıştırıp
                        Claude Desktop&apos;ı yeniden başlatın:
                      </>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyValue("claude", claudeRemoteJson)}
                  >
                    {copiedKey === "claude" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {isEn ? "Copy Claude JSON" : "Claude JSON Kopyala"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#05080f] p-3 font-mono text-xs text-emerald-300">
                  {claudeRemoteJson}
                </pre>
              </TabsContent>

              <TabsContent value="sse" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    {isEn
                      ? "For legacy SSE MCP clients (Cline, older bridges):"
                      : "Klasik SSE destekleyen MCP istemcileri için:"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyValue("sse", sseConfigJson)}
                  >
                    {copiedKey === "sse" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {isEn ? "Copy SSE JSON" : "SSE JSON Kopyala"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#05080f] p-3 font-mono text-xs text-emerald-300">
                  {sseConfigJson}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </section>
  );
}
