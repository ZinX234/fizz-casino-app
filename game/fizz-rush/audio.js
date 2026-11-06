import { GAME_CONFIG } from './config';

/**
 * Fizz Rush — runtime audio
 * ---------------------------------------------------------------------------
 * The soundtrack and every sound effect are synthesised with the Web Audio API,
 * so nothing has to download and the music can respond live to what the player
 * is doing (intensity layers rise with speed, combo and bonus events).
 *
 * The engine is defensive by design: if audio is unavailable or blocked it
 * simply goes quiet instead of throwing.
 */

const NOTE = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196 };

// i - VI - III - VII in A minor, the "casino loop" the island runs on.
const PROGRESSION = [
  { root: NOTE.A1, chord: [NOTE.A2, NOTE.C3, NOTE.E3] },
  { root: NOTE.F2, chord: [NOTE.F3, NOTE.A2, NOTE.C3] },
  { root: NOTE.C2, chord: [NOTE.C3, NOTE.E3, NOTE.G3] },
  { root: NOTE.G2, chord: [NOTE.G3, NOTE.C3, NOTE.E3] },
];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings || GAME_CONFIG.audio;
    this.ctx = null;
    this.nodes = null;
    this.timer = null;
    this.step = 0;
    this.bar = 0;
    this.intensity = 0;
    this.ambienceType = null;
    this.ambienceTimer = null;
    this.noiseBuffer = null;
    this.disposed = false;
  }

  /** Must be called from a user gesture the first time. */
  ensure() {
    if (this.disposed) return false;
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.build();
      } catch {
        this.ctx = null;
        return false;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.ctx.state === 'running' && this.wantedAmbience && this.ambienceType !== this.wantedAmbience) {
      this.startAmbience(this.wantedAmbience);
    }
    return true;
  }

  build() {
    const ctx = this.ctx;
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    const ambience = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    music.connect(master);
    sfx.connect(master);
    ambience.connect(master);
    this.nodes = { master, music, sfx, ambience };
    this.applyVolumes();

    // Shared noise source for ambience and percussive effects.
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  applyVolumes(next) {
    if (next) this.settings = { ...this.settings, ...next };
    if (!this.nodes) return;
    const s = this.settings;
    const mute = s.muted ? 0 : 1;
    const t = this.ctx.currentTime;
    this.nodes.master.gain.setTargetAtTime((s.master ?? 0.7) * mute, t, 0.05);
    this.nodes.music.gain.setTargetAtTime(s.music ?? 0.5, t, 0.05);
    this.nodes.sfx.gain.setTargetAtTime(s.sfx ?? 0.8, t, 0.05);
    this.nodes.ambience.gain.setTargetAtTime(s.ambience ?? 0.45, t, 0.05);
  }

  /* --------------------------------------------------------------- helpers */

  tone({ freq, type = 'square', duration = 0.18, gain = 0.2, target, detune = 0, sweep = null, delay = 0 }) {
    if (!this.ctx || !this.nodes) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + duration);
    if (detune) osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(target || this.nodes.sfx);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise({ duration = 0.22, gain = 0.25, filter = 'lowpass', freq = 1200, q = 0.8, target, delay = 0, sweep = null }) {
    if (!this.ctx || !this.nodes || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bq = this.ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.setValueAtTime(freq, t0);
    if (sweep) bq.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + duration);
    bq.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(bq);
    bq.connect(env);
    env.connect(target || this.nodes.sfx);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  /* ------------------------------------------------------------------ sfx */

  sfx(name) {
    if (!this.ensure()) return;
    switch (name) {
      case 'coin':
        this.tone({ freq: 1180, type: 'triangle', duration: 0.1, gain: 0.16 });
        this.tone({ freq: 1760, type: 'triangle', duration: 0.14, gain: 0.12, delay: 0.05 });
        break;
      case 'gem':
        this.tone({ freq: 1320, type: 'sine', duration: 0.3, gain: 0.2, delay: 0 });
        this.tone({ freq: 1980, type: 'sine', duration: 0.34, gain: 0.14, delay: 0.06 });
        this.tone({ freq: 2640, type: 'sine', duration: 0.4, gain: 0.09, delay: 0.12 });
        break;
      case 'jump':
        this.tone({ freq: 420, type: 'sine', duration: 0.16, gain: 0.14, sweep: 900 });
        break;
      case 'airjump':
        this.tone({ freq: 660, type: 'triangle', duration: 0.18, gain: 0.13, sweep: 1320 });
        break;
      case 'slide':
        this.noise({ duration: 0.34, gain: 0.16, freq: 1600, sweep: 420, filter: 'bandpass', q: 1.1 });
        break;
      case 'land':
        this.noise({ duration: 0.12, gain: 0.12, freq: 320, sweep: 120 });
        break;
      case 'hit':
        this.noise({ duration: 0.4, gain: 0.32, freq: 900, sweep: 90 });
        this.tone({ freq: 160, type: 'sawtooth', duration: 0.32, gain: 0.2, sweep: 48 });
        break;
      case 'explode':
        this.noise({ duration: 0.7, gain: 0.38, freq: 1400, sweep: 60 });
        this.tone({ freq: 90, type: 'sawtooth', duration: 0.55, gain: 0.22, sweep: 32 });
        break;
      case 'grind':
        this.noise({ duration: 0.26, gain: 0.12, freq: 2400, sweep: 1800, filter: 'bandpass', q: 2.4 });
        this.tone({ freq: 2100, type: 'triangle', duration: 0.22, gain: 0.05, detune: 12 });
        break;
      case 'combo':
        this.tone({ freq: 880, type: 'triangle', duration: 0.16, gain: 0.14 });
        this.tone({ freq: 1180, type: 'triangle', duration: 0.2, gain: 0.11, delay: 0.07 });
        break;
      case 'bonus':
        [660, 880, 1100, 1320].forEach((f, i) => this.tone({ freq: f, type: 'triangle', duration: 0.26, gain: 0.13, delay: i * 0.06 }));
        break;
      case 'boost':
        this.tone({ freq: 300, type: 'sawtooth', duration: 0.5, gain: 0.16, sweep: 1400 });
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'sine', duration: 0.5, gain: 0.16, delay: i * 0.12 }));
        break;
      case 'payout':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, type: 'triangle', duration: 0.6, gain: 0.15, delay: i * 0.13 }));
        this.noise({ duration: 0.8, gain: 0.1, freq: 3000, filter: 'highpass', delay: 0.1 });
        break;
      case 'ui':
        this.tone({ freq: 740, type: 'sine', duration: 0.08, gain: 0.1 });
        break;
      case 'denied':
        this.tone({ freq: 220, type: 'square', duration: 0.22, gain: 0.12, sweep: 140 });
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- music */

  startMusic() {
    if (!this.ensure() || this.timer) return;
    this.step = 0;
    this.bar = 0;
    const sixteenth = 60 / (GAME_CONFIG.audio.tempo * 4);
    this.timer = window.setInterval(() => this.tick(sixteenth), sixteenth * 1000);
  }

  stopMusic() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** 0 = pad only, 1 = + arpeggio, 2 = + drums, 3 = full with lead. */
  setIntensity(level) {
    this.intensity = Math.max(0, Math.min(3, Math.round(level)));
  }

  tick(sixteenth) {
    if (!this.ctx || !this.nodes || this.disposed) return;
    const step = this.step % 16;
    const chord = PROGRESSION[this.bar % PROGRESSION.length];
    const music = this.nodes.music;

    if (step % 8 === 0) {
      // Sustained pad for the bar
      chord.chord.forEach((freq, i) =>
        this.tone({ freq, type: 'triangle', duration: noteLen(sixteenth, 15), gain: 0.05, target: music, detune: i * 4 })
      );
    }
    if (step % 4 === 0 || step === 6 || step === 14) {
      this.tone({ freq: chord.root, type: 'sine', duration: noteLen(sixteenth, 3), gain: 0.22, target: music });
    }
    if (this.intensity >= 1 && step % 2 === 1) {
      const note = chord.chord[step % chord.chord.length] * 2;
      this.tone({ freq: note, type: 'square', duration: noteLen(sixteenth, 1), gain: 0.045, target: music });
    }
    if (this.intensity >= 2) {
      if (step % 4 === 0) this.noise({ duration: 0.13, gain: 0.16, freq: 160, sweep: 60, target: music });
      if (step === 4 || step === 12) this.noise({ duration: 0.16, gain: 0.1, freq: 1900, filter: 'highpass', target: music });
      if (step % 2 === 0) this.noise({ duration: 0.05, gain: 0.05, freq: 7000, filter: 'highpass', target: music });
    }
    if (this.intensity >= 3 && (step === 7 || step === 15)) {
      const note = chord.chord[0] * 4;
      this.tone({ freq: note, type: 'sawtooth', duration: noteLen(sixteenth, 2), gain: 0.05, target: music, sweep: note * 1.5 });
    }

    this.step += 1;
    if (this.step % 16 === 0) this.bar += 1;
  }

  /* ------------------------------------------------------------- ambience */

  setAmbience(type) {
    this.wantedAmbience = type;
    if (!this.ensure()) return;
    this.startAmbience(type);
  }

  /** Ambience only plays once audio has been unlocked by a real gesture. */
  startAmbience(type) {
    if (this.ambienceType === type) return;
    this.ambienceType = type;
    if (this.ambienceTimer) {
      window.clearInterval(this.ambienceTimer);
      this.ambienceTimer = null;
    }
    if (!type) return;

    // Continuous bed (surf / wind)
    this.noise({ duration: 3.4, gain: 0.05, freq: 520, filter: 'lowpass', target: this.nodes.ambience });

    const table = {
      spray: () => this.noise({ duration: 1.6, gain: 0.05, freq: 700, sweep: 320, target: this.nodes.ambience }),
      leaves: () => this.noise({ duration: 1.2, gain: 0.035, freq: 3200, filter: 'bandpass', q: 1.6, target: this.nodes.ambience }),
      embers: () => this.noise({ duration: 0.5, gain: 0.05, freq: 1800, sweep: 400, filter: 'bandpass', target: this.nodes.ambience }),
      bubbles: () => {
        this.tone({ freq: 700 + Math.random() * 500, type: 'sine', duration: 0.1, gain: 0.05, sweep: 1500, target: this.nodes.ambience });
      },
      confetti: () => {
        this.tone({ freq: 1400 + Math.random() * 500, type: 'triangle', duration: 0.14, gain: 0.04, target: this.nodes.ambience });
      },
    };
    const fn = table[type];
    if (!fn) return;
    this.ambienceTimer = window.setInterval(() => {
      if (this.disposed || !this.ctx || this.ctx.state !== 'running') return;
      fn();
    }, type === 'spray' ? 2400 : 1400);
  }

  dispose() {
    this.disposed = true;
    this.stopMusic();
    if (this.ambienceTimer) window.clearInterval(this.ambienceTimer);
    this.ambienceTimer = null;
    try {
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.nodes = null;
  }
}

/** Duration helper: how long one sixteenth-note run should last. */
function noteLen(sixteenth, steps) {
  return Math.min(3, sixteenth * steps);
}

export default AudioEngine;