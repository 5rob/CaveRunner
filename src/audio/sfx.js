// @ts-check
// SFX, the sound engine: Web Audio, no files. A lazy AudioContext unlocked on the first
// tap, two buses (sfx, ambience), distance / pan / muffle, loops that fade unless set every
// frame, and the one-shot FX table. Every public call is wrapped: sound never breaks the game.

import { clampS, creatureSound, fxVolKey, knob, shotSound } from './recipes.js';
import { AMBIENCE } from '../data/themes.js';
import { DEV } from '../dev/knobs.js';

// The engine. Nothing in here runs until the game calls it, and every call is wrapped so a
// browser without Web Audio (or one that refuses it) just plays in silence.
export const SFX = (() => {
  let ac = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, crackBuf = null, comp = null, tap = null;
  let voices = 0, hooked = false;
  const MAX_VOICES = 28, HEAR = 650;
  const gates = {};
  const ear = { x: 0, y: 0 };
  const loops = new Set();
  let amb = null, ambWant = null;
  const stats = { played: 0, errors: [] };        // for the tests: sounds played, and any that broke

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const gate = (key, ms) => { const t = now(); if (gates[key] && t - gates[key] < ms) return false; gates[key] = t; return true; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // a broken sound must never break the game: it is noted (the tests read it) and skipped
  /** @type {<T extends Function>(fn: T) => T} keeps the wrapped function's signature, so calls to SFX are checked */
  // @ts-expect-error the wrapper passes `arguments` through: TS can't see it has fn's signature (noise)
  const safe = fn => function () {
    try { return fn.apply(null, arguments); } catch (e) { if (stats.errors.length < 20) stats.errors.push(String(e && e.message)); return null; }
  };

  function unlock() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
        comp.attack.value = 0.003; comp.release.value = 0.25;
        master = ac.createGain(); master.gain.value = 1;
        sfxBus = ac.createGain(); sfxBus.gain.value = DEV.vol;
        ambBus = ac.createGain(); ambBus.gain.value = DEV.vol * DEV.amb;
        sfxBus.connect(master); ambBus.connect(master);
        master.connect(comp); comp.connect(ac.destination);
        // two seconds of white noise, and of crackle: silence broken by sparse sharp pops
        const n = ac.sampleRate * 2;
        noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;
        crackBuf = ac.createBuffer(1, n, ac.sampleRate);
        const cd = crackBuf.getChannelData(0);
        for (let i = 0; i < n; i++) if (Math.random() < 0.0016) {
          const amp = (Math.random() < 0.2 ? 1 : 0.35) * (Math.random() < 0.5 ? -1 : 1), len = 20 + Math.random() * 60;
          for (let j = 0; j < len && i + j < n; j++) cd[i + j] += amp * (1 - j / len) * (Math.random() * 2 - 1);
        }
      }
      if (ac.state === 'suspended') ac.resume();
      if (!hooked) {
        hooked = true;
        // put the app away and the sound stops with it
        document.addEventListener('visibilitychange', () => {
          try { if (document.visibilityState === 'hidden') ac.suspend(); else ac.resume(); } catch (_) {}
        });
      }
      if (ambWant && !amb) setAmbience(ambWant);
    } catch (_) {}
  }
  const live = () => ac && ac.state === 'running';

  // Where a sound is heard from: quieter and duller with distance, panned left or right of
  // you. Returns the node to plug the sound into, or null if it is too far off (or there are
  // already too many sounds going). x == null means "at you": full volume, centre.
  function out(x, y, dur, prio, bus, vol) {
    if (!live()) return null;
    if (voices >= MAX_VOICES && !prio) return null;
    let g = 1, pan = 0, cut = 0;
    if (x != null) {
      const dx = x - ear.x, dy = y - ear.y, d = Math.hypot(dx, dy);
      if (d > HEAR) return null;
      g = 1 / (1 + (d / 170) * (d / 170));
      if (g < 0.02) return null;
      pan = clampS(dx / 260, -0.85, 0.85);
      if (d > 120) cut = 16000 / (1 + (d - 120) / 50);
    }
    voices++; stats.played++;
    setTimeout(() => { voices--; }, (dur + 0.15) * 1000);
    const gn = ac.createGain(); gn.gain.value = g * (vol == null ? 1 : vol);
    if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = pan; gn.connect(pn); pn.connect(bus || sfxBus); }
    else gn.connect(bus || sfxBus);
    if (!cut) return gn;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(400, cut); f.connect(gn);
    return f;
  }
  const lp = (dest, freq, q) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7; f.connect(dest); return f; };
  function env(g, t, dur, peak, att) {
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.01, dur));
  }
  // one oscillator: a pitch sweep f0 -> f1 under a quick-attack, falling envelope, with an
  // optional vibrato [rate Hz, depth Hz]
  function tone(dest, type, f0, f1, t, dur, peak, att, vib) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = vib[0]; lg.gain.value = vib[1];
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    env(g, t, dur, peak, att || 0.005);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  // filtered noise (or crackle): the organic half — breath, fire, rock, water, wind
  function hiss(dest, t, dur, peak, type, f0, f1, q, crackle, att) {
    const s = ac.createBufferSource(); s.buffer = crackle ? crackBuf : noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); env(g, t, dur, peak, att || 0.004);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // a retro zap: a square wave whose pitch jumps about at random, falling overall
  function zap(dest, t, dur, peak, hi, lo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    for (let s = 0; s <= dur; s += 0.012) o.frequency.setValueAtTime(lo + (hi - lo) * (1 - s / dur) * Math.random(), t + s);
    env(g, t, dur, peak, 0.002);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(dest, f, t, dur, peak) {
    [1, 2.76, 5.4].forEach((m, i) => tone(dest, 'sine', f * m, f * m, t, dur / (i + 1), peak / (i + 1), 0.002));
  }

  // ---- the spell voices: (dest, start, pitch, volume, length) ----
  const VOICE = {
    magic(d, t, P, V, D) {
      tone(d, 'triangle', 950 * P, 380 * P, t, 0.13 * D, 0.5 * V);
      tone(d, 'square', 475 * P, 190 * P, t, 0.09 * D, 0.1 * V);
      hiss(d, t, 0.07 * D, 0.25 * V, 'bandpass', 2600 * P, 1200 * P, 1.2);
    },
    pierce(d, t, P, V, D) {
      tone(d, 'sawtooth', 1500 * P, 500 * P, t, 0.1 * D, 0.22 * V);
      hiss(d, t, 0.15 * D, 0.35 * V, 'highpass', 5000, 2500, 0.7);
      tone(d, 'sine', 2400 * P, 2300 * P, t, 0.05, 0.18 * V);
    },
    heavy(d, t, P, V, D) {
      tone(d, 'sine', 170 * P, 50 * P, t, 0.28 * D, 0.9 * V, 0.003);
      tone(d, 'square', 85 * P, 42 * P, t, 0.16 * D, 0.12 * V);
      hiss(d, t, 0.14 * D, 0.5 * V, 'lowpass', 900, 200, 0.8);
    },
    energy(d, t, P, V, D) {
      tone(d, 'sine', 260 * P, 380 * P, t, 0.3 * D, 0.6 * V, 0.02, [16, 30 * P]);
      tone(d, 'square', 130 * P, 190 * P, t, 0.22 * D, 0.07 * V);
      hiss(d, t, 0.2 * D, 0.15 * V, 'bandpass', 800 * P, 1600 * P, 3);
    },
    scatter(d, t, P, V, D) {
      hiss(d, t, 0.2 * D, 0.9 * V, 'lowpass', 3000, 500, 0.8);
      tone(d, 'square', 150 * P, 55 * P, t, 0.12 * D, 0.22 * V);
      hiss(d, t, 0.05, 0.35 * V, 'highpass', 4000, 4000, 0.7);
    },
    bubble(d, t, P, V, D) {
      tone(d, 'sine', 320 * P, 1000 * P, t, 0.09 * D, 0.55 * V, 0.004);
      tone(d, 'sine', 480 * P, 1400 * P, t + 0.05, 0.07 * D, 0.3 * V, 0.004);
    },
    saw(d, t, P, V, D) {
      tone(d, 'square', 1900 * P, 1500 * P, t, 0.16 * D, 0.1 * V);
      tone(d, 'square', 2470 * P, 2000 * P, t, 0.16 * D, 0.08 * V);
      hiss(d, t, 0.18 * D, 0.45 * V, 'bandpass', 6000, 3500, 4);
      hiss(d, t, 0.1, 0.3 * V, 'lowpass', 700, 300, 1, true);
    },
    lob(d, t, P, V, D) {
      tone(d, 'sine', 240 * P, 85 * P, t, 0.16 * D, 0.8 * V, 0.003);
      hiss(d, t, 0.1, 0.35 * V, 'lowpass', 1400, 300);
      tone(d, 'triangle', 120 * P, 60 * P, t, 0.2 * D, 0.22 * V);
    },
    fire(d, t, P, V, D) {
      hiss(d, t, 0.38 * D, 0.7 * V, 'bandpass', 500 * P, 2400 * P, 1.4, false, 0.04);
      hiss(d, t, 0.3 * D, 0.7 * V, 'bandpass', 3000, 2000, 1, true);
      tone(d, 'sine', 110 * P, 60 * P, t, 0.3 * D, 0.35 * V, 0.02);
    },
    thunder(d, t, P, V, D) {
      hiss(d, t, 0.28 * D, 1.0 * V, 'highpass', 1400, 900, 0.7, true);
      zap(d, t, 0.14 * D, 0.14 * V, 2600 * P, 200 * P);
      tone(d, 'sine', 70, 40, t, 0.3 * D, 0.6 * V, 0.003);
    },
    // Black Hole: a deep falling sub, two low saws beating against each other, a slow
    // inward rush of air and a spit of crackle — and it keeps it up while it lives (loop)
    void(d, t, P, V, D) {
      tone(d, 'sine', 80, 30, t, 1.0 * D, 0.9 * V, 0.03);
      const f = lp(d, 320);
      tone(f, 'sawtooth', 55, 41, t, 0.9 * D, 0.2 * V, 0.05);
      tone(f, 'sawtooth', 56.7, 42, t, 0.9 * D, 0.2 * V, 0.05);
      hiss(d, t, 0.9 * D, 0.6 * V, 'bandpass', 1700, 900, 0.9, true);
      hiss(d, t, 0.55, 0.3 * V, 'bandpass', 300, 2400, 2, false, 0.35);
    },
    dig(d, t, P, V, D) {
      hiss(d, t, 0.12 * D, 0.7 * V, 'lowpass', 1200, 300, 1, true);
      hiss(d, t, 0.08 * D, 0.4 * V, 'lowpass', 800, 200);
      tone(d, 'square', 120 * P, 70 * P, t, 0.08, 0.15 * V);
    },
    beam(d, t, P, V, D) {
      tone(lp(d, 2400), 'sawtooth', 650 * P, 520 * P, t, 0.22 * D, 0.3 * V, 0.005, [34, 40 * P]);
      tone(d, 'sine', 1300 * P, 1100 * P, t, 0.2 * D, 0.28 * V);
      hiss(d, t, 0.18 * D, 0.2 * V, 'bandpass', 3000 * P, 1200 * P, 5);
    },
    spore(d, t, P, V, D) {
      hiss(d, t, 0.18 * D, 0.45 * V, 'bandpass', 1300 * P, 700 * P, 2.5, false, 0.02);
      hiss(d, t + 0.07, 0.14 * D, 0.3 * V, 'bandpass', 1700 * P, 900 * P, 2.5, false, 0.02);
      tone(d, 'sine', 520 * P, 720 * P, t, 0.12, 0.12 * V);
    },
    crystal(d, t, P, V, D) {
      bell(d, 1250 * P, t, 0.7 * D, 0.35 * V);
      hiss(d, t, 0.04, 0.2 * V, 'highpass', 7000, 7000);
    },
    aura(d, t, P, V) {
      [1, 1.26, 1.5].forEach(m => tone(d, 'sine', 330 * P * m, 333 * P * m, t, 0.9, 0.16 * V, 0.25));
      hiss(d, t, 0.8, 0.1 * V, 'highpass', 6000, 9000, 0.7, false, 0.3);
    },
    none() {},
  };
  // one planned shot's sound: its theme, then the stat-driven extras on top
  function playShot(r, x, y, delay) {
    if (r.v === 'none') return;
    // your own gun always gets through the voice cap; a trigger's payload out there may not
    const d = out(x, y, r.v === 'void' ? 1.3 : 0.6, x == null, null, knob('vSpell'));
    if (!d) return;
    const t0 = ac.currentTime + (delay || 0), P = r.pitch * rnd(0.95, 1.05), V = r.vol * 0.55, D = r.dur;
    for (let k = 0; k < r.n; k++) VOICE[r.v](d, t0 + k * 0.018, P * (1 + k * 0.04), V / (1 + k * 0.6), D);
    if (r.wob) tone(d, 'sine', 700 * P, 500 * P, t0, 0.22 * D, 0.13 * V, 0.01, [9, 60]);
    if (r.grit) hiss(d, t0, 0.1, 0.3 * V, 'lowpass', 900, 250, 1, true);
    if (r.bright) tone(d, 'square', 3200, 3000, t0, 0.03, 0.1 * V);
    if (r.boing) tone(d, 'triangle', 500 * P, 1100 * P, t0 + 0.08 * D, 0.07, 0.16 * V);
  }
  // a cast: every shot planned for this pull, but each theme only once (a Myriad of bolts
  // is one bolt sound, louder, not twenty of them on top of each other)
  /** @param {Shot[]} shots @param {number | null} [x] @param {number | null} [y] no x: at you */
  function cast(shots, x, y) {
    const seen = {};
    let k = 0;
    for (const sh of shots) {
      const r = shotSound(sh);
      if (seen[r.v]) { seen[r.v].vol = Math.min(1, seen[r.v].vol + 0.08); continue; }
      if (++k > 4) break;
      seen[r.v] = r;
    }
    let i = 0;
    for (const v in seen) playShot(seen[v], x, y, i++ * 0.012);
  }

  // ---- impacts ----
  /** @param {number} x @param {number} y */
  function hit(x, y) {
    if (!gate('hit', 35)) return;
    const d = out(x, y, 0.2, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    tone(d, 'sine', rnd(240, 290), 110, t, 0.08, 0.4);
    hiss(d, t, 0.06, 0.45, 'bandpass', 1400, 700, 1.5);
  }
  /** @param {number} x @param {number} y */
  function rock(x, y) {
    if (!gate('rock', 45)) return;
    const d = out(x, y, 0.1, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, 0.05, 0.28, 'highpass', 2500, 1800, 0.8, true);
    tone(d, 'square', 180, 120, t, 0.03, 0.05);
  }
  /** @param {number} x @param {number} y */
  function bounce(x, y) {
    if (!gate('bounce', 50)) return;
    const d = out(x, y, 0.1, false, null, knob('vHit')); if (!d) return;
    tone(d, 'triangle', 600, 950, ac.currentTime, 0.06, 0.18);
  }
  // every blast is a little different: its pitch, length, brightness and crackle tail are
  // rolled each time, so a chain of them doesn't sound like one sample on repeat
  /** @param {number} x @param {number} y @param {number} R */
  function boom(x, y, R) {
    const big = R >= 40;
    if (!gate(big ? 'bigboom' : 'boom', big ? 60 : 30)) return;
    const s = clampS(R / 30, 0.3, 3.2), P = rnd(0.82, 1.18), L = rnd(0.85, 1.2);
    const d = out(x, y, 0.8 + 0.6 * s * L, big, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, (0.25 + 0.45 * s) * L, rnd(0.8, 1), 'lowpass', 2600 / Math.pow(s, 0.4) * P, rnd(110, 200), rnd(0.5, 1));
    tone(d, 'sine', 95 / Math.pow(s, 0.2) * P, rnd(26, 36), t, (0.3 + 0.4 * s) * L, 0.9, 0.003);
    if (R >= 18 && Math.random() < 0.85) hiss(d, t + rnd(0.02, 0.08), (0.4 + 0.5 * s) * L, rnd(0.3, 0.5), 'bandpass', rnd(2000, 3000), rnd(900, 1500), 0.8, true);
    if (R >= 60) hiss(d, t + 0.1, 1.6 * L, 0.5, 'lowpass', 300 * P, 80, 0.7, false, 0.2);
  }
  // what a minecart throws about when it goes up: wood and iron clattering down after the bang
  /** @param {number} x @param {number} y */
  function debris(x, y) {
    const d = out(x, y, 1.2, false, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime, n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const tt = t + rnd(0.12, 0.8), metal = Math.random() < 0.4;
      if (metal) tone(d, 'square', rnd(600, 1400), rnd(500, 1200), tt, rnd(0.04, 0.12), rnd(0.03, 0.07));
      hiss(d, tt, rnd(0.02, 0.07), rnd(0.15, 0.4), 'bandpass', rnd(1500, 5000), rnd(1000, 3000), rnd(1, 4), Math.random() < 0.6);
    }
  }
  // a spore pod bursting: a wet pop and a breath of spores, rolled fresh each time
  /** @param {number} x @param {number} y */
  function pop(x, y) {
    const d = out(x, y, 1.2, false, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime, P = rnd(0.8, 1.25);
    tone(d, 'sine', 220 * P, 55 * P, t, rnd(0.12, 0.2), 0.7, 0.003);
    hiss(d, t, rnd(0.06, 0.12), 0.6, 'bandpass', rnd(600, 1300), rnd(250, 500), rnd(1.5, 3));
    hiss(d, t + rnd(0.03, 0.08), rnd(0.6, 1.1), rnd(0.12, 0.2), 'highpass', rnd(2500, 4000), rnd(5000, 7000), 0.7, false, rnd(0.08, 0.2));
    for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(250, 500), rnd(500, 1000), t + rnd(0.05, 0.3), 0.05, 0.1, 0.004);
  }
  // Foliage rustle, strength 0..1. Nothing is fixed: how many leaf-crackles, when they land,
  // their pitch and sharpness, and the swish under them are all rolled every time, so
  // climbing through a heap of vines never repeats itself. The plant sets the range: fungus
  // is soft and low, roots are dry and woody, kelp is wet.
  const RUSTLE = {
    vine: { lo: 1800, hi: 4800, swish: [1400, 4200], wet: 0 },
    myc:  { lo: 900, hi: 2600, swish: [800, 2200], wet: 0 },
    root: { lo: 1200, hi: 3200, swish: [900, 2600], wet: 0, creak: 1 },
    kelp: { lo: 500, hi: 1800, swish: [400, 1400], wet: 1 },
  };
  /** @param {number} x @param {number} y @param {number} str @param {string} [style] */
  function rustle(x, y, str, style) {
    if (!gate('rustle', 60)) return;
    const R = RUSTLE[style] || RUSTLE.vine;
    const d = out(x, y, 0.5, false, null, knob('vWorld')); if (!d) return;
    const t = ac.currentTime, v = clampS(str, 0.2, 1);
    const up = Math.random() < 0.5, a = rnd(R.swish[0], R.swish[1]), b = rnd(R.swish[0], R.swish[1]) * (up ? 1.5 : 0.6);
    hiss(d, t, rnd(0.1, 0.26) * (0.6 + v * 0.6), rnd(0.12, 0.22) * v, 'bandpass', a, b, rnd(0.6, 1.4), false, rnd(0.015, 0.05));
    const n = 2 + Math.floor(Math.random() * (2 + v * 3));
    for (let i = 0; i < n; i++)
      hiss(d, t + rnd(0, 0.2), rnd(0.02, 0.07), rnd(0.1, 0.3) * v, 'bandpass', rnd(R.lo, R.hi), rnd(R.lo, R.hi), rnd(0.8, 2.5), Math.random() < 0.55);
    if (R.wet) tone(d, 'sine', rnd(180, 300), rnd(400, 700), t + rnd(0, 0.1), 0.07, 0.08 * v, 0.004);
    if (R.creak && Math.random() < 0.35) tone(lp(d, 800, 5), 'sawtooth', rnd(110, 160), rnd(90, 130), t, rnd(0.15, 0.3), 0.05 * v, 0.03);
  }
  /** @param {number} x @param {number} y @param {unknown} [big] */
  function arc(x, y, big) {
    if (!gate('arc', big ? 90 : 45)) return;
    const d = out(x, y, 0.35, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, big ? 0.3 : 0.07, big ? 0.8 : 0.45, 'highpass', 2500, 1500, 0.8, true);
    zap(d, t, 0.06, 0.08, 3000, 600);
    if (big) tone(d, 'sine', 90, 40, t, 0.35, 0.5, 0.003);
  }

  // ---- creatures: (k = creature, what = alert|idle|fire|charge|hurt|die|bite|fuse) ----
  /** @param {CreatureKind} k @param {string} what @param {number} x @param {number} y @param {number} [extra] */
  function creature(k, what, x, y, extra) {
    if (what === 'hurt' && !gate('churt', 90)) return;
    if (what === 'idle' && !gate('idle', 250)) return;
    if (what === 'fire' && !gate('cfire', 60)) return;
    const { v, pitch: P } = creatureSound(k);
    const long = what === 'die' || what === 'alert' || what === 'charge';
    const d = out(x, y, long ? 1 : 0.45, false, null,
      knob(what === 'fire' || what === 'charge' || what === 'fuse' ? 'vEnemyFire' : 'vEnemy')); if (!d) return;
    const t = ac.currentTime, R = rnd(0.92, 1.08);
    const clicks = (n, gap, f, pk) => { for (let i = 0; i < n; i++) hiss(d, t + i * gap * rnd(0.7, 1.3), 0.014, pk, 'bandpass', f * rnd(0.85, 1.15), f, 6); };
    const bloop = (tt, f, pk) => tone(d, 'sine', f, f * 2.4, tt, 0.07, pk, 0.004);
    const squelch = pk => { hiss(d, t, 0.22, pk, 'lowpass', 1400, 200, 2); tone(d, 'sine', 260 * P, 60 * P, t, 0.22, pk * 0.8); };
    if (what === 'charge') {                         // a sniper winding up: the warning is the point
      const dur = extra || 0.5;
      tone(d, 'sine', 380 * P, 1700 * P, t, dur, 0.28, dur * 0.8);
      tone(d, 'square', 190 * P, 850 * P, t, dur, 0.04, dur * 0.8);
      return;
    }
    if (what === 'fire') {
      if (v === 'spore') { hiss(d, t, 0.2, 0.5, 'bandpass', 900, 500, 2.5, false, 0.02); tone(d, 'sine', 300, 180, t, 0.12, 0.2); return; }
      if (v === 'icy') { bell(d, 1600 * R, t, 0.5, 0.25); hiss(d, t, 0.15, 0.3, 'highpass', 5000, 3000); return; }
      if (v === 'rattle') { tone(d, 'sine', 420 * R, 240, t, 0.2, 0.4, 0.01); hiss(d, t, 0.18, 0.35, 'bandpass', 900, 400, 2); return; }
      tone(d, 'square', 900 * P * R, 300 * P, t, 0.1, 0.2);            // a goblin's gun: retro pew
      hiss(d, t, 0.06, 0.3, 'bandpass', 2000, 900, 1.2);
      return;
    }
    if (what === 'bite') {
      hiss(d, t, 0.09, 0.6, 'lowpass', 1600, 400, 1.5, true);
      tone(d, 'triangle', 220 * P, 110 * P, t, 0.1, 0.35);
      return;
    }
    if (what === 'fuse') { tone(d, 'square', 1200 * R, 1200 * R, t, 0.04, 0.12); hiss(d, t, 0.1, 0.2, 'highpass', 4000, 4000, 0.7, true); return; }
    const alert = what === 'alert', die = what === 'die', hurtS = what === 'hurt';
    const pk = die ? 0.6 : alert ? 0.5 : hurtS ? 0.35 : 0.22;
    switch (v) {
      case 'gibber': {                               // goblin chatter: squawky square syllables
        if (die) { tone(d, 'square', 600 * P, 120 * P, t, 0.35, 0.18, 0.005, [30, 60]); hiss(d, t, 0.2, 0.25, 'bandpass', 1200, 500, 2); break; }
        if (hurtS) { tone(d, 'square', 700 * P * R, 420 * P, t, 0.07, 0.14); break; }
        const n = alert ? 2 : 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const f = rnd(380, 680) * P, tt = t + i * 0.09;
          tone(lp(d, 2400), 'square', f, alert ? f * 1.6 : f * rnd(0.8, 1.2), tt, 0.08, pk * 0.35, 0.005, [22, 40 * P]);
        }
        break;
      }
      case 'chitter': {                              // spiders and kobolds: dry clicks
        if (die) { clicks(8, 0.025, 3200 * P, 0.4); squelch(0.4); break; }
        clicks(hurtS ? 3 : alert ? 7 : 3, 0.028, 3500 * P * R, pk * 1.4);
        if (alert) tone(d, 'triangle', 1800 * P, 2600 * P, t, 0.12, 0.08);
        break;
      }
      case 'growl': {                                // the big ones: a low, rough growl
        const g = lp(d, 520);
        const len = die ? 0.7 : alert ? 0.55 : hurtS ? 0.18 : 0.35;
        tone(g, 'sawtooth', 95 * P * R, (die ? 45 : 75) * P, t, len, pk * 0.7, 0.04, [13, 9]);
        tone(g, 'sawtooth', 97.5 * P * R, (die ? 46 : 77) * P, t, len, pk * 0.5, 0.04);
        hiss(d, t, len, pk * 0.35, 'lowpass', 500, 250, 1, false, 0.04);
        break;
      }
      case 'slither': {                              // the worm: wet hiss and a thin squeal
        if (die) { tone(d, 'sine', 1400 * P, 300 * P, t, 0.4, 0.2, 0.01, [18, 50]); squelch(0.4); break; }
        hiss(d, t, alert ? 0.4 : 0.25, pk, 'bandpass', 1800 * R, 900, 3, false, 0.03);
        if (alert || hurtS) tone(d, 'sine', 900 * P, 1500 * P, t, 0.15, 0.12, 0.01, [20, 60]);
        break;
      }
      case 'ember':                                  // the fire bomber: gurgle plus embers
        hiss(d, t, 0.3, pk * 0.6, 'bandpass', 2600, 1800, 1, true);
        // falls through to the gurgle
      case 'gurgle': {                               // blobs: wet bubbling
        if (die) { squelch(0.6); bloop(t + 0.05, 180 * P, 0.25); break; }
        const n = alert ? 4 : 2;
        for (let i = 0; i < n; i++) bloop(t + i * rnd(0.05, 0.1), rnd(160, 320) * P, pk * 0.7);
        break;
      }
      case 'spore':                                  // the mushroom: soft puffs
        if (die) { squelch(0.4); break; }
        hiss(d, t, 0.25, pk, 'bandpass', 1100, 600, 2.5, false, 0.03);
        break;
      case 'icy':                                    // the ice skull: glassy
        if (die) { bell(d, 900, t, 1, 0.3); clicks(10, 0.02, 5000, 0.3); break; }
        bell(d, rnd(1800, 2600), t, 0.5, pk * 0.5);
        break;
      case 'rattle':                                 // living bones: rattle and a hollow moan
        clicks(die ? 14 : alert ? 8 : 5, 0.022, 2300 * R, pk * 1.2);
        if (alert || die) tone(d, 'sine', 330 * R, die ? 160 : 300, t, die ? 0.9 : 0.6, 0.14, 0.2, [5, 12]);
        break;
    }
  }

  // ---- you: pickups, the shop, damage, the portal ----
  let coinStreak = 0, coinT = 0;
  /** @param {string} what */
  function ui(what) {
    if (what === 'hurt' && !gate('phurt', 120)) return;
    if (what === 'empty' && !gate('empty', 250)) return;
    const d = out(null, null, 1.3, true, null, knob(what === 'sputter' ? 'jetVol' : 'vUi')); if (!d) return;
    const t = ac.currentTime;
    const arp = (notes, gap, type, pk, len) => notes.forEach((f, i) => tone(d, type, f, f, t + i * gap, len || 0.14, pk, 0.004));
    switch (what) {
      case 'coin': {
        const n = now();
        coinStreak = n - coinT < 600 ? Math.min(coinStreak + 1, 14) : 0; coinT = n;
        const s = Math.pow(1.06, coinStreak);
        tone(d, 'triangle', 1568 * s, 1568 * s, t, 0.06, 0.2, 0.002);
        tone(d, 'square', 2093 * s, 2093 * s, t + 0.05, 0.12, 0.07, 0.002);
        break;
      }
      case 'mod': arp([523, 659, 784, 1047], 0.055, 'triangle', 0.25); bell(d, 2093, t + 0.22, 0.5, 0.08); break;
      case 'gun':
        arp([196, 294, 392], 0.06, 'square', 0.08);
        hiss(d, t, 0.03, 0.4, 'bandpass', 4000, 4000, 3); hiss(d, t + 0.09, 0.03, 0.4, 'bandpass', 3000, 3000, 3);
        break;
      case 'buy':
        [0, 0.05, 0.1].forEach(o => tone(d, 'triangle', 1568 + o * 3000, 1568 + o * 3000, t + o, 0.06, 0.15, 0.002));
        arp([392, 523, 659], 0.06, 'triangle', 0.2, 0.18);
        break;
      case 'poor': tone(d, 'square', 180, 150, t, 0.14, 0.12); tone(d, 'square', 140, 120, t + 0.12, 0.16, 0.12); break;
      case 'heal':
        tone(d, 'sine', 400, 900, t, 0.45, 0.3, 0.05, [7, 15]);
        hiss(d, t, 0.5, 0.1, 'highpass', 6000, 9000, 0.7, false, 0.2);
        break;
      case 'perk':
        [523, 659, 784, 988, 1319].forEach((f, i) => bell(d, f, t + i * 0.09, 0.8, 0.14));
        [262, 330, 392].forEach(f => tone(d, 'sine', f, f, t + 0.1, 1.1, 0.1, 0.2));
        break;
      case 'heart':
        tone(d, 'sine', 90, 55, t, 0.12, 0.7); tone(d, 'sine', 90, 55, t + 0.2, 0.14, 0.6);
        [330, 415, 494].forEach(f => tone(d, 'sine', f, f, t + 0.35, 0.9, 0.12, 0.15));
        break;
      case 'portal':
        hiss(d, t, 0.9, 0.35, 'bandpass', 200, 3000, 3, false, 0.3);
        tone(d, 'sine', 150, 600, t, 0.8, 0.3, 0.2, [6, 10]);
        bell(d, 1047, t + 0.6, 0.9, 0.12);
        break;
      case 'hurt':
        tone(d, 'square', 300, 120, t, 0.14, 0.14);
        hiss(d, t, 0.1, 0.35, 'lowpass', 1500, 300, 1);
        tone(d, 'sine', 110, 60, t, 0.12, 0.5);
        break;
      case 'shield': bell(d, 1500, t, 0.4, 0.2); hiss(d, t, 0.1, 0.2, 'highpass', 5000, 3000); break;
      case 'die':
        tone(lp(d, 1400), 'sawtooth', 440, 40, t, 1.2, 0.3, 0.01, [8, 20]);
        hiss(d, t, 0.5, 0.4, 'lowpass', 1600, 150, 1);
        tone(d, 'sine', 120, 35, t, 0.8, 0.6);
        break;
      case 'revive': arp([262, 392, 523, 784, 1047], 0.07, 'triangle', 0.25, 0.2); break;
      case 'empty': tone(d, 'square', 110, 90, t, 0.05, 0.12); hiss(d, t, 0.02, 0.2, 'highpass', 3000, 3000); break;
      case 'sputter': for (let i = 0; i < 4; i++) hiss(d, t + i * 0.07, 0.05, 0.3, 'bandpass', 700, 400, 2, true); break;
      case 'beat': tone(d, 'sine', 70, 45, t, 0.1, 0.45); tone(d, 'sine', 70, 45, t + 0.16, 0.1, 0.3); break;
    }
  }

  // ---- everything else: one table of small sounds, each rolled fresh every time it plays.
  // fx(name, x, y, a): x == null plays it at you; `a` is whatever that sound needs (a surface,
  // a material, a strength). Each has its own minimum gap so a burst of them can't pile up.
  const FX_GAP = { whoosh: 140, step: 60, land: 90, fizzle: 70, absorb: 80, crit: 60, chainhop: 50, coverHit: 60,
    coinland: 60, healtick: 350, drip: 90, sizzle: 90, splash: 110, sparks: 120, steam: 200, whirl: 400,
    prompt: 150, reelThud: 60, reelTick: 45, place: 60, switch: 80, ready: 150, shatter: 40, ignite: 300, open: 150, close: 150 };
  // a footstep or landing, by what you're standing on
  function surfaceHit(d, t, surf, v) {
    switch (surf) {
      case 'snow': hiss(d, t, rnd(0.07, 0.12), 0.45 * v, 'lowpass', rnd(2200, 3000), rnd(600, 900), 1, true); break;
      case 'ice':
        tone(d, 'sine', rnd(1800, 2600), rnd(1400, 2000), t, rnd(0.03, 0.06), 0.06 * v);
        hiss(d, t, 0.03, 0.2 * v, 'highpass', 4000, 3000, 0.8, true);
        break;
      case 'slime':
        hiss(d, t, rnd(0.08, 0.13), 0.4 * v, 'lowpass', rnd(800, 1100), 250, 2);
        tone(d, 'sine', rnd(160, 220), rnd(400, 600), t + 0.02, 0.06, 0.12 * v, 0.004);
        break;
      case 'puddle':
        hiss(d, t, rnd(0.1, 0.16), 0.45 * v, 'bandpass', rnd(1300, 1900), rnd(500, 800), 1.2);
        tone(d, 'sine', rnd(250, 400), rnd(600, 900), t + rnd(0.02, 0.06), 0.05, 0.1 * v, 0.004);
        break;
      case 'ash': hiss(d, t, rnd(0.08, 0.14), 0.3 * v, 'lowpass', rnd(900, 1400), 400, 0.8, false, 0.01); break;
      case 'glass':
        hiss(d, t, 0.05, 0.3 * v, 'highpass', 4000, 3500, 0.8, true);
        for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(3500, 6000), rnd(3500, 6000), t + rnd(0, 0.05), 0.03, 0.05 * v, 0.002);
        break;
      case 'log': case 'acid': hiss(d, t, rnd(0.15, 0.25), 0.25 * v, 'highpass', rnd(2500, 3500), 4000, 0.7, true); break;
      default:                                        // bare rock: a gritty scuff
        hiss(d, t, rnd(0.03, 0.06), 0.35 * v, 'bandpass', rnd(700, 1500), rnd(500, 900), rnd(0.8, 1.6), Math.random() < 0.6);
        tone(d, 'sine', rnd(90, 120), 60, t, 0.04, 0.2 * v);
    }
  }
  function tinkles(d, t, n, lo, hi, pk, spread) {
    for (let i = 0; i < n; i++) tone(d, 'sine', rnd(lo, hi), rnd(lo, hi) * rnd(0.9, 1.05), t + rnd(0, spread), rnd(0.04, 0.12), pk * rnd(0.5, 1), 0.002);
  }
  const FX = {
    // stepping into the exit: the air is drawn in, a falling shimmer, and a soft whump
    portalIn(d, t) {
      hiss(d, t, 0.7, 0.4, 'bandpass', rnd(2800, 3600), rnd(180, 260), 2.5, false, 0.45);
      tone(d, 'sine', rnd(850, 1000), rnd(110, 140), t, 0.75, 0.25, 0.05, [rnd(5, 8), 18]);
      [1568, 1319, 1047, 784].forEach((f, i) => bell(d, f * rnd(0.98, 1.02), t + 0.08 * i, 0.5, 0.08));
      tone(d, 'sine', rnd(75, 90), 38, t + 0.62, 0.35, 0.7, 0.01);
      hiss(d, t + 0.62, 0.3, 0.3, 'lowpass', 700, 150, 0.8);
    },
    // coming out of the way-in: an exhale of air and a rising sparkle
    portalOut(d, t) {
      hiss(d, t, 0.9, 0.35, 'bandpass', rnd(250, 350), rnd(2200, 3000), 2, false, 0.03);
      const notes = [523, 659, 784, 988, 1175, 1319];
      for (let i = 0; i < 4; i++) bell(d, notes[Math.floor(Math.random() * notes.length)] * 2, t + 0.12 + i * rnd(0.06, 0.1), 0.6, 0.06);
      tone(d, 'sine', rnd(180, 220), rnd(450, 550), t, 0.5, 0.15, 0.1);
    },
    // the shop's emergency alarm: a two-tone klaxon, once a cycle
    alarm(d, t) {
      tone(d, 'square', 620, 620, t, 0.32, 0.05, 0.02);
      tone(d, 'square', 470, 470, t + 0.34, 0.32, 0.05, 0.02);
    },
    // a whole level teleporting in or out over the shop: a crackle of lightning, a rising
    // whine and a deep thump
    levelWarp(d, t) {
      hiss(d, t, 1.1, 0.45, 'highpass', 3500, 2000, 0.8, true);
      for (let i = 0; i < 9; i++) zap(d, t + i * rnd(0.06, 0.12), rnd(0.05, 0.14), 0.11, rnd(2500, 4500), rnd(300, 900));
      tone(d, 'sine', rnd(180, 220), rnd(1400, 1700), t, 0.5, 0.15, 0.05);
      tone(d, 'sine', rnd(70, 85), 35, t, 0.6, 0.8, 0.01);
      hiss(d, t, 0.5, 0.4, 'lowpass', 900, 120, 0.8);
    },
    step(d, t, surf) { surfaceHit(d, t, surf, rnd(0.55, 0.8)); },
    land(d, t, a) {
      const v = clampS((a.v - 150) / 500, 0.35, 1);
      tone(d, 'sine', rnd(100, 140), rnd(40, 55), t, 0.1 + 0.08 * v, 0.7 * v, 0.003);
      surfaceHit(d, t, a.s, v * 1.2);
      if (v > 0.6 && (!a.s || a.s === 'rock')) hiss(d, t + 0.03, 0.2, 0.25 * v, 'lowpass', 1600, 400, 1, true);
    },
    ignite(d, t) {
      hiss(d, t, rnd(0.12, 0.2), 0.45, 'bandpass', rnd(300, 450), rnd(1000, 1400), 1.2, true);
      hiss(d, t, 0.08, 0.3, 'lowpass', 900, 300);
    },
    switch(d, t) {
      tone(d, 'square', rnd(1600, 2000), 1400, t, 0.02, 0.05);
      hiss(d, t, 0.03, 0.3, 'bandpass', rnd(2500, 3500), 2500, 3);
      hiss(d, t + rnd(0.06, 0.09), 0.03, 0.3, 'bandpass', rnd(1800, 2400), 1800, 3);
      tone(d, 'sine', 220, 160, t + 0.07, 0.04, 0.12);
    },
    ready(d, t) { tone(d, 'triangle', 1320 * rnd(0.98, 1.02), 1320, t, 0.04, 0.07); tone(d, 'triangle', 1760 * rnd(0.98, 1.02), 1760, t + 0.045, 0.06, 0.06); },
    open(d, t) { hiss(d, t, rnd(0.1, 0.15), 0.18, 'bandpass', rnd(900, 1300), rnd(2200, 2800), 1.5, false, 0.03); tone(d, 'sine', 700, 900, t, 0.04, 0.06); },
    close(d, t) { hiss(d, t, rnd(0.1, 0.15), 0.18, 'bandpass', rnd(2200, 2800), rnd(900, 1300), 1.5, false, 0.03); tone(d, 'sine', 900, 700, t, 0.04, 0.06); },
    // a slot-machine reel locking into place (the gun machine): a low thump and a latch click
    reelThud(d, t) { tone(d, 'sine', rnd(110, 130), 45, t, 0.16, 0.9, 0.003); hiss(d, t, 0.05, 0.35, 'lowpass', 700, 200, 1); tone(d, 'square', rnd(1500, 1800), 1200, t + 0.01, 0.02, 0.06); },
    // a reel spinning past one gun
    reelTick(d, t) { tone(d, 'triangle', rnd(2200, 2600), 1800, t, 0.015, 0.05); },
    place(d, t) { tone(d, 'triangle', rnd(850, 1000), 700, t, 0.03, 0.12); tone(d, 'sine', rnd(180, 220), 120, t, 0.06, 0.25); },
    prompt(d, t) { tone(d, 'sine', 1047 * rnd(0.98, 1.02), 1047, t, 0.06, 0.07); tone(d, 'sine', 1568, 1568, t + 0.05, 0.08, 0.05); },
    // something breaking. a = what it's made of
    shatter(d, t, m) {
      if (m === 'ice' || m === 'glass') {
        hiss(d, t, 0.06, 0.5, 'highpass', 3000, 2000, 0.8, true);
        tinkles(d, t + 0.01, 6 + Math.floor(Math.random() * 7), 2500, 6500, 0.12, 0.35);
      } else if (m === 'crystal') {
        hiss(d, t, 0.08, 0.4, 'highpass', 2500, 1500, 0.8, true);
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) bell(d, rnd(1400, 3400), t + rnd(0, 0.25), rnd(0.4, 0.8), 0.08);
      } else if (m === 'salt') {
        hiss(d, t, rnd(0.15, 0.25), 0.45, 'highpass', 2500, 1800, 0.9, true);
        tinkles(d, t, 3, 3000, 5000, 0.07, 0.15);
      } else if (m === 'bone') {
        hiss(d, t, 0.04, 0.4, 'bandpass', 2200, 1500, 2, true);
        for (let i = 0; i < 8; i++) hiss(d, t + rnd(0.02, 0.35), 0.015, rnd(0.15, 0.35), 'bandpass', rnd(1500, 3200), 1500, 5);
      } else {                                        // stone: a crumble and falling rubble
        hiss(d, t, rnd(0.4, 0.6), 0.6, 'lowpass', rnd(800, 1100), 150, 0.8, true);
        tone(d, 'sine', rnd(90, 120), 40, t, 0.3, 0.6, 0.004);
        for (let i = 0; i < 5; i++) tone(d, 'sine', rnd(120, 220), 60, t + rnd(0.1, 0.5), 0.06, rnd(0.1, 0.25), 0.003);
      }
    },
    coverHit(d, t) { tone(d, 'sine', rnd(160, 210), 90, t, 0.06, 0.4); hiss(d, t, 0.05, 0.3, 'bandpass', rnd(900, 1500), 600, 1.5, true); },
    iceCreak(d, t) {
      hiss(d, t, 0.3, 0.3, 'highpass', 2200, 1500, 0.8, true, 0.02);
      for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(2600, 3400), rnd(1200, 1800), t + i * rnd(0.07, 0.12), 0.05, 0.05);
    },
    propLand(d, t) { tone(d, 'sine', rnd(110, 150), 50, t, 0.1, 0.4); hiss(d, t, 0.08, 0.3, 'lowpass', 1200, 300, 1, true); },
    skulls(d, t) {
      hiss(d, t, rnd(0.12, 0.18), 0.5, 'lowpass', 1800, 600, 1, true);
      for (let i = 0; i < 7; i++) hiss(d, t + rnd(0.02, 0.4), 0.015, rnd(0.15, 0.35), 'bandpass', rnd(1600, 3000), 1600, 5);
    },
    resonate(d, t) {                                  // a resonance stone: a long, shivering gong
      const f = rnd(170, 260);
      bell(d, f, t, 2.4, 0.35);
      tone(d, 'sine', f * 1.005, f, t, 2.2, 0.15, 0.02, [rnd(4, 7), 3]);
    },
    ventWarn(d, t) {
      hiss(d, t, 0.75, 0.3, 'highpass', rnd(1500, 2200), rnd(3500, 4500), 0.8, false, 0.55);
      tone(d, 'sine', 55, 70, t, 0.7, 0.15, 0.5);
    },
    ventFire(d, t) {
      hiss(d, t, rnd(0.9, 1.1), 0.7, 'bandpass', rnd(350, 450), rnd(800, 1000), 0.9, false, 0.04);
      hiss(d, t, 0.9, 0.5, 'bandpass', 2600, 2000, 1, true, 0.05);
      tone(d, 'sine', rnd(60, 75), 50, t, 0.9, 0.35, 0.05);
    },
    shroom(d, t) {
      tone(d, 'sine', rnd(130, 190), rnd(480, 720), t, rnd(0.15, 0.22), 0.5, 0.004);
      hiss(d, t, 0.08, 0.3, 'lowpass', 800, 300, 2);
    },
    lash(d, t) { hiss(d, t, 0.09, 0.45, 'highpass', rnd(1200, 1800), rnd(5000, 7000), 0.8, false, 0.06); hiss(d, t + 0.09, 0.03, 0.5, 'bandpass', 3000, 2000, 1.5, true); },
    eyes(d, t) {
      for (let i = 0; i < 3; i++) hiss(d, t + i * rnd(0.1, 0.18), rnd(0.08, 0.14), 0.12, 'bandpass', rnd(900, 1500) * (1 + i * 0.25), rnd(1500, 2400), 8, false, 0.03);
    },
    sparks(d, t) { hiss(d, t, rnd(0.1, 0.2), 0.4, 'highpass', 3000, 2200, 0.8, true); zap(d, t, 0.05, 0.05, 4000, 1500); },
    steam(d, t) { hiss(d, t, rnd(0.3, 0.8), rnd(0.15, 0.25), 'highpass', rnd(2500, 3500), rnd(3000, 5000), 0.7, false, rnd(0.03, 0.1)); },
    drip(d, t) { const f = rnd(1300, 2400); tone(d, 'sine', f, f * rnd(1.4, 1.8), t, 0.05, 0.09, 0.002); },
    sizzle(d, t) { hiss(d, t, rnd(0.2, 0.35), 0.35, 'highpass', rnd(2500, 3500), 4500, 0.7, true); tone(d, 'sine', rnd(200, 300), 120, t, 0.05, 0.1); },
    splash(d, t) { hiss(d, t, rnd(0.06, 0.12), 0.25, 'bandpass', rnd(1000, 2500), rnd(600, 1200), 1.2); },
    whirl(d, t) {
      hiss(d, t, 1.1, 0.25, 'bandpass', rnd(350, 500), rnd(1300, 1700), 3, false, 0.45);
      hiss(d, t + 0.3, 0.9, 0.15, 'bandpass', rnd(1300, 1700), rnd(350, 500), 3, false, 0.3);
    },
    fizzle(d, t) { hiss(d, t, 0.05, 0.25, 'highpass', 3000, 2000, 0.8, true); tone(d, 'sine', rnd(700, 900), 300, t, 0.04, 0.08); },
    absorb(d, t) { tone(d, 'sine', rnd(500, 700), rnd(1200, 1600), t, 0.08, 0.2); hiss(d, t, 0.1, 0.15, 'highpass', 5000, 8000, 0.7); },
    crit(d, t) { tone(d, 'triangle', rnd(1900, 2100), 2700, t, 0.08, 0.2); tone(d, 'square', 4000, 4200, t, 0.03, 0.06); },
    chainhop(d, t) { zap(d, t, 0.06, 0.1, 3500, 900); hiss(d, t, 0.06, 0.35, 'highpass', 2500, 1800, 0.8, true); },
    split(d, t) { tone(d, 'sine', 1200, rnd(1700, 2000), t, 0.1, 0.18); tone(d, 'sine', 1200, rnd(800, 950), t, 0.1, 0.18); },
    cluster(d, t) { for (let i = 0; i < 4; i++) tone(d, 'sine', rnd(250, 450), rnd(80, 120), t + rnd(0, 0.12), 0.06, 0.3, 0.003); },
    refresh(d, t) { tone(lp(d, 1400), 'sawtooth', rnd(200, 260), rnd(1000, 1300), t, 0.3, 0.2, 0.02); bell(d, 1760, t + 0.28, 0.5, 0.1); },
    warp(d, t) { tone(d, 'sine', 2000, 250, t, 0.12, 0.2); tone(d, 'sine', 250, 2000, t + 0.04, 0.12, 0.15); hiss(d, t, 0.15, 0.15, 'bandpass', 1500, 4000, 3); },
    saws(d, t) { for (let i = 0; i < 3; i++) hiss(d, t + i * 0.05, 0.15, 0.3, 'bandpass', rnd(5000, 7000), 3500, 4); tone(d, 'square', 2200, 1800, t, 0.2, 0.06); },
    gspend(d, t) { for (let i = 0; i < 3; i++) tone(d, 'triangle', 2093 - i * 300, 1800 - i * 300, t + i * 0.05, 0.06, 0.12, 0.002); },
    drain(d, t) { tone(d, 'sine', rnd(800, 1000), 200, t, 0.3, 0.2, 0.01, [14, 40]); },
    healtick(d, t) { tone(d, 'sine', 880 * rnd(0.98, 1.02), 880, t, 0.15, 0.08, 0.01); tone(d, 'sine', 1320, 1320, t + 0.05, 0.15, 0.05, 0.01); },
    ghost(d, t) { tone(d, 'sine', rnd(1300, 1500), rnd(650, 750), t, 0.14, 0.12, 0.01, [20, 30]); hiss(d, t, 0.1, 0.08, 'bandpass', 2000, 1200, 3, false, 0.02); },
    shieldUp(d, t) { bell(d, 1760, t, 0.5, 0.1); hiss(d, t, 0.25, 0.07, 'highpass', 6000, 9000, 0.7, false, 0.1); },
    whoosh(d, t) {                                             // something catching fire
      hiss(d, t, rnd(0.3, 0.5), rnd(0.35, 0.5), 'bandpass', rnd(280, 450), rnd(1300, 2200), 0.7, false, rnd(0.03, 0.08));
      hiss(d, t + rnd(0.03, 0.08), rnd(0.2, 0.35), 0.25, 'highpass', rnd(2200, 3000), 3600, 0.7, true);
    },
    // a fluorescent tube catching: a click and a short mains buzz
    tube(d, t) {
      hiss(d, t, 0.02, 0.5, 'highpass', 3000, 2500, 0.8, true);
      tone(d, 'square', rnd(98, 102), rnd(98, 102), t, rnd(0.06, 0.14), 0.05, 0.002);
      tone(d, 'sine', rnd(195, 205), rnd(195, 205), t, rnd(0.08, 0.16), 0.08, 0.002);
    },
    coinland(d, t) { tone(d, 'sine', rnd(2600, 3600), rnd(2600, 3600), t, 0.04, 0.08, 0.002); },
  };
  /** @param {string} name @param {number | null} [x] @param {number | null} [y] no x: at you @param {number | string | { v: number, s?: string }} [a] what the recipe takes (a size, a material, a landing) */
  function fx(name, x, y, a) {
    const f = FX[name];
    if (!f || !gate('fx:' + name, FX_GAP[name] || 40)) return;
    const d = out(x, y, name === 'resonate' ? 2.6 : 1.2, x == null, null, knob(fxVolKey(name))); if (!d) return;
    f(d, ac.currentTime, a);
  }

  // ---- loops: the jetpack, and a Black Hole while it lives. set() every frame you want it;
  // tick() fades any loop nobody set this frame (a pause, a dead bullet) ----
  /** @param {string} kind */
  function loop(kind) {
    if (!live() || loops.size > 8) return null;
    const g = ac.createGain(); g.gain.value = 0;
    let pn = null;
    if (ac.createStereoPanner) { pn = ac.createStereoPanner(); g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus);
    const srcs = [];
    const noise = (crackle, type, f, q, gain) => {
      const s = ac.createBufferSource(); s.buffer = crackle ? crackBuf : noiseBuf; s.loop = true;
      const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = ac.createGain(); gg.gain.value = gain;
      s.connect(fl); fl.connect(gg); gg.connect(g); s.start(0, Math.random() * 1.5); srcs.push(s);
      return fl;
    };
    const osc = (type, f, gain, dest) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const gg = ac.createGain(); gg.gain.value = gain; o.connect(gg); gg.connect(dest || g); o.start(); srcs.push(o);
      return o;
    };
    let jetF = null;
    if (kind === 'jet') {
      jetF = noise(false, 'bandpass', 700, 0.9, 1.2);         // the roar
      noise(true, 'bandpass', 1800, 0.8, 0.5);                // and the spit of the flame
    } else if (kind === 'portal') {                            // the exit's hum: two beating tones and a shimmer
      const trem = ac.createGain(); trem.gain.value = 0.7; trem.connect(g);
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.6; lg.gain.value = 0.3;
      l.connect(lg); lg.connect(trem.gain); l.start(); srcs.push(l);
      osc('sine', 110, 0.35, trem); osc('sine', 165.7, 0.25, trem); osc('triangle', 220.4, 0.06, trem);
      noise(false, 'bandpass', 1600, 7, 0.5);
    } else if (kind === 'fire') {                              // a blaze: crackle over a low roar
      noise(true, 'highpass', 1500, 0.7, 0.8);
      noise(true, 'bandpass', 650, 0.8, 0.55);
      noise(false, 'lowpass', 260, 0.7, 0.9);
    } else if (kind === 'matter') {                            // dark matter: a low, uneasy warble
      osc('sine', 68, 0.5); osc('sine', 71.5, 0.5);
      const f = noise(false, 'bandpass', 300, 3, 0.6);
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.35; lg.gain.value = 180;
      l.connect(lg); lg.connect(f.frequency); l.start(); srcs.push(l);
    } else {                                                   // 'void'
      osc('sine', 42, 0.9);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.connect(g);
      osc('sawtooth', 55, 0.25, f); osc('sawtooth', 56.3, 0.25, f);
      noise(true, 'bandpass', 1800, 0.9, 0.8);
      noise(false, 'bandpass', 480, 2, 0.35);
    }
    const h = {
      last: now(),
      set(level, x, y, pitch) {
        h.last = now();
        let v = level * knob(kind === 'jet' ? 'jetVol' : kind === 'void' ? 'vSpell' : 'vWorld'), pan = 0;
        if (x != null) {
          const dx = x - ear.x, d = Math.hypot(dx, y - ear.y);
          v *= d > HEAR ? 0 : 1 / (1 + (d / 170) * (d / 170));
          pan = clampS(dx / 260, -0.85, 0.85);
        }
        g.gain.setTargetAtTime(v, ac.currentTime, jetF ? 0.012 : 0.05);   // the jet cuts out sharp
        if (pn) pn.pan.setTargetAtTime(pan, ac.currentTime, 0.05);
        if (jetF) jetF.frequency.setTargetAtTime(pitch ? 500 * pitch : 500 + 700 * level, ac.currentTime, 0.05);
      },
      stop() {
        loops.delete(h);
        try { g.gain.setTargetAtTime(0, ac.currentTime, 0.06); } catch (_) {}
        setTimeout(() => { for (const s of srcs) try { s.stop(); } catch (_) {} try { g.disconnect(); } catch (_) {} }, 400);
      },
    };
    loops.add(h);
    return h;
  }

  // ---- ambience: the floor's bed and drone, and its one-shots going off round you ----
  /** @param {string} name */
  function setAmbience(name) {
    ambWant = name;
    if (!live()) return;
    if (amb) {
      const old = amb; amb = null;
      old.g.gain.setTargetAtTime(0, ac.currentTime, 0.6);
      setTimeout(() => old.srcs.forEach(s => { try { s.stop(); } catch (_) {} }), 3000);
    }
    const A = AMBIENCE[name];
    if (!A) return;
    const g = ac.createGain(); g.gain.value = 0; g.connect(ambBus);
    g.gain.setTargetAtTime(1, ac.currentTime, 1.2);
    const srcs = [];
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = A.bed[0]; f.Q.value = 0.7;
    // the bed breathes: a very slow wobble on its brightness
    const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.07; lg.gain.value = A.bed[0] * 0.45;
    l.connect(lg); lg.connect(f.frequency); l.start();
    const bg = ac.createGain(); bg.gain.value = A.bed[1];
    s.connect(f); f.connect(bg); bg.connect(g); s.start();
    srcs.push(s, l);
    if (A.drone) for (const [m, pk] of [[1, 0.035], [1.5, 0.012]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = A.drone * m;
      const og = ac.createGain(); og.gain.value = pk; o.connect(og); og.connect(g); o.start(); srcs.push(o);
    }
    amb = { g, srcs, A, name };
  }
  /** @param {string} kind @param {number} x @param {number} y */
  function envSound(kind, x, y) {
    // the ambience's drips and trickles also answer to the Drips knob
    const d = out(x, y, 2.5, false, ambBus, kind === 'drip' || kind === 'trickle' ? knob('vDrip') : 1); if (!d) return;
    const t = ac.currentTime;
    switch (kind) {
      case 'drip': { const f = rnd(1300, 2200); tone(d, 'sine', f, f * 1.6, t, 0.05, 0.15, 0.002); tone(d, 'sine', f, f * 1.6, t + 0.2, 0.05, 0.035, 0.002); break; }
      case 'critter': for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(3000, 4200), rnd(3000, 4200), t + i * 0.07, 0.03, 0.08, 0.003); break;
      case 'wind': hiss(d, t, 2.2, 0.3, 'bandpass', rnd(300, 500), rnd(700, 1000), 1.5, false, 0.8); break;
      case 'trickle': for (let i = 0; i < 9; i++) tone(d, 'triangle', rnd(1500, 3200), rnd(1200, 2600), t + rnd(0, 0.8), 0.025, 0.07, 0.002); break;
      case 'rumble': hiss(d, t, 2, 0.6, 'lowpass', 180, 90, 0.7, false, 0.5); tone(d, 'sine', 38, 32, t, 1.8, 0.25, 0.5); break;
      case 'creak': tone(lp(d, 900, 6), 'sawtooth', rnd(80, 110), rnd(60, 80), t, 0.9, 0.22, 0.15, [5, 6]); break;
      case 'chime': bell(d, rnd(1800, 3000), t, 1.4, 0.12); break;
      case 'crack': hiss(d, t, 0.08, 0.35, 'highpass', 3000, 2000, 0.8, true); tone(d, 'sine', 2800, 900, t, 0.12, 0.1); break;
      case 'crackle': hiss(d, t, rnd(0.3, 0.7), 0.35, 'bandpass', 2600, 2000, 1, true); break;
      case 'hiss': hiss(d, t, 1, 0.13, 'highpass', 3000, 4500, 0.7, false, 0.35); break;
      case 'puff': hiss(d, t, 0.35, 0.28, 'bandpass', 900, 500, 2.5, false, 0.06); break;
      case 'bloop': tone(d, 'sine', 200, 520, t, 0.1, 0.18, 0.005); tone(d, 'sine', 260, 640, t + 0.13, 0.08, 0.12, 0.005); break;
      case 'hum': tone(d, 'sine', 110, 112, t, 2.2, 0.08, 0.9); tone(d, 'sine', 165, 166, t, 2.2, 0.05, 0.9); break;
      case 'clank': tone(d, 'square', 300, 290, t, 0.3, 0.06); tone(d, 'square', 447, 440, t, 0.25, 0.05); hiss(d, t, 0.05, 0.3, 'bandpass', 3000, 3000, 4); break;
      case 'rattle': for (let i = 0; i < 6; i++) hiss(d, t + i * rnd(0.03, 0.05), 0.012, 0.25, 'bandpass', 2500, 2500, 6); break;
      case 'whisper':
        hiss(d, t, 1.4, 0.12, 'bandpass', 1200, 2400, 6, false, 0.5);
        hiss(d, t + 0.2, 1.2, 0.08, 'bandpass', 1800, 1000, 6, false, 0.5);
        break;
    }
  }
  // called every frame the game runs: each of the floor's one-shots rolls its dice, and
  // what goes off lands somewhere round you, off to one side or the other
  /** @param {number} dt */
  function ambTick(dt) {
    if (!amb || !live()) return;
    for (const k in amb.A.ev) if (Math.random() < amb.A.ev[k] * dt) {
      const a = Math.random() * Math.PI * 2, r = rnd(80, 320);
      envSound(k, ear.x + Math.cos(a) * r, ear.y + Math.sin(a) * r * 0.6);
    }
  }
  // every frame, running or paused: the volume knobs, and silence for loops nobody is feeding
  function tick() {
    if (!ac) return;
    sfxBus.gain.value = DEV.vol; ambBus.gain.value = DEV.vol * DEV.amb;
    // unlocking finishes a moment after the tap, so the floor's ambience starts from here
    if (ambWant && !amb && live()) setAmbience(ambWant);
    const t = now();
    for (const h of loops) if (t - h.last > 100) { try { h.set(0); } catch (_) {} }
  }

  return {
    unlock, tick: safe(tick), ear: (x, y) => { ear.x = x; ear.y = y; },
    cast: safe(cast), hit: safe(hit), rock: safe(rock), bounce: safe(bounce), boom: safe(boom), arc: safe(arc),
    debris: safe(debris), pop: safe(pop), rustle: safe(rustle), fx: safe(fx), FX_NAMES: Object.keys(FX),
    creature: safe(creature), ui: safe(ui), loop: safe(loop), setAmbience: safe(setAmbience),
    ambTick: safe(ambTick), env: safe(envSound), stats,
    // everything you hear, as a stream as well (the Witness video export records it); null without sound
    stream: () => {
      try {
        if (!ac || !ac.createMediaStreamDestination) return null;
        if (!tap) { tap = ac.createMediaStreamDestination(); comp.connect(tap); }
        if (ac.state === 'suspended') ac.resume();
        return tap.stream;
      } catch (_) { return null; }
    },
    get ready() { return !!live(); },
    get ambience() { return amb ? amb.name : null; },
    get loops() { return loops.size; },
  };
})();
