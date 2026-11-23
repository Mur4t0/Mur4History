import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import { ensureSessionNuclearSeeded } from "@/lib/game-engine";
import { findNuclearPartners, isNuclearEraDate } from "@/lib/nuclear-doctrine";
import {
  requestNuclearSharingWithAlly,
  transferNuclearWarheads,
} from "@/lib/war-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSharingSchema = z.object({
  mode: z.literal("request_sharing"),
  patronCode: z.string().min(2).max(16),
  count: z.number().int().min(1).max(3).default(1),
  customMessage: z.string().max(1200).optional(),
  dispatch: z.enum(["ai", "treaty_protocol"]).default("treaty_protocol"),
  locale: z.enum(["tr", "en"]).optional(),
});

const DirectTransferSchema = z.object({
  mode: z.literal("transfer"),
  fromCode: z.string().min(2).max(16),
  toCode: z.string().min(2).max(16).optional(),
  count: z.number().int().min(1).max(20).default(1),
  treatyName: z.string().max(160).optional(),
  reason: z.string().max(600).optional(),
  requireTreaty: z.boolean().default(true),
  locale: z.enum(["tr", "en"]).optional(),
});

const NuclearPostSchema = z.discriminatedUnion("mode", [
  RequestSharingSchema,
  DirectTransferSchema,
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  await ensureSessionNuclearSeeded(sessionId);

  const [session, countries, diplomacies] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true, currentDate: true, playerCountryCode: true },
    }),
    prisma.country.findMany({ where: { sessionId } }),
    prisma.diplomacyRelation.findMany({ where: { sessionId } }),
  ]);

  if (!session) {
    return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
  }

  const playerCountry = session.playerCountryCode
    ? countries.find((c) => c.code === session.playerCountryCode) ?? null
    : null;

  return Response.json({
    sessionId,
    nuclearEra: isNuclearEraDate(session.currentDate),
    playerWarheads: playerCountry?.nuclearWarheads ?? 0,
    partners: findNuclearPartners(
      session.playerCountryCode,
      countries,
      diplomacies
    ),
  });
}

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

  const parsed = NuclearPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz nükleer diplomasi komutu", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const effectiveLocale = resolveAndSyncRequestLocale(
      req,
      sessionId,
      parsed.data.locale
    );
    await ensureSessionNuclearSeeded(sessionId);

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true, playerCountryCode: true },
    });
    if (!session) {
      return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
    }

    if (parsed.data.mode === "request_sharing") {
      const result = await requestNuclearSharingWithAlly({
        sessionId,
        patronCode: parsed.data.patronCode,
        requestedCount: parsed.data.count,
        customMessage: parsed.data.customMessage,
        dispatch: parsed.data.dispatch,
        locale: effectiveLocale,
      });
      return Response.json(result, { status: 201 });
    }

    const toCode = parsed.data.toCode || session.playerCountryCode || "TUR";
    const result = await transferNuclearWarheads({
      sessionId,
      fromCode: parsed.data.fromCode,
      toCode,
      count: parsed.data.count,
      treatyName: parsed.data.treatyName,
      reason: parsed.data.reason,
      requireTreaty: parsed.data.requireTreaty,
      skipAiWake: true,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Nükleer diplomasi işlemi başarısız",
      },
      { status: 400 }
    );
  }
}
