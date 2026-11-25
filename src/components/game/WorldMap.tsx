"use client";

import { useLocale } from "@/components/LanguageProvider";
import { getCartographicMapLabel, getCountryDisplayName } from "@/lib/i18n";

import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import polygonClipping from "polygon-clipping";
import type {
  CountryRecord,
  DiplomacyRecord,
  MapMarkerRecord,
  MapMode,
  RegionRecord,
  WarOperationRecord,
  WarRiskSummary,
} from "@/lib/client-types";
import {
  WarEffectsCanvas,
  type NuclearAnimationEvent,
} from "./WarEffectsCanvas";
import {
  DEFAULT_GAME_SETTINGS,
  MAP_THEME_BY_ID,
  type MapAppearanceSettings,
} from "@/lib/map-themes";
import {
  buildCurvedLabelAxis,
  registerProceduralMapPatterns,
} from "@/lib/map-patterns";

interface RawFeature {
  type: "Feature";
  properties: {
    region_id: string;
    region_name: string;
    base_country_name: string;
    base_value?: number;
    centroid_lon?: number;
    centroid_lat?: number;
    area_approx?: number;
    [key: string]: unknown;
  };
  geometry: GeoJSON.Geometry;
}

interface RawCollection {
  type: "FeatureCollection";
  features: RawFeature[];
}

interface WorldMapProps {
  regions: RegionRecord[];
  countries: CountryRecord[];
  diplomacies: DiplomacyRecord[];
  mapMarkers?: MapMarkerRecord[];
  warOperations?: WarOperationRecord[];
  warHotspots?: WarRiskSummary[];
  playerRisks?: Record<string, WarRiskSummary>;
  activeNukes?: NuclearAnimationEvent[];
  onExpireNuke?: (id: string) => void;
  nukeShake?: boolean;
  mapMode: MapMode;
  mapSettings?: MapAppearanceSettings;
  perspectiveCountryCode: string | null;
  selectedRegionId: string | null;
  flashedRegionIds: string[];
  flashedMarkerIds?: string[];
  focusMarkerCoord?: { lng: number; lat: number; ts: number } | null;
  onSelectRegion: (regionId: string, ownerCountryCode: string) => void;
}

const MARKER_THEME: Record<
  string,
  { color: string; glow: string; labelTr: string; labelEn: string; svg: string }
> = {
  INDUSTRY: {
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.55)",
    labelTr: "Sanayi / Üretim",
    labelEn: "Industry / Manufacturing",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>',
  },
  MILITARY: {
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.6)",
    labelTr: "Askeri Üs / Tahkimat",
    labelEn: "Military Base / Fortification",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  },
  INFRASTRUCTURE: {
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.55)",
    labelTr: "Altyapı / Lojistik",
    labelEn: "Infrastructure / Logistics",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  },
  NAVAL: {
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.55)",
    labelTr: "Donanma / Tersane",
    labelEn: "Naval / Shipyard",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>',
  },
  RESEARCH: {
    color: "#a855f7",
    glow: "rgba(168, 85, 247, 0.58)",
    labelTr: "Araştırma / Teknoloji",
    labelEn: "Research / Technology",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></svg>',
  },
  DIPLOMACY: {
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.55)",
    labelTr: "Zirve / Diplomasi",
    labelEn: "Summit / Diplomacy",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  },
  INTERNAL: {
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.55)",
    labelTr: "Ulusal Proje",
    labelEn: "National Project",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6 21V9"/><path d="M18 21V9"/><path d="M2 9l10-5 10 5"/></svg>',
  },
  CRISIS: {
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.65)",
    labelTr: "Kriz / Çatışma",
    labelEn: "Crisis / Flashpoint",
    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  },
};

const MARKER_STATUS_LABEL: Record<string, { tr: string; en: string }> = {
  ACTIVE: { tr: "Aktif", en: "Active" },
  UNDER_CONSTRUCTION: { tr: "İnşa Halinde", en: "Under Construction" },
  DAMAGED: { tr: "Hasarlı", en: "Damaged" },
  ALERT: { tr: "Acil Durum", en: "High Alert" },
  COMPLETED: { tr: "Tamamlandı", en: "Completed" },
};

const REGION_STATUS_LABEL: Record<string, { tr: string; en: string }> = {
  CORE: { tr: "Çekirdek", en: "Core" },
  CAPITAL: { tr: "Başkent", en: "Capital" },
  FRONTIER: { tr: "Sınır", en: "Frontier" },
  OCCUPIED: { tr: "İşgal Altında", en: "Occupied" },
  CONTESTED: { tr: "Çekişmeli", en: "Contested" },
  FORTIFIED: { tr: "Müstahkem", en: "Fortified" },
  ECONOMIC_HUB: { tr: "Ekonomi Merkezi", en: "Economic Hub" },
  STANDARD: { tr: "Standart", en: "Standard" },
};

function economyColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#22c55e";
  if (score >= 55) return "#84cc16";
  if (score >= 40) return "#eab308";
  if (score >= 25) return "#f97316";
  return "#dc2626";
}

function threatColor(infamy: number): string {
  if (infamy >= 60) return "#dc2626";
  if (infamy >= 35) return "#f97316";
  if (infamy >= 15) return "#eab308";
  return "#1e293b";
}

function diplomacyColor(status: string | undefined, isSelf: boolean): string {
  if (isSelf) return "#3b82f6";
  switch (status) {
    case "ALLIANCE":
      return "#10b981";
    case "NON_AGGRESSION":
      return "#06b6d4";
    case "VASSAL":
      return "#a855f7";
    case "WAR":
      return "#ef4444";
    case "EMBARGO":
      return "#f59e0b";
    default:
      return "#283852";
  }
}

function getFeatureBbox(feat: RawFeature): [number, number, number, number] {
  const mp = toMultiPolygonCoords(feat.geometry);
  let bestArea = -1;
  let bestBox: [number, number, number, number] = [0, 0, 0, 0];
  for (const poly of mp) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of poly[0] || []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) {
      bestArea = area;
      bestBox = [minX, minY, maxX, maxY];
    }
  }
  return bestBox;
}

function clusterContiguousFeatures(feats: RawFeature[]): RawFeature[][] {
  const bboxes = feats.map(getFeatureBbox);
  const clusters: RawFeature[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < feats.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);
    const queue = [i];
    const group = [feats[i]];

    while (queue.length > 0) {
      const currIdx = queue.shift()!;
      const [aMinX, aMinY, aMaxX, aMaxY] = bboxes[currIdx];

      for (let j = 0; j < feats.length; j++) {
        if (visited.has(j)) continue;
        const [bMinX, bMinY, bMaxX, bMaxY] = bboxes[j];
        // Adjacent/overlapping landmasses within 4 degrees (excludes across-ocean colonies)
        const xGap = Math.max(0, bMinX - aMaxX, aMinX - bMaxX);
        const yGap = Math.max(0, bMinY - aMaxY, aMinY - bMaxY);
        if (xGap <= 4 && yGap <= 4) {
          visited.add(j);
          queue.push(j);
          group.push(feats[j]);
        }
      }
    }
    clusters.push(group);
  }
  return clusters;
}

function toMultiPolygonCoords(geometry: GeoJSON.Geometry): polygonClipping.MultiPolygon {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as polygonClipping.Polygon];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates as polygonClipping.MultiPolygon;
  }
  return [];
}

function computeBestLabelPoint(
  coords: polygonClipping.MultiPolygon
): { lon: number; lat: number; area: number; rotate: number } {
  let bestRing: polygonClipping.Ring | null = null;
  let bestArea = -1;
  let bestBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  for (const poly of coords) {
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
    // Guard against antimeridian-spanning rings
    const dx = maxX - minX > 180 ? 40 : maxX - minX;
    const dy = maxY - minY;
    const area = Math.max(0.05, dx * dy);
    if (area > bestArea) {
      bestArea = area;
      bestRing = ring;
      bestBounds = { minX, maxX, minY, maxY };
    }
  }

  if (!bestRing) return { lon: 0, lat: 0, area: 1, rotate: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const pt of bestRing) {
    sumX += pt[0];
    sumY += pt[1];
  }
  const lon = sumX / bestRing.length;
  const lat = sumY / bestRing.length;

  const spanX = Math.max(0.1, bestBounds.maxX - bestBounds.minX);
  const spanY = Math.max(0.1, bestBounds.maxY - bestBounds.minY);
  let rotate = 0;
  if (spanY > spanX * 1.7 && bestArea > 12) {
    rotate = -62;
  } else if (spanX < spanY * 0.85 && bestArea > 25) {
    rotate = -35;
  }

  return { lon, lat, area: bestArea, rotate };
}

function applyMapThemeToMapLibre(
  map: MapLibreMap,
  settings: MapAppearanceSettings
): void {
  const theme = MAP_THEME_BY_ID[settings.themeId] ?? MAP_THEME_BY_ID.pax_atlas;

  if (map.getLayer("ocean-bg")) {
    map.setPaintProperty("ocean-bg", "background-color", theme.oceanColor);
  }

  if (map.getLayer("ocean-pattern-bg")) {
    const showOceanPattern =
      theme.oceanPattern !== "none" && map.hasImage(theme.oceanPattern);
    map.setLayoutProperty(
      "ocean-pattern-bg",
      "visibility",
      showOceanPattern ? "visible" : "none"
    );
    if (showOceanPattern) {
      map.setPaintProperty(
        "ocean-pattern-bg",
        "background-pattern",
        theme.oceanPattern
      );
      map.setPaintProperty(
        "ocean-pattern-bg",
        "background-opacity",
        theme.oceanPatternOpacity
      );
    }
  }

  if (map.getLayer("physical-relief")) {
    const showPhysical =
      settings.showTerrainRelief && theme.physicalRasterEnabled;
    map.setLayoutProperty(
      "physical-relief",
      "visibility",
      showPhysical ? "visible" : "none"
    );
    if (showPhysical) {
      map.setPaintProperty(
        "physical-relief",
        "raster-brightness-min",
        theme.physicalBrightnessMin
      );
      map.setPaintProperty(
        "physical-relief",
        "raster-brightness-max",
        theme.physicalBrightnessMax
      );
      map.setPaintProperty(
        "physical-relief",
        "raster-contrast",
        theme.physicalContrast
      );
      map.setPaintProperty(
        "physical-relief",
        "raster-saturation",
        theme.physicalSaturation
      );
      map.setPaintProperty(
        "physical-relief",
        "raster-hue-rotate",
        theme.physicalHueRotate
      );
      map.setPaintProperty(
        "physical-relief",
        "raster-opacity",
        theme.physicalOpacity
      );
    }
  }

  if (map.getLayer("antarctica-fill")) {
    map.setPaintProperty("antarctica-fill", "fill-color", theme.antarcticaColor);
    map.setPaintProperty(
      "antarctica-fill",
      "fill-opacity",
      theme.antarcticaOpacity
    );
  }

  if (map.getLayer("province-fills")) {
    map.setPaintProperty("province-fills", "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      Math.min(0.94, theme.landFillOpacity + 0.16),
      ["boolean", ["feature-state", "flashed"], false],
      0.94,
      ["boolean", ["feature-state", "selected"], false],
      Math.min(0.92, theme.landFillOpacity + 0.12),
      theme.landFillOpacity,
    ]);
  }

  if (map.getLayer("land-texture-overlay")) {
    const showLandTex =
      theme.landTexture !== "none" && map.hasImage(theme.landTexture);
    map.setLayoutProperty(
      "land-texture-overlay",
      "visibility",
      showLandTex ? "visible" : "none"
    );
    if (showLandTex) {
      map.setPaintProperty(
        "land-texture-overlay",
        "fill-pattern",
        theme.landTexture
      );
      map.setPaintProperty(
        "land-texture-overlay",
        "fill-opacity",
        theme.landTextureOpacity
      );
    }
  }

  if (map.getLayer("coastal-glow")) {
    map.setLayoutProperty(
      "coastal-glow",
      "visibility",
      settings.showCoastalGlow ? "visible" : "none"
    );
    map.setPaintProperty("coastal-glow", "line-color", theme.coastalGlowColor);
    map.setPaintProperty("coastal-glow", "line-width", theme.coastalGlowWidth);
    map.setPaintProperty("coastal-glow", "line-blur", theme.coastalGlowBlur);
    map.setPaintProperty(
      "coastal-glow",
      "line-opacity",
      theme.coastalGlowOpacity
    );
  }

  if (map.getLayer("province-internal-borders")) {
    map.setLayoutProperty(
      "province-internal-borders",
      "visibility",
      settings.showProvinceBorders ? "visible" : "none"
    );
    map.setPaintProperty(
      "province-internal-borders",
      "line-color",
      theme.provinceBorderColor
    );
  }

  if (map.getLayer("country-borders")) {
    map.setPaintProperty(
      "country-borders",
      "line-color",
      theme.countryBorderColor
    );
    map.setPaintProperty("country-borders", "line-width", [
      "interpolate",
      ["linear"],
      ["zoom"],
      1.5,
      theme.countryBorderWidth,
      5,
      Number((theme.countryBorderWidth * 1.65).toFixed(2)),
    ]);
  }

  if (map.getLayer("country-highlighted-borders")) {
    map.setPaintProperty(
      "country-highlighted-borders",
      "line-color",
      theme.countryHighlightBorderColor
    );
  }

  if (map.getLayer("country-curved-labels")) {
    map.setLayoutProperty(
      "country-curved-labels",
      "visibility",
      settings.showCurvedLabels ? "visible" : "none"
    );
    map.setLayoutProperty(
      "country-curved-labels",
      "text-letter-spacing",
      theme.labelLetterSpacing
    );
    map.setPaintProperty(
      "country-curved-labels",
      "text-color",
      theme.labelColor
    );
    map.setPaintProperty(
      "country-curved-labels",
      "text-halo-color",
      theme.labelHaloColor
    );
    map.setPaintProperty(
      "country-curved-labels",
      "text-halo-width",
      theme.labelHaloWidth
    );
  }

  if (map.getLayer("country-labels-layer")) {
    map.setFilter(
      "country-labels-layer",
      settings.showCurvedLabels
        ? ["==", ["coalesce", ["get", "hasCurved"], 0], 0]
        : ["all"]
    );
    map.setLayoutProperty(
      "country-labels-layer",
      "text-letter-spacing",
      Math.max(0.06, theme.labelLetterSpacing * 0.55)
    );
    map.setPaintProperty("country-labels-layer", "text-color", theme.labelColor);
    map.setPaintProperty(
      "country-labels-layer",
      "text-halo-color",
      theme.labelHaloColor
    );
    map.setPaintProperty(
      "country-labels-layer",
      "text-halo-width",
      theme.labelHaloWidth
    );
  }

  if (map.getLayer("province-labels-layer")) {
    map.setPaintProperty("province-labels-layer", "text-color", theme.labelColor);
    map.setPaintProperty(
      "province-labels-layer",
      "text-halo-color",
      theme.labelHaloColor
    );
  }
}

interface HoverProvinceState {
  x: number;
  y: number;
  regionId: string;
  regionName: string;
  ownerName: string;
  ownerFlag: string;
  ownerCode: string;
  strategicStatus: string;
  baseValue: number;
}

interface HoveredMarkerState {
  marker: MapMarkerRecord;
  x: number;
  y: number;
}

interface OverlayHudApi {
  setHoverInfo: (next: HoverProvinceState | null) => void;
  setHoveredMarker: (
    next:
      | HoveredMarkerState
      | null
      | ((curr: HoveredMarkerState | null) => HoveredMarkerState | null)
  ) => void;
  setPinnedMarker: (
    next:
      | MapMarkerRecord
      | null
      | ((curr: MapMarkerRecord | null) => MapMarkerRecord | null)
  ) => void;
}

const MapHoverOverlays = memo(function MapHoverOverlays({
  apiRef,
  countryByCode,
  perspectiveCountryCode,
  playerRisks,
  locale,
}: {
  apiRef: MutableRefObject<OverlayHudApi | null>;
  countryByCode: Map<string, CountryRecord>;
  perspectiveCountryCode: string | null;
  playerRisks: Record<string, WarRiskSummary>;
  locale: "tr" | "en";
}) {
  const isTr = locale === "tr";
  const [hoverInfo, setHoverInfo] = useState<HoverProvinceState | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarkerState | null>(
    null
  );
  const [pinnedMarker, setPinnedMarker] = useState<MapMarkerRecord | null>(null);

  apiRef.current = {
    setHoverInfo,
    setHoveredMarker,
    setPinnedMarker,
  };

  const activeCardMarker = pinnedMarker ?? hoveredMarker?.marker ?? null;
  const activeMarkerOwner = activeCardMarker
    ? countryByCode.get(activeCardMarker.countryCode)
    : undefined;
  const activeMarkerTheme = activeCardMarker
    ? MARKER_THEME[activeCardMarker.category] ?? MARKER_THEME.INDUSTRY
    : null;

  return (
    <>
      {activeCardMarker && activeMarkerTheme && (
        <div
          className={`${
            pinnedMarker
              ? "pointer-events-auto bottom-16 left-1/2 -translate-x-1/2"
              : "pointer-events-none"
          } absolute z-30 w-72 rounded-xl border border-border bg-[#0b111b]/95 p-3 text-xs shadow-2xl backdrop-blur-md`}
          style={
            pinnedMarker
              ? undefined
              : hoveredMarker
                ? {
                    left: Math.min(
                      hoveredMarker.x + 16,
                      typeof window !== "undefined" ? window.innerWidth - 310 : 900
                    ),
                    top: Math.max(hoveredMarker.y - 95, 68),
                  }
                : undefined
          }
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full animate-pulse"
                  style={{ backgroundColor: activeMarkerTheme.color }}
                />
                <span className="font-semibold text-foreground leading-snug">
                  {activeCardMarker.title}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>
                  {activeMarkerOwner?.flagEmoji ?? "🏳️"}{" "}
                  {getCountryDisplayName(
                    activeCardMarker.countryCode,
                    activeMarkerOwner?.name ?? activeCardMarker.countryCode,
                    locale
                  )}
                </span>
                <span>•</span>
                <span className="text-primary font-medium">
                  {activeCardMarker.cityName ||
                    activeCardMarker.regionId ||
                    (isTr ? "Stratejik Nokta" : "Strategic Point")}
                </span>
              </div>
            </div>
            {pinnedMarker && (
              <button
                type="button"
                onClick={() => setPinnedMarker(null)}
                className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                title={isTr ? "Kapat" : "Close"}
              >
                ✕
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-foreground/90">
            {activeCardMarker.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-2 text-[10px]">
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: `${activeMarkerTheme.color}22`,
                color: activeMarkerTheme.color,
              }}
            >
              {isTr ? activeMarkerTheme.labelTr : activeMarkerTheme.labelEn} •{" "}
              {isTr ? "Svy" : "Lv"} {activeCardMarker.level}
            </span>
            <span className="text-muted-foreground">
              {MARKER_STATUS_LABEL[activeCardMarker.status]?.[locale] ??
                activeCardMarker.status}{" "}
              • {isTr ? "Tur" : "Turn"} {activeCardMarker.turnNumber}
            </span>
          </div>
        </div>
      )}

      {hoverInfo && !hoveredMarker && (
        <div
          className="pointer-events-none absolute z-30 w-56 rounded-lg border border-border bg-[#0b111b]/95 p-2.5 text-xs shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(
              hoverInfo.x + 14,
              typeof window !== "undefined" ? window.innerWidth - 250 : 900
            ),
            top: Math.max(hoverInfo.y - 70, 64),
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              {hoverInfo.regionName}
            </span>
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {hoverInfo.regionId}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{hoverInfo.ownerFlag}</span>
            <span className="font-medium text-foreground/90">
              {getCountryDisplayName(
                hoverInfo.ownerCode,
                hoverInfo.ownerName,
                locale
              )}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
            <span>
              {isTr ? "Statü" : "Status"}:{" "}
              {REGION_STATUS_LABEL[hoverInfo.strategicStatus]?.[locale] ??
                hoverInfo.strategicStatus}
            </span>
            <span>
              {isTr ? "Değer" : "Value"}: {hoverInfo.baseValue}
            </span>
          </div>
          {hoverInfo.ownerCode !== perspectiveCountryCode &&
            playerRisks[hoverInfo.ownerCode] && (
              <div className="mt-1 flex items-center justify-between rounded bg-rose-950/50 px-1.5 py-0.5 text-[10px] text-rose-200">
                <span>{isTr ? "Savaş Olasılığı:" : "War Risk:"}</span>
                <span className="font-mono font-bold">
                  %{playerRisks[hoverInfo.ownerCode].probability}
                </span>
              </div>
            )}
        </div>
      )}
    </>
  );
});

const MAX_ANIMATED_PULSE_MARKERS = 14;

export const WorldMap = memo(function WorldMap({
  regions,
  countries,
  diplomacies,
  mapMarkers = [],
  warOperations = [],
  warHotspots = [],
  playerRisks = {},
  activeNukes = [],
  onExpireNuke,
  nukeShake = false,
  mapMode,
  mapSettings = DEFAULT_GAME_SETTINGS.map,
  perspectiveCountryCode,
  selectedRegionId,
  flashedRegionIds,
  flashedMarkerIds = [],
  focusMarkerCoord = null,
  onSelectRegion,
}: WorldMapProps) {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersMapRef = useRef<
    globalThis.Map<string, { marker: Marker; sig: string }>
  >(new globalThis.Map());
  const overlayApiRef = useRef<OverlayHudApi | null>(null);
  const prevSelectedRegionRef = useRef<string | null>(null);
  const prevFlashedRegionsRef = useRef<string[]>([]);
  const [rawGeo, setRawGeo] = useState<RawCollection | null>(null);
  const [antarcticaGeo, setAntarcticaGeo] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;

  const countryByCode = useMemo(() => {
    const map = new Map<string, CountryRecord>();
    for (const c of countries) map.set(c.code, c);
    return map;
  }, [countries]);

  const regionById = useMemo(() => {
    const map = new Map<string, RegionRecord>();
    for (const r of regions) map.set(r.regionId, r);
    return map;
  }, [regions]);

  const diplomacyLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (!perspectiveCountryCode) return map;
    for (const d of diplomacies) {
      if (d.countryA === perspectiveCountryCode) {
        map.set(d.countryB, d.status);
      } else if (d.countryB === perspectiveCountryCode) {
        map.set(d.countryA, d.status);
      }
    }
    return map;
  }, [diplomacies, perspectiveCountryCode]);

  const hoverDataRef = useRef({ countryByCode, regionById });
  hoverDataRef.current = { countryByCode, regionById };

  // Fetch 50m world provinces + Antarctica scenery once
  useEffect(() => {
    let cancelled = false;
    fetch("/geo/world-provinces.json")
      .then((r) => r.json())
      .then((data: RawCollection) => {
        if (!cancelled) setRawGeo(data);
      })
      .catch(() => undefined);

    fetch("/geo/antarctica.json")
      .then((r) => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        if (!cancelled) setAntarcticaGeo(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const ownershipTopologyKey = useMemo(() => {
    let key = `${locale}::`;
    for (const r of regions) {
      key += `${r.regionId}=${r.ownerCountryCode}:${r.strategicStatus === "CAPITAL" ? 1 : 0};`;
    }
    key += "::";
    for (const c of countries) {
      key += `${c.code}=${c.name}:${c.capitalRegionId ?? ""};`;
    }
    return key;
  }, [regions, countries, locale]);

  const topologyInputsRef = useRef({ regionById, countryByCode, locale });
  topologyInputsRef.current = { regionById, countryByCode, locale };

  // Stage A: Dissolved country outer borders, capitals & cartographic labels.
  // Only recomputed when territory ownership, country names/capitals, or locale actually change.
  const {
    countryOutlinesGeoJson,
    countryLabelsGeoJson,
    countryCurvedLabelsGeoJson,
    capitalsGeoJson,
  } = useMemo(() => {
    if (!rawGeo) {
      return {
        countryOutlinesGeoJson: {
          type: "FeatureCollection" as const,
          features: [] as GeoJSON.Feature[],
        },
        countryLabelsGeoJson: {
          type: "FeatureCollection" as const,
          features: [] as GeoJSON.Feature[],
        },
        countryCurvedLabelsGeoJson: {
          type: "FeatureCollection" as const,
          features: [] as GeoJSON.Feature[],
        },
        capitalsGeoJson: {
          type: "FeatureCollection" as const,
          features: [] as GeoJSON.Feature[],
        },
      };
    }

    const {
      regionById: rMap,
      countryByCode: cMap,
      locale: activeLocale,
    } = topologyInputsRef.current;

    const featuresByOwner = new Map<string, RawFeature[]>();
    const capitalFeatures: GeoJSON.Feature[] = [];

    for (const feat of rawGeo.features) {
      const rid = feat.properties.region_id;
      const reg = rMap.get(rid);
      const ownerCode = reg?.ownerCountryCode ?? "NEU";
      const owner = cMap.get(ownerCode);

      const group = featuresByOwner.get(ownerCode) ?? [];
      group.push(feat);
      featuresByOwner.set(ownerCode, group);

      if (
        reg?.strategicStatus === "CAPITAL" &&
        (owner?.isMajor || ownerCode === perspectiveCountryCode)
      ) {
        capitalFeatures.push({
          type: "Feature",
          properties: {
            label: owner?.code ?? reg.ownerCountryCode,
          },
          geometry: {
            type: "Point",
            coordinates: [
              feat.properties.centroid_lon ?? 0,
              feat.properties.centroid_lat ?? 0,
            ],
          },
        });
      }
    }

    const outlineFeatures: GeoJSON.Feature[] = [];
    const labelFeatures: GeoJSON.Feature[] = [];
    const curvedLabelFeatures: GeoJSON.Feature[] = [];

    for (const [ownerCode, ownerFeats] of featuresByOwner.entries()) {
      const owner = cMap.get(ownerCode);

      let mergedCoords: polygonClipping.MultiPolygon = [];
      if (ownerFeats.length === 1) {
        mergedCoords = toMultiPolygonCoords(ownerFeats[0].geometry);
        outlineFeatures.push({
          type: "Feature",
          properties: { ownerCode },
          geometry: ownerFeats[0].geometry,
        });
      } else {
        try {
          const polys = ownerFeats.map((f) =>
            toMultiPolygonCoords(f.geometry)
          );
          mergedCoords = polygonClipping.union(polys[0], ...polys.slice(1));
          outlineFeatures.push({
            type: "Feature",
            properties: { ownerCode },
            geometry:
              mergedCoords.length === 1
                ? { type: "Polygon", coordinates: mergedCoords[0] }
                : { type: "MultiPolygon", coordinates: mergedCoords },
          });
        } catch {
          for (const f of ownerFeats) {
            const mc = toMultiPolygonCoords(f.geometry);
            mergedCoords.push(...mc);
            outlineFeatures.push({
              type: "Feature",
              properties: { ownerCode },
              geometry: f.geometry,
            });
          }
        }
      }

      const clusters = clusterContiguousFeatures(ownerFeats);
      const labelText = getCartographicMapLabel(
        owner?.name,
        ownerCode,
        activeLocale
      );

      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const isCapitalCluster = cluster.some(
          (f) => f.properties.region_id === owner?.capitalRegionId
        );

        let clusterCoords: polygonClipping.MultiPolygon = [];
        let totalClusterArea = 0;
        let sumWeightedLon = 0;
        let sumWeightedLat = 0;

        for (const f of cluster) {
          const area = Math.max(0.2, Number(f.properties.area_approx ?? 5));
          totalClusterArea += area;
          sumWeightedLon += (f.properties.centroid_lon ?? 0) * area;
          sumWeightedLat += (f.properties.centroid_lat ?? 0) * area;
          clusterCoords.push(...toMultiPolygonCoords(f.geometry));
        }

        if (!isCapitalCluster && ci > 0 && totalClusterArea < 65) {
          continue;
        }

        const shapePt = computeBestLabelPoint(clusterCoords);
        const lon =
          cluster.length > 1
            ? sumWeightedLon / totalClusterArea
            : shapePt.lon;
        const lat =
          cluster.length > 1
            ? sumWeightedLat / totalClusterArea
            : shapePt.lat;

        if (totalClusterArea >= 3.2) {
          const textSize = Math.min(
            26,
            Math.max(9.5, 8.2 + Math.sqrt(totalClusterArea) * 0.38)
          );
          const minZoomRank =
            totalClusterArea > 120 ? 0 : totalClusterArea > 20 ? 1.5 : 2.8;

          const curvedLineCoords =
            totalClusterArea >= 280
              ? buildCurvedLabelAxis(clusterCoords, lon, lat)
              : null;

          if (curvedLineCoords) {
            curvedLabelFeatures.push({
              type: "Feature",
              properties: {
                name: labelText,
                textSize: Number(textSize.toFixed(1)),
                minZoomRank,
              },
              geometry: {
                type: "LineString",
                coordinates: curvedLineCoords,
              },
            });
          }

          labelFeatures.push({
            type: "Feature",
            properties: {
              name: labelText,
              textSize: Number(textSize.toFixed(1)),
              textRotate: cluster.length === 1 ? shapePt.rotate : 0,
              minZoomRank,
              hasCurved: curvedLineCoords ? 1 : 0,
            },
            geometry: {
              type: "Point",
              coordinates: [lon, lat],
            },
          });
        }
      }
    }

    return {
      countryOutlinesGeoJson: {
        type: "FeatureCollection" as const,
        features: outlineFeatures,
      },
      countryLabelsGeoJson: {
        type: "FeatureCollection" as const,
        features: labelFeatures,
      },
      countryCurvedLabelsGeoJson: {
        type: "FeatureCollection" as const,
        features: curvedLabelFeatures,
      },
      capitalsGeoJson: {
        type: "FeatureCollection" as const,
        features: capitalFeatures,
      },
    };
  }, [rawGeo, ownershipTopologyKey, perspectiveCountryCode]);

  // Signature for province war-coloring so minor battle progress ticks (%) do NOT trigger GeoJSON rebuilds
  const warStyleKey = useMemo(() => {
    if (mapMode !== "war") return "";
    const activeOps = warOperations.filter((op) =>
      ["MARCHING", "BESIEGING", "ACTIVE"].includes(op.status)
    );
    const opKey = activeOps
      .map(
        (op) =>
          `${op.targetRegionId}:${op.attackerCode}:${op.defenderCode}:${op.operationType}`
      )
      .sort()
      .join("|");
    const riskKey = warHotspots
      .filter((h) => h.probability >= 48 || h.status === "WAR")
      .map((h) => `${h.countryA}-${h.countryB}:${h.status}:${h.probability >= 72 ? 2 : 1}`)
      .sort()
      .join("|");
    const pRiskKey = Object.entries(playerRisks)
      .filter(([, r]) => r.probability >= 48)
      .map(([code, r]) => `${code}:${r.probability >= 72 ? 2 : 1}`)
      .sort()
      .join("|");
    return `${opKey}::${riskKey}::${pRiskKey}`;
  }, [mapMode, warOperations, warHotspots, playerRisks]);

  const provinceStyleDepsRef = useRef({
    warOperations,
    warHotspots,
    playerRisks,
    diplomacies,
    diplomacyLookup,
    countryByCode,
    regionById,
  });
  provinceStyleDepsRef.current = {
    warOperations,
    warHotspots,
    playerRisks,
    diplomacies,
    diplomacyLookup,
    countryByCode,
    regionById,
  };

  // Stage B: Fast province fill colors & occupation flags (selected/flashed handled on GPU via featureState)
  const provinceVisualKey = useMemo(() => {
    const baseKey = regions
      .map((r) => `${r.regionId}:${r.ownerCountryCode}:${r.strategicStatus === "OCCUPIED" ? 1 : 0}`)
      .join(";");
    const diploKey = diplomacies
      .map((d) => `${d.countryA}-${d.countryB}:${d.status}`)
      .join(";");
    const countryStatKey =
      mapMode === "economy"
        ? countries.map((c) => `${c.code}:${economyColor(c.economy ?? 25)}`).join(";")
        : mapMode === "threat"
          ? countries.map((c) => `${c.code}:${threatColor(c.infamy ?? 0)}`).join(";")
          : countries.map((c) => `${c.code}:${c.color}`).join(";");
    return `${mapMode}::${perspectiveCountryCode ?? ""}::${baseKey}::${diploKey}::${countryStatKey}::${warStyleKey}`;
  }, [regions, countries, diplomacies, mapMode, perspectiveCountryCode, warStyleKey]);

  const styledGeoJson = useMemo(() => {
    if (!rawGeo) return null;
    const {
      warOperations: ops,
      warHotspots: hotspots,
      playerRisks: pRisks,
      diplomacies: diploList,
      diplomacyLookup: diploMap,
      countryByCode: cMap,
      regionById: rMap,
    } = provinceStyleDepsRef.current;

    const besiegedRegionSet = new Set<string>();
    const atWarCountrySet = new Set<string>();
    const maxRiskByCountry = new Map<string, number>();

    if (mapMode === "war") {
      const activeOps = ops.filter((op) =>
        ["MARCHING", "BESIEGING", "ACTIVE"].includes(op.status)
      );
      for (const op of activeOps) {
        besiegedRegionSet.add(op.targetRegionId);
        if (
          op.operationType !== "ENVOY_AGITATION" &&
          op.operationType !== "REBEL_UPRISING"
        ) {
          atWarCountrySet.add(op.attackerCode);
          atWarCountrySet.add(op.defenderCode);
        }
      }
      for (const d of diploList) {
        if (d.status === "WAR") {
          atWarCountrySet.add(d.countryA);
          atWarCountrySet.add(d.countryB);
        }
      }
      for (const hs of hotspots) {
        maxRiskByCountry.set(
          hs.countryA,
          Math.max(maxRiskByCountry.get(hs.countryA) ?? 0, hs.probability)
        );
        maxRiskByCountry.set(
          hs.countryB,
          Math.max(maxRiskByCountry.get(hs.countryB) ?? 0, hs.probability)
        );
      }
    }

    const styledFeatures = rawGeo.features.map((feat) => {
      const rid = feat.properties.region_id;
      const reg = rMap.get(rid);
      const ownerCode = reg?.ownerCountryCode ?? "NEU";
      const owner = cMap.get(ownerCode);

      let fillColor = owner?.color ?? "#3a4b63";
      if (mapMode === "diplomacy") {
        const isSelf = ownerCode === perspectiveCountryCode;
        fillColor = diplomacyColor(diploMap.get(ownerCode), isSelf);
      } else if (mapMode === "economy") {
        fillColor = economyColor(owner?.economy ?? 25);
      } else if (mapMode === "threat") {
        fillColor = threatColor(owner?.infamy ?? 0);
      } else if (mapMode === "war") {
        const pairRisk = Math.max(
          pRisks[ownerCode]?.probability ?? 0,
          maxRiskByCountry.get(ownerCode) ?? 0
        );
        if (besiegedRegionSet.has(rid)) {
          fillColor = "#f97316";
        } else if (atWarCountrySet.has(ownerCode)) {
          fillColor = "#dc2626";
        } else if (pairRisk >= 72) {
          fillColor = "#ea580c";
        } else if (pairRisk >= 48) {
          fillColor = "#ca8a04";
        } else {
          fillColor = "#162033";
        }
      }

      const isCountryHighlighted =
        perspectiveCountryCode !== null && ownerCode === perspectiveCountryCode;

      return {
        ...feat,
        properties: {
          ...feat.properties,
          ownerCode,
          ownerName: owner?.name ?? ownerCode,
          strategicStatus: reg?.strategicStatus ?? "CORE",
          fillColor,
          isOccupied: reg?.strategicStatus === "OCCUPIED" ? 1 : 0,
          isHighlightedCountry: isCountryHighlighted ? 1 : 0,
        },
      };
    });

    return {
      type: "FeatureCollection" as const,
      features: styledFeatures,
    };
  }, [rawGeo, provinceVisualKey, mapMode, perspectiveCountryCode]);

  const capitalCoordsByCountry = useMemo(() => {
    const map = new Map<string, { lng: number; lat: number }>();
    if (!rawGeo) return map;
    const featMap = new Map(rawGeo.features.map((f) => [f.properties.region_id, f]));
    for (const c of countries) {
      const cap = c.capitalRegionId ? featMap.get(c.capitalRegionId) : undefined;
      if (cap?.properties.centroid_lon !== undefined && cap?.properties.centroid_lat !== undefined) {
        map.set(c.code, {
          lng: cap.properties.centroid_lon,
          lat: cap.properties.centroid_lat,
        });
      }
    }
    return map;
  }, [rawGeo, countries]);

  const mapSettingsRef = useRef(mapSettings);
  mapSettingsRef.current = mapSettings;

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const origin = window.location.origin;
    setWorkerUrl(`${origin}/maplibre-gl-worker.mjs`);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        name: "Mur4History Physical-Political Atlas",
        glyphs: `${origin}/fonts/{fontstack}/{range}.pbf`,
        sources: {
          "world-physical": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 8,
          },
          antarctica: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          provinces: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            promoteId: "region_id",
          },
          "country-outlines": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          "country-labels": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          "country-curved-labels": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          capitals: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          {
            id: "ocean-bg",
            type: "background",
            paint: {
              "background-color": "#081c4a",
            },
          },
          {
            id: "ocean-pattern-bg",
            type: "background",
            layout: {
              visibility: "none",
            },
            paint: {
              "background-opacity": 0.3,
            },
          },
          {
            id: "physical-relief",
            type: "raster",
            source: "world-physical",
            paint: {
              "raster-brightness-min": 0.04,
              "raster-brightness-max": 0.62,
              "raster-contrast": 0.32,
              "raster-saturation": 0.38,
              "raster-hue-rotate": 8,
            },
          },
          {
            id: "coastal-glow",
            type: "line",
            source: "country-outlines",
            paint: {
              "line-color": "#4da3ff",
              "line-width": 5.5,
              "line-blur": 4.5,
              "line-opacity": 0.36,
            },
          },
          {
            id: "antarctica-fill",
            type: "fill",
            source: "antarctica",
            paint: {
              "fill-color": "#5b7999",
              "fill-opacity": 0.54,
            },
          },
          {
            id: "province-fills",
            type: "fill",
            source: "provinces",
            paint: {
              "fill-color": [
                "case",
                ["boolean", ["feature-state", "flashed"], false],
                "#fde047",
                ["coalesce", ["get", "fillColor"], "#3a4b63"],
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.9,
                ["boolean", ["feature-state", "flashed"], false],
                0.94,
                ["boolean", ["feature-state", "selected"], false],
                0.86,
                0.78,
              ],
            },
          },
          {
            id: "land-texture-overlay",
            type: "fill",
            source: "provinces",
            layout: {
              visibility: "none",
            },
            paint: {
              "fill-opacity": 0.12,
            },
          },
          {
            id: "province-occupied-overlay",
            type: "fill",
            source: "provinces",
            filter: ["==", ["get", "isOccupied"], 1],
            paint: {
              "fill-color": "#ef4444",
              "fill-opacity": 0.28,
            },
          },
          {
            id: "province-internal-borders",
            type: "line",
            source: "provinces",
            paint: {
              "line-color": "rgba(9, 14, 24, 0.58)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 1.5, 0.35, 5, 0.85],
              "line-opacity": ["interpolate", ["linear"], ["zoom"], 1.5, 0.25, 4.5, 0.8],
            },
          },
          {
            id: "province-selected-borders",
            type: "line",
            source: "provinces",
            paint: {
              "line-color": [
                "case",
                ["boolean", ["feature-state", "flashed"], false],
                "#fef08a",
                "#fbbf24",
              ],
              "line-width": [
                "case",
                [
                  "any",
                  ["boolean", ["feature-state", "selected"], false],
                  ["boolean", ["feature-state", "flashed"], false],
                ],
                2.6,
                0,
              ],
              "line-opacity": [
                "case",
                [
                  "any",
                  ["boolean", ["feature-state", "selected"], false],
                  ["boolean", ["feature-state", "flashed"], false],
                ],
                1.0,
                0.0,
              ],
            },
          },
          {
            id: "country-borders",
            type: "line",
            source: "country-outlines",
            paint: {
              "line-color": "#050911",
              "line-width": ["interpolate", ["linear"], ["zoom"], 1.5, 1.45, 5, 2.35],
              "line-opacity": 0.95,
            },
          },
          {
            id: "country-highlighted-borders",
            type: "line",
            source: "country-outlines",
            filter: ["==", ["get", "ownerCode"], "__NONE__"],
            paint: {
              "line-color": "#f8fafc",
              "line-width": ["interpolate", ["linear"], ["zoom"], 1.5, 1.8, 5, 2.8],
              "line-opacity": 0.96,
            },
          },
          {
            id: "capital-dots",
            type: "circle",
            source: "capitals",
            minzoom: 2.2,
            paint: {
              "circle-radius": 3.0,
              "circle-color": "#fbbf24",
              "circle-stroke-color": "#050912",
              "circle-stroke-width": 1.2,
            },
          },
          {
            id: "country-curved-labels",
            type: "symbol",
            source: "country-curved-labels",
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 900,
              "text-field": ["get", "name"],
              "text-font": ["Montserrat SemiBold"],
              "text-letter-spacing": 0.26,
              "text-max-angle": 38,
              "text-rotation-alignment": "map",
              "text-pitch-alignment": "viewport",
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1.3,
                ["*", ["get", "textSize"], 0.78],
                3.5,
                ["*", ["get", "textSize"], 1.24],
                6.0,
                ["*", ["get", "textSize"], 1.55],
              ],
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-padding": 6,
            },
            paint: {
              "text-color": "rgba(252, 252, 255, 0.96)",
              "text-halo-color": "rgba(5, 9, 18, 0.96)",
              "text-halo-width": 2.3,
              "text-halo-blur": 0.6,
              "text-opacity": [
                "step",
                ["zoom"],
                ["case", ["<=", ["get", "minZoomRank"], 1.5], 0.95, 0.0],
                2.5,
                0.96,
              ],
            },
          },
          {
            id: "country-labels-layer",
            type: "symbol",
            source: "country-labels",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Montserrat SemiBold"],
              "text-letter-spacing": 0.14,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1.3,
                ["*", ["get", "textSize"], 0.72],
                3.5,
                ["*", ["get", "textSize"], 1.15],
                6.0,
                ["*", ["get", "textSize"], 1.45],
              ],
              "text-rotate": ["get", "textRotate"],
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-padding": 4,
              "text-max-width": 14,
            },
            paint: {
              "text-color": "rgba(248, 250, 252, 0.92)",
              "text-halo-color": "rgba(5, 8, 15, 0.92)",
              "text-halo-width": 2.0,
              "text-halo-blur": 0.6,
              "text-opacity": [
                "step",
                ["zoom"],
                ["case", ["<=", ["get", "minZoomRank"], 1.5], 0.92, 0.0],
                2.6,
                0.94,
              ],
            },
          },
          {
            id: "province-labels-layer",
            type: "symbol",
            source: "provinces",
            minzoom: 4.3,
            layout: {
              "text-field": ["get", "region_name"],
              "text-font": ["Open Sans Bold"],
              "text-size": 10.5,
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "rgba(226, 232, 240, 0.85)",
              "text-halo-color": "rgba(5, 8, 15, 0.9)",
              "text-halo-width": 1.5,
            },
          },
        ],
      },
      center: [24, 30],
      zoom: 1.9,
      minZoom: 1.2,
      maxZoom: 9,
      renderWorldCopies: true,
      attributionControl: false,
    });

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    let hoveredId: string | null = null;
    let lastHoverX = -999;
    let lastHoverY = -999;
    let hoverRafId = 0;

    map.on("load", () => {
      registerProceduralMapPatterns(map);
      applyMapThemeToMapLibre(map, mapSettingsRef.current);
      setMapReady(true);
    });

    map.on("mousemove", "province-fills", (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = "pointer";
      const rid = String(feature.properties?.region_id ?? "");
      const regionChanged = hoveredId !== rid;
      if (hoveredId && regionChanged) {
        map.setFeatureState(
          { source: "provinces", id: hoveredId },
          { hover: false }
        );
      }
      if (rid && regionChanged) {
        hoveredId = rid;
        map.setFeatureState({ source: "provinces", id: rid }, { hover: true });
      }

      const movedEnough =
        Math.abs(e.point.x - lastHoverX) >= 8 ||
        Math.abs(e.point.y - lastHoverY) >= 8;
      if (!regionChanged && !movedEnough) return;

      lastHoverX = e.point.x;
      lastHoverY = e.point.y;
      const px = e.point.x;
      const py = e.point.y;
      const fallbackOwnerCode = String(feature.properties?.ownerCode ?? "");
      const fallbackRegionName = String(feature.properties?.region_name ?? rid);

      cancelAnimationFrame(hoverRafId);
      hoverRafId = requestAnimationFrame(() => {
        const { countryByCode: cMap, regionById: rMap } = hoverDataRef.current;
        const reg = rMap.get(rid);
        const ownerCode = reg?.ownerCountryCode ?? fallbackOwnerCode;
        const owner = cMap.get(ownerCode);

        overlayApiRef.current?.setHoverInfo({
          x: px,
          y: py,
          regionId: rid,
          regionName: reg?.regionName ?? fallbackRegionName,
          ownerName: owner?.name ?? ownerCode,
          ownerFlag: owner?.flagEmoji ?? "🏳️",
          ownerCode,
          strategicStatus: reg?.strategicStatus ?? "CORE",
          baseValue: reg?.baseValue ?? 8,
        });
      });
    });

    map.on("mouseleave", "province-fills", () => {
      cancelAnimationFrame(hoverRafId);
      map.getCanvas().style.cursor = "";
      if (hoveredId) {
        map.setFeatureState(
          { source: "provinces", id: hoveredId },
          { hover: false }
        );
        hoveredId = null;
      }
      lastHoverX = -999;
      lastHoverY = -999;
      overlayApiRef.current?.setHoverInfo(null);
    });

    map.on("click", "province-fills", (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const rid = String(feature.properties?.region_id ?? "");
      const reg = hoverDataRef.current.regionById.get(rid);
      const ownerCode =
        reg?.ownerCountryCode ?? String(feature.properties?.ownerCode ?? "");
      if (rid && ownerCode) {
        onSelectRef.current(rid, ownerCode);
      }
    });

    mapRef.current = map;

    return () => {
      cancelAnimationFrame(hoverRafId);
      for (const entry of markersMapRef.current.values()) {
        entry.marker.remove();
      }
      markersMapRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Fly camera to focused marker when selected from sidebar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusMarkerCoord) return;
    map.flyTo({
      center: [focusMarkerCoord.lng, focusMarkerCoord.lat],
      zoom: Math.max(map.getZoom(), 4.5),
      duration: 900,
    });
  }, [mapReady, focusMarkerCoord]);

  // Render animated AI-managed map beacons with keyed reconciliation & pulse-ring budget cap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const currentIds = new Set(mapMarkers.map((m) => m.id));
    for (const [id, entry] of markersMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        entry.marker.remove();
        markersMapRef.current.delete(id);
      }
    }

    const flashSet = new Set(flashedMarkerIds);
    let animatedPulseBudget = 0;

    for (const m of mapMarkers) {
      const isHighlight =
        flashSet.has(m.id) ||
        m.status === "UNDER_CONSTRUCTION" ||
        m.status === "ALERT";

      let shouldPulse = false;
      if (isHighlight) {
        shouldPulse = true;
        animatedPulseBudget++;
      } else if (
        m.isAnimated !== false &&
        m.status !== "COMPLETED" &&
        animatedPulseBudget < MAX_ANIMATED_PULSE_MARKERS
      ) {
        shouldPulse = true;
        animatedPulseBudget++;
      }

      const sig = `${m.lat}|${m.lng}|${m.category}|${m.status}|${m.level}|${m.title}|${m.cityName ?? ""}|${m.description}|${m.turnNumber}|${isHighlight ? 1 : 0}|${shouldPulse ? 1 : 0}`;
      const existing = markersMapRef.current.get(m.id);
      if (existing && existing.sig === sig) {
        continue;
      }
      if (existing) {
        existing.marker.remove();
        markersMapRef.current.delete(m.id);
      }

      const theme = MARKER_THEME[m.category] ?? MARKER_THEME.INDUSTRY;

      const root = document.createElement("div");
      root.className = "pax-map-marker-root";
      root.style.setProperty("--beacon-color", theme.color);
      root.style.setProperty("--beacon-glow", theme.glow);
      root.setAttribute("data-marker-id", m.id);
      root.setAttribute("aria-label", `${m.title} (${m.cityName ?? m.countryCode})`);

      const stage = document.createElement("div");
      stage.className = "pax-beacon-stage";

      if (shouldPulse) {
        const ring1 = document.createElement("span");
        ring1.className = "pax-beacon-ring";
        stage.appendChild(ring1);

        if (isHighlight) {
          const ring2 = document.createElement("span");
          ring2.className = "pax-beacon-ring pax-beacon-ring-secondary";
          stage.appendChild(ring2);
        }
      }

      if (isHighlight) {
        const burst = document.createElement("span");
        burst.className = "pax-beacon-ring pax-beacon-ring-flash";
        stage.appendChild(burst);
      }

      const core = document.createElement("div");
      core.className = isHighlight
        ? "pax-beacon-core pax-beacon-core-pulse"
        : "pax-beacon-core";
      core.innerHTML = theme.svg;

      if (m.level > 1) {
        const lvl = document.createElement("span");
        lvl.style.position = "absolute";
        lvl.style.top = "-5px";
        lvl.style.right = "-6px";
        lvl.style.background = theme.color;
        lvl.style.color = "#06090f";
        lvl.style.fontSize = "9px";
        lvl.style.fontWeight = "800";
        lvl.style.lineHeight = "1";
        lvl.style.padding = "2px 4px";
        lvl.style.borderRadius = "9999px";
        lvl.style.border = "1px solid #06090f";
        lvl.textContent = String(m.level);
        core.appendChild(lvl);
      }

      stage.appendChild(core);
      root.appendChild(stage);

      const label = document.createElement("div");
      label.className = "pax-beacon-label";
      label.textContent = m.cityName || m.title;
      root.appendChild(label);

      root.addEventListener("mouseenter", (ev) => {
        overlayApiRef.current?.setHoverInfo(null);
        overlayApiRef.current?.setHoveredMarker({
          marker: m,
          x: ev.clientX,
          y: ev.clientY,
        });
      });
      root.addEventListener("mouseleave", () => {
        overlayApiRef.current?.setHoveredMarker((curr) =>
          curr?.marker.id === m.id ? null : curr
        );
      });
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        overlayApiRef.current?.setPinnedMarker((curr) =>
          curr?.id === m.id ? null : m
        );
        if (m.regionId) {
          onSelectRef.current(m.regionId, m.countryCode);
        }
      });

      const mk = new Marker({ element: root, anchor: "center" })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersMapRef.current.set(m.id, { marker: mk, sig });
    }
  }, [mapReady, mapMarkers, flashedMarkerIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (antarcticaGeo) {
      const antSource = map.getSource("antarctica") as
        | GeoJSONSource
        | undefined;
      antSource?.setData(antarcticaGeo);
    }
  }, [mapReady, antarcticaGeo]);

  // Stage A MapLibre update: ONLY runs when borders / capitals / locale change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource("country-outlines") as GeoJSONSource | undefined)?.setData(
      countryOutlinesGeoJson
    );
    (map.getSource("country-labels") as GeoJSONSource | undefined)?.setData(
      countryLabelsGeoJson
    );
    (
      map.getSource("country-curved-labels") as GeoJSONSource | undefined
    )?.setData(countryCurvedLabelsGeoJson);
    (map.getSource("capitals") as GeoJSONSource | undefined)?.setData(
      capitalsGeoJson
    );
  }, [
    mapReady,
    countryOutlinesGeoJson,
    countryLabelsGeoJson,
    countryCurvedLabelsGeoJson,
    capitalsGeoJson,
  ]);

  // Stage B MapLibre update: province colors only
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !styledGeoJson) return;

    (map.getSource("provinces") as GeoJSONSource | undefined)?.setData(
      styledGeoJson as GeoJSON.FeatureCollection
    );
    if (selectedRegionId) {
      map.setFeatureState(
        { source: "provinces", id: selectedRegionId },
        { selected: true }
      );
    }
    for (const rid of flashedRegionIds) {
      map.setFeatureState({ source: "provinces", id: rid }, { flashed: true });
    }
  }, [mapReady, styledGeoJson, selectedRegionId, flashedRegionIds]);

  // 0ms GPU update for province selection border/highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const prev = prevSelectedRegionRef.current;
    if (prev && prev !== selectedRegionId) {
      map.setFeatureState({ source: "provinces", id: prev }, { selected: false });
    }
    if (selectedRegionId) {
      map.setFeatureState(
        { source: "provinces", id: selectedRegionId },
        { selected: true }
      );
    }
    prevSelectedRegionRef.current = selectedRegionId;
  }, [mapReady, selectedRegionId]);

  // 0ms GPU update for territory capture flashes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const nextSet = new Set(flashedRegionIds);
    for (const prevId of prevFlashedRegionsRef.current) {
      if (!nextSet.has(prevId)) {
        map.setFeatureState({ source: "provinces", id: prevId }, { flashed: false });
      }
    }
    for (const id of flashedRegionIds) {
      map.setFeatureState({ source: "provinces", id }, { flashed: true });
    }
    prevFlashedRegionsRef.current = flashedRegionIds;
  }, [mapReady, flashedRegionIds]);

  // 0ms filter update for active highlighted country border
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("country-highlighted-borders")) return;
    map.setFilter(
      "country-highlighted-borders",
      perspectiveCountryCode
        ? ["==", ["get", "ownerCode"], perspectiveCountryCode]
        : ["==", ["get", "ownerCode"], "__NONE__"]
    );
  }, [mapReady, perspectiveCountryCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyMapThemeToMapLibre(map, mapSettings);
  }, [mapReady, mapSettings]);

  const diplomacyLegend = [
    { label: isTr ? "Seçili Ülke" : "Selected Nation", color: "#3b82f6" },
    { label: isTr ? "İttifak" : "Alliance", color: "#10b981" },
    { label: isTr ? "Saldırmazlık" : "Non-Aggression", color: "#06b6d4" },
    { label: isTr ? "Vasal" : "Vassal", color: "#a855f7" },
    { label: isTr ? "Savaş" : "War", color: "#ef4444" },
    { label: isTr ? "Ambargo" : "Embargo", color: "#f59e0b" },
  ];

  const activeTheme =
    MAP_THEME_BY_ID[mapSettings.themeId] ?? MAP_THEME_BY_ID.pax_atlas;

  return (
    <div
      className={`relative h-full w-full overflow-hidden transition-colors duration-300 ${
        nukeShake ? "animate-mur4-nuke-shake" : ""
      }`}
      style={{ backgroundColor: activeTheme.oceanColor }}
    >
      <div ref={containerRef} className="h-full w-full" />

      <WarEffectsCanvas
        map={mapRef.current}
        mapReady={mapReady}
        warOperations={warOperations}
        warHotspots={warHotspots}
        countries={countries}
        capitalCoordsByCountry={capitalCoordsByCountry}
        activeNukes={activeNukes}
        mapMode={mapMode}
        locale={locale}
        onExpireNuke={onExpireNuke}
      />

      {/* Subtle Vignette for Atlas Depth */}
      <div
        className="pointer-events-none absolute inset-0 transition-shadow duration-300"
        style={{ boxShadow: activeTheme.vignetteCss }}
      />

      {mapMode === "diplomacy" && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border border-border/80 bg-[#0b1019]/90 px-4 py-1.5 text-[11px] backdrop-blur-md">
          {diplomacyLegend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {mapMode === "economy" && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/80 bg-[#0b1019]/90 px-4 py-1.5 text-[11px] backdrop-blur-md">
          <span className="text-muted-foreground">
            {isTr ? "Ekonomik Güç:" : "Economic Strength:"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />{" "}
            {isTr ? "Zayıf" : "Weak"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />{" "}
            {isTr ? "Orta" : "Moderate"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{" "}
            {isTr ? "Süper Güç" : "Superpower"}
          </span>
        </div>
      )}

      {mapMode === "war" && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border border-rose-500/45 bg-[#0b1019]/95 px-4 py-1.5 text-[11px] backdrop-blur-md">
          <span className="flex items-center gap-1.5 text-rose-300 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            {isTr ? "Aktif Savaşta" : "At War"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            {isTr ? "Kuşatma / Kritik Risk" : "Siege / Critical"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-600" />
            {isTr ? "Yüksek Gerilim" : "High Tension"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
            {isTr ? "Sakin" : "Calm"}
          </span>
        </div>
      )}

      {mapMode === "threat" && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/80 bg-[#0b1019]/90 px-4 py-1.5 text-[11px] backdrop-blur-md">
          <span className="text-muted-foreground">
            {isTr ? "Agresiflik / Tehdit (Infamy):" : "Aggression / Threat (Infamy):"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />{" "}
            {isTr ? "Barışçıl" : "Peaceful"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />{" "}
            {isTr ? "Şüpheli" : "Suspicious"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />{" "}
            {isTr ? "Koalisyon Hedefi" : "Coalition Target"}
          </span>
        </div>
      )}

      <MapHoverOverlays
        apiRef={overlayApiRef}
        countryByCode={countryByCode}
        perspectiveCountryCode={perspectiveCountryCode}
        playerRisks={playerRisks}
        locale={locale}
      />
    </div>
  );
});
