"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import type polygonClipping from "polygon-clipping";

function createCanvasPattern(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new ImageData(size, size);
  }
  draw(ctx, size);
  return ctx.getImageData(0, 0, size, size);
}

/** Register procedural seamless textures into MapLibre once on load. */
export function registerProceduralMapPatterns(map: MapLibreMap): void {
  const defs: Array<{
    id: string;
    size: number;
    draw: (ctx: CanvasRenderingContext2D, s: number) => void;
  }> = [
    {
      id: "ocean-ripple",
      size: 128,
      draw: (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        // Subtle deterministic depth currents & abyssal grain
        for (let y = 0; y < s; y += 8) {
          ctx.strokeStyle =
            y % 16 === 0
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.14)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x <= s; x += 8) {
            const wy = y + Math.sin((x / s) * Math.PI * 2 + y * 0.2) * 1.6;
            if (x === 0) ctx.moveTo(x, wy);
            else ctx.lineTo(x, wy);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 180; i++) {
          const x = (i * 53) % s;
          const y = (i * 97) % s;
          ctx.fillStyle =
            i % 2 === 0
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.12)";
          ctx.fillRect(x, y, 2, 1);
        }
      },
    },
    {
      id: "parchment",
      size: 128,
      draw: (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        for (let i = 0; i < 420; i++) {
          const x = (i * 37) % s;
          const y = (i * 71) % s;
          ctx.fillStyle =
            i % 3 === 0
              ? "rgba(65, 42, 18, 0.14)"
              : "rgba(255, 245, 224, 0.12)";
          ctx.fillRect(x, y, (i % 2) + 1, 1);
        }
        ctx.strokeStyle = "rgba(72, 48, 22, 0.11)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 64);
        ctx.lineTo(s, 64);
        ctx.moveTo(64, 0);
        ctx.lineTo(64, s);
        ctx.stroke();
      },
    },
    {
      id: "grid-tactical",
      size: 64,
      draw: (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(s, 0.5);
        ctx.moveTo(0.5, 0);
        ctx.lineTo(0.5, s);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
        ctx.fillRect(0, 0, 3, 3);
      },
    },
    {
      id: "blueprint",
      size: 64,
      draw: (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.8;
        for (let g = 16; g < s; g += 16) {
          ctx.beginPath();
          ctx.moveTo(0, g + 0.5);
          ctx.lineTo(s, g + 0.5);
          ctx.moveTo(g + 0.5, 0);
          ctx.lineTo(g + 0.5, s);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(s, 0.5);
        ctx.moveTo(0.5, 0);
        ctx.lineTo(0.5, s);
        ctx.stroke();
      },
    },
    {
      id: "halftone",
      size: 32,
      draw: (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
        ctx.lineWidth = 1;
        for (let k = -s; k < s * 2; k += 8) {
          ctx.beginPath();
          ctx.moveTo(k, 0);
          ctx.lineTo(k + s, s);
          ctx.stroke();
        }
      },
    },
  ];

  for (const def of defs) {
    if (!map.hasImage(def.id)) {
      map.addImage(def.id, createCanvasPattern(def.size, def.draw), {
        pixelRatio: 1,
      });
    }
  }
}

/**
 * Compute a smooth quadratic Bezier axis LineString across a large landmass
 * cluster so MapLibre renders wide-spaced curving Pax-style country names.
 */
export function buildCurvedLabelAxis(
  coords: polygonClipping.MultiPolygon,
  fallbackLon: number,
  fallbackLat: number
): [number, number][] | null {
  let largestRing: polygonClipping.Ring | null = null;
  let largestArea = -1;
  let globalMinX = Infinity;
  let globalMaxX = -Infinity;

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
    const dx = maxX - minX;
    if (dx > 145) continue;
    globalMinX = Math.min(globalMinX, minX);
    globalMaxX = Math.max(globalMaxX, maxX);
    const area = dx * (maxY - minY);
    if (area > largestArea) {
      largestArea = area;
      largestRing = ring;
    }
  }

  if (!largestRing || largestArea < 18 || globalMaxX - globalMinX > 155) {
    return null;
  }

  // Principal axis via 2D covariance of ring vertices
  const sampleStep = Math.max(1, Math.floor(largestRing.length / 80));
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (let i = 0; i < largestRing.length; i += sampleStep) {
    sumX += largestRing[i][0];
    sumY += largestRing[i][1];
    n += 1;
  }
  if (n < 3) return null;

  const cx = sumX / n;
  const cy = sumY / n;

  let covXX = 0;
  let covYY = 0;
  let covXY = 0;
  for (let i = 0; i < largestRing.length; i += sampleStep) {
    const dx = largestRing[i][0] - cx;
    const dy = largestRing[i][1] - cy;
    covXX += dx * dx;
    covYY += dy * dy;
    covXY += dx * dy;
  }

  const theta = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
  let ux = Math.cos(theta);
  let uy = Math.sin(theta);

  // Enforce left-to-right orientation so labels are never upside down
  if (ux < 0 || (Math.abs(ux) < 0.08 && uy > 0)) {
    ux = -ux;
    uy = -uy;
  }

  // Perpendicular bow normal pointing upward
  let nx = -uy;
  let ny = ux;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }

  let minT = Infinity;
  let maxT = -Infinity;
  for (let i = 0; i < largestRing.length; i += sampleStep) {
    const t = (largestRing[i][0] - cx) * ux + (largestRing[i][1] - cy) * uy;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  const totalSpan = maxT - minT;
  if (totalSpan < 56) return null;

  // Center curve around centroid blended toward bbox center cleanly
  const anchorX = Number.isFinite(fallbackLon) ? (cx + fallbackLon) * 0.5 : cx;
  const anchorY = Number.isFinite(fallbackLat) ? (cy + fallbackLat) * 0.5 : cy;
  const halfLen = Math.min(68, totalSpan * 0.45);
  const bowOffset = Math.min(3.8, halfLen * 0.08);

  const p0x = anchorX - ux * halfLen;
  const p0y = anchorY - uy * halfLen;
  const p2x = anchorX + ux * halfLen;
  const p2y = anchorY + uy * halfLen;
  const ctrlX = anchorX + nx * bowOffset;
  const ctrlY = anchorY + ny * bowOffset;

  const pts: [number, number][] = [];
  const segments = 6;
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    const inv = 1 - u;
    const lon = inv * inv * p0x + 2 * inv * u * ctrlX + u * u * p2x;
    const lat = Math.max(
      -78,
      Math.min(82, inv * inv * p0y + 2 * inv * u * ctrlY + u * u * p2y)
    );
    pts.push([Number(lon.toFixed(3)), Number(lat.toFixed(3))]);
  }

  return pts;
}
