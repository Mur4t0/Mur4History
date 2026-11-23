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
import { clamp, sortCountryPair } from "@/lib/utils";
import type { WarRiskSummary } from "@/lib/client-types";

export type WarOperationType =
  | "SIEGE"
  | "ASSAULT"
  | "TANK_BLITZ"
  | "AIR_STRIKE"
  | "NAVAL_INVASION"
  | "NUCLEAR_STRIKE"
  | "REBEL_UPRISING";

export type WarUnitType = "INFANTRY" | "ARMOR" | "AIR" | "NAVAL" | "MISSILE";

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

  return {
    sessionId,
    globalTension: session.globalTension,
    activeWarsCount: diplomacies.filter((d) => d.status === "WAR").length,
    activeOperationsCount: warOps.filter((w) =>
      ["MARCHING", "BESIEGING", "ACTIVE"].includes(w.status)
    ).length,
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

  if (autoDeclareWar && operationType !== "REBEL_UPRISING") {
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
    : isTr
      ? `${atkName} Taarruzu — ${coords.targetRegionName}`
      : `${atkName} Offensive — ${coords.targetRegionName}`;

  const defaultDesc = isNuke
    ? isTr
      ? `${atkName}, ${defName} kontrolündeki ${coords.targetRegionName} bölgesine stratejik nükleer başlık fırlattı!`
      : `${atkName} launched a strategic nuclear warhead on ${coords.targetRegionName} (${defName})!`
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
    // Devastate defender stats & create permanent fallout marker
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
    });
    emitSessionEvent(sessionId, "map_marker_updated", {
      action: "CREATED",
      marker: craterMarker,
      isNew: true,
    });
    emitSessionEvent(sessionId, "event_published", {
      event: { ...nukeEvent, involvedCountries: [attackerCode, defenderCode] },
    });
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

  const countryMap = new Map(countries.map((c) => [c.code, c]));
  const updatedOps = [];
  const capturedRegions: Array<{ regionId: string; attacker: string; defender: string }> = [];

  for (const op of ops) {
    const attacker = countryMap.get(op.attackerCode);
    const defender = countryMap.get(op.defenderCode);
    const atkMil = attacker?.military ?? 50;
    const defMil = defender?.military ?? 50;
    const milAdvantage = clamp((atkMil - defMil) / 6, -8, 14);

    let nextStatus = op.status;
    let nextProgress = op.progress;
    const atkStepLoss = Math.round(120 + Math.random() * 240 + (defMil * 2.5));
    const defStepLoss = Math.round(140 + Math.random() * 260 + (atkMil * 2.8));

    if (op.status === "MARCHING") {
      nextProgress = op.progress + 26;
      if (nextProgress >= 36) {
        nextStatus = "BESIEGING";
      }
    } else {
      const siegeStep = Math.round(20 + milAdvantage + (op.intensity * 0.12));
      nextProgress = clamp(op.progress + Math.max(10, siegeStep), 0, 100);
    }

    if (nextProgress >= 100) {
      nextStatus = "CAPTURED";
      nextProgress = 100;

      // Verify target is still held by defender and transfer ownership live
      const targetReg = regions.find((r) => r.regionId === op.targetRegionId);
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

    // Chain next siege automatically onto adjacent enemy province if enemy still owns provinces
    if (nextStatus === "CAPTURED" && op.operationType !== "REBEL_UPRISING") {
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

    const { relation } = await upsertDiplomacyTension({
      sessionId,
      countryA: targetCode,
      countryB: thirdCode,
      tensionDelta: 38,
      turnNumber: session.turnNumber,
    });

    await prisma.country.update({
      where: { id: actor.id },
      data: {
        treasury: Math.max(0, actor.treasury - 250),
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
      (risk.probability >= 68 || Math.random() * 100 < risk.probability);

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

  // Bilateral Provocations: BORDER_SKIRMISH | DIPLOMATIC_INSULT | SPONSOR_REBELS
  const deltaMap: Record<string, number> = {
    BORDER_SKIRMISH: 26,
    DIPLOMATIC_INSULT: 22,
    SPONSOR_REBELS: 28,
  };
  const tensionBoost = deltaMap[actionType] ?? 22;

  const { relation } = await upsertDiplomacyTension({
    sessionId,
    countryA: actorCode,
    countryB: targetCode,
    tensionDelta: tensionBoost,
    turnNumber: session.turnNumber,
  });

  if (actionType === "SPONSOR_REBELS") {
    await prisma.$transaction([
      prisma.country.update({
        where: { id: actor.id },
        data: {
          treasury: Math.max(0, actor.treasury - 200),
          infamy: clamp(actor.infamy + 5, 0, 100),
        },
      }),
      prisma.country.update({
        where: { id: target.id },
        data: { stability: clamp(target.stability - 8, 5, 100) },
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
    countryB: target,
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
    (relation.tension >= 86 ||
      (risk.probability >= 74 && Math.random() * 100 < risk.probability * 0.72));

  let op = null;
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
  } else if (actionType === "SPONSOR_REBELS" || actionType === "BORDER_SKIRMISH") {
    op = await launchWarOperation({
      sessionId,
      attackerCode: actorCode,
      defenderCode: targetCode,
      targetRegionId,
      operationType:
        actionType === "SPONSOR_REBELS" ? "REBEL_UPRISING" : "ASSAULT",
      unitType: "INFANTRY",
      intensity: actionType === "SPONSOR_REBELS" ? 55 : 46,
      title:
        actionType === "SPONSOR_REBELS"
          ? isTr
            ? `Vekil İsyancı Kuşatması (${targetCode})`
            : `Sponsored Rebel Uprising (${targetCode})`
          : isTr
            ? `Sınır Taciz Çatışması (${actorCode} → ${targetCode})`
            : `Border Skirmish (${actorCode} → ${targetCode})`,
      description:
        customNote ||
        (actionType === "SPONSOR_REBELS"
          ? isTr
            ? `${target.name} topraklarında desteklenen milis güçler garnizonu kuşattı.`
            : `Rebel militias sponsored inside ${target.name} besieged local defenses.`
          : isTr
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

/** Read War Theater MCP resource (wars, live sieges, war probabilities). */
export async function readWarTheaterResource(sessionId: string) {
  const locale = getActiveMcpLocale(sessionId);
  const data = await computeSessionWarRisks(sessionId);
  return {
    preferredLanguage: locale,
    ...data,
  };
}
