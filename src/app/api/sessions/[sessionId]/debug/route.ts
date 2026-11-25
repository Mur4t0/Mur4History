import { NextRequest } from "next/server";
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
import type { DiplomacyStatus, EventCategory } from "@/lib/scenarios/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  let body: {
    mode: "tool" | "resource";
    name: string;
    args?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    if (body.mode === "resource") {
      switch (body.name) {
        case "world-state":
          return Response.json({
            data: await readWorldStateResource(sessionId),
          });
        case "countries":
          return Response.json({
            data: await readCountriesResource(sessionId),
          });
        case "map-ownership":
          return Response.json({
            data: await readMapOwnershipResource(sessionId),
          });
        case "pending-orders":
          return Response.json({
            data: await readPendingOrdersResource(sessionId),
          });
        case "chronicle-history":
          return Response.json({
            data: await readChronicleHistoryResource(sessionId),
          });
        case "pending-leader-chats":
          return Response.json({
            data: await readPendingLeaderChatsResource(sessionId),
          });
        case "diplomatic-councils":
          return Response.json({
            data: await readDiplomaticCouncilsResource(sessionId),
          });
        case "map-markers":
          return Response.json({
            data: await readMapMarkersResource(sessionId),
          });
        case "advisor-chat":
          return Response.json({
            data: await readAdvisorChatResource(sessionId),
          });
        default:
          return Response.json(
            { error: `Bilinmeyen resource: ${body.name}` },
            { status: 400 }
          );
      }
    }

    const args = body.args ?? {};
    switch (body.name) {
      case "transfer_territory":
        return Response.json({
          data: await toolTransferTerritory({
            sessionId,
            region_ids: Array.isArray(args.region_ids)
              ? args.region_ids.map(String)
              : String(args.region_ids || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
            new_owner_country_id: String(args.new_owner_country_id || ""),
            reason: String(args.reason || "Debug Transfer"),
          }),
        });
      case "update_country_stats":
        return Response.json({
          data: await toolUpdateCountryStats({
            sessionId,
            country_id: String(args.country_id || ""),
            economy_delta: Number(args.economy_delta ?? 0),
            military_delta: Number(args.military_delta ?? 0),
            stability_delta: Number(args.stability_delta ?? 0),
            infamy_delta:
              args.infamy_delta !== undefined ? Number(args.infamy_delta) : 0,
            war_exhaustion_delta:
              args.war_exhaustion_delta !== undefined
                ? Number(args.war_exhaustion_delta)
                : 0,
            new_ideology: args.new_ideology
              ? String(args.new_ideology)
              : undefined,
          }),
        });
      case "manage_diplomacy":
        return Response.json({
          data: await toolManageDiplomacy({
            sessionId,
            country_a: String(args.country_a || ""),
            country_b: String(args.country_b || ""),
            relation_status: String(
              args.relation_status || "NEUTRAL"
            ) as DiplomacyStatus,
            treaty_name: args.treaty_name
              ? String(args.treaty_name)
              : undefined,
          }),
        });
      case "publish_world_event":
        return Response.json({
          data: await toolPublishWorldEvent({
            sessionId,
            headline: String(args.headline || ""),
            article_body: String(args.article_body || ""),
            category: String(args.category || "DIPLOMACY") as EventCategory,
            involved_countries: Array.isArray(args.involved_countries)
              ? args.involved_countries.map(String)
              : String(args.involved_countries || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
          }),
        });
      case "send_diplomatic_message":
        return Response.json({
          data: await toolSendDiplomaticMessage({
            sessionId,
            from_country_id: String(args.from_country_id || ""),
            to_country_id: String(args.to_country_id || ""),
            sender_title: String(args.sender_title || "Dışişleri Bakanlığı"),
            message: String(args.message || ""),
            isFromPlayer: false,
          }),
        });
      case "reply_leader_chat":
        return Response.json({
          data: await toolReplyLeaderChat({
            sessionId,
            target_country_id: String(args.target_country_id || ""),
            leader_name: args.leader_name
              ? String(args.leader_name)
              : undefined,
            reply_message: String(args.reply_message || ""),
            relation_status: args.relation_status
              ? (String(args.relation_status) as DiplomacyStatus)
              : undefined,
            treaty_name: args.treaty_name
              ? String(args.treaty_name)
              : undefined,
          }),
        });
      case "convene_diplomatic_council":
        return Response.json({
          data: await toolConveneDiplomaticCouncil({
            sessionId,
            title: String(args.title || "Acil Uluslararası Konsey"),
            topic: String(args.topic || "Bölgesel güvenlik ve haklar"),
            council_type: (String(args.council_type || "COUNCIL") as
              | "COUNCIL"
              | "COALITION"
              | "SUMMIT"
              | "PROTEST"),
            initiator_country_id: String(args.initiator_country_id || "FRA"),
            participant_country_ids: Array.isArray(args.participant_country_ids)
              ? args.participant_country_ids.map(String)
              : [],
            opening_statements: Array.isArray(args.opening_statements)
              ? (args.opening_statements as Array<{
                  country_id: string;
                  message: string;
                  stance?:
                    | "SUPPORTIVE"
                    | "CRITICAL"
                    | "THREATENING"
                    | "NEUTRAL"
                    | "MEDIATOR";
                }>)
              : [],
          }),
        });
      case "reply_diplomatic_council":
        return Response.json({
          data: await toolReplyDiplomaticCouncil({
            sessionId,
            council_id: String(args.council_id || ""),
            responses: Array.isArray(args.responses)
              ? (args.responses as Array<{
                  country_id: string;
                  leader_name?: string;
                  message: string;
                  stance?:
                    | "SUPPORTIVE"
                    | "CRITICAL"
                    | "THREATENING"
                    | "NEUTRAL"
                    | "MEDIATOR";
                }>)
              : [],
            council_status: args.council_status
              ? (String(args.council_status) as
                  | "OPEN"
                  | "RESOLVED"
                  | "COLLAPSED")
              : undefined,
          }),
        });
      case "advance_turn":
        return Response.json({
          data: await toolAdvanceTurn({
            sessionId,
            new_date: String(args.new_date || ""),
            turn_summary: String(args.turn_summary || "Simülasyon turu tamamlandı."),
          }),
        });
      case "manage_map_markers":
        return Response.json({
          data: await toolManageMapMarkers({
            sessionId,
            action: (String(args.action || "CREATE") as
              | "CREATE"
              | "UPDATE"
              | "REMOVE"
              | "CLEANUP_STALE"),
            marker_id: args.marker_id ? String(args.marker_id) : undefined,
            country_id: args.country_id ? String(args.country_id) : undefined,
            region_id: args.region_id ? String(args.region_id) : undefined,
            city_name: args.city_name ? String(args.city_name) : undefined,
            title: args.title ? String(args.title) : undefined,
            description: args.description ? String(args.description) : undefined,
            category: args.category
              ? (String(args.category) as
                  | "INDUSTRY"
                  | "MILITARY"
                  | "INFRASTRUCTURE"
                  | "NAVAL"
                  | "RESEARCH"
                  | "DIPLOMACY"
                  | "INTERNAL"
                  | "CRISIS")
              : undefined,
            status: args.status
              ? (String(args.status) as
                  | "ACTIVE"
                  | "UNDER_CONSTRUCTION"
                  | "DAMAGED"
                  | "ALERT"
                  | "COMPLETED")
              : undefined,
            level: args.level !== undefined ? Number(args.level) : undefined,
            lat: args.lat !== undefined ? Number(args.lat) : undefined,
            lng: args.lng !== undefined ? Number(args.lng) : undefined,
            is_animated:
              args.is_animated !== undefined
                ? Boolean(args.is_animated)
                : true,
          }),
        });
      case "wait_for_player_action":
        return Response.json({
          data: await toolWaitForPlayerAction({
            sessionId,
            timeout_seconds: Number(args.timeout_seconds ?? 15),
          }),
        });
      case "reply_advisor_chat":
        return Response.json({
          data: await toolReplyAdvisorChat({
            sessionId,
            reply_message: String(args.reply_message || ""),
            suggested_orders: Array.isArray(args.suggested_orders)
              ? (args.suggested_orders as Array<{
                  title: string;
                  category?: string;
                  command: string;
                }>)
              : [],
            advisor_title: args.advisor_title
              ? String(args.advisor_title)
              : undefined,
          }),
        });
      default:
        return Response.json(
          { error: `Bilinmeyen araç: ${body.name}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "İşlem hatası" },
      { status: 400 }
    );
  }
}
