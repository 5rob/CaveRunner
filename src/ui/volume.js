// @ts-check
// The three volume sliders (v0.0.174): Master, FX (sound effects and ambience) and Music, each kept in localStorage
// by audio/sfx.js. The title's settings and the pause menu both show them.
// (owner, v1.0.93) A press held VOL_HOLD_MS on any of them without moving (VOL_SLOP px) locks all three, or unlocks
// them: locked, they can't be moved (dimmed, a 🔒); the lock is kept on this device (VOL_LOCK_KEY). The press itself
// changes no volume: the values from before it come back when the lock flips.

import { SFX } from '../audio/sfx.js';
import { h, useEffect, useRef, useState } from './h.js';

export const VOL_LOCK_KEY = 'caverunner-vol-lock';
export const VOL_HOLD_MS = 4000;
const VOL_SLOP = 10;
/** @type {('master' | 'fx' | 'music')[]} */
const VOL_KEYS = ['master', 'fx', 'music'];

/** @returns {boolean} */
const lockLoad = () => { try { return localStorage.getItem(VOL_LOCK_KEY) === '1'; } catch (_) { return false; } };
/** @param {boolean} on */
const lockSave = on => { try { localStorage.setItem(VOL_LOCK_KEY, on ? '1' : '0'); } catch (_) { /* nowhere to keep it */ } };

export function Volumes() {
  const [v, setV] = useState(() => ({ master: SFX.volume, fx: SFX.fxVolume, music: SFX.musicVolume }));
  const [locked, setLocked] = useState(lockLoad);
  const lockRef = useRef(locked);
  lockRef.current = locked;
  /** @type {{ current: { id: number, x: number, y: number, v0: { master: number, fx: number, music: number }, t: any } | null }} */
  const hold = useRef(null);
  const SET = { master: SFX.setVolume, fx: SFX.setFxVolume, music: SFX.setMusicVolume };
  const cancel = () => { if (hold.current) clearTimeout(hold.current.t); hold.current = null; };
  useEffect(() => cancel, []);
  /** @param {any} e */
  const down = e => {
    cancel();
    const v0 = { master: SFX.volume, fx: SFX.fxVolume, music: SFX.musicVolume };
    hold.current = { id: e.pointerId, x: e.clientX, y: e.clientY, v0, t: setTimeout(() => {
      const on = !lockRef.current, was = hold.current ? hold.current.v0 : v0;
      hold.current = null;
      // the press changes no volume: back to what they were
      for (const k of VOL_KEYS) SET[k](was[k]);
      setV(was);
      lockSave(on); setLocked(on);
      SFX.fx(on ? 'close' : 'open');
    }, VOL_HOLD_MS) };
  };
  /** @param {any} e */
  const move = e => { const H = hold.current; if (H && e.pointerId === H.id && Math.hypot(e.clientX - H.x, e.clientY - H.y) > VOL_SLOP) cancel(); };
  /** @param {'master' | 'fx' | 'music'} k @param {string} label */
  const row = (k, label) => {
    /** @param {any} e */
    const slide = e => {
      if (lockRef.current) return;
      const x = Number(e.target.value) / 100;
      SET[k](x);
      setV(o => ({ ...o, [k]: x }));
      if (k !== 'music') SFX.fx('reelTick');
    };
    return h('label', { key: k, className: 'pvol tvol', 'data-vol': k },
      h('span', null, label + (locked ? ' 🔒' : ''), h('b', null, Math.round(v[k] * 100) + '%')),
      h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(v[k] * 100), className: 'volslider', onInput: slide, onChange: slide, tabIndex: locked ? -1 : 0 }));
  };
  return h('div', { className: 'volumes' + (locked ? ' locked' : ''), onPointerDown: down, onPointerMove: move, onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel },
    row('master', 'Master'), row('fx', 'FX'), row('music', 'Music'));
}
