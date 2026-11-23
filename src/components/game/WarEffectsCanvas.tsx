"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type {
  CountryRecord,
  MapMode,
  WarOperationRecord,
  WarRiskSummary,
} from "@/lib/client-types";
import type { AppLocale } from "@/lib/i18n";

export interface NuclearAnimationEvent {
  id: string;
  attackerCode: string;
  defenderCode: string;
  fromLng: number;
  fromLat: number;
  targetLng: number;
  targetLat: number;
  targetName: string;
  startedAt: number;
}

interface WarEffectsCanvasProps {
  map: MapLibreMap | null;
  mapReady: boolean;
  warOperations: WarOperationRecord[];
  warHotspots: WarRiskSummary[];
  countries: CountryRecord[];
  capitalCoordsByCountry: Map<string, { lng: number; lat: number }>;
  activeNukes: NuclearAnimationEvent[];
  mapMode: MapMode;
  locale: AppLocale;
  onExpireNuke?: (id: string) => void;
}

function wrapTargetLng(fromLng: number, targetLng: number): number {
  let delta = targetLng - fromLng;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return fromLng + delta;
}

function drawSoldierSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  phase: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  // Keep soldiers upright-ish with slight marching bob
  const bob = Math.abs(Math.sin(phase)) * 2.2;
  const stride = Math.sin(phase) * 3.5;
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  ctx.translate(0, -bob);
  ctx.scale(dir, 1);

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 7 + bob * 0.5, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (marching stride)
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, 2);
  ctx.lineTo(-2 - stride, 7);
  ctx.moveTo(1, 2);
  ctx.lineTo(2 + stride, 7);
  ctx.stroke();

  // Torso jacket in attacker nation color
  ctx.fillStyle = color;
  ctx.strokeStyle = "#090d16";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-3.2, -4, 6.4, 7, 2);
  ctx.fill();
  ctx.stroke();

  // Combat helmet
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(0, -6.2, 3.3, Math.PI, 0);
  ctx.lineTo(4, -5.5);
  ctx.lineTo(-3.5, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(-1.5, -5.5, 3, 2);

  // Rifle barrel pointing forward
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(1, -1);
  ctx.lineTo(9.5, -3.2);
  ctx.stroke();

  // Occasional tiny muzzle spark
  if (Math.sin(phase * 1.7) > 0.92) {
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(10.5, -3.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTankSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  phase: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Vibration rumble + exhaust dust puffs behind tank
  const rumbleY = Math.sin(phase * 4) * 0.6;
  ctx.translate(0, rumbleY);

  for (let d = 1; d <= 3; d++) {
    const dt = ((phase * 0.4 + d * 0.33) % 1);
    ctx.fillStyle = `rgba(148, 163, 184, ${(1 - dt) * 0.38})`;
    ctx.beginPath();
    ctx.arc(-13 - dt * 16, (d - 2) * 3, 2.2 + dt * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twin armored treads
  ctx.fillStyle = "#1e293b";
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 1;
  ctx.fillRect(-11, -9, 22, 4.5);
  ctx.fillRect(-11, 4.5, 22, 4.5);

  // Animated tread cleats
  ctx.fillStyle = "#64748b";
  const cleatOffset = (phase * 8) % 4;
  for (let cx = -10 + cleatOffset; cx < 10; cx += 4) {
    ctx.fillRect(cx, -8.5, 1.5, 3.5);
    ctx.fillRect(cx, 5, 1.5, 3.5);
  }

  // Main armored hull
  ctx.fillStyle = color;
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(-9, -6, 18, 12, 3);
  ctx.fill();
  ctx.stroke();

  // Turret & cannon barrel
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-1, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();

  // Muzzle flash firing intermittently
  if (Math.sin(phase * 1.9) > 0.85) {
    const grad = ctx.createRadialGradient(16, 0, 1, 16, 0, 8);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, "#facc15");
    grad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawJetSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Afterburner plume
  const plume = ctx.createLinearGradient(-18, 0, -6, 0);
  plume.addColorStop(0, "rgba(56, 189, 248, 0)");
  plume.addColorStop(1, "rgba(251, 191, 36, 0.95)");
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-19, 0);
  ctx.lineTo(-6, 2);
  ctx.closePath();
  ctx.fill();

  // Delta wings + fuselage
  ctx.fillStyle = color;
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-5, -9);
  ctx.lineTo(-2, -2);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-2, 2);
  ctx.lineTo(-5, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWarshipSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  phase: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // White V-wake waves
  ctx.strokeStyle = `rgba(186, 230, 253, ${0.35 + Math.sin(phase * 3) * 0.15})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-20, -9);
  ctx.moveTo(-8, 3);
  ctx.lineTo(-20, 9);
  ctx.stroke();

  // Destroyer hull
  ctx.fillStyle = color;
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(4, -4);
  ctx.lineTo(-11, -3.5);
  ctx.lineTo(-11, 3.5);
  ctx.lineTo(4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(-4, -2, 6, 4);
  ctx.restore();
}

function drawEnvoySprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  phase: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  const floatY = Math.sin(phase) * 2.0;
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  ctx.translate(0, floatY);
  ctx.scale(dir, 1);

  // Subtle stealth halo
  const pulse = 0.25 + Math.abs(Math.sin(phase * 0.7)) * 0.25;
  ctx.fillStyle = `rgba(192, 132, 252, ${pulse})`;
  ctx.beginPath();
  ctx.arc(0, -1, 10, 0, Math.PI * 2);
  ctx.fill();

  // Flowing covert cloak
  ctx.fillStyle = "#312e81";
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(-6.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hooded envoy head & emissary trim
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.arc(0, -6.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-2, -1, 4, 2.5);

  // Agitation scroll / dispatch pouch held forward
  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(3.2, -3.2, 4.4, 3.4, 1);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawNuclearDetonation(
  ctx: CanvasRenderingContext2D,
  pFrom: { x: number; y: number },
  pTo: { x: number; y: number },
  elapsedSec: number,
  label: string
) {
  // Phase 1: ICBM Launch & Ballistic Arc (0.0 -> 1.6s)
  if (elapsedSec < 1.65) {
    const t = Math.min(1, elapsedSec / 1.55);
    const ctrlX = (pFrom.x + pTo.x) / 2;
    const dist = Math.hypot(pTo.x - pFrom.x, pTo.y - pFrom.y);
    const ctrlY = Math.min(pFrom.y, pTo.y) - Math.max(70, Math.min(240, dist * 0.42));

    // Quadratic curve interpolation
    const inv = 1 - t;
    const mx = inv * inv * pFrom.x + 2 * inv * t * ctrlX + t * t * pTo.x;
    const my = inv * inv * pFrom.y + 2 * inv * t * ctrlY + t * t * pTo.y;

    // Dotted ballistic trajectory preview
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(251, 146, 60, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pFrom.x, pFrom.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, pTo.x, pTo.y);
    ctx.stroke();
    ctx.restore();

    // Glowing contrail behind missile
    ctx.save();
    const trailGrad = ctx.createLinearGradient(pFrom.x, pFrom.y, mx, my);
    trailGrad.addColorStop(0, "rgba(251, 191, 36, 0.1)");
    trailGrad.addColorStop(1, "rgba(254, 240, 138, 0.95)");
    ctx.strokeStyle = trailGrad;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let s = 0; s <= 20; s++) {
      const st = (s / 20) * t;
      const si = 1 - st;
      const sx = si * si * pFrom.x + 2 * si * st * ctrlX + st * st * pTo.x;
      const sy = si * si * pFrom.y + 2 * si * st * ctrlY + st * st * pTo.y;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // ICBM Warhead nosecone
    const dx = 2 * (1 - t) * (ctrlX - pFrom.x) + 2 * t * (pTo.x - ctrlX);
    const dy = 2 * (1 - t) * (ctrlY - pFrom.y) + 2 * t * (pTo.y - ctrlY);
    const ang = Math.atan2(dy, dx);
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -3.5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Target lock pulsing siren crosshair at pTo
    const pulse = 1 + Math.sin(elapsedSec * 16) * 0.25;
    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pTo.x, pTo.y, 16 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pTo.x - 24, pTo.y);
    ctx.lineTo(pTo.x + 24, pTo.y);
    ctx.moveTo(pTo.x, pTo.y - 24);
    ctx.lineTo(pTo.x, pTo.y + 24);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Phase 2 & 3: Blinding Flash + Expanding Shockwave + Rising Mushroom Cloud (1.55s -> 10s)
  const dt = elapsedSec - 1.55;
  const fadeOut = dt > 7.5 ? Math.max(0, 1 - (dt - 7.5) / 2.5) : 1;

  // Blinding thermal flash at moment of impact (first 0.7s)
  if (dt < 0.75) {
    const flashAlpha = (1 - dt / 0.75) * 0.72;
    const flashGrad = ctx.createRadialGradient(
      pTo.x,
      pTo.y,
      4,
      pTo.x,
      pTo.y,
      190 * (dt / 0.75 + 0.2)
    );
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
    flashGrad.addColorStop(0.4, `rgba(254, 240, 138, ${flashAlpha * 0.85})`);
    flashGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(pTo.x, pTo.y, 240, 0, Math.PI * 2);
    ctx.fill();
  }

  // Primary & secondary shockwave rings
  [0, 0.35].forEach((delay, idx) => {
    const waveT = dt - delay;
    if (waveT > 0 && waveT < 2.4) {
      const r = waveT * (idx === 0 ? 135 : 95);
      const a = Math.max(0, 1 - waveT / 2.4) * 0.85;
      ctx.save();
      ctx.strokeStyle =
        idx === 0
          ? `rgba(254, 249, 195, ${a})`
          : `rgba(249, 115, 22, ${a})`;
      ctx.lineWidth = idx === 0 ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(pTo.x, pTo.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // Rising volumetric Mushroom Cloud
  const riseProgress = Math.min(1, dt / 1.9);
  const stemHeight = 20 + riseProgress * 58;
  const capRadius = 18 + riseProgress * 26;

  ctx.save();
  ctx.globalAlpha = fadeOut;

  // Ground scorch crater & base ring cloud
  const baseGrad = ctx.createRadialGradient(pTo.x, pTo.y, 2, pTo.x, pTo.y, 32);
  baseGrad.addColorStop(0, "rgba(251, 146, 60, 0.95)");
  baseGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.6)");
  baseGrad.addColorStop(1, "rgba(30, 41, 59, 0)");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.ellipse(pTo.x, pTo.y, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vertical incandescent stem
  const stemGrad = ctx.createLinearGradient(pTo.x, pTo.y, pTo.x, pTo.y - stemHeight);
  stemGrad.addColorStop(0, "rgba(249, 115, 22, 0.92)");
  stemGrad.addColorStop(0.6, "rgba(251, 191, 36, 0.85)");
  stemGrad.addColorStop(1, "rgba(254, 243, 199, 0.95)");
  ctx.fillStyle = stemGrad;
  ctx.beginPath();
  ctx.moveTo(pTo.x - 10, pTo.y);
  ctx.quadraticCurveTo(pTo.x - 4, pTo.y - stemHeight * 0.5, pTo.x - 9, pTo.y - stemHeight);
  ctx.lineTo(pTo.x + 9, pTo.y - stemHeight);
  ctx.quadraticCurveTo(pTo.x + 4, pTo.y - stemHeight * 0.5, pTo.x + 10, pTo.y);
  ctx.closePath();
  ctx.fill();

  // Mid-stem condensation collar ring
  ctx.strokeStyle = "rgba(226, 232, 240, 0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    pTo.x,
    pTo.y - stemHeight * 0.55,
    18 * riseProgress + 4,
    5.5,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Toroidal Mushroom Cap
  const capY = pTo.y - stemHeight - capRadius * 0.35;
  const capGrad = ctx.createRadialGradient(
    pTo.x,
    capY + 4,
    4,
    pTo.x,
    capY,
    capRadius * 1.15
  );
  capGrad.addColorStop(0, "#fef9c3");
  capGrad.addColorStop(0.38, "#fb923c");
  capGrad.addColorStop(0.75, "#dc2626");
  capGrad.addColorStop(1, "rgba(51, 65, 85, 0.88)");

  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.ellipse(pTo.x, capY, capRadius * 1.18, capRadius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing side smoke lobes
  ctx.fillStyle = "rgba(71, 85, 105, 0.52)";
  ctx.beginPath();
  ctx.arc(pTo.x - capRadius * 0.68, capY + 3, capRadius * 0.42, 0, Math.PI * 2);
  ctx.arc(pTo.x + capRadius * 0.68, capY + 3, capRadius * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // Fallout embers spiraling outward
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + dt * 0.9;
    const dist = 16 + ((dt * 24 + i * 7) % 52);
    const ex = pTo.x + Math.cos(a) * dist;
    const ey = capY + Math.sin(a) * dist * 0.45;
    ctx.fillStyle = i % 2 === 0 ? "#fde047" : "#fb7185";
    ctx.beginPath();
    ctx.arc(ex, ey, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Warning Pill anchored right below blast ground zero so it stays clear of top HUD
  ctx.font = "700 10px Inter, sans-serif";
  const textW = ctx.measureText(label).width;
  const pillY = pTo.y + 18;
  ctx.fillStyle = "rgba(127, 29, 29, 0.94)";
  ctx.strokeStyle = "#fca5a5";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(pTo.x - textW / 2 - 8, pillY, textW + 16, 19, 9.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fef2f2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pTo.x, pillY + 9.5);

  ctx.restore();
}

export function WarEffectsCanvas({
  map,
  mapReady,
  warOperations,
  warHotspots,
  countries,
  capitalCoordsByCountry,
  activeNukes,
  mapMode,
  locale,
  onExpireNuke,
}: WarEffectsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    warOperations,
    warHotspots,
    countries,
    capitalCoordsByCountry,
    activeNukes,
    mapMode,
    locale,
    onExpireNuke,
  });

  useEffect(() => {
    stateRef.current = {
      warOperations,
      warHotspots,
      countries,
      capitalCoordsByCountry,
      activeNukes,
      mapMode,
      locale,
      onExpireNuke,
    };
  }, [
    warOperations,
    warHotspots,
    countries,
    capitalCoordsByCountry,
    activeNukes,
    mapMode,
    locale,
    onExpireNuke,
  ]);

  useEffect(() => {
    if (!map || !mapReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let running = true;

    const syncSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const drawFrame = () => {
      if (!running) return;
      const {
        warOperations: ops,
        warHotspots: hotspots,
        countries: cList,
        capitalCoordsByCountry: capCoords,
        activeNukes: nukes,
        mapMode: mode,
        locale: loc,
        onExpireNuke: expireNuke,
      } = stateRef.current;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const countryMap = new Map(cList.map((c) => [c.code, c]));
      const nowSec = performance.now() / 1000;
      const wallNow = Date.now();

      const liveOps = ops.filter((op) =>
        ["MARCHING", "BESIEGING", "ACTIVE"].includes(op.status)
      );

      // 1. Draw high-tension geopolitical risk lines in Live War mode
      if (mode === "war") {
        for (const hs of hotspots.slice(0, 14)) {
          if (hs.probability < 52 && hs.status !== "WAR") continue;
          const cFrom = capCoords.get(hs.countryA);
          const cTo = capCoords.get(hs.countryB);
          if (!cFrom || !cTo) continue;

          const pA = map.project([cFrom.lng, cFrom.lat]);
          const pB = map.project([wrapTargetLng(cFrom.lng, cTo.lng), cTo.lat]);
          const isWar = hs.status === "WAR";
          const lineColor = isWar
            ? "rgba(239, 68, 68, 0.72)"
            : hs.probability >= 75
              ? "rgba(249, 115, 22, 0.65)"
              : "rgba(250, 204, 21, 0.48)";

          ctx.save();
          ctx.setLineDash(isWar ? [8, 5] : [4, 6]);
          ctx.lineDashOffset = -nowSec * (isWar ? 28 : 14);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = isWar ? 2.4 : 1.6;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();

          // Risk badge midpoint
          const midX = (pA.x + pB.x) / 2;
          const midY = (pA.y + pB.y) / 2;
          const txt = isWar
            ? `${hs.countryA} ⚔ ${hs.countryB}`
            : `${hs.countryA} ↔ ${hs.countryB} ${loc === "tr" ? `%${hs.probability}` : `${hs.probability}%`}`;
          ctx.font = "700 9.5px Inter, sans-serif";
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = isWar
            ? "rgba(127, 29, 29, 0.9)"
            : "rgba(15, 23, 42, 0.88)";
          ctx.strokeStyle = isWar ? "#f87171" : "#f59e0b";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(midX - tw / 2 - 6, midY - 9, tw + 12, 18, 9);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#f8fafc";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(txt, midX, midY);
          ctx.restore();
        }
      }

      // 2. Render live marching armies, tanks, jets, warships, covert envoys & uprising flames
      for (const op of liveOps) {
        const attacker = countryMap.get(op.attackerCode);
        const atkColor = attacker?.color || "#ef4444";
        const isEnvoy = op.operationType === "ENVOY_AGITATION" || op.unitType === "ENVOY";
        const isRebel = op.operationType === "REBEL_UPRISING";
        const pFrom = map.project([op.fromLng, op.fromLat]);
        const pTo = map.project([
          wrapTargetLng(op.fromLng, op.targetLng),
          op.targetLat,
        ]);

        const dx = pTo.x - pFrom.x;
        const dy = pTo.y - pFrom.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        // Advance Arrow / Covert Infiltration Vector
        if (dist > 8 && !isRebel) {
          ctx.save();
          const grad = ctx.createLinearGradient(pFrom.x, pFrom.y, pTo.x, pTo.y);
          if (isEnvoy) {
            grad.addColorStop(0, "rgba(192, 132, 252, 0.22)");
            grad.addColorStop(1, "rgba(245, 158, 11, 0.88)");
          } else {
            grad.addColorStop(0, "rgba(248, 250, 252, 0.25)");
            grad.addColorStop(1, "rgba(239, 68, 68, 0.92)");
          }
          ctx.strokeStyle = grad;
          ctx.lineWidth = isEnvoy ? 2.2 : 3;
          ctx.setLineDash(isEnvoy ? [5, 7] : [10, 6]);
          ctx.lineDashOffset = -nowSec * (isEnvoy ? 24 : 36);
          ctx.beginPath();
          ctx.moveTo(pFrom.x, pFrom.y);
          ctx.lineTo(pTo.x, pTo.y);
          ctx.stroke();

          // Arrowhead pointing onto target city
          ctx.setLineDash([]);
          ctx.translate(pTo.x, pTo.y);
          ctx.rotate(angle);
          ctx.fillStyle = isEnvoy ? "#c084fc" : "#ef4444";
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-16, -6);
          ctx.lineTo(-12, 0);
          ctx.lineTo(-16, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Animated units along vector
          const count = isEnvoy ? 2 : op.unitType === "ARMOR" ? 2 : 3;
          for (let i = 0; i < count; i++) {
            const rawT = (nowSec * (op.unitType === "AIR" ? 0.36 : isEnvoy ? 0.22 : 0.19) + i / count) % 0.92;
            const ux = pFrom.x + dx * rawT;
            const uy = pFrom.y + dy * rawT;
            if (isEnvoy) {
              drawEnvoySprite(ctx, ux, uy, angle, nowSec * 5 + i * 2.3, atkColor);
            } else if (op.unitType === "ARMOR") {
              drawTankSprite(ctx, ux, uy, angle, nowSec * 4 + i * 2.1, atkColor);
              // Occasional tracer shell arcing to target
              const shellPhase = (nowSec * 1.4 + i * 0.5) % 1;
              if (shellPhase < 0.45 && dist > 30) {
                const st = shellPhase / 0.45;
                const sx = ux + (pTo.x - ux) * st;
                const sy = uy + (pTo.y - uy) * st - Math.sin(st * Math.PI) * 16;
                ctx.fillStyle = "#fef08a";
                ctx.beginPath();
                ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (op.unitType === "AIR") {
              const arcLift = Math.sin(rawT * Math.PI) * Math.min(48, dist * 0.25);
              drawJetSprite(ctx, ux, uy - arcLift, angle, atkColor);
            } else if (op.unitType === "NAVAL") {
              drawWarshipSprite(ctx, ux, uy, angle, nowSec * 4 + i, atkColor);
            } else {
              // Infantry squad: draw 2-3 marching soldiers in formation
              drawSoldierSprite(ctx, ux - 4, uy - 3, angle, nowSec * 8 + i * 1.4, atkColor);
              drawSoldierSprite(ctx, ux + 5, uy + 2, angle, nowSec * 8 + i * 1.4 + 0.8, atkColor);
            }
          }
        }

        // Local insurgent militia skirmishing around target city when REBEL_UPRISING
        if (isRebel) {
          for (let m = 0; m < 3; m++) {
            const orb = nowSec * 1.4 + (m * Math.PI * 2) / 3;
            const rx = pTo.x + Math.cos(orb) * 18;
            const ry = pTo.y + Math.sin(orb) * 12;
            drawSoldierSprite(ctx, rx, ry, orb + Math.PI / 2, nowSec * 9 + m, "#f97316");
          }
        }

        // Active Encirclement / Agitation / Uprising Perimeter around pTo
        const isBesieging = op.status === "BESIEGING" || op.status === "ACTIVE";
        const ringRadius = isBesieging ? 22 : 14;
        ctx.save();
        ctx.translate(pTo.x, pTo.y);

        // Rotating perimeter ring segments
        ctx.rotate(nowSec * (isBesieging ? 1.5 : 0.8));
        ctx.strokeStyle = isEnvoy
          ? "#c084fc"
          : isRebel
            ? "#f97316"
            : isBesieging
              ? "#ef4444"
              : "#f59e0b";
        ctx.lineWidth = isEnvoy ? 2.1 : 2.6;
        for (let s = 0; s < 4; s++) {
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            ringRadius,
            (s * Math.PI) / 2 + 0.18,
            ((s + 1) * Math.PI) / 2 - 0.18
          );
          ctx.stroke();
        }

        // Explosion / agitation impact flashes inside target city
        if (isBesieging) {
          for (let b = 0; b < 3; b++) {
            const bt = (nowSec * 1.8 + b * 0.37) % 1;
            const bx = Math.cos(b * 2.1 + Math.floor(nowSec)) * 10;
            const by = Math.sin(b * 2.7 + Math.floor(nowSec)) * 7;
            if (bt < 0.5) {
              const r = bt * (isEnvoy ? 14 : 18);
              ctx.fillStyle = isEnvoy
                ? `rgba(192, 132, 252, ${(1 - bt * 2) * 0.72})`
                : `rgba(251, 146, 60, ${(1 - bt * 2) * 0.85})`;
              ctx.beginPath();
              ctx.arc(bx, by, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();

        // Compact Floating HUD Pill above target province
        const label = isEnvoy
          ? `${loc === "tr" ? "ELÇİ" : "ENVOY"}: ${op.attackerCode} → ${op.defenderCode} • ${loc === "tr" ? `%${op.progress}` : `${op.progress}%`}`
          : isRebel
            ? `${loc === "tr" ? "İSYAN" : "REBELS"} ⚔ ${op.defenderCode} • ${loc === "tr" ? `%${op.progress}` : `${op.progress}%`}`
            : `${op.attackerCode} ⚔ ${op.defenderCode} • ${loc === "tr" ? `%${op.progress}` : `${op.progress}%`}`;
        ctx.save();
        ctx.font = "700 10px Inter, sans-serif";
        const tw = ctx.measureText(label).width;
        const boxW = Math.max(82, tw + 14);
        const bx = pTo.x - boxW / 2;
        const by = pTo.y - ringRadius - 28;
        ctx.fillStyle = "rgba(9, 13, 22, 0.92)";
        ctx.strokeStyle = isEnvoy
          ? "rgba(192, 132, 252, 0.88)"
          : isRebel
            ? "rgba(249, 115, 22, 0.9)"
            : "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, 22, 7);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = "#fef2f2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, pTo.x, by + 8.5);

        // Mini progress bar inside badge
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(bx + 6, by + 16, boxW - 12, 3);
        ctx.fillStyle = isEnvoy
          ? "#c084fc"
          : op.progress >= 75
            ? "#22c55e"
            : "#f59e0b";
        ctx.fillRect(bx + 6, by + 16, ((boxW - 12) * op.progress) / 100, 3);
        ctx.restore();
      }

      // 3. Render active Nuclear Strikes (ICBM -> Blast -> Mushroom Cloud)
      for (const nk of nukes) {
        const elapsed = (wallNow - nk.startedAt) / 1000;
        if (elapsed > 10.2) {
          expireNuke?.(nk.id);
          continue;
        }
        const pFrom = map.project([nk.fromLng, nk.fromLat]);
        const pTo = map.project([
          wrapTargetLng(nk.fromLng, nk.targetLng),
          nk.targetLat,
        ]);
        const lbl =
          loc === "tr"
            ? `NÜKLEER İNFİLAK • ${nk.targetName}`
            : `NUCLEAR STRIKE • ${nk.targetName}`;
        drawNuclearDetonation(ctx, pFrom, pTo, elapsed, lbl);
      }

      const needsAnim =
        liveOps.length > 0 ||
        nukes.length > 0 ||
        (mode === "war" && hotspots.some((h) => h.probability >= 52 || h.status === "WAR"));

      if (needsAnim) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const redrawOnce = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(drawFrame);
    };

    map.on("move", redrawOnce);
    map.on("zoom", redrawOnce);
    rafId = requestAnimationFrame(drawFrame);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      map.off("move", redrawOnce);
      map.off("zoom", redrawOnce);
    };
  }, [
    map,
    mapReady,
    warOperations,
    warHotspots,
    activeNukes,
    mapMode,
    locale,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="war-effects-canvas"
      className="pointer-events-none absolute inset-0 z-10"
    />
  );
}
