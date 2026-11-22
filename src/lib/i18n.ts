export type AppLocale = "tr" | "en";

export const LOCALE_COOKIE_NAME = "mur4history_locale";
export const LOCALE_STORAGE_KEY = "mur4history_locale_v1";

/**
 * Determine app locale from a browser/HTTP language tag string.
 * Turkish browsers (`tr`, `tr-TR`, etc.) use Turkish (`tr`);
 * English or any other language falls back cleanly to English (`en`).
 */
export function resolvePreferredLocale(rawLang?: string | null): AppLocale {
  if (!rawLang) return "en";
  const primary = rawLang
    .split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (primary && (primary === "tr" || primary.startsWith("tr-"))) {
    return "tr";
  }
  return "en";
}

export function formatGameDateByLocale(
  dateStr: string,
  locale: AppLocale
): string {
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  const months =
    locale === "tr"
      ? [
          "Ocak",
          "Şubat",
          "Mart",
          "Nisan",
          "Mayıs",
          "Haziran",
          "Temmuz",
          "Ağustos",
          "Eylül",
          "Ekim",
          "Kasım",
          "Aralık",
        ]
      : [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
  const monthName = months[monthIdx] ?? parts[1];
  return parts.length === 3 && day > 1
    ? `${day} ${monthName} ${year}`
    : `${monthName} ${year}`;
}

export function formatRelativeTimeByLocale(
  isoDate: string,
  locale: AppLocale
): string {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (locale === "tr") {
    if (diffMin < 1) return "Az önce";
    if (diffMin < 60) return `${diffMin}dk önce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}sa önce`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}g önce`;
    return new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
    });
  }
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}

const DIFFICULTY_EN: Record<
  string,
  { label: string; shortDesc: string; treatyAcceptRate: string }
> = {
  VERY_EASY: {
    label: "Very Easy",
    shortDesc: "Sandbox mode; proposals are readily accepted (90%+).",
    treatyAcceptRate: "90% - 98%",
  },
  EASY: {
    label: "Easy",
    shortDesc: "Forgiving AI resistance, high treaty acceptance (~75%).",
    treatyAcceptRate: "70% - 80%",
  },
  NORMAL: {
    label: "Normal",
    shortDesc: "Balanced geopolitical realism (~50% acceptance).",
    treatyAcceptRate: "45% - 60%",
  },
  HARD: {
    label: "Hard",
    shortDesc: "Tough diplomacy, low treaty acceptance (~25%), quick coalitions.",
    treatyAcceptRate: "20% - 35%",
  },
  IMPOSSIBLE: {
    label: "Impossible",
    shortDesc: "Relentless resistance & historical inertia (5%-15% acceptance).",
    treatyAcceptRate: "5% - 15%",
  },
};

export function getDifficultyDisplay(
  level: string,
  locale: AppLocale,
  trFallback: { label: string; shortDesc: string; treatyAcceptRate: string }
) {
  if (locale === "en" && DIFFICULTY_EN[level]) {
    return DIFFICULTY_EN[level];
  }
  return {
    label: trFallback.label,
    shortDesc: trFallback.shortDesc,
    treatyAcceptRate: trFallback.treatyAcceptRate,
  };
}

const TIME_JUMP_EN: Record<string, string> = {
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "6M": "6 Months",
  "1Y": "1 Year",
  SCENARIO_DEFAULT: "Scenario Default",
};

export function getTimeJumpDisplay(
  interval: string,
  locale: AppLocale,
  trFallback: Record<string, string>
): string {
  if (locale === "en") {
    return TIME_JUMP_EN[interval] ?? interval;
  }
  return trFallback[interval] ?? interval;
}

const PRESET_SCENARIO_EN: Record<
  string,
  { title: string; era: string; description: string }
> = {
  "2026": {
    title: "2026: Modern Geopolitics",
    era: "Multipolar 21st Century",
    description:
      "Attrition warfare in Eastern Europe, semiconductor and naval rivalry in the Indo-Pacific, regional security shifts across the Middle East, and the AI-era global economy.",
  },
  "1936": {
    title: "1936: Gathering Storm",
    era: "Interwar Era",
    description:
      "Revisionist powers rearms across Europe and East Asia as the Versailles order fractures on the brink of global conflict.",
  },
  "1962": {
    title: "1962: Cold War",
    era: "Nuclear Polarization",
    description:
      "Strategic missile standoffs, proxy struggles, non-aligned diplomacy, and ideological competition at the height of the Cold War.",
  },
  "1444": {
    title: "1444: Dawn of Empires",
    era: "Late Middle Ages & Renaissance",
    description:
      "Rise of the Ottoman State across Rumelia and Anatolia, post-Varna Balkan politics, Mediterranean maritime republics, and late-medieval dynasties.",
  },
  "1914": {
    title: "1914: World War I",
    era: "The Great War • Entente vs Central Powers",
    description:
      "Europe mobilizes following Sarajevo as Entente and Central coalitions march to war while the Ottoman Empire weighs neutrality or intervention along the Straits.",
  },
  "1919": {
    title: "1919: Turkish War of Independence",
    era: "Anatolian Resistance & Liberation",
    description:
      "With Istanbul under Allied occupation and İzmir invaded, Mustafa Kemal lands in Samsun on May 19 to rally Anatolia's War of Independence.",
  },
  "1939": {
    title: "1939: World War II",
    era: "Global Total War",
    description:
      "German armored columns cross the Polish frontier as Britain and France prepare ultimatums, while President İnönü steers Turkey's armed neutrality.",
  },
  "1942": {
    title: "1942: Stalingrad & El Alamein",
    era: "WWII Turning Point",
    description:
      "Axis expansion stands at its high-water mark before the Volga and Egyptian desert while the Grand Alliance mobilizes industrial might across every ocean.",
  },
  "1991": {
    title: "1991: End of the Cold War",
    era: "Soviet Dissolution & New Order",
    description:
      "Amidst Moscow's coup crisis, republics declare independence across Eurasia and Yugoslavia fractures while Ankara reaches toward the Turkic world.",
  },
  "1877": {
    title: "1877: 93 War & Siege of Plevna",
    era: "Age of Empires & Balkan Crisis",
    description:
      "Imperial Russia crosses the Danube and Caucasian frontiers as Osman Pasha fortifies Plevna and Europe's great powers maneuver over the Straits.",
  },
  "1812": {
    title: "1812: Napoleonic Wars",
    era: "Grand Coalition & Continental System",
    description:
      "Napoleon's 600,000-man Grande Armée crosses the Niemen toward Moscow while Peninsular battles rage, the War of 1812 erupts, and Sultan Mahmud II reforms the Porte.",
  },
  "1526": {
    title: "1526: Suleiman & Battle of Mohács",
    era: "Ottoman Zenith & World Hegemony",
    description:
      "Sultan Suleiman the Magnificent marches on Buda as Francis I and Charles V clash in Europe and Babur establishes Mughal rule at Panipat.",
  },
};

export function getScenarioDisplay<
  T extends { id: string; slug?: string; title: string; era: string; description?: string }
>(scenario: T, locale: AppLocale): { title: string; era: string; description: string } {
  if (locale === "en") {
    const matched =
      PRESET_SCENARIO_EN[scenario.id] ||
      (scenario.slug
        ? Object.entries(PRESET_SCENARIO_EN).find(([k]) =>
            scenario.slug?.startsWith(`${k}-`)
          )?.[1]
        : undefined);
    if (matched) return matched;
  }
  return {
    title: scenario.title,
    era: scenario.era,
    description: scenario.description ?? "",
  };
}

const MAP_THEME_EN: Record<
  string,
  { name: string; subtitle: string; badge: string }
> = {
  pax_atlas: {
    name: "Pax Imperial Atlas",
    subtitle: "Deep sapphire ocean, coastal shelf glow, and tracked imperial labels",
    badge: "Recommended • Pax Style",
  },
  mur4_classic: {
    name: "Mur4History Classic",
    subtitle: "Original dark physical-political atlas appearance",
    badge: "Original",
  },
  pax_satellite_terrain: {
    name: "Physical Relief & Topography",
    subtitle: "Elevated mountain ranges, plateaus, and glowing continental shelves",
    badge: "Topographic",
  },
  victoria_parchment: {
    name: "Victoria Parchment (1836)",
    subtitle: "Aged antique paper oceans, ink borders, and classic cartography",
    badge: "Historical",
  },
  hoi4_iron: {
    name: "Iron Storm (War Room)",
    subtitle: "Dark steel seas, muted military fills, and crisp frontline borders",
    badge: "Strategy",
  },
  defcon_radar: {
    name: "DEFCON 1962 Nuclear Radar",
    subtitle: "Cold War command radar, phosphor emerald coasts, and coordinate grid",
    badge: "Cold War",
  },
  nautical_portolan: {
    name: "1444 Portolan Sea Chart",
    subtitle: "Gilded coasts over Renaissance ultramarine nautical atlas",
    badge: "Classic",
  },
  midnight_lights: {
    name: "Night Satellite (Dark Land)",
    subtitle: "Pitch-black abyss ocean with glowing golden frontiers",
    badge: "Night Mode",
  },
  cyber_holomap: {
    name: "2077 Cyber Holomap",
    subtitle: "Midnight violet ocean, neon cyan coastlines, and digital grid",
    badge: "Futuristic",
  },
  newsprint_chronicle: {
    name: "Historical Newsprint Engraving",
    subtitle: "Archival paper, halftone ocean grain, and editorial ink borders",
    badge: "Editorial",
  },
  nordic_minimal: {
    name: "Nordic Minimalist (Light)",
    subtitle: "Clean airy ice-blue waters, soft pastel states, and crisp thin lines",
    badge: "Light Theme",
  },
  imperial_crimson: {
    name: "Napoleon Crimson Twilight",
    subtitle: "Dramatic burgundy twilight seas with champagne gold rims",
    badge: "Imperial",
  },
  blueprint_architect: {
    name: "Staff Blueprint Plan",
    subtitle: "Prussian blueprint engineering grid with crisp white vectors",
    badge: "Technical",
  },
  amber_command: {
    name: "Amber Command Monitor",
    subtitle: "Retro phosphor amber CRT terminal with high tactical contrast",
    badge: "Retro CRT",
  },
};

export function getMapThemeDisplay(
  theme: { id: string; name: string; subtitle: string; badge: string },
  locale: AppLocale
) {
  if (locale === "en" && MAP_THEME_EN[theme.id]) {
    return MAP_THEME_EN[theme.id];
  }
  return { name: theme.name, subtitle: theme.subtitle, badge: theme.badge };
}

const TRACK_EN: Record<
  string,
  { title: string; eraTag: string; mood: string }
> = {
  peace_dawn: {
    title: "Dawn of Peace",
    eraTag: "Classic Strategy",
    mood: "Warm piano melodies over wide string chords",
  },
  imperial_march: {
    title: "1444: Imperial Seal",
    eraTag: "Historical Epic",
    mood: "Deep cello drones and solemn fifth harmonies",
  },
  cold_war_pulse: {
    title: "1962: Cold War Tension",
    eraTag: "Nuclear Era",
    mood: "Analog dark synth pulse with icy glass pads",
  },
  modern_balance: {
    title: "2026: Global Balance",
    eraTag: "Modern Geopolitics",
    mood: "Smooth downtempo electronic plucks and sub-bass",
  },
  war_room: {
    title: "Situation Room",
    eraTag: "Crisis & Frontline",
    mood: "Tense ostinato pulses and brooding strings",
  },
  diplomacy_salon: {
    title: "Diplomacy Salon",
    eraTag: "Summits & Treaties",
    mood: "Gentle chamber harp and peaceful major7 harmonies",
  },
  sea_explorers: {
    title: "Portolan: Open Seas",
    eraTag: "Age of Discovery",
    mood: "Lydian sea swells and crystalline pentatonic chimes",
  },
  cosmic_empire: {
    title: "Stars & History",
    eraTag: "Meditative Ambient",
    mood: "Slow deep cathedral shimmer and celestial bells",
  },
};

export function getMusicTrackDisplay(
  track: { id: string; title: string; eraTag: string; mood: string },
  locale: AppLocale
) {
  if (locale === "en" && TRACK_EN[track.id]) {
    return TRACK_EN[track.id];
  }
  return { title: track.title, eraTag: track.eraTag, mood: track.mood };
}

const COUNTRY_NAME_EN: Record<string, string> = {
  TUR: "Republic of Turkey",
  OTT: "Ottoman Empire",
  USA: "United States",
  RUS: "Russian Federation",
  SOV: "Soviet Union",
  MOS: "Grand Duchy of Moscow",
  CHN: "People's Republic of China",
  MNG: "Ming Dynasty",
  DEU: "Germany",
  GER: "German Reich",
  FRG: "West Germany",
  GDR: "East Germany",
  FRA: "France",
  GBR: "United Kingdom",
  ENG: "England",
  SCO: "Scotland",
  ITA: "Italy",
  ESP: "Spain",
  CAS: "Castile",
  ARA: "Aragon",
  POL: "Poland",
  UKR: "Ukraine",
  IND: "India",
  JPN: "Japan",
  BRA: "Brazil",
  CAN: "Canada",
  MEX: "Mexico",
  ARG: "Argentina",
  AUS: "Australia",
  GRL: "Greenland",
  IRN: "Iran",
  PER: "Persia",
  TIM: "Timurid Empire",
  EGY: "Egypt",
  MAM: "Mamluk Sultanate",
  SAU: "Saudi Arabia",
  KAZ: "Kazakhstan",
  DZA: "Algeria",
  MAR: "Morocco",
  ZAF: "South Africa",
  ETH: "Ethiopia",
  BYZ: "Byzantine Empire",
  HAB: "Austria",
  AUT: "Austria",
  KAL: "Kalmar Union",
  NOR: "Norway",
  SWE: "Sweden",
  FIN: "Finland",
  DNK: "Denmark",
  GRC: "Greece",
  ROU: "Romania",
  BGR: "Bulgaria",
  HUN: "Hungary",
  SRB: "Serbia",
  SYR: "Syria",
  IRQ: "Iraq",
  ISR: "Israel",
  JOR: "Jordan",
  LBN: "Lebanon",
  AZE: "Azerbaijan",
  GEO: "Georgia",
  ARM: "Armenia",
  PAK: "Pakistan",
  AFG: "Afghanistan",
  KOR: "South Korea",
  PRK: "North Korea",
  VNM: "Vietnam",
  THA: "Thailand",
  IDN: "Indonesia",
  MYS: "Malaysia",
  PHL: "Philippines",
  NGA: "Nigeria",
  SDN: "Sudan",
  KEN: "Kenya",
  COD: "DR Congo",
  COL: "Colombia",
  PERU: "Peru",
  VEN: "Venezuela",
  CHL: "Chile",
  AHU: "Austria-Hungary",
  KRS: "Russian Empire",
  PRU: "Prussia",
  MUG: "Mughal Empire",
  YUG: "Yugoslavia",
  CZE: "Czechia",
  SVK: "Slovakia",
  SVN: "Slovenia",
  HRV: "Croatia",
  BIH: "Bosnia and Herzegovina",
  MKD: "North Macedonia",
  MNE: "Montenegro",
  XKX: "Kosovo",
  ALB: "Albania",
  BLR: "Belarus",
  EST: "Estonia",
  LVA: "Latvia",
  LTU: "Lithuania",
  MDA: "Moldova",
};

export function getCountryDisplayName(
  code: string,
  fallbackName: string,
  locale: AppLocale
): string {
  if (locale === "en" && COUNTRY_NAME_EN[code]) {
    return COUNTRY_NAME_EN[code];
  }
  return fallbackName;
}

const SHORT_LABELS_TR: Record<string, string> = {
  TUR: "TÜRKİYE",
  OTT: "OSMANLI",
  USA: "U S A",
  RUS: "RUSSIA",
  SOV: "SOVYETLER",
  MOS: "MOSKOVA",
  CHN: "ÇİN",
  DEU: "ALMANYA",
  GER: "ALMANYA",
  FRG: "B. ALMANYA",
  GDR: "D. ALMANYA",
  FRA: "FRANSA",
  GBR: "BRİTANYA",
  ENG: "İNGİLTERE",
  SCO: "İSKOÇYA",
  ITA: "İTALYA",
  ESP: "İSPANYA",
  CAS: "KASTİLYA",
  ARA: "ARAGON",
  POL: "POLONYA",
  UKR: "UKRAYNA",
  IND: "HİNDİSTAN",
  JPN: "JAPONYA",
  BRA: "BREZİLYA",
  CAN: "CANADA",
  MEX: "MEKSİKA",
  ARG: "ARJANTİN",
  AUS: "AVUSTRALYA",
  GRL: "GRÖNLAND",
  IRN: "İRAN",
  TIM: "TİMUR",
  EGY: "MISIR",
  MAM: "MEMLÜK",
  SAU: "S. ARABİSTAN",
  KAZ: "KAZAKİSTAN",
  DZA: "CEZAYİR",
  ZAF: "G. AFRİKA",
  ETH: "ETİYOPYA",
  BYZ: "BİZANS",
  HAB: "AVUSTURYA",
  KAL: "KALMAR",
  INC: "İNKA",
  AZT: "AZTEK",
  AHU: "AVUSTURYA-MAC.",
  KRS: "RUS ÇARLIĞI",
  PRU: "PRUSYA",
  MUG: "BABÜR",
  YUG: "YUGOSLAVYA",
};

const SHORT_LABELS_EN: Record<string, string> = {
  TUR: "TURKEY",
  OTT: "OTTOMANS",
  USA: "U S A",
  RUS: "RUSSIA",
  SOV: "SOVIET UNION",
  MOS: "MUSCOVY",
  CHN: "CHINA",
  DEU: "GERMANY",
  GER: "GERMANY",
  FRG: "W. GERMANY",
  GDR: "E. GERMANY",
  FRA: "FRANCE",
  GBR: "BRITAIN",
  ENG: "ENGLAND",
  SCO: "SCOTLAND",
  ITA: "ITALY",
  ESP: "SPAIN",
  CAS: "CASTILE",
  ARA: "ARAGON",
  POL: "POLAND",
  UKR: "UKRAINE",
  IND: "INDIA",
  JPN: "JAPAN",
  BRA: "BRAZIL",
  CAN: "CANADA",
  MEX: "MEXICO",
  ARG: "ARGENTINA",
  AUS: "AUSTRALIA",
  GRL: "GREENLAND",
  IRN: "IRAN",
  TIM: "TIMURIDS",
  EGY: "EGYPT",
  MAM: "MAMLUKS",
  SAU: "SAUDI ARABIA",
  KAZ: "KAZAKHSTAN",
  DZA: "ALGERIA",
  ZAF: "S. AFRICA",
  ETH: "ETHIOPIA",
  BYZ: "BYZANTIUM",
  HAB: "AUSTRIA",
  KAL: "KALMAR",
  NOR: "NORWAY",
  SWE: "SWEDEN",
  FIN: "FINLAND",
  GRC: "GREECE",
  ROU: "ROMANIA",
  AFG: "AFGHANISTAN",
  PAK: "PAKISTAN",
  MNG: "MONGOLIA",
  PHL: "PHILIPPINES",
  IDN: "INDONESIA",
  MYS: "MALAYSIA",
  KAZ2: "KAZAKHSTAN",
  MAR: "MOROCCO",
  NGA: "NIGERIA",
  VEN: "VENEZUELA",
  COL: "COLOMBIA",
  BOL: "BOLIVIA",
  CHL: "CHILE",
  INC: "INCA",
  AZT: "AZTEC",
  AHU: "AUSTRO-HUNG.",
  KRS: "RUSSIAN EMP.",
  PRU: "PRUSSIA",
  MUG: "MUGHALS",
  YUG: "YUGOSLAVIA",
};

export function getCartographicMapLabel(
  countryName: string | undefined,
  code: string,
  locale: AppLocale
): string {
  const dict = locale === "en" ? SHORT_LABELS_EN : SHORT_LABELS_TR;
  const base =
    dict[code] ||
    getCountryDisplayName(code, countryName ?? code, locale)
      .replace(
        /\s+(Cumhuriyeti|İmparatorluğu|Krallığı|Federasyonu|Federal Cumhuriyeti|Halk Cumhuriyeti|Sultanlığı|Hanedanı|Birliği|Republic of|Empire|Kingdom)$/i,
        ""
      )
      .toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

  if (base.length <= 10 && !base.includes(" ")) {
    return base.split("").join(" ");
  }
  return base;
}

export const DOCUMENT_TITLES: Record<AppLocale, string> = {
  tr: "Mur4History MCP • Alternatif Tarih & Büyük Strateji",
  en: "Mur4History MCP • Alternate History & Grand Strategy",
};
