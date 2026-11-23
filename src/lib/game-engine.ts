import { prisma } from "@/lib/prisma";
import {
  type AppLocale,
  getCountryDisplayName,
} from "@/lib/i18n";
import {
  getMcpLanguageDirective,
  getMcpToolInstructions,
  localizeWorldStateFields,
} from "@/lib/mcp-locale";
import {
  emitSessionEvent,
  getActiveMcpLocale,
  getMcpConnectionStatus,
  markBrowserSessionActive,
  notifyPlayerAction,
  waitForPlayerActionEvent,
} from "@/lib/realtime";
import { expandScenarioToWorld, type ScenarioConfig } from "@/lib/scenarios";
import { getAllWorldRegions } from "@/lib/geo-regions";
import { resolveMarkerCoordinates } from "@/lib/geo-cities";
import {
  advanceLiveWarOperations,
  launchWarOperation,
  transferNuclearWarheads,
} from "@/lib/war-engine";
import {
  getInitialNuclearWarheads,
  isNuclearEraDate,
  isTreatyEligibleForNuclearSharing,
} from "@/lib/nuclear-doctrine";
import {
  advanceDateByInterval,
  advanceDateMonths,
  clamp,
  DIFFICULTY_META,
  safeJsonParse,
  sortCountryPair,
} from "@/lib/utils";
import type { DiplomacyStatus, EventCategory } from "@/lib/scenarios/types";

export interface SessionSnapshotPayload {
  currentDate: string;
  turnNumber: number;
  globalTension: number;
  countries: Array<{
    code: string;
    name: string;
    flagEmoji: string;
    color: string;
    leader: string;
    ideology: string;
    economy: number;
    military: number;
    stability: number;
    treasury: number;
    infamy?: number;
    warExhaustion?: number;
    nuclearWarheads?: number;
    capitalRegionId: string | null;
    isMajor: boolean;
    description: string | null;
  }>;
  regions: Array<{
    regionId: string;
    regionName: string;
    ownerCountryCode: string;
    strategicStatus: string;
    baseValue: number;
    lastTransferredTurn: number | null;
    transferReason: string | null;
  }>;
  diplomacies: Array<{
    countryA: string;
    countryB: string;
    status: string;
    tension?: number;
    treatyName: string | null;
    updatedTurn: number;
  }>;
  warOperations?: Array<{
    operationType: string;
    unitType: string;
    attackerCode: string;
    defenderCode: string;
    fromRegionId: string | null;
    fromLat: number;
    fromLng: number;
    targetRegionId: string;
    targetRegionName: string;
    targetLat: number;
    targetLng: number;
    intensity: number;
    progress: number;
    attackerLosses: number;
    defenderLosses: number;
    status: string;
    title: string;
    description: string;
    turnNumber: number;
    gameDate: string;
  }>;
  mapMarkers?: Array<{
    countryCode: string;
    regionId: string | null;
    cityName: string | null;
    title: string;
    description: string;
    category: string;
    status: string;
    level: number;
    lat: number;
    lng: number;
    turnNumber: number;
    gameDate: string;
    isAnimated: boolean;
  }>;
}

async function buildSnapshotJson(sessionId: string): Promise<string> {
  const [session, countries, regions, diplomacies, mapMarkers, warOperations] =
    await Promise.all([
      prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } }),
      prisma.country.findMany({ where: { sessionId } }),
      prisma.regionOwnership.findMany({ where: { sessionId } }),
      prisma.diplomacyRelation.findMany({ where: { sessionId } }),
      prisma.mapMarker.findMany({ where: { sessionId } }),
      prisma.warOperation.findMany({ where: { sessionId } }),
    ]);

  const payload: SessionSnapshotPayload = {
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    globalTension: session.globalTension,
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
      nuclearWarheads: c.nuclearWarheads,
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
      tension: d.tension,
      treatyName: d.treatyName,
      updatedTurn: d.updatedTurn,
    })),
    warOperations: warOperations.map((wo) => ({
      operationType: wo.operationType,
      unitType: wo.unitType,
      attackerCode: wo.attackerCode,
      defenderCode: wo.defenderCode,
      fromRegionId: wo.fromRegionId,
      fromLat: wo.fromLat,
      fromLng: wo.fromLng,
      targetRegionId: wo.targetRegionId,
      targetRegionName: wo.targetRegionName,
      targetLat: wo.targetLat,
      targetLng: wo.targetLng,
      intensity: wo.intensity,
      progress: wo.progress,
      attackerLosses: wo.attackerLosses,
      defenderLosses: wo.defenderLosses,
      status: wo.status,
      title: wo.title,
      description: wo.description,
      turnNumber: wo.turnNumber,
      gameDate: wo.gameDate,
    })),
    mapMarkers: mapMarkers.map((m) => ({
      countryCode: m.countryCode,
      regionId: m.regionId,
      cityName: m.cityName,
      title: m.title,
      description: m.description,
      category: m.category,
      status: m.status,
      level: m.level,
      lat: m.lat,
      lng: m.lng,
      turnNumber: m.turnNumber,
      gameDate: m.gameDate,
      isAnimated: m.isAnimated,
    })),
  };

  return JSON.stringify(payload);
}

export async function createSessionFromScenario(
  scenarioId: string,
  sessionName?: string,
  playerCountryCode?: string,
  difficulty = "NORMAL",
  timeJumpInterval = "SCENARIO_DEFAULT"
) {
  const scenarioRecord = await prisma.scenario.findUnique({
    where: { id: scenarioId },
  });
  if (!scenarioRecord) {
    throw new Error(`Senaryo bulunamadı: ${scenarioId}`);
  }

  const config = safeJsonParse<ScenarioConfig | null>(
    scenarioRecord.configJson,
    null
  );
  if (!config) {
    throw new Error("Senaryo JSON konfigürasyonu geçersiz.");
  }

  const expanded = expandScenarioToWorld(config);
  const resolvedPlayerCode =
    playerCountryCode &&
    expanded.countries.some((c) => c.code === playerCountryCode)
      ? playerCountryCode
      : null;

  const validDifficulty = DIFFICULTY_META[difficulty] ? difficulty : "NORMAL";

  const session = await prisma.gameSession.create({
    data: {
      name: sessionName?.trim() || `${config.title} — Oturum`,
      scenarioId: scenarioRecord.id,
      playerCountryCode: resolvedPlayerCode,
      currentDate: config.startDate,
      turnNumber: 1,
      globalTension: config.globalTension,
      difficulty: validDifficulty,
      timeJumpInterval,
      awaitingAiSimulation: false,
      nuclearSeeded: true,
    },
  });

  await prisma.country.createMany({
    data: expanded.countries.map((c) => ({
      sessionId: session.id,
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
      nuclearWarheads: getInitialNuclearWarheads(
        c.code,
        config.startDate,
        config.slug
      ),
      capitalRegionId: c.capitalRegionId ?? null,
      isMajor: c.isMajor,
      description: c.description ?? null,
    })),
  });

  await prisma.regionOwnership.createMany({
    data: expanded.regionOwnerships.map((r) => ({
      sessionId: session.id,
      regionId: r.regionId,
      regionName: r.regionName,
      ownerCountryCode: r.ownerCountryCode,
      strategicStatus: r.strategicStatus,
      baseValue: r.baseValue,
    })),
  });

  if (config.diplomacies.length > 0) {
    const validCodes = new Set(expanded.countries.map((c) => c.code));
    const seenPairs = new Set<string>();
    const diplomacyRows = [];
    for (const dip of config.diplomacies) {
      if (!validCodes.has(dip.countryA) || !validCodes.has(dip.countryB)) continue;
      if (dip.countryA === dip.countryB) continue;
      const [a, b] = sortCountryPair(dip.countryA, dip.countryB);
      const key = `${a}::${b}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      diplomacyRows.push({
        sessionId: session.id,
        countryA: a,
        countryB: b,
        status: dip.status,
        treatyName: dip.treatyName ?? null,
        updatedTurn: 1,
      });
    }
    if (diplomacyRows.length > 0) {
      await prisma.diplomacyRelation.createMany({ data: diplomacyRows });
    }
  }

  if (config.initialEvents.length > 0) {
    await prisma.worldEvent.createMany({
      data: config.initialEvents.map((ev) => ({
        sessionId: session.id,
        turnNumber: 1,
        gameDate: config.startDate,
        headline: ev.headline,
        articleBody: ev.articleBody,
        category: ev.category,
        involvedCountries: JSON.stringify(ev.involvedCountries),
      })),
    });
  }

  const snapshotJson = await buildSnapshotJson(session.id);
  await prisma.turnSnapshot.create({
    data: {
      sessionId: session.id,
      turnNumber: 1,
      gameDate: config.startDate,
      summary: `Başlangıç durumu (${config.title})`,
      stateJson: snapshotJson,
    },
  });

  return getFullSessionState(session.id);
}

/** Lazily backfill era-calibrated nuclear stockpiles once for older/existing saves. */
export async function ensureSessionNuclearSeeded(sessionId: string) {
  const check = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      currentDate: true,
      nuclearSeeded: true,
      scenario: { select: { slug: true } },
    },
  });
  if (!check || check.nuclearSeeded) return;

  if (isNuclearEraDate(check.currentDate)) {
    const countries = await prisma.country.findMany({
      where: { sessionId },
      select: { id: true, code: true, nuclearWarheads: true },
    });
    const updates = countries
      .map((c) => ({
        id: c.id,
        current: c.nuclearWarheads,
        seeded: getInitialNuclearWarheads(
          c.code,
          check.currentDate,
          check.scenario.slug
        ),
      }))
      .filter((x) => x.current === 0 && x.seeded > 0);

    await prisma.$transaction([
      ...updates.map((u) =>
        prisma.country.update({
          where: { id: u.id },
          data: { nuclearWarheads: u.seeded },
        })
      ),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: { nuclearSeeded: true },
      }),
    ]);
  } else {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { nuclearSeeded: true },
    });
  }
}

export async function getFullSessionState(sessionId: string) {
  await ensureSessionNuclearSeeded(sessionId);

  const existingCheck = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      scenario: { select: { configJson: true } },
      _count: { select: { regions: true } },
    },
  });

  if (existingCheck && existingCheck._count.regions < getAllWorldRegions().length) {
    const cfg = safeJsonParse<ScenarioConfig | null>(
      existingCheck.scenario.configJson,
      null
    );
    if (cfg) {
      const expanded = expandScenarioToWorld(cfg);
      const [existingCountries, existingRegions] = await Promise.all([
        prisma.country.findMany({ where: { sessionId }, select: { code: true } }),
        prisma.regionOwnership.findMany({
          where: { sessionId },
          select: { regionId: true },
        }),
      ]);
      const haveC = new Set(existingCountries.map((c) => c.code));
      const haveR = new Set(existingRegions.map((r) => r.regionId));
      const newC = expanded.countries.filter((c) => !haveC.has(c.code));
      const newR = expanded.regionOwnerships.filter((r) => !haveR.has(r.regionId));
      if (newC.length > 0) {
        await prisma.country.createMany({
          data: newC.map((c) => ({
            sessionId,
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
            capitalRegionId: c.capitalRegionId ?? null,
            isMajor: c.isMajor,
            description: c.description ?? null,
          })),
        });
      }
      if (newR.length > 0) {
        await prisma.regionOwnership.createMany({
          data: newR.map((r) => ({
            sessionId,
            regionId: r.regionId,
            regionName: r.regionName,
            ownerCountryCode: r.ownerCountryCode,
            strategicStatus: r.strategicStatus,
            baseValue: r.baseValue,
          })),
        });
      }
    }
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: {
        select: {
          id: true,
          slug: true,
          title: true,
          era: true,
          turnIntervalMonths: true,
          description: true,
        },
      },
      countries: {
        orderBy: [{ isMajor: "desc" }, { economy: "desc" }, { name: "asc" }],
      },
      regions: {
        orderBy: { regionName: "asc" },
      },
      diplomacies: true,
      orders: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      },
      events: {
        orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
        take: 250,
      },
      messages: {
        orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
        take: 250,
      },
      leaderChats: {
        orderBy: { createdAt: "asc" },
        take: 300,
      },
      councils: {
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      mapMarkers: {
        orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
      },
      warOperations: {
        orderBy: [{ createdAt: "desc" }],
        take: 80,
      },
      advisorChats: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
      snapshots: {
        select: {
          id: true,
          turnNumber: true,
          gameDate: true,
          summary: true,
          createdAt: true,
        },
        orderBy: { turnNumber: "desc" },
      },
    },
  });

  if (!session) return null;

  return {
    ...session,
    events: session.events.map((e) => ({
      ...e,
      involvedCountries: safeJsonParse<string[]>(e.involvedCountries, []),
    })),
    councils: session.councils.map((c) => ({
      ...c,
      participantCodes: safeJsonParse<string[]>(c.participantCodes, []),
    })),
    advisorChats: session.advisorChats.map((ac) => ({
      ...ac,
      suggestedOrders: ac.suggestedOrdersJson
        ? safeJsonParse<
            Array<{ title: string; category?: string; command: string }>
          >(ac.suggestedOrdersJson, [])
        : [],
    })),
    mcpStatus: getMcpConnectionStatus(sessionId),
  };
}

// ============================================================
// MCP RESOURCE READERS (5 Spec Resources)
// ============================================================

export async function readWorldStateResource(
  sessionId: string,
  explicitLocale?: AppLocale
) {
  await ensureSessionNuclearSeeded(sessionId);
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      diplomacies: true,
      countries: {
        select: {
          code: true,
          name: true,
          flagEmoji: true,
          nuclearWarheads: true,
        },
      },
    },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const locale = explicitLocale ?? getActiveMcpLocale(sessionId);
  const countryNames = new Map(
    session.countries.map((c) => [
      c.code,
      getCountryDisplayName(c.code, c.name, locale),
    ])
  );
  const activeWars = session.diplomacies
    .filter((d) => d.status === "WAR")
    .map((d) => ({
      countryA: d.countryA,
      countryAName: countryNames.get(d.countryA) ?? d.countryA,
      countryB: d.countryB,
      countryBName: countryNames.get(d.countryB) ?? d.countryB,
      treatyName: d.treatyName,
    }));

  const alliances = session.diplomacies
    .filter((d) => d.status === "ALLIANCE")
    .map((d) => ({
      countryA: d.countryA,
      countryB: d.countryB,
      treatyName: d.treatyName,
    }));

  const playerCountryRow = session.playerCountryCode
    ? session.countries.find((c) => c.code === session.playerCountryCode) ?? null
    : null;

  const localized = localizeWorldStateFields({
    locale,
    difficulty: session.difficulty,
    timeJumpInterval: session.timeJumpInterval,
    scenario: session.scenario,
    playerCountryCode: session.playerCountryCode,
    playerCountryRawName: playerCountryRow
      ? playerCountryRow.name
      : session.playerCountryCode,
  });
  const suggestedNextDate = advanceDateByInterval(
    session.currentDate,
    session.timeJumpInterval,
    session.scenario.turnIntervalMonths
  );

  return {
    preferredLanguage: locale,
    languageDirective: getMcpLanguageDirective(locale),
    sessionId: session.id,
    sessionName: session.name,
    difficulty: session.difficulty,
    difficultyLabel: localized.difficultyLabel,
    difficultyTreatyAcceptanceRate: localized.difficultyTreatyAcceptanceRate,
    difficultyRules: localized.difficultyRules,
    timeJumpInterval: session.timeJumpInterval,
    timeJumpIntervalLabel: localized.timeJumpLabel,
    scenario: {
      id: session.scenario.id,
      title: localized.scenarioTitle,
      era: localized.scenarioEra,
      turnIntervalMonths: session.scenario.turnIntervalMonths,
      suggestedNextDate,
    },
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    globalTension: session.globalTension,
    nuclearEra: isNuclearEraDate(session.currentDate),
    awaitingAiSimulation: session.awaitingAiSimulation,
    playerCountryCode: session.playerCountryCode,
    playerCountryName: localized.playerCountryName,
    playerNuclearWarheads: playerCountryRow?.nuclearWarheads ?? 0,
    activeWars,
    alliances,
  };
}

export async function readCountriesResource(
  sessionId: string,
  explicitLocale?: AppLocale
) {
  await ensureSessionNuclearSeeded(sessionId);
  const locale = explicitLocale ?? getActiveMcpLocale(sessionId);
  const [countries, regions] = await Promise.all([
    prisma.country.findMany({
      where: { sessionId },
      orderBy: [{ isMajor: "desc" }, { economy: "desc" }],
    }),
    prisma.regionOwnership.findMany({
      where: { sessionId },
      select: { ownerCountryCode: true, baseValue: true },
    }),
  ]);

  const counts = new Map<string, { provinces: number; totalValue: number }>();
  for (const r of regions) {
    const entry = counts.get(r.ownerCountryCode) ?? {
      provinces: 0,
      totalValue: 0,
    };
    entry.provinces += 1;
    entry.totalValue += r.baseValue;
    counts.set(r.ownerCountryCode, entry);
  }

  return countries.map((c) => {
    const stats = counts.get(c.code) ?? { provinces: 0, totalValue: 0 };
    return {
      country_id: c.code,
      name: getCountryDisplayName(c.code, c.name, locale),
      leader: c.leader,
      ideology: c.ideology,
      economy: c.economy,
      military: c.military,
      stability_percent: c.stability,
      treasury: c.treasury,
      infamy: c.infamy,
      war_exhaustion: c.warExhaustion,
      nuclear_warheads: c.nuclearWarheads,
      capital_region_id: c.capitalRegionId,
      is_major: c.isMajor,
      province_count: stats.provinces,
      territory_strategic_value: stats.totalValue,
    };
  });
}

export async function readMapOwnershipResource(sessionId: string) {
  const regions = await prisma.regionOwnership.findMany({
    where: { sessionId },
    orderBy: { regionId: "asc" },
  });

  return regions.map((r) => ({
    region_id: r.regionId,
    region_name: r.regionName,
    country_id: r.ownerCountryCode,
    strategic_status: r.strategicStatus,
    base_value: r.baseValue,
    last_transferred_turn: r.lastTransferredTurn,
    transfer_reason: r.transferReason,
  }));
}

export async function readPendingOrdersResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const [session, orders, messages] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id: sessionId } }),
    prisma.pendingOrder.findMany({
      where: { sessionId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.diplomaticMessage.findMany({
      where: { sessionId, isFromPlayer: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  return {
    preferredLanguage: locale,
    sessionId,
    turnNumber: session.turnNumber,
    currentDate: session.currentDate,
    playerCountryCode: session.playerCountryCode,
    awaitingAiSimulation: session.awaitingAiSimulation,
    pendingOrders: orders.map((o) => ({
      id: o.id,
      country_id: o.countryCode,
      order_type: o.orderType,
      target_country_id: o.targetCountryCode,
      command: o.content,
      turn_number: o.turnNumber,
      created_at: o.createdAt.toISOString(),
    })),
    recentPlayerDiplomaticMessages: messages
      .filter((m) => m.turnNumber === session.turnNumber)
      .map((m) => ({
        from_country_id: m.fromCountryCode,
        to_country_id: m.toCountryCode,
        message: m.message,
        created_at: m.createdAt.toISOString(),
      })),
  };
}

export async function readChronicleHistoryResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const currentBadge = locale === "en" ? "CURRENT" : "GÜNCEL";
  const oldBadge = locale === "en" ? "ARCHIVE" : "ESKİ";
  const [snapshots, events, messages] = await Promise.all([
    prisma.turnSnapshot.findMany({
      where: { sessionId },
      select: { turnNumber: true, gameDate: true, summary: true },
      orderBy: { turnNumber: "desc" },
      take: 40,
    }),
    prisma.worldEvent.findMany({
      where: { sessionId },
      orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
      take: 60,
    }),
    prisma.diplomaticMessage.findMany({
      where: { sessionId },
      orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
  ]);

  const latestEventTurn =
    events.length > 0 ? Math.max(...events.map((e) => e.turnNumber)) : 1;
  const latestMessageTurn =
    messages.length > 0 ? Math.max(...messages.map((m) => m.turnNumber)) : 1;
  const latestSnapshotTurn =
    snapshots.length > 0 ? Math.max(...snapshots.map((s) => s.turnNumber)) : 1;

  return {
    preferredLanguage: locale,
    latestEventTurn,
    latestMessageTurn,
    turnSummaries: snapshots.map((s) => ({
      ...s,
      turn_status: s.turnNumber >= latestSnapshotTurn ? currentBadge : oldBadge,
    })),
    worldEvents: events.map((e) => ({
      turn: e.turnNumber,
      date: e.gameDate,
      turn_status: e.turnNumber >= latestEventTurn ? currentBadge : oldBadge,
      category: e.category,
      headline: e.headline,
      article_body: e.articleBody,
      involved_countries: safeJsonParse<string[]>(e.involvedCountries, []),
    })),
    diplomaticExchanges: messages.map((m) => ({
      turn: m.turnNumber,
      date: m.gameDate,
      turn_status: m.turnNumber >= latestMessageTurn ? currentBadge : oldBadge,
      from: m.fromCountryCode,
      to: m.toCountryCode,
      sender_title: m.senderTitle,
      message: m.message,
    })),
  };
}

// ============================================================
// MCP TOOLS & MUTATIONS (6 Spec Tools + Player Interactions)
// ============================================================

async function resolveCountryCode(
  sessionId: string,
  input: string
): Promise<string> {
  const normalized = input.trim().toUpperCase();
  const exact = await prisma.country.findUnique({
    where: { sessionId_code: { sessionId, code: normalized } },
  });
  if (exact) return exact.code;

  const all = await prisma.country.findMany({ where: { sessionId } });
  const byName = all.find(
    (c) =>
      c.name.toLowerCase() === input.trim().toLowerCase() ||
      c.code.toLowerCase() === input.trim().toLowerCase()
  );
  if (byName) return byName.code;
  throw new Error(`Ülke bulunamadı: ${input}`);
}

export async function toolTransferTerritory(params: {
  sessionId: string;
  region_ids: string[];
  new_owner_country_id: string;
  reason: string;
}) {
  const { sessionId, region_ids, new_owner_country_id, reason } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const ownerCode = await resolveCountryCode(sessionId, new_owner_country_id);
  const normalizedRegionIds = region_ids.map((id) => id.trim());

  const existingRegions = await prisma.regionOwnership.findMany({
    where: { sessionId, regionId: { in: normalizedRegionIds } },
  });

  if (existingRegions.length === 0) {
    throw new Error(
      `Belirtilen bölge ID'lerinden hiçbiri bulunamadı: ${normalizedRegionIds.join(", ")}`
    );
  }

  const isWartime =
    /işgal|occup|savaş|war|feth|conqu|saldır/i.test(reason);
  const nextStatus = isWartime ? "OCCUPIED" : "CORE";

  await prisma.regionOwnership.updateMany({
    where: { sessionId, regionId: { in: existingRegions.map((r) => r.regionId) } },
    data: {
      ownerCountryCode: ownerCode,
      strategicStatus: nextStatus,
      lastTransferredTurn: session.turnNumber,
      transferReason: reason,
    },
  });

  if (isWartime) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        globalTension: clamp(session.globalTension + existingRegions.length * 2, 0, 100),
      },
    });
    const owner = await prisma.country.findUnique({
      where: { sessionId_code: { sessionId, code: ownerCode } },
    });
    if (owner) {
      await prisma.country.update({
        where: { id: owner.id },
        data: { infamy: clamp(owner.infamy + existingRegions.length * 6, 0, 100) },
      });
    }
  }

  const updated = await prisma.regionOwnership.findMany({
    where: { sessionId, regionId: { in: existingRegions.map((r) => r.regionId) } },
  });

  // Resolve any active sieges targeting captured provinces cleanly
  if (existingRegions.length > 0) {
    await prisma.warOperation.updateMany({
      where: {
        sessionId,
        targetRegionId: { in: existingRegions.map((r) => r.regionId) },
        attackerCode: ownerCode,
        status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
      },
      data: {
        status: "CAPTURED",
        progress: 100,
      },
    });
  }

  emitSessionEvent(sessionId, "territory_transferred", {
    regionIds: updated.map((r) => r.regionId),
    newOwnerCountryCode: ownerCode,
    reason,
    strategicStatus: nextStatus,
    turnNumber: session.turnNumber,
  });

  // Spawn visual wartime blitz operation toward the first transferred province if wartime conquest
  if (isWartime && existingRegions[0]) {
    const prevOwner = existingRegions[0].ownerCountryCode;
    if (prevOwner && prevOwner !== ownerCode) {
      const blitz = await launchWarOperation({
        sessionId,
        attackerCode: ownerCode,
        defenderCode: prevOwner,
        targetRegionId: existingRegions[0].regionId,
        operationType: "TANK_BLITZ",
        unitType: "ARMOR",
        intensity: 85,
        title: `${ownerCode} → ${existingRegions[0].regionName}`,
        description: reason,
        autoDeclareWar: false,
        skipAiWake: true,
      }).catch(() => null);
      if (blitz) {
        await prisma.warOperation.update({
          where: { id: blitz.id },
          data: { status: "CAPTURED", progress: 100 },
        }).catch(() => undefined);
      }
    }
  }

  return {
    transferredCount: updated.length,
    newOwnerCountryCode: ownerCode,
    regions: updated.map((r) => ({
      region_id: r.regionId,
      region_name: r.regionName,
      strategic_status: r.strategicStatus,
    })),
    missingRegionIds: normalizedRegionIds.filter(
      (id) => !existingRegions.some((r) => r.regionId === id)
    ),
  };
}

export async function toolUpdateCountryStats(params: {
  sessionId: string;
  country_id: string;
  economy_delta: number;
  military_delta: number;
  stability_delta: number;
  infamy_delta?: number;
  war_exhaustion_delta?: number;
  nuclear_warheads_delta?: number;
  new_ideology?: string;
}) {
  const {
    sessionId,
    country_id,
    economy_delta,
    military_delta,
    stability_delta,
    infamy_delta = 0,
    war_exhaustion_delta = 0,
    nuclear_warheads_delta = 0,
    new_ideology,
  } = params;

  const code = await resolveCountryCode(sessionId, country_id);
  const current = await prisma.country.findUniqueOrThrow({
    where: { sessionId_code: { sessionId, code } },
  });

  const nextEconomy = clamp(current.economy + economy_delta, 0, 100);
  const nextMilitary = clamp(current.military + military_delta, 0, 100);
  const nextStability = clamp(current.stability + stability_delta, 0, 100);
  const nextInfamy = clamp(current.infamy + infamy_delta, 0, 100);
  const nextWarExhaustion = clamp(
    current.warExhaustion + war_exhaustion_delta,
    0,
    100
  );
  const nextNuclearWarheads = Math.max(
    0,
    (current.nuclearWarheads ?? 0) + Math.round(nuclear_warheads_delta)
  );
  const nextTreasury = Math.max(
    0,
    current.treasury + Math.round(economy_delta * 35)
  );

  const updated = await prisma.country.update({
    where: { id: current.id },
    data: {
      economy: nextEconomy,
      military: nextMilitary,
      stability: nextStability,
      infamy: nextInfamy,
      warExhaustion: nextWarExhaustion,
      nuclearWarheads: nextNuclearWarheads,
      treasury: nextTreasury,
      ideology: new_ideology?.trim() ? new_ideology.trim() : current.ideology,
    },
  });

  emitSessionEvent(sessionId, "stats_updated", {
    country: updated,
    deltas: {
      economy_delta,
      military_delta,
      stability_delta,
      infamy_delta,
      war_exhaustion_delta,
      nuclear_warheads_delta,
    },
  });

  return updated;
}

export async function toolManageDiplomacy(params: {
  sessionId: string;
  country_a: string;
  country_b: string;
  relation_status: DiplomacyStatus;
  treaty_name?: string;
}) {
  const { sessionId, country_a, country_b, relation_status, treaty_name } =
    params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const codeA = await resolveCountryCode(sessionId, country_a);
  const codeB = await resolveCountryCode(sessionId, country_b);
  if (codeA === codeB) {
    throw new Error("Bir ülke kendisiyle diplomatik ilişki kuramaz.");
  }

  const [a, b] = sortCountryPair(codeA, codeB);
  const existing = await prisma.diplomacyRelation.findUnique({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
  });

  const relationTension =
    relation_status === "WAR"
      ? 100
      : relation_status === "EMBARGO"
        ? 65
        : relation_status === "ALLIANCE"
          ? 8
          : relation_status === "NON_AGGRESSION"
            ? 14
            : 22;

  const relation = await prisma.diplomacyRelation.upsert({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
    update: {
      status: relation_status,
      tension: relationTension,
      treatyName: treaty_name?.trim() || null,
      updatedTurn: session.turnNumber,
    },
    create: {
      sessionId,
      countryA: a,
      countryB: b,
      status: relation_status,
      tension: relationTension,
      treatyName: treaty_name?.trim() || null,
      updatedTurn: session.turnNumber,
    },
  });

  let tensionDelta = 0;
  if (relation_status === "WAR" && existing?.status !== "WAR") tensionDelta = 8;
  else if (relation_status === "EMBARGO") tensionDelta = 3;
  else if (
    (relation_status === "ALLIANCE" || relation_status === "NON_AGGRESSION") &&
    existing?.status === "WAR"
  ) {
    tensionDelta = -7;
  }

  if (tensionDelta !== 0) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { globalTension: clamp(session.globalTension + tensionDelta, 0, 100) },
    });
  }

  if (relation_status === "WAR" && existing?.status !== "WAR") {
    const attacker = await prisma.country.findUnique({
      where: { sessionId_code: { sessionId, code: codeA } },
    });
    if (attacker) {
      await prisma.country.update({
        where: { id: attacker.id },
        data: { infamy: clamp(attacker.infamy + 10, 0, 100) },
      });
    }
    // Auto-launch animated frontier offensive on war declaration
    await launchWarOperation({
      sessionId,
      attackerCode: codeA,
      defenderCode: codeB,
      operationType: "TANK_BLITZ",
      unitType: "ARMOR",
      intensity: 78,
      autoDeclareWar: false,
      skipAiWake: true,
    }).catch(() => undefined);
  } else if (
    (relation_status === "ALLIANCE" ||
      relation_status === "NON_AGGRESSION" ||
      relation_status === "NEUTRAL") &&
    existing?.status === "WAR"
  ) {
    // End active frontlines when peace treaty is signed
    await prisma.warOperation.updateMany({
      where: {
        sessionId,
        status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
        OR: [
          { attackerCode: codeA, defenderCode: codeB },
          { attackerCode: codeB, defenderCode: codeA },
        ],
      },
      data: { status: "REPELLED" },
    });
  }

  emitSessionEvent(sessionId, "diplomacy_updated", {
    relation,
    tensionDelta,
  });

  return relation;
}

export async function toolPublishWorldEvent(params: {
  sessionId: string;
  headline: string;
  article_body: string;
  category: EventCategory;
  involved_countries: string[];
}) {
  const { sessionId, headline, article_body, category, involved_countries } =
    params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const event = await prisma.worldEvent.create({
    data: {
      sessionId,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      headline: headline.trim(),
      articleBody: article_body.trim(),
      category,
      involvedCountries: JSON.stringify(
        involved_countries.map((c) => c.trim().toUpperCase())
      ),
    },
  });

  const formatted = {
    ...event,
    involvedCountries: safeJsonParse<string[]>(event.involvedCountries, []),
  };

  emitSessionEvent(sessionId, "event_published", { event: formatted });
  return formatted;
}

export async function toolSendDiplomaticMessage(params: {
  sessionId: string;
  from_country_id: string;
  to_country_id: string;
  sender_title: string;
  message: string;
  isFromPlayer?: boolean;
}) {
  const {
    sessionId,
    from_country_id,
    to_country_id,
    sender_title,
    message,
    isFromPlayer = false,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const fromCode = await resolveCountryCode(sessionId, from_country_id);
  const toCode = await resolveCountryCode(sessionId, to_country_id);

  const created = await prisma.diplomaticMessage.create({
    data: {
      sessionId,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      fromCountryCode: fromCode,
      toCountryCode: toCode,
      senderTitle: sender_title.trim(),
      message: message.trim(),
      isFromPlayer,
    },
  });

  if (!isFromPlayer) {
    const pendingChatCount = await prisma.leaderChatMessage.count({
      where: {
        sessionId,
        countryCode: fromCode,
        senderRole: "PLAYER",
        status: "PENDING_REPLY",
      },
    });
    if (pendingChatCount > 0) {
      await prisma.leaderChatMessage.updateMany({
        where: {
          sessionId,
          countryCode: fromCode,
          senderRole: "PLAYER",
          status: "PENDING_REPLY",
        },
        data: { status: "DELIVERED" },
      });
      const chatReply = await prisma.leaderChatMessage.create({
        data: {
          sessionId,
          countryCode: fromCode,
          playerCountryCode: session.playerCountryCode ?? toCode,
          senderRole: "LEADER",
          senderName: sender_title.trim(),
          content: message.trim(),
          status: "DELIVERED",
          turnNumber: session.turnNumber,
          gameDate: session.currentDate,
        },
      });
      emitSessionEvent(sessionId, "leader_chat_reply", {
        countryCode: fromCode,
        message: chatReply,
      });
    }
  }

  emitSessionEvent(sessionId, "message_sent", { message: created });
  return created;
}

export async function toolAdvanceTurn(params: {
  sessionId: string;
  new_date: string;
  turn_summary: string;
}) {
  const { sessionId, new_date, turn_summary } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { scenario: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const nextTurn = session.turnNumber + 1;
  const resolvedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(new_date.trim())
      ? new_date.trim()
      : advanceDateByInterval(
          session.currentDate,
          session.timeJumpInterval,
          session.scenario.turnIntervalMonths
        );

  // Passive treasury income + infamy decay / war exhaustion ticks
  const [countries, regions, wars] = await Promise.all([
    prisma.country.findMany({ where: { sessionId } }),
    prisma.regionOwnership.findMany({ where: { sessionId } }),
    prisma.diplomacyRelation.findMany({
      where: { sessionId, status: "WAR" },
    }),
  ]);

  const atWarCodes = new Set<string>();
  for (const w of wars) {
    atWarCodes.add(w.countryA);
    atWarCodes.add(w.countryB);
  }

  const valueByOwner = new Map<string, number>();
  for (const r of regions) {
    valueByOwner.set(
      r.ownerCountryCode,
      (valueByOwner.get(r.ownerCountryCode) ?? 0) + r.baseValue
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.pendingOrder.updateMany({
      where: { sessionId, status: "PENDING" },
      data: { status: "PROCESSED" },
    });

    for (const c of countries) {
      const landVal = valueByOwner.get(c.code) ?? 0;
      const income = Math.round(c.economy * 4 + landVal * 3);
      const isAtWar = atWarCodes.has(c.code);
      await tx.country.update({
        where: { id: c.id },
        data: {
          treasury: c.treasury + income,
          infamy: isAtWar ? c.infamy : clamp(c.infamy - 2, 0, 100),
          warExhaustion: clamp(
            c.warExhaustion + (isAtWar ? 4 : -6),
            0,
            100
          ),
        },
      });
    }

    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        turnNumber: nextTurn,
        currentDate: resolvedDate,
        awaitingAiSimulation: false,
      },
    });
  });

  const snapshotJson = await buildSnapshotJson(sessionId);
  await prisma.turnSnapshot.upsert({
    where: { sessionId_turnNumber: { sessionId, turnNumber: nextTurn } },
    update: {
      gameDate: resolvedDate,
      summary: turn_summary.trim(),
      stateJson: snapshotJson,
    },
    create: {
      sessionId,
      turnNumber: nextTurn,
      gameDate: resolvedDate,
      summary: turn_summary.trim(),
      stateJson: snapshotJson,
    },
  });

  emitSessionEvent(sessionId, "turn_advanced", {
    turnNumber: nextTurn,
    currentDate: resolvedDate,
    summary: turn_summary.trim(),
  });

  // Advance live battlefronts and evaluate autonomous geopolitical tensions
  await advanceLiveWarOperations({
    sessionId,
    tickTensions: true,
  }).catch(() => undefined);

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  return {
    turnNumber: nextTurn,
    currentDate: resolvedDate,
    summary: turn_summary.trim(),
    next_required_tool: "wait_for_player_action",
    instruction: t.advanceTurn,
  };
}

// ============================================================
// TURN ROLLBACK (Time Travel)
// ============================================================

export async function rollbackSessionToTurn(
  sessionId: string,
  targetTurnNumber: number
) {
  const snapshot = await prisma.turnSnapshot.findUnique({
    where: {
      sessionId_turnNumber: { sessionId, turnNumber: targetTurnNumber },
    },
  });
  if (!snapshot) {
    throw new Error(`Tur ${targetTurnNumber} için kayıtlı snapshot bulunamadı.`);
  }

  const parsed = safeJsonParse<SessionSnapshotPayload | null>(
    snapshot.stateJson,
    null
  );
  if (!parsed) {
    throw new Error("Snapshot JSON verisi bozuk.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.country.deleteMany({ where: { sessionId } });
    await tx.regionOwnership.deleteMany({ where: { sessionId } });
    await tx.diplomacyRelation.deleteMany({ where: { sessionId } });
    await tx.mapMarker.deleteMany({ where: { sessionId } });
    await tx.warOperation.deleteMany({ where: { sessionId } });
    await tx.pendingOrder.deleteMany({
      where: { sessionId, turnNumber: { gte: targetTurnNumber } },
    });
    await tx.worldEvent.deleteMany({
      where: { sessionId, turnNumber: { gt: targetTurnNumber } },
    });
    await tx.diplomaticMessage.deleteMany({
      where: { sessionId, turnNumber: { gt: targetTurnNumber } },
    });
    await tx.diplomacyCouncilMessage.deleteMany({
      where: { sessionId, turnNumber: { gt: targetTurnNumber } },
    });
    await tx.diplomacyCouncil.deleteMany({
      where: { sessionId, turnNumber: { gt: targetTurnNumber } },
    });
    await tx.turnSnapshot.deleteMany({
      where: { sessionId, turnNumber: { gt: targetTurnNumber } },
    });

    await tx.country.createMany({
      data: parsed.countries.map((c) => ({
        sessionId,
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
        nuclearWarheads: c.nuclearWarheads ?? 0,
        capitalRegionId: c.capitalRegionId,
        isMajor: c.isMajor,
        description: c.description,
      })),
    });

    await tx.regionOwnership.createMany({
      data: parsed.regions.map((r) => ({
        sessionId,
        ...r,
      })),
    });

    if (parsed.diplomacies.length > 0) {
      await tx.diplomacyRelation.createMany({
        data: parsed.diplomacies.map((d) => ({
          sessionId,
          ...d,
        })),
      });
    }

    if (parsed.mapMarkers && parsed.mapMarkers.length > 0) {
      await tx.mapMarker.createMany({
        data: parsed.mapMarkers.map((mk) => ({
          sessionId,
          ...mk,
        })),
      });
    }

    if (parsed.warOperations && parsed.warOperations.length > 0) {
      await tx.warOperation.createMany({
        data: parsed.warOperations.map((wo) => ({
          sessionId,
          ...wo,
        })),
      });
    }

    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        currentDate: parsed.currentDate,
        turnNumber: parsed.turnNumber,
        globalTension: parsed.globalTension,
        awaitingAiSimulation: false,
      },
    });
  });

  emitSessionEvent(sessionId, "session_rolled_back", {
    restoredTurn: targetTurnNumber,
    currentDate: parsed.currentDate,
  });

  return getFullSessionState(sessionId);
}

// ============================================================
// AI LEADER DIPLOMACY CHAT (1-ON-1 VIA MCP)
// ============================================================

export async function sendPlayerLeaderChat(params: {
  sessionId: string;
  targetCountryCode: string;
  content: string;
}) {
  const { sessionId, targetCountryCode, content } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  if (!session.playerCountryCode) {
    throw new Error("Liderlerle konuşmak için önce ülkenizi seçin.");
  }

  const targetCode = await resolveCountryCode(sessionId, targetCountryCode);
  const playerCountry = await prisma.country.findUnique({
    where: {
      sessionId_code: { sessionId, code: session.playerCountryCode },
    },
  });

  const created = await prisma.leaderChatMessage.create({
    data: {
      sessionId,
      countryCode: targetCode,
      playerCountryCode: session.playerCountryCode,
      senderRole: "PLAYER",
      senderName: playerCountry
        ? `${playerCountry.leader} (${playerCountry.name})`
        : session.playerCountryCode,
      content: content.trim(),
      status: "PENDING_REPLY",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  markBrowserSessionActive(sessionId);

  emitSessionEvent(sessionId, "leader_chat_updated", {
    countryCode: targetCode,
    message: created,
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  notifyPlayerAction(
    sessionId,
    "LEADER_CHAT",
    t.leaderChatTriggerSummary(targetCode, content.trim().slice(0, 120))
  );

  return created;
}

export async function readPendingLeaderChatsResource(sessionId: string) {
  await ensureSessionNuclearSeeded(sessionId);
  const locale = getActiveMcpLocale(sessionId);
  const t = getMcpToolInstructions(locale);
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      countries: true,
      diplomacies: true,
      leaderChats: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const countryMap = new Map(session.countries.map((c) => [c.code, c]));
  const playerCountry = session.playerCountryCode
    ? countryMap.get(session.playerCountryCode)
    : undefined;
  const byCountry = new Map<string, typeof session.leaderChats>();

  for (const msg of session.leaderChats) {
    const arr = byCountry.get(msg.countryCode) ?? [];
    arr.push(msg);
    byCountry.set(msg.countryCode, arr);
  }

  const threads = Array.from(byCountry.entries()).map(([code, msgs]) => {
    const country = countryMap.get(code);
    const hasPendingReply = msgs.some(
      (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
    );
    const relation = session.playerCountryCode
      ? session.diplomacies.find(
          (d) =>
            (d.countryA === session.playerCountryCode && d.countryB === code) ||
            (d.countryB === session.playerCountryCode && d.countryA === code)
        )
      : undefined;

    return {
      country_id: code,
      country_name: country
        ? getCountryDisplayName(code, country.name, locale)
        : code,
      leader_name: country?.leader ?? code,
      ideology: country?.ideology ?? t.unknownLabel,
      economy: country?.economy ?? 50,
      military: country?.military ?? 50,
      nuclear_warheads: country?.nuclearWarheads ?? 0,
      relation_with_player: relation?.status ?? "NEUTRAL",
      treaty_name: relation?.treatyName ?? null,
      treaty_nuclear_sharing_eligible:
        isTreatyEligibleForNuclearSharing(relation) &&
        (country?.nuclearWarheads ?? 0) > 1,
      awaiting_leader_reply: hasPendingReply,
      messages: msgs.slice(-15).map((m) => ({
        role: m.senderRole,
        sender: m.senderName,
        content: m.content,
        status: m.status,
        date: m.gameDate,
      })),
    };
  });

  return {
    preferredLanguage: locale,
    languageDirective: getMcpLanguageDirective(locale),
    sessionId,
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    playerCountryCode: session.playerCountryCode,
    playerNuclearWarheads: playerCountry?.nuclearWarheads ?? 0,
    pendingThreadsCount: threads.filter((t) => t.awaiting_leader_reply).length,
    threads,
  };
}

export async function toolReplyLeaderChat(params: {
  sessionId: string;
  target_country_id: string;
  leader_name?: string;
  reply_message: string;
  relation_status?: DiplomacyStatus;
  treaty_name?: string;
  transfer_nuclear_warheads?: number;
  nuclear_treaty_name?: string;
  nuclear_require_treaty?: boolean;
}) {
  const {
    sessionId,
    target_country_id,
    leader_name,
    reply_message,
    relation_status,
    treaty_name,
    transfer_nuclear_warheads,
    nuclear_treaty_name,
    nuclear_require_treaty = true,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const targetCode = await resolveCountryCode(sessionId, target_country_id);
  const country = await prisma.country.findUniqueOrThrow({
    where: { sessionId_code: { sessionId, code: targetCode } },
  });

  await prisma.leaderChatMessage.updateMany({
    where: {
      sessionId,
      countryCode: targetCode,
      senderRole: "PLAYER",
      status: "PENDING_REPLY",
    },
    data: { status: "DELIVERED" },
  });

  const created = await prisma.leaderChatMessage.create({
    data: {
      sessionId,
      countryCode: targetCode,
      playerCountryCode: session.playerCountryCode ?? "PLAYER",
      senderRole: "LEADER",
      senderName: leader_name?.trim() || `${country.leader} (${country.name})`,
      content: reply_message.trim(),
      status: "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  let updatedRelation = null;
  if (relation_status && session.playerCountryCode) {
    updatedRelation = await toolManageDiplomacy({
      sessionId,
      country_a: session.playerCountryCode,
      country_b: targetCode,
      relation_status,
      treaty_name,
    });
  }

  let nuclearTransfer = null;
  if (
    transfer_nuclear_warheads &&
    transfer_nuclear_warheads > 0 &&
    session.playerCountryCode
  ) {
    nuclearTransfer = await transferNuclearWarheads({
      sessionId,
      fromCode: targetCode,
      toCode: session.playerCountryCode,
      count: transfer_nuclear_warheads,
      treatyName: nuclear_treaty_name ?? treaty_name,
      requireTreaty: nuclear_require_treaty,
      skipAiWake: true,
    });
  }

  emitSessionEvent(sessionId, "leader_chat_reply", {
    countryCode: targetCode,
    message: created,
    updatedRelation,
    nuclearTransfer,
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  return {
    message: created,
    updatedRelation,
    nuclearTransfer,
    next_required_tool: "wait_for_player_action",
    instruction: t.replyLeaderChat,
  };
}

// ============================================================
// MULTI-NATION DIPLOMATIC COUNCILS & GROUP SUMMITS (MCP)
// ============================================================

export async function createPlayerCouncil(params: {
  sessionId: string;
  title: string;
  topic: string;
  councilType?: string;
  participantCountryCodes: string[];
  openingMessage: string;
}) {
  const {
    sessionId,
    title,
    topic,
    councilType = "SUMMIT",
    participantCountryCodes,
    openingMessage,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  if (!session.playerCountryCode) {
    throw new Error("Konsey toplamak için önce ülkenizi seçmelisiniz.");
  }

  const resolvedParticipants = new Set<string>([session.playerCountryCode]);
  for (const raw of participantCountryCodes) {
    const code = await resolveCountryCode(sessionId, raw);
    resolvedParticipants.add(code);
  }

  if (resolvedParticipants.size < 2) {
    throw new Error("Bir konsey için en az 1 yabancı ülke seçmelisiniz.");
  }

  const playerCountry = await prisma.country.findUnique({
    where: {
      sessionId_code: { sessionId, code: session.playerCountryCode },
    },
  });

  const council = await prisma.diplomacyCouncil.create({
    data: {
      sessionId,
      title: title.trim(),
      topic: topic.trim(),
      councilType,
      initiatorCode: session.playerCountryCode,
      participantCodes: JSON.stringify(Array.from(resolvedParticipants)),
      status: "OPEN",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      messages: {
        create: {
          sessionId,
          senderCode: session.playerCountryCode,
          senderName: playerCountry
            ? `${playerCountry.leader} (${playerCountry.name})`
            : session.playerCountryCode,
          senderRole: "PLAYER",
          content: openingMessage.trim(),
          stance: "NEUTRAL",
          status: "PENDING_REPLY",
          turnNumber: session.turnNumber,
          gameDate: session.currentDate,
        },
      },
    },
    include: { messages: true },
  });

  markBrowserSessionActive(sessionId);

  emitSessionEvent(sessionId, "council_updated", {
    council: {
      ...council,
      participantCodes: Array.from(resolvedParticipants),
    },
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  notifyPlayerAction(
    sessionId,
    "COUNCIL_ACTION",
    t.councilCreateTriggerSummary(
      title.trim(),
      topic.trim(),
      Array.from(resolvedParticipants).join(", ")
    )
  );

  return council;
}

export async function postPlayerCouncilMessage(params: {
  sessionId: string;
  councilId: string;
  content: string;
}) {
  const { sessionId, councilId, content } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  if (!session.playerCountryCode) {
    throw new Error("Önce ülkenizi seçmelisiniz.");
  }

  const council = await prisma.diplomacyCouncil.findUnique({
    where: { id: councilId },
  });
  if (!council || council.sessionId !== sessionId) {
    throw new Error("Konsey odası bulunamadı.");
  }

  const playerCountry = await prisma.country.findUnique({
    where: {
      sessionId_code: { sessionId, code: session.playerCountryCode },
    },
  });

  const msg = await prisma.diplomacyCouncilMessage.create({
    data: {
      councilId,
      sessionId,
      senderCode: session.playerCountryCode,
      senderName: playerCountry
        ? `${playerCountry.leader} (${playerCountry.name})`
        : session.playerCountryCode,
      senderRole: "PLAYER",
      content: content.trim(),
      stance: "NEUTRAL",
      status: "PENDING_REPLY",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  await prisma.diplomacyCouncil.update({
    where: { id: councilId },
    data: { updatedAt: new Date() },
  });

  markBrowserSessionActive(sessionId);

  emitSessionEvent(sessionId, "council_updated", { councilId, message: msg });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  notifyPlayerAction(
    sessionId,
    "COUNCIL_ACTION",
    t.councilMsgTriggerSummary(council.title, content.trim().slice(0, 120))
  );

  return msg;
}

export async function readDiplomaticCouncilsResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const [session, councils] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { countries: true, diplomacies: true },
    }),
    prisma.diplomacyCouncil.findMany({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const countryMap = new Map(session.countries.map((c) => [c.code, c]));

  return {
    preferredLanguage: locale,
    languageDirective: getMcpLanguageDirective(locale),
    sessionId,
    difficulty: session.difficulty,
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    playerCountryCode: session.playerCountryCode,
    councils: councils.map((c) => {
      const codes = safeJsonParse<string[]>(c.participantCodes, []);
      const awaitingReply = c.messages.some(
        (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
      );
      return {
        council_id: c.id,
        title: c.title,
        topic: c.topic,
        council_type: c.councilType,
        status: c.status,
        initiator_country_id: c.initiatorCode,
        awaiting_council_debate: awaitingReply,
        participants: codes.map((code) => {
          const co = countryMap.get(code);
          return {
            country_id: code,
            country_name: co
              ? getCountryDisplayName(code, co.name, locale)
              : code,
            leader: co?.leader ?? code,
            ideology: co?.ideology ?? "",
            infamy: co?.infamy ?? 0,
          };
        }),
        messages: c.messages.slice(-20).map((m) => ({
          sender_code: m.senderCode,
          sender_name: m.senderName,
          role: m.senderRole,
          stance: m.stance,
          status: m.status,
          content: m.content,
          date: m.gameDate,
        })),
      };
    }),
  };
}

export async function toolConveneDiplomaticCouncil(params: {
  sessionId: string;
  title: string;
  topic: string;
  council_type: "COUNCIL" | "COALITION" | "SUMMIT" | "PROTEST";
  initiator_country_id: string;
  participant_country_ids: string[];
  opening_statements: Array<{
    country_id: string;
    message: string;
    stance?: "SUPPORTIVE" | "CRITICAL" | "THREATENING" | "NEUTRAL" | "MEDIATOR";
  }>;
}) {
  const {
    sessionId,
    title,
    topic,
    council_type,
    initiator_country_id,
    participant_country_ids,
    opening_statements,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { countries: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const countryMap = new Map(session.countries.map((c) => [c.code, c]));
  const initCode = await resolveCountryCode(sessionId, initiator_country_id);

  const participantSet = new Set<string>([initCode]);
  if (session.playerCountryCode) participantSet.add(session.playerCountryCode);
  for (const p of participant_country_ids) {
    participantSet.add(await resolveCountryCode(sessionId, p));
  }
  for (const st of opening_statements) {
    participantSet.add(await resolveCountryCode(sessionId, st.country_id));
  }

  const council = await prisma.diplomacyCouncil.create({
    data: {
      sessionId,
      title: title.trim(),
      topic: topic.trim(),
      councilType: council_type,
      initiatorCode: initCode,
      participantCodes: JSON.stringify(Array.from(participantSet)),
      status: "OPEN",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  const createdMsgs = [];
  for (const st of opening_statements) {
    const code = await resolveCountryCode(sessionId, st.country_id);
    const co = countryMap.get(code);
    const created = await prisma.diplomacyCouncilMessage.create({
      data: {
        councilId: council.id,
        sessionId,
        senderCode: code,
        senderName: co ? `${co.leader} (${co.name})` : code,
        senderRole: "AI_LEADER",
        content: st.message.trim(),
        stance: st.stance ?? "CRITICAL",
        status: "DELIVERED",
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
      },
    });
    createdMsgs.push(created);
  }

  emitSessionEvent(sessionId, "council_updated", {
    council: {
      ...council,
      participantCodes: Array.from(participantSet),
      messages: createdMsgs,
    },
    isNewCouncil: true,
  });

  return {
    councilId: council.id,
    title: council.title,
    participants: Array.from(participantSet),
    statementsCount: createdMsgs.length,
  };
}

export async function toolReplyDiplomaticCouncil(params: {
  sessionId: string;
  council_id: string;
  responses: Array<{
    country_id: string;
    leader_name?: string;
    message: string;
    stance?: "SUPPORTIVE" | "CRITICAL" | "THREATENING" | "NEUTRAL" | "MEDIATOR";
  }>;
  council_status?: "OPEN" | "RESOLVED" | "COLLAPSED";
}) {
  const { sessionId, council_id, responses, council_status } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { countries: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const council = await prisma.diplomacyCouncil.findUnique({
    where: { id: council_id },
  });
  if (!council || council.sessionId !== sessionId) {
    throw new Error(`Konsey bulunamadı: ${council_id}`);
  }

  const countryMap = new Map(session.countries.map((c) => [c.code, c]));
  const participantSet = new Set(
    safeJsonParse<string[]>(council.participantCodes, [])
  );

  await prisma.diplomacyCouncilMessage.updateMany({
    where: {
      councilId: council_id,
      senderRole: "PLAYER",
      status: "PENDING_REPLY",
    },
    data: { status: "DELIVERED" },
  });

  const createdMsgs = [];
  for (const r of responses) {
    const code = await resolveCountryCode(sessionId, r.country_id);
    participantSet.add(code);
    const co = countryMap.get(code);
    const created = await prisma.diplomacyCouncilMessage.create({
      data: {
        councilId: council_id,
        sessionId,
        senderCode: code,
        senderName:
          r.leader_name?.trim() || (co ? `${co.leader} (${co.name})` : code),
        senderRole: "AI_LEADER",
        content: r.message.trim(),
        stance: r.stance ?? "NEUTRAL",
        status: "DELIVERED",
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
      },
    });
    createdMsgs.push(created);
  }

  await prisma.diplomacyCouncil.update({
    where: { id: council_id },
    data: {
      participantCodes: JSON.stringify(Array.from(participantSet)),
      ...(council_status ? { status: council_status } : {}),
    },
  });

  emitSessionEvent(sessionId, "council_updated", {
    councilId: council_id,
    messages: createdMsgs,
    councilStatus: council_status ?? council.status,
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  return {
    councilId: council_id,
    repliesAdded: createdMsgs.length,
    status: council_status ?? council.status,
    next_required_tool: "wait_for_player_action",
    instruction: t.replyCouncil,
  };
}

// ============================================================
// MAP LANDMARKS, FACILITIES & ANIMATED EVENT BEACONS (MCP)
// ============================================================

export async function readMapMarkersResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const [session, markers] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id: sessionId } }),
    prisma.mapMarker.findMany({
      where: { sessionId },
      orderBy: [{ turnNumber: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  return {
    preferredLanguage: locale,
    sessionId,
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    totalMarkers: markers.length,
    markers: markers.map((m) => ({
      marker_id: m.id,
      country_id: m.countryCode,
      region_id: m.regionId,
      city_name: m.cityName,
      title: m.title,
      description: m.description,
      category: m.category,
      status: m.status,
      level: m.level,
      lat: m.lat,
      lng: m.lng,
      turn_number: m.turnNumber,
      game_date: m.gameDate,
      is_animated: m.isAnimated,
    })),
  };
}

export async function toolManageMapMarkers(params: {
  sessionId: string;
  action: "CREATE" | "UPDATE" | "REMOVE";
  marker_id?: string;
  country_id?: string;
  region_id?: string;
  city_name?: string;
  title?: string;
  description?: string;
  category?:
    | "INDUSTRY"
    | "MILITARY"
    | "INFRASTRUCTURE"
    | "NAVAL"
    | "RESEARCH"
    | "DIPLOMACY"
    | "INTERNAL"
    | "CRISIS";
  status?: "ACTIVE" | "UNDER_CONSTRUCTION" | "DAMAGED" | "ALERT" | "COMPLETED";
  level?: number;
  lat?: number;
  lng?: number;
  is_animated?: boolean;
}) {
  const {
    sessionId,
    action,
    marker_id,
    country_id,
    region_id,
    city_name,
    title,
    description,
    category = "INDUSTRY",
    status = "ACTIVE",
    level = 1,
    lat,
    lng,
    is_animated = true,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { countries: true, mapMarkers: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const findTargetMarker = async () => {
    if (marker_id?.trim()) {
      const byId = session.mapMarkers.find((m) => m.id === marker_id.trim());
      if (byId) return byId;
    }
    const targetCode = country_id
      ? await resolveCountryCode(sessionId, country_id).catch(() => null)
      : null;
    const normTitle = title?.trim().toLowerCase();
    return (
      session.mapMarkers.find((m) => {
        if (targetCode && m.countryCode !== targetCode) return false;
        if (normTitle && m.title.toLowerCase().includes(normTitle)) return true;
        if (city_name && m.cityName?.toLowerCase() === city_name.trim().toLowerCase()) {
          return true;
        }
        return false;
      }) ?? null
    );
  };

  if (action === "REMOVE") {
    const existing = await findTargetMarker();
    if (!existing) {
      throw new Error(
        `Silinecek harita işareti bulunamadı (${marker_id ?? title ?? city_name ?? "?"}).`
      );
    }
    await prisma.mapMarker.delete({ where: { id: existing.id } });
    emitSessionEvent(sessionId, "map_marker_updated", {
      action: "REMOVED",
      markerId: existing.id,
      title: existing.title,
      cityName: existing.cityName,
    });
    return {
      action: "REMOVED",
      markerId: existing.id,
      title: existing.title,
      cityName: existing.cityName,
    };
  }

  if (action === "UPDATE") {
    const existing = await findTargetMarker();
    if (!existing) {
      throw new Error(
        `Güncellenecek harita işareti bulunamadı (${marker_id ?? title ?? city_name ?? "?"}).`
      );
    }

    let nextCountryCode = existing.countryCode;
    if (country_id?.trim()) {
      nextCountryCode = await resolveCountryCode(sessionId, country_id);
    }
    const nextOwner = session.countries.find((c) => c.code === nextCountryCode);

    const locationChanged =
      lat !== undefined ||
      lng !== undefined ||
      (city_name !== undefined && city_name.trim() !== (existing.cityName ?? "")) ||
      (region_id !== undefined && region_id.trim() !== (existing.regionId ?? ""));

    const coords = locationChanged
      ? resolveMarkerCoordinates({
          lat,
          lng,
          cityName: city_name ?? existing.cityName,
          regionId: region_id ?? existing.regionId,
          fallbackRegionId: nextOwner?.capitalRegionId,
          existingCoords: session.mapMarkers
            .filter((m) => m.id !== existing.id)
            .map((m) => ({ lat: m.lat, lng: m.lng })),
        })
      : {
          lat: existing.lat,
          lng: existing.lng,
          resolvedRegionId: existing.regionId,
          resolvedCityName: existing.cityName,
        };

    const updated = await prisma.mapMarker.update({
      where: { id: existing.id },
      data: {
        countryCode: nextCountryCode,
        regionId: coords.resolvedRegionId,
        cityName: coords.resolvedCityName,
        title: title?.trim() || existing.title,
        description: description?.trim() || existing.description,
        category: category || existing.category,
        status: status || existing.status,
        level: level !== undefined ? clamp(level, 1, 5) : existing.level,
        lat: coords.lat,
        lng: coords.lng,
        isAnimated: is_animated ?? existing.isAnimated,
      },
    });

    emitSessionEvent(sessionId, "map_marker_updated", {
      action: "UPDATED",
      marker: updated,
      isNew: status === "ALERT" || status === "UNDER_CONSTRUCTION",
    });

    return {
      action: "UPDATED",
      marker: updated,
    };
  }

  // action === "CREATE"
  const resolvedCode = country_id?.trim()
    ? await resolveCountryCode(sessionId, country_id)
    : session.playerCountryCode ?? session.countries[0]?.code ?? "TUR";
  const owner = session.countries.find((c) => c.code === resolvedCode);

  const coords = resolveMarkerCoordinates({
    lat,
    lng,
    cityName: city_name,
    regionId: region_id,
    fallbackRegionId: owner?.capitalRegionId,
    existingCoords: session.mapMarkers.map((m) => ({
      lat: m.lat,
      lng: m.lng,
    })),
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  const created = await prisma.mapMarker.create({
    data: {
      sessionId,
      countryCode: resolvedCode,
      regionId: coords.resolvedRegionId,
      cityName: coords.resolvedCityName,
      title:
        title?.trim() ||
        t.defaultFacilityTitle(coords.resolvedCityName || resolvedCode),
      description:
        description?.trim() ||
        t.defaultFacilityDesc(coords.resolvedCityName || resolvedCode),
      category,
      status,
      level: clamp(level, 1, 5),
      lat: coords.lat,
      lng: coords.lng,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      isAnimated: is_animated,
    },
  });

  emitSessionEvent(sessionId, "map_marker_updated", {
    action: "CREATED",
    marker: created,
    isNew: true,
  });

  return {
    action: "CREATED",
    marker: created,
  };
}

// ============================================================
// LIVE AI ADVISOR & STRATEGY BRAINSTORMING CHAT (MCP)
// ============================================================

export interface AdvisorSuggestedOrderInput {
  title: string;
  category?:
    | "COMMAND"
    | "ECONOMY"
    | "MILITARY"
    | "DIPLOMACY"
    | "COVERT"
    | "INTERNAL"
    | "NOTE_TO_AI"
    | string;
  command: string;
}

export async function sendPlayerAdvisorChat(params: {
  sessionId: string;
  content: string;
}) {
  const { sessionId, content } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  if (!session.playerCountryCode) {
    throw new Error("Danışman AI ile görüşmek için önce ülkenizi seçin.");
  }

  const playerCountry = await prisma.country.findUnique({
    where: {
      sessionId_code: { sessionId, code: session.playerCountryCode },
    },
  });

  const created = await prisma.advisorChatMessage.create({
    data: {
      sessionId,
      senderRole: "PLAYER",
      senderName: playerCountry
        ? `${playerCountry.leader} (${playerCountry.name})`
        : session.playerCountryCode,
      content: content.trim(),
      status: "PENDING_REPLY",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  markBrowserSessionActive(sessionId);

  const formatted = {
    ...created,
    suggestedOrders: [],
  };

  emitSessionEvent(sessionId, "advisor_chat_updated", {
    message: formatted,
  });

  const t = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  notifyPlayerAction(
    sessionId,
    "ADVISOR_CHAT",
    t.advisorChatTriggerSummary(content.trim().slice(0, 120))
  );

  return formatted;
}

export async function readAdvisorChatResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const [session, messages] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { countries: true },
    }),
    prisma.advisorChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 60,
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const playerCountry = session.playerCountryCode
    ? session.countries.find((c) => c.code === session.playerCountryCode)
    : undefined;

  const awaitingReply = messages.some(
    (m) => m.senderRole === "PLAYER" && m.status === "PENDING_REPLY"
  );

  return {
    preferredLanguage: locale,
    languageDirective: getMcpLanguageDirective(locale),
    sessionId,
    difficulty: session.difficulty,
    currentDate: session.currentDate,
    turnNumber: session.turnNumber,
    playerCountryCode: session.playerCountryCode,
    playerCountryName:
      playerCountry && session.playerCountryCode
        ? getCountryDisplayName(
            session.playerCountryCode,
            playerCountry.name,
            locale
          )
        : session.playerCountryCode,
    awaiting_advisor_reply: awaitingReply,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.senderRole,
      sender: m.senderName,
      content: m.content,
      suggested_orders: m.suggestedOrdersJson
        ? safeJsonParse<AdvisorSuggestedOrderInput[]>(m.suggestedOrdersJson, [])
        : [],
      status: m.status,
      date: m.gameDate,
      turn: m.turnNumber,
    })),
  };
}

export async function toolReplyAdvisorChat(params: {
  sessionId: string;
  reply_message: string;
  suggested_orders?: AdvisorSuggestedOrderInput[];
  advisor_title?: string;
}) {
  const t = getMcpToolInstructions(getActiveMcpLocale(params.sessionId));
  const {
    sessionId,
    reply_message,
    suggested_orders = [],
    advisor_title = t.defaultAdvisorTitle,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  await prisma.advisorChatMessage.updateMany({
    where: {
      sessionId,
      senderRole: "PLAYER",
      status: "PENDING_REPLY",
    },
    data: { status: "DELIVERED" },
  });

  const created = await prisma.advisorChatMessage.create({
    data: {
      sessionId,
      senderRole: "AI_ADVISOR",
      senderName: advisor_title.trim(),
      content: reply_message.trim(),
      suggestedOrdersJson:
        suggested_orders.length > 0 ? JSON.stringify(suggested_orders) : null,
      status: "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  const formatted = {
    ...created,
    suggestedOrders: suggested_orders,
  };

  emitSessionEvent(sessionId, "advisor_chat_reply", {
    message: formatted,
  });

  return {
    message: formatted,
    next_required_tool: "wait_for_player_action",
    instruction: t.replyAdvisorChat,
  };
}

// ============================================================
// BLOCKING MCP WAIT LOOP (WAIT FOR PLAYER BUTTON CLICK)
// ============================================================

export async function getPendingActionSnapshot(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const [
    worldState,
    pendingOrders,
    leaderChats,
    councils,
    mapMarkers,
    advisorChat,
  ] = await Promise.all([
    readWorldStateResource(sessionId),
    readPendingOrdersResource(sessionId),
    readPendingLeaderChatsResource(sessionId),
    readDiplomaticCouncilsResource(sessionId),
    readMapMarkersResource(sessionId),
    readAdvisorChatResource(sessionId),
  ]);

  const pendingChatThreads = leaderChats.threads.filter(
    (t) => t.awaiting_leader_reply
  );
  const pendingCouncils = councils.councils.filter(
    (c) => c.awaiting_council_debate
  );
  const pendingAdvisorMessages = advisorChat.messages.filter(
    (m) => m.role === "PLAYER" && m.status === "PENDING_REPLY"
  );
  const awaitingTurn = Boolean(worldState.awaitingAiSimulation);

  const hasAnyAction =
    awaitingTurn ||
    pendingChatThreads.length > 0 ||
    pendingCouncils.length > 0 ||
    pendingAdvisorMessages.length > 0;

  return {
    preferredLanguage: locale,
    languageDirective: getMcpLanguageDirective(locale),
    hasAnyAction,
    awaitingTurn,
    sessionId,
    worldState,
    pendingOrders: pendingOrders.pendingOrders,
    pendingLeaderChats: pendingChatThreads,
    pendingCouncils,
    pendingAdvisorMessages,
    existingMapMarkers: mapMarkers.markers,
  };
}

export async function toolWaitForPlayerAction(params: {
  sessionId: string;
  timeout_seconds?: number;
  accept_any_session?: boolean;
  client_name?: string;
  signal?: AbortSignal;
  onTick?: (elapsedSec: number) => void;
}) {
  const {
    sessionId,
    timeout_seconds = 0,
    accept_any_session = true,
    client_name = "MCP AI Game Master",
    signal,
    onTick,
  } = params;

  const immediate = await getPendingActionSnapshot(sessionId);
  if (immediate.hasAnyAction) {
    const tImmediate = getMcpToolInstructions(getActiveMcpLocale(sessionId));
    return {
      ok: true,
      triggered: true,
      status: "IMMEDIATE_ACTION_READY",
      trigger: {
        sessionId,
        triggerType: immediate.awaitingTurn
          ? "TURN_COMPLETED"
          : immediate.pendingAdvisorMessages.length > 0
            ? "ADVISOR_CHAT"
            : immediate.pendingLeaderChats.length > 0
              ? "LEADER_CHAT"
              : "COUNCIL_ACTION",
        summary: tImmediate.waitImmediateSummary,
        timestamp: new Date().toISOString(),
      },
      ...immediate,
      next_required_tool: "wait_for_player_action",
      instruction: tImmediate.waitImmediateInstruction,
    };
  }

  const timeoutMs =
    timeout_seconds && timeout_seconds > 0
      ? clamp(Math.round(timeout_seconds), 1, 86400) * 1000
      : 0;

  const trigger = await waitForPlayerActionEvent({
    sessionId,
    clientName: client_name,
    timeoutMs,
    acceptAnySession: accept_any_session,
    signal,
    onTick,
  });

  if (trigger) {
    const activeSnapshot = await getPendingActionSnapshot(trigger.sessionId);
    const tReceived = getMcpToolInstructions(
      getActiveMcpLocale(trigger.sessionId)
    );
    return {
      ok: true,
      triggered: true,
      status: "PLAYER_ACTION_RECEIVED",
      trigger,
      ...activeSnapshot,
      next_required_tool: "wait_for_player_action",
      instruction: tReceived.waitReceivedInstruction,
    };
  }

  const tContinue = getMcpToolInstructions(getActiveMcpLocale(sessionId));
  return {
    ok: true,
    triggered: false,
    status: signal?.aborted ? "WAIT_ABORTED" : "HEARTBEAT_CONTINUE_WAITING",
    preferredLanguage: getActiveMcpLocale(sessionId),
    sessionId,
    next_required_tool: "wait_for_player_action",
    instruction: tContinue.waitContinueInstruction,
  };
}

