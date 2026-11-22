import { NextRequest } from "next/server";
import { z } from "zod";
import { getMcpToolInstructions } from "@/lib/mcp-locale";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import { prisma } from "@/lib/prisma";
import { toolSendDiplomaticMessage } from "@/lib/game-engine";
import {
  emitSessionEvent,
  markBrowserSessionActive,
  notifyPlayerAction,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OrderInputSchema = z.object({
  action: z.enum(["queue", "complete_turn", "wake_ai"]).default("queue"),
  content: z.string().optional(),
  orderType: z
    .enum([
      "COMMAND",
      "DIPLOMACY",
      "ECONOMY",
      "MILITARY",
      "COVERT",
      "INTERNAL",
      "NOTE_TO_AI",
    ])
    .default("COMMAND"),
  targetCountryCode: z.string().optional(),
  locale: z.enum(["tr", "en"]).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = OrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Emir verisi geçersiz", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
  }

  if (!session.playerCountryCode) {
    return Response.json(
      { error: "Emir vermeden önce haritadan bir ülke seçmelisiniz." },
      { status: 400 }
    );
  }

  const trimmedContent = parsed.data.content?.trim() ?? "";
  let createdOrder = null;

  if (trimmedContent.length > 0) {
    createdOrder = await prisma.pendingOrder.create({
      data: {
        sessionId,
        countryCode: session.playerCountryCode,
        orderType: parsed.data.orderType,
        targetCountryCode: parsed.data.targetCountryCode || null,
        content: trimmedContent,
        turnNumber: session.turnNumber,
        status: "PENDING",
      },
    });

    if (
      parsed.data.orderType === "DIPLOMACY" &&
      parsed.data.targetCountryCode
    ) {
      const playerCountry = await prisma.country.findUnique({
        where: {
          sessionId_code: { sessionId, code: session.playerCountryCode },
        },
      });
      await toolSendDiplomaticMessage({
        sessionId,
        from_country_id: session.playerCountryCode,
        to_country_id: parsed.data.targetCountryCode,
        sender_title: playerCountry
          ? `${playerCountry.leader} (${playerCountry.name})`
          : session.playerCountryCode,
        message: trimmedContent,
        isFromPlayer: true,
      });
    }
  }

  const effectiveLocale = resolveAndSyncRequestLocale(
    req,
    sessionId,
    parsed.data.locale
  );
  const t = getMcpToolInstructions(effectiveLocale);

  markBrowserSessionActive(sessionId);

  const shouldTriggerAi =
    parsed.data.action === "complete_turn" ||
    parsed.data.action === "wake_ai";

  if (shouldTriggerAi) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { awaitingAiSimulation: true },
    });
  }

  emitSessionEvent(sessionId, "order_queued", {
    order: createdOrder,
    awaitingAiSimulation: shouldTriggerAi || session.awaitingAiSimulation,
  });

  if (shouldTriggerAi || (session.awaitingAiSimulation && createdOrder)) {
    notifyPlayerAction(
      sessionId,
      parsed.data.action === "wake_ai" ? "MANUAL_WAKE" : "TURN_COMPLETED",
      trimmedContent || t.playerCompletedTurnSummary
    );
  }

  const pendingOrders = await prisma.pendingOrder.findMany({
    where: { sessionId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    order: createdOrder,
    pendingOrders,
    awaitingAiSimulation:
      shouldTriggerAi ? true : session.awaitingAiSimulation,
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return Response.json({ error: "orderId parametresi gerekli" }, { status: 400 });
  }

  await prisma.pendingOrder.deleteMany({
    where: { id: orderId, sessionId, status: "PENDING" },
  });

  emitSessionEvent(sessionId, "order_queued", { removedOrderId: orderId });
  return Response.json({ deleted: true });
}
