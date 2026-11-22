"use client";

export interface AmbientTrackDefinition {
  id: string;
  title: string;
  eraTag: string;
  mood: string;
  bpm: number;
  padWave: OscillatorType;
  leadWave: OscillatorType;
  filterCutoff: number;
  chords: number[][]; // Midi note arrays per bar
  scale: number[];    // Midi pitches for melodic arpeggios
  bassPattern: boolean;
  reverbWet: number;
}

export const AMBIENT_TRACKS: AmbientTrackDefinition[] = [
  {
    id: "peace_dawn",
    title: "Barışın Şafağı",
    eraTag: "Klasik Strateji",
    mood: "Sıcak piyano tınıları ve geniş yaylı akorları",
    bpm: 70,
    padWave: "triangle",
    leadWave: "sine",
    filterCutoff: 760,
    // Dm9 -> Bbmaj7 -> Fmaj7 -> Cadd9
    chords: [
      [50, 57, 60, 64],
      [46, 53, 57, 62],
      [41, 53, 57, 60],
      [48, 55, 62, 64],
    ],
    scale: [62, 64, 65, 69, 72, 74, 76, 81],
    bassPattern: false,
    reverbWet: 0.48,
  },
  {
    id: "imperial_march",
    title: "1444: İmparatorluk Mührü",
    eraTag: "Tarihsel Epik",
    mood: "Ağır çello armonileri ve görkemli beşli akorlar",
    bpm: 64,
    padWave: "sawtooth",
    leadWave: "triangle",
    filterCutoff: 540,
    // Em -> Fmaj7 -> G6 -> Em
    chords: [
      [40, 47, 52, 59],
      [41, 48, 53, 60],
      [43, 50, 55, 59],
      [40, 47, 55, 64],
    ],
    scale: [59, 60, 64, 67, 69, 71, 76],
    bassPattern: true,
    reverbWet: 0.56,
  },
  {
    id: "cold_war_pulse",
    title: "1962: Soğuk Savaş Gerilimi",
    eraTag: "Nükleer Kutuplaşma",
    mood: "Karanlık analog synth nabzı ve soğuk kristal padler",
    bpm: 84,
    padWave: "sawtooth",
    leadWave: "sine",
    filterCutoff: 620,
    // Cm -> Abmaj7 -> Fm9 -> Gsus4
    chords: [
      [48, 55, 60, 63],
      [44, 51, 56, 63],
      [41, 48, 56, 60],
      [43, 50, 55, 60],
    ],
    scale: [60, 62, 63, 67, 68, 72, 75, 79],
    bassPattern: true,
    reverbWet: 0.44,
  },
  {
    id: "modern_balance",
    title: "2026: Küresel Denge",
    eraTag: "Modern Jeopolitik",
    mood: "Yumuşak downtempo elektronik arp ve derin bas",
    bpm: 92,
    padWave: "triangle",
    leadWave: "triangle",
    filterCutoff: 880,
    // Am9 -> Fmaj7 -> Dm9 -> Em7
    chords: [
      [45, 52, 60, 64],
      [41, 48, 57, 60],
      [50, 57, 60, 64],
      [40, 47, 55, 62],
    ],
    scale: [60, 64, 67, 69, 71, 72, 76, 79],
    bassPattern: true,
    reverbWet: 0.42,
  },
  {
    id: "war_room",
    title: "Harekât Odası",
    eraTag: "Kriz & Cephe",
    mood: "Gergin ostinato vuruşları ve koyu yaylı atmosferi",
    bpm: 78,
    padWave: "sawtooth",
    leadWave: "triangle",
    filterCutoff: 490,
    // Dm -> C/E -> Bbmaj7 -> A7sus4
    chords: [
      [38, 50, 53, 57],
      [40, 48, 55, 60],
      [46, 53, 57, 62],
      [45, 52, 57, 62],
    ],
    scale: [57, 62, 64, 65, 69, 70, 74],
    bassPattern: true,
    reverbWet: 0.5,
  },
  {
    id: "diplomacy_salon",
    title: "Diplomasi Salonu",
    eraTag: "Zirve & Antlaşma",
    mood: "Hafif oda müziği, arp ezgileri ve huzurlu majör akorlar",
    bpm: 66,
    padWave: "sine",
    leadWave: "triangle",
    filterCutoff: 960,
    // Gmaj7 -> Em9 -> Cmaj7 -> D6
    chords: [
      [43, 50, 59, 66],
      [40, 47, 55, 62],
      [48, 55, 59, 64],
      [50, 57, 62, 66],
    ],
    scale: [62, 66, 67, 71, 74, 78, 79],
    bassPattern: false,
    reverbWet: 0.52,
  },
  {
    id: "sea_explorers",
    title: "Portolan: Açık Denizler",
    eraTag: "Keşif Çağı",
    mood: "Lydian deniz esintisi, çan tınıları ve ufuk armonisi",
    bpm: 62,
    padWave: "triangle",
    leadWave: "sine",
    filterCutoff: 840,
    // Cmaj7 -> D/C -> Em7 -> Bm7
    chords: [
      [48, 55, 60, 64],
      [48, 54, 57, 62],
      [40, 47, 55, 62],
      [47, 54, 57, 62],
    ],
    scale: [60, 62, 64, 66, 67, 71, 74, 76],
    bassPattern: false,
    reverbWet: 0.62,
  },
  {
    id: "cosmic_empire",
    title: "Yıldızlar & Tarih",
    eraTag: "Meditatif Ambient",
    mood: "Derin uzay ve tarih hissi veren ağır koro/pad dokusu",
    bpm: 56,
    padWave: "sine",
    leadWave: "sine",
    filterCutoff: 680,
    // F#m9 -> Dmaj7 -> Aadd9 -> E6
    chords: [
      [42, 49, 57, 61],
      [50, 57, 61, 66],
      [45, 52, 57, 64],
      [40, 47, 56, 61],
    ],
    scale: [61, 64, 66, 69, 73, 76, 78],
    bassPattern: false,
    reverbWet: 0.68,
  },
];

export const AMBIENT_TRACK_BY_ID: Record<string, AmbientTrackDefinition> =
  Object.fromEntries(AMBIENT_TRACKS.map((t) => [t.id, t]));

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Self-contained procedural Web Audio synthesizer generating lush warm pads,
 * algorithmic cathedral reverb, and melodic strategy soundtracks without
 * external audio CDN dependencies.
 */
class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private padBus: BiquadFilterNode | null = null;
  private timerId: number | null = null;
  private playing = false;
  private wantPlaying = false;
  private currentTrackId = "peace_dawn";
  private volume = 0.35; // 0..1
  private stepIndex = 0;

  private ensureGraph(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 4;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;

      const padFilter = ctx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 760;
      padFilter.Q.value = 0.7;

      // Algorithmic stereo reverb impulse (2.8 seconds smooth hall tail)
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * 2.8);
      const impulse = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        let prev = 0;
        for (let i = 0; i < len; i++) {
          const decay = Math.pow(1 - i / len, 2.4);
          const white = Math.random() * 2 - 1;
          prev = prev * 0.65 + white * 0.35;
          data[i] = prev * decay * 0.45;
        }
      }

      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.55;

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.45;

      padFilter.connect(dryGain);
      padFilter.connect(convolver);
      convolver.connect(wetGain);

      dryGain.connect(compressor);
      wetGain.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.dryGain = dryGain;
      this.wetGain = wetGain;
      this.padBus = padFilter;
    }

    return this.ctx;
  }

  private playPadChord(notes: number[], durationSec: number, track: AmbientTrackDefinition) {
    const ctx = this.ctx;
    const bus = this.padBus;
    if (!ctx || !bus) return;

    const now = ctx.currentTime;
    const chordGain = ctx.createGain();
    const peak = 0.14 / Math.max(1, notes.length * 0.65);

    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.linearRampToValueAtTime(peak, now + Math.min(1.6, durationSec * 0.35));
    chordGain.gain.setValueAtTime(peak, now + durationSec * 0.7);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.6);
    chordGain.connect(bus);

    for (const midi of notes) {
      const freq = midiToFreq(midi);
      for (const detune of [-5.5, 5.5]) {
        const osc = ctx.createOscillator();
        osc.type = track.padWave;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune, now);
        osc.connect(chordGain);
        osc.start(now);
        osc.stop(now + durationSec + 0.7);
      }
    }
  }

  private playMelodyNote(midi: number, durationSec: number, wave: OscillatorType, level = 0.11) {
    const ctx = this.ctx;
    const bus = this.padBus;
    if (!ctx || !bus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(midiToFreq(midi), now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(g);
    g.connect(bus);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  private tickStep() {
    if (!this.playing || !this.ctx || this.ctx.state !== "running") return;
    const track = AMBIENT_TRACK_BY_ID[this.currentTrackId] ?? AMBIENT_TRACKS[0];
    const beatSec = 60 / track.bpm;
    const step = this.stepIndex;
    const chordIdx = Math.floor(step / 8) % track.chords.length;
    const posInBar = step % 8;

    // Trigger lush chord pad on every bar start (8 eighth-notes per bar)
    if (posInBar === 0) {
      this.playPadChord(track.chords[chordIdx], beatSec * 4.1, track);
    }

    // Optional soft rhythmic low bass pulse
    if (track.bassPattern && (posInBar === 0 || posInBar === 3 || posInBar === 6)) {
      const rootNote = track.chords[chordIdx][0] - 12;
      this.playMelodyNote(Math.max(28, rootNote), beatSec * 0.9, "sine", 0.13);
    }

    // Gentle generative melodic arpeggio aligned cleanly to active scale
    const shouldPlayPluck =
      posInBar === 0 ||
      posInBar === 2 ||
      posInBar === 4 ||
      (posInBar === 6 && Math.random() > 0.35) ||
      Math.random() > 0.72;

    if (shouldPlayPluck) {
      const pick =
        track.scale[(step * 3 + Math.floor(Math.random() * 2)) % track.scale.length];
      this.playMelodyNote(pick, beatSec * 1.45, track.leadWave, 0.085);
    }

    this.stepIndex += 1;
  }

  public async configure(params: {
    enabled: boolean;
    trackId: string;
    volume: number;
  }): Promise<boolean> {
    const prevTrack = this.currentTrackId;
    this.currentTrackId = AMBIENT_TRACK_BY_ID[params.trackId]
      ? params.trackId
      : AMBIENT_TRACKS[0].id;
    this.volume = Math.max(0, Math.min(1, params.volume / 100));
    this.wantPlaying = params.enabled && this.volume > 0.001;

    if (!this.wantPlaying) {
      this.stop();
      return false;
    }

    const ctx = this.ensureGraph();
    if (!ctx || !this.masterGain || !this.padBus) return false;

    const track = AMBIENT_TRACK_BY_ID[this.currentTrackId];
    const now = ctx.currentTime;
    this.padBus.frequency.setTargetAtTime(track.filterCutoff, now, 0.3);
    if (this.wetGain && this.dryGain) {
      this.wetGain.gain.setTargetAtTime(track.reverbWet, now, 0.25);
      this.dryGain.gain.setTargetAtTime(1 - track.reverbWet * 0.5, now, 0.25);
    }

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Autoplay blocked until next user click
        return false;
      }
    }

    if (prevTrack !== this.currentTrackId && this.playing) {
      // Reset bar phrase smoothly when changing track
      this.stepIndex = 0;
      if (this.timerId !== null) {
        window.clearInterval(this.timerId);
        this.timerId = null;
      }
      this.playing = false;
    }

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.volume, now, 0.22);

    if (!this.playing) {
      this.playing = true;
      const stepMs = Math.round(((60 / track.bpm) / 2) * 1000);
      this.tickStep();
      this.timerId = window.setInterval(() => this.tickStep(), stepMs);
    }

    return ctx.state === "running";
  }

  public async tryUnlockIfEnabled(): Promise<boolean> {
    if (!this.wantPlaying) return false;
    return this.configure({
      enabled: true,
      trackId: this.currentTrackId,
      volume: Math.round(this.volume * 100),
    });
  }

  public stop(): void {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.12);
    }
  }

  public isAudioRunning(): boolean {
    return this.playing && this.ctx?.state === "running";
  }
}

export const ambientMusic = new AmbientMusicEngine();
