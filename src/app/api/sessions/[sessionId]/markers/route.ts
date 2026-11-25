import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleanStaleMapMarkers } from "@/lib/game-engine";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import {
  emitSessionEvent,
  getActiveMcpLocale,
  markBrowserSessionActive,
  notifyPlayerAction,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MarkersPostSchema = z.object({
  mode: z.enum(["smart_clean", "ask_ai_clean"]),
  countryCode: z.string().min(2).max(16).optional(),
  aggressive: z.boolean().default(false),
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

  const parsed = MarkersPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz harita işaret komutu", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const locale = resolveAndSyncRequestLocale(
      req,
      sessionId,
      parsed.data.locale
    );
    const isTr = locale === "tr";

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        playerCountryCode: true,
        turnNumber: true,
        countries: { select: { code: true }, take: 1 },
      },
    });
    if (!session) {
      return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
    }

    if (parsed.data.mode === "smart_clean") {
      const result = await cleanStaleMapMarkers({
        sessionId,
        countryCode: parsed.data.countryCode,
        aggressive: parsed.data.aggressive,
      });
      return Response.json({
        ok: true,
        mode: "smart_clean",
        ...result,
      });
    }

    // mode === "ask_ai_clean": delegate inspection & selective cleanup to connected MCP AI
    const markers = await prisma.mapMarker.findMany({
      where: { sessionId },
      select: { id: true, category: true },
    });
    const strategicSet = new Set([
      "INDUSTRY",
      "MILITARY",
      "INFRASTRUCTURE",
      "NAVAL",
      "RESEARCH",
    ]);
    const strategicCount = markers.filter((m) =>
      strategicSet.has(m.category)
    ).length;
    const clutterCount = markers.length - strategicCount;
    const scopeHint = parsed.data.countryCode
      ? `${parsed.data.countryCode.trim().toUpperCase()} `
      : "";

    const instructionContent = isTr
      ? `[HARİTA İŞARET TEMİZLİĞİ] Lütfen ${scopeHint}haritadaki ${markers.length} işareti incele: ${strategicCount} adet Sanayi (INDUSTRY), Askeri Üs (MILITARY), Altyapı (INFRASTRUCTURE), Tersane (NAVAL) ve Ar-Ge (RESEARCH) tesisini KORU; buna karşın ${clutterCount} adet eski savaş/kriz/isyan/tamamlanmış kalıntı noktayı 'manage_map_markers' (action: 'CLEANUP_STALE' veya seçici 'REMOVE') ile temizle.`
      : `[MAP MARKER CLEANUP] Inspect all ${markers.length} ${scopeHint}map markers: PRESERVE all ${strategicCount} strategic facilities (INDUSTRY, MILITARY, INFRASTRUCTURE, NAVAL, RESEARCH), and remove redundant ${clutterCount} war/crisis/completed clutter pins via 'manage_map_markers' (action: 'CLEANUP_STALE' or selective 'REMOVE').`;

    const order = await prisma.pendingOrder.create({
      data: {
        sessionId,
        countryCode:
          session.playerCountryCode ?? session.countries[0]?.code ?? "TUR",
        orderType: "NOTE_TO_AI",
        targetCountryCode: parsed.data.countryCode?.trim().toUpperCase() || null,
        content: instructionContent,
        turnNumber: session.turnNumber,
        status: "PENDING",
      },
    });

    markBrowserSessionActive(sessionId);
    emitSessionEvent(sessionId, "order_queued", { order });
    notifyPlayerAction(sessionId, "MANUAL_WAKE", instructionContent);

    const activeLang = getActiveMcpLocale(sessionId) === "en" ? "en" : "tr";
    const summary =
      activeLang === "tr"
        ? `MCP AI'ya harita temizlik talimatı iletildi (${strategicCount} tesis korunup ${clutterCount} savaş/kriz izi ayrıştırılacak).`
        : `Sent smart map cleanup directive to MCP AI (${strategicCount} facilities to preserve, ${clutterCount} war/crisis pins to prune).`;

    return Response.json({
      ok: true,
      mode: "ask_ai_clean",
      orderId: order.id,
      strategicCount,
      clutterCount,
      summary,
    });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Harita işaretleri temizlenemedi",
      },
      { status: 400 }
    );
  }
}
