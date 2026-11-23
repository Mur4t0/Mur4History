import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import {
  advanceLiveWarOperations,
  computeSessionWarRisks,
  launchWarOperation,
  provokeNationAction,
  upsertDiplomacyTension,
} from "@/lib/war-engine";
import { emitSessionEvent } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ProvokeSchema = z.object({
  mode: z.literal("provoke"),
  actorCode: z.string().min(2).max(16).optional(),
  targetCode: z.string().min(2).max(16),
  instigateWithCode: z.string().min(2).max(16).optional(),
  actionType: z.enum([
    "BORDER_SKIRMISH",
    "DIPLOMATIC_INSULT",
    "SPONSOR_REBELS",
    "INCITE_THIRD_PARTY_WAR",
    "DECLARE_WAR",
  ]),
  targetRegionId: z.string().optional(),
  customNote: z.string().max(600).optional(),
  locale: z.enum(["tr", "en"]).optional(),
});

const LaunchOpSchema = z.object({
  mode: z.literal("launch_operation"),
  attackerCode: z.string().min(2).max(16).optional(),
  defenderCode: z.string().min(2).max(16),
  targetRegionId: z.string().optional(),
  operationType: z
    .enum([
      "SIEGE",
      "ASSAULT",
      "TANK_BLITZ",
      "AIR_STRIKE",
      "NAVAL_INVASION",
      "REBEL_UPRISING",
    ])
    .default("TANK_BLITZ"),
  unitType: z.enum(["INFANTRY", "ARMOR", "AIR", "NAVAL", "MISSILE"]).optional(),
  intensity: z.number().int().min(10).max(100).default(75),
  title: z.string().max(160).optional(),
  description: z.string().max(600).optional(),
  autoDeclareWar: z.boolean().default(true),
  locale: z.enum(["tr", "en"]).optional(),
});

const NuclearStrikeSchema = z.object({
  mode: z.literal("nuclear_strike"),
  attackerCode: z.string().min(2).max(16).optional(),
  defenderCode: z.string().min(2).max(16),
  targetRegionId: z.string().optional(),
  title: z.string().max(160).optional(),
  locale: z.enum(["tr", "en"]).optional(),
});

const AdvanceBattlesSchema = z.object({
  mode: z.literal("advance_battles"),
  operationId: z.string().optional(),
  tickTensions: z.boolean().default(false),
  locale: z.enum(["tr", "en"]).optional(),
});

const CeasefireSchema = z.object({
  mode: z.literal("ceasefire"),
  countryA: z.string().min(2).max(16).optional(),
  countryB: z.string().min(2).max(16),
  locale: z.enum(["tr", "en"]).optional(),
});

const WarPostSchema = z.discriminatedUnion("mode", [
  ProvokeSchema,
  LaunchOpSchema,
  NuclearStrikeSchema,
  AdvanceBattlesSchema,
  CeasefireSchema,
]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const focus = req.nextUrl.searchParams.get("focus") || undefined;
  try {
    const data = await computeSessionWarRisks(sessionId, focus);
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Savaş verisi okunamadı" },
      { status: 404 }
    );
  }
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

  const parsed = WarPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz savaş komutu", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    resolveAndSyncRequestLocale(req, sessionId, parsed.data.locale);
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true, playerCountryCode: true, turnNumber: true },
    });
    if (!session) {
      return Response.json({ error: "Oturum bulunamadı" }, { status: 404 });
    }

    if (parsed.data.mode === "provoke") {
      const actorCode =
        parsed.data.actorCode || session.playerCountryCode || "TUR";
      const result = await provokeNationAction({
        sessionId,
        actorCode,
        targetCode: parsed.data.targetCode,
        instigateWithCode: parsed.data.instigateWithCode,
        actionType: parsed.data.actionType,
        targetRegionId: parsed.data.targetRegionId,
        customNote: parsed.data.customNote,
      });
      return Response.json(result, { status: 201 });
    }

    if (parsed.data.mode === "launch_operation") {
      const attackerCode =
        parsed.data.attackerCode || session.playerCountryCode || "TUR";
      const op = await launchWarOperation({
        sessionId,
        attackerCode,
        defenderCode: parsed.data.defenderCode,
        targetRegionId: parsed.data.targetRegionId,
        operationType: parsed.data.operationType,
        unitType: parsed.data.unitType,
        intensity: parsed.data.intensity,
        title: parsed.data.title,
        description: parsed.data.description,
        autoDeclareWar: parsed.data.autoDeclareWar,
      });
      return Response.json({ operation: op }, { status: 201 });
    }

    if (parsed.data.mode === "nuclear_strike") {
      const attackerCode =
        parsed.data.attackerCode || session.playerCountryCode || "TUR";
      const op = await launchWarOperation({
        sessionId,
        attackerCode,
        defenderCode: parsed.data.defenderCode,
        targetRegionId: parsed.data.targetRegionId,
        operationType: "NUCLEAR_STRIKE",
        unitType: "MISSILE",
        intensity: 100,
        title: parsed.data.title,
        autoDeclareWar: true,
      });
      return Response.json({ operation: op }, { status: 201 });
    }

    if (parsed.data.mode === "advance_battles") {
      const res = await advanceLiveWarOperations({
        sessionId,
        operationId: parsed.data.operationId,
        tickTensions: parsed.data.tickTensions,
      });
      return Response.json(res);
    }

    // mode === "ceasefire"
    const codeA = parsed.data.countryA || session.playerCountryCode || "TUR";
    const { relation } = await upsertDiplomacyTension({
      sessionId,
      countryA: codeA,
      countryB: parsed.data.countryB,
      status: "NEUTRAL",
      exactTension: 28,
      treatyName: "Ateşkes / Ceasefire",
      turnNumber: session.turnNumber,
    });
    await prisma.warOperation.updateMany({
      where: {
        sessionId,
        status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
        OR: [
          { attackerCode: codeA, defenderCode: parsed.data.countryB },
          { attackerCode: parsed.data.countryB, defenderCode: codeA },
        ],
      },
      data: { status: "REPELLED" },
    });
    emitSessionEvent(sessionId, "war_operation_updated", { ceasefire: true });
    return Response.json({ relation });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Savaş işlemi başarısız" },
      { status: 400 }
    );
  }
}
