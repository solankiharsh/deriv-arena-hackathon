/**
 * Generate simple synth sound effects as WAV files, then encode to MP3-compatible WAV.
 * Run: node scripts/generate-sounds.mjs
 *
 * Creates minimal WAV files (PCM 16-bit) in public/sounds/.
 * These are small (1-3KB each) and work in all browsers.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'sounds');

const SAMPLE_RATE = 22050;

function generateSamples(durationSec, fn) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = Math.max(-1, Math.min(1, fn(t, durationSec)));
  }
  return samples;
}

function encodeWav(samples) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 32767, true);
  }

  return Buffer.from(buffer);
}

function save(name, durationSec, fn) {
  const samples = generateSamples(durationSec, fn);
  const wav = encodeWav(samples);
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav);
  console.log(`  ${name}.wav (${(wav.length / 1024).toFixed(1)} KB)`);
}

const fade = (t, dur) => Math.min(1, t * 20) * Math.max(0, 1 - (t / dur));
const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);

console.log('Generating sound effects...');

// UI click - short tick
save('ui_click', 0.08, (t) =>
  env(t, 0.002, 0.03) * Math.sin(2 * Math.PI * 1200 * t) * 0.6
);

// Trade place - crisp percussive click
save('trade_place', 0.15, (t) =>
  env(t, 0.003, 0.05) * (
    Math.sin(2 * Math.PI * 800 * t) * 0.5 +
    Math.sin(2 * Math.PI * 1600 * t) * 0.3
  )
);

// Trade win - ascending two-tone chime
save('trade_win', 0.4, (t) => {
  const f1 = t < 0.15 ? 523 : 784; // C5 -> G5
  return env(t, 0.005, 0.15) * Math.sin(2 * Math.PI * f1 * t) * 0.5;
});

// Trade loss - descending muted tone
save('trade_loss', 0.3, (t) => {
  const f = 330 * Math.exp(-t * 3);
  return env(t, 0.005, 0.12) * Math.sin(2 * Math.PI * f * t) * 0.4;
});

// Timer warning - repeating beep
save('timer_warning', 0.5, (t) => {
  const beepPhase = (t * 4) % 1;
  const on = beepPhase < 0.5 ? 1 : 0;
  return on * env(beepPhase, 0.01, 0.1) * Math.sin(2 * Math.PI * 880 * t) * 0.5;
});

// Game start - ascending fanfare
save('game_start', 0.6, (t) => {
  const f = 440 + t * 600;
  return fade(t, 0.6) * (
    Math.sin(2 * Math.PI * f * t) * 0.4 +
    Math.sin(2 * Math.PI * f * 1.5 * t) * 0.2
  );
});

// Game end - descending gong
save('game_end', 0.8, (t) => {
  const f = 220;
  return env(t, 0.01, 0.4) * (
    Math.sin(2 * Math.PI * f * t) * 0.4 +
    Math.sin(2 * Math.PI * f * 2 * t) * 0.2 +
    Math.sin(2 * Math.PI * f * 3 * t) * 0.1
  );
});

// Powerup - quick rising sweep
save('powerup', 0.35, (t) => {
  const f = 300 + t * 2000;
  return env(t, 0.005, 0.15) * Math.sin(2 * Math.PI * f * t) * 0.5;
});

// Chaos alert - alarm-like warble
save('chaos_alert', 0.5, (t) => {
  const f = 600 + Math.sin(2 * Math.PI * 8 * t) * 200;
  return fade(t, 0.5) * Math.sin(2 * Math.PI * f * t) * 0.4;
});

// Knockout - heavy impact + reverb tail
save('knockout', 0.6, (t) => {
  const impact = env(t, 0.002, 0.05) * Math.sin(2 * Math.PI * 80 * t) * 0.8;
  const ring = env(t, 0.05, 0.3) * Math.sin(2 * Math.PI * 440 * t) * 0.3;
  return impact + ring;
});

// Stage shift - shimmer/whoosh
save('stage_shift', 0.4, (t) => {
  const f = 200 + t * 1500;
  const noise = (Math.random() * 2 - 1) * 0.1 * env(t, 0.01, 0.2);
  return env(t, 0.01, 0.2) * Math.sin(2 * Math.PI * f * t) * 0.4 + noise;
});

// Orb capture - bubble pop + sparkle
save('orb_capture', 0.25, (t) => {
  const pop = env(t, 0.001, 0.03) * Math.sin(2 * Math.PI * 400 * t) * 0.6;
  const sparkle = t > 0.05
    ? env(t - 0.05, 0.005, 0.1) * Math.sin(2 * Math.PI * 2000 * t) * 0.3
    : 0;
  return pop + sparkle;
});

console.log(`Done! ${12} files written to public/sounds/`);
