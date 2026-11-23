import type { AppLocale } from "@/lib/i18n";
import { clamp } from "@/lib/utils";

export interface CountryBlocBadge {
  id: string;
  label: string;
  shortLabel: string;
  category: "MILITARY_BLOC" | "ECONOMIC_UNION" | "GLOBAL_ORG" | "TREATY";
  colorClass: string;
}

export interface WarDifficultyProfile {
  difficulty: "VERY_EASY" | "EASY" | "NORMAL" | "HARD" | "IMPOSSIBLE";
  costMultiplier: number;
  envoyCost: number;
  falseFlagCost: number;
  offensiveCost: number;
  envoyDispatchStabilityDrop: number;
  envoyArrivalStabilityDrop: number;
  uprisingStabilityThreshold: number;
  envoyTensionDelta: number;
  falseFlagTensionDelta: number;
  falseFlagWarThreshold: number;
  playerSiegeSpeedMultiplier: number;
  aiDefenseLossMultiplier: number;
  defenderGarrisonMultiplier: number;
  counterAttackChance: number;
  peaceCouncilThreshold: number;
  allowDirectPlayerCeasefireThreshold: number; // min enemy warExhaustion required for direct 1-on-1 ceasefire without council
}

const DIFFICULTY_PROFILES: Record<string, WarDifficultyProfile> = {
  VERY_EASY: {
    difficulty: "VERY_EASY",
    costMultiplier: 0.5,
    envoyCost: 90,
    falseFlagCost: 110,
    offensiveCost: 60,
    envoyDispatchStabilityDrop: 14,
    envoyArrivalStabilityDrop: 15,
    uprisingStabilityThreshold: 55,
    envoyTensionDelta: 14,
    falseFlagTensionDelta: 48,
    falseFlagWarThreshold: 52,
    playerSiegeSpeedMultiplier: 1.3,
    aiDefenseLossMultiplier: 0.75,
    defenderGarrisonMultiplier: 0.72,
    counterAttackChance: 0.4,
    peaceCouncilThreshold: 25,
    allowDirectPlayerCeasefireThreshold: 15,
  },
  EASY: {
    difficulty: "EASY",
    costMultiplier: 0.75,
    envoyCost: 135,
    falseFlagCost: 160,
    offensiveCost: 90,
    envoyDispatchStabilityDrop: 12,
    envoyArrivalStabilityDrop: 13,
    uprisingStabilityThreshold: 50,
    envoyTensionDelta: 18,
    falseFlagTensionDelta: 40,
    falseFlagWarThreshold: 60,
    playerSiegeSpeedMultiplier: 1.15,
    aiDefenseLossMultiplier: 0.85,
    defenderGarrisonMultiplier: 0.86,
    counterAttackChance: 0.65,
    peaceCouncilThreshold: 38,
    allowDirectPlayerCeasefireThreshold: 28,
  },
  NORMAL: {
    difficulty: "NORMAL",
    costMultiplier: 1.0,
    envoyCost: 180,
    falseFlagCost: 220,
    offensiveCost: 120,
    envoyDispatchStabilityDrop: 10,
    envoyArrivalStabilityDrop: 12,
    uprisingStabilityThreshold: 45,
    envoyTensionDelta: 22,
    falseFlagTensionDelta: 32,
    falseFlagWarThreshold: 68,
    playerSiegeSpeedMultiplier: 1.0,
    aiDefenseLossMultiplier: 1.0,
    defenderGarrisonMultiplier: 1.0,
    counterAttackChance: 0.85,
    peaceCouncilThreshold: 52,
    allowDirectPlayerCeasefireThreshold: 45,
  },
  HARD: {
    difficulty: "HARD",
    costMultiplier: 1.25,
    envoyCost: 225,
    falseFlagCost: 260,
    offensiveCost: 150,
    envoyDispatchStabilityDrop: 9,
    envoyArrivalStabilityDrop: 11,
    uprisingStabilityThreshold: 44,
    envoyTensionDelta: 25,
    falseFlagTensionDelta: 30,
    falseFlagWarThreshold: 76,
    playerSiegeSpeedMultiplier: 0.88,
    aiDefenseLossMultiplier: 1.18,
    defenderGarrisonMultiplier: 1.14,
    counterAttackChance: 1.0,
    peaceCouncilThreshold: 66,
    allowDirectPlayerCeasefireThreshold: 65,
  },
  IMPOSSIBLE: {
    difficulty: "IMPOSSIBLE",
    costMultiplier: 1.6,
    envoyCost: 290,
    falseFlagCost: 340,
    offensiveCost: 200,
    envoyDispatchStabilityDrop: 7,
    envoyArrivalStabilityDrop: 9,
    uprisingStabilityThreshold: 38,
    envoyTensionDelta: 30,
    falseFlagTensionDelta: 22,
    falseFlagWarThreshold: 82,
    playerSiegeSpeedMultiplier: 0.74,
    aiDefenseLossMultiplier: 1.35,
    defenderGarrisonMultiplier: 1.28,
    counterAttackChance: 1.0,
    peaceCouncilThreshold: 78,
    allowDirectPlayerCeasefireThreshold: 85,
  },
};

export function getWarDifficultyProfile(difficulty?: string | null): WarDifficultyProfile {
  if (!difficulty) return DIFFICULTY_PROFILES.NORMAL;
  return DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.NORMAL;
}

// Era-based historical memberships so every nation (including minor countries) displays accurate blocs
const NATO_2026 = new Set([
  "USA", "GBR", "FRA", "DEU", "TUR", "ITA", "CAN", "POL", "ESP", "NLD",
  "BEL", "PRT", "NOR", "DNK", "GRC", "BGR", "ROU", "HUN", "CZE", "SVK",
  "HRV", "FIN", "SWE",
]);

const NATO_1991 = new Set([
  "USA", "GBR", "FRA", "DEU", "FRG", "TUR", "ITA", "CAN", "ESP", "NLD",
  "BEL", "PRT", "NOR", "DNK", "GRC",
]);

const NATO_1962 = new Set([
  "USA", "GBR", "FRA", "FRG", "DEU", "TUR", "ITA", "CAN", "NLD", "BEL",
  "PRT", "NOR", "DNK", "GRC",
]);

const WARSAW_PACT_1962 = new Set([
  "SOV", "RUS", "GDR", "POL", "CSK", "CZE", "SVK", "HUN", "ROU", "BGR",
]);

const EU_2026 = new Set([
  "DEU", "FRA", "ITA", "ESP", "POL", "NLD", "BEL", "PRT", "GRC", "BGR",
  "ROU", "HUN", "AUT", "CZE", "SVK", "SWE", "FIN", "DNK", "IRL", "HRV", "CYP",
]);

const EC_1991 = new Set([
  "DEU", "FRG", "FRA", "GBR", "ITA", "ESP", "NLD", "BEL", "PRT", "GRC", "DNK", "IRL",
]);

const BRICS_2026 = new Set([
  "BRA", "RUS", "IND", "CHN", "ZAF", "IRN", "EGY", "ETH", "SAU",
]);

const SCO_2026 = new Set([
  "CHN", "RUS", "IND", "PAK", "IRN", "KAZ", "BLR",
]);

const OTS_2026 = new Set(["TUR", "AZE", "KAZ"]);

const ARAB_LEAGUE_MODERN = new Set([
  "EGY", "SAU", "IRQ", "SYR", "JOR", "LBN", "MAR", "DZA", "TUN", "LBY", "SDN", "PSE",
]);

const UNSC_P5 = new Set(["USA", "GBR", "FRA", "RUS", "SOV", "CHN"]);

const G7_MODERN = new Set(["USA", "GBR", "FRA", "DEU", "FRG", "ITA", "CAN", "JPN"]);

const ALLIES_WW2 = new Set([
  "USA", "GBR", "SOV", "FRA", "CHN", "CAN", "AUS", "NZL", "IND", "BRA",
  "POL", "GRC", "YUG", "NOR", "NLD", "BEL",
]);

const AXIS_WW2 = new Set(["GER", "ITA", "JPN", "HUN", "ROU", "BGR", "FIN", "THA"]);

const BALKAN_ENTENTE_1936 = new Set(["TUR", "GRC", "ROU", "YUG"]);
const LITTLE_ENTENTE_1936 = new Set(["CZE", "CSK", "ROU", "YUG", "FRA"]);

const ENTENTE_1914 = new Set(["GBR", "FRA", "KRS", "RUS", "SRB", "BEL", "JPN"]);
const CENTRAL_POWERS_1914 = new Set(["GER", "AHU", "OTT", "TUR", "BGR"]);

const NON_ALIGNED_1962 = new Set(["IND", "EGY", "YUG", "IDN", "ETH", "IRQ", "MAR", "DZA"]);
const CENTO_1962 = new Set(["TUR", "IRN", "PAK", "GBR"]);

export function parseYearFromSession(scenarioKey?: string | null, currentDate?: string | null): number {
  if (currentDate) {
    const m = /^(\d{4})/.exec(currentDate.trim());
    if (m) return Number(m[1]);
  }
  if (scenarioKey) {
    const m = /^(\d{4})/.exec(scenarioKey.trim());
    if (m) return Number(m[1]);
  }
  return 2026;
}

export function getCountryBlocsAndPacts(params: {
  countryCode: string;
  scenarioKey?: string | null;
  currentDate?: string | null;
  diplomacies?: Array<{
    countryA: string;
    countryB: string;
    status: string;
    treatyName: string | null;
  }>;
  locale?: AppLocale;
}): CountryBlocBadge[] {
  const {
    countryCode,
    scenarioKey,
    currentDate,
    diplomacies = [],
    locale = "tr",
  } = params;
  const isTr = locale === "tr";
  const code = countryCode.toUpperCase();
  const year = parseYearFromSession(scenarioKey, currentDate);

  const badges: CountryBlocBadge[] = [];
  const seenIds = new Set<string>();

  const pushBadge = (b: CountryBlocBadge) => {
    if (seenIds.has(b.id)) return;
    seenIds.add(b.id);
    badges.push(b);
  };

  const myDiplo = diplomacies.filter(
    (d) => d.countryA === code || d.countryB === code
  );
  const atWarWith = new Set(
    myDiplo
      .filter((d) => d.status === "WAR")
      .map((d) => (d.countryA === code ? d.countryB : d.countryA))
  );
  const activeAllianceTreaties = myDiplo
    .filter((d) => d.status === "ALLIANCE" && d.treatyName)
    .map((d) => d.treatyName!.trim());

  const hasExplicitNatoTreaty = activeAllianceTreaties.some((t) =>
    /nato/i.test(t)
  );
  const hasExplicitWarsawTreaty = activeAllianceTreaties.some((t) =>
    /varşova|warsaw/i.test(t)
  );

  // 1. Military Super-Blocs (NATO, Warsaw Pact, Axis, Allies, Entente, Central Powers)
  const inNatoByEra =
    (year >= 2004 && NATO_2026.has(code)) ||
    (year >= 1982 && year < 2004 && NATO_1991.has(code)) ||
    (year >= 1952 && year < 1982 && NATO_1962.has(code));

  if ((hasExplicitNatoTreaty || inNatoByEra) && !atWarWith.has("USA")) {
    pushBadge({
      id: "NATO",
      label: isTr ? "NATO (Kuzey Atlantik İttifakı)" : "NATO Alliance",
      shortLabel: "NATO",
      category: "MILITARY_BLOC",
      colorClass: "border-sky-500/50 bg-sky-500/15 text-sky-300",
    });
  }

  const inWarsawByEra = year >= 1955 && year <= 1990 && WARSAW_PACT_1962.has(code);
  if ((hasExplicitWarsawTreaty || inWarsawByEra) && !atWarWith.has("SOV") && !atWarWith.has("RUS")) {
    pushBadge({
      id: "WARSAW_PACT",
      label: isTr ? "Varşova Paktı" : "Warsaw Pact",
      shortLabel: isTr ? "Varşova Paktı" : "Warsaw Pact",
      category: "MILITARY_BLOC",
      colorClass: "border-red-500/50 bg-red-500/15 text-red-300",
    });
  }

  if (year >= 1955 && year <= 1979 && CENTO_1962.has(code)) {
    pushBadge({
      id: "CENTO",
      label: isTr ? "CENTO (Bağdat Paktı)" : "CENTO Pact",
      shortLabel: "CENTO",
      category: "MILITARY_BLOC",
      colorClass: "border-cyan-500/45 bg-cyan-500/15 text-cyan-300",
    });
  }

  if (year >= 1939 && year <= 1945) {
    if (AXIS_WW2.has(code) && !atWarWith.has("GER")) {
      pushBadge({
        id: "AXIS",
        label: isTr ? "Mihver Devletleri (Axis)" : "Axis Powers",
        shortLabel: isTr ? "Mihver Paktı" : "Axis",
        category: "MILITARY_BLOC",
        colorClass: "border-rose-500/50 bg-rose-500/15 text-rose-300",
      });
    } else if (ALLIES_WW2.has(code) && !atWarWith.has("GBR")) {
      pushBadge({
        id: "WW2_ALLIES",
        label: isTr ? "Müttefik Devletler (Allies)" : "Allied Powers",
        shortLabel: isTr ? "Müttefikler" : "Allies",
        category: "MILITARY_BLOC",
        colorClass: "border-blue-500/50 bg-blue-500/15 text-blue-300",
      });
    }
  }

  if (year >= 1934 && year <= 1938) {
    if (BALKAN_ENTENTE_1936.has(code)) {
      pushBadge({
        id: "BALKAN_ENTENTE",
        label: isTr ? "Balkan Antantı" : "Balkan Entente",
        shortLabel: isTr ? "Balkan Antantı" : "Balkan Pact",
        category: "MILITARY_BLOC",
        colorClass: "border-emerald-500/45 bg-emerald-500/15 text-emerald-300",
      });
    }
    if (LITTLE_ENTENTE_1936.has(code)) {
      pushBadge({
        id: "LITTLE_ENTENTE",
        label: isTr ? "Küçük Antant" : "Little Entente",
        shortLabel: isTr ? "Küçük Antant" : "Little Entente",
        category: "MILITARY_BLOC",
        colorClass: "border-teal-500/45 bg-teal-500/15 text-teal-300",
      });
    }
  }

  if (year >= 1914 && year <= 1918) {
    if (CENTRAL_POWERS_1914.has(code)) {
      pushBadge({
        id: "CENTRAL_POWERS",
        label: isTr ? "İttifak Devletleri" : "Central Powers",
        shortLabel: isTr ? "İttifak Bloku" : "Central Powers",
        category: "MILITARY_BLOC",
        colorClass: "border-amber-500/50 bg-amber-500/15 text-amber-300",
      });
    } else if (ENTENTE_1914.has(code)) {
      pushBadge({
        id: "TRIPLE_ENTENTE",
        label: isTr ? "İtilaf Devletleri" : "Triple Entente",
        shortLabel: isTr ? "İtilaf Bloku" : "Entente",
        category: "MILITARY_BLOC",
        colorClass: "border-sky-500/50 bg-sky-500/15 text-sky-300",
      });
    }
  }

  // 2. Supranational Economic & Political Unions (EU, BRICS, SCO, OTS, Arab League, UNSC, G7)
  if (year >= 1993 && EU_2026.has(code)) {
    pushBadge({
      id: "EU",
      label: isTr ? "Avrupa Birliği (AB)" : "European Union (EU)",
      shortLabel: isTr ? "AB (EU)" : "EU",
      category: "ECONOMIC_UNION",
      colorClass: "border-indigo-500/50 bg-indigo-500/15 text-indigo-300",
    });
  } else if (year >= 1957 && year < 1993 && EC_1991.has(code)) {
    pushBadge({
      id: "EC",
      label: isTr ? "Avrupa Topluluğu (AT)" : "European Community",
      shortLabel: isTr ? "AT (EC)" : "EC",
      category: "ECONOMIC_UNION",
      colorClass: "border-indigo-500/50 bg-indigo-500/15 text-indigo-300",
    });
  }

  if (year >= 2009 && BRICS_2026.has(code)) {
    pushBadge({
      id: "BRICS",
      label: "BRICS+",
      shortLabel: "BRICS+",
      category: "ECONOMIC_UNION",
      colorClass: "border-amber-500/50 bg-amber-500/15 text-amber-300",
    });
  }

  if (year >= 2001 && SCO_2026.has(code)) {
    pushBadge({
      id: "SCO",
      label: isTr ? "Şanghay İşbirliği Örgütü (ŞİÖ)" : "Shanghai Cooperation Org (SCO)",
      shortLabel: isTr ? "ŞİÖ (SCO)" : "SCO",
      category: "MILITARY_BLOC",
      colorClass: "border-orange-500/45 bg-orange-500/15 text-orange-300",
    });
  }

  if (year >= 2009 && OTS_2026.has(code)) {
    pushBadge({
      id: "OTS",
      label: isTr ? "Türk Devletleri Teşkilatı (TDT)" : "Org. of Turkic States (OTS)",
      shortLabel: isTr ? "TDT" : "OTS",
      category: "ECONOMIC_UNION",
      colorClass: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300",
    });
  }

  if (year >= 1945 && ARAB_LEAGUE_MODERN.has(code)) {
    pushBadge({
      id: "ARAB_LEAGUE",
      label: isTr ? "Arap Birliği" : "Arab League",
      shortLabel: isTr ? "Arap Birliği" : "Arab League",
      category: "GLOBAL_ORG",
      colorClass: "border-emerald-500/45 bg-emerald-500/15 text-emerald-300",
    });
  }

  if (year >= 1955 && year <= 1991 && NON_ALIGNED_1962.has(code)) {
    pushBadge({
      id: "NAM",
      label: isTr ? "Bağlantısızlar Hareketi" : "Non-Aligned Movement",
      shortLabel: isTr ? "Bağlantısızlar" : "Non-Aligned",
      category: "GLOBAL_ORG",
      colorClass: "border-teal-500/45 bg-teal-500/15 text-teal-300",
    });
  }

  if (year >= 1975 && G7_MODERN.has(code)) {
    pushBadge({
      id: "G7",
      label: "G7",
      shortLabel: "G7",
      category: "ECONOMIC_UNION",
      colorClass: "border-blue-400/45 bg-blue-500/10 text-blue-200",
    });
  }

  if (year >= 1945 && UNSC_P5.has(code)) {
    pushBadge({
      id: "UNSC_P5",
      label: isTr ? "BM Güvenlik Konseyi (Daimi Veto)" : "UN Security Council (P5)",
      shortLabel: isTr ? "BMGK (P5)" : "UNSC P5",
      category: "GLOBAL_ORG",
      colorClass: "border-purple-500/50 bg-purple-500/15 text-purple-300",
    });
  }

  // 3. Custom Live Named Treaties from Session Diplomacies (e.g. Şuşa Beyannamesi, AUKUS, player treaties)
  for (const rel of myDiplo) {
    if (!rel.treatyName) continue;
    if (rel.status !== "ALLIANCE" && rel.status !== "NON_AGGRESSION" && rel.status !== "VASSAL") {
      continue;
    }
    const tName = rel.treatyName.trim();
    const tLow = tName.toLocaleLowerCase("tr-TR");
    if (tLow.includes("nato") && !tLow.includes("aukus") && !tLow.includes("norad") && seenIds.has("NATO")) continue;
    if ((tLow.includes("varşova") || tLow.includes("warsaw")) && seenIds.has("WARSAW_PACT")) continue;
    if (tLow.includes("balkan") && seenIds.has("BALKAN_ENTENTE")) continue;
    if (tLow.includes("mihver") && seenIds.has("AXIS")) continue;

    const id = `TREATY_${tName.toUpperCase()}`;
    pushBadge({
      id,
      label: tName,
      shortLabel: tName.length > 22 ? `${tName.slice(0, 20)}…` : tName,
      category: "TREATY",
      colorClass:
        rel.status === "ALLIANCE"
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
          : rel.status === "VASSAL"
            ? "border-purple-500/45 bg-purple-500/15 text-purple-300"
            : "border-amber-500/45 bg-amber-500/15 text-amber-300",
    });
  }

  return badges;
}

/**
 * Evaluate whether two warring nations are willing to accept a Peace Council resolution
 * based on War Exhaustion, Stability, Military Balance, Difficulty, and Mediation Package.
 */
export function evaluatePeaceCouncilReadiness(params: {
  countryA: {
    code: string;
    name: string;
    military: number;
    stability: number;
    warExhaustion: number;
  };
  countryB: {
    code: string;
    name: string;
    military: number;
    stability: number;
    warExhaustion: number;
  };
  mediatorMilitary: number;
  attendeeCount: number;
  majorAttendeeCount: number;
  difficulty?: string | null;
  proposalType?: "WHITE_PEACE" | "MEDIATED_PACKAGE" | "COERCIVE_COALITION";
  locale?: AppLocale;
}) {
  const {
    countryA,
    countryB,
    mediatorMilitary,
    attendeeCount,
    majorAttendeeCount,
    difficulty,
    proposalType = "WHITE_PEACE",
    locale = "tr",
  } = params;
  const isTr = locale === "tr";
  const prof = getWarDifficultyProfile(difficulty);

  const avgExhaustion = (countryA.warExhaustion + countryB.warExhaustion) / 2;
  const maxExhaustion = Math.max(countryA.warExhaustion, countryB.warExhaustion);
  const minStability = Math.min(countryA.stability, countryB.stability);
  const milGap = Math.abs(countryA.military - countryB.military);

  // Base readiness from exhaustion, low stability, and multilateral council weight
  let readiness =
    20 +
    avgExhaustion * 0.55 +
    maxExhaustion * 0.25 +
    Math.max(0, (65 - minStability) * 0.45) +
    Math.min(18, majorAttendeeCount * 4 + attendeeCount * 1.5) +
    Math.min(12, mediatorMilitary * 0.14) -
    Math.max(0, (milGap - 18) * 0.35); // lopsided winner resists white peace unless pressured

  if (proposalType === "MEDIATED_PACKAGE") {
    readiness += 22;
  } else if (proposalType === "COERCIVE_COALITION") {
    readiness += 28;
  }

  const score = Math.round(clamp(readiness, 8, 98));
  const accepted = score >= prof.peaceCouncilThreshold;

  const packageCost =
    proposalType === "MEDIATED_PACKAGE"
      ? Math.round(220 * prof.costMultiplier)
      : proposalType === "COERCIVE_COALITION"
        ? Math.round(160 * prof.costMultiplier)
        : 0;

  const reason = accepted
    ? isTr
      ? `Konsey uzlaşısı sağlandı (%${score} >= %${prof.peaceCouncilThreshold} eşiği): Taraflar çok uluslu garantörlük altında ateşkesi kabul etti.`
      : `Council consensus reached (${score}% >= ${prof.peaceCouncilThreshold}% threshold): Belligerents accepted the multilateral ceasefire.`
    : isTr
      ? `Barış oylaması reddedildi (%${score} < %${prof.peaceCouncilThreshold} zorluk eşiği): Cephede üstün olan taraf henüz savaşı bırakmak istemiyor — cephe yorgunluğu artmalı veya Garantör Fonu / Koalisyon Ültimatomu sunulmalı.`
      : `Peace vote rejected (${score}% < ${prof.peaceCouncilThreshold}% difficulty threshold): The stronger belligerent refuses to halt operations yet — increase war exhaustion or offer a Reconstruction / Coalition Ultimatum package.`;

  return {
    score,
    threshold: prof.peaceCouncilThreshold,
    accepted,
    packageCost,
    reason,
  };
}
