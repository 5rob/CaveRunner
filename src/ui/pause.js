// @ts-check
// The pause menu (LIST4 #3): ⏸ (top right, `.pausebtn`) opens it and pauses the run like the Dev
// panel. Resume, Save (writes the run now, flashes "Saved"), Volume (the whole game's, 0–100%:
// SFX.setVolume, kept in localStorage) and Exit to main menu (saves, then reloads the page, which
// opens on the title).

import { SFX } from '../audio/sfx.js';
import { getSlot } from '../save/save.js';
import { DEV_HOLD_MS } from './devmode.js';
import { h, useEffect, useRef, useState } from './h.js';

// ⏸ itself (top right, where the Dev ⚙️ was): a tap (released before DEV_HOLD_MS) opens the menu; held
// DEV_HOLD_MS it toggles dev mode instead (ui/devmode.js: the ⚙️ beside it, the cards' audit, the 💾 preset)
/** @param {{ open: () => void, toggleDev: () => void }} props */
export function PauseButton({ open, toggleDev }) {
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const stop = () => { const was = timer.current; clearTimeout(timer.current); timer.current = 0; return was; };
  return h('button', { className: 'pausebtn', title: 'Pause',
    onPointerDown: e => {
      e.preventDefault(); stop();
      timer.current = window.setTimeout(() => {
        timer.current = 0; toggleDev();
        try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) { /* no vibration */ }
      }, DEV_HOLD_MS);
    },
    onPointerUp: e => { e.preventDefault(); if (stop()) open(); },
    onPointerCancel: stop }, '⏸');
}

/** @param {{ input: { current: GameInput }, close: () => void }} props */
export function PauseMenu({ input, close }) {
  const [vol, setVol] = useState(() => Math.round(SFX.volume * 100));
  const [saved, setSaved] = useState(0);
  /** @param {() => void} fn @returns {(e: any) => void} */
  const tap = fn => e => { e.preventDefault(); fn(); };
  const save = () => {
    if (input.current.saveRun) input.current.saveRun();
    setSaved(n => n + 1);
  };
  const exit = () => {
    if (input.current.saveRun) input.current.saveRun();
    location.reload();
  };
  /** @param {any} e */
  const slide = e => { const v = Number(e.target.value); setVol(v); SFX.setVolume(v / 100); };
  return h('div', { className: 'pausewrap' },
    h('div', { className: 'shade', onPointerDown: tap(close) }),
    h('div', { className: 'pausecard' },
      h('div', { className: 'phead' }, 'PAUSED', h('span', null, 'Slot ' + getSlot())),
      h('button', { className: 'pbtn resume', onPointerDown: tap(close) }, '▶ Resume'),
      h('button', { className: 'pbtn save', onPointerDown: tap(save) }, saved ? h('span', { key: saved, className: 'saved' }, '✓ Saved') : '💾 Save'),
      h('label', { className: 'pvol' },
        h('span', null, '🔊 Volume', h('b', null, vol + '%')),
        h('input', { type: 'range', min: 0, max: 100, step: 1, value: vol, className: 'volslider', onInput: slide, onChange: slide })),
      h('button', { className: 'pbtn exit', onPointerDown: tap(exit) }, '⏏ Exit to main menu')));
}
