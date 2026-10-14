// Sound hooks. Every game event calls through here so that samples can be
// swapped in later without touching the game logic. Currently uses light
// synthesised tones; all calls are no-ops while sound is disabled.

import { CONFIG } from '@/config/gameConfig';

let enabled = CONFIG.sound.enabledByDefault;
let context = null;

function audio() {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    context = Ctor ? new Ctor() : null;
  }
  return context;
}

function tone(frequency, duration = 0.12, type = 'triangle', gain = 0.04, delay = 0) {
  if (!enabled) return;
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

let lastReelTick = 0;

export const sound = {
  setEnabled(value) {
    enabled = value;
    if (value) audio();
  },
  isEnabled() {
    return enabled;
  },
  click() {
    tone(440, 0.05, 'square', 0.03);
  },
  spin() {
    tone(160, 0.3, 'sawtooth', 0.035);
  },
  reelTick() {
    const now = Date.now();
    if (now - lastReelTick < 90) return;
    lastReelTick = now;
    tone(220 + Math.random() * 60, 0.04, 'square', 0.018);
  },
  reelStop() {
    tone(320, 0.09, 'triangle', 0.05);
  },
  win(betMultiple = 1) {
    const base = betMultiple >= 25 ? 1 : betMultiple >= 10 ? 0.85 : 0.7;
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq * base, 0.16, 'triangle', 0.045, i * 0.1));
  },
  bigWin() {
    [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.05, i * 0.11));
  },
  feature() {
    [392, 523, 659].forEach((freq, i) => tone(freq, 0.3, 'sine', 0.05, i * 0.12));
  },
  maxWin() {
    [262, 330, 392, 523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.4, 'sine', 0.055, i * 0.14));
  },
  collect() {
    tone(880, 0.12, 'triangle', 0.05);
    tone(1174, 0.16, 'triangle', 0.045, 0.1);
  },
};

export default sound;