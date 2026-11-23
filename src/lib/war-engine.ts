import { prisma } from "@/lib/prisma";
import { getCountryDisplayName, type AppLocale } from "@/lib/i18n";
import { getRegionMetaMap } from "@/lib/geo-regions";
import { resolveMarkerCoordinates } from "@/lib/geo-cities";
import {
  emitSessionEvent,
  getActiveMcpLocale,
  markBrowserSessionActive,
  notifyPlayerAction,
} from "@/lib/realtime";
import { clamp, safeJsonParse, sortCountryPair } from "@/lib/utils";
import type { WarRiskSummary } from "@/lib/client-types";
import {
  evaluatePeaceCouncilReadiness,
  getCountryBlocsAndPacts,
  getWarDifficultyProfile,
} from "@/lib/geopolitics";
import {
  evaluateTreatyNuclearTransferAcceptance,
  findNuclearPartners,
  isNuclearEraDate,
  isTreatyEligibleForNuclearSharing,
} from "@/lib/nuclear-doctrine";

export type WarOperationType =
  | "SIEGE"
  | "ASSAULT"
  | "TANK_BLITZ"
  | "AIR_STRIKE"
  | "NAVAL_INVASION"
  | "NUCLEAR_STRIKE"
  | "REBEL_UPRISING"
  | "ENVOY_AGITATION";

export type WarUnitType =
  | "INFANTRY"
  | "ARMOR"
  | "AIR"
  | "NAVAL"
  | "MISSILE"
  | "ENVOY";

function isCovertOrRebelOp(opType: string): boolean {
  return opType === "ENVOY_AGITATION" || opType === "REBEL_UPRISING";
}

export type ProvocationType =
  | "BORDER_SKIRMISH"
  | "DIPLOMATIC_INSULT"
  | "SPONSOR_REBELS"
  | "INCITE_THIRD_PARTY_WAR"
  | "DECLARE_WAR";

interface CountryLike {
  code: string;
  name: string;
  flagEmoji: string;
  leader: string;
  ideology: string;
  economy: number;
  military: number;
  stability: number;
  treasury: number;
  infamy: number;
  warExhaustion: number;
  nuclearWarheads: number;
  capitalRegionId: string | null;
  isMajor: boolean;
}

interface DiplomacyLike {
  countryA: string;
  countryB: string;
  status: string;
  tension?: number;
  treatyName: string | null;
}

/** Compute wrapped spherical degree distance between two lon/lat centroids. */
function approxDegDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const rawDLng = Math.abs(lng1 - lng2);
  const dLng = rawDLng > 180 ? 360 - rawDLng : rawDLng;
  const dLat = Math.abs(lat1 - lat2);
  return Math.hypot(dLat, dLng);
}

/** Check whether two ideologies strongly collide in Grand Strategy geopolitics. */
function areIdeologiesClashing(ideoA: string, ideoB: string): boolean {
  const norm = (s: string) => {
    const low = s.toLowerCase();
    if (/democra|lib|cumhur|parlam|constit/.test(low)) return "DEMOCRACY";
    if (/comm|social|soviet|marks|halk|people/.test(low)) return "COMMUNIST";
    if (/fasc|nazi|milliyet|imper|autho|junta|dicta|dikt|despot|fascist/.test(low))
      return "AUTHORITARIAN";
    if (/monar|sultan|kral|kingdom|emperor|imparator|osman|habsburg/.test(low))
      return "MONARCHY";
    if (/theoc|islam|din|halife|papal/.test(low)) return "THEOCRACY";
    return "NEUTRAL";
  };
  const a = norm(ideoA);
  const b = norm(ideoB);
  if (a === "NEUTRAL" || b === "NEUTRAL" || a === b) return false;
  if (
    (a === "DEMOCRACY" && (b === "AUTHORITARIAN" || b === "COMMUNIST")) ||
    (b === "DEMOCRACY" && (a === "AUTHORITARIAN" || a === "COMMUNIST")) ||
    (a === "COMMUNIST" && b === "AUTHORITARIAN") ||
    (b === "COMMUNIST" && a === "AUTHORITARIAN")
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve nearest attacking province and target enemy province coordinates
 * using the 270-province centroid metadata atlas.
 */
export async function resolveBattleCoordinates(params: {
  sessionId: string;
  attackerCode: string;
  defenderCode: string;
  targetRegionId?: string;
}): Promise<{
  fromRegionId: string | null;
  fromLat: number;
  fromLng: number;
  targetRegionId: string;
  targetRegionName: string;
  targetLat: number;
  targetLng: number;
  distanceDeg: number;
}> {
  const { sessionId, attackerCode, defenderCode, targetRegionId } = params;
  const regionMap = getRegionMetaMap();

  const [regions, attackerCountry, defenderCountry] = await Promise.all([
    prisma.regionOwnership.findMany({
      where: {
        sessionId,
        ownerCountryCode: { in: [attackerCode, defenderCode] },
      },
    }),
    prisma.country.findUnique({
      where: { sessionId_code: { sessionId, code: attackerCode } },
    }),
    prisma.country.findUnique({
      where: { sessionId_code: { sessionId, code: defenderCode } },
    }),
  ]);

  const attackerRegions = regions.filter(
    (r) => r.ownerCountryCode === attackerCode
  );
  const defenderRegions = regions.filter(
    (r) => r.ownerCountryCode === defenderCode
  );

  // Determine target region
  let chosenTarget =
    (targetRegionId
      ? regions.find((r) => r.regionId === targetRegionId)
      : undefined) ?? null;

  if (!chosenTarget && defenderRegions.length > 0) {
    // Pick defender frontier province closest to any attacker province (prefer non-capital first)
    let bestScore = Infinity;
    for (const dReg of defenderRegions) {
      const dMeta = regionMap.get(dReg.regionId);
      if (!dMeta) continue;
      let minDist = Infinity;
      for (const aReg of attackerRegions) {
        const aMeta = regionMap.get(aReg.regionId);
        if (!aMeta) continue;
        const dist = approxDegDistance(
          aMeta.centroidLat,
          aMeta.centroidLon,
          dMeta.centroidLat,
          dMeta.centroidLon
        );
        if (dist < minDist) minDist = dist;
      }
      const capitalPenalty =
        dReg.regionId === defenderCountry?.capitalRegionId &&
        defenderRegions.length > 1
          ? 6
          : 0;
      const score = minDist + capitalPenalty;
      if (score < bestScore) {
        bestScore = score;
        chosenTarget = dReg;
      }
    }
  }

  const targetMeta = chosenTarget
    ? regionMap.get(chosenTarget.regionId)
    : defenderCountry?.capitalRegionId
      ? regionMap.get(defenderCountry.capitalRegionId)
      : undefined;

  const targetCoords = targetMeta
    ? { lat: targetMeta.centroidLat, lng: targetMeta.centroidLon }
    : resolveMarkerCoordinates({
        regionId: chosenTarget?.regionId ?? defenderCountry?.capitalRegionId,
        cityName: chosenTarget?.regionName ?? defenderCountry?.name,
        fallbackRegionId: defenderCountry?.capitalRegionId,
      });

  // Pick nearest attacker launch province
  let chosenFromId: string | null = attackerCountry?.capitalRegionId ?? null;
  let fromLat = 39.9;
  let fromLng = 32.8;
  let bestOriginDist = Infinity;

  for (const aReg of attackerRegions) {
    const aMeta = regionMap.get(aReg.regionId);
    if (!aMeta) continue;
    const dist = approxDegDistance(
      aMeta.centroidLat,
      aMeta.centroidLon,
      targetCoords.lat,
      targetCoords.lng
    );
    if (dist < bestOriginDist) {
      bestOriginDist = dist;
      chosenFromId = aReg.regionId;
      fromLat = aMeta.centroidLat;
      fromLng = aMeta.centroidLon;
    }
  }

  if (bestOriginDist === Infinity) {
    const fallbackOrigin = resolveMarkerCoordinates({
      regionId: attackerCountry?.capitalRegionId,
      cityName: attackerCountry?.name,
      fallbackRegionId: attackerCountry?.capitalRegionId,
    });
    fromLat = fallbackOrigin.lat;
    fromLng = fallbackOrigin.lng;
    chosenFromId = fallbackOrigin.resolvedRegionId;
    bestOriginDist = approxDegDistance(
      fromLat,
      fromLng,
      targetCoords.lat,
      targetCoords.lng
    );
  }

  return {
    fromRegionId: chosenFromId,
    fromLat,
    fromLng,
    targetRegionId:
      chosenTarget?.regionId ??
      targetMeta?.regionId ??
      defenderCountry?.capitalRegionId ??
      `${defenderCode}_CAP`,
    targetRegionName:
      chosenTarget?.regionName ??
      targetMeta?.regionName ??
      defenderCountry?.name ??
      defenderCode,
    targetLat: targetCoords.lat,
    targetLng: targetCoords.lng,
    distanceDeg: Number.isFinite(bestOriginDist) ? bestOriginDist : 10,
  };
}

/** Calculate bilateral war outbreak probability (0-100%) and causal factors. */
export function computeBilateralWarRisk(params: {
  countryA: CountryLike;
  countryB: CountryLike;
  relation: DiplomacyLike | null;
  globalTension: number;
  borderAdjacent: boolean;
  locale: AppLocale;
}): WarRiskSummary {
  const { countryA, countryB, relation, globalTension, borderAdjacent, locale } =
    params;
  const isTr = locale === "tr";
  const status = relation?.status ?? "NEUTRAL";

  const clash = areIdeologiesClashing(countryA.ideology, countryB.ideology);
  const defaultTension =
    status === "WAR"
      ? 100
      : status === "EMBARGO"
        ? 62
        : status === "ALLIANCE"
          ? 8
          : status === "NON_AGGRESSION"
            ? 14
            : status === "VASSAL"
              ? 18
              : clash
                ? 36
                : 18;

  const tension = relation?.tension ?? defaultTension;
  const factors: string[] = [];

  if (status === "WAR") {
    factors.push(isTr ? "Aktif Topyekûn Savaş" : "Active Open War");
    return {
      countryA: countryA.code,
      countryB: countryB.code,
      probability: 100,
      tension: 100,
      status,
      riskLevel: "AT_WAR",
      borderAdjacent,
      factors,
    };
  }

  let score = tension * 0.58;
  factors.push(
    isTr
      ? `İkili Gerilim (%${tension})`
      : `Bilateral Tension (${tension}%)`
  );

  if (borderAdjacent && status !== "ALLIANCE") {
    score += 12;
    factors.push(isTr ? "Sınır Sürtünmesi (+12%)" : "Border Friction (+12%)");
  }

  const maxInfamy = Math.max(countryA.infamy ?? 0, countryB.infamy ?? 0);
  if (maxInfamy >= 10) {
    const infamyBoost = Math.round(maxInfamy * 0.25);
    score += infamyBoost;
    factors.push(
      isTr
        ? `Yüksek Agresiflik (+${infamyBoost}%)`
        : `High Infamy (+${infamyBoost}%)`
    );
  }

  if (globalTension >= 30) {
    const globBoost = Math.round((globalTension - 20) * 0.2);
    score += globBoost;
    factors.push(
      isTr
        ? `Küresel Kriz Havası (+${globBoost}%)`
        : `Global Tension (+${globBoost}%)`
    );
  }

  if (status === "EMBARGO") {
    score += 16;
    factors.push(isTr ? "Ticari Ambargo (+16%)" : "Trade Embargo (+16%)");
  } else if (status === "NON_AGGRESSION") {
    score -= 22;
    factors.push(
      isTr ? "Saldırmazlık Paktı (-22%)" : "Non-Aggression Pact (-22%)"
    );
  } else if (status === "ALLIANCE") {
    score = tension > 82 ? score - 12 : Math.min(score - 35, 18);
    factors.push(isTr ? "İttifak Kalkanı (-35%)" : "Alliance Shield (-35%)");
  } else if (clash) {
    score += 8;
    factors.push(isTr ? "İdeolojik Rekabet (+8%)" : "Ideological Clash (+8%)");
  }

  const probability = clamp(Math.round(score), 1, 99);
  const riskLevel =
    probability >= 75
      ? "CRITICAL"
      : probability >= 52
        ? "HIGH"
        : probability >= 28
          ? "MODERATE"
          : "LOW";

  return {
    countryA: countryA.code,
    countryB: countryB.code,
    probability,
    tension: clamp(tension, 0, 100),
    status,
    riskLevel,
    borderAdjacent,
    factors,
  };
}

/** Check if two countries have nearby border provinces (<= 14 deg centroid distance). */
function checkBorderProximity(
  codesA: string[],
  codesB: string[],
  regionMap: ReturnType<typeof getRegionMetaMap>
): boolean {
  for (const rA of codesA) {
    const mA = regionMap.get(rA);
    if (!mA) continue;
    for (const rB of codesB) {
      const mB = regionMap.get(rB);
      if (!mB) continue;
      if (
        approxDegDistance(
          mA.centroidLat,
          mA.centroidLon,
          mB.centroidLat,
          mB.centroidLon
        ) <= 14
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Compute player-focused bilateral war risks and highest-risk global hotspots. */
export async function computeSessionWarRisks(
  sessionId: string,
  focusCountryCode?: string | null
) {
  const locale = getActiveMcpLocale(sessionId);
  const regionMap = getRegionMetaMap();

  const [session, countries, regions, diplomacies, warOps] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id: sessionId } }),
    prisma.country.findMany({ where: { sessionId } }),
    prisma.regionOwnership.findMany({
      where: { sessionId },
      select: { regionId: true, ownerCountryCode: true },
    }),
    prisma.diplomacyRelation.findMany({ where: { sessionId } }),
    prisma.warOperation.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "desc" }],
      take: 80,
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const activeFocus = focusCountryCode ?? session.playerCountryCode;
  const countryByCode = new Map(countries.map((c) => [c.code, c]));
  const regionsByOwner = new Map<string, string[]>();
  for (const r of regions) {
    const arr = regionsByOwner.get(r.ownerCountryCode) ?? [];
    arr.push(r.regionId);
    regionsByOwner.set(r.ownerCountryCode, arr);
  }

  const relationByPair = new Map<string, DiplomacyLike>();
  for (const d of diplomacies) {
    const [a, b] = sortCountryPair(d.countryA, d.countryB);
    relationByPair.set(`${a}::${b}`, d);
  }

  const playerRisks: Record<string, WarRiskSummary> = {};
  if (activeFocus && countryByCode.has(activeFocus)) {
    const focusCountry = countryByCode.get(activeFocus)!;
    const focusRegions = regionsByOwner.get(activeFocus) ?? [];

    for (const c of countries) {
      if (c.code === activeFocus) continue;
      const [a, b] = sortCountryPair(activeFocus, c.code);
      const rel = relationByPair.get(`${a}::${b}`) ?? null;
      const adjacent = checkBorderProximity(
        focusRegions,
        regionsByOwner.get(c.code) ?? [],
        regionMap
      );
      playerRisks[c.code] = computeBilateralWarRisk({
        countryA: focusCountry,
        countryB: c,
        relation: rel,
        globalTension: session.globalTension,
        borderAdjacent: adjacent,
        locale,
      });
    }
  }

  // Global hotspots: inspect explicit relations + top major powers + bordering rivals
  const seenHotspots = new Set<string>();
  const globalHotspots: WarRiskSummary[] = [];

  const evaluatePair = (code1: string, code2: string) => {
    if (code1 === code2) return;
    const [a, b] = sortCountryPair(code1, code2);
    const key = `${a}::${b}`;
    if (seenHotspots.has(key)) return;
    seenHotspots.add(key);

    const cA = countryByCode.get(a);
    const cB = countryByCode.get(b);
    if (!cA || !cB) return;

    const adjacent = checkBorderProximity(
      regionsByOwner.get(a) ?? [],
      regionsByOwner.get(b) ?? [],
      regionMap
    );
    const rel = relationByPair.get(key) ?? null;
    if (!rel && !adjacent && !(cA.isMajor && cB.isMajor)) return;

    const risk = computeBilateralWarRisk({
      countryA: cA,
      countryB: cB,
      relation: rel,
      globalTension: session.globalTension,
      borderAdjacent: adjacent,
      locale,
    });
    if (risk.probability >= 32 || risk.status === "WAR") {
      globalHotspots.push(risk);
    }
  };

  for (const d of diplomacies) {
    evaluatePair(d.countryA, d.countryB);
  }
  const majorCodes = countries
    .filter((c) => c.isMajor || c.infamy >= 15)
    .slice(0, 26)
    .map((c) => c.code);
  for (let i = 0; i < majorCodes.length; i++) {
    for (let j = i + 1; j < majorCodes.length; j++) {
      evaluatePair(majorCodes[i], majorCodes[j]);
    }
  }

  globalHotspots.sort((x, y) => y.probability - x.probability);

  const playerWarheads = activeFocus
    ? (countryByCode.get(activeFocus)?.nuclearWarheads ?? 0)
    : 0;
  const nuclearPartners = findNuclearPartners(
    activeFocus,
    countries,
    diplomacies
  );

  return {
    sessionId,
    globalTension: session.globalTension,
    activeWarsCount: diplomacies.filter((d) => d.status === "WAR").length,
    activeOperationsCount: warOps.filter((w) =>
      ["MARCHING", "BESIEGING", "ACTIVE"].includes(w.status)
    ).length,
    playerWarheads,
    nuclearEra: isNuclearEraDate(session.currentDate),
    nuclearPartners,
    playerRisks,
    globalHotspots: globalHotspots.slice(0, 30),
    warOperations: warOps.map((w) => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
  };
}

/** Upsert bilateral tension/status cleanly without duplicating Prisma boilerplate. */
export async function upsertDiplomacyTension(params: {
  sessionId: string;
  countryA: string;
  countryB: string;
  status?: string;
  tensionDelta?: number;
  exactTension?: number;
  treatyName?: string | null;
  turnNumber: number;
}) {
  const {
    sessionId,
    countryA,
    countryB,
    status,
    tensionDelta = 0,
    exactTension,
    treatyName,
    turnNumber,
  } = params;
  const [a, b] = sortCountryPair(countryA, countryB);
  const existing = await prisma.diplomacyRelation.findUnique({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
  });
  const baseTension = existing?.tension ?? 20;
  const nextTension =
    exactTension !== undefined
      ? clamp(exactTension, 0, 100)
      : clamp(baseTension + tensionDelta, 0, 100);
  const nextStatus = status ?? existing?.status ?? "NEUTRAL";

  const relation = await prisma.diplomacyRelation.upsert({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
    update: {
      status: nextStatus,
      tension: nextTension,
      ...(treatyName !== undefined ? { treatyName } : {}),
      updatedTurn: turnNumber,
    },
    create: {
      sessionId,
      countryA: a,
      countryB: b,
      status: nextStatus,
      tension: nextTension,
      treatyName: treatyName ?? null,
      updatedTurn: turnNumber,
    },
  });

  emitSessionEvent(sessionId, "diplomacy_updated", { relation });
  return { relation, previousStatus: existing?.status ?? "NEUTRAL" };
}

/** Drag defensive allies into a freshly declared war (1-hop mutual defense). */
async function triggerMutualDefenseAllies(params: {
  sessionId: string;
  attackerCode: string;
  defenderCode: string;
  turnNumber: number;
  currentDate: string;
  locale: AppLocale;
}) {
  const { sessionId, attackerCode, defenderCode, turnNumber, currentDate, locale } =
    params;
  const isTr = locale === "tr";

  const alliances = await prisma.diplomacyRelation.findMany({
    where: {
      sessionId,
      status: "ALLIANCE",
      OR: [{ countryA: defenderCode }, { countryB: defenderCode }],
    },
  });

  const joinedAllies: string[] = [];
  for (const al of alliances) {
    const allyCode = al.countryA === defenderCode ? al.countryB : al.countryA;
    if (allyCode === attackerCode || allyCode === defenderCode) continue;

    // Check if ally is already allied to attacker (stays neutral)
    const [x, y] = sortCountryPair(allyCode, attackerCode);
    const atkRel = await prisma.diplomacyRelation.findUnique({
      where: { sessionId_countryA_countryB: { sessionId, countryA: x, countryB: y } },
    });
    if (atkRel?.status === "ALLIANCE" || atkRel?.status === "WAR") continue;

    await upsertDiplomacyTension({
      sessionId,
      countryA: allyCode,
      countryB: attackerCode,
      status: "WAR",
      exactTension: 95,
      treatyName: isTr
        ? `${defenderCode} Müdafaa İttifakı`
        : `${defenderCode} Mutual Defense Pact`,
      turnNumber,
    });
    joinedAllies.push(allyCode);
  }

  if (joinedAllies.length > 0) {
    const ev = await prisma.worldEvent.create({
      data: {
        sessionId,
        turnNumber,
        gameDate: currentDate,
        headline: isTr
          ? `İttifak Zinciri Devrede: ${joinedAllies.join(", ")} Savaşa Katıldı!`
          : `Alliance Chain Triggered: ${joinedAllies.join(", ")} Join the War!`,
        articleBody: isTr
          ? `${defenderCode} ile savunma antlaşması bulunan ${joinedAllies.join(", ")} devletleri, ${attackerCode} saldırısına karşı resmen seferberlik ve savaş ilan etti.`
          : `Mutual defense treaties with ${defenderCode} compelled ${joinedAllies.join(", ")} to declare war on ${attackerCode}.`,
        category: "WAR",
        involvedCountries: JSON.stringify([attackerCode, defenderCode, ...joinedAllies]),
      },
    });
    emitSessionEvent(sessionId, "event_published", {
      event: { ...ev, involvedCountries: [attackerCode, defenderCode, ...joinedAllies] },
    });
  }

  return joinedAllies;
}

/**
 * Create and launch a live animated military operation (Marching infantry,
 * Armored Tank Blitz, Siege, Air Strike, Naval Invasion, Rebel Uprising, or Nuke).
 */
export async function launchWarOperation(params: {
  sessionId: string;
  attackerCode: string;
  defenderCode: string;
  targetRegionId?: string;
  operationType?: WarOperationType;
  unitType?: WarUnitType;
  intensity?: number;
  title?: string;
  description?: string;
  autoDeclareWar?: boolean;
  skipAiWake?: boolean;
  isCounterAttack?: boolean;
}) {
  const {
    sessionId,
    attackerCode,
    defenderCode,
    targetRegionId,
    operationType = "TANK_BLITZ",
    unitType,
    intensity = 72,
    title,
    description,
    autoDeclareWar = true,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";

  if (attackerCode === defenderCode) {
    throw new Error(
      isTr
        ? "Bir ülke kendisine askeri harekat düzenleyemez."
        : "A nation cannot launch a military operation against itself."
    );
  }

  const [attacker, defender] = await Promise.all([
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: attackerCode } },
    }),
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: defenderCode } },
    }),
  ]);

  const coords = await resolveBattleCoordinates({
    sessionId,
    attackerCode,
    defenderCode,
    targetRegionId,
  });

  const resolvedUnit: WarUnitType =
    unitType ??
    (operationType === "NUCLEAR_STRIKE"
      ? "MISSILE"
      : operationType === "ENVOY_AGITATION"
        ? "ENVOY"
        : operationType === "AIR_STRIKE"
          ? "AIR"
          : operationType === "NAVAL_INVASION"
            ? "NAVAL"
            : operationType === "TANK_BLITZ"
              ? "ARMOR"
              : coords.distanceDeg > 24
                ? "NAVAL"
                : "INFANTRY");

  const isNuke = operationType === "NUCLEAR_STRIKE";

  if (isNuke && (attacker.nuclearWarheads ?? 0) <= 0) {
    const [allCountries, allDiplomacies] = await Promise.all([
      prisma.country.findMany({ where: { sessionId } }),
      prisma.diplomacyRelation.findMany({ where: { sessionId } }),
    ]);
    const atkDisp = getCountryDisplayName(attacker.code, attacker.name, locale);
    const eligiblePatrons = findNuclearPartners(
      attacker.code,
      allCountries,
      allDiplomacies
    ).filter((p) => p.eligible);

    if (eligiblePatrons.length > 0) {
      const patronNames = eligiblePatrons
        .slice(0, 3)
        .map(
          (p) =>
            `${getCountryDisplayName(p.code, p.name, locale)} (${p.treatyName ?? p.status}: ${p.warheads})`
        )
        .join(", ");
      throw new Error(
        isTr
          ? `${atkDisp} envanterinde nükleer başlık yok (0 başlık)! Antlaşmalı müttefikinizle (${patronNames}) lider sohbetinden görüşüp antlaşma kapsamında nükleer başlık desteği isteyebilirsiniz.`
          : `${atkDisp} has 0 nuclear warheads in its stockpile! Open Leader Chat with a treaty ally (${patronNames}) to negotiate nuclear sharing support.`
      );
    }

    throw new Error(
      isTr
        ? `${atkDisp} envanterinde nükleer başlık yok (0 başlık)! Nükleer güce sahip bir ülkeyle ittifak/savunma antlaşması imzalayıp liderinden nükleer destek isteyebilir veya Emir Konsolundan nükleer program başlatabilirsiniz.`
        : `${atkDisp} has 0 nuclear warheads! Sign a defense/nuclear sharing treaty with a nuclear power and ask their leader for warheads, or start a domestic nuclear program.`
    );
  }

  if (autoDeclareWar && !isCovertOrRebelOp(operationType)) {
    const { previousStatus } = await upsertDiplomacyTension({
      sessionId,
      countryA: attackerCode,
      countryB: defenderCode,
      status: "WAR",
      exactTension: 100,
      treatyName: isTr ? "Aktif Cephe Savaşı" : "Active Open War",
      turnNumber: session.turnNumber,
    });

    if (previousStatus !== "WAR") {
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { globalTension: clamp(session.globalTension + (isNuke ? 22 : 9), 0, 100) },
      });
      await prisma.country.update({
        where: { id: attacker.id },
        data: { infamy: clamp(attacker.infamy + (isNuke ? 28 : 10), 0, 100) },
      });
      await triggerMutualDefenseAllies({
        sessionId,
        attackerCode,
        defenderCode,
        turnNumber: session.turnNumber,
        currentDate: session.currentDate,
        locale,
      });
    }
  }

  const atkName = getCountryDisplayName(attacker.code, attacker.name, locale);
  const defName = getCountryDisplayName(defender.code, defender.name, locale);

  const defaultTitle = isNuke
    ? isTr
      ? `NÜKLEER SALDIRI: ${coords.targetRegionName}`
      : `NUCLEAR STRIKE: ${coords.targetRegionName}`
    : operationType === "ENVOY_AGITATION"
      ? isTr
        ? `Gizli Elçi Sızması — ${coords.targetRegionName}`
        : `Covert Envoy Agitation — ${coords.targetRegionName}`
      : operationType === "REBEL_UPRISING"
        ? isTr
          ? `Halk Ayaklanması — ${coords.targetRegionName}`
          : `Popular Uprising — ${coords.targetRegionName}`
        : isTr
          ? `${atkName} Taarruzu — ${coords.targetRegionName}`
          : `${atkName} Offensive — ${coords.targetRegionName}`;

  const defaultDesc = isNuke
    ? isTr
      ? `${atkName}, ${defName} kontrolündeki ${coords.targetRegionName} bölgesine stratejik nükleer başlık fırlattı!`
      : `${atkName} launched a strategic nuclear warhead on ${coords.targetRegionName} (${defName})!`
    : operationType === "ENVOY_AGITATION"
      ? isTr
        ? `${atkName} gizli elçileri ${coords.targetRegionName} (${defName}) kentinde halkı kışkırtmak üzere sızma başlattı.`
        : `${atkName} covert envoys slipped into ${coords.targetRegionName} (${defName}) to agitate crowds and sow unrest.`
      : operationType === "REBEL_UPRISING"
        ? isTr
          ? `${coords.targetRegionName} (${defName}) sokaklarında kışkırtılan yerli halk ve milis güçleri ayaklandı!`
          : `Agitated local crowds and rebel militias rose up inside ${coords.targetRegionName} (${defName})!`
        : isTr
          ? `${atkName} birlikleri ${coords.targetRegionName} (${defName}) üzerine zırhlı/piyade kuşatması başlattı.`
          : `${atkName} forces launched an armored/infantry siege toward ${coords.targetRegionName} (${defName}).`;

  const created = await prisma.warOperation.create({
    data: {
      sessionId,
      operationType,
      unitType: resolvedUnit,
      attackerCode,
      defenderCode,
      fromRegionId: coords.fromRegionId,
      fromLat: coords.fromLat,
      fromLng: coords.fromLng,
      targetRegionId: coords.targetRegionId,
      targetRegionName: coords.targetRegionName,
      targetLat: coords.targetLat,
      targetLng: coords.targetLng,
      intensity: clamp(intensity, 10, 100),
      progress: isNuke ? 100 : 12,
      status: isNuke ? "DETONATED" : "MARCHING",
      title: title?.trim() || defaultTitle,
      description: description?.trim() || defaultDesc,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  if (isNuke) {
    const remainingWarheads = Math.max(0, (attacker.nuclearWarheads ?? 1) - 1);
    // Devastate defender stats, consume 1 warhead, & create permanent fallout marker
    await prisma.$transaction([
      prisma.country.update({
        where: { id: defender.id },
        data: {
          economy: clamp(defender.economy - 18, 5, 100),
          military: clamp(defender.military - 22, 5, 100),
          stability: clamp(defender.stability - 20, 5, 100),
          warExhaustion: clamp(defender.warExhaustion + 24, 0, 100),
        },
      }),
      prisma.country.update({
        where: { id: attacker.id },
        data: {
          nuclearWarheads: remainingWarheads,
          infamy: clamp(attacker.infamy + 26, 0, 100),
          warExhaustion: clamp(attacker.warExhaustion + 8, 0, 100),
        },
      }),
      prisma.regionOwnership.updateMany({
        where: { sessionId, regionId: coords.targetRegionId },
        data: {
          strategicStatus: "CONTESTED",
          transferReason: isTr
            ? `Nükleer saldırı (${attackerCode})`
            : `Nuclear strike (${attackerCode})`,
        },
      }),
    ]);

    const craterMarker = await prisma.mapMarker.create({
      data: {
        sessionId,
        countryCode: defenderCode,
        regionId: coords.targetRegionId,
        cityName: coords.targetRegionName,
        title: isTr
          ? `Nükleer Krater • ${coords.targetRegionName}`
          : `Nuclear Fallout • ${coords.targetRegionName}`,
        description: defaultDesc,
        category: "CRISIS",
        status: "ALERT",
        level: 5,
        lat: coords.targetLat,
        lng: coords.targetLng,
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
        isAnimated: true,
      },
    });

    const nukeEvent = await prisma.worldEvent.create({
      data: {
        sessionId,
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
        headline: isTr
          ? `FLAŞ: ${atkName}, ${coords.targetRegionName} Kentine Nükleer Füze Fırlattı!`
          : `BREAKING: ${atkName} Detonates Nuclear Warhead on ${coords.targetRegionName}!`,
        articleBody: isTr
          ? `${atkName} kuvvetlerinin fırlattığı termonükleer başlık ${coords.targetRegionName} (${defName}) semalarında infilak etti. Şok dalgası komşu eyaletlerde hissedildi; tüm dünyada acil kırmızı alarm ilan edildi.`
          : `A thermonuclear warhead fired by ${atkName} detonated over ${coords.targetRegionName} (${defName}), causing massive devastation and triggering a global DEFCON 1 alert.`,
        category: "CRISIS",
        involvedCountries: JSON.stringify([attackerCode, defenderCode]),
      },
    });

    emitSessionEvent(sessionId, "nuclear_strike", {
      operation: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      marker: craterMarker,
      remainingWarheads,
    });
    emitSessionEvent(sessionId, "map_marker_updated", {
      action: "CREATED",
      marker: craterMarker,
      isNew: true,
    });
    emitSessionEvent(sessionId, "event_published", {
      event: { ...nukeEvent, involvedCountries: [attackerCode, defenderCode] },
    });
    emitSessionEvent(sessionId, "stats_updated", { countryCode: attackerCode });
    emitSessionEvent(sessionId, "stats_updated", { countryCode: defenderCode });
  } else {
    const warEv = await prisma.worldEvent.create({
      data: {
        sessionId,
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
        headline: created.title,
        articleBody: created.description,
        category: "WAR",
        involvedCountries: JSON.stringify([attackerCode, defenderCode]),
      },
    });
    emitSessionEvent(sessionId, "event_published", {
      event: { ...warEv, involvedCountries: [attackerCode, defenderCode] },
    });
  }

  const serialized = {
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };

  emitSessionEvent(sessionId, "war_operation_started", {
    operation: serialized,
  });

  // Live Defender Counter-Attack: capable defending nations automatically mobilize a counter-offensive
  // toward the attacker's frontier instead of sitting passively!
  if (
    !isCovertOrRebelOp(operationType) &&
    !isNuke &&
    !params.isCounterAttack &&
    defender.military >= 28 &&
    defender.stability >= 22
  ) {
    const prof = getWarDifficultyProfile(session.difficulty);
    const [defProvs, atkProvs, existingCounter] = await Promise.all([
      prisma.regionOwnership.count({
        where: { sessionId, ownerCountryCode: defenderCode },
      }),
      prisma.regionOwnership.count({
        where: { sessionId, ownerCountryCode: attackerCode },
      }),
      prisma.warOperation.count({
        where: {
          sessionId,
          attackerCode: defenderCode,
          defenderCode: attackerCode,
          operationType: { notIn: ["ENVOY_AGITATION", "REBEL_UPRISING"] },
          status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
        },
      }),
    ]);

    const shouldCounter =
      defProvs > 0 &&
      atkProvs > 0 &&
      existingCounter === 0 &&
      defender.military >= attacker.military * 0.45 &&
      (prof.counterAttackChance >= 1.0 ||
        Math.random() < prof.counterAttackChance);

    if (shouldCounter) {
      const counterOpType: WarOperationType =
        defender.military >= 60 ? "TANK_BLITZ" : "ASSAULT";
      await launchWarOperation({
        sessionId,
        attackerCode: defenderCode,
        defenderCode: attackerCode,
        targetRegionId: coords.fromRegionId || undefined,
        operationType: counterOpType,
        intensity: clamp(Math.round(defender.military * 0.88), 42, 86),
        title: isTr
          ? `${defName} Karşı Taarruzu — ${atkName} Cephesi`
          : `${defName} Counter-Offensive — ${atkName} Front`,
        description: isTr
          ? `${defName} ordusu savunmada kalmayıp ${atkName} sınır hattına karşı taarruz başlattı!`
          : `${defName} forces launched a live counter-offensive against ${atkName}'s frontier!`,
        autoDeclareWar: false,
        skipAiWake: true,
        isCounterAttack: true,
      }).catch(() => null);
    }
  }

  if (!params.skipAiWake) {
    markBrowserSessionActive(sessionId);
    notifyPlayerAction(
      sessionId,
      "WAR_ACTION",
      isTr
        ? `${created.title} (${attackerCode} -> ${defenderCode} @ ${coords.targetRegionName})`
        : `${created.title} (${attackerCode} -> ${defenderCode} @ ${coords.targetRegionName})`
    );
  }

  return serialized;
}

/** Create or escalate an animated unrest/rebellion beacon on a target city. */
async function upsertUnrestMapMarker(params: {
  sessionId: string;
  defenderCode: string;
  regionId: string;
  cityName: string;
  lat: number;
  lng: number;
  turnNumber: number;
  gameDate: string;
  isUprising: boolean;
  isTr: boolean;
}) {
  const {
    sessionId,
    defenderCode,
    regionId,
    cityName,
    lat,
    lng,
    turnNumber,
    gameDate,
    isUprising,
    isTr,
  } = params;

  const existing = await prisma.mapMarker.findFirst({
    where: { sessionId, regionId, category: "CRISIS" },
    orderBy: { updatedAt: "desc" },
  });

  const nextLevel = existing
    ? clamp(isUprising ? Math.max(4, existing.level + 1) : existing.level + 1, 1, 5)
    : isUprising
      ? 4
      : 2;

  const title = isUprising
    ? isTr
      ? `Halk Ayaklanması • ${cityName}`
      : `Popular Uprising • ${cityName}`
    : isTr
      ? `Gizli Elçi Kışkırtması (Sv.${nextLevel}) • ${cityName}`
      : `Covert Envoy Unrest (Lv.${nextLevel}) • ${cityName}`;

  const description = isUprising
    ? isTr
      ? `Sokak barikatları kuruldu ve yerel halk yönetime karşı iç isyan başlattı.`
      : `Street barricades and civil revolt erupted against local authorities.`
    : isTr
      ? `Sızan gizli elçiler halk arasında huzursuzluk ve grev dalgası körüklüyor.`
      : `Clandestine envoys are distributing leaflets and stoking public unrest.`;

  if (existing) {
    const updated = await prisma.mapMarker.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        status: "ALERT",
        level: nextLevel,
        isAnimated: true,
        turnNumber,
        gameDate,
      },
    });
    emitSessionEvent(sessionId, "map_marker_updated", {
      action: "UPDATED",
      marker: updated,
    });
    return updated;
  }

  const created = await prisma.mapMarker.create({
    data: {
      sessionId,
      countryCode: defenderCode,
      regionId,
      cityName,
      title,
      description,
      category: "CRISIS",
      status: "ALERT",
      level: nextLevel,
      lat,
      lng,
      turnNumber,
      gameDate,
      isAnimated: true,
    },
  });
  emitSessionEvent(sessionId, "map_marker_updated", {
    action: "CREATED",
    marker: created,
  });
  return created;
}

/** Advance marching/besieging operations forward one live tactical tick. */
export async function advanceLiveWarOperations(params: {
  sessionId: string;
  operationId?: string;
  tickTensions?: boolean;
}) {
  const { sessionId, operationId, tickTensions = false } = params;
  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";

  const [session, countries, regions, ops] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id: sessionId } }),
    prisma.country.findMany({ where: { sessionId } }),
    prisma.regionOwnership.findMany({ where: { sessionId } }),
    prisma.warOperation.findMany({
      where: {
        sessionId,
        ...(operationId ? { id: operationId } : {}),
        status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  const prof = getWarDifficultyProfile(session.difficulty);

  const countryMap = new Map(countries.map((c) => [c.code, c]));
  const updatedOps = [];
  const capturedRegions: Array<{ regionId: string; attacker: string; defender: string }> = [];

  for (const op of ops) {
    const attacker = countryMap.get(op.attackerCode);
    const defender = countryMap.get(op.defenderCode);
    const atkMil = attacker?.military ?? 50;
    const defMil = defender?.military ?? 50;
    const defStab = defender?.stability ?? 60;
    const milAdvantage = clamp((atkMil - defMil) / 6, -8, 14);
    const isEnvoyOp = op.operationType === "ENVOY_AGITATION";
    const isRebelOp = op.operationType === "REBEL_UPRISING";
    const isCovert = isCovertOrRebelOp(op.operationType);
    const isPlayerAttacker = op.attackerCode === session.playerCountryCode;

    let nextStatus = op.status;
    let nextProgress = op.progress;
    const rawAtkLoss = Math.round(120 + Math.random() * 240 + defMil * 2.5);
    const atkStepLoss = isEnvoyOp
      ? Math.round(1 + Math.random() * 2)
      : isRebelOp
        ? 0
        : isPlayerAttacker
          ? Math.round(rawAtkLoss * prof.aiDefenseLossMultiplier)
          : rawAtkLoss;
    const defStepLoss = isEnvoyOp
      ? Math.round(4 + Math.random() * 10)
      : isRebelOp
        ? Math.round(90 + Math.random() * 170)
        : Math.round(140 + Math.random() * 260 + atkMil * 2.8);

    if (op.status === "MARCHING") {
      nextProgress = op.progress + (isEnvoyOp ? 22 : isRebelOp ? 24 : 26);
      if (nextProgress >= 36) {
        nextStatus = "BESIEGING";
      }
    } else if (isEnvoyOp) {
      const siegeStep = Math.round(20 + op.intensity * 0.14);
      nextProgress = clamp(op.progress + Math.max(9, siegeStep), 0, 100);
    } else if (isRebelOp) {
      const siegeStep = Math.round(
        18 +
          Math.max(0, (100 - defStab) * 0.22) -
          clamp((defMil - 50) / 8, 0, 6)
      );
      nextProgress = clamp(op.progress + Math.max(9, siegeStep), 0, 100);
    } else {
      // Real military siege: tug-of-war between Attacker Combat Power and Defender Garrison Power
      const targetRegForSiege = regions.find(
        (r) => r.regionId === op.targetRegionId
      );
      const regStatus = targetRegForSiege?.strategicStatus ?? "STANDARD";
      const fortBonus =
        regStatus === "FORTIFIED"
          ? 20
          : regStatus === "CAPITAL"
            ? 16
            : regStatus === "CORE"
              ? 12
              : regStatus === "CONTESTED"
                ? -16 // Destabilized/rebel-torn province loses garrison cohesion!
                : 8; // Intact homeland garrison defense

      // If defender is actively mounting a counter-offensive against attacker, front-line pressure resists siege
      const defenderHasActiveCounter = ops.some(
        (other) =>
          other.attackerCode === op.defenderCode &&
          other.defenderCode === op.attackerCode &&
          !isCovertOrRebelOp(other.operationType)
      );
      const counterPressureBonus = defenderHasActiveCounter ? 8 : 0;

      const atkExhaustPenalty = (attacker?.warExhaustion ?? 0) * 0.25;
      const defExhaustPenalty = (defender?.warExhaustion ?? 0) * 0.3;
      const defStabilityMod = clamp((defStab - 50) * 0.25, -12, 8);
      const defGarrisonMult = isPlayerAttacker
        ? prof.defenderGarrisonMultiplier
        : 1.0;

      const atkPower =
        atkMil +
        (op.intensity - 70) * 0.25 +
        (op.operationType === "AIR_STRIKE" ? 6 : 0) -
        atkExhaustPenalty;
      const defPower =
        defMil * defGarrisonMult +
        fortBonus +
        counterPressureBonus +
        defStabilityMod -
        defExhaustPenalty;
      const powerDelta = atkPower - defPower;

      let rawStep: number;
      if (powerDelta >= 12) {
        rawStep = Math.round(14 + Math.min(16, powerDelta * 0.55));
      } else if (powerDelta >= 0) {
        rawStep = Math.round(7 + powerDelta * 0.55);
      } else if (powerDelta >= -8) {
        rawStep = Math.round(powerDelta * 0.9 - 4);
      } else {
        rawStep = Math.round(clamp(powerDelta * 0.85, -24, -12));
      }

      const scaledStep =
        rawStep > 0 && isPlayerAttacker
          ? Math.max(5, Math.round(rawStep * prof.playerSiegeSpeedMultiplier))
          : rawStep;

      nextProgress = clamp(op.progress + scaledStep, 0, 100);
    }

    // Garrison Repulsion Check: if defender pushes siege progress down to <= 15%, the siege is broken & REPELLED!
    if (!isCovert && op.status !== "MARCHING" && nextProgress <= 15) {
      nextStatus = "REPELLED";
      nextProgress = 0;
      const atkName = getCountryDisplayName(
        op.attackerCode,
        attacker?.name ?? op.attackerCode,
        locale
      );
      const defName = getCountryDisplayName(
        op.defenderCode,
        defender?.name ?? op.defenderCode,
        locale
      );

      if (attacker) {
        const updatedAtk = await prisma.country.update({
          where: { id: attacker.id },
          data: {
            stability: clamp(attacker.stability - 4, 5, 100),
            military: clamp(attacker.military - 3, 5, 100),
            warExhaustion: clamp(attacker.warExhaustion + 7, 0, 100),
          },
        });
        countryMap.set(attacker.code, updatedAtk);
      }

      const repelEv = await prisma.worldEvent.create({
        data: {
          sessionId,
          turnNumber: session.turnNumber,
          gameDate: session.currentDate,
          headline: isTr
            ? `KUŞATMA PÜSKÜRTÜLDÜ: ${defName} Garnizonu ${op.targetRegionName} Önlerinde ${atkName} Ordusunu Bozguna Uğrattı!`
            : `SIEGE REPELLED: ${defName} Garrison Routed ${atkName} Forces at ${op.targetRegionName}!`,
          articleBody: isTr
            ? `${op.targetRegionName} savunma hattını kıramayan ${atkName} birlikleri ağır kayıplar vererek geri çekilmek zorunda kaldı; ${defName} garnizonu kuşatmayı yardı!`
            : `Unable to breach ${op.targetRegionName}'s defenses, ${atkName} forces suffered heavy losses and were driven back by ${defName}'s garrison!`,
          category: "WAR",
          involvedCountries: JSON.stringify([op.defenderCode, op.attackerCode]),
        },
      });
      emitSessionEvent(sessionId, "event_published", {
        event: {
          ...repelEv,
          involvedCountries: [op.defenderCode, op.attackerCode],
        },
      });
    } else if (nextProgress >= 100) {
      nextProgress = 100;
      const targetReg = regions.find((r) => r.regionId === op.targetRegionId);
      const atkName = getCountryDisplayName(
        op.attackerCode,
        attacker?.name ?? op.attackerCode,
        locale
      );
      const defName = getCountryDisplayName(
        op.defenderCode,
        defender?.name ?? op.defenderCode,
        locale
      );

      if (isEnvoyOp) {
        // Covert envoys NEVER capture territory — they erode stability & plant unrest
        nextStatus = "AGITATED";
        if (defender) {
          const updatedDef = await prisma.country.update({
            where: { id: defender.id },
            data: {
              stability: clamp(
                defender.stability - prof.envoyArrivalStabilityDrop,
                5,
                100
              ),
              economy: clamp(defender.economy - 4, 5, 100),
              warExhaustion: clamp(defender.warExhaustion + 6, 0, 100),
            },
          });
          countryMap.set(defender.code, updatedDef);
        }

        await upsertUnrestMapMarker({
          sessionId,
          defenderCode: op.defenderCode,
          regionId: op.targetRegionId,
          cityName: op.targetRegionName,
          lat: op.targetLat,
          lng: op.targetLng,
          turnNumber: session.turnNumber,
          gameDate: session.currentDate,
          isUprising: false,
          isTr,
        });

        const ev = await prisma.worldEvent.create({
          data: {
            sessionId,
            turnNumber: session.turnNumber,
            gameDate: session.currentDate,
            headline: isTr
              ? `${op.targetRegionName} Sokaklarında Gizli Elçi ve Bildiri Hareketliliği!`
              : `Clandestine Envoys Stir Crowds Inside ${op.targetRegionName}!`,
            articleBody: isTr
              ? `${defName} güvenlik birimleri ${op.targetRegionName} genelinde grev ve protesto çağrısı yayan yabancı elçi hücrelerini raporladı; iç istikrar sarsıldı.`
              : `Security reports from ${defName} confirm covert envoys incited strikes and anti-regime protests across ${op.targetRegionName}, shaking public stability.`,
            category: "CRISIS",
            involvedCountries: JSON.stringify([op.defenderCode]),
          },
        });
        emitSessionEvent(sessionId, "event_published", {
          event: { ...ev, involvedCountries: [op.defenderCode] },
        });
      } else if (isRebelOp) {
        // Popular uprising NEVER annexes territory into attackerCode — marks province CONTESTED & shakes regime
        nextStatus = "UPRISING";
        if (targetReg && targetReg.ownerCountryCode === op.defenderCode) {
          await prisma.regionOwnership.update({
            where: { id: targetReg.id },
            data: {
              strategicStatus: "CONTESTED",
              lastTransferredTurn: session.turnNumber,
              transferReason: isTr
                ? "Halk ayaklanması ve iç isyan"
                : "Popular uprising & civil unrest",
            },
          });
          targetReg.strategicStatus = "CONTESTED";
        }

        if (defender) {
          const updatedDef = await prisma.country.update({
            where: { id: defender.id },
            data: {
              stability: clamp(defender.stability - 14, 5, 100),
              military: clamp(defender.military - 16, 5, 100),
              economy: clamp(defender.economy - 10, 5, 100),
              warExhaustion: clamp(defender.warExhaustion + 16, 0, 100),
            },
          });
          countryMap.set(defender.code, updatedDef);
        }

        await upsertUnrestMapMarker({
          sessionId,
          defenderCode: op.defenderCode,
          regionId: op.targetRegionId,
          cityName: op.targetRegionName,
          lat: op.targetLat,
          lng: op.targetLng,
          turnNumber: session.turnNumber,
          gameDate: session.currentDate,
          isUprising: true,
          isTr,
        });

        const ev = await prisma.worldEvent.create({
          data: {
            sessionId,
            turnNumber: session.turnNumber,
            gameDate: session.currentDate,
            headline: isTr
              ? `HALK İSYANI PATLAK VERDİ: ${op.targetRegionName} (${defName}) Karıştı!`
              : `POPULAR UPRISING ERUPTS: ${op.targetRegionName} (${defName}) Gripped by Revolt!`,
            articleBody: isTr
              ? `Kışkırtılan kitleler ${op.targetRegionName} kentinde barikatlar kurup yerel garnizonla çatıştı. Toprak ${defName} sınırlarında kalsa da devlet otoritesi ve ordu ciddi darbe aldı!`
              : `Incited citizens erected barricades and clashed with garrison troops in ${op.targetRegionName}. While borders remain ${defName}, state authority and military readiness suffered heavy blows!`,
            category: "CRISIS",
            involvedCountries: JSON.stringify([op.defenderCode]),
          },
        });
        emitSessionEvent(sessionId, "event_published", {
          event: { ...ev, involvedCountries: [op.defenderCode] },
        });
      } else {
        // Real military siege/blitz/invasion captures province cleanly
        nextStatus = "CAPTURED";
        if (targetReg && targetReg.ownerCountryCode !== op.attackerCode) {
          await prisma.regionOwnership.update({
            where: { id: targetReg.id },
            data: {
              ownerCountryCode: op.attackerCode,
              strategicStatus: "OCCUPIED",
              lastTransferredTurn: session.turnNumber,
              transferReason: isTr
                ? `${op.attackerCode} kuşatma ile fethetti`
                : `Captured in siege by ${op.attackerCode}`,
            },
          });
          capturedRegions.push({
            regionId: targetReg.regionId,
            attacker: op.attackerCode,
            defender: op.defenderCode,
          });

          emitSessionEvent(sessionId, "territory_transferred", {
            regionIds: [targetReg.regionId],
            newOwnerCountryCode: op.attackerCode,
            reason: isTr ? "Kuşatma zaferi" : "Siege capture",
            strategicStatus: "OCCUPIED",
            turnNumber: session.turnNumber,
          });

          const capEv = await prisma.worldEvent.create({
            data: {
              sessionId,
              turnNumber: session.turnNumber,
              gameDate: session.currentDate,
              headline: isTr
                ? `${op.targetRegionName} Düştü! ${atkName} Birlikleri Şehre Girdi`
                : `${op.targetRegionName} Falls to ${atkName} Forces!`,
              articleBody: isTr
                ? `Yoğun kuşatma ve zırhlı taarruzun ardından ${defName} savunması yarıldı; ${op.targetRegionName} bölgesi ${atkName} kontrolüne geçti.`
                : `Following a sustained siege and armored assault, ${defName} defenses collapsed and ${op.targetRegionName} was captured by ${atkName}.`,
              category: "WAR",
              involvedCountries: JSON.stringify([op.attackerCode, op.defenderCode]),
            },
          });
          emitSessionEvent(sessionId, "event_published", {
            event: {
              ...capEv,
              involvedCountries: [op.attackerCode, op.defenderCode],
            },
          });
        }
      }
    }

    const saved = await prisma.warOperation.update({
      where: { id: op.id },
      data: {
        status: nextStatus,
        progress: nextProgress,
        attackerLosses: op.attackerLosses + atkStepLoss,
        defenderLosses: op.defenderLosses + defStepLoss,
      },
    });

    const serialized = {
      ...saved,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
    updatedOps.push(serialized);
    emitSessionEvent(sessionId, "war_operation_updated", { operation: serialized });

    // Chain next siege automatically onto adjacent enemy province ONLY for real conquests
    if (nextStatus === "CAPTURED" && !isCovert) {
      const remainingDefenderProvs = await prisma.regionOwnership.count({
        where: { sessionId, ownerCountryCode: op.defenderCode },
      });
      const existingActiveAgainstDef = await prisma.warOperation.count({
        where: {
          sessionId,
          attackerCode: op.attackerCode,
          defenderCode: op.defenderCode,
          status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
        },
      });
      if (remainingDefenderProvs > 0 && existingActiveAgainstDef === 0) {
        await launchWarOperation({
          sessionId,
          attackerCode: op.attackerCode,
          defenderCode: op.defenderCode,
          operationType: op.operationType as WarOperationType,
          intensity: Math.max(45, op.intensity - 6),
          autoDeclareWar: false,
          skipAiWake: true,
        });
      }
    }
  }

  // Optional geopolitical tension outbreak roll
  if (tickTensions) {
    const riskData = await computeSessionWarRisks(sessionId);
    const erupting = riskData.globalHotspots.filter(
      (h) => h.status !== "WAR" && h.probability >= 78
    );
    for (const pair of erupting.slice(0, 1)) {
      if (Math.random() * 100 < pair.probability * 0.55) {
        await launchWarOperation({
          sessionId,
          attackerCode: pair.countryA,
          defenderCode: pair.countryB,
          operationType: "TANK_BLITZ",
          intensity: 75,
          autoDeclareWar: true,
          skipAiWake: true,
        });
      }
    }
  }

  return {
    advancedCount: updatedOps.length,
    capturedCount: capturedRegions.length,
    capturedRegions,
    operations: updatedOps,
  };
}

/**
 * Execute geopolitical provocation, sabotage, third-party false flag meddling,
 * or full war declaration — shifting War Probability & spawning live battles.
 */
export async function provokeNationAction(params: {
  sessionId: string;
  actorCode: string;
  targetCode: string;
  instigateWithCode?: string;
  actionType: ProvocationType;
  targetRegionId?: string;
  customNote?: string;
}) {
  const {
    sessionId,
    actorCode,
    targetCode,
    instigateWithCode,
    actionType,
    targetRegionId,
    customNote,
  } = params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";

  const [actor, target] = await Promise.all([
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: actorCode } },
    }),
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: targetCode } },
    }),
  ]);

  const regionMap = getRegionMetaMap();

  if (actionType === "DECLARE_WAR") {
    const op = await launchWarOperation({
      sessionId,
      attackerCode: actorCode,
      defenderCode: targetCode,
      targetRegionId,
      operationType: "TANK_BLITZ",
      unitType: "ARMOR",
      intensity: 85,
      autoDeclareWar: true,
    });
    return {
      actionType,
      warErupted: true,
      newProbability: 100,
      newTension: 100,
      operation: op,
      summary: isTr
        ? `${actor.name}, ${target.name} üzerine resmen savaş ilan etti ve zırhlı taarruz başlattı!`
        : `${actor.name} declared open war on ${target.name} and launched an armored blitz!`,
    };
  }

  if (actionType === "INCITE_THIRD_PARTY_WAR") {
    const thirdCode = instigateWithCode;
    if (!thirdCode || thirdCode === targetCode || thirdCode === actorCode) {
      throw new Error(
        isTr
          ? "Üçüncü ülke kışkırtması için farklı bir 2. hedef ülke seçin."
          : "Select a distinct second nation for third-party war instigation."
      );
    }
    const thirdCountry = await prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: thirdCode } },
    });

    const prof = getWarDifficultyProfile(session.difficulty);
    const { relation } = await upsertDiplomacyTension({
      sessionId,
      countryA: targetCode,
      countryB: thirdCode,
      tensionDelta: prof.falseFlagTensionDelta,
      turnNumber: session.turnNumber,
    });

    await prisma.country.update({
      where: { id: actor.id },
      data: {
        treasury: Math.max(0, actor.treasury - prof.falseFlagCost),
        infamy: clamp(actor.infamy + 6, 0, 100),
      },
    });

    const [regB, regC] = await Promise.all([
      prisma.regionOwnership.findMany({
        where: { sessionId, ownerCountryCode: targetCode },
        select: { regionId: true },
      }),
      prisma.regionOwnership.findMany({
        where: { sessionId, ownerCountryCode: thirdCode },
        select: { regionId: true },
      }),
    ]);

    const risk = computeBilateralWarRisk({
      countryA: target,
      countryB: thirdCountry,
      relation,
      globalTension: session.globalTension,
      borderAdjacent: checkBorderProximity(
        regB.map((r) => r.regionId),
        regC.map((r) => r.regionId),
        regionMap
      ),
      locale,
    });

    const shouldIgnite =
      relation.status !== "WAR" &&
      (risk.probability >= prof.falseFlagWarThreshold ||
        Math.random() * 100 < risk.probability * 0.75);

    let spawnedOp = null;
    if (shouldIgnite) {
      spawnedOp = await launchWarOperation({
        sessionId,
        attackerCode: targetCode,
        defenderCode: thirdCode,
        operationType: "TANK_BLITZ",
        intensity: 76,
        autoDeclareWar: true,
        skipAiWake: true,
      });
    } else {
      spawnedOp = await launchWarOperation({
        sessionId,
        attackerCode: targetCode,
        defenderCode: thirdCode,
        operationType: "ASSAULT",
        unitType: "INFANTRY",
        intensity: 48,
        title: isTr
          ? `Gizli Kışkırtma Çatışması (${targetCode} ↔ ${thirdCode})`
          : `False-Flag Border Skirmish (${targetCode} ↔ ${thirdCode})`,
        description:
          customNote ||
          (isTr
            ? `${actor.name} istihbaratının körüklediği sınır olayı ${target.name} ve ${thirdCountry.name} arasında çatışmaya yol açtı!`
            : `Covert border provocation stoked clashes between ${target.name} and ${thirdCountry.name}!`),
        autoDeclareWar: false,
        skipAiWake: true,
      });
    }

    const tName = getCountryDisplayName(target.code, target.name, locale);
    const cName = getCountryDisplayName(thirdCountry.code, thirdCountry.name, locale);

    const ev = await prisma.worldEvent.create({
      data: {
        sessionId,
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
        headline: shouldIgnite
          ? isTr
            ? `SAVAŞ PATLAK VERDİ: ${tName} ve ${cName} Birbirine Girdi!`
            : `WAR ERUPTS: ${tName} and ${cName} Clash in Open Conflict!`
          : isTr
            ? `${tName}–${cName} Sınırında Gizemli Sabotaj ve Ateş!`
            : `Mysterious Border Sabotage Ignites ${tName}–${cName} Standoff!`,
        articleBody: shouldIgnite
          ? isTr
            ? `Diplomatik sabotaj ve tırmanan sınır olayları sonrası ${tName} ile ${cName} resmen savaşa tutuştu; zırhlı birlikler sınırı aştı.`
            : `Following escalating border incidents, ${tName} and ${cName} entered full-scale war with armored columns crossing the frontier.`
          : isTr
            ? `${tName} ile ${cName} arasındaki gerilim %${risk.probability} savaş olasılığına fırladı.`
            : `Tensions between ${tName} and ${cName} surged to ${risk.probability}% war probability.`,
        category: shouldIgnite ? "WAR" : "CRISIS",
        involvedCountries: JSON.stringify([targetCode, thirdCode, actorCode]),
      },
    });
    emitSessionEvent(sessionId, "event_published", {
      event: { ...ev, involvedCountries: [targetCode, thirdCode, actorCode] },
    });
    emitSessionEvent(sessionId, "diplomatic_provocation", {
      actionType,
      actorCode,
      targetCode,
      thirdCode,
      warErupted: shouldIgnite,
      probability: shouldIgnite ? 100 : risk.probability,
    });

    markBrowserSessionActive(sessionId);
    notifyPlayerAction(
      sessionId,
      "WAR_ACTION",
      isTr
        ? `Üçüncü Ülke Kışkırtması: ${actorCode} -> ${targetCode} ↔ ${thirdCode} (Savaş: ${shouldIgnite ? "BAŞLADI" : `%${risk.probability}`})`
        : `Third-Party Instigation: ${actorCode} -> ${targetCode} ↔ ${thirdCode} (War: ${shouldIgnite ? "STARTED" : `${risk.probability}%`})`
    );

    return {
      actionType,
      warErupted: shouldIgnite,
      newProbability: shouldIgnite ? 100 : risk.probability,
      newTension: shouldIgnite ? 100 : relation.tension,
      operation: spawnedOp,
      summary: ev.headline,
    };
  }

  // Bilateral Provocations: BORDER_SKIRMISH | DIPLOMATIC_INSULT | SPONSOR_REBELS (Covert Envoy Agitation)
  const prof = getWarDifficultyProfile(session.difficulty);
  const deltaMap: Record<string, number> = {
    BORDER_SKIRMISH: 26,
    DIPLOMATIC_INSULT: 22,
    SPONSOR_REBELS: prof.envoyTensionDelta,
  };
  const tensionBoost = deltaMap[actionType] ?? 22;

  const { relation } = await upsertDiplomacyTension({
    sessionId,
    countryA: actorCode,
    countryB: targetCode,
    tensionDelta: tensionBoost,
    turnNumber: session.turnNumber,
  });

  let updatedTargetStability = target.stability;
  if (actionType === "SPONSOR_REBELS") {
    updatedTargetStability = clamp(
      target.stability - prof.envoyDispatchStabilityDrop,
      5,
      100
    );
    await prisma.$transaction([
      prisma.country.update({
        where: { id: actor.id },
        data: {
          treasury: Math.max(0, actor.treasury - prof.envoyCost),
          infamy: clamp(actor.infamy + 5, 0, 100),
        },
      }),
      prisma.country.update({
        where: { id: target.id },
        data: {
          stability: updatedTargetStability,
          warExhaustion: clamp(target.warExhaustion + 4, 0, 100),
        },
      }),
    ]);
  } else if (actionType === "BORDER_SKIRMISH") {
    await prisma.country.update({
      where: { id: actor.id },
      data: { infamy: clamp(actor.infamy + 4, 0, 100) },
    });
  }

  const [regA, regB] = await Promise.all([
    prisma.regionOwnership.findMany({
      where: { sessionId, ownerCountryCode: actorCode },
      select: { regionId: true },
    }),
    prisma.regionOwnership.findMany({
      where: { sessionId, ownerCountryCode: targetCode },
      select: { regionId: true },
    }),
  ]);

  const risk = computeBilateralWarRisk({
    countryA: actor,
    countryB: { ...target, stability: updatedTargetStability },
    relation,
    globalTension: session.globalTension,
    borderAdjacent: checkBorderProximity(
      regA.map((r) => r.regionId),
      regB.map((r) => r.regionId),
      regionMap
    ),
    locale,
  });

  // Angry country retaliates into full war if pushed past threshold
  const warTriggeredByRetaliation =
    relation.status !== "WAR" &&
    (relation.tension >= 88 ||
      (risk.probability >= 78 && Math.random() * 100 < risk.probability * 0.65));

  let op = null;
  const isUprisingReady =
    updatedTargetStability <= prof.uprisingStabilityThreshold;

  if (warTriggeredByRetaliation) {
    op = await launchWarOperation({
      sessionId,
      attackerCode: targetCode,
      defenderCode: actorCode,
      operationType: "TANK_BLITZ",
      unitType: "ARMOR",
      intensity: 80,
      title: isTr
        ? `${target.name} Misilleme Taarruzu!`
        : `${target.name} Retaliatory Offensive!`,
      description: isTr
        ? `Kışkırtmalara öfkelenen ${target.name}, ${actor.name} üzerine karşı taarruz ve topyekûn savaş başlattı!`
        : `Outraged by repeated provocations, ${target.name} launched a retaliatory war offensive against ${actor.name}!`,
      autoDeclareWar: true,
      skipAiWake: true,
    });
  } else if (actionType === "SPONSOR_REBELS") {
    op = await launchWarOperation({
      sessionId,
      attackerCode: actorCode,
      defenderCode: targetCode,
      targetRegionId,
      operationType: isUprisingReady ? "REBEL_UPRISING" : "ENVOY_AGITATION",
      unitType: isUprisingReady ? "INFANTRY" : "ENVOY",
      intensity: isUprisingReady ? 64 : 50,
      title: isUprisingReady
        ? isTr
          ? `Halk Ayaklanması (${targetCode})`
          : `Popular Uprising (${targetCode})`
        : isTr
          ? `Gizli Elçi Sızması (${targetCode})`
          : `Covert Envoy Agitation (${targetCode})`,
      description:
        customNote ||
        (isUprisingReady
          ? isTr
            ? `Gizli elçilerin uzun süreli kışkırtması sonucu ${target.name} kentinde halk barikat kurup isyana kalkıştı (toprak ilhakı yapılmaz).`
            : `Sustained covert agitation boiled over into a street uprising inside ${target.name} (does not annex territory).`
          : isTr
            ? `${actor.name} gizli elçileri ${target.name} topraklarına sızarak halkı kışkırtıyor ve istikrarı düşürüyor.`
            : `${actor.name} envoys infiltrated ${target.name} cities to agitate citizens and erode stability.`),
      autoDeclareWar: false,
      skipAiWake: true,
    });
  } else if (actionType === "BORDER_SKIRMISH") {
    op = await launchWarOperation({
      sessionId,
      attackerCode: actorCode,
      defenderCode: targetCode,
      targetRegionId,
      operationType: "ASSAULT",
      unitType: "INFANTRY",
      intensity: 46,
      title: isTr
        ? `Sınır Taciz Çatışması (${actorCode} → ${targetCode})`
        : `Border Skirmish (${actorCode} → ${targetCode})`,
      description:
        customNote ||
        (isTr
          ? `${actor.name} birlikleri sınır hattında taciz ateşi ve sıcak temas başlattı.`
          : `${actor.name} frontier units initiated live border skirmishes.`),
      autoDeclareWar: false,
      skipAiWake: true,
    });
  }

  const tDisp = getCountryDisplayName(target.code, target.name, locale);
  const aDisp = getCountryDisplayName(actor.code, actor.name, locale);
  const msg = await prisma.diplomaticMessage.create({
    data: {
      sessionId,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      fromCountryCode: targetCode,
      toCountryCode: actorCode,
      senderTitle: `${target.leader} (${tDisp})`,
      message: warTriggeredByRetaliation
        ? isTr
          ? `Sabrımız taştı! ${aDisp} yönetimini bu saldırganlıkların hesabını cephede ödemeye çağırıyoruz. SAVAŞ İLAN EDİLDİ!`
          : `Our patience has snapped! ${aDisp} will pay for these provocations on the battlefield. WAR IS DECLARED!`
        : actionType === "SPONSOR_REBELS"
          ? isUprisingReady
            ? isTr
              ? `${aDisp} casusları ve kışkırtıcı elçileri şehirlerimizde halkı isyana sürükledi! İstikrar %${updatedTargetStability} seviyesine düştü — bunun hesabını soracağız! (Savaş Olasılığı: %${risk.probability})`
              : `${aDisp} agitators sparked open civil unrest in our cities! Stability fell to ${updatedTargetStability}% — you will answer for this meddling! (War Prob: ${risk.probability}%)`
            : isTr
              ? `${aDisp} tarafından gönderilen gizli elçilerin halkımızı kışkırttığını tespit ettik! İç istikrarımız (%${updatedTargetStability}) hedef alınıyor — geri çekilin! (Savaş Olasılığı: %${risk.probability})`
              : `We detected ${aDisp} envoys distributing seditious propaganda to agitate our citizens (Stability ${updatedTargetStability}%). Cease this interference! (War Prob: ${risk.probability}%)`
          : isTr
            ? `${aDisp} tarafından yapılan bu kışkırtmayı şiddetle kınıyoruz! Savaş olasılığı %${risk.probability} seviyesine çıktı — bir adım daha atarsanız ordularımız karşılık verecek.`
            : `We fiercely condemn this provocation by ${aDisp}! War probability has surged to ${risk.probability}% — cross this line again and our armies will strike back.`,
      isFromPlayer: false,
    },
  });
  emitSessionEvent(sessionId, "message_sent", { message: msg });
  emitSessionEvent(sessionId, "diplomatic_provocation", {
    actionType,
    actorCode,
    targetCode,
    warErupted: warTriggeredByRetaliation,
    probability: warTriggeredByRetaliation ? 100 : risk.probability,
  });

  markBrowserSessionActive(sessionId);
  notifyPlayerAction(
    sessionId,
    "WAR_ACTION",
    isTr
      ? `Kışkırtma (${actionType}): ${actorCode} -> ${targetCode} • Savaş Olasılığı: %${warTriggeredByRetaliation ? 100 : risk.probability}`
      : `Provocation (${actionType}): ${actorCode} -> ${targetCode} • War Prob: ${warTriggeredByRetaliation ? 100 : risk.probability}%`
  );

  return {
    actionType,
    warErupted: warTriggeredByRetaliation,
    newProbability: warTriggeredByRetaliation ? 100 : risk.probability,
    newTension: warTriggeredByRetaliation ? 100 : relation.tension,
    operation: op,
    summary: msg.message,
  };
}

/**
 * Transfer nuclear warheads from a nuclear donor nation to a recipient nation under a
 * mutual alliance / nuclear-sharing treaty umbrella (atomic DB update + map marker + chronicle).
 */
export async function transferNuclearWarheads(params: {
  sessionId: string;
  fromCode: string;
  toCode: string;
  count?: number;
  treatyName?: string;
  reason?: string;
  requireTreaty?: boolean;
  skipAiWake?: boolean;
}) {
  const {
    sessionId,
    fromCode: rawFrom,
    toCode: rawTo,
    count: rawCount = 1,
    treatyName,
    reason,
    requireTreaty = true,
  } = params;

  const fromCode = rawFrom.trim().toUpperCase();
  const toCode = rawTo.trim().toUpperCase();
  const count = clamp(Math.round(rawCount), 1, 20);

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";

  if (fromCode === toCode) {
    throw new Error(
      isTr
        ? "Bir ülke kendisine nükleer başlık devredemez."
        : "A nation cannot transfer nuclear warheads to itself."
    );
  }

  const [donor, recipient] = await Promise.all([
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: fromCode } },
    }),
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: toCode } },
    }),
  ]);

  const fromDisp = getCountryDisplayName(donor.code, donor.name, locale);
  const toDisp = getCountryDisplayName(recipient.code, recipient.name, locale);

  const [a, b] = sortCountryPair(fromCode, toCode);
  const relation = await prisma.diplomacyRelation.findUnique({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
  });

  if (requireTreaty && !isTreatyEligibleForNuclearSharing(relation)) {
    throw new Error(
      isTr
        ? `${fromDisp} ile ${toDisp} arasında aktif bir İttifak / Nükleer Savunma Antlaşması bulunmuyor! Önce antlaşma imzalayıp liderle görüşmelisiniz.`
        : `No active Alliance or Nuclear Sharing Treaty exists between ${fromDisp} and ${toDisp}! Sign a defense alliance first and negotiate with their leader.`
    );
  }

  const donorStock = donor.nuclearWarheads ?? 0;
  if (donorStock < count + 1) {
    throw new Error(
      isTr
        ? `${fromDisp} envanterinde devredilebilecek yeterli nükleer başlık yok (Mevcut: ${donorStock}, en az 1 stratejik başlık rezervde kalmalı).`
        : `${fromDisp} lacks sufficient surplus nuclear warheads (Current: ${donorStock}; at least 1 must remain in strategic reserve).`
    );
  }

  const resolvedTreaty =
    treatyName?.trim() ||
    relation?.treatyName ||
    (isTr ? "Stratejik Nükleer Paylaşım Protokolü" : "Nuclear Sharing Protocol");

  const nextDonorWarheads = donorStock - count;
  const nextRecipientWarheads = (recipient.nuclearWarheads ?? 0) + count;

  await prisma.$transaction(async (tx) => {
    await tx.country.update({
      where: { id: donor.id },
      data: { nuclearWarheads: nextDonorWarheads },
    });
    await tx.country.update({
      where: { id: recipient.id },
      data: { nuclearWarheads: nextRecipientWarheads },
    });

    if (relation) {
      await tx.diplomacyRelation.update({
        where: { id: relation.id },
        data: {
          tension: Math.max(0, relation.tension - 5),
          ...(treatyName?.trim() ? { treatyName: treatyName.trim() } : {}),
          updatedTurn: session.turnNumber,
        },
      });
    }

    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        globalTension: clamp(session.globalTension + 4, 0, 100),
      },
    });
  });

  const capitalCoords = resolveMarkerCoordinates({
    regionId: recipient.capitalRegionId,
    cityName: recipient.name,
    fallbackRegionId: recipient.capitalRegionId,
  });

  const marker = await prisma.mapMarker.create({
    data: {
      sessionId,
      countryCode: toCode,
      regionId: recipient.capitalRegionId ?? null,
      cityName: toDisp,
      title: isTr
        ? `Nükleer Başlık Konuşlandırması (${fromCode} → ${toCode})`
        : `Nuclear Warhead Sharing (${fromCode} → ${toCode})`,
      description:
        reason?.trim() ||
        (isTr
          ? `${resolvedTreaty} kapsamında ${fromDisp}, ${toDisp} topraklarına ${count} adet nükleer başlık konuşlandırdı.`
          : `Under ${resolvedTreaty}, ${fromDisp} deployed ${count} nuclear warhead(s) to ${toDisp}.`),
      category: "MILITARY",
      status: "ACTIVE",
      level: clamp(2 + count, 2, 5),
      lat: capitalCoords.lat,
      lng: capitalCoords.lng,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      isAnimated: true,
    },
  });

  const event = await prisma.worldEvent.create({
    data: {
      sessionId,
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      headline: isTr
        ? `${fromDisp}, ${resolvedTreaty} Kapsamında ${toDisp}'ya ${count} Nükleer Başlık Sağladı!`
        : `${fromDisp} Transfers ${count} Nuclear Warhead(s) to ${toDisp} Under ${resolvedTreaty}!`,
      articleBody:
        reason?.trim() ||
        (isTr
          ? `Liderler zirvesi ve ${resolvedTreaty} çerçevesinde ${fromDisp} yönetimi, müttefiki ${toDisp}'ya ${count} adet stratejik nükleer başlık tahsis etti. ${toDisp} nükleer caydırıcılık şemsiyesine fiilen katıldı.`
          : `Following bilateral leader talks under ${resolvedTreaty}, ${fromDisp} transferred ${count} nuclear warhead(s) to ${toDisp}, bringing ${toDisp} into active nuclear deterrence readiness.`),
      category: "DIPLOMACY",
      involvedCountries: JSON.stringify([fromCode, toCode]),
    },
  });

  emitSessionEvent(sessionId, "nuclear_transferred", {
    fromCode,
    toCode,
    count,
    donorWarheads: nextDonorWarheads,
    recipientWarheads: nextRecipientWarheads,
    treatyName: resolvedTreaty,
  });
  emitSessionEvent(sessionId, "map_marker_updated", {
    action: "CREATED",
    marker,
    isNew: true,
  });
  emitSessionEvent(sessionId, "event_published", {
    event: { ...event, involvedCountries: [fromCode, toCode] },
  });
  emitSessionEvent(sessionId, "stats_updated", { countryCode: toCode });

  return {
    fromCode,
    toCode,
    count,
    treatyName: resolvedTreaty,
    donorWarheads: nextDonorWarheads,
    recipientWarheads: nextRecipientWarheads,
    marker,
    event,
  };
}

/**
 * Negotiate nuclear warhead sharing directly with a treaty partner leader
 * (either routed to MCP AI or evaluated through the active treaty protocol).
 */
export async function requestNuclearSharingWithAlly(params: {
  sessionId: string;
  patronCode: string;
  requestedCount?: number;
  customMessage?: string;
  dispatch?: "ai" | "treaty_protocol";
  locale?: AppLocale;
}) {
  const {
    sessionId,
    patronCode: rawPatron,
    requestedCount: rawCount = 1,
    customMessage,
    dispatch = "treaty_protocol",
  } = params;

  const patronCode = rawPatron.trim().toUpperCase();
  const requestedCount = clamp(Math.round(rawCount), 1, 3);
  const locale = params.locale ?? getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  if (!session.playerCountryCode) {
    throw new Error(
      isTr ? "Önce oynanacak ülkeyi seçmelisiniz." : "Select a player country first."
    );
  }

  const playerCode = session.playerCountryCode;
  if (playerCode === patronCode) {
    throw new Error(
      isTr ? "Kendi ülkenizden başlık talep edemezsiniz." : "Cannot request from yourself."
    );
  }

  const [player, patron] = await Promise.all([
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: playerCode } },
    }),
    prisma.country.findUniqueOrThrow({
      where: { sessionId_code: { sessionId, code: patronCode } },
    }),
  ]);

  const playerDisp = getCountryDisplayName(player.code, player.name, locale);
  const patronDisp = getCountryDisplayName(patron.code, patron.name, locale);

  const [a, b] = sortCountryPair(playerCode, patronCode);
  const relation = await prisma.diplomacyRelation.findUnique({
    where: { sessionId_countryA_countryB: { sessionId, countryA: a, countryB: b } },
  });
  const treatyLabel =
    relation?.treatyName ||
    (isTr ? "Savunma ve Nükleer Şemsiye Antlaşması" : "Defense & Nuclear Umbrella Pact");

  const playerMessageText =
    customMessage?.trim() ||
    (isTr
      ? `Sayın ${patron.leader}, aramızdaki "${treatyLabel}" antlaşma çatısı ve ortak güvenlik çıkarlarımız doğrultusunda ${playerDisp} envanterine ${requestedCount} adet taktik nükleer başlık konuşlandırılmasını ve nükleer destek sağlanmasını talep ediyoruz.`
      : `Dear ${patron.leader}, under our shared "${treatyLabel}" treaty umbrella and mutual defense commitments, ${playerDisp} formally requests the deployment of ${requestedCount} tactical nuclear warhead(s) to our deterrent stockpile.`);

  const playerChat = await prisma.leaderChatMessage.create({
    data: {
      sessionId,
      countryCode: patronCode,
      playerCountryCode: playerCode,
      senderRole: "PLAYER",
      senderName: `${player.leader} (${playerDisp})`,
      content: playerMessageText,
      status: dispatch === "ai" ? "PENDING_REPLY" : "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  emitSessionEvent(sessionId, "leader_chat_updated", {
    countryCode: patronCode,
    message: playerChat,
  });

  if (dispatch === "ai") {
    markBrowserSessionActive(sessionId);
    notifyPlayerAction(
      sessionId,
      "LEADER_CHAT",
      `${playerCode} -> ${patronCode}: ${playerMessageText}`
    );
    return {
      status: "PENDING_AI" as const,
      transferred: 0,
      playerMessage: playerChat,
      leaderMessage: null,
      summary: isTr
        ? `Nükleer destek talebi ${patron.leader}'a (MCP AI) iletildi; lider yanıtı bekleniyor.`
        : `Nuclear support proposal sent to ${patron.leader} (MCP AI); awaiting leader reply.`,
    };
  }

  // Evaluate bilateral treaty & difficulty realism
  const evalRes = evaluateTreatyNuclearTransferAcceptance({
    difficulty: session.difficulty,
    patronWarheads: patron.nuclearWarheads ?? 0,
    requestedCount,
    relationStatus: relation?.status ?? "NEUTRAL",
    tension: relation?.tension ?? 25,
    playerInfamy: player.infamy,
    patronStability: patron.stability,
    treatyName: relation?.treatyName ?? null,
  });

  if (evalRes.accepted && evalRes.grantedCount > 0) {
    const transfer = await transferNuclearWarheads({
      sessionId,
      fromCode: patronCode,
      toCode: playerCode,
      count: evalRes.grantedCount,
      treatyName: treatyLabel,
      requireTreaty: true,
      skipAiWake: true,
    });

    const replyText = isTr
      ? `"${treatyLabel}" kapsamında müttefikimiz ${playerDisp}'ya güvenimiz tamdır. Stratejik caydırıcılık için envanterimizden ${evalRes.grantedCount} adet nükleer başlığın sevkini onaylıyorum. Yeni nükleer stokunuz: ${transfer.recipientWarheads} başlık.`
      : `Under "${treatyLabel}", we stand firmly behind ${playerDisp}. I have authorized the transfer of ${evalRes.grantedCount} nuclear warhead(s) from our stockpile to your forces. New arsenal: ${transfer.recipientWarheads}.`;

    const leaderChat = await prisma.leaderChatMessage.create({
      data: {
        sessionId,
        countryCode: patronCode,
        playerCountryCode: playerCode,
        senderRole: "LEADER",
        senderName: `${patron.leader} (${patronDisp})`,
        content: replyText,
        status: "DELIVERED",
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
      },
    });

    emitSessionEvent(sessionId, "leader_chat_reply", {
      countryCode: patronCode,
      message: leaderChat,
    });

    return {
      status: "APPROVED" as const,
      transferred: evalRes.grantedCount,
      newPlayerWarheads: transfer.recipientWarheads,
      playerMessage: playerChat,
      leaderMessage: leaderChat,
      summary: isTr
        ? `${patronDisp} antlaşma kapsamında +${evalRes.grantedCount} nükleer başlık verdi! (Toplam: ${transfer.recipientWarheads})`
        : `${patronDisp} transferred +${evalRes.grantedCount} nuclear warhead(s) under treaty! (Total: ${transfer.recipientWarheads})`,
    };
  }

  let rejectionText: string;
  if (evalRes.reasonCode === "NO_TREATY") {
    rejectionText = isTr
      ? `Sayın ${player.leader}, aramızda henüz resmi bir İttifak veya Nükleer Savunma Antlaşması bulunmuyor. Nükleer silah paylaşımı yapabilmemiz için önce ortak bir savunma ittifakı (${patronDisp}–${playerDisp} Paktı) imzalamamız şarttır.`
      : `Dear ${player.leader}, we do not yet share an active Alliance or Defense Umbrella Treaty. We must first establish a binding alliance before any nuclear warhead sharing can be authorized.`;
  } else if (evalRes.reasonCode === "INSUFFICIENT_ARSENAL") {
    rejectionText = isTr
      ? `Üzgünüm, şu an ${patronDisp} cephaneliğinde kendi stratejik rezervimizi riske atmadan devredebileceğimiz yeterli nükleer başlık bulunmuyor (Mevcut: ${patron.nuclearWarheads ?? 0}).`
      : `Unfortunately, ${patronDisp} cannot spare nuclear warheads right now without compromising our own minimum deterrent (${patron.nuclearWarheads ?? 0} remaining).`;
  } else if (evalRes.reasonCode === "HIGH_TENSION") {
    rejectionText = isTr
      ? `İkili ilişkilerimizdeki gerilim (${relation?.tension ?? 50}) henüz başlık devri için gereken güven eşiğinin üzerinde. Önce diplomatik gerilimi düşürelim.`
      : `Bilateral tension (${relation?.tension ?? 50}) is still too high to authorize nuclear warhead sharing. Let us de-escalate and build trust first.`;
  } else if (evalRes.reasonCode === "TOO_MUCH_INFAMY") {
    rejectionText = isTr
      ? `${playerDisp}'nın küresel agresiflik puanı (Infamy: ${player.infamy}) parlamentomuzu endişelendiriyor; mevcut zorluk seviyesinde bu kadar yüksek gerilimde nükleer başlık devredemeyiz.`
      : `${playerDisp}'s high international infamy (${player.infamy}) prevents our leadership from approving nuclear warhead transfers under current geopolitical scrutiny.`;
  } else {
    rejectionText = isTr
      ? `Mevcut "${treatyLabel}" koşullarımız ve askeri kurmaylarımızın değerlendirmesi (Skor ${evalRes.score}/${evalRes.threshold}), şu aşamada ${requestedCount} başlık transferine izin vermiyor. İlişkileri güçlendirip AI Lider görüşmesinden daha ikna edici garantiler sunabilirsiniz.`
      : `Under our "${treatyLabel}" review (Score ${evalRes.score}/${evalRes.threshold}), our defense council declines transferring ${requestedCount} warheads right now. Improve trust or negotiate specific terms via AI Leader Chat.`;
  }

  const leaderChat = await prisma.leaderChatMessage.create({
    data: {
      sessionId,
      countryCode: patronCode,
      playerCountryCode: playerCode,
      senderRole: "LEADER",
      senderName: `${patron.leader} (${patronDisp})`,
      content: rejectionText,
      status: "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  emitSessionEvent(sessionId, "leader_chat_reply", {
    countryCode: patronCode,
    message: leaderChat,
  });

  return {
    status: "REJECTED" as const,
    reasonCode: evalRes.reasonCode,
    transferred: 0,
    playerMessage: playerChat,
    leaderMessage: leaderChat,
    summary: rejectionText,
  };
}

/** Read War Theater MCP resource (wars, live sieges, war probabilities). */
export async function readWarTheaterResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const data = await computeSessionWarRisks(sessionId);
  return {
    preferredLanguage: locale,
    ...data,
  };
}

/**
 * Attempt a direct 1-on-1 bilateral ceasefire.
 * - Forbidden if the player is NOT one of the two belligerents (third-party wars require a Peace Council!).
 * - Even for player's own wars, checks Difficulty & enemy War Exhaustion / Military balance so strong enemies
 *   refuse instant free white peace and demand a multilateral Peace Council.
 */
export async function attemptDirectCeasefireAction(params: {
  sessionId: string;
  countryA: string;
  countryB: string;
}) {
  const { sessionId, countryA, countryB } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { countries: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";
  const playerCode = session.playerCountryCode || "TUR";

  if (countryA !== playerCode && countryB !== playerCode) {
    throw new Error(
      isTr
        ? "Başka ülkeler arasındaki savaşları tek tıkla bitiremezsiniz! Tarafları ve garantör güçleri masaya oturtmak için 'Barış Konseyi Topla' seçeneğini kullanın."
        : "You cannot unilaterally end wars between third-party nations! Use 'Convene Peace Council' to bring the belligerents and guarantors to the table."
    );
  }

  const enemyCode = countryA === playerCode ? countryB : countryA;
  const player = session.countries.find((c) => c.code === playerCode);
  const enemy = session.countries.find((c) => c.code === enemyCode);
  if (!player || !enemy) {
    throw new Error(isTr ? "Ülke verisi bulunamadı." : "Country record not found.");
  }

  const prof = getWarDifficultyProfile(session.difficulty);
  const enemyDisp = getCountryDisplayName(enemy.code, enemy.name, locale);
  const playerAdvantage = player.military - enemy.military;
  const effectiveExhaustion =
    enemy.warExhaustion + Math.max(0, playerAdvantage * 0.7) + Math.max(0, (55 - enemy.stability) * 0.4);

  if (effectiveExhaustion < prof.allowDirectPlayerCeasefireThreshold) {
    throw new Error(
      isTr
        ? `${enemyDisp} cephede geri adım atmayı reddetti! (Savaş Yorgunluğu/Baskı: %${Math.round(effectiveExhaustion)} < %${prof.allowDirectPlayerCeasefireThreshold} zorluk eşiği). Savaşı bitirmek için 'Barış Konseyi Topla' ile çok uluslu müzakere başlatın.`
        : `${enemyDisp} rejected a unilateral ceasefire! (War Exhaustion/Pressure: ${Math.round(effectiveExhaustion)}% < ${prof.allowDirectPlayerCeasefireThreshold}% difficulty threshold). Convene a Multilateral Peace Council to negotiate terms.`
    );
  }

  const { relation } = await upsertDiplomacyTension({
    sessionId,
    countryA,
    countryB,
    status: "NEUTRAL",
    exactTension: 28,
    treatyName: isTr ? "İkili Ateşkes Antlaşması" : "Bilateral Ceasefire Accord",
    turnNumber: session.turnNumber,
  });

  await prisma.warOperation.updateMany({
    where: {
      sessionId,
      status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
      OR: [
        { attackerCode: countryA, defenderCode: countryB },
        { attackerCode: countryB, defenderCode: countryA },
      ],
    },
    data: { status: "REPELLED" },
  });

  emitSessionEvent(sessionId, "war_operation_updated", { ceasefire: true });
  return {
    relation,
    summary: isTr
      ? `${enemyDisp} ile ikili ateşkes imzalandı; aktif cephe harekâtları durduruldu.`
      : `Bilateral ceasefire signed with ${enemyDisp}; active front operations halted.`,
  };
}

/**
 * Convene a multilateral Peace Council inviting both warring nations, the player,
 * and key regional/alliance guarantor powers (NATO, Warsaw Pact, UNSC, etc.).
 */
export async function convenePeaceCouncilAction(params: {
  sessionId: string;
  countryA: string;
  countryB: string;
  customTopic?: string;
}) {
  const { sessionId, countryA, countryB, customTopic } = params;
  const [session, diplomacies, existingCouncils] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { countries: true },
    }),
    prisma.diplomacyRelation.findMany({ where: { sessionId } }),
    prisma.diplomacyCouncil.findMany({
      where: { sessionId, status: "OPEN" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
  ]);
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";
  const playerCode = session.playerCountryCode || "TUR";
  const countryMap = new Map(session.countries.map((c) => [c.code, c]));

  const cA = countryMap.get(countryA);
  const cB = countryMap.get(countryB);
  if (!cA || !cB) {
    throw new Error(isTr ? "Savaşan ülke bulunamadı." : "Warring nation not found.");
  }

  const nameA = getCountryDisplayName(cA.code, cA.name, locale);
  const nameB = getCountryDisplayName(cB.code, cB.name, locale);
  const player = countryMap.get(playerCode);
  const playerName = player
    ? getCountryDisplayName(player.code, player.name, locale)
    : playerCode;

  // Reuse an already OPEN peace council for this exact warring pair if one exists
  const existing = existingCouncils.find((c) => {
    const codes = safeJsonParse<string[]>(c.participantCodes, []);
    const hasPair = codes.includes(countryA) && codes.includes(countryB);
    const isPeaceTopic =
      /ateşkes|barış|ceasefire|peace/i.test(c.title) ||
      /ateşkes|barış|ceasefire|peace/i.test(c.topic);
    return hasPair && isPeaceTopic;
  });

  // Gather participants: player + warring pair + allies + major powers
  const participantSet = new Set<string>([playerCode, countryA, countryB]);
  for (const rel of diplomacies) {
    if (rel.status === "ALLIANCE") {
      if (rel.countryA === countryA || rel.countryA === countryB) {
        participantSet.add(rel.countryB);
      } else if (rel.countryB === countryA || rel.countryB === countryB) {
        participantSet.add(rel.countryA);
      }
    }
  }
  const majorGuarantors = session.countries
    .filter((c) => c.isMajor && !participantSet.has(c.code))
    .sort((a, b) => b.military - a.military)
    .slice(0, 4);
  for (const m of majorGuarantors) {
    participantSet.add(m.code);
  }
  const participantCodes = Array.from(participantSet);
  const majorCount = participantCodes.filter((code) => countryMap.get(code)?.isMajor).length;

  const evaluation = evaluatePeaceCouncilReadiness({
    countryA: cA,
    countryB: cB,
    mediatorMilitary: player?.military ?? 55,
    attendeeCount: participantCodes.length,
    majorAttendeeCount: majorCount,
    difficulty: session.difficulty,
    proposalType: "WHITE_PEACE",
    locale,
  });

  if (existing) {
    return {
      council: {
        ...existing,
        participantCodes: safeJsonParse<string[]>(existing.participantCodes, participantCodes),
      },
      evaluation,
      reused: true,
      summary: isTr
        ? `${nameA} – ${nameB} Barış Konseyi açıldı (Mevcut Uzlaşı: %${evaluation.score} / Gerekli: %${evaluation.threshold}).`
        : `${nameA} – ${nameB} Peace Council opened (Current Consensus: ${evaluation.score}% / Required: ${evaluation.threshold}%).`,
    };
  }

  const blocsA = getCountryBlocsAndPacts({
    countryCode: cA.code,
    scenarioKey: session.scenarioId,
    currentDate: session.currentDate,
    diplomacies,
    locale,
  })
    .map((b) => b.shortLabel)
    .slice(0, 2)
    .join(", ");
  const blocsB = getCountryBlocsAndPacts({
    countryCode: cB.code,
    scenarioKey: session.scenarioId,
    currentDate: session.currentDate,
    diplomacies,
    locale,
  })
    .map((b) => b.shortLabel)
    .slice(0, 2)
    .join(", ");

  const title = isTr
    ? `${nameA} – ${nameB} Ateşkes ve Barış Konseyi`
    : `${nameA} – ${nameB} Ceasefire & Peace Council`;
  const topic =
    customTopic?.trim() ||
    (isTr
      ? `${nameA} ile ${nameB} arasındaki aktif savaşın durdurulması, sınır güvenliği ve çok uluslu ateşkes garantörlüğü (${countryA} ⚔ ${countryB})`
      : `Halting the active war between ${nameA} and ${nameB}, border security guarantees, and multilateral ceasefire monitoring (${countryA} ⚔ ${countryB})`);

  const openingPlayerText = isTr
    ? `${playerName} olarak ${nameA} ve ${nameB} arasındaki yıkıcı savaşı sona erdirmek üzere uluslararası Barış Konseyi'ni topladık. Garantör devletlerin huzurunda cephelerdeki ateşin kesilmesini ve diplomatik çözüme geçilmesini teklif ediyoruz.`
    : `On behalf of ${playerName}, we convene this international Peace Council to end the war between ${nameA} and ${nameB}. In the presence of guarantor powers, we call for an immediate ceasefire and diplomatic settlement.`;

  const statementA = isTr
    ? `${nameA}${blocsA ? ` [${blocsA}]` : ""} heyeti olarak güvenlik çıkarlarımız teminat altına alınmadan tek taraflı geri adım atmayız (Askeri Güç: ${cA.military}, Savaş Yorgunluğu: %${cA.warExhaustion}). Konsey masasında adil bir garantörlük bekliyoruz.`
    : `As the delegation of ${nameA}${blocsA ? ` [${blocsA}]` : ""}, we will not back down without concrete security guarantees (Military: ${cA.military}, War Exhaustion: ${cA.warExhaustion}%). We await a credible proposal from this council.`;

  const statementB = isTr
    ? `${nameB}${blocsB ? ` [${blocsB}]` : ""} yönetimi egemenlik haklarımızı koruyacak somut bir konsey kararı olmadan silah bırakmayacaktır (Askeri Güç: ${cB.military}, Savaş Yorgunluğu: %${cB.warExhaustion}).`
    : `${nameB}${blocsB ? ` [${blocsB}]` : ""} will not lay down arms without binding council guarantees protecting our sovereignty (Military: ${cB.military}, War Exhaustion: ${cB.warExhaustion}%).`;

  const guarantor = majorGuarantors[0];
  const guarantorDisp = guarantor
    ? getCountryDisplayName(guarantor.code, guarantor.name, locale)
    : null;

  const council = await prisma.diplomacyCouncil.create({
    data: {
      sessionId,
      title,
      topic,
      councilType: "COUNCIL",
      initiatorCode: playerCode,
      participantCodes: JSON.stringify(participantCodes),
      status: "OPEN",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
      messages: {
        create: [
          {
            sessionId,
            senderCode: playerCode,
            senderName: player ? `${player.leader} (${playerName})` : playerCode,
            senderRole: "PLAYER",
            content: openingPlayerText,
            stance: "MEDIATOR",
            status: "DELIVERED",
            turnNumber: session.turnNumber,
            gameDate: session.currentDate,
          },
          {
            sessionId,
            senderCode: cA.code,
            senderName: `${cA.leader} (${nameA})`,
            senderRole: "AI_LEADER",
            content: statementA,
            stance: cA.warExhaustion >= 45 ? "MEDIATOR" : "THREATENING",
            status: "DELIVERED",
            turnNumber: session.turnNumber,
            gameDate: session.currentDate,
          },
          {
            sessionId,
            senderCode: cB.code,
            senderName: `${cB.leader} (${nameB})`,
            senderRole: "AI_LEADER",
            content: statementB,
            stance: cB.warExhaustion >= 45 ? "MEDIATOR" : "CRITICAL",
            status: "DELIVERED",
            turnNumber: session.turnNumber,
            gameDate: session.currentDate,
          },
          ...(guarantor && guarantorDisp
            ? [
                {
                  sessionId,
                  senderCode: guarantor.code,
                  senderName: `${guarantor.leader} (${guarantorDisp})`,
                  senderRole: "AI_LEADER",
                  content: isTr
                    ? `${guarantorDisp} olarak bölgesel istikrar için bu Barış Konseyi'ni destekliyoruz. Mevcut zorluk seviyesinde ateşkes için en az %${evaluation.threshold} konsey uzlaşısı gerekiyor (Şu anki hazırlık: %${evaluation.score}).`
                    : `As ${guarantorDisp}, we support this Peace Council for regional stability. Under current difficulty rules, at least ${evaluation.threshold}% council consensus is required for a binding ceasefire (Current readiness: ${evaluation.score}%).`,
                  stance: "MEDIATOR",
                  status: "DELIVERED",
                  turnNumber: session.turnNumber,
                  gameDate: session.currentDate,
                },
              ]
            : []),
        ],
      },
    },
    include: { messages: true },
  });

  const formattedCouncil = {
    ...council,
    participantCodes,
  };

  emitSessionEvent(sessionId, "council_updated", {
    council: formattedCouncil,
    isNewCouncil: true,
  });

  markBrowserSessionActive(sessionId);
  notifyPlayerAction(
    sessionId,
    "COUNCIL_ACTION",
    isTr
      ? `Barış Konseyi Toplandı: ${title} (${participantCodes.join(", ")})`
      : `Peace Council Convened: ${title} (${participantCodes.join(", ")})`
  );

  return {
    council: formattedCouncil,
    evaluation,
    reused: false,
    summary: isTr
      ? `${title} toplandı! Katılımcılar masada — konsey uzlaşı oylaması veya AI müzakeresi ile savaşı sonlandırabilirsiniz.`
      : `${title} convened! All delegations are at the table — pass a council peace vote or negotiate with AI leaders to end the war.`,
  };
}

/**
 * Put a Peace Council resolution to a multilateral vote (WHITE_PEACE, MEDIATED_PACKAGE, or COERCIVE_COALITION).
 * Ends the war ONLY if the difficulty-scaled consensus threshold is met!
 */
export async function resolvePeaceCouncilAction(params: {
  sessionId: string;
  councilId?: string;
  countryA: string;
  countryB: string;
  proposalType: "WHITE_PEACE" | "MEDIATED_PACKAGE" | "COERCIVE_COALITION";
}) {
  const { sessionId, councilId, countryA, countryB, proposalType } = params;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { countries: true },
  });
  if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);

  const locale = getActiveMcpLocale(sessionId);
  const isTr = locale === "tr";
  const playerCode = session.playerCountryCode || "TUR";
  const countryMap = new Map(session.countries.map((c) => [c.code, c]));

  const cA = countryMap.get(countryA);
  const cB = countryMap.get(countryB);
  const player = countryMap.get(playerCode);
  if (!cA || !cB || !player) {
    throw new Error(isTr ? "Ülke kaydı bulunamadı." : "Country record not found.");
  }

  let council = councilId
    ? await prisma.diplomacyCouncil.findUnique({ where: { id: councilId } })
    : null;
  if (!council) {
    const convened = await convenePeaceCouncilAction({
      sessionId,
      countryA,
      countryB,
    });
    council = await prisma.diplomacyCouncil.findUniqueOrThrow({
      where: { id: convened.council.id },
    });
  }

  const participantCodes = safeJsonParse<string[]>(council.participantCodes, [
    playerCode,
    countryA,
    countryB,
  ]);
  const majorCount = participantCodes.filter((code) => countryMap.get(code)?.isMajor).length;

  const evaluation = evaluatePeaceCouncilReadiness({
    countryA: cA,
    countryB: cB,
    mediatorMilitary: player.military,
    attendeeCount: participantCodes.length,
    majorAttendeeCount: majorCount,
    difficulty: session.difficulty,
    proposalType,
    locale,
  });

  if (evaluation.packageCost > 0) {
    if (player.treasury < evaluation.packageCost) {
      throw new Error(
        isTr
          ? `Hazine yetersiz! Bu konsey barış paketi için ${evaluation.packageCost} Bütçe gerekiyor (Mevcut: ${player.treasury}).`
          : `Insufficient treasury! This council peace package requires ${evaluation.packageCost} Treasury (Current: ${player.treasury}).`
      );
    }
    await prisma.country.update({
      where: { id: player.id },
      data: {
        treasury: Math.max(0, player.treasury - evaluation.packageCost),
        ...(proposalType === "COERCIVE_COALITION"
          ? { infamy: clamp(player.infamy + 2, 0, 100) }
          : {}),
      },
    });
  }

  const nameA = getCountryDisplayName(cA.code, cA.name, locale);
  const nameB = getCountryDisplayName(cB.code, cB.name, locale);
  const playerName = getCountryDisplayName(player.code, player.name, locale);

  const proposalLabel =
    proposalType === "MEDIATED_PACKAGE"
      ? isTr
        ? `Garantör Yeniden İnşa & Barış Fonu (${evaluation.packageCost} Bütçe)`
        : `Guarantor Reconstruction & Peace Fund (${evaluation.packageCost} Treasury)`
      : proposalType === "COERCIVE_COALITION"
        ? isTr
          ? `Konsey Ortak Yaptırım & Ateşkes Ültimatomu (${evaluation.packageCost} Bütçe)`
          : `Council Joint Sanctions & Ceasefire Ultimatum (${evaluation.packageCost} Treasury)`
        : isTr
          ? "Koşulsuz Statüko Ateşkesi (Beyaz Barış)"
          : "Unconditional Status Quo Ceasefire (White Peace)";

  const playerMsg = await prisma.diplomacyCouncilMessage.create({
    data: {
      councilId: council.id,
      sessionId,
      senderCode: playerCode,
      senderName: `${player.leader} (${playerName})`,
      senderRole: "PLAYER",
      content: isTr
        ? `[KONSEY BARIŞ OYLAMASI: ${proposalLabel}] ${nameA} ve ${nameB} cephelerinde derhal ateşkes ilan edilmesini konsey oylamasına sunuyoruz.`
        : `[COUNCIL PEACE VOTE: ${proposalLabel}] We table a formal council resolution for an immediate ceasefire between ${nameA} and ${nameB}.`,
      stance: "MEDIATOR",
      status: "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  const stronger = cA.military >= cB.military ? cA : cB;
  const weaker = stronger.code === cA.code ? cB : cA;
  const strongerName = getCountryDisplayName(stronger.code, stronger.name, locale);
  const weakerName = getCountryDisplayName(weaker.code, weaker.name, locale);

  if (evaluation.accepted) {
    const replyStronger = await prisma.diplomacyCouncilMessage.create({
      data: {
        councilId: council.id,
        sessionId,
        senderCode: stronger.code,
        senderName: `${stronger.leader} (${strongerName})`,
        senderRole: "AI_LEADER",
        content: isTr
          ? `Konsey garantörlüğünü ve sunulan "${proposalLabel}" çerçevesini (%${evaluation.score} uzlaşı) kabul ediyoruz. Birliklerimize ateşkes emri verildi.`
          : `We accept the council guarantees and the "${proposalLabel}" framework (${evaluation.score}% consensus). Our forces have been ordered to stand down.`,
        stance: "SUPPORTIVE",
        status: "DELIVERED",
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
      },
    });
    const replyWeaker = await prisma.diplomacyCouncilMessage.create({
      data: {
        councilId: council.id,
        sessionId,
        senderCode: weaker.code,
        senderName: `${weaker.leader} (${weakerName})`,
        senderRole: "AI_LEADER",
        content: isTr
          ? `${weakerName} uluslararası konsey kararını onaylıyor ve cephe hattında çatışmaları durduruyor.`
          : `${weakerName} ratifies the international council resolution and halts hostilities along the front.`,
        stance: "SUPPORTIVE",
        status: "DELIVERED",
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
      },
    });

    await upsertDiplomacyTension({
      sessionId,
      countryA,
      countryB,
      status: "NEUTRAL",
      exactTension: 28,
      treatyName: isTr
        ? `${nameA}-${nameB} Konsey Barış Antlaşması`
        : `${nameA}-${nameB} Council Peace Treaty`,
      turnNumber: session.turnNumber,
    });

    await prisma.warOperation.updateMany({
      where: {
        sessionId,
        status: { in: ["MARCHING", "BESIEGING", "ACTIVE"] },
        OR: [
          { attackerCode: countryA, defenderCode: countryB },
          { attackerCode: countryB, defenderCode: countryA },
        ],
      },
      data: { status: "REPELLED" },
    });

    await prisma.$transaction([
      prisma.country.update({
        where: { id: cA.id },
        data: { warExhaustion: clamp(cA.warExhaustion - 12, 0, 100) },
      }),
      prisma.country.update({
        where: { id: cB.id },
        data: { warExhaustion: clamp(cB.warExhaustion - 12, 0, 100) },
      }),
      prisma.diplomacyCouncil.update({
        where: { id: council.id },
        data: { status: "RESOLVED" },
      }),
    ]);

    const ev = await prisma.worldEvent.create({
      data: {
        sessionId,
        turnNumber: session.turnNumber,
        gameDate: session.currentDate,
        headline: isTr
          ? `BARIŞ KONSEYİ UZLAŞTI: ${nameA} ve ${nameB} Savaşı Sona Erdi!`
          : `PEACE COUNCIL SUCCEEDS: ${nameA} and ${nameB} Sign Ceasefire!`,
        articleBody: isTr
          ? `${playerName} öncülüğünde toplanan çok uluslu Barış Konseyi'nde %${evaluation.score} uzlaşı sağlandı; ${nameA} ile ${nameB} arasındaki tüm cephe harekâtları durduruldu.`
          : `Under the multilateral Peace Council spearheaded by ${playerName}, a ${evaluation.score}% consensus was reached, halting all military operations between ${nameA} and ${nameB}.`,
        category: "DIPLOMACY",
        involvedCountries: JSON.stringify([playerCode, countryA, countryB]),
      },
    });

    emitSessionEvent(sessionId, "event_published", {
      event: { ...ev, involvedCountries: [playerCode, countryA, countryB] },
    });
    emitSessionEvent(sessionId, "war_operation_updated", { ceasefire: true });
    emitSessionEvent(sessionId, "council_updated", {
      councilId: council.id,
      messages: [playerMsg, replyStronger, replyWeaker],
      councilStatus: "RESOLVED",
    });

    return {
      accepted: true,
      councilId: council.id,
      evaluation,
      summary: evaluation.reason,
    };
  }

  // Rejected — post realistic pushback in the council transcript
  const rejectMsg = await prisma.diplomacyCouncilMessage.create({
    data: {
      councilId: council.id,
      sessionId,
      senderCode: stronger.code,
      senderName: `${stronger.leader} (${strongerName})`,
      senderRole: "AI_LEADER",
      content: isTr
        ? `"${proposalLabel}" teklifini reddediyoruz! Mevcut konsey baskısı (%${evaluation.score}) bu zorluk seviyesinde ateşkes eşiğinin (%${evaluation.threshold}) altında. Askeri hedeflerimize ulaşmadan veya daha güçlü bir garantör paketi sunulmadan cepheden çekilmeyiz!`
        : `We reject the "${proposalLabel}" resolution! Current council leverage (${evaluation.score}%) is below the ${evaluation.threshold}% difficulty threshold. We will not halt operations without stronger concessions or higher war exhaustion!`,
      stance: "THREATENING",
      status: "DELIVERED",
      turnNumber: session.turnNumber,
      gameDate: session.currentDate,
    },
  });

  emitSessionEvent(sessionId, "council_updated", {
    councilId: council.id,
    messages: [playerMsg, rejectMsg],
    councilStatus: "OPEN",
  });

  return {
    accepted: false,
    councilId: council.id,
    evaluation,
    summary: evaluation.reason,
  };
}
