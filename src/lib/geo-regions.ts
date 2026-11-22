import fs from "node:fs";
import path from "node:path";

export interface GeoRegionMeta {
  regionId: string;
  regionName: string;
  baseCountryName: string;
  baseValue: number;
  centroidLon: number;
  centroidLat: number;
}

interface RawGeoFeature {
  properties: {
    region_id: string;
    region_name: string;
    base_country_name: string;
    base_value?: number;
    centroid_lon?: number;
    centroid_lat?: number;
  };
}

let cachedRegions: GeoRegionMeta[] | null = null;

export function getAllWorldRegions(): GeoRegionMeta[] {
  if (cachedRegions) return cachedRegions;
  const geoPath = path.join(process.cwd(), "public", "geo", "world-provinces.json");
  const raw = JSON.parse(fs.readFileSync(geoPath, "utf8")) as {
    features: RawGeoFeature[];
  };
  cachedRegions = raw.features.map((f) => ({
    regionId: f.properties.region_id,
    regionName: f.properties.region_name,
    baseCountryName: f.properties.base_country_name,
    baseValue: f.properties.base_value ?? 8,
    centroidLon: f.properties.centroid_lon ?? 0,
    centroidLat: f.properties.centroid_lat ?? 0,
  }));
  return cachedRegions;
}

export function getRegionMetaMap(): Map<string, GeoRegionMeta> {
  const map = new Map<string, GeoRegionMeta>();
  for (const r of getAllWorldRegions()) {
    map.set(r.regionId, r);
  }
  return map;
}
