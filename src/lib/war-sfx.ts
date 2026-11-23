/** Procedural Web Audio tactical combat & nuclear sound effects (zero external assets). */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => undefined);
  }
  return sharedCtx;
}

export function playWarActionSfx(
  kind: "launch" | "skirmish" | "capture" | "nuke",
  enabled = true
) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (kind === "launch") {
      // Tactical tank/radio deployment double-pulse
      [190, 260].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        osc.frequency.exponentialRampToValueAtTime(90, now + idx * 0.08 + 0.12);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.15);
      });
      return;
    }

    if (kind === "skirmish") {
      // Distant artillery thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
      return;
    }

    if (kind === "capture") {
      // Crisp bronze capture brass chord
      [261.6, 329.6, 392.0].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.07, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + 0.58);
      });
      return;
    }

    // kind === "nuke": warning chime followed by deep sub-bass detonation roar
    const siren = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    siren.type = "sawtooth";
    siren.frequency.setValueAtTime(420, now);
    siren.frequency.linearRampToValueAtTime(660, now + 0.45);
    siren.frequency.linearRampToValueAtTime(420, now + 0.9);
    sirenGain.gain.setValueAtTime(0.03, now);
    sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    siren.connect(sirenGain).connect(ctx.destination);
    siren.start(now);
    siren.stop(now + 1.0);

    const boomAt = now + 1.5;
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(84, boomAt);
    sub.frequency.exponentialRampToValueAtTime(24, boomAt + 1.9);
    subGain.gain.setValueAtTime(0.24, boomAt);
    subGain.gain.exponentialRampToValueAtTime(0.001, boomAt + 2.1);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(boomAt);
    sub.stop(boomAt + 2.2);

    // Shaped shockwave rumble noise
    const bufferSize = Math.floor(ctx.sampleRate * 1.8);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.65));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(340, boomAt);
    filter.frequency.exponentialRampToValueAtTime(75, boomAt + 1.7);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.16, boomAt);
    nGain.gain.exponentialRampToValueAtTime(0.001, boomAt + 1.8);
    noise.connect(filter).connect(nGain).connect(ctx.destination);
    noise.start(boomAt);
    noise.stop(boomAt + 1.85);
  } catch {
    // Ignore audio context errors when browser autoplay blocks sound
  }
}
