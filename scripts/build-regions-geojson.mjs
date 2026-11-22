import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as topojson from "topojson-client";
import polygonClipping from "polygon-clipping";

const require = createRequire(import.meta.url);
const worldAtlas = require("world-atlas/countries-50m.json");

function slugify(input) {
  return String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toMultiPolygonCoords(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function toGeoJsonGeometry(mpCoords) {
  const valid = (mpCoords || []).filter(
    (poly) => Array.isArray(poly) && poly.length > 0 && poly[0].length >= 4
  );
  if (valid.length === 0) return null;
  if (valid.length === 1) {
    return { type: "Polygon", coordinates: valid[0] };
  }
  return { type: "MultiPolygon", coordinates: valid };
}

function boxToPoly(minLon, minLat, maxLon, maxLat) {
  return [
    [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  ];
}

function shiftMultiPolyX(mp, deltaX) {
  return mp.map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => [x + deltaX, y]))
  );
}

function unwrapRing(ring) {
  if (!ring || ring.length === 0) return ring;
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let x = ring[i][0];
    const y = ring[i][1];
    const prevX = out[i - 1][0];
    while (x - prevX > 180) x -= 360;
    while (x - prevX < -180) x += 360;
    out.push([x, y]);
  }
  // Ensure exact closed ring
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out[out.length - 1] = [first[0], first[1]];
  }
  return out;
}

/**
 * Unwraps any ring crossing +/-180 and splits it cleanly at the antimeridian
 * so no polygon ever stretches horizontally across the entire world map.
 */
function sanitizeAntimeridian(geometry) {
  const rawMp = toMultiPolygonCoords(geometry);
  const result = [];

  for (const poly of rawMp) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const pt of poly[0]) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
    }

    if (maxX - minX <= 179.9) {
      result.push(poly);
      continue;
    }

    const unwrappedPoly = poly.map(unwrapRing);
    // Check bounds of unwrapped ring
    let uMinX = Infinity;
    let uMaxX = -Infinity;
    for (const pt of unwrappedPoly[0]) {
      if (pt[0] < uMinX) uMinX = pt[0];
      if (pt[0] > uMaxX) uMaxX = pt[0];
    }

    // If still abnormally wide (like Antarctica polar cap ring), drop degenerate edge wrap
    if (uMaxX - uMinX > 260) {
      continue;
    }

    const singleMp = [unwrappedPoly];
    try {
      const centerPart = polygonClipping.intersection(
        singleMp,
        boxToPoly(-180, -90, 180, 90)
      );
      result.push(...centerPart);

      if (uMaxX > 180) {
        const eastWrap = polygonClipping.intersection(
          singleMp,
          boxToPoly(180, -90, 360, 90)
        );
        result.push(...shiftMultiPolyX(eastWrap, -360));
      }
      if (uMinX < -180) {
        const westWrap = polygonClipping.intersection(
          singleMp,
          boxToPoly(-360, -90, -180, 90)
        );
        result.push(...shiftMultiPolyX(westWrap, 360));
      }
    } catch {
      // Skip corrupted wrapping sliver safely
    }
  }

  return result;
}

function computePolygonMetrics(geometry) {
  const mp = toMultiPolygonCoords(geometry);
  let largestRing = null;
  let maxSpan = -1;
  let totalAreaApprox = 0;

  for (const poly of mp) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pt of ring) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    }
    const area = Math.max(0.01, (maxX - minX) * (maxY - minY));
    totalAreaApprox += area;
    if (area > maxSpan) {
      maxSpan = area;
      largestRing = ring;
    }
  }

  if (!largestRing) {
    return { lon: 0, lat: 0, area: 1 };
  }

  let sumX = 0;
  let sumY = 0;
  for (const pt of largestRing) {
    sumX += pt[0];
    sumY += pt[1];
  }

  return {
    lon: Number((sumX / largestRing.length).toFixed(3)),
    lat: Number((sumY / largestRing.length).toFixed(3)),
    area: Number(totalAreaApprox.toFixed(2)),
  };
}

const SUBDIVISIONS = {
  Turkey: [
    { id: "TUR_MARMARA", name: "İstanbul & Trakya", box: [-180, 39.8, 29.8, 90], value: 18 },
    { id: "TUR_AEGEAN", name: "Batı Anadolu & Ege", box: [-180, -90, 31.8, 39.8], value: 14 },
    { id: "TUR_ANATOLIA", name: "İç Anadolu & Karadeniz", box: [29.8, 36.2, 38.5, 90], value: 14 },
    { id: "TUR_EAST", name: "Doğu Anadolu & Mezopotamya Sınırı", box: null, value: 10 },
  ],
  Germany: [
    { id: "DEU_RHINELAND", name: "Renanya & Ruhr", box: [-180, 49.4, 10.1, 90], value: 20 },
    { id: "DEU_BAVARIA", name: "Bavyera & Güney Almanya", box: [-180, -90, 90, 49.4], value: 16 },
    { id: "DEU_PRUSSIA", name: "Brandenburg & Prusya", box: [10.1, 51.4, 90, 90], value: 18 },
    { id: "DEU_SAXONY", name: "Saksonya & Merkez", box: null, value: 14 },
  ],
  France: [
    { id: "FRA_GUIANA", name: "Fransız Guyanası", box: [-180, -90, -20, 90], value: 4 },
    { id: "FRA_ALSACE", name: "Alsas-Loren & Doğu", box: [5.1, 46.6, 15, 52], value: 15 },
    { id: "FRA_NORMANDY", name: "Normandiya & Manş", box: [-6, 48.2, 2.2, 52], value: 14 },
    { id: "FRA_ILE_DE_FRANCE", name: "Paris & Île-de-France", box: [1.0, 46.6, 5.1, 52], value: 22 },
    { id: "FRA_AQUITAINE", name: "Akitanya & Oksitanya", box: null, value: 14 },
  ],
  "United Kingdom": [
    { id: "GBR_SCOTLAND", name: "İskoçya", box: [-180, 55.1, 90, 90], value: 12 },
    { id: "GBR_ENGLAND", name: "İngiltere & Galler", box: null, value: 24 },
  ],
  Italy: [
    { id: "ITA_NORTH", name: "Lombardiya & Kuzey İtalya", box: [-180, 43.3, 90, 90], value: 18 },
    { id: "ITA_SOUTH", name: "Roma, Napoli & Sicilya", box: null, value: 15 },
  ],
  Spain: [
    { id: "ESP_NORTH", name: "Katalonya & Bask", box: [-180, 40.8, 90, 90], value: 13 },
    { id: "ESP_CASTILE", name: "Kastilya & Endülüs", box: null, value: 15 },
  ],
  Poland: [
    { id: "POL_WEST", name: "Batı Polonya & Silezya", box: [-180, -90, 19.8, 90], value: 12 },
    { id: "POL_WARSAW", name: "Varşova & Doğu Polonya", box: null, value: 14 },
  ],
  Ukraine: [
    { id: "UKR_WEST", name: "Kiev & Batı Ukrayna", box: [-180, -90, 32.4, 90], value: 13 },
    { id: "UKR_EAST", name: "Donbas, Kırım & Doğu", box: null, value: 14 },
  ],
  Russia: [
    { id: "RUS_LENINGRAD", name: "Leningrad & Karelya", box: [18, 57.5, 42, 90], value: 15 },
    { id: "RUS_MOSCOW", name: "Moskova & Merkez Rusya", box: [18, 51, 45, 57.5], value: 22 },
    { id: "RUS_CAUCASUS", name: "Kuzey Kafkasya & Volga", box: [18, -90, 52, 51], value: 14 },
    { id: "RUS_URALS", name: "Urallar & Batı Sibirya", box: [45, -90, 95, 90], value: 16 },
    { id: "RUS_FAR_EAST", name: "Doğu Sibirya & Uzak Doğu", box: null, value: 12 },
  ],
  "United States of America": [
    { id: "USA_NORTHEAST", name: "Kuzeydoğu & Washington", box: [-83, 36.5, -60, 55], value: 25 },
    { id: "USA_SOUTH", name: "Güney Eyaletleri & Teksas", box: [-106, 20, -60, 36.5], value: 20 },
    { id: "USA_MIDWEST", name: "Ortabatı & Büyük Göller", box: [-106, 36.5, -83, 55], value: 19 },
    { id: "USA_WEST", name: "Kaliforniya & Batı Kıyısı", box: [-130, 20, -106, 55], value: 22 },
    { id: "USA_ALASKA", name: "Alaska & Kuzey Pasifik", box: null, value: 8 },
  ],
  China: [
    { id: "CHN_MANCHURIA", name: "Mançurya & Kuzeydoğu", box: [118, 39.5, 140, 60], value: 16 },
    { id: "CHN_NORTH", name: "Pekin & Kuzey Çin", box: [102, 31.5, 140, 60], value: 22 },
    { id: "CHN_SOUTH", name: "Şanghay, Kanton & Güney", box: [98, -90, 140, 31.5], value: 22 },
    { id: "CHN_WEST", name: "Sincan, Tibet & Batı", box: null, value: 10 },
  ],
  India: [
    { id: "IND_NORTH", name: "Delhi & Ganj Ovası", box: [-180, 21.5, 90, 90], value: 18 },
    { id: "IND_SOUTH", name: "Dekkan & Güney Hindistan", box: null, value: 16 },
  ],
  Japan: [
    { id: "JPN_NORTH", name: "Hokkaido & Kuzey Honşu", box: [-180, 37.5, 180, 90], value: 12 },
    { id: "JPN_HONSHU", name: "Tokyo, Kyoto & Güney", box: null, value: 22 },
  ],
  Iran: [
    { id: "IRN_WEST", name: "Tahran, Tebriz & Batı", box: [-180, -90, 53, 90], value: 13 },
    { id: "IRN_EAST", name: "Horasan & Doğu İran", box: null, value: 9 },
  ],
  Egypt: [
    { id: "EGY_DELTA", name: "Kahire, İskenderiye & Süveyş", box: [-180, 28.8, 90, 90], value: 14 },
    { id: "EGY_UPPER", name: "Yukarı Mısır & Nil", box: null, value: 8 },
  ],
  Brazil: [
    { id: "BRA_COAST", name: "Rio, São Paulo & Atlas Kıyısı", box: [-48, -90, 0, 90], value: 16 },
    { id: "BRA_AMAZON", name: "Amazon & İç Brezilya", box: null, value: 10 },
  ],
};

const COUNTRY_CODE_MAP = {
  "United States of America": "USA",
  "United Kingdom": "GBR",
  Russia: "RUS",
  Turkey: "TUR",
  Germany: "DEU",
  France: "FRA",
  Italy: "ITA",
  Spain: "ESP",
  Poland: "POL",
  Ukraine: "UKR",
  China: "CHN",
  Japan: "JPN",
  India: "IND",
  Brazil: "BRA",
  Iran: "IRN",
  Egypt: "EGY",
  Canada: "CAN",
  Mexico: "MEX",
  Argentina: "ARG",
  Australia: "AUS",
  "Saudi Arabia": "SAU",
  Iraq: "IRQ",
  Syria: "SYR",
  Israel: "ISR",
  Palestine: "PSE",
  Jordan: "JOR",
  Lebanon: "LBN",
  Greece: "GRC",
  Bulgaria: "BGR",
  Romania: "ROU",
  Hungary: "HUN",
  Austria: "AUT",
  Czechia: "CZE",
  Slovakia: "SVK",
  Switzerland: "CHE",
  Netherlands: "NLD",
  Belgium: "BEL",
  Portugal: "PRT",
  Sweden: "SWE",
  Norway: "NOR",
  Finland: "FIN",
  Denmark: "DNK",
  Ireland: "IRL",
  "South Korea": "KOR",
  "North Korea": "PRK",
  Vietnam: "VNM",
  Thailand: "THA",
  Indonesia: "IDN",
  Pakistan: "PAK",
  Afghanistan: "AFG",
  Kazakhstan: "KAZ",
  "South Africa": "ZAF",
  Nigeria: "NGA",
  Ethiopia: "ETH",
  Algeria: "DZA",
  Morocco: "MAR",
  Libya: "LBY",
  Belarus: "BLR",
  Serbia: "SRB",
  Croatia: "HRV",
  "Bosnia and Herz.": "BIH",
  Georgia: "GEO",
  Azerbaijan: "AZE",
  Armenia: "ARM",
  Taiwan: "TWN",
  Philippines: "PHL",
  Malaysia: "MYS",
  Myanmar: "MMR",
  Colombia: "COL",
  Venezuela: "VEN",
  Peru: "PER",
  Chile: "CHL",
  Cuba: "CUB",
  Cyprus: "CYP",
  "N. Cyprus": "NCY",
  Sudan: "SDN",
  "S. Sudan": "SSD",
  "Dem. Rep. Congo": "COD",
  Kenya: "KEN",
  Tanzania: "TZA",
  Angola: "AGO",
  Mongolia: "MNG",
  Uzbekistan: "UZB",
  Turkmenistan: "TKM",
  "New Zealand": "NZL",
  Greenland: "GRL",
  Iceland: "ISL",
  Yemen: "YEM",
  Oman: "OMN",
  "United Arab Emirates": "ARE",
  Qatar: "QAT",
  Kuwait: "KWT",
  Lithuania: "LTU",
  Latvia: "LVA",
  Estonia: "EST",
  Moldova: "MDA",
  Albania: "ALB",
  Macedonia: "MKD",
  Kosovo: "XKX",
  Montenegro: "MNE",
  Slovenia: "SVN",
  Luxembourg: "LUX",
  Tunisia: "TUN",
  "W. Sahara": "ESH",
  Somalia: "SOM",
  Somaliland: "SML",
  Mali: "MLI",
  Niger: "NER",
  Chad: "TCD",
  Mauritania: "MRT",
  Senegal: "SEN",
  Ghana: "GHA",
  Cameroon: "CMR",
  Madagascar: "MDG",
  Mozambique: "MOZ",
  Zambia: "ZMB",
  Zimbabwe: "ZWE",
  Namibia: "NAM",
  Botswana: "BWA",
  Bolivia: "BOL",
  Paraguay: "PRY",
  Uruguay: "URY",
  Ecuador: "ECU",
  Bangladesh: "BGD",
  Nepal: "NPL",
  "Sri Lanka": "LKA",
  Cambodia: "KHM",
  Laos: "LAO",
  "Papua New Guinea": "PNG",
  Kyrgyzstan: "KGZ",
  Tajikistan: "TJK",
  Guatemala: "GTM",
  Honduras: "HND",
  Nicaragua: "NIC",
  "Costa Rica": "CRI",
  Panama: "PAN",
  "Dominican Rep.": "DOM",
  Haiti: "HTI",
  Jamaica: "JAM",
  "Puerto Rico": "PRI",
  Guyana: "GUY",
  Suriname: "SUR",
  Singapore: "SGP",
  Malta: "MLT",
  Bahrain: "BHR",
  Andorra: "AND",
  Monaco: "MCO",
  Liechtenstein: "LIE",
  "San Marino": "SMR",
  Vatican: "VAT",
  Maldives: "MDV",
  Mauritius: "MUS",
  Comoros: "COM",
  Seychelles: "SYC",
  "Cabo Verde": "CPV",
  Barbados: "BRB",
  "Saint Lucia": "LCA",
  Grenada: "GRD",
  "Antigua and Barb.": "ATG",
  Dominica: "DMA",
  "St. Kitts and Nevis": "KNA",
  "St. Vin. and Gren.": "VCT",
  Samoa: "WSM",
  Tonga: "TON",
  Palau: "PLW",
  Micronesia: "FSM",
  "Marshall Is.": "MHL",
  Kiribati: "KIR",
  Tuvalu: "TUV",
  Nauru: "NRU",
  "Hong Kong": "HKG",
  Macao: "MAC",
};

function buildGeoJson() {
  const countriesGeo = topojson.feature(
    worldAtlas,
    worldAtlas.objects.countries
  );

  const outputFeatures = [];
  const antarcticaFeatures = [];
  const usedIds = new Set();

  for (const feature of countriesGeo.features) {
    const rawName =
      feature.properties?.name || `Region ${feature.id ?? "Unknown"}`;

    const cleanMp = sanitizeAntimeridian(feature.geometry);
    const cleanGeom = toGeoJsonGeometry(cleanMp);
    if (!cleanGeom) continue;

    if (rawName === "Antarctica" || rawName === "Fr. S. Antarctic Lands") {
      antarcticaFeatures.push({
        type: "Feature",
        properties: { name: rawName },
        geometry: cleanGeom,
      });
      continue;
    }

    const subdivisions = SUBDIVISIONS[rawName];
    if (subdivisions && subdivisions.length > 0) {
      let remaining = cleanMp;

      for (let i = 0; i < subdivisions.length; i++) {
        const sub = subdivisions[i];
        let pieceCoords = [];
        if (sub.box) {
          const box = boxToPoly(...sub.box);
          try {
            pieceCoords = polygonClipping.intersection(remaining, box);
            remaining = polygonClipping.difference(remaining, box);
          } catch {
            pieceCoords = [];
          }
        } else {
          pieceCoords = remaining;
        }

        const geom = toGeoJsonGeometry(pieceCoords);
        if (!geom) continue;

        const metrics = computePolygonMetrics(geom);
        usedIds.add(sub.id);
        outputFeatures.push({
          type: "Feature",
          properties: {
            region_id: sub.id,
            region_name: sub.name,
            base_country_name: rawName,
            base_iso_num: feature.id ?? null,
            base_value: sub.value,
            centroid_lon: metrics.lon,
            centroid_lat: metrics.lat,
            area_approx: metrics.area,
          },
          geometry: geom,
        });
      }
    } else {
      let code = COUNTRY_CODE_MAP[rawName] || slugify(rawName).slice(0, 8);
      if (usedIds.has(code)) {
        code = `${code}_${feature.id ?? usedIds.size}`;
      }
      usedIds.add(code);
      const metrics = computePolygonMetrics(cleanGeom);
      outputFeatures.push({
        type: "Feature",
        properties: {
          region_id: code,
          region_name: rawName,
          base_country_name: rawName,
          base_iso_num: feature.id ?? null,
          base_value: 8,
          centroid_lon: metrics.lon,
          centroid_lat: metrics.lat,
          area_approx: metrics.area,
        },
        geometry: cleanGeom,
      });
    }
  }

  const outDir = path.join(process.cwd(), "public", "geo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "world-provinces.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ type: "FeatureCollection", features: outputFeatures })
  );

  const antPath = path.join(outDir, "antarctica.json");
  fs.writeFileSync(
    antPath,
    JSON.stringify({ type: "FeatureCollection", features: antarcticaFeatures })
  );

  console.log(
    `Generated ${outputFeatures.length} clean 50m strategic provinces + ${antarcticaFeatures.length} Antarctica polygons`
  );
}

buildGeoJson();
