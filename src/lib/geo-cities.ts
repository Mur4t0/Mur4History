import { getRegionMetaMap } from "./geo-regions";

export interface CityCoordEntry {
  city: string;
  lat: number;
  lng: number;
  defaultRegionId?: string;
}

const CITY_CATALOG: CityCoordEntry[] = [
  // Turkey & Surrounding
  { city: "Ankara", lat: 39.9334, lng: 32.8597, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Istanbul", lat: 41.0082, lng: 28.9784, defaultRegionId: "TUR_THRACE" },
  { city: "Izmir", lat: 38.4237, lng: 27.1428, defaultRegionId: "TUR_AEGEAN" },
  { city: "Adana", lat: 37.0, lng: 35.3213, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Konya", lat: 37.8746, lng: 32.4846, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Eskisehir", lat: 39.7667, lng: 30.5256, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Kayseri", lat: 38.7312, lng: 35.4875, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Erzurum", lat: 39.9055, lng: 41.2769, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Diyarbakir", lat: 37.9144, lng: 40.2372, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Gaziantep", lat: 37.0662, lng: 37.3781, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Trabzon", lat: 41.0027, lng: 39.7168, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Samsun", lat: 41.2867, lng: 36.3361, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Bursa", lat: 40.1885, lng: 29.0601, defaultRegionId: "TUR_AEGEAN" },
  { city: "Antalya", lat: 36.8969, lng: 30.7133, defaultRegionId: "TUR_AEGEAN" },
  { city: "Hatay", lat: 36.2026, lng: 36.1604, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Antakya", lat: 36.2026, lng: 36.1604, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Canakkale", lat: 40.1553, lng: 26.4086, defaultRegionId: "TUR_THRACE" },
  { city: "Mersin", lat: 36.8121, lng: 34.6415, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Kirikkale", lat: 39.8468, lng: 33.5153, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Izmit", lat: 40.7654, lng: 29.9408, defaultRegionId: "TUR_THRACE" },
  { city: "Kocaeli", lat: 40.7654, lng: 29.9408, defaultRegionId: "TUR_THRACE" },
  { city: "Zonguldak", lat: 41.4564, lng: 31.7987, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Edirne", lat: 41.6771, lng: 26.5557, defaultRegionId: "TUR_THRACE" },
  { city: "Van", lat: 38.4942, lng: 43.38, defaultRegionId: "TUR_ANATOLIA" },
  { city: "Kars", lat: 40.6013, lng: 43.0975, defaultRegionId: "TUR_ANATOLIA" },

  // Europe
  { city: "London", lat: 51.5074, lng: -0.1278 },
  { city: "Londra", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", lat: 48.8566, lng: 2.3522 },
  { city: "Marseille", lat: 43.2965, lng: 5.3698 },
  { city: "Marsilya", lat: 43.2965, lng: 5.3698 },
  { city: "Lyon", lat: 45.764, lng: 4.8357 },
  { city: "Berlin", lat: 52.52, lng: 13.405 },
  { city: "Munich", lat: 48.1351, lng: 11.582 },
  { city: "Munih", lat: 48.1351, lng: 11.582 },
  { city: "Hamburg", lat: 53.5511, lng: 9.9937 },
  { city: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { city: "Ruhr", lat: 51.4556, lng: 7.0116 },
  { city: "Essen", lat: 51.4556, lng: 7.0116 },
  { city: "Rome", lat: 41.9028, lng: 12.4964 },
  { city: "Roma", lat: 41.9028, lng: 12.4964 },
  { city: "Milan", lat: 45.4642, lng: 9.19 },
  { city: "Milano", lat: 45.4642, lng: 9.19 },
  { city: "Naples", lat: 40.8518, lng: 14.2681 },
  { city: "Venice", lat: 45.4408, lng: 12.3155 },
  { city: "Madrid", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", lat: 41.3874, lng: 2.1686 },
  { city: "Barselona", lat: 41.3874, lng: 2.1686 },
  { city: "Lisbon", lat: 38.7223, lng: -9.1393 },
  { city: "Lizbon", lat: 38.7223, lng: -9.1393 },
  { city: "Vienna", lat: 48.2082, lng: 16.3738 },
  { city: "Viyana", lat: 48.2082, lng: 16.3738 },
  { city: "Prague", lat: 50.0755, lng: 14.4378 },
  { city: "Prag", lat: 50.0755, lng: 14.4378 },
  { city: "Warsaw", lat: 52.2297, lng: 21.0122 },
  { city: "Varsova", lat: 52.2297, lng: 21.0122 },
  { city: "Krakow", lat: 50.0647, lng: 19.945 },
  { city: "Danzig", lat: 54.352, lng: 18.6466 },
  { city: "Gdansk", lat: 54.352, lng: 18.6466 },
  { city: "Budapest", lat: 47.4979, lng: 19.0402 },
  { city: "Budapeste", lat: 47.4979, lng: 19.0402 },
  { city: "Bucharest", lat: 44.4268, lng: 26.1025 },
  { city: "Bukres", lat: 44.4268, lng: 26.1025 },
  { city: "Sofia", lat: 42.6977, lng: 23.3219 },
  { city: "Sofya", lat: 42.6977, lng: 23.3219 },
  { city: "Athens", lat: 37.9838, lng: 23.7275 },
  { city: "Atina", lat: 37.9838, lng: 23.7275 },
  { city: "Thessaloniki", lat: 40.6401, lng: 22.9444 },
  { city: "Selanik", lat: 40.6401, lng: 22.9444 },
  { city: "Belgrade", lat: 44.7866, lng: 20.4489 },
  { city: "Belgrad", lat: 44.7866, lng: 20.4489 },
  { city: "Brussels", lat: 50.8503, lng: 4.3517 },
  { city: "Bruksel", lat: 50.8503, lng: 4.3517 },
  { city: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { city: "Geneva", lat: 46.2044, lng: 6.1432 },
  { city: "Cenevre", lat: 46.2044, lng: 6.1432 },
  { city: "Stockholm", lat: 59.3293, lng: 18.0686 },
  { city: "Oslo", lat: 59.9139, lng: 10.7522 },
  { city: "Helsinki", lat: 60.1699, lng: 24.9384 },
  { city: "Copenhagen", lat: 55.6761, lng: 12.5683 },
  { city: "Kopenhag", lat: 55.6761, lng: 12.5683 },
  { city: "Kyiv", lat: 50.4501, lng: 30.5234 },
  { city: "Kiev", lat: 50.4501, lng: 30.5234 },
  { city: "Sevastopol", lat: 44.6167, lng: 33.5254 },
  { city: "Sivastopol", lat: 44.6167, lng: 33.5254 },
  { city: "Moscow", lat: 55.7558, lng: 37.6173 },
  { city: "Moskova", lat: 55.7558, lng: 37.6173 },
  { city: "Leningrad", lat: 59.9311, lng: 30.3609 },
  { city: "St. Petersburg", lat: 59.9311, lng: 30.3609 },
  { city: "Stalingrad", lat: 48.708, lng: 44.5133 },
  { city: "Volgograd", lat: 48.708, lng: 44.5133 },
  { city: "Murmansk", lat: 68.9585, lng: 33.0827 },
  { city: "Vladivostok", lat: 43.1332, lng: 131.9113 },

  // Caucasus, Middle East, North Africa
  { city: "Baku", lat: 40.4093, lng: 49.8671 },
  { city: "Tbilisi", lat: 41.7151, lng: 44.8271 },
  { city: "Tiflis", lat: 41.7151, lng: 44.8271 },
  { city: "Tehran", lat: 35.6892, lng: 51.389 },
  { city: "Tahran", lat: 35.6892, lng: 51.389 },
  { city: "Tabriz", lat: 38.0962, lng: 46.2738 },
  { city: "Tebriz", lat: 38.0962, lng: 46.2738 },
  { city: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { city: "Bagdat", lat: 33.3152, lng: 44.3661 },
  { city: "Mosul", lat: 36.3489, lng: 43.1577 },
  { city: "Musul", lat: 36.3489, lng: 43.1577 },
  { city: "Kirkuk", lat: 35.4669, lng: 44.3929 },
  { city: "Kerkuk", lat: 35.4669, lng: 44.3929 },
  { city: "Basra", lat: 30.5081, lng: 47.7835 },
  { city: "Damascus", lat: 33.5138, lng: 36.2765 },
  { city: "Sam", lat: 33.5138, lng: 36.2765 },
  { city: "Aleppo", lat: 36.2021, lng: 37.1343 },
  { city: "Halep", lat: 36.2021, lng: 37.1343 },
  { city: "Beirut", lat: 33.8938, lng: 35.5018 },
  { city: "Beyrut", lat: 33.8938, lng: 35.5018 },
  { city: "Jerusalem", lat: 31.7683, lng: 35.2137 },
  { city: "Kudus", lat: 31.7683, lng: 35.2137 },
  { city: "Cairo", lat: 30.0444, lng: 31.2357 },
  { city: "Kahire", lat: 30.0444, lng: 31.2357 },
  { city: "Alexandria", lat: 31.2001, lng: 29.9187 },
  { city: "Iskenderiye", lat: 31.2001, lng: 29.9187 },
  { city: "Suez", lat: 29.9668, lng: 32.5498 },
  { city: "Suveys", lat: 29.9668, lng: 32.5498 },
  { city: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { city: "Riyad", lat: 24.7136, lng: 46.6753 },
  { city: "Aden", lat: 12.7855, lng: 45.0187 },
  { city: "Algiers", lat: 36.7538, lng: 3.0588 },
  { city: "Cezayir", lat: 36.7538, lng: 3.0588 },
  { city: "Tunis", lat: 36.8065, lng: 10.1815 },
  { city: "Casablanca", lat: 33.5731, lng: -7.5898 },
  { city: "Tripoli", lat: 32.8872, lng: 13.1913 },
  { city: "Trablus", lat: 32.8872, lng: 13.1913 },
  { city: "Addis Ababa", lat: 9.032, lng: 38.7469 },
  { city: "Cape Town", lat: -33.9249, lng: 18.4241 },

  // Asia & Pacific
  { city: "Kabul", lat: 34.5553, lng: 69.2075 },
  { city: "Kabil", lat: 34.5553, lng: 69.2075 },
  { city: "Karachi", lat: 24.8607, lng: 67.0011 },
  { city: "Delhi", lat: 28.6139, lng: 77.209 },
  { city: "New Delhi", lat: 28.6139, lng: 77.209 },
  { city: "Mumbai", lat: 19.076, lng: 72.8777 },
  { city: "Calcutta", lat: 22.5726, lng: 88.3639 },
  { city: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { city: "Beijing", lat: 39.9042, lng: 116.4074 },
  { city: "Pekin", lat: 39.9042, lng: 116.4074 },
  { city: "Shanghai", lat: 31.2304, lng: 121.4737 },
  { city: "Sanghay", lat: 31.2304, lng: 121.4737 },
  { city: "Nanjing", lat: 32.0603, lng: 118.7969 },
  { city: "Nankin", lat: 32.0603, lng: 118.7969 },
  { city: "Chongqing", lat: 29.563, lng: 106.5516 },
  { city: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { city: "Taipei", lat: 25.033, lng: 121.5654 },
  { city: "Seoul", lat: 37.5665, lng: 126.978 },
  { city: "Seul", lat: 37.5665, lng: 126.978 },
  { city: "Pyongyang", lat: 39.0392, lng: 125.7625 },
  { city: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { city: "Osaka", lat: 34.6937, lng: 135.5023 },
  { city: "Hiroshima", lat: 34.3853, lng: 132.4553 },
  { city: "Hirosima", lat: 34.3853, lng: 132.4553 },
  { city: "Nagasaki", lat: 32.7503, lng: 129.8777 },
  { city: "Singapore", lat: 1.3521, lng: 103.8198 },
  { city: "Singapur", lat: 1.3521, lng: 103.8198 },
  { city: "Bangkok", lat: 13.7563, lng: 100.5018 },
  { city: "Hanoi", lat: 21.0285, lng: 105.8542 },
  { city: "Saigon", lat: 10.8231, lng: 106.6297 },
  { city: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { city: "Manila", lat: 14.5995, lng: 120.9842 },
  { city: "Sydney", lat: -33.8688, lng: 151.2093 },
  { city: "Sidney", lat: -33.8688, lng: 151.2093 },
  { city: "Melbourne", lat: -37.8136, lng: 144.9631 },

  // Americas
  { city: "Washington", lat: 38.9072, lng: -77.0369 },
  { city: "New York", lat: 40.7128, lng: -74.006 },
  { city: "Chicago", lat: 41.8781, lng: -87.6298 },
  { city: "Detroit", lat: 42.3314, lng: -83.0458 },
  { city: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { city: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { city: "Houston", lat: 29.7604, lng: -95.3698 },
  { city: "Norfolk", lat: 36.8508, lng: -76.2859 },
  { city: "Pearl Harbor", lat: 21.3445, lng: -157.9748 },
  { city: "Ottawa", lat: 45.4215, lng: -75.6972 },
  { city: "Toronto", lat: 43.6532, lng: -79.3832 },
  { city: "Mexico City", lat: 19.4326, lng: -99.1332 },
  { city: "Havana", lat: 23.1136, lng: -82.3666 },
  { city: "Panama", lat: 8.9824, lng: -79.5199 },
  { city: "Bogota", lat: 4.711, lng: -74.0721 },
  { city: "Lima", lat: -12.0464, lng: -77.0428 },
  { city: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { city: "Sao Paulo", lat: -23.5505, lng: -46.6333 },
  { city: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", lat: -33.4489, lng: -70.6693 },
];

export function normalizePlaceKey(value: string): string {
  return value
    .trim()
    .replace(/[İI]/g, "i")
    .replace(/ı/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const CITY_LOOKUP = new Map<string, CityCoordEntry>(
  CITY_CATALOG.map((entry) => [normalizePlaceKey(entry.city), entry])
);

export function findCityCoordinates(cityName?: string | null): CityCoordEntry | null {
  if (!cityName?.trim()) return null;
  const key = normalizePlaceKey(cityName);
  const direct = CITY_LOOKUP.get(key);
  if (direct) return direct;

  for (const [k, entry] of CITY_LOOKUP.entries()) {
    if (key.includes(k) || k.includes(key)) {
      return entry;
    }
  }
  return null;
}

export function resolveMarkerCoordinates(params: {
  lat?: number;
  lng?: number;
  cityName?: string | null;
  regionId?: string | null;
  fallbackRegionId?: string | null;
  existingCoords?: Array<{ lat: number; lng: number }>;
}): {
  lat: number;
  lng: number;
  resolvedRegionId: string | null;
  resolvedCityName: string | null;
} {
  const {
    lat,
    lng,
    cityName,
    regionId,
    fallbackRegionId,
    existingCoords = [],
  } = params;

  const regionMap = getRegionMetaMap();
  const cityHit = findCityCoordinates(cityName);

  let baseLat: number | null =
    typeof lat === "number" && Number.isFinite(lat) ? lat : null;
  let baseLng: number | null =
    typeof lng === "number" && Number.isFinite(lng) ? lng : null;
  let resolvedRegionId: string | null = regionId?.trim() || null;

  if (baseLat === null || baseLng === null) {
    if (cityHit) {
      baseLat = cityHit.lat;
      baseLng = cityHit.lng;
      if (!resolvedRegionId && cityHit.defaultRegionId) {
        resolvedRegionId = cityHit.defaultRegionId;
      }
    }
  }

  if ((baseLat === null || baseLng === null) && resolvedRegionId) {
    const meta = regionMap.get(resolvedRegionId);
    if (meta) {
      baseLat = meta.centroidLat;
      baseLng = meta.centroidLon;
    }
  }

  if ((baseLat === null || baseLng === null) && fallbackRegionId) {
    const capMeta = regionMap.get(fallbackRegionId);
    if (capMeta) {
      baseLat = capMeta.centroidLat;
      baseLng = capMeta.centroidLon;
      if (!resolvedRegionId) resolvedRegionId = capMeta.regionId;
    }
  }

  if (baseLat === null || baseLng === null) {
    baseLat = 39.9334;
    baseLng = 32.8597;
  }

  // Slight spiral dispersion only if another marker occupies nearly the exact same point
  const nearbyCount = existingCoords.filter(
    (pt) => Math.abs(pt.lat - baseLat) < 0.25 && Math.abs(pt.lng - baseLng) < 0.25
  ).length;

  let finalLat = baseLat;
  let finalLng = baseLng;
  if (nearbyCount > 0 && !(typeof lat === "number" && typeof lng === "number")) {
    const angle = nearbyCount * 1.45;
    const radius = 0.42 + Math.floor(nearbyCount / 4) * 0.28;
    finalLat = Number((baseLat + Math.sin(angle) * radius * 0.72).toFixed(4));
    finalLng = Number((baseLng + Math.cos(angle) * radius).toFixed(4));
  }

  return {
    lat: finalLat,
    lng: finalLng,
    resolvedRegionId,
    resolvedCityName: cityName?.trim() || cityHit?.city || null,
  };
}
