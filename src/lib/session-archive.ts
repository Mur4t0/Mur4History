import { prisma } from "@/lib/prisma";
import { getFullSessionState } from "@/lib/game-engine";
import { DIFFICULTY_META } from "@/lib/utils";
import type { Mur4SaveArchive } from "@/lib/save-schema";

const SQLITE_BATCH_SIZE = 200;

async function insertInChunks<T>(
  items: T[],
  insertChunk: (chunk: T[]) => Promise<unknown>
): Promise<void> {
  for (let i = 0; i < items.length; i += SQLITE_BATCH_SIZE) {
    await insertChunk(items.slice(i, i + SQLITE_BATCH_SIZE));
  }
}

function parseSavedDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Serialize a complete Mur4History game session (all countries, provinces,
 * diplomacies, orders, newspapers, messages, chats, councils, markers, advisor
 * chats, and turn rollback snapshots) into a portable archive object.
 */
export async function exportSessionArchive(
  sessionId: string
): Promise<Mur4SaveArchive> {
  const [
    session,
    countries,
    regions,
    diplomacies,
    orders,
    events,
    messages,
    leaderChats,
    councils,
    mapMarkers,
    advisorChats,
    snapshots,
  ] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { scenario: true },
    }),
    prisma.country.findMany({
      where: { sessionId },
      orderBy: { code: "asc" },
    }),
    prisma.regionOwnership.findMany({
      where: { sessionId },
      orderBy: { regionId: "asc" },
    }),
    prisma.diplomacyRelation.findMany({ where: { sessionId } }),
    prisma.pendingOrder.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.worldEvent.findMany({
      where: { sessionId },
      orderBy: [{ turnNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.diplomaticMessage.findMany({
      where: { sessionId },
      orderBy: [{ turnNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.leaderChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.diplomacyCouncil.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.mapMarker.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.advisorChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.turnSnapshot.findMany({
      where: { sessionId },
      orderBy: { turnNumber: "asc" },
    }),
  ]);

  if (!session) {
    throw new Error(`Oturum bulunamadı: ${sessionId}`);
  }

  const playerCountry = session.playerCountryCode
    ? countries.find((c) => c.code === session.playerCountryCode) ?? null
    : null;

  return {
    format: "mur4history-save",
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: {
      originalSessionId: session.id,
      sessionName: session.name,
      scenarioTitle: session.scenario.title,
      scenarioEra: session.scenario.era,
      playerCountryCode: session.playerCountryCode,
      playerCountryName: playerCountry?.name ?? null,
      currentDate: session.currentDate,
      turnNumber: session.turnNumber,
      difficulty: session.difficulty,
    },
    scenario: {
      id: session.scenario.id,
      slug: session.scenario.slug,
      title: session.scenario.title,
      era: session.scenario.era,
      startDate: session.scenario.startDate,
      turnIntervalMonths: session.scenario.turnIntervalMonths,
      description: session.scenario.description,
      isPreset: session.scenario.isPreset,
      configJson: session.scenario.configJson,
    },
    session: {
      name: session.name,
      playerCountryCode: session.playerCountryCode,
      currentDate: session.currentDate,
      turnNumber: session.turnNumber,
      globalTension: session.globalTension,
      difficulty: session.difficulty,
      timeJumpInterval: session.timeJumpInterval,
      awaitingAiSimulation: session.awaitingAiSimulation,
    },
    countries: countries.map((c) => ({
      code: c.code,
      name: c.name,
      flagEmoji: c.flagEmoji,
      color: c.color,
      leader: c.leader,
      ideology: c.ideology,
      economy: c.economy,
      military: c.military,
      stability: c.stability,
      treasury: c.treasury,
      infamy: c.infamy,
      warExhaustion: c.warExhaustion,
      capitalRegionId: c.capitalRegionId,
      isMajor: c.isMajor,
      description: c.description,
    })),
    regions: regions.map((r) => ({
      regionId: r.regionId,
      regionName: r.regionName,
      ownerCountryCode: r.ownerCountryCode,
      strategicStatus: r.strategicStatus,
      baseValue: r.baseValue,
      lastTransferredTurn: r.lastTransferredTurn,
      transferReason: r.transferReason,
    })),
    diplomacies: diplomacies.map((d) => ({
      countryA: d.countryA,
      countryB: d.countryB,
      status: d.status,
      treatyName: d.treatyName,
      updatedTurn: d.updatedTurn,
    })),
    orders: orders.map((o) => ({
      countryCode: o.countryCode,
      orderType: o.orderType,
      targetCountryCode: o.targetCountryCode,
      content: o.content,
      turnNumber: o.turnNumber,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    events: events.map((ev) => ({
      turnNumber: ev.turnNumber,
      gameDate: ev.gameDate,
      headline: ev.headline,
      articleBody: ev.articleBody,
      category: ev.category,
      involvedCountries: ev.involvedCountries,
      createdAt: ev.createdAt.toISOString(),
    })),
    messages: messages.map((m) => ({
      turnNumber: m.turnNumber,
      gameDate: m.gameDate,
      fromCountryCode: m.fromCountryCode,
      toCountryCode: m.toCountryCode,
      senderTitle: m.senderTitle,
      message: m.message,
      isFromPlayer: m.isFromPlayer,
      createdAt: m.createdAt.toISOString(),
    })),
    leaderChats: leaderChats.map((lc) => ({
      countryCode: lc.countryCode,
      playerCountryCode: lc.playerCountryCode,
      senderRole: lc.senderRole,
      senderName: lc.senderName,
      content: lc.content,
      status: lc.status,
      turnNumber: lc.turnNumber,
      gameDate: lc.gameDate,
      createdAt: lc.createdAt.toISOString(),
    })),
    councils: councils.map((c) => ({
      title: c.title,
      topic: c.topic,
      councilType: c.councilType,
      initiatorCode: c.initiatorCode,
      participantCodes: c.participantCodes,
      status: c.status,
      turnNumber: c.turnNumber,
      gameDate: c.gameDate,
      createdAt: c.createdAt.toISOString(),
      messages: c.messages.map((cm) => ({
        senderCode: cm.senderCode,
        senderName: cm.senderName,
        senderRole: cm.senderRole,
        content: cm.content,
        stance: cm.stance,
        status: cm.status,
        turnNumber: cm.turnNumber,
        gameDate: cm.gameDate,
        createdAt: cm.createdAt.toISOString(),
      })),
    })),
    mapMarkers: mapMarkers.map((mk) => ({
      countryCode: mk.countryCode,
      regionId: mk.regionId,
      cityName: mk.cityName,
      title: mk.title,
      description: mk.description,
      category: mk.category,
      status: mk.status,
      level: mk.level,
      lat: mk.lat,
      lng: mk.lng,
      turnNumber: mk.turnNumber,
      gameDate: mk.gameDate,
      isAnimated: mk.isAnimated,
      createdAt: mk.createdAt.toISOString(),
    })),
    advisorChats: advisorChats.map((ac) => ({
      senderRole: ac.senderRole,
      senderName: ac.senderName,
      content: ac.content,
      suggestedOrdersJson: ac.suggestedOrdersJson,
      status: ac.status,
      turnNumber: ac.turnNumber,
      gameDate: ac.gameDate,
      createdAt: ac.createdAt.toISOString(),
    })),
    snapshots: snapshots.map((sn) => ({
      turnNumber: sn.turnNumber,
      gameDate: sn.gameDate,
      summary: sn.summary,
      stateJson: sn.stateJson,
      createdAt: sn.createdAt.toISOString(),
    })),
  };
}

/**
 * Restore a complete exported Mur4SaveArchive as a fresh active GameSession,
 * ensuring the embedded scenario exists if imported on another machine.
 */
export async function importSessionArchive(
  archive: Mur4SaveArchive,
  customSessionName?: string
) {
  const validDifficulty = DIFFICULTY_META[archive.session.difficulty]
    ? archive.session.difficulty
    : "NORMAL";

  const createdSessionId = await prisma.$transaction(async (tx) => {
    let targetScenario = await tx.scenario.findUnique({
      where: { id: archive.scenario.id },
      select: { id: true },
    });

    if (!targetScenario) {
      targetScenario = await tx.scenario.findUnique({
        where: { slug: archive.scenario.slug },
        select: { id: true },
      });
    }

    if (!targetScenario) {
      const createdScenario = await tx.scenario.create({
        data: {
          id: archive.scenario.id,
          slug: archive.scenario.slug,
          title: archive.scenario.title,
          era: archive.scenario.era,
          startDate: archive.scenario.startDate,
          turnIntervalMonths: archive.scenario.turnIntervalMonths,
          description: archive.scenario.description,
          isPreset: false,
          configJson: archive.scenario.configJson,
        },
        select: { id: true },
      });
      targetScenario = createdScenario;
    }

    const sessionName =
      customSessionName?.trim() || archive.session.name.trim();

    const createdSession = await tx.gameSession.create({
      data: {
        name: sessionName,
        scenarioId: targetScenario.id,
        playerCountryCode: archive.session.playerCountryCode ?? null,
        currentDate: archive.session.currentDate,
        turnNumber: archive.session.turnNumber,
        globalTension: archive.session.globalTension,
        difficulty: validDifficulty,
        timeJumpInterval: archive.session.timeJumpInterval || "SCENARIO_DEFAULT",
        awaitingAiSimulation: archive.session.awaitingAiSimulation,
      },
      select: { id: true },
    });

    const sid = createdSession.id;

    await insertInChunks(archive.countries, (chunk) =>
      tx.country.createMany({
        data: chunk.map((c) => ({
          sessionId: sid,
          code: c.code,
          name: c.name,
          flagEmoji: c.flagEmoji,
          color: c.color,
          leader: c.leader,
          ideology: c.ideology,
          economy: c.economy,
          military: c.military,
          stability: c.stability,
          treasury: c.treasury,
          infamy: c.infamy ?? 0,
          warExhaustion: c.warExhaustion ?? 0,
          capitalRegionId: c.capitalRegionId ?? null,
          isMajor: c.isMajor,
          description: c.description ?? null,
        })),
      })
    );

    await insertInChunks(archive.regions, (chunk) =>
      tx.regionOwnership.createMany({
        data: chunk.map((r) => ({
          sessionId: sid,
          regionId: r.regionId,
          regionName: r.regionName,
          ownerCountryCode: r.ownerCountryCode,
          strategicStatus: r.strategicStatus,
          baseValue: r.baseValue,
          lastTransferredTurn: r.lastTransferredTurn ?? null,
          transferReason: r.transferReason ?? null,
        })),
      })
    );

    await insertInChunks(archive.diplomacies, (chunk) =>
      tx.diplomacyRelation.createMany({
        data: chunk.map((d) => ({
          sessionId: sid,
          countryA: d.countryA,
          countryB: d.countryB,
          status: d.status,
          treatyName: d.treatyName ?? null,
          updatedTurn: d.updatedTurn,
        })),
      })
    );

    await insertInChunks(archive.orders, (chunk) =>
      tx.pendingOrder.createMany({
        data: chunk.map((o) => ({
          sessionId: sid,
          countryCode: o.countryCode,
          orderType: o.orderType,
          targetCountryCode: o.targetCountryCode ?? null,
          content: o.content,
          turnNumber: o.turnNumber,
          status: o.status,
          createdAt: parseSavedDate(o.createdAt),
        })),
      })
    );

    await insertInChunks(archive.events, (chunk) =>
      tx.worldEvent.createMany({
        data: chunk.map((ev) => ({
          sessionId: sid,
          turnNumber: ev.turnNumber,
          gameDate: ev.gameDate,
          headline: ev.headline,
          articleBody: ev.articleBody,
          category: ev.category,
          involvedCountries: ev.involvedCountries,
          createdAt: parseSavedDate(ev.createdAt),
        })),
      })
    );

    await insertInChunks(archive.messages, (chunk) =>
      tx.diplomaticMessage.createMany({
        data: chunk.map((m) => ({
          sessionId: sid,
          turnNumber: m.turnNumber,
          gameDate: m.gameDate,
          fromCountryCode: m.fromCountryCode,
          toCountryCode: m.toCountryCode,
          senderTitle: m.senderTitle,
          message: m.message,
          isFromPlayer: m.isFromPlayer,
          createdAt: parseSavedDate(m.createdAt),
        })),
      })
    );

    await insertInChunks(archive.leaderChats, (chunk) =>
      tx.leaderChatMessage.createMany({
        data: chunk.map((lc) => ({
          sessionId: sid,
          countryCode: lc.countryCode,
          playerCountryCode: lc.playerCountryCode,
          senderRole: lc.senderRole,
          senderName: lc.senderName,
          content: lc.content,
          status: lc.status,
          turnNumber: lc.turnNumber,
          gameDate: lc.gameDate,
          createdAt: parseSavedDate(lc.createdAt),
        })),
      })
    );

    for (const council of archive.councils) {
      await tx.diplomacyCouncil.create({
        data: {
          sessionId: sid,
          title: council.title,
          topic: council.topic,
          councilType: council.councilType,
          initiatorCode: council.initiatorCode,
          participantCodes: council.participantCodes,
          status: council.status,
          turnNumber: council.turnNumber,
          gameDate: council.gameDate,
          createdAt: parseSavedDate(council.createdAt),
          messages:
            council.messages.length > 0
              ? {
                  create: council.messages.map((cm) => ({
                    sessionId: sid,
                    senderCode: cm.senderCode,
                    senderName: cm.senderName,
                    senderRole: cm.senderRole,
                    content: cm.content,
                    stance: cm.stance ?? null,
                    status: cm.status,
                    turnNumber: cm.turnNumber,
                    gameDate: cm.gameDate,
                    createdAt: parseSavedDate(cm.createdAt),
                  })),
                }
              : undefined,
        },
      });
    }

    await insertInChunks(archive.mapMarkers, (chunk) =>
      tx.mapMarker.createMany({
        data: chunk.map((mk) => ({
          sessionId: sid,
          countryCode: mk.countryCode,
          regionId: mk.regionId ?? null,
          cityName: mk.cityName ?? null,
          title: mk.title,
          description: mk.description,
          category: mk.category,
          status: mk.status,
          level: mk.level,
          lat: mk.lat,
          lng: mk.lng,
          turnNumber: mk.turnNumber,
          gameDate: mk.gameDate,
          isAnimated: mk.isAnimated,
          createdAt: parseSavedDate(mk.createdAt),
        })),
      })
    );

    await insertInChunks(archive.advisorChats, (chunk) =>
      tx.advisorChatMessage.createMany({
        data: chunk.map((ac) => ({
          sessionId: sid,
          senderRole: ac.senderRole,
          senderName: ac.senderName,
          content: ac.content,
          suggestedOrdersJson: ac.suggestedOrdersJson ?? null,
          status: ac.status,
          turnNumber: ac.turnNumber,
          gameDate: ac.gameDate,
          createdAt: parseSavedDate(ac.createdAt),
        })),
      })
    );

    await insertInChunks(archive.snapshots, (chunk) =>
      tx.turnSnapshot.createMany({
        data: chunk.map((sn) => ({
          sessionId: sid,
          turnNumber: sn.turnNumber,
          gameDate: sn.gameDate,
          summary: sn.summary,
          stateJson: sn.stateJson,
          createdAt: parseSavedDate(sn.createdAt),
        })),
      })
    );

    return sid;
  }, { timeout: 20000 });

  return getFullSessionState(createdSessionId);
}
