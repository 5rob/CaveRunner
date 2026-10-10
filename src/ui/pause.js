// @ts-check
// The pause menu (LIST4 #3): ⏸ (top right, `.pausebtn`) opens it and pauses the run like the Dev
// panel. Resume, Save (writes the run now, flashes "Saved"), the three volumes (Master, FX, Music: ui/volume.js,
// kept in localStorage; v0.0.174) and Exit to main menu (saves, then reloads the page, which
// opens on the title). CaveRunner Auto (stage 13) passes onNew: a New run button, tapped twice to confirm
// (the first tap turns it into "Tap again: new run"; after 3 s it turns back).

import { getSlot } from '../save/save.js';
import { DEV_HOLD_MS } from './devmode.js';
import { h, useEffect, useRef, useState } from './h.js';
import { Volumes } from './volume.js';

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

// label: the header's right side (default the save slot; CaveRunner Auto passes its own)
/** @param {{ input: { current: { saveRun?: () => void } }, close: () => void, label?: string, onNew?: () => void }} props */
export function PauseMenu({ input, close, label, onNew }) {
  const [saved, setSaved] = useState(0);
  const [sure, setSure] = useState(false);   // New run tapped once: the next tap starts it
  useEffect(() => {
    if (!sure) return undefined;
    const t = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(t);
  }, [sure]);
  const fresh = () => { if (!onNew) return; if (sure) onNew(); else setSure(true); };
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
  return h('div', { className: 'pausewrap' },
    h('div', { className: 'shade', onPointerDown: tap(close) }),
    h('div', { className: 'pausecard' },
      h('div', { className: 'phead' }, 'PAUSED', h('span', null, label || 'Slot ' + getSlot())),
      h('button', { className: 'pbtn resume', onPointerDown: tap(close) }, '▶ Resume'),
      h('button', { className: 'pbtn save', onPointerDown: tap(save) }, saved ? h('span', { key: saved, className: 'saved' }, '✓ Saved') : '💾 Save'),
      h(Volumes),
      onNew ? h('button', { className: 'pbtn newrun' + (sure ? ' sure' : ''), onPointerDown: tap(fresh) }, sure ? 'Tap again: new run' : '↺ New run') : null,
      h('button', { className: 'pbtn exit', onPointerDown: tap(exit) }, '⏏ Exit to main menu')));
}
