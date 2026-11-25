import type { AppLocale } from "@/lib/i18n";
import type { RegionRecord } from "@/lib/client-types";

export type MacroRegion =
  | "EUROPE"
  | "EAST_EUROPE"
  | "TURKEY_LEVANT"
  | "NORTH_AMERICA"
  | "LATAM"
  | "EAST_ASIA"
  | "SOUTH_ASIA"
  | "AFRICA"
  | "OCEANIA";

export interface PeopleGroupMeta {
  labelTr: string;
  labelEn: string;
  color: string;
}

export interface DemographicSlice {
  id: string;
  label: string;
  labelTr: string;
  labelEn: string;
  color: string;
  populationMillions: number;
  percent: number;
}

export interface CountryDemographicsSummary {
  totalPopulationMillions: number;
  formattedPopulation: string;
  majority: DemographicSlice | null;
  groups: DemographicSlice[];
  provinceCount: number;
}

export interface RegionDemographicsSummary {
  populationMillions: number;
  formattedPopulation: string;
  majority: DemographicSlice | null;
  groups: DemographicSlice[];
}

interface ShareSpec {
  id: string;
  share: number;
}

interface RegionDemographicProfile {
  pop2026M: number;
  macro: MacroRegion;
  groups: ShareSpec[];
  pre1991Groups?: ShareSpec[];
  pre1946Groups?: ShareSpec[];
  pre1800Groups?: ShareSpec[];
  baseTr?: string;
  baseEn?: string;
}

/**
 * Known ethnic, national, and cultural peoples with distinct colors for stacked demographic bars.
 * Unlisted single-province territories inherit clean country demonyms cleanly via PEOPLE_FALLBACK.
 */
const PEOPLE_GROUPS: Record<string, PeopleGroupMeta> = {
  german: { labelTr: "Alman", labelEn: "German", color: "#fbbf24" },
  austrian: { labelTr: "Avusturyalı", labelEn: "Austrian", color: "#f59e0b" },
  swiss_german: { labelTr: "Alman (İsviçreli)", labelEn: "Swiss German", color: "#fcd34d" },
  turkish: { labelTr: "Türk", labelEn: "Turkish", color: "#ef4444" },
  kurdish: { labelTr: "Kürt", labelEn: "Kurdish", color: "#10b981" },
  turkmen_other: { labelTr: "Türkmen & Diğer", labelEn: "Turkmen & Other", color: "#f97316" },
  azeri: { labelTr: "Azerbaycan Türkü", labelEn: "Azerbaijani", color: "#06b6d4" },
  russian: { labelTr: "Rus", labelEn: "Russian", color: "#3b82f6" },
  ukrainian: { labelTr: "Ukraynalı", labelEn: "Ukrainian", color: "#facc15" },
  caucasus_tatar: { labelTr: "Tatar & Kafkas", labelEn: "Tatar & Caucasian", color: "#a855f7" },
  french: { labelTr: "Fransız", labelEn: "French", color: "#60a5fa" },
  english: { labelTr: "İngiliz", labelEn: "English", color: "#f43f5e" },
  scottish: { labelTr: "İskoç", labelEn: "Scottish", color: "#38bdf8" },
  welsh_irish: { labelTr: "İrlandalı & Kelt", labelEn: "Irish & Celtic", color: "#22c55e" },
  italian: { labelTr: "İtalyan", labelEn: "Italian", color: "#34d399" },
  spanish: { labelTr: "İspanyol", labelEn: "Spanish", color: "#fb923c" },
  catalan_basque: { labelTr: "Katalan & Bask", labelEn: "Catalan & Basque", color: "#e879f9" },
  portuguese: { labelTr: "Portekizli", labelEn: "Portuguese", color: "#14b8a6" },
  polish: { labelTr: "Polonyalı", labelEn: "Polish", color: "#ec4899" },
  greek: { labelTr: "Yunan / Rum", labelEn: "Greek", color: "#0ea5e9" },
  bulgarian: { labelTr: "Bulgar", labelEn: "Bulgarian", color: "#4ade80" },
  serbian: { labelTr: "Sırp", labelEn: "Serbian", color: "#6366f1" },
  croatian: { labelTr: "Hırvat", labelEn: "Croatian", color: "#f472b6" },
  bosnian: { labelTr: "Boşnak", labelEn: "Bosniak", color: "#2dd4bf" },
  albanian: { labelTr: "Arnavut", labelEn: "Albanian", color: "#dc2626" },
  romanian: { labelTr: "Rumen", labelEn: "Romanian", color: "#eab308" },
  hungarian: { labelTr: "Macar", labelEn: "Hungarian", color: "#84cc16" },
  czech: { labelTr: "Çek", labelEn: "Czech", color: "#818cf8" },
  slovak: { labelTr: "Slovak", labelEn: "Slovak", color: "#a78bfa" },
  dutch: { labelTr: "Hollandalı", labelEn: "Dutch", color: "#f97316" },
  flemish: { labelTr: "Flaman", labelEn: "Flemish", color: "#fbbf24" },
  walloon: { labelTr: "Valon", labelEn: "Walloon", color: "#60a5fa" },
  swedish: { labelTr: "İsveçli", labelEn: "Swedish", color: "#38bdf8" },
  norwegian: { labelTr: "Norveçli", labelEn: "Norwegian", color: "#0284c7" },
  danish: { labelTr: "Danimarkalı", labelEn: "Danish", color: "#f43f5e" },
  finnish: { labelTr: "Finli", labelEn: "Finnish", color: "#93c5fd" },
  belarusian: { labelTr: "Belaruslu", labelEn: "Belarusian", color: "#86efac" },
  georgian: { labelTr: "Gürcü", labelEn: "Georgian", color: "#fb7185" },
  armenian: { labelTr: "Ermeni", labelEn: "Armenian", color: "#f59e0b" },
  american: { labelTr: "Amerikalı", labelEn: "American", color: "#3b82f6" },
  canadian: { labelTr: "Kanadalı", labelEn: "Canadian", color: "#ef4444" },
  hispanic: { labelTr: "Hispanik / Latin", labelEn: "Hispanic / Latino", color: "#f59e0b" },
  mexican: { labelTr: "Meksikalı", labelEn: "Mexican", color: "#10b981" },
  brazilian: { labelTr: "Brezilyalı", labelEn: "Brazilian", color: "#22c55e" },
  argentine: { labelTr: "Arjantinli", labelEn: "Argentine", color: "#38bdf8" },
  colombian: { labelTr: "Kolombiyalı", labelEn: "Colombian", color: "#facc15" },
  peruvian: { labelTr: "Perulu", labelEn: "Peruvian", color: "#ef4444" },
  chilean: { labelTr: "Şilili", labelEn: "Chilean", color: "#60a5fa" },
  venezuelan: { labelTr: "Venezuelalı", labelEn: "Venezuelan", color: "#fbbf24" },
  indigenous_americas: { labelTr: "Amerikan Yerlisi", labelEn: "Indigenous", color: "#d97706" },
  han_chinese: { labelTr: "Han Çinli", labelEn: "Han Chinese", color: "#ef4444" },
  tibetan_uyghur: { labelTr: "Uygur & Tibetli", labelEn: "Uyghur & Tibetan", color: "#38bdf8" },
  japanese: { labelTr: "Japon", labelEn: "Japanese", color: "#f43f5e" },
  korean: { labelTr: "Koreli", labelEn: "Korean", color: "#60a5fa" },
  north_indian: { labelTr: "Hint (Kuzey / Indo-Ari)", labelEn: "North Indian", color: "#f97316" },
  south_indian: { labelTr: "Hint (Güney / Dravid)", labelEn: "South Indian", color: "#fb923c" },
  pakistani: { labelTr: "Pencabi & Sindhi (Pakistan)", labelEn: "Pakistani", color: "#10b981" },
  pashtun: { labelTr: "Peştun", labelEn: "Pashtun", color: "#14b8a6" },
  tajik: { labelTr: "Tacik", labelEn: "Tajik", color: "#8b5cf6" },
  bengali: { labelTr: "Bengalli", labelEn: "Bengali", color: "#22c55e" },
  persian: { labelTr: "Fars", labelEn: "Persian", color: "#a855f7" },
  arab: { labelTr: "Arap", labelEn: "Arab", color: "#10b981" },
  egyptian: { labelTr: "Mısırlı (Arap)", labelEn: "Egyptian", color: "#eab308" },
  maghrebi: { labelTr: "Mağripli / Berberî & Arap", labelEn: "Maghrebi", color: "#2dd4bf" },
  jewish: { labelTr: "Yahudi", labelEn: "Jewish", color: "#38bdf8" },
  kazakh: { labelTr: "Kazak", labelEn: "Kazakh", color: "#06b6d4" },
  uzbek: { labelTr: "Özbek", labelEn: "Uzbek", color: "#14b8a6" },
  turkmen: { labelTr: "Türkmen", labelEn: "Turkmen", color: "#34d399" },
  indonesian: { labelTr: "Endonezyalı / Cava", labelEn: "Indonesian", color: "#ef4444" },
  malay: { labelTr: "Malay", labelEn: "Malay", color: "#eab308" },
  vietnamese: { labelTr: "Vietnamlı", labelEn: "Vietnamese", color: "#f43f5e" },
  thai: { labelTr: "Tay", labelEn: "Thai", color: "#6366f1" },
  filipino: { labelTr: "Filipinli", labelEn: "Filipino", color: "#3b82f6" },
  burmese: { labelTr: "Birmanyalı", labelEn: "Burmese", color: "#f59e0b" },
  ethiopian: { labelTr: "Etiyopyalı", labelEn: "Ethiopian", color: "#22c55e" },
  nigerian: { labelTr: "Nijeryalı (Hausa/Yoruba/Igbo)", labelEn: "Nigerian", color: "#10b981" },
  congolese: { labelTr: "Kongolu (Bantu)", labelEn: "Congolese", color: "#eab308" },
  south_african: { labelTr: "Güney Afrikalı", labelEn: "South African", color: "#14b8a6" },
  australian: { labelTr: "Avustralyalı", labelEn: "Australian", color: "#0ea5e9" },
  other: { labelTr: "Diğer Azınlıklar", labelEn: "Other Minorities", color: "#64748b" },
};

const MACRO_ERA_CURVE: Record<MacroRegion, Array<[number, number]>> = {
  EUROPE: [
    [1444, 0.16],
    [1526, 0.19],
    [1812, 0.34],
    [1877, 0.52],
    [1914, 0.72],
    [1936, 0.80],
    [1962, 0.86],
    [1991, 0.94],
    [2026, 1.0],
  ],
  EAST_EUROPE: [
    [1444, 0.14],
    [1526, 0.17],
    [1812, 0.36],
    [1877, 0.62],
    [1914, 0.84],
    [1936, 0.85],
    [1962, 0.94],
    [1991, 1.03],
    [2026, 1.0],
  ],
  TURKEY_LEVANT: [
    [1444, 0.085],
    [1526, 0.098],
    [1812, 0.125],
    [1877, 0.155],
    [1914, 0.18],
    [1936, 0.192],
    [1962, 0.34],
    [1991, 0.66],
    [2026, 1.0],
  ],
  NORTH_AMERICA: [
    [1444, 0.015],
    [1526, 0.014],
    [1812, 0.025],
    [1877, 0.14],
    [1914, 0.29],
    [1936, 0.38],
    [1962, 0.55],
    [1991, 0.76],
    [2026, 1.0],
  ],
  LATAM: [
    [1444, 0.055],
    [1526, 0.045],
    [1812, 0.045],
    [1877, 0.085],
    [1914, 0.14],
    [1936, 0.19],
    [1962, 0.36],
    [1991, 0.68],
    [2026, 1.0],
  ],
  EAST_ASIA: [
    [1444, 0.085],
    [1526, 0.105],
    [1812, 0.25],
    [1877, 0.28],
    [1914, 0.33],
    [1936, 0.37],
    [1962, 0.51],
    [1991, 0.82],
    [2026, 1.0],
  ],
  SOUTH_ASIA: [
    [1444, 0.075],
    [1526, 0.085],
    [1812, 0.13],
    [1877, 0.16],
    [1914, 0.19],
    [1936, 0.22],
    [1962, 0.35],
    [1991, 0.64],
    [2026, 1.0],
  ],
  AFRICA: [
    [1444, 0.04],
    [1526, 0.045],
    [1812, 0.06],
    [1877, 0.075],
    [1914, 0.095],
    [1936, 0.125],
    [1962, 0.21],
    [1991, 0.45],
    [2026, 1.0],
  ],
  OCEANIA: [
    [1444, 0.025],
    [1526, 0.025],
    [1812, 0.045],
    [1877, 0.10],
    [1914, 0.20],
    [1936, 0.27],
    [1962, 0.42],
    [1991, 0.65],
    [2026, 1.0],
  ],
};

function interpolateEraMultiplier(year: number, macro: MacroRegion): number {
  const curve = MACRO_ERA_CURVE[macro];
  if (year <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (year >= last[0]) return last[1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [y0, m0] = curve[i];
    const [y1, m1] = curve[i + 1];
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0);
      return m0 + t * (m1 - m0);
    }
  }
  return 1.0;
}

/** Province-accurate 2026 population (Millions) & internal national/ethnic shares. */
const REGION_PROFILES: Record<string, RegionDemographicProfile> = {
  // TURKEY (~85.6M)
  TUR_MARMARA: {
    pop2026M: 27.6,
    macro: "TURKEY_LEVANT",
    groups: [{ id: "turkish", share: 0.87 }, { id: "kurdish", share: 0.08 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "turkish", share: 0.72 }, { id: "greek", share: 0.21 }, { id: "other", share: 0.07 }],
  },
  TUR_AEGEAN: {
    pop2026M: 18.2,
    macro: "TURKEY_LEVANT",
    groups: [{ id: "turkish", share: 0.89 }, { id: "kurdish", share: 0.06 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "turkish", share: 0.75 }, { id: "greek", share: 0.20 }, { id: "other", share: 0.05 }],
  },
  TUR_ANATOLIA: {
    pop2026M: 24.7,
    macro: "TURKEY_LEVANT",
    groups: [{ id: "turkish", share: 0.88 }, { id: "kurdish", share: 0.07 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "turkish", share: 0.82 }, { id: "greek", share: 0.10 }, { id: "armenian", share: 0.08 }],
  },
  TUR_EAST: {
    pop2026M: 15.1,
    macro: "TURKEY_LEVANT",
    groups: [{ id: "kurdish", share: 0.54 }, { id: "turkish", share: 0.39 }, { id: "arab", share: 0.04 }, { id: "other", share: 0.03 }],
    pre1800Groups: [{ id: "kurdish", share: 0.44 }, { id: "turkish", share: 0.36 }, { id: "armenian", share: 0.16 }, { id: "arab", share: 0.04 }],
  },

  // GERMANY (~84.5M)
  DEU_RHINELAND: {
    pop2026M: 29.5,
    macro: "EUROPE",
    groups: [{ id: "german", share: 0.84 }, { id: "turkish", share: 0.06 }, { id: "other", share: 0.10 }],
    pre1946Groups: [{ id: "german", share: 0.97 }, { id: "other", share: 0.03 }],
  },
  DEU_BAVARIA: {
    pop2026M: 24.5,
    macro: "EUROPE",
    groups: [{ id: "german", share: 0.86 }, { id: "turkish", share: 0.04 }, { id: "other", share: 0.10 }],
    pre1946Groups: [{ id: "german", share: 0.98 }, { id: "other", share: 0.02 }],
  },
  DEU_PRUSSIA: {
    pop2026M: 16.0,
    macro: "EUROPE",
    groups: [{ id: "german", share: 0.87 }, { id: "turkish", share: 0.04 }, { id: "polish", share: 0.03 }, { id: "other", share: 0.06 }],
    pre1946Groups: [{ id: "german", share: 0.95 }, { id: "polish", share: 0.04 }, { id: "other", share: 0.01 }],
  },
  DEU_SAXONY: {
    pop2026M: 14.5,
    macro: "EUROPE",
    groups: [{ id: "german", share: 0.92 }, { id: "other", share: 0.08 }],
    pre1946Groups: [{ id: "german", share: 0.98 }, { id: "other", share: 0.02 }],
  },

  // RUSSIA (~144M)
  RUS_MOSCOW: {
    pop2026M: 56.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "russian", share: 0.90 }, { id: "ukrainian", share: 0.03 }, { id: "other", share: 0.07 }],
  },
  RUS_LENINGRAD: {
    pop2026M: 16.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "russian", share: 0.88 }, { id: "finnish", share: 0.04 }, { id: "other", share: 0.08 }],
  },
  RUS_CAUCASUS: {
    pop2026M: 28.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "russian", share: 0.62 }, { id: "caucasus_tatar", share: 0.30 }, { id: "other", share: 0.08 }],
  },
  RUS_URALS: {
    pop2026M: 24.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "russian", share: 0.78 }, { id: "caucasus_tatar", share: 0.16 }, { id: "other", share: 0.06 }],
  },
  RUS_FAR_EAST: {
    pop2026M: 20.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "russian", share: 0.85 }, { id: "caucasus_tatar", share: 0.08 }, { id: "other", share: 0.07 }],
  },

  // USA (~336M)
  USA_NORTHEAST: {
    pop2026M: 75.0,
    macro: "NORTH_AMERICA",
    groups: [{ id: "american", share: 0.78 }, { id: "hispanic", share: 0.13 }, { id: "other", share: 0.09 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.94 }, { id: "english", share: 0.06 }],
  },
  USA_SOUTH: {
    pop2026M: 129.0,
    macro: "NORTH_AMERICA",
    groups: [{ id: "american", share: 0.76 }, { id: "hispanic", share: 0.19 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.96 }, { id: "spanish", share: 0.04 }],
  },
  USA_MIDWEST: {
    pop2026M: 69.0,
    macro: "NORTH_AMERICA",
    groups: [{ id: "american", share: 0.85 }, { id: "hispanic", share: 0.09 }, { id: "other", share: 0.06 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.98 }, { id: "french", share: 0.02 }],
  },
  USA_WEST: {
    pop2026M: 62.0,
    macro: "NORTH_AMERICA",
    groups: [{ id: "american", share: 0.61 }, { id: "hispanic", share: 0.29 }, { id: "han_chinese", share: 0.05 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.97 }, { id: "spanish", share: 0.03 }],
  },
  USA_ALASKA: {
    pop2026M: 1.1,
    macro: "NORTH_AMERICA",
    groups: [{ id: "american", share: 0.77 }, { id: "indigenous_americas", share: 0.18 }, { id: "other", share: 0.05 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.98 }, { id: "russian", share: 0.02 }],
  },

  // FRANCE (~68.3M)
  FRA_ILE_DE_FRANCE: { pop2026M: 22.0, macro: "EUROPE", groups: [{ id: "french", share: 0.84 }, { id: "maghrebi", share: 0.08 }, { id: "other", share: 0.08 }], pre1946Groups: [{ id: "french", share: 0.96 }, { id: "other", share: 0.04 }] },
  FRA_NORMANDY: { pop2026M: 14.0, macro: "EUROPE", groups: [{ id: "french", share: 0.92 }, { id: "other", share: 0.08 }] },
  FRA_AQUITAINE: { pop2026M: 21.5, macro: "EUROPE", groups: [{ id: "french", share: 0.88 }, { id: "spanish", share: 0.04 }, { id: "other", share: 0.08 }] },
  FRA_ALSACE: {
    pop2026M: 10.5,
    macro: "EUROPE",
    groups: [{ id: "french", share: 0.80 }, { id: "german", share: 0.13 }, { id: "other", share: 0.07 }],
    pre1946Groups: [{ id: "french", share: 0.56 }, { id: "german", share: 0.42 }, { id: "other", share: 0.02 }],
  },
  FRA_GUIANA: { pop2026M: 0.35, macro: "LATAM", groups: [{ id: "french", share: 0.65 }, { id: "brazilian", share: 0.20 }, { id: "other", share: 0.15 }] },

  // UK (~68.1M)
  GBR_ENGLAND: { pop2026M: 62.5, macro: "EUROPE", groups: [{ id: "english", share: 0.82 }, { id: "welsh_irish", share: 0.06 }, { id: "other", share: 0.12 }], pre1946Groups: [{ id: "english", share: 0.93 }, { id: "welsh_irish", share: 0.05 }, { id: "other", share: 0.02 }] },
  GBR_SCOTLAND: { pop2026M: 5.6, macro: "EUROPE", groups: [{ id: "scottish", share: 0.88 }, { id: "english", share: 0.09 }, { id: "other", share: 0.03 }] },

  // ITALY (~58.8M)
  ITA_NORTH: { pop2026M: 30.2, macro: "EUROPE", groups: [{ id: "italian", share: 0.90 }, { id: "german", share: 0.02 }, { id: "other", share: 0.08 }] },
  ITA_SOUTH: { pop2026M: 28.6, macro: "EUROPE", groups: [{ id: "italian", share: 0.94 }, { id: "other", share: 0.06 }] },

  // SPAIN (~48M)
  ESP_CASTILE: { pop2026M: 34.5, macro: "EUROPE", groups: [{ id: "spanish", share: 0.89 }, { id: "hispanic", share: 0.06 }, { id: "other", share: 0.05 }], pre1946Groups: [{ id: "spanish", share: 0.97 }, { id: "other", share: 0.03 }] },
  ESP_NORTH: { pop2026M: 13.5, macro: "EUROPE", groups: [{ id: "catalan_basque", share: 0.61 }, { id: "spanish", share: 0.34 }, { id: "other", share: 0.05 }] },

  // POLAND (~37.5M)
  POL_WARSAW: { pop2026M: 22.5, macro: "EAST_EUROPE", groups: [{ id: "polish", share: 0.95 }, { id: "ukrainian", share: 0.03 }, { id: "other", share: 0.02 }] },
  POL_WEST: {
    pop2026M: 15.0,
    macro: "EAST_EUROPE",
    groups: [{ id: "polish", share: 0.94 }, { id: "german", share: 0.03 }, { id: "other", share: 0.03 }],
    pre1946Groups: [{ id: "german", share: 0.56 }, { id: "polish", share: 0.42 }, { id: "other", share: 0.02 }],
  },

  // UKRAINE (~38M)
  UKR_WEST: { pop2026M: 21.5, macro: "EAST_EUROPE", groups: [{ id: "ukrainian", share: 0.91 }, { id: "russian", share: 0.05 }, { id: "other", share: 0.04 }] },
  UKR_EAST: { pop2026M: 16.5, macro: "EAST_EUROPE", groups: [{ id: "ukrainian", share: 0.61 }, { id: "russian", share: 0.33 }, { id: "caucasus_tatar", share: 0.03 }, { id: "other", share: 0.03 }] },

  // IRAN (~89M)
  IRN_WEST: { pop2026M: 59.0, macro: "TURKEY_LEVANT", groups: [{ id: "persian", share: 0.51 }, { id: "azeri", share: 0.27 }, { id: "kurdish", share: 0.14 }, { id: "arab", share: 0.08 }] },
  IRN_EAST: { pop2026M: 30.0, macro: "TURKEY_LEVANT", groups: [{ id: "persian", share: 0.74 }, { id: "turkmen_other", share: 0.12 }, { id: "other", share: 0.14 }] },

  // EGYPT (~113M)
  EGY_DELTA: { pop2026M: 78.0, macro: "TURKEY_LEVANT", groups: [{ id: "egyptian", share: 0.94 }, { id: "other", share: 0.06 }] },
  EGY_UPPER: { pop2026M: 35.0, macro: "TURKEY_LEVANT", groups: [{ id: "egyptian", share: 0.93 }, { id: "other", share: 0.07 }] },

  // CHINA (~1,408M)
  CHN_SOUTH: { pop2026M: 640.0, macro: "EAST_ASIA", groups: [{ id: "han_chinese", share: 0.94 }, { id: "other", share: 0.06 }] },
  CHN_NORTH: { pop2026M: 580.0, macro: "EAST_ASIA", groups: [{ id: "han_chinese", share: 0.95 }, { id: "other", share: 0.05 }] },
  CHN_MANCHURIA: { pop2026M: 102.0, macro: "EAST_ASIA", groups: [{ id: "han_chinese", share: 0.89 }, { id: "korean", share: 0.03 }, { id: "other", share: 0.08 }] },
  CHN_WEST: { pop2026M: 86.0, macro: "EAST_ASIA", groups: [{ id: "tibetan_uyghur", share: 0.48 }, { id: "han_chinese", share: 0.43 }, { id: "kazakh", share: 0.05 }, { id: "other", share: 0.04 }] },

  // INDIA (~1,440M)
  IND_NORTH: { pop2026M: 845.0, macro: "SOUTH_ASIA", groups: [{ id: "north_indian", share: 0.82 }, { id: "bengali", share: 0.11 }, { id: "other", share: 0.07 }] },
  IND_SOUTH: { pop2026M: 595.0, macro: "SOUTH_ASIA", groups: [{ id: "south_indian", share: 0.86 }, { id: "north_indian", share: 0.10 }, { id: "other", share: 0.04 }] },

  // JAPAN (~123M)
  JPN_HONSHU: { pop2026M: 98.0, macro: "EAST_ASIA", groups: [{ id: "japanese", share: 0.97 }, { id: "other", share: 0.03 }] },
  JPN_NORTH: { pop2026M: 25.0, macro: "EAST_ASIA", groups: [{ id: "japanese", share: 0.98 }, { id: "other", share: 0.02 }] },

  // BRAZIL (~216M)
  BRA_COAST: {
    pop2026M: 176.0,
    macro: "LATAM",
    groups: [{ id: "brazilian", share: 0.94 }, { id: "other", share: 0.06 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.42 }, { id: "portuguese", share: 0.34 }, { id: "other", share: 0.24 }],
  },
  BRA_AMAZON: {
    pop2026M: 40.0,
    macro: "LATAM",
    groups: [{ id: "brazilian", share: 0.87 }, { id: "indigenous_americas", share: 0.09 }, { id: "other", share: 0.04 }],
    pre1800Groups: [{ id: "indigenous_americas", share: 0.88 }, { id: "portuguese", share: 0.12 }],
  },

  // MAJOR & REGIONAL SINGLE-PROVINCE COUNTRIES
  IDN: { pop2026M: 281.0, macro: "EAST_ASIA", groups: [{ id: "indonesian", share: 0.84 }, { id: "malay", share: 0.08 }, { id: "other", share: 0.08 }] },
  PAK: { pop2026M: 247.0, macro: "SOUTH_ASIA", groups: [{ id: "pakistani", share: 0.78 }, { id: "pashtun", share: 0.18 }, { id: "other", share: 0.04 }] },
  NGA: { pop2026M: 228.0, macro: "AFRICA", groups: [{ id: "nigerian", share: 0.95 }, { id: "other", share: 0.05 }] },
  BGD: { pop2026M: 174.0, macro: "SOUTH_ASIA", groups: [{ id: "bengali", share: 0.98 }, { id: "other", share: 0.02 }] },
  MEX: { pop2026M: 130.0, macro: "LATAM", groups: [{ id: "mexican", share: 0.83 }, { id: "indigenous_americas", share: 0.15 }, { id: "other", share: 0.02 }], pre1800Groups: [{ id: "indigenous_americas", share: 0.72 }, { id: "spanish", share: 0.28 }] },
  ETH: { pop2026M: 129.0, macro: "AFRICA", groups: [{ id: "ethiopian", share: 0.96 }, { id: "other", share: 0.04 }] },
  PHL: { pop2026M: 118.0, macro: "EAST_ASIA", groups: [{ id: "filipino", share: 0.95 }, { id: "other", share: 0.05 }] },
  COD: { pop2026M: 106.0, macro: "AFRICA", groups: [{ id: "congolese", share: 0.96 }, { id: "other", share: 0.04 }] },
  VNM: { pop2026M: 101.0, macro: "EAST_ASIA", groups: [{ id: "vietnamese", share: 0.87 }, { id: "other", share: 0.13 }] },
  THA: { pop2026M: 71.8, macro: "EAST_ASIA", groups: [{ id: "thai", share: 0.91 }, { id: "malay", share: 0.04 }, { id: "other", share: 0.05 }] },
  ZAF: { pop2026M: 63.2, macro: "AFRICA", groups: [{ id: "south_african", share: 0.90 }, { id: "dutch", share: 0.05 }, { id: "english", share: 0.05 }] },
  MMR: { pop2026M: 54.8, macro: "EAST_ASIA", groups: [{ id: "burmese", share: 0.72 }, { id: "other", share: 0.28 }] },
  COL: { pop2026M: 52.8, macro: "LATAM", groups: [{ id: "colombian", share: 0.93 }, { id: "indigenous_americas", share: 0.04 }, { id: "other", share: 0.03 }] },
  KOR: { pop2026M: 51.7, macro: "EAST_ASIA", groups: [{ id: "korean", share: 0.96 }, { id: "other", share: 0.04 }] },
  ARG: { pop2026M: 46.7, macro: "LATAM", groups: [{ id: "argentine", share: 0.92 }, { id: "italian", share: 0.04 }, { id: "indigenous_americas", share: 0.04 }] },
  DZA: { pop2026M: 46.5, macro: "TURKEY_LEVANT", groups: [{ id: "maghrebi", share: 0.97 }, { id: "other", share: 0.03 }] },
  IRQ: { pop2026M: 46.0, macro: "TURKEY_LEVANT", groups: [{ id: "arab", share: 0.76 }, { id: "kurdish", share: 0.18 }, { id: "turkmen_other", share: 0.06 }] },
  AFG: { pop2026M: 43.0, macro: "SOUTH_ASIA", groups: [{ id: "pashtun", share: 0.44 }, { id: "tajik", share: 0.29 }, { id: "uzbek", share: 0.11 }, { id: "other", share: 0.16 }] },
  CAN: { pop2026M: 41.2, macro: "NORTH_AMERICA", groups: [{ id: "canadian", share: 0.71 }, { id: "french", share: 0.21 }, { id: "indigenous_americas", share: 0.05 }, { id: "other", share: 0.03 }], pre1800Groups: [{ id: "indigenous_americas", share: 0.85 }, { id: "french", share: 0.10 }, { id: "english", share: 0.05 }] },
  MAR: { pop2026M: 38.1, macro: "TURKEY_LEVANT", groups: [{ id: "maghrebi", share: 0.98 }, { id: "other", share: 0.02 }] },
  SAU: { pop2026M: 37.4, macro: "TURKEY_LEVANT", groups: [{ id: "arab", share: 0.88 }, { id: "other", share: 0.12 }], pre1946Groups: [{ id: "arab", share: 0.97 }, { id: "other", share: 0.03 }] },
  UZB: { pop2026M: 36.5, macro: "TURKEY_LEVANT", groups: [{ id: "uzbek", share: 0.85 }, { id: "tajik", share: 0.05 }, { id: "russian", share: 0.03 }, { id: "other", share: 0.07 }] },
  MYS: { pop2026M: 34.6, macro: "EAST_ASIA", groups: [{ id: "malay", share: 0.69 }, { id: "han_chinese", share: 0.23 }, { id: "other", share: 0.08 }] },
  PER: { pop2026M: 34.5, macro: "LATAM", groups: [{ id: "peruvian", share: 0.68 }, { id: "indigenous_americas", share: 0.28 }, { id: "other", share: 0.04 }], pre1800Groups: [{ id: "indigenous_americas", share: 0.82 }, { id: "spanish", share: 0.18 }] },
  VEN: { pop2026M: 29.0, macro: "LATAM", groups: [{ id: "venezuelan", share: 0.94 }, { id: "indigenous_americas", share: 0.03 }, { id: "other", share: 0.03 }] },
  PRK: { pop2026M: 26.2, macro: "EAST_ASIA", groups: [{ id: "korean", share: 0.99 }, { id: "other", share: 0.01 }] },
  AUS: { pop2026M: 26.8, macro: "OCEANIA", groups: [{ id: "australian", share: 0.86 }, { id: "han_chinese", share: 0.05 }, { id: "other", share: 0.09 }], pre1800Groups: [{ id: "indigenous_americas", share: 0.98 }, { id: "english", share: 0.02 }] },
  SYR: { pop2026M: 24.5, macro: "TURKEY_LEVANT", groups: [{ id: "arab", share: 0.78 }, { id: "kurdish", share: 0.11 }, { id: "turkmen_other", share: 0.06 }, { id: "armenian", share: 0.05 }] },
  TWN: { pop2026M: 23.5, macro: "EAST_ASIA", groups: [{ id: "han_chinese", share: 0.95 }, { id: "other", share: 0.05 }] },
  KAZ: { pop2026M: 20.1, macro: "EAST_EUROPE", groups: [{ id: "kazakh", share: 0.71 }, { id: "russian", share: 0.16 }, { id: "uzbek", share: 0.04 }, { id: "other", share: 0.09 }], pre1991Groups: [{ id: "kazakh", share: 0.42 }, { id: "russian", share: 0.39 }, { id: "ukrainian", share: 0.06 }, { id: "german", share: 0.05 }, { id: "other", share: 0.08 }] },
  CHL: { pop2026M: 19.7, macro: "LATAM", groups: [{ id: "chilean", share: 0.88 }, { id: "indigenous_americas", share: 0.10 }, { id: "other", share: 0.02 }] },
  ROU: { pop2026M: 19.0, macro: "EAST_EUROPE", groups: [{ id: "romanian", share: 0.89 }, { id: "hungarian", share: 0.06 }, { id: "other", share: 0.05 }] },
  NLD: { pop2026M: 17.9, macro: "EUROPE", groups: [{ id: "dutch", share: 0.86 }, { id: "turkish", share: 0.03 }, { id: "other", share: 0.11 }] },
  BEL: { pop2026M: 11.8, macro: "EUROPE", groups: [{ id: "flemish", share: 0.57 }, { id: "walloon", share: 0.34 }, { id: "other", share: 0.09 }] },
  CUB: { pop2026M: 11.0, macro: "LATAM", groups: [{ id: "hispanic", share: 0.95 }, { id: "other", share: 0.05 }] },
  CZE: { pop2026M: 10.9, macro: "EUROPE", groups: [{ id: "czech", share: 0.92 }, { id: "slovak", share: 0.03 }, { id: "other", share: 0.05 }], pre1946Groups: [{ id: "czech", share: 0.68 }, { id: "german", share: 0.29 }, { id: "other", share: 0.03 }] },
  SWE: { pop2026M: 10.6, macro: "EUROPE", groups: [{ id: "swedish", share: 0.87 }, { id: "finnish", share: 0.03 }, { id: "other", share: 0.10 }] },
  PRT: { pop2026M: 10.5, macro: "EUROPE", groups: [{ id: "portuguese", share: 0.94 }, { id: "other", share: 0.06 }] },
  GRC: { pop2026M: 10.3, macro: "EUROPE", groups: [{ id: "greek", share: 0.93 }, { id: "albanian", share: 0.04 }, { id: "other", share: 0.03 }] },
  AZE: { pop2026M: 10.2, macro: "TURKEY_LEVANT", groups: [{ id: "azeri", share: 0.92 }, { id: "russian", share: 0.02 }, { id: "other", share: 0.06 }] },
  ISR: { pop2026M: 9.9, macro: "TURKEY_LEVANT", groups: [{ id: "jewish", share: 0.73 }, { id: "arab", share: 0.21 }, { id: "other", share: 0.06 }], pre1946Groups: [{ id: "arab", share: 0.68 }, { id: "jewish", share: 0.30 }, { id: "other", share: 0.02 }] },
  HUN: { pop2026M: 9.6, macro: "EUROPE", groups: [{ id: "hungarian", share: 0.92 }, { id: "german", share: 0.02 }, { id: "other", share: 0.06 }] },
  BLR: { pop2026M: 9.2, macro: "EAST_EUROPE", groups: [{ id: "belarusian", share: 0.85 }, { id: "russian", share: 0.08 }, { id: "polish", share: 0.03 }, { id: "other", share: 0.04 }] },
  AUT: { pop2026M: 9.1, macro: "EUROPE", groups: [{ id: "austrian", share: 0.84 }, { id: "german", share: 0.04 }, { id: "turkish", share: 0.03 }, { id: "other", share: 0.09 }], pre1946Groups: [{ id: "german", share: 0.95 }, { id: "other", share: 0.05 }] },
  CHE: { pop2026M: 8.9, macro: "EUROPE", groups: [{ id: "swiss_german", share: 0.62 }, { id: "french", share: 0.23 }, { id: "italian", share: 0.08 }, { id: "other", share: 0.07 }] },
  TKM: { pop2026M: 7.4, macro: "TURKEY_LEVANT", groups: [{ id: "turkmen", share: 0.86 }, { id: "uzbek", share: 0.06 }, { id: "russian", share: 0.04 }, { id: "other", share: 0.04 }] },
  SRB: { pop2026M: 6.6, macro: "EUROPE", groups: [{ id: "serbian", share: 0.83 }, { id: "hungarian", share: 0.04 }, { id: "other", share: 0.13 }] },
  BGR: { pop2026M: 6.4, macro: "EUROPE", groups: [{ id: "bulgarian", share: 0.85 }, { id: "turkish", share: 0.09 }, { id: "other", share: 0.06 }] },
  DNK: { pop2026M: 6.0, macro: "EUROPE", groups: [{ id: "danish", share: 0.89 }, { id: "other", share: 0.11 }] },
  FIN: { pop2026M: 5.6, macro: "EUROPE", groups: [{ id: "finnish", share: 0.89 }, { id: "swedish", share: 0.05 }, { id: "other", share: 0.06 }] },
  NOR: { pop2026M: 5.5, macro: "EUROPE", groups: [{ id: "norwegian", share: 0.87 }, { id: "other", share: 0.13 }] },
  PSE: { pop2026M: 5.5, macro: "TURKEY_LEVANT", groups: [{ id: "arab", share: 0.96 }, { id: "other", share: 0.04 }] },
  SVK: { pop2026M: 5.4, macro: "EUROPE", groups: [{ id: "slovak", share: 0.84 }, { id: "hungarian", share: 0.08 }, { id: "other", share: 0.08 }] },
  IRL: { pop2026M: 5.3, macro: "EUROPE", groups: [{ id: "welsh_irish", share: 0.89 }, { id: "other", share: 0.11 }] },
  HRV: { pop2026M: 3.8, macro: "EUROPE", groups: [{ id: "croatian", share: 0.92 }, { id: "serbian", share: 0.04 }, { id: "other", share: 0.04 }] },
  GEO: { pop2026M: 3.7, macro: "EAST_EUROPE", groups: [{ id: "georgian", share: 0.87 }, { id: "azeri", share: 0.06 }, { id: "armenian", share: 0.04 }, { id: "other", share: 0.03 }] },
  BIH: { pop2026M: 3.2, macro: "EUROPE", groups: [{ id: "bosnian", share: 0.51 }, { id: "serbian", share: 0.31 }, { id: "croatian", share: 0.15 }, { id: "other", share: 0.03 }] },
  ARM: { pop2026M: 3.0, macro: "EAST_EUROPE", groups: [{ id: "armenian", share: 0.98 }, { id: "other", share: 0.02 }] },
  ALB: { pop2026M: 2.8, macro: "EUROPE", groups: [{ id: "albanian", share: 0.93 }, { id: "greek", share: 0.03 }, { id: "other", share: 0.04 }] },
  MDA: { pop2026M: 2.5, macro: "EAST_EUROPE", groups: [{ id: "romanian", share: 0.82 }, { id: "ukrainian", share: 0.07 }, { id: "russian", share: 0.06 }, { id: "other", share: 0.05 }] },
  XKX: { pop2026M: 1.8, macro: "EUROPE", groups: [{ id: "albanian", share: 0.92 }, { id: "serbian", share: 0.05 }, { id: "other", share: 0.03 }] },
  CYP: { pop2026M: 0.95, macro: "EUROPE", groups: [{ id: "greek", share: 0.88 }, { id: "other", share: 0.12 }] },
  NCY: { pop2026M: 0.42, macro: "TURKEY_LEVANT", groups: [{ id: "turkish", share: 0.94 }, { id: "other", share: 0.06 }] },
};

const QUICK_POP_2026M: Record<string, [number, MacroRegion, string]> = {
  KEN: [56.2, "AFRICA", "east_african"],
  TZA: [68.6, "AFRICA", "east_african"],
  SDN: [49.4, "AFRICA", "arab"],
  SSD: [11.5, "AFRICA", "east_african"],
  UGA: [50.0, "AFRICA", "east_african"],
  GHA: [34.4, "AFRICA", "west_african"],
  MOZ: [34.6, "AFRICA", "east_african"],
  AGO: [37.8, "AFRICA", "congolese"],
  MDG: [31.9, "AFRICA", "east_african"],
  CMR: [29.4, "AFRICA", "west_african"],
  C_TE_D_I: [29.6, "AFRICA", "west_african"],
  NER: [27.2, "AFRICA", "west_african"],
  MLI: [24.0, "AFRICA", "west_african"],
  BURKINA_: [23.5, "AFRICA", "west_african"],
  MALAWI: [21.6, "AFRICA", "east_african"],
  ZMB: [21.3, "AFRICA", "congolese"],
  ZWE: [16.7, "AFRICA", "south_african"],
  SEN: [18.5, "AFRICA", "west_african"],
  SOM: [18.9, "AFRICA", "east_african"],
  TCD: [19.3, "AFRICA", "west_african"],
  TUN: [12.3, "TURKEY_LEVANT", "maghrebi"],
  LBY: [7.0, "TURKEY_LEVANT", "arab"],
  JOR: [11.4, "TURKEY_LEVANT", "arab"],
  LBN: [5.4, "TURKEY_LEVANT", "arab"],
  YEM: [35.2, "TURKEY_LEVANT", "arab"],
  ARE: [10.6, "TURKEY_LEVANT", "arab"],
  OMN: [4.7, "TURKEY_LEVANT", "arab"],
  KWT: [4.4, "TURKEY_LEVANT", "arab"],
  QAT: [2.8, "TURKEY_LEVANT", "arab"],
  BHR: [1.6, "TURKEY_LEVANT", "arab"],
  NPL: [31.2, "SOUTH_ASIA", "nepali"],
  LKA: [22.0, "SOUTH_ASIA", "other"],
  KHM: [17.1, "EAST_ASIA", "other"],
  LAO: [7.7, "EAST_ASIA", "other"],
  MNG: [3.5, "EAST_ASIA", "other"],
  SGP: [6.0, "EAST_ASIA", "han_chinese"],
  HKG: [7.5, "EAST_ASIA", "han_chinese"],
  MAC: [0.7, "EAST_ASIA", "han_chinese"],
  TJK: [10.4, "TURKEY_LEVANT", "tajik"],
  KGZ: [7.1, "TURKEY_LEVANT", "turkic_central"],
  ECU: [18.3, "LATAM", "hispanic"],
  GTM: [18.4, "LATAM", "hispanic"],
  BOL: [12.5, "LATAM", "indigenous_americas"],
  HTI: [11.8, "LATAM", "hispanic"],
  DOM: [11.4, "LATAM", "hispanic"],
  HND: [10.7, "LATAM", "hispanic"],
  PRY: [6.9, "LATAM", "hispanic"],
  NIC: [7.1, "LATAM", "hispanic"],
  EL_SALVA: [6.4, "LATAM", "hispanic"],
  CRI: [5.2, "LATAM", "hispanic"],
  PAN: [4.5, "LATAM", "hispanic"],
  URY: [3.4, "LATAM", "hispanic"],
  NZL: [5.3, "OCEANIA", "australian"],
  PNG: [10.5, "OCEANIA", "other"],
  LTU: [2.9, "EAST_EUROPE", "other"],
  LVA: [1.9, "EAST_EUROPE", "other"],
  EST: [1.4, "EAST_EUROPE", "other"],
  SVN: [2.1, "EUROPE", "other"],
  MKD: [1.8, "EUROPE", "other"],
  MNE: [0.62, "EUROPE", "serbian"],
  LUX: [0.67, "EUROPE", "other"],
  ISL: [0.39, "EUROPE", "norwegian"],
  MLT: [0.54, "EUROPE", "other"],
};

const DEMONYM_OVERRIDES: Record<string, { tr: string; en: string }> = {
  east_african: { tr: "Doğu Afrikalı", en: "East African" },
  west_african: { tr: "Batı Afrikalı", en: "West African" },
  nepali: { tr: "Nepalli", en: "Nepalese" },
  turkic_central: { tr: "Kırgız / Türkî", en: "Kyrgyz / Turkic" },
  TUR: { tr: "Türk", en: "Turkish" },
  DEU: { tr: "Alman", en: "German" },
  GER: { tr: "Alman", en: "German" },
  PRU: { tr: "Alman (Prusyalı)", en: "German" },
  ITA: { tr: "İtalyan", en: "Italian" },
  FRA: { tr: "Fransız", en: "French" },
  GBR: { tr: "İngiliz", en: "British" },
  ENG: { tr: "İngiliz", en: "English" },
  RUS: { tr: "Rus", en: "Russian" },
  SOV: { tr: "Rus", en: "Russian" },
  KRS: { tr: "Rus", en: "Russian" },
  JPN: { tr: "Japon", en: "Japanese" },
  CHN: { tr: "Çinli", en: "Chinese" },
  IND: { tr: "Hint", en: "Indian" },
  USA: { tr: "Amerikalı", en: "American" },
  BRA: { tr: "Brezilyalı", en: "Brazilian" },
};

const DYNAMIC_COLORS = [
  "#38bdf8",
  "#10b981",
  "#fbbf24",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
  "#fb923c",
];

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function extractScenarioYear(gameDate?: string | null): number {
  if (!gameDate) return 2026;
  const match = gameDate.match(/^(\d{3,4})/);
  const parsed = match ? parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2026;
}

export function formatPopulation(
  millions: number,
  locale: AppLocale
): string {
  if (millions >= 1000) {
    const billions = millions / 1000;
    const formatted = billions.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return locale === "tr" ? `${formatted} Mr` : `${formatted}B`;
  }
  if (millions >= 1) {
    const formatted = millions.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
      minimumFractionDigits: millions >= 10 ? 1 : 2,
      maximumFractionDigits: millions >= 10 ? 1 : 2,
    });
    return locale === "tr" ? `${formatted} Mn` : `${formatted}M`;
  }
  const thousands = Math.max(1, Math.round(millions * 1000));
  const formatted = thousands.toLocaleString(locale === "tr" ? "tr-TR" : "en-US");
  return locale === "tr" ? `${formatted} B` : `${formatted}K`;
}

function resolvePeopleMeta(
  id: string,
  fallbackTr: string,
  fallbackEn: string
): PeopleGroupMeta {
  if (PEOPLE_GROUPS[id]) return PEOPLE_GROUPS[id];
  if (DEMONYM_OVERRIDES[id]) {
    return {
      labelTr: DEMONYM_OVERRIDES[id].tr,
      labelEn: DEMONYM_OVERRIDES[id].en,
      color: DYNAMIC_COLORS[stableHash(id) % DYNAMIC_COLORS.length],
    };
  }
  return {
    labelTr: fallbackTr,
    labelEn: fallbackEn,
    color: DYNAMIC_COLORS[stableHash(id) % DYNAMIC_COLORS.length],
  };
}

function getRegionProfile(
  regionId: string,
  regionName?: string,
  baseValue = 8
): {
  pop2026M: number;
  macro: MacroRegion;
  groups: ShareSpec[];
  pre1991Groups?: ShareSpec[];
  pre1946Groups?: ShareSpec[];
  pre1800Groups?: ShareSpec[];
  fallbackTr: string;
  fallbackEn: string;
} {
  if (REGION_PROFILES[regionId]) {
    const p = REGION_PROFILES[regionId];
    return {
      ...p,
      fallbackTr: p.baseTr ?? regionName ?? regionId,
      fallbackEn: p.baseEn ?? regionName ?? regionId,
    };
  }

  const quick = QUICK_POP_2026M[regionId];
  if (quick) {
    return {
      pop2026M: quick[0],
      macro: quick[1],
      groups: [
        { id: quick[2], share: 0.9 },
        { id: "other", share: 0.1 },
      ],
      fallbackTr: regionName ?? regionId,
      fallbackEn: regionName ?? regionId,
    };
  }

  // Deterministic micro-nation / territory fallback scaled by strategic baseValue
  const pop2026M = Math.max(0.05, Number((baseValue * 0.28).toFixed(2)));
  const cleanName = regionName ?? regionId;
  return {
    pop2026M,
    macro: "AFRICA",
    groups: [
      { id: `local_${regionId}`, share: 0.92 },
      { id: "other", share: 0.08 },
    ],
    fallbackTr: `${cleanName} Halkı`,
    fallbackEn: `${cleanName} Local`,
  };
}

export function getRegionDemographics(params: {
  regionId: string;
  regionName?: string;
  baseValue?: number;
  gameDate?: string | null;
  locale: AppLocale;
}): RegionDemographicsSummary {
  const { regionId, regionName, baseValue = 8, gameDate, locale } = params;
  const year = extractScenarioYear(gameDate);
  const profile = getRegionProfile(regionId, regionName, baseValue);
  const mult = interpolateEraMultiplier(year, profile.macro);
  const populationMillions = Math.max(
    0.01,
    Number((profile.pop2026M * mult).toFixed(3))
  );

  let activeShares = profile.groups;
  if (year < 1800 && profile.pre1800Groups) {
    activeShares = profile.pre1800Groups;
  } else if (year < 1946 && profile.pre1946Groups) {
    activeShares = profile.pre1946Groups;
  } else if (year < 1991 && profile.pre1991Groups) {
    activeShares = profile.pre1991Groups;
  }

  const groups: DemographicSlice[] = activeShares.map((s) => {
    const meta = resolvePeopleMeta(s.id, profile.fallbackTr, profile.fallbackEn);
    const popM = populationMillions * s.share;
    return {
      id: s.id,
      label: locale === "tr" ? meta.labelTr : meta.labelEn,
      labelTr: meta.labelTr,
      labelEn: meta.labelEn,
      color: meta.color,
      populationMillions: popM,
      percent: Math.round(s.share * 100),
    };
  });

  groups.sort((a, b) => b.populationMillions - a.populationMillions);

  return {
    populationMillions,
    formattedPopulation: formatPopulation(populationMillions, locale),
    majority: groups[0] ?? null,
    groups,
  };
}

/**
 * Aggregate total population & live demographic majority inside a country from all its owned regions.
 * Whenever provinces change hands in war/treaty, internal percentages rebalance automatically.
 */
export function computeCountryDemographics(params: {
  ownedRegions: Array<Pick<RegionRecord, "regionId" | "regionName" | "baseValue">>;
  gameDate?: string | null;
  locale: AppLocale;
}): CountryDemographicsSummary {
  const { ownedRegions, gameDate, locale } = params;
  if (ownedRegions.length === 0) {
    return {
      totalPopulationMillions: 0,
      formattedPopulation: formatPopulation(0, locale),
      majority: null,
      groups: [],
      provinceCount: 0,
    };
  }

  let totalPopM = 0;
  const pooled = new Map<
    string,
    { labelTr: string; labelEn: string; color: string; popM: number }
  >();

  for (const reg of ownedRegions) {
    const summary = getRegionDemographics({
      regionId: reg.regionId,
      regionName: reg.regionName,
      baseValue: reg.baseValue,
      gameDate,
      locale,
    });
    totalPopM += summary.populationMillions;
    for (const g of summary.groups) {
      const existing = pooled.get(g.id);
      if (existing) {
        existing.popM += g.populationMillions;
      } else {
        pooled.set(g.id, {
          labelTr: g.labelTr,
          labelEn: g.labelEn,
          color: g.color,
          popM: g.populationMillions,
        });
      }
    }
  }

  const slices: DemographicSlice[] = Array.from(pooled.entries())
    .map(([id, entry]) => ({
      id,
      label: locale === "tr" ? entry.labelTr : entry.labelEn,
      labelTr: entry.labelTr,
      labelEn: entry.labelEn,
      color: entry.color,
      populationMillions: Number(entry.popM.toFixed(3)),
      percent:
        totalPopM > 0
          ? Math.max(1, Math.round((entry.popM / totalPopM) * 100))
          : 0,
    }))
    .sort((a, b) => b.populationMillions - a.populationMillions);

  // Merge tiny long-tail groups beyond top 5 into 'other' for crisp UI readability
  let compact = slices;
  if (slices.length > 5) {
    const head = slices.slice(0, 4);
    const tailPop = slices
      .slice(4)
      .reduce((acc, s) => acc + s.populationMillions, 0);
    const otherMeta = PEOPLE_GROUPS.other;
    const existingOther = head.find((s) => s.id === "other");
    if (existingOther) {
      existingOther.populationMillions = Number(
        (existingOther.populationMillions + tailPop).toFixed(3)
      );
      existingOther.percent = Math.max(
        1,
        Math.round((existingOther.populationMillions / totalPopM) * 100)
      );
      compact = [...head].sort(
        (a, b) => b.populationMillions - a.populationMillions
      );
    } else {
      compact = [
        ...head,
        {
          id: "other",
          label: locale === "tr" ? otherMeta.labelTr : otherMeta.labelEn,
          labelTr: otherMeta.labelTr,
          labelEn: otherMeta.labelEn,
          color: otherMeta.color,
          populationMillions: Number(tailPop.toFixed(3)),
          percent: Math.max(1, Math.round((tailPop / totalPopM) * 100)),
        },
      ].sort((a, b) => b.populationMillions - a.populationMillions);
    }
  }

  // Normalize rounding drift so compact percentages sum cleanly to 100%
  const sumPct = compact.reduce((acc, s) => acc + s.percent, 0);
  if (compact.length > 0 && sumPct !== 100) {
    compact[0].percent = Math.max(1, compact[0].percent + (100 - sumPct));
  }

  return {
    totalPopulationMillions: Number(totalPopM.toFixed(2)),
    formattedPopulation: formatPopulation(totalPopM, locale),
    majority: compact[0] ?? null,
    groups: compact,
    provinceCount: ownedRegions.length,
  };
}
