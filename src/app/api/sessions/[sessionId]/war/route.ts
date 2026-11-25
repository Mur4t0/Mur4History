import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAndSyncRequestLocale } from "@/lib/server-locale";
import {
  advanceLiveWarOperations,
  attemptDirectCeasefireAction,
  computeSessionWarRisks,
  convenePeaceCouncilAction,
  launchWarOperation,
  provokeNationAction,
  resolvePeaceCouncilAction,
} from "@/lib/war-engine";
import { getActiveMcpLocale } from "@/lib/realtime";

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
      "ENVOY_AGITATION",
    ])
    .default("TANK_BLITZ"),
  unitType: z.enum(["INFANTRY", "ARMOR", "AIR", "NAVAL", "MISSILE", "ENVOY"]).optional(),
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

const ConvenePeaceCouncilSchema = z.object({
  mode: z.literal("convene_peace_council"),
  countryA: z.string().min(2).max(16),
  countryB: z.string().min(2).max(16),
  customTopic: z.string().max(600).optional(),
  locale: z.enum(["tr", "en"]).optional(),
});

const ResolvePeaceCouncilSchema = z.object({
  mode: z.literal("resolve_peace_council"),
  councilId: z.string().optional(),
  countryA: z.string().min(2).max(16),
  countryB: z.string().min(2).max(16),
  proposalType: z
    .enum(["WHITE_PEACE", "MEDIATED_PACKAGE", "COERCIVE_COALITION"])
    .default("WHITE_PEACE"),
  locale: z.enum(["tr", "en"]).optional(),
});

const WarPostSchema = z.discriminatedUnion("mode", [
  ProvokeSchema,
  LaunchOpSchema,
  NuclearStrikeSchema,
  AdvanceBattlesSchema,
  CeasefireSchema,
  ConvenePeaceCouncilSchema,
  ResolvePeaceCouncilSchema,
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
      const isTr = getActiveMcpLocale(sessionId) === "tr";
      const playerCode = session.playerCountryCode || "TUR";
      const attackerCode = parsed.data.attackerCode || playerCode;
      if (session.playerCountryCode && attackerCode !== session.playerCountryCode) {
        return Response.json(
          {
            error: isTr
              ? `Yalnızca kendi yönettiğiniz ülkenin (${session.playerCountryCode}) ordularına doğrudan harekât emri verebilirsiniz! Diğer ülkeleri savaşa sokmak için 'Milletleri Birbirine Karıştır' (Gizli Kışkırtma) sekmesini kullanın.`
              : `You can only directly command your own nation's (${session.playerCountryCode}) military! Use Covert Meddling to instigate third-party wars.`,
          },
          { status: 403 }
        );
      }
      if (
        parsed.data.operationType === "ENVOY_AGITATION" ||
        parsed.data.operationType === "REBEL_UPRISING"
      ) {
        const result = await provokeNationAction({
          sessionId,
          actorCode: attackerCode,
          targetCode: parsed.data.defenderCode,
          actionType: "SPONSOR_REBELS",
          targetRegionId: parsed.data.targetRegionId,
          customNote: parsed.data.description,
        });
        return Response.json(result, { status: 201 });
      }
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
        autoDeclareWar: false,
      });
      return Response.json({ operation: op }, { status: 201 });
    }

    if (parsed.data.mode === "nuclear_strike") {
      const isTr = getActiveMcpLocale(sessionId) === "tr";
      const playerCode = session.playerCountryCode || "TUR";
      const attackerCode = parsed.data.attackerCode || playerCode;
      if (session.playerCountryCode && attackerCode !== session.playerCountryCode) {
        return Response.json(
          {
            error: isTr
              ? `Yalnızca kendi ülkenizin (${session.playerCountryCode}) nükleer cephaneliğini ateşleyebilirsiniz!`
              : `You can only fire your own nation's (${session.playerCountryCode}) nuclear arsenal!`,
          },
          { status: 403 }
        );
      }
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

    if (parsed.data.mode === "convene_peace_council") {
      const res = await convenePeaceCouncilAction({
        sessionId,
        countryA: parsed.data.countryA,
        countryB: parsed.data.countryB,
        customTopic: parsed.data.customTopic,
      });
      return Response.json(res, { status: 201 });
    }

    if (parsed.data.mode === "resolve_peace_council") {
      const res = await resolvePeaceCouncilAction({
        sessionId,
        councilId: parsed.data.councilId,
        countryA: parsed.data.countryA,
        countryB: parsed.data.countryB,
        proposalType: parsed.data.proposalType,
      });
      return Response.json(res);
    }

    // mode === "ceasefire"
    const codeA = parsed.data.countryA || session.playerCountryCode || "TUR";
    const res = await attemptDirectCeasefireAction({
      sessionId,
      countryA: codeA,
      countryB: parsed.data.countryB,
    });
    return Response.json(res);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Savaş işlemi başarısız" },
      { status: 400 }
    );
  }
}
