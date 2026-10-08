// @ts-check
// The music's synths (v0.0.174): they play audio/song.js. makeMusic(ac, dest) builds the instruments on any audio
// context (the game's, or an offline one that renders the song to a file: tools/musicwav.js); Music plays the
// title's track live on the engine's music bus (SFX.musicOut, the settings' Music slider), a few steps ahead.
// No files: an 80s kick (a falling sine), a snare and hats of noise, a pumping bass (saw + square, a filter
// snap; the pads and bass duck under every kick), detuned saw pads, a plucked arpeggio, and the guitar: two
// saws through a hard clip, a mid boost and a speaker's roll-off, bent into some notes, vibrato on long ones.
// Reverb and a dotted-8th echo, both made here.

import { SFX } from './sfx.js';
import { STEP_SEC, midiHz, songStep } from './song.js';

/** @param {BaseAudioContext} ac @param {AudioNode} dest */
export function makeMusic(ac, dest) {
  const mix = ac.createGain(); mix.gain.value = 0.55; mix.connect(dest);
  // the noise every drum is cut from
  const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  // reverb: 2.4 s of decaying stereo noise
  const rv = ac.createConvolver(), rl = Math.floor(ac.sampleRate * 2.4), ir = ac.createBuffer(2, rl, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3); }
  rv.buffer = ir;
  const rvOut = ac.createGain(); rvOut.gain.value = 0.32; rv.connect(rvOut); rvOut.connect(mix);
  // echo: a dotted 8th, darkening as it repeats
  const dl = ac.createDelay(2); dl.delayTime.value = STEP_SEC * 3;
  const fb = ac.createGain(); fb.gain.value = 0.38;
  const dlf = ac.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2400;
  dl.connect(dlf); dlf.connect(fb); fb.connect(dl);
  const dlOut = ac.createGain(); dlOut.gain.value = 0.35; dlf.connect(dlOut); dlOut.connect(mix); dlOut.connect(rv);
  // the pump: the pads and bass duck under every kick
  const pump = ac.createGain(); pump.connect(mix);
  // the guitar's clip curve
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 9) * 0.8; }

  /** @param {AudioNode} to @param {number} pan */
  const panned = (to, pan) => {
    if (!pan || !ac.createStereoPanner) return to;
    const p = ac.createStereoPanner(); p.pan.value = pan; p.connect(to); return p;
  };
  /** @param {AudioParam} p @param {number} t @param {number} peak @param {number} att @param {number} dur */
  const env = (p, t, peak, att, dur) => {
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.01, dur));
  };
  /** @param {OscillatorType} type @param {number} f @param {number} t @param {number} end @param {AudioNode} to @param {number} [cents] */
  const osc = (type, f, t, end, to, cents) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; if (cents) o.detune.value = cents;
    o.connect(to); o.start(t); o.stop(end); return o;
  };
  /** @param {number} t @param {number} dur @param {BiquadFilterType} type @param {number} f @param {number} q */
  const noise = (t, dur, type, f, q) => {
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return fl;
  };

  const I = {
    /** @param {number} t @param {any} e */
    kick(t, e) {
      const g = ac.createGain(); g.connect(mix); env(g.gain, t, 1.1 * e.v, 0.002, 0.42);
      const o = osc('sine', 160, t, t + 0.5, g);
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      const c = ac.createGain(); c.connect(mix); env(c.gain, t, 0.25 * e.v, 0.001, 0.012);
      noise(t, 0.02, 'highpass', 3000, 0.7).connect(c);
      pump.gain.cancelScheduledValues(t);
      pump.gain.setValueAtTime(0.3, t); pump.gain.setTargetAtTime(1, t + 0.04, 0.09);
    },
    /** @param {number} t @param {any} e */
    snare(t, e) {
      const g = ac.createGain(); g.connect(mix); g.connect(rv); env(g.gain, t, 0.55 * e.v, 0.001, 0.22);
      noise(t, 0.25, 'bandpass', 1700, 0.7).connect(g);
      const b = ac.createGain(); b.connect(mix); env(b.gain, t, 0.4 * e.v, 0.001, 0.09);
      const o = osc('triangle', 200, t, t + 0.12, b); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    },
    /** @param {number} t @param {any} e */
    hat(t, e) { const g = ac.createGain(); g.connect(panned(mix, 0.25)); env(g.gain, t, 0.13 * e.v, 0.001, 0.035); noise(t, 0.05, 'highpass', 8000, 0.7).connect(g); },
    /** @param {number} t @param {any} e */
    ohat(t, e) { const g = ac.createGain(); g.connect(panned(mix, 0.25)); env(g.gain, t, 0.11 * e.v, 0.002, 0.16); noise(t, 0.2, 'highpass', 7000, 0.7).connect(g); },
    /** @param {number} t @param {any} e */
    riser(t, e) {
      const len = e.d * STEP_SEC, g = ac.createGain(); g.connect(mix); g.connect(rv);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * e.v, t + len);  g.gain.linearRampToValueAtTime(0, t + len + 0.05);
      const f = noise(t, len, 'bandpass', 300, 2); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + len);
      f.connect(g);
    },
    /** @param {number} t @param {any} e */
    bass(t, e) {
      const len = e.d * STEP_SEC, f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(200 + 2600 * e.open, t); f.frequency.exponentialRampToValueAtTime(140 + 300 * e.open, t + len * 0.9);
      const g = ac.createGain(); f.connect(g); g.connect(pump); env(g.gain, t, 0.42 * e.v, 0.004, len * 0.95);
      const hz = midiHz(e.n);
      osc('sawtooth', hz, t, t + len, f, -6); osc('sawtooth', hz, t, t + len, f, 6); osc('square', hz / 2, t, t + len, f);
    },
    /** @param {number} t @param {any} e */
    pad(t, e) {
      const len = e.d * STEP_SEC, f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(350 + 1500 * e.open, t); f.frequency.linearRampToValueAtTime(500 + 2100 * e.open, t + len * 0.6);
      f.frequency.linearRampToValueAtTime(350 + 1500 * e.open, t + len);
      const g = ac.createGain(); f.connect(g); g.connect(pump); g.connect(rv);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * e.v, t + 0.35);
      g.gain.setValueAtTime(0.09 * e.v, t + len - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.4);
      for (const n of e.pad) for (const c of [-9, 9]) osc('sawtooth', midiHz(n), t, t + len + 0.45, f, c);
    },
    /** @param {number} t @param {any} e */
    arp(t, e) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
      f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.14);
      const g = ac.createGain(); f.connect(g); const p = panned(mix, e.pan || 0); g.connect(p); g.connect(dl);
      env(g.gain, t, 0.13 * e.v, 0.002, 0.16);
      osc('square', midiHz(e.n), t, t + 0.2, f); osc('sawtooth', midiHz(e.n), t, t + 0.2, f, 7);
    },
    /** @param {number} t @param {any} e */
    gtr(t, e) {
      const len = e.d * STEP_SEC, end = t + len + 0.12, hz = midiHz(e.n);
      const pre = ac.createGain(); pre.gain.value = 1.4;
      const sh = ac.createWaveShaper(); sh.curve = curve; sh.oversample = '2x';
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150;
      const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1100; mid.Q.value = 1; mid.gain.value = 7;
      const cab = ac.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3600; cab.Q.value = 0.9;
      const g = ac.createGain();
      pre.connect(sh); sh.connect(hp); hp.connect(mid); mid.connect(cab); cab.connect(g);
      g.connect(panned(mix, e.pan || 0)); g.connect(dl); g.connect(rv);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * e.v, t + 0.006);
      g.gain.setTargetAtTime(0.11 * e.v, t + 0.02, 0.25);
      g.gain.setValueAtTime(0.11 * e.v, t + len); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const c of [-7, 7]) {
        const o = osc('sawtooth', hz, t, end, pre, c);
        // bent: from a tone below up into the note
        if (e.bend) { o.frequency.setValueAtTime(hz * Math.pow(2, -2 / 12), t); o.frequency.setTargetAtTime(hz, t + 0.03, 0.05); }
        if (e.vib && len > 0.3) {
          const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.6;
          lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.014, t + len * 0.8);
          l.connect(lg); lg.connect(o.frequency); l.start(t + len * 0.3); l.stop(end);
        }
      }
    },
  };
  return {
    /** @param {number} s the step @param {number} t when (the context's time) */
    play(s, t) { for (const e of songStep(s)) { const f = I[e.i]; if (f) f(t, e); } },
    /** @param {number} v @param {number} t @param {number} over */
    fade(v, t, over) { mix.gain.cancelScheduledValues(t); mix.gain.setValueAtTime(mix.gain.value, t); mix.gain.linearRampToValueAtTime(v, t + over); },
    out: mix,
  };
}

// The title's track, live: steps scheduled 0.25 s ahead every 40 ms; fading out on stop
export const Music = (() => {
  /** @type {ReturnType<typeof makeMusic> | null} */
  let M = null;
  let timer = 0, step = 0, next = 0;
  const run = () => {
    const ac = SFX.ctx;
    if (!M || !ac) return;
    if (next < ac.currentTime - 0.1) next = ac.currentTime + 0.05;     // woke from a pause: no catch-up burst
    try { while (next < ac.currentTime + 0.25) { M.play(step, next); step++; next += STEP_SEC; } } catch (_) { /* music must never break the game */ }
  };
  return {
    /** @returns {boolean} playing */
    start() {
      if (timer) return true;
      const ac = SFX.ctx, out = SFX.musicOut;
      if (!ac || !out || !SFX.ready) return false;
      try {
        M = makeMusic(ac, out); step = 0; next = ac.currentTime + 0.1;
        M.fade(0.55, ac.currentTime, 0.01);
        timer = window.setInterval(run, 40); run();
        return true;
      } catch (_) { M = null; return false; }
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = 0;
      const old = M, ac = SFX.ctx; M = null;
      try { if (old && ac) { old.fade(0, ac.currentTime, 1.2); setTimeout(() => { try { old.out.disconnect(); } catch (_) { /* gone */ } }, 1500); } } catch (_) { /* gone */ }
    },
    get playing() { return !!timer; },
    get step() { return step; },
  };
})();
