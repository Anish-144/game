// ============================================================
// Sound effects + ambient music — Web Audio, no asset files
// Everything respects the Settings screen.
// ============================================================

import { currentSettings } from '../store/settingsStore';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Browsers need a gesture before audio can start. */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(freq: number, type: OscillatorType, duration: number, gain = 0.22, delay = 0) {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, gain = 0.12) {
  const c = context();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  src.buffer = buffer;
  g.gain.setValueAtTime(gain, c.currentTime);
  src.connect(filter).connect(g).connect(c.destination);
  src.start();
}

export type SoundName =
  | 'tap' | 'deal' | 'bid' | 'pass' | 'trump' | 'reveal'
  | 'play' | 'trick' | 'win' | 'lose' | 'join';

export function play(name: SoundName): void {
  if (!currentSettings().sound) return;
  switch (name) {
    case 'tap':    tone(660, 'sine', 0.06, 0.12); break;
    case 'deal':   noise(0.5, 0.1); break;
    case 'join':   tone(523, 'sine', 0.12); tone(784, 'sine', 0.16, 0.18, 0.08); break;
    case 'bid':    tone(440, 'triangle', 0.16); tone(587, 'triangle', 0.18, 0.2, 0.08); break;
    case 'pass':   tone(320, 'sine', 0.18, 0.16); break;
    case 'trump':  [523, 659, 784, 1046].forEach((f, i) => tone(f, 'triangle', 0.28, 0.2, i * 0.07)); break;
    case 'reveal': [440, 554, 659, 880].forEach((f, i) => tone(f, 'sine', 0.34, 0.24, i * 0.08)); break;
    case 'play':   noise(0.1, 0.09); tone(880, 'sine', 0.05, 0.08); break;
    case 'trick':  tone(784, 'sine', 0.12); tone(1046, 'sine', 0.16, 0.18, 0.07); break;
    case 'win':    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 'triangle', 0.4, 0.22, i * 0.09)); break;
    case 'lose':   [440, 370, 294].forEach((f, i) => tone(f, 'sine', 0.4, 0.2, i * 0.13)); break;
  }
}

// ─── ambient music ────────────────────────────────────────────────────────────

let musicTimer: number | null = null;
let musicGain: GainNode | null = null;

const PROGRESSION = [
  [196.0, 246.94, 293.66], // G minor-ish pad
  [174.61, 220.0, 261.63],
  [146.83, 185.0, 220.0],
  [164.81, 207.65, 246.94],
];

function padChord(freqs: number[], when: number, length: number) {
  const c = context();
  if (!c || !musicGain) return;
  for (const f of freqs) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.06, when + length * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(g).connect(musicGain);
    osc.start(when);
    osc.stop(when + length + 0.1);
  }
}

export function startMusic(): void {
  if (!currentSettings().music || musicTimer !== null) return;
  const c = context();
  if (!c) return;
  musicGain = c.createGain();
  musicGain.gain.value = 0.5;
  musicGain.connect(c.destination);

  let step = 0;
  const bar = 4200;
  const tick = () => {
    const now = context()?.currentTime ?? 0;
    padChord(PROGRESSION[step % PROGRESSION.length], now + 0.05, bar / 1000);
    step++;
  };
  tick();
  musicTimer = window.setInterval(tick, bar);
}

export function stopMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    try { musicGain.disconnect(); } catch { /* already gone */ }
    musicGain = null;
  }
}

export function syncMusic(): void {
  if (currentSettings().music) startMusic();
  else stopMusic();
}
