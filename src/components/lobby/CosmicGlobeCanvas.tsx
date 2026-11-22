"use client";

import { useEffect, useRef } from "react";
import { GLOBE_LAND_DOTS } from "@/lib/globe-dots";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

const DEG2RAD = Math.PI / 180;

/**
 * Animated starry cosmos + 3D Fibonacci-dot Earth rising cleanly from the
 * bottom horizon for the Mur4History welcome screen.
 */
export function CosmicGlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];

    // Precompute unit sphere vectors for each landmass coordinate once
    const unitDots = GLOBE_LAND_DOTS.map(([lat, lng]) => {
      const phi = lat * DEG2RAD;
      const lam = lng * DEG2RAD;
      const cosPhi = Math.cos(phi);
      return {
        x: cosPhi * Math.sin(lam),
        y: Math.sin(phi),
        z: cosPhi * Math.cos(lam),
      };
    });

    const buildStars = (w: number, h: number) => {
      const count = Math.min(340, Math.max(140, Math.floor((w * h) / 4800)));
      const list: Star[] = [];
      for (let i = 0; i < count; i++) {
        list.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() < 0.85 ? Math.random() * 1.1 + 0.35 : Math.random() * 1.7 + 1.0,
          baseAlpha: Math.random() * 0.65 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 1.4 + 0.4,
        });
      }
      stars = list;
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars(width, height);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => handleResize())
        : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const startTime = performance.now();
    // Pitch globe downward so Northern Hemisphere (Europe / Türkiye / North America) crowns the top
    const tiltRad = 22 * DEG2RAD;
    const cosTilt = Math.cos(tiltRad);
    const sinTilt = Math.sin(tiltRad);

    const renderFrame = (now: number) => {
      const t = (now - startTime) * 0.001;

      ctx.clearRect(0, 0, width, height);

      // Pitch-black cosmic canvas
      ctx.fillStyle = "#020306";
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric aurora aura behind center headline
      const auraGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.28,
        10,
        width * 0.5,
        height * 0.32,
        Math.max(width * 0.42, 320)
      );
      auraGrad.addColorStop(0, "rgba(72, 108, 160, 0.14)");
      auraGrad.addColorStop(0.5, "rgba(18, 28, 48, 0.08)");
      auraGrad.addColorStop(1, "rgba(2, 3, 6, 0)");
      ctx.fillStyle = auraGrad;
      ctx.fillRect(0, 0, width, height);

      // Twinkling stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const alpha =
          s.baseAlpha * (0.65 + 0.35 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(226, 236, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D Globe geometry anchored rising smoothly from the bottom horizon
      const globeRadius = Math.max(260, Math.min(width * 0.38, height * 0.66));
      const cx = width * 0.5;
      const cy = height + globeRadius * 0.38;

      // Soft outer white/slate atmospheric limb glow
      const rimGlow = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.88,
        cx,
        cy,
        globeRadius * 1.12
      );
      rimGlow.addColorStop(0, "rgba(220, 230, 248, 0.0)");
      rimGlow.addColorStop(0.45, "rgba(215, 226, 245, 0.16)");
      rimGlow.addColorStop(0.6, "rgba(255, 255, 255, 0.28)");
      rimGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = rimGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius * 1.14, 0, Math.PI * 2);
      ctx.fill();

      // Solid dark sphere interior masking background stars behind Earth
      const sphereGrad = ctx.createRadialGradient(
        cx,
        cy - globeRadius * 0.45,
        globeRadius * 0.1,
        cx,
        cy,
        globeRadius
      );
      sphereGrad.addColorStop(0, "#12151e");
      sphereGrad.addColorStop(0.7, "#07090d");
      sphereGrad.addColorStop(1, "#030407");
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Crisp luminous horizon arc
      ctx.strokeStyle = "rgba(235, 242, 255, 0.35)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, Math.PI, 0);
      ctx.stroke();

      // Slow westward spin centered around Atlantic / Europe / Türkiye
      const yaw = -0.35 + t * 0.075;
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const baseDotR = Math.max(1.25, globeRadius * 0.0052);

      for (let i = 0; i < unitDots.length; i++) {
        const p = unitDots[i];
        // Rotate around Y axis (longitude spin)
        const x1 = p.x * cosYaw - p.z * sinYaw;
        const z1 = p.x * sinYaw + p.z * cosYaw;
        // Rotate around X axis (axial pitch)
        const y2 = p.y * cosTilt - z1 * sinTilt;
        const z2 = p.y * sinTilt + z1 * cosTilt;

        if (z2 <= 0.02) continue;

        const sx = cx + x1 * globeRadius;
        const sy = cy - y2 * globeRadius;
        if (sy > height + 6 || sy < cy - globeRadius - 6) continue;

        // Perspective dot size & soft shading near limb
        const depth = Math.pow(z2, 0.55);
        const alpha = Math.min(0.95, 0.22 + depth * 0.74);
        const dotR = baseDotR * (0.65 + depth * 0.48);

        ctx.fillStyle = `rgba(238, 242, 250, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = window.requestAnimationFrame(renderFrame);
    };

    animId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
