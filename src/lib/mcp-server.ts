import {
  McpServer,
  type RegisteredResource,
  type RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildGameMasterDirectivePrompt,
  getMcpLanguageDirective,
  getMcpRegistryMetadata,
  getMcpToolInstructions,
} from "@/lib/mcp-locale";
import {
  getActiveMcpLocale,
  getMostActiveBrowserSessionId,
  GLOBAL_MCP_CHANNEL,
  subscribeActiveMcpLocaleChange,
} from "@/lib/realtime";
import {
  readAdvisorChatResource,
  readChronicleHistoryResource,
  readCountriesResource,
  readDiplomaticCouncilsResource,
  readMapMarkersResource,
  readMapOwnershipResource,
  readPendingLeaderChatsResource,
  readPendingOrdersResource,
  readWorldStateResource,
  toolAdvanceTurn,
  toolConveneDiplomaticCouncil,
  toolManageDiplomacy,
  toolManageMapMarkers,
  toolPublishWorldEvent,
  toolReplyAdvisorChat,
  toolReplyDiplomaticCouncil,
  toolReplyLeaderChat,
  toolSendDiplomaticMessage,
  toolTransferTerritory,
  toolUpdateCountryStats,
  toolWaitForPlayerAction,
} from "@/lib/game-engine";
import {
  advanceLiveWarOperations,
  launchWarOperation,
  provokeNationAction,
  readWarTheaterResource,
  transferNuclearWarheads,
} from "@/lib/war-engine";

async function resolveTargetSessionId(
  boundSessionId: string,
  explicitSessionId?: string
): Promise<string> {
  if (explicitSessionId) return explicitSessionId;
  if (boundSessionId !== GLOBAL_MCP_CHANNEL) return boundSessionId;

  const browserSession = getMostActiveBrowserSessionId();
  if (browserSession) return browserSession;

  const waiting = await prisma.gameSession.findFirst({
    where: { awaitingAiSimulation: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (waiting) return waiting.id;

  const latest = await prisma.gameSession.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (latest) return latest.id;

  const t = getMcpToolInstructions(getActiveMcpLocale(boundSessionId));
  throw new Error(t.noSessionError);
}

export function createGameMasterMcpServer(boundSessionId: string): McpServer {
  const sessionId = boundSessionId;
  const resolveId = () => resolveTargetSessionId(boundSessionId);
  const initialLocale = getActiveMcpLocale(boundSessionId);
  const initialMeta = getMcpRegistryMetadata(initialLocale);
  const d = (tr: string, en: string) => (initialLocale === "en" ? en : tr);

  const server = new McpServer({
    name: `mur4history-session-${boundSessionId}`,
    version: "1.0.0",
  });

  const resourceHandles = new Map<string, RegisteredResource>();
  const toolHandles = new Map<string, RegisteredTool>();

  // ==========================================================
  // A. MCP RESOURCES (Read-Only World Inspection)
  // ==========================================================

  const resourceReaders: Array<[string, (sid: string) => Promise<unknown>]> = [
    ["world-state", readWorldStateResource],
    ["countries", readCountriesResource],
    ["map-ownership", readMapOwnershipResource],
    ["pending-orders", readPendingOrdersResource],
    ["chronicle-history", readChronicleHistoryResource],
    ["pending-leader-chats", readPendingLeaderChatsResource],
    ["diplomatic-councils", readDiplomaticCouncilsResource],
    ["map-markers", readMapMarkersResource],
    ["advisor-chat", readAdvisorChatResource],
    ["war-theater", readWarTheaterResource],
  ];

  for (const [name, reader] of resourceReaders) {
    const meta = initialMeta.resources[name];
    const handle = server.registerResource(
      name,
      `game://session/${sessionId}/${name}`,
      {
        title: meta.title,
        description: meta.description,
        mimeType: "application/json",
      },
      async (uri) => {
        const sid = await resolveId();
        const data = await reader(sid);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }
    );
    resourceHandles.set(name, handle);
  }

  // ==========================================================
  // B. MCP TOOLS (Live World Mutation Engine)
  // ==========================================================

  toolHandles.set(
    "list_game_sessions",
    server.registerTool(
      "list_game_sessions",
      {
        ...initialMeta.tools.list_game_sessions,
        inputSchema: {},
      },
      async () => {
        const locale = getActiveMcpLocale(boundSessionId);
        const sessions = await prisma.gameSession.findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { scenario: { select: { title: true, era: true } } },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  preferredLanguage: locale,
                  languageDirective: getMcpLanguageDirective(locale),
                  boundChannel: boundSessionId,
                  activeBrowserSessionId: getMostActiveBrowserSessionId(),
                  sessions: sessions.map((s) => ({
                    id: s.id,
                    name: s.name,
                    scenario: s.scenario.title,
                    playerCountryCode: s.playerCountryCode,
                    currentDate: s.currentDate,
                    turnNumber: s.turnNumber,
                    difficulty: s.difficulty,
                    awaitingAiSimulation: s.awaitingAiSimulation,
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

  toolHandles.set(
    "read_game_context",
    server.registerTool(
      "read_game_context",
      {
        ...initialMeta.tools.read_game_context,
        inputSchema: {},
      },
      async () => {
        const sid = await resolveId();
        const locale = getActiveMcpLocale(sid);
        const t = getMcpToolInstructions(locale);
        const [
          worldState,
          countries,
          pendingOrders,
          leaderChats,
          councils,
          mapMarkers,
          advisorChat,
        ] = await Promise.all([
          readWorldStateResource(sid),
          readCountriesResource(sid),
          readPendingOrdersResource(sid),
          readPendingLeaderChatsResource(sid),
          readDiplomaticCouncilsResource(sid),
          readMapMarkersResource(sid),
          readAdvisorChatResource(sid),
        ]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  preferredLanguage: locale,
                  languageDirective: getMcpLanguageDirective(locale),
                  sessionId: sid,
                  worldState,
                  countriesSummary: countries,
                  pendingOrders: pendingOrders.pendingOrders,
                  pendingLeaderChats: leaderChats,
                  diplomaticCouncils: councils,
                  mapMarkers,
                  advisorChat,
                  note: t.readContextNote,
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

  toolHandles.set(
    "transfer_territory",
    server.registerTool(
      "transfer_territory",
      {
        ...initialMeta.tools.transfer_territory,
        inputSchema: {
          region_ids: z
            .array(z.string())
            .min(1)
            .describe(
              d(
                "Sahipliği değişecek bölge ID listesi (örn. ['FRA_ALSACE', 'SYR']).",
                "List of province region IDs to transfer (e.g. ['FRA_ALSACE', 'SYR'])."
              )
            ),
          new_owner_country_id: z
            .string()
            .describe(
              d(
                "Bölgeleri devralacak ülkenin kodu (örn. 'TUR', 'GER', 'OTT').",
                "Country code taking ownership of these provinces (e.g. 'TUR', 'GBR', 'USA')."
              )
            ),
          reason: z
            .string()
            .describe(
              d(
                "Toprak değişiminin nedeni (örn. 'Barış Antlaşması ile ilhak' veya 'Askeri işgal').",
                "Historical or diplomatic reason for the transfer (e.g. 'Annexation by Peace Treaty')."
              )
            ),
        },
      },
      async ({ region_ids, new_owner_country_id, reason }) => {
        const sid = await resolveId();
        const result = await toolTransferTerritory({
          sessionId: sid,
          region_ids,
          new_owner_country_id,
          reason,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, result }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "update_country_stats",
    server.registerTool(
      "update_country_stats",
      {
        ...initialMeta.tools.update_country_stats,
        inputSchema: {
          country_id: z
            .string()
            .describe(d("Güncellenecek ülke kodu (örn. 'TUR').", "Country code to update (e.g. 'TUR', 'USA').")),
          economy_delta: z
            .number()
            .describe(d("Ekonomi puanındaki değişim (-50 ile +50 arası önerilir).", "Economy score delta (recommended -50 to +50).")),
          military_delta: z
            .number()
            .describe(d("Askeri güç puanındaki değişim (-50 ile +50 arası önerilir).", "Military power delta (recommended -50 to +50).")),
          stability_delta: z
            .number()
            .describe(d("İç istikrar % değişimi (-50 ile +50 arası önerilir).", "Domestic stability % delta (recommended -50 to +50).")),
          infamy_delta: z
            .number()
            .optional()
            .describe(d("Opsiyonel: Agresif Genişleme / Tehdit puanı (0-100) değişimi.", "Optional: Aggressive expansion / infamy (0-100) delta.")),
          war_exhaustion_delta: z
            .number()
            .optional()
            .describe(d("Opsiyonel: Savaş Yorgunluğu % (0-100) değişimi.", "Optional: War exhaustion % (0-100) delta.")),
          nuclear_warheads_delta: z
            .number()
            .int()
            .optional()
            .describe(d("Opsiyonel: Yerli nükleer program/üretim sonucu eklenen veya eksilen başlık sayısı.", "Optional: Delta in national nuclear warhead stockpile.")),
          new_ideology: z
            .string()
            .optional()
            .describe(d("Opsiyonel: Rejim veya ideoloji değişimi gerçekleştiyse yeni ideoloji adı.", "Optional: New ideology name if regime shifted.")),
        },
      },
      async ({
        country_id,
        economy_delta,
        military_delta,
        stability_delta,
        infamy_delta,
        war_exhaustion_delta,
        nuclear_warheads_delta,
        new_ideology,
      }) => {
        const sid = await resolveId();
        const updated = await toolUpdateCountryStats({
          sessionId: sid,
          country_id,
          economy_delta,
          military_delta,
          stability_delta,
          infamy_delta,
          war_exhaustion_delta,
          nuclear_warheads_delta,
          new_ideology,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, country: updated }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "manage_diplomacy",
    server.registerTool(
      "manage_diplomacy",
      {
        ...initialMeta.tools.manage_diplomacy,
        inputSchema: {
          country_a: z
            .string()
            .describe(d("Birinci ülke kodu.", "First country code.")),
          country_b: z
            .string()
            .describe(d("İkinci ülke kodu.", "Second country code.")),
          relation_status: z
            .enum([
              "WAR",
              "ALLIANCE",
              "NON_AGGRESSION",
              "VASSAL",
              "EMBARGO",
              "NEUTRAL",
            ])
            .describe(d("Yeni diplomatik ilişki durumu.", "New bilateral diplomatic status.")),
          treaty_name: z
            .string()
            .optional()
            .describe(d("Opsiyonel antlaşma veya savaş adı (örn. 'Ankara Paktı').", "Optional treaty or war name (e.g. 'Ankara Accord').")),
        },
      },
      async ({ country_a, country_b, relation_status, treaty_name }) => {
        const sid = await resolveId();
        const relation = await toolManageDiplomacy({
          sessionId: sid,
          country_a,
          country_b,
          relation_status,
          treaty_name,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, relation }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "publish_world_event",
    server.registerTool(
      "publish_world_event",
      {
        ...initialMeta.tools.publish_world_event,
        inputSchema: {
          headline: z
            .string()
            .describe(d("Gazete manşeti (büyük ve çarpıcı).", "Dramatic, crisp newspaper headline.")),
          article_body: z
            .string()
            .describe(d("Dönem atmosferine uygun detaylı haber metni.", "Detailed historical article text matching the active UI language.")),
          category: z
            .enum(["WAR", "DIPLOMACY", "ECONOMY", "INTERNAL", "CRISIS"])
            .describe(d("Haber kategorisi.", "News category.")),
          involved_countries: z
            .array(z.string())
            .describe(d("Habere konu olan ülke kodları listesi (örn. ['TUR', 'FRA']).", "List of involved country codes (e.g. ['TUR', 'FRA']).")),
        },
      },
      async ({ headline, article_body, category, involved_countries }) => {
        const sid = await resolveId();
        const event = await toolPublishWorldEvent({
          sessionId: sid,
          headline,
          article_body,
          category,
          involved_countries,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, event }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "send_diplomatic_message",
    server.registerTool(
      "send_diplomatic_message",
      {
        ...initialMeta.tools.send_diplomatic_message,
        inputSchema: {
          from_country_id: z
            .string()
            .describe(d("Mesajı gönderen ülke kodu.", "Sender country code.")),
          to_country_id: z
            .string()
            .describe(d("Alıcı ülke kodu (genelde oyuncunun ülkesi).", "Recipient country code (usually player country).")),
          sender_title: z
            .string()
            .describe(d("Gönderen lider veya makam unvanı (örn. 'Dışişleri Bakanı Anthony Eden').", "Sender leader title/office (e.g. 'Foreign Secretary Anthony Eden').")),
          message: z
            .string()
            .describe(d("Döneme ve liderin kişiliğine uygun diplomatik telgraf/mektup.", "Era-accurate in-character diplomatic dispatch.")),
        },
      },
      async ({ from_country_id, to_country_id, sender_title, message }) => {
        const sid = await resolveId();
        const created = await toolSendDiplomaticMessage({
          sessionId: sid,
          from_country_id,
          to_country_id,
          sender_title,
          message,
          isFromPlayer: false,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ok: true, diplomaticMessage: created },
                null,
                2
              ),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "reply_leader_chat",
    server.registerTool(
      "reply_leader_chat",
      {
        ...initialMeta.tools.reply_leader_chat,
        inputSchema: {
          target_country_id: z
            .string()
            .describe(d("Yanıt veren yabancı ülkenin kodu (örn. 'RUS', 'USA', 'FRA').", "Foreign country code replying (e.g. 'RUS', 'USA', 'FRA').")),
          leader_name: z
            .string()
            .optional()
            .describe(d("Opsiyonel: Yanıtlayan liderin adı/makamı.", "Optional: Replying leader's name or title.")),
          reply_message: z
            .string()
            .describe(d("Liderin kişiliğine, ideolojisine ve tarihsel atmosfere uygun bire bir yanıtı.", "In-character 1-on-1 reply from that nation's leader.")),
          relation_status: z
            .enum([
              "WAR",
              "ALLIANCE",
              "NON_AGGRESSION",
              "VASSAL",
              "EMBARGO",
              "NEUTRAL",
            ])
            .optional()
            .describe(d("Opsiyonel: Görüşme sonucu diplomatik ilişki değiştiyse yeni statü.", "Optional: Updated bilateral relation if the talk led to a treaty or rupture.")),
          treaty_name: z
            .string()
            .optional()
            .describe(d("Opsiyonel: İmzalanan antlaşma veya kriz adı.", "Optional: Signed treaty or crisis name.")),
          transfer_nuclear_warheads: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe(d("Opsiyonel: Yanıt veren liderin antlaşma kapsamında oyuncuya devrettiği nükleer başlık sayısı (1-10).", "Optional: Number of nuclear warheads (1-10) the replying leader transfers to the player under a treaty.")),
          nuclear_treaty_name: z
            .string()
            .optional()
            .describe(d("Opsiyonel: Nükleer paylaşım antlaşmasının adı (örn. NATO Nükleer Paylaşım Protokolü).", "Optional: Name of the nuclear sharing protocol/treaty.")),
          nuclear_require_treaty: z
            .boolean()
            .optional()
            .describe(d("Varsayılan true: Yalnızca aktif ittifak/antlaşma çatısı altında nükleer devrine izin ver.", "Default true: Require an active Alliance or nuclear umbrella treaty for warhead transfer.")),
        },
      },
      async ({
        target_country_id,
        leader_name,
        reply_message,
        relation_status,
        treaty_name,
        transfer_nuclear_warheads,
        nuclear_treaty_name,
        nuclear_require_treaty,
      }) => {
        const sid = await resolveId();
        const res = await toolReplyLeaderChat({
          sessionId: sid,
          target_country_id,
          leader_name,
          reply_message,
          relation_status,
          treaty_name,
          transfer_nuclear_warheads,
          nuclear_treaty_name,
          nuclear_require_treaty,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...res }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "convene_diplomatic_council",
    server.registerTool(
      "convene_diplomatic_council",
      {
        ...initialMeta.tools.convene_diplomatic_council,
        inputSchema: {
          title: z
            .string()
            .describe(d("Konsey başlığı (örn. 'Doğu Akdeniz & Boğazlar Acil Konseyi').", "Council title (e.g. 'Eastern Mediterranean Emergency Council').")),
          topic: z
            .string()
            .describe(d("Ülkeleri bir araya getiren ortak sorun veya gündem.", "Shared grievance, right, or agenda item convening the nations.")),
          council_type: z
            .enum(["COUNCIL", "COALITION", "SUMMIT", "PROTEST"])
            .describe(d("Konsey türü: COUNCIL, COALITION, SUMMIT veya PROTEST.", "Council type: COUNCIL, COALITION, SUMMIT, or PROTEST.")),
          initiator_country_id: z
            .string()
            .describe(d("Konseyi toplayan öncü ülke kodu.", "Initiating country code.")),
          participant_country_ids: z
            .array(z.string())
            .min(1)
            .describe(d("Konseye katılan tüm ülke kodları (örn. ['USA', 'GBR', 'FRA', 'TUR']).", "All participating country codes (e.g. ['USA', 'GBR', 'FRA', 'TUR']).")),
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
            .min(1)
            .describe(d("Katılımcı ülke liderlerinin konsey masasına sunduğu açılış konuşmaları.", "Opening statements delivered by attending leaders.")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const res = await toolConveneDiplomaticCouncil({
          sessionId: sid,
          ...args,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...res }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "reply_diplomatic_council",
    server.registerTool(
      "reply_diplomatic_council",
      {
        ...initialMeta.tools.reply_diplomatic_council,
        inputSchema: {
          council_id: z
            .string()
            .describe(d("Konsey ID'si.", "Council ID.")),
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
            .min(1)
            .describe(d("Konseyde söz alan liderlerin mesajları.", "Messages from leaders speaking in the council.")),
          council_status: z
            .enum(["OPEN", "RESOLVED", "COLLAPSED"])
            .optional()
            .describe(d("Opsiyonel: Konseyin yeni durumu.", "Optional: Updated council status.")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const res = await toolReplyDiplomaticCouncil({
          sessionId: sid,
          ...args,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...res }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "advance_turn",
    server.registerTool(
      "advance_turn",
      {
        ...initialMeta.tools.advance_turn,
        inputSchema: {
          new_date: z
            .string()
            .describe(d("Yeni oyun tarihi (YYYY-AA-GG biçiminde, örn. '1936-03-01').", "New game date (YYYY-MM-DD, e.g. '1936-03-01').")),
          turn_summary: z
            .string()
            .describe(d("Bu turda dünyada yaşananların kısa tarihsel özeti.", "Concise historical summary of this turn.")),
          wait_for_next_action: z
            .boolean()
            .optional()
            .describe(
              d(
                "Opsiyonel: true verilirse turu ilerlettikten hemen sonra oyuncunun bir sonraki buton tıklamasını süresiz canlı beklemeye geçer.",
                "Optional: if true, immediately waits indefinitely for the player's next click after advancing the turn."
              )
            ),
        },
      },
      async ({ new_date, turn_summary, wait_for_next_action }, extra) => {
        const sid = await resolveId();
        const result = await toolAdvanceTurn({
          sessionId: sid,
          new_date,
          turn_summary,
        });
        if (wait_for_next_action) {
          const progressToken = extra?._meta?.progressToken;
          let tick = 0;
          const waitRes = await toolWaitForPlayerAction({
            sessionId: sid,
            timeout_seconds: 0,
            accept_any_session: true,
            signal: extra?.signal,
            onTick: progressToken
              ? () => {
                  tick += 1;
                  const tNow = getMcpToolInstructions(getActiveMcpLocale(sid));
                  void extra
                    .sendNotification({
                      method: "notifications/progress",
                      params: {
                        progressToken,
                        progress: tick,
                        message: tNow.waitingProgress,
                      },
                    })
                    .catch(() => undefined);
                }
              : undefined,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { ok: true, turnAdvanced: result, nextPlayerAction: waitRes },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...result }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "wait_for_player_action",
    server.registerTool(
      "wait_for_player_action",
      {
        ...initialMeta.tools.wait_for_player_action,
        inputSchema: {
          timeout_seconds: z
            .number()
            .min(0)
            .max(86400)
            .optional()
            .describe(
              d(
                "Varsayılan 0 = SÜRESİZ / SONSUZ BEKLEME. Oyuncu hamle yapana kadar kapanmaz. Yalnızca özel testlerde pozitif saniye verilir.",
                "Default 0 = INDEFINITE WAIT. Holds open until player acts. Only pass positive seconds in dedicated tests."
              )
            ),
        },
      },
      async ({ timeout_seconds }, extra) => {
        const progressToken = extra?._meta?.progressToken;
        let tick = 0;
        const sid = await resolveId().catch(() => boundSessionId);
        const result = await toolWaitForPlayerAction({
          sessionId: sid,
          timeout_seconds: timeout_seconds ?? 0,
          accept_any_session: true,
          signal: extra?.signal,
          onTick: progressToken
            ? () => {
                tick += 1;
                const tNow = getMcpToolInstructions(getActiveMcpLocale(sid));
                void extra
                  .sendNotification({
                    method: "notifications/progress",
                    params: {
                      progressToken,
                      progress: tick,
                      message: tNow.waitingProgress,
                    },
                  })
                  .catch(() => undefined);
              }
            : undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "manage_map_markers",
    server.registerTool(
      "manage_map_markers",
      {
        ...initialMeta.tools.manage_map_markers,
        inputSchema: {
          action: z
            .enum(["CREATE", "UPDATE", "REMOVE"])
            .describe(
              d(
                "CREATE: yeni işaret ekler; UPDATE: seviye/durum/konum günceller; REMOVE: haritadan kaldırır.",
                "CREATE adds a marker; UPDATE modifies level/status/position; REMOVE deletes it."
              )
            ),
          marker_id: z
            .string()
            .optional()
            .describe(d("UPDATE/REMOVE için işaret ID'si (veya title/city_name ile eşleşir).", "Marker ID for UPDATE/REMOVE (or matched by title/city_name).")),
          country_id: z
            .string()
            .optional()
            .describe(d("İlgili ülke kodu (örn. 'TUR', 'GER', 'USA').", "Owner/host country code (e.g. 'TUR', 'GER', 'USA').")),
          region_id: z
            .string()
            .optional()
            .describe(d("Bölge ID'si (örn. 'TUR_ANATOLIA', 'SYR').", "Region ID (e.g. 'TUR_ANATOLIA', 'SYR').")),
          city_name: z
            .string()
            .optional()
            .describe(d("Şehir adı (örn. 'Ankara', 'İstanbul', 'Berlin'). Otomatik gerçek koordinata yerleştirilir!", "City name (e.g. 'Ankara', 'London', 'Berlin'). Resolved automatically to real coordinates!")),
          title: z
            .string()
            .optional()
            .describe(d("Harita üzerinde görünecek başlık (örn. 'Ankara Savunma Fabrikası').", "Display label shown on map (e.g. 'Ankara Defense Plant').")),
          description: z
            .string()
            .optional()
            .describe(d("Tesisin veya olayın kısa açıklaması ve stratejik etkisi.", "Short description and strategic effect of the landmark.")),
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
            .optional()
            .describe(d("İşaret kategorisi ve ikon/renk teması.", "Marker category and icon theme.")),
          status: z
            .enum([
              "ACTIVE",
              "UNDER_CONSTRUCTION",
              "DAMAGED",
              "ALERT",
              "COMPLETED",
            ])
            .optional()
            .describe(d("Tesisin veya olayın güncel durumu.", "Current status of the facility or event.")),
          level: z
            .number()
            .min(1)
            .max(5)
            .optional()
            .describe(d("Tesis seviyesi (1-5).", "Facility tier/level (1-5).")),
          lat: z.number().optional().describe(d("Opsiyonel manuel enlem (lat).", "Optional manual latitude.")),
          lng: z.number().optional().describe(d("Opsiyonel manuel boylam (lng).", "Optional manual longitude.")),
          is_animated: z
            .boolean()
            .optional()
            .describe(d("true ise haritada animasyonlu nabız/halka efektiyle parlar (varsayılan true).", "If true, pulses visually on the map (default true).")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const result = await toolManageMapMarkers({
          sessionId: sid,
          ...args,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...result }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "reply_advisor_chat",
    server.registerTool(
      "reply_advisor_chat",
      {
        ...initialMeta.tools.reply_advisor_chat,
        inputSchema: {
          reply_message: z
            .string()
            .describe(d("Danışman AI olarak oyuncuya stratejik analiz ve yanıt metni.", "Strategic analysis and advice from the AI Advisor.")),
          suggested_orders: z
            .array(
              z.object({
                title: z
                  .string()
                  .describe(d("Öneri kartı kısa başlığı.", "Short title for one-click order card.")),
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
                command: z
                  .string()
                  .describe(d("Emir konsoluna tek tıkla aktarılabilecek somut emir metni.", "Actionable order command string inserted on click.")),
              })
            )
            .optional()
            .describe(d("Opsiyonel: Oyuncunun tek tıkla uygulayabileceği 1-4 adet somut emir önerisi.", "Optional: 1-4 one-click actionable suggested orders.")),
          advisor_title: z
            .string()
            .optional()
            .describe(d("Opsiyonel: Danışman ünvanı.", "Optional: Advisor display title.")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const result = await toolReplyAdvisorChat({
          sessionId: sid,
          ...args,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...result }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "provoke_country",
    server.registerTool(
      "provoke_country",
      {
        ...initialMeta.tools.provoke_country,
        inputSchema: {
          actor_country_id: z
            .string()
            .describe(d("Kışkırtmayı yapan ülke kodu.", "Acting country code.")),
          target_country_id: z
            .string()
            .describe(d("Hedef ülke kodu.", "Target country code.")),
          instigate_with_country_id: z
            .string()
            .optional()
            .describe(
              d(
                "INCITE_THIRD_PARTY_WAR için birbirine düşürülecek 2. ülke kodu.",
                "Second target nation for INCITE_THIRD_PARTY_WAR meddling."
              )
            ),
          action_type: z
            .enum([
              "BORDER_SKIRMISH",
              "DIPLOMATIC_INSULT",
              "SPONSOR_REBELS",
              "INCITE_THIRD_PARTY_WAR",
              "DECLARE_WAR",
            ])
            .describe(d("Kışkırtma / gerilim tırmandırma türü.", "Provocation / escalation type.")),
          target_region_id: z
            .string()
            .optional()
            .describe(d("Opsiyonel hedef eyalet ID'si.", "Optional target region ID.")),
          custom_note: z
            .string()
            .optional()
            .describe(d("Kışkırtma gerekçesi / olayı.", "Reason or narrative detail.")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const result = await provokeNationAction({
          sessionId: sid,
          actorCode: args.actor_country_id.trim().toUpperCase(),
          targetCode: args.target_country_id.trim().toUpperCase(),
          instigateWithCode: args.instigate_with_country_id
            ?.trim()
            .toUpperCase(),
          actionType: args.action_type,
          targetRegionId: args.target_region_id,
          customNote: args.custom_note,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...result }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "trigger_war_operation",
    server.registerTool(
      "trigger_war_operation",
      {
        ...initialMeta.tools.trigger_war_operation,
        inputSchema: {
          mode: z
            .enum(["LAUNCH", "ADVANCE"])
            .default("LAUNCH")
            .describe(d("LAUNCH: yeni animasyonlu kuşatma/taarruz başlatır; ADVANCE: mevcut cepheleri ilerletir.", "LAUNCH creates a new siege/assault; ADVANCE ticks ongoing operations.")),
          attacker_country_id: z
            .string()
            .optional()
            .describe(d("Saldıran ülke kodu.", "Attacker country code.")),
          defender_country_id: z
            .string()
            .optional()
            .describe(d("Savunan ülke kodu.", "Defender country code.")),
          target_region_id: z
            .string()
            .optional()
            .describe(d("Kuşatılacak hedef eyalet ID'si.", "Target province region ID.")),
          operation_type: z
            .enum([
              "SIEGE",
              "ASSAULT",
              "TANK_BLITZ",
              "AIR_STRIKE",
              "NAVAL_INVASION",
              "REBEL_UPRISING",
              "ENVOY_AGITATION",
            ])
            .optional()
            .describe(d("Harekat veya gizli elçi/isyan türü.", "Military or covert envoy/uprising operation type.")),
          unit_type: z
            .enum(["INFANTRY", "ARMOR", "AIR", "NAVAL", "ENVOY"])
            .optional()
            .describe(d("Haritada animasyonu çizilecek birim tipi (asker/tank/uçak/donanma/elçi).", "Animated unit sprite type.")),
          intensity: z
            .number()
            .min(10)
            .max(100)
            .optional()
            .describe(d("Harekat yoğunluğu (10-100).", "Operation intensity (10-100).")),
          title: z.string().optional(),
          description: z.string().optional(),
        },
      },
      async (args) => {
        const sid = await resolveId();
        if (args.mode === "ADVANCE") {
          const res = await advanceLiveWarOperations({
            sessionId: sid,
            tickTensions: true,
            skipAiWake: true,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ ok: true, ...res }, null, 2),
              },
            ],
          };
        }
        if (!args.attacker_country_id || !args.defender_country_id) {
          throw new Error(
            "LAUNCH modu için attacker_country_id ve defender_country_id zorunludur."
          );
        }
        const op = await launchWarOperation({
          sessionId: sid,
          attackerCode: args.attacker_country_id.trim().toUpperCase(),
          defenderCode: args.defender_country_id.trim().toUpperCase(),
          targetRegionId: args.target_region_id,
          operationType: args.operation_type ?? "TANK_BLITZ",
          unitType: args.unit_type,
          intensity: args.intensity ?? 75,
          title: args.title,
          description: args.description,
          autoDeclareWar:
            args.operation_type !== "REBEL_UPRISING" &&
            args.operation_type !== "ENVOY_AGITATION",
          skipAiWake: true,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, operation: op }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "launch_nuclear_strike",
    server.registerTool(
      "launch_nuclear_strike",
      {
        ...initialMeta.tools.launch_nuclear_strike,
        inputSchema: {
          attacker_country_id: z
            .string()
            .describe(d("Nükleer füzeyi ateşleyen ülke kodu.", "Launching country code.")),
          defender_country_id: z
            .string()
            .describe(d("Hedef ülke kodu.", "Target country code.")),
          target_region_id: z
            .string()
            .optional()
            .describe(d("Vurulacak eyalet ID'si (opsiyonel; verilmezse stratejik eyalet seçilir).", "Target region ID.")),
          title: z.string().optional(),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const op = await launchWarOperation({
          sessionId: sid,
          attackerCode: args.attacker_country_id.trim().toUpperCase(),
          defenderCode: args.defender_country_id.trim().toUpperCase(),
          targetRegionId: args.target_region_id,
          operationType: "NUCLEAR_STRIKE",
          unitType: "MISSILE",
          intensity: 100,
          title: args.title,
          autoDeclareWar: true,
          skipAiWake: true,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, operation: op }, null, 2),
            },
          ],
        };
      }
    )
  );

  toolHandles.set(
    "transfer_nuclear_warheads",
    server.registerTool(
      "transfer_nuclear_warheads",
      {
        ...initialMeta.tools.transfer_nuclear_warheads,
        inputSchema: {
          from_country_id: z
            .string()
            .describe(d("Nükleer başlığı sağlayan nükleer güç ülke kodu (örn. 'USA', 'RUS').", "Nuclear donor country code (e.g. 'USA', 'RUS').")),
          to_country_id: z
            .string()
            .describe(d("Nükleer başlığı alan müttefik ülke kodu (örn. 'TUR').", "Recipient allied country code (e.g. 'TUR').")),
          count: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(1)
            .describe(d("Devredilecek nükleer başlık sayısı (1-20).", "Number of warheads to transfer (1-20).")),
          treaty_name: z
            .string()
            .optional()
            .describe(d("Paylaşımın dayandığı antlaşma adı (örn. NATO Nükleer Paylaşım Protokolü).", "Treaty umbrella name backing this sharing transfer.")),
          reason: z
            .string()
            .optional()
            .describe(d("Devrin diplomatik/stratejik gerekçesi.", "Diplomatic or strategic rationale.")),
          require_treaty: z
            .boolean()
            .default(true)
            .describe(d("True ise aktif İttifak / Savunma Antlaşması bulunması zorunludur.", "If true, requires active Alliance or defense umbrella treaty.")),
        },
      },
      async (args) => {
        const sid = await resolveId();
        const res = await transferNuclearWarheads({
          sessionId: sid,
          fromCode: args.from_country_id,
          toCode: args.to_country_id,
          count: args.count,
          treatyName: args.treaty_name,
          reason: args.reason,
          requireTreaty: args.require_treaty,
          skipAiWake: true,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...res }, null, 2),
            },
          ],
        };
      }
    )
  );

  // ==========================================================
  // C. MCP PROMPT (Game Master System Directive)
  // ==========================================================

  const promptHandle = server.registerPrompt(
    "pax_game_master_prompt",
    {
      ...initialMeta.prompt,
      argsSchema: {
        player_focus: z
          .string()
          .optional()
          .describe(
            d(
              "Opsiyonel: Bu turda özellikle odaklanılacak diplomatik veya askeri tema.",
              "Optional: Diplomatic or military focus for this turn."
            )
          ),
      },
    },
    async ({ player_focus }) => {
      let sid: string | null = null;
      try {
        sid = await resolveId();
      } catch {
        sid = null;
      }

      const activeLocale = getActiveMcpLocale(sid ?? boundSessionId);

      if (!sid) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: buildGameMasterDirectivePrompt({
                  locale: activeLocale,
                  boundChannel: sessionId,
                  sessionId: null,
                  playerFocus: player_focus,
                }),
              },
            },
          ],
        };
      }

      const [worldState, pendingOrders] = await Promise.all([
        readWorldStateResource(sid, activeLocale),
        readPendingOrdersResource(sid),
      ]);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: buildGameMasterDirectivePrompt({
                locale: activeLocale,
                boundChannel: sessionId,
                sessionId: sid,
                worldState,
                pendingOrdersCount: pendingOrders.pendingOrders.length,
                playerFocus: player_focus,
              }),
            },
          },
        ],
      };
    }
  );

  // Live update tool/resource/prompt descriptions whenever UI language switches
  const unsubscribeLocale = subscribeActiveMcpLocaleChange(
    ({ locale, sessionId: targetSid }) => {
      if (
        targetSid &&
        boundSessionId !== GLOBAL_MCP_CHANNEL &&
        targetSid !== boundSessionId
      ) {
        return;
      }
      const nextMeta = getMcpRegistryMetadata(locale);
      for (const [name, handle] of resourceHandles.entries()) {
        const m = nextMeta.resources[name];
        if (m) {
          handle.update({
            metadata: {
              title: m.title,
              description: m.description,
              mimeType: "application/json",
            },
          });
        }
      }
      for (const [name, handle] of toolHandles.entries()) {
        const m = nextMeta.tools[name];
        if (m) {
          handle.update({
            title: m.title,
            description: m.description,
          });
        }
      }
      promptHandle.update({
        title: nextMeta.prompt.title,
        description: nextMeta.prompt.description,
      });

      if (server.isConnected()) {
        try {
          server.sendResourceListChanged();
          server.sendToolListChanged();
          server.sendPromptListChanged();
        } catch {
          // Ignore transport notification errors on closing sockets
        }
      }
    }
  );

  const prevOnClose = server.server.onclose;
  server.server.onclose = () => {
    unsubscribeLocale();
    prevOnClose?.();
  };

  return server;
}
