import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFullSessionState } from "@/lib/game-engine";
import { emitSessionEvent } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSessionSchema = z.object({
  playerCountryCode: z.string().min(2).max(16).optional(),
  name: z.string().min(1).max(120).optional(),
  awaitingAiSimulation: z.boolean().optional(),
  difficulty: z
    .enum(["VERY_EASY", "EASY", "NORMAL", "HARD", "IMPOSSIBLE"])
    .optional(),
  timeJumpInterval: z
    .enum(["1W", "1M", "3M", "6M", "1Y", "SCENARIO_DEFAULT"])
    .optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const session = await getFullSessionState(sessionId);
  if (!session) {
    return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
  }
  return Response.json({ session });
}

export async function PATCH(
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

  const parsed = PatchSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz güncelleme verisi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!existing) {
    return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
  }

  if (parsed.data.playerCountryCode) {
    const country = await prisma.country.findUnique({
      where: {
        sessionId_code: {
          sessionId,
          code: parsed.data.playerCountryCode,
        },
      },
    });
    if (!country) {
      return Response.json(
        { error: `Ülke oturumda bulunamadı: ${parsed.data.playerCountryCode}` },
        { status: 400 }
      );
    }
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      ...(parsed.data.playerCountryCode
        ? { playerCountryCode: parsed.data.playerCountryCode }
        : {}),
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.awaitingAiSimulation !== undefined
        ? { awaitingAiSimulation: parsed.data.awaitingAiSimulation }
        : {}),
      ...(parsed.data.difficulty
        ? { difficulty: parsed.data.difficulty }
        : {}),
      ...(parsed.data.timeJumpInterval
        ? { timeJumpInterval: parsed.data.timeJumpInterval }
        : {}),
    },
  });

  if (parsed.data.playerCountryCode) {
    emitSessionEvent(sessionId, "country_selected", {
      playerCountryCode: parsed.data.playerCountryCode,
    });
  } else {
    emitSessionEvent(sessionId, "state_sync", {});
  }

  const session = await getFullSessionState(sessionId);
  return Response.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  await prisma.gameSession.delete({ where: { id: sessionId } }).catch(() => null);
  return Response.json({ deleted: true });
}
