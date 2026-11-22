import { getAllWorldRegions } from "@/lib/geo-regions";
import { scenario1936 } from "./scenario-1936";
import { scenario1962 } from "./scenario-1962";
import { scenario1444 } from "./scenario-1444";
import { scenario2026 } from "./scenario-2026";
import { scenario1914 } from "./scenario-1914";
import { scenario1919 } from "./scenario-1919";
import { scenario1939 } from "./scenario-1939";
import { scenario1942 } from "./scenario-1942";
import { scenario1991 } from "./scenario-1991";
import { scenario1877 } from "./scenario-1877";
import { scenario1812 } from "./scenario-1812";
import { scenario1526 } from "./scenario-1526";
import {
  ScenarioConfigSchema,
  type ScenarioConfig,
  type ScenarioCountryDef,
} from "./types";

export const PRESET_SCENARIOS: ScenarioConfig[] = [
  scenario2026,
  scenario1939,
  scenario1919,
  scenario1914,
  scenario1936,
  scenario1942,
  scenario1962,
  scenario1991,
  scenario1877,
  scenario1812,
  scenario1526,
  scenario1444,
];

export { ScenarioConfigSchema };
export type { ScenarioConfig, ScenarioCountryDef };

const PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#4ade80",
  "#fb923c",
  "#2dd4bf",
  "#818cf8",
  "#c084fc",
  "#e879f9",
  "#22d3ee",
  "#a3e635",
];

function deterministicColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

const KNOWN_MINOR_COUNTRY_META: Record<
  string,
  { name: string; flag: string; leader?: string }
> = {
  SAU: { name: "Suudi Arabistan", flag: "🇸🇦" },
  IRQ: { name: "Irak", flag: "🇮🇶" },
  SYR: { name: "Suriye", flag: "🇸🇾" },
  ISR: { name: "İsrail", flag: "🇮🇱" },
  PSE: { name: "Filistin", flag: "🇵🇸" },
  JOR: { name: "Ürdün", flag: "🇯🇴" },
  LBN: { name: "Lübnan", flag: "🇱🇧" },
  GRC: { name: "Yunanistan", flag: "🇬🇷" },
  BGR: { name: "Bulgaristan", flag: "🇧🇬" },
  ROU: { name: "Romanya", flag: "🇷🇴" },
  HUN: { name: "Macaristan", flag: "🇭🇺" },
  AUT: { name: "Avusturya", flag: "🇦🇹" },
  CHE: { name: "İsviçre", flag: "🇨🇭" },
  NLD: { name: "Hollanda", flag: "🇳🇱" },
  BEL: { name: "Belçika", flag: "🇧🇪" },
  PRT: { name: "Portekiz", flag: "🇵🇹" },
  SWE: { name: "İsveç", flag: "🇸🇪" },
  NOR: { name: "Norveç", flag: "🇳🇴" },
  FIN: { name: "Finlandiya", flag: "🇫🇮" },
  DNK: { name: "Danimarka", flag: "🇩🇰" },
  IRL: { name: "İrlanda", flag: "🇮🇪" },
  CAN: { name: "Kanada", flag: "🇨🇦" },
  MEX: { name: "Meksika", flag: "🇲🇽" },
  ARG: { name: "Arjantin", flag: "🇦🇷" },
  CHL: { name: "Şili", flag: "🇨🇱" },
  COL: { name: "Kolombiya", flag: "🇨🇴" },
  PER: { name: "Peru", flag: "🇵🇪" },
  VEN: { name: "Venezuela", flag: "🇻🇪" },
  CUB: { name: "Küba", flag: "🇨🇺" },
  AUS: { name: "Avustralya", flag: "🇦🇺" },
  NZL: { name: "Yeni Zelanda", flag: "🇳🇿" },
  KOR: { name: "Güney Kore", flag: "🇰🇷" },
  PRK: { name: "Kuzey Kore", flag: "🇰🇵" },
  TWN: { name: "Tayvan", flag: "🇹🇼" },
  PAK: { name: "Pakistan", flag: "🇵🇰" },
  AFG: { name: "Afganistan", flag: "🇦🇫" },
  KAZ: { name: "Kazakistan", flag: "🇰🇿" },
  AZE: { name: "Azerbaycan", flag: "🇦🇿" },
  GEO: { name: "Gürcistan", flag: "🇬🇪" },
  ARM: { name: "Ermenistan", flag: "🇦🇲" },
  IDN: { name: "Endonezya", flag: "🇮🇩" },
  MYS: { name: "Malezya", flag: "🇲🇾" },
  THA: { name: "Tayland", flag: "🇹🇭" },
  VNM: { name: "Vietnam", flag: "🇻🇳" },
  PHL: { name: "Filipinler", flag: "🇵🇭" },
  NGA: { name: "Nijerya", flag: "🇳🇬" },
  ZAF: { name: "Güney Afrika", flag: "🇿🇦" },
  ETH: { name: "Etiyopya", flag: "🇪🇹" },
  MAR: { name: "Fas", flag: "🇲🇦" },
  DZA: { name: "Cezayir", flag: "🇩🇿" },
  TUN: { name: "Tunus", flag: "🇹🇳" },
  LBY: { name: "Libya", flag: "🇱🇾" },
  KEN: { name: "Kenya", flag: "🇰🇪" },
  SDN: { name: "Sudan", flag: "🇸🇩" },
  SRB: { name: "Sırbistan", flag: "🇷🇸" },
  HRV: { name: "Hırvatistan", flag: "🇭🇷" },
  BIH: { name: "Bosna-Hersek", flag: "🇧🇦" },
  CZE: { name: "Çekya", flag: "🇨🇿" },
  SVK: { name: "Slovakya", flag: "🇸🇰" },
  BLR: { name: "Belarus", flag: "🇧🇾" },
  CYP: { name: "Kıbrıs", flag: "🇨🇾" },
  NCY: { name: "KKTC", flag: "🇹🇷" },
  MNG: { name: "Moğolistan", flag: "🇲🇳" },
};

/**
 * Expands a ScenarioConfig across all 206 world provinces so every region
 * on the interactive map is clickable, colored, and belongs to an entity.
 */
export function expandScenarioToWorld(config: ScenarioConfig) {
  const allRegions = getAllWorldRegions();
  const regionOwner = new Map<string, string>();
  const countriesByCode = new Map<string, ScenarioCountryDef>();

  for (const country of config.countries) {
    countriesByCode.set(country.code, { ...country });
    for (const rid of country.regions) {
      regionOwner.set(rid, country.code);
    }
  }

  for (const reg of allRegions) {
    if (regionOwner.has(reg.regionId)) continue;

    if (config.fallbackOwnerMode === "UNCLAIMED") {
      if (!countriesByCode.has("NEU")) {
        countriesByCode.set("NEU", {
          code: "NEU",
          name: "Tarafsız Bölgeler",
          flagEmoji: "🏳️",
          color: "#334155",
          leader: "Yerel İdareler",
          ideology: "Bağımsız",
          economy: 20,
          military: 15,
          stability: 50,
          treasury: 200,
          capitalRegionId: reg.regionId,
          isMajor: false,
          regions: [],
        });
      }
      countriesByCode.get("NEU")!.regions.push(reg.regionId);
      regionOwner.set(reg.regionId, "NEU");
      continue;
    }

    // Group minor split provinces by prefix if they belong together
    const baseCode = reg.regionId.includes("_")
      ? reg.regionId.split("_")[0]
      : reg.regionId;
    const known = KNOWN_MINOR_COUNTRY_META[baseCode];
    const minorCode = baseCode.slice(0, 12);

    if (!countriesByCode.has(minorCode)) {
      countriesByCode.set(minorCode, {
        code: minorCode,
        name: known?.name ?? reg.baseCountryName,
        flagEmoji: known?.flag ?? "🏴",
        color: deterministicColor(minorCode),
        leader: known?.leader ?? `${known?.name ?? reg.baseCountryName} Hükümeti`,
        ideology: "Bölgesel İdare",
        economy: 34,
        military: 32,
        stability: 62,
        treasury: 550,
        capitalRegionId: reg.regionId,
        isMajor: false,
        regions: [reg.regionId],
      });
    } else {
      countriesByCode.get(minorCode)!.regions.push(reg.regionId);
    }
    regionOwner.set(reg.regionId, minorCode);
  }

  const regionOwnerships = allRegions.map((reg) => {
    const ownerCode = regionOwner.get(reg.regionId)!;
    const ownerCountry = countriesByCode.get(ownerCode)!;
    const isCapital = ownerCountry.capitalRegionId === reg.regionId;
    return {
      regionId: reg.regionId,
      regionName: reg.regionName,
      ownerCountryCode: ownerCode,
      strategicStatus: isCapital ? "CAPITAL" : "CORE",
      baseValue: reg.baseValue,
    };
  });

  return {
    countries: Array.from(countriesByCode.values()),
    regionOwnerships,
  };
}
