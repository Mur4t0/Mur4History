import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function sortCountryPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

export function formatGameDateTr(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  const months = [
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
  ];
  const monthName = months[monthIdx] ?? parts[1];
  return parts.length === 3 && day > 1
    ? `${day} ${monthName} ${year}`
    : `${monthName} ${year}`;
}

export function advanceDateMonths(dateStr: string, monthsToAdd: number): string {
  const [yRaw, mRaw, dRaw] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(yRaw) || Number.isNaN(mRaw)) return dateStr;
  const totalMonths = yRaw * 12 + (mRaw - 1) + monthsToAdd;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const day = Number.isNaN(dRaw) ? 1 : dRaw;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function advanceDateByInterval(
  dateStr: string,
  interval: string,
  defaultMonths: number
): string {
  if (interval === "1W") {
    const dt = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return advanceDateMonths(dateStr, 1);
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (interval === "1M") return advanceDateMonths(dateStr, 1);
  if (interval === "3M") return advanceDateMonths(dateStr, 3);
  if (interval === "6M") return advanceDateMonths(dateStr, 6);
  if (interval === "1Y") return advanceDateMonths(dateStr, 12);
  return advanceDateMonths(dateStr, defaultMonths);
}

export const DIFFICULTY_META: Record<
  string,
  {
    label: string;
    shortDesc: string;
    treatyAcceptRate: string;
    aiPromptRules: string;
    badgeColor: string;
  }
> = {
  VERY_EASY: {
    label: "Çok Kolay",
    shortDesc: "Sandbox modu; teklifler kolayca kabul edilir (%90+).",
    treatyAcceptRate: "%90 - %98",
    badgeColor: "text-sky-300 border-sky-500/40 bg-sky-500/15",
    aiPromptRules:
      "ZORLUK = ÇOK KOLAY (Sandbox): Oyuncunun diplomatik tekliflerini, ittifaklarını ve toprak taleplerini çok yüksek oranda (%90+) kabul et. Başarısızlık cezaları hafif olsun; yalnızca fiziksel olarak imkansız bilim-kurgu emirlerini reddet.",
  },
  EASY: {
    label: "Kolay",
    shortDesc: "Affedici AI direnci, yüksek anlaşma kabul şansı (~%75).",
    treatyAcceptRate: "%70 - %80",
    badgeColor: "text-emerald-300 border-emerald-500/40 bg-emerald-500/15",
    aiPromptRules:
      "ZORLUK = KOLAY: AI ülkeleri oyuncunun tekliflerine genel olarak olumlu yaklaşır (~%75 kabul şansı). Küçük hazırlık eksikliklerini affet, ancak açık düşmanlıkta sembolik tepkiler ver.",
  },
  NORMAL: {
    label: "Orta",
    shortDesc: "Dengeli jeopolitik gerçekçilik; hazırlık ve çıkar uyumu gerekir (~%50).",
    treatyAcceptRate: "%45 - %60",
    badgeColor: "text-amber-300 border-amber-500/40 bg-amber-500/15",
    aiPromptRules:
      "ZORLUK = ORTA: Dengeli gerçekçilik uygula. Antlaşma ve ittifak tekliflerinin kabul oranı ~%50 civarında, karşılıklı çıkar ve ön hazırlığa bağlıdır. Saldırgan adımlara komşular nota ve konsey tepkisi verir.",
  },
  HARD: {
    label: "Zor",
    shortDesc: "Çetin diplomasi, düşük anlaşma kabul oranı (~%25), hızlı koalisyonlar.",
    treatyAcceptRate: "%20 - %35",
    badgeColor: "text-orange-300 border-orange-500/40 bg-orange-500/15",
    aiPromptRules:
      "ZORLUK = ZOR: AI devletleri çıkarlarını çok sert savunur. Tek taraflı veya hazırlıksız diplomatik anlaşmaları %70+ ihtimalle REDDET (%20-35 kabul şansı). Toprak ilhakı veya provokatif emirlerde ilgili ülkeler hemen protesto mesajı atar ve birden fazla ülke etkilenirse 'convene_diplomatic_council' ile konsey/koalisyon toplar.",
  },
  IMPOSSIBLE: {
    label: "İmkansız",
    shortDesc: "Acımasız direnç & tarihsel atalet; tavizsiz AI (%5-%15 kabul).",
    treatyAcceptRate: "%5 - %15",
    badgeColor: "text-red-300 border-red-500/40 bg-red-500/15",
    aiPromptRules:
      "ZORLUK = İMKANSIZ (Acımasız Gerçekçilik & Tarihsel Atalet): Büyük güçler mevcut statükoyu ölümüne savunur. Oyuncunun lehine tek taraflı antlaşmaları neredeyse daima REDDET (%5-15 kabul; yalnızca büyük taviz veya savaş zaferiyle kabul). Zayıf hazırlıklı askeri hamleleri ağır kayıp ve iç istikrarsızlıkla cezalandır; en ufak saldırganlıkta çok uluslu yaptırım/koalisyon konseyleri ('convene_diplomatic_council') başlat!",
  },
};

export const TIME_JUMP_LABELS: Record<string, string> = {
  "1W": "1 Hafta",
  "1M": "1 Ay",
  "3M": "3 Ay",
  "6M": "6 Ay",
  "1Y": "1 Yıl",
  SCENARIO_DEFAULT: "Senaryo Varsayılanı",
};

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const SCENARIO_COVER_MAP: Record<string, string> = {
  "2026": "/images/scenarios/2026.jpg",
  "1991": "/images/scenarios/1991.jpg",
  "1962": "/images/scenarios/1962.jpg",
  "1942": "/images/scenarios/1942.jpg",
  "1939": "/images/scenarios/1939.jpg",
  "1936": "/images/scenarios/1936.jpg",
  "1919": "/images/scenarios/1919.jpg",
  "1914": "/images/scenarios/1914.jpg",
  "1877": "/images/scenarios/1877.jpg",
  "1812": "/images/scenarios/1812.jpg",
  "1526": "/images/scenarios/1526.jpg",
  "1444": "/images/scenarios/1444.jpg",
};

/** Resolve cover art URL for a preset scenario or return null for custom scenarios. */
export function getScenarioCoverUrl(scenarioIdOrSlug?: string | null): string | null {
  if (!scenarioIdOrSlug) return null;
  if (SCENARIO_COVER_MAP[scenarioIdOrSlug]) {
    return SCENARIO_COVER_MAP[scenarioIdOrSlug];
  }
  const match = Object.keys(SCENARIO_COVER_MAP).find((key) =>
    scenarioIdOrSlug.startsWith(`${key}-`)
  );
  return match ? SCENARIO_COVER_MAP[match] : null;
}

/** Compact Turkish relative time label (e.g., "14sa önce", "5dk önce"). */
export function formatRelativeTimeTr(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
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
