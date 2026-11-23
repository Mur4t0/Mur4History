export interface NuclearPatronInfo {
  code: string;
  name: string;
  flagEmoji: string;
  leader: string;
  warheads: number;
  status: string;
  treatyName: string | null;
  tension: number;
  eligible: boolean;
}

const PRE_COLD_WAR_ARSENALS: Record<string, number> = {};

const COLD_WAR_1962_ARSENALS: Record<string, number> = {
  USA: 24,
  SOV: 18,
  GBR: 5,
  FRA: 2,
};

const LATE_COLD_WAR_1991_ARSENALS: Record<string, number> = {
  USA: 28,
  SOV: 26,
  RUS: 26,
  CHN: 8,
  FRA: 6,
  GBR: 6,
  ISR: 3,
  IND: 2,
};

const MODERN_2026_ARSENALS: Record<string, number> = {
  USA: 26,
  RUS: 24,
  CHN: 12,
  FRA: 7,
  GBR: 6,
  IND: 5,
  PAK: 5,
  ISR: 4,
  PRK: 3,
};

/** Parse 4-digit year from ISO/YYYY-MM-DD scenario or session date strings. */
export function parseYearFromGameDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 1936;
  const match = dateStr.trim().match(/^(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : 1936;
}

/** Nuclear deterrence era starts from 1945 onward. */
export function isNuclearEraDate(dateStr: string | null | undefined): boolean {
  return parseYearFromGameDate(dateStr) >= 1945;
}

/** Return initial historical/era-calibrated tactical nuclear warhead stockpile for a country. */
export function getInitialNuclearWarheads(
  countryCode: string,
  dateStr: string | null | undefined,
  scenarioSlug?: string | null
): number {
  const code = countryCode.trim().toUpperCase();
  const year = parseYearFromGameDate(dateStr);
  const slug = (scenarioSlug ?? "").toLowerCase();

  if (year < 1945) {
    return PRE_COLD_WAR_ARSENALS[code] ?? 0;
  }
  if (year < 1975 || slug.includes("1962")) {
    return COLD_WAR_1962_ARSENALS[code] ?? 0;
  }
  if (year < 1998 || slug.includes("1991")) {
    return LATE_COLD_WAR_1991_ARSENALS[code] ?? 0;
  }
  return MODERN_2026_ARSENALS[code] ?? 0;
}

const NUCLEAR_TREATY_REGEX =
  /nükleer|nuclear|atom|savunma|defense|defence|şemsiye|umbrella|pakt|pact|nato|varşova|warsaw|şuşa|aukus|güvenlik|security|ittifak|alliance/i;

/**
 * Determine whether a bilateral diplomatic relation constitutes an active treaty umbrella
 * eligible for negotiating nuclear weapons sharing or warhead deployment support.
 */
export function isTreatyEligibleForNuclearSharing(
  relation:
    | {
        status: string;
        treatyName?: string | null;
        tension?: number;
      }
    | null
    | undefined
): boolean {
  if (!relation) return false;
  const tension = relation.tension ?? 20;
  if (relation.status === "WAR" || relation.status === "EMBARGO") return false;
  if (tension > 65) return false;

  if (relation.status === "ALLIANCE" || relation.status === "VASSAL") {
    return true;
  }

  if (
    relation.status === "NON_AGGRESSION" &&
    relation.treatyName &&
    NUCLEAR_TREATY_REGEX.test(relation.treatyName)
  ) {
    return true;
  }

  return false;
}

/**
 * List allied/treaty nuclear powers (and non-treaty nuclear powers) relative to a player nation.
 */
export function findNuclearPartners<
  C extends {
    code: string;
    name: string;
    flagEmoji: string;
    leader: string;
    nuclearWarheads?: number;
  },
  D extends {
    countryA: string;
    countryB: string;
    status: string;
    treatyName: string | null;
    tension?: number;
  },
>(
  playerCode: string | null | undefined,
  countries: C[],
  diplomacies: D[]
): NuclearPatronInfo[] {
  if (!playerCode) return [];

  const relByOther = new Map<string, D>();
  for (const d of diplomacies) {
    if (d.countryA === playerCode) relByOther.set(d.countryB, d);
    else if (d.countryB === playerCode) relByOther.set(d.countryA, d);
  }

  const list: NuclearPatronInfo[] = [];
  for (const c of countries) {
    if (c.code === playerCode) continue;
    const warheads = c.nuclearWarheads ?? 0;
    if (warheads <= 0) continue;
    const rel = relByOther.get(c.code);
    list.push({
      code: c.code,
      name: c.name,
      flagEmoji: c.flagEmoji,
      leader: c.leader,
      warheads,
      status: rel?.status ?? "NEUTRAL",
      treatyName: rel?.treatyName ?? null,
      tension: rel?.tension ?? 20,
      eligible: isTreatyEligibleForNuclearSharing(rel),
    });
  }

  return list.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.warheads - a.warheads;
  });
}

/**
 * Compute difficulty acceptance multiplier for diplomatic nuclear-sharing treaty requests.
 */
export function evaluateTreatyNuclearTransferAcceptance(params: {
  difficulty: string;
  patronWarheads: number;
  requestedCount: number;
  relationStatus: string;
  tension: number;
  playerInfamy: number;
  patronStability: number;
  treatyName: string | null;
}): {
  accepted: boolean;
  grantedCount: number;
  score: number;
  threshold: number;
  reasonCode:
    | "APPROVED"
    | "NO_TREATY"
    | "INSUFFICIENT_ARSENAL"
    | "HIGH_TENSION"
    | "TOO_MUCH_INFAMY"
    | "DIPLOMATIC_RESERVATIONS";
} {
  const {
    difficulty,
    patronWarheads,
    requestedCount,
    relationStatus,
    tension,
    playerInfamy,
    patronStability,
    treatyName,
  } = params;

  if (
    !isTreatyEligibleForNuclearSharing({
      status: relationStatus,
      treatyName,
      tension,
    })
  ) {
    return {
      accepted: false,
      grantedCount: 0,
      score: 0,
      threshold: 100,
      reasonCode: "NO_TREATY",
    };
  }

  if (patronWarheads < Math.max(2, requestedCount + 1)) {
    return {
      accepted: false,
      grantedCount: 0,
      score: 0,
      threshold: 100,
      reasonCode: "INSUFFICIENT_ARSENAL",
    };
  }

  if (tension > 55) {
    return {
      accepted: false,
      grantedCount: 0,
      score: 20,
      threshold: 60,
      reasonCode: "HIGH_TENSION",
    };
  }

  let score = 48;
  if (relationStatus === "ALLIANCE") score += 28;
  else if (relationStatus === "VASSAL") score += 22;
  else score += 12;

  if (treatyName && NUCLEAR_TREATY_REGEX.test(treatyName)) score += 14;
  if (tension <= 15) score += 12;
  else if (tension <= 30) score += 6;
  else score -= Math.round((tension - 30) * 0.7);

  score += Math.min(14, Math.floor((patronWarheads - requestedCount) / 2));
  score -= Math.round(playerInfamy * 0.45);
  score += patronStability >= 65 ? 6 : -6;
  score -= Math.max(0, requestedCount - 1) * 14;

  const thresholdByDifficulty: Record<string, number> = {
    VERY_EASY: 35,
    EASY: 48,
    NORMAL: 60,
    HARD: 74,
    IMPOSSIBLE: 88,
  };
  const threshold = thresholdByDifficulty[difficulty] ?? 60;
  const accepted = score >= threshold;

  if (!accepted) {
    return {
      accepted: false,
      grantedCount: 0,
      score,
      threshold,
      reasonCode:
        playerInfamy >= 55 ? "TOO_MUCH_INFAMY" : "DIPLOMATIC_RESERVATIONS",
    };
  }

  return {
    accepted: true,
    grantedCount: Math.min(requestedCount, Math.max(1, patronWarheads - 1)),
    score,
    threshold,
    reasonCode: "APPROVED",
  };
}
