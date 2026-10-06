// @ts-check
// The HUD gun slots' press (v0.0.149, replaces the swap chooser): tap equips, tap the gun in hand
// shows its card; hold by a gun on the ground takes it into that slot; hold with none in reach
// lifts the slot's gun out to drag, and letting go drops it on the ground there.

import { GunIcon } from './editor.js';
import { h } from './h.js';

export const GUN_HOLD_MS = 450;

/**
 * onPointerDown for gun slot i.
 * @param {{ current: GameInput }} input
 * @param {number} i
 * @param {{ tap: () => void, setHold: (v: GunHold) => void, setDrag: (v: GunDrag) => void }} on
 */
export function gunSlotPress(input, i, on) {
  /** @param {PointerEvent} e */
  return e => {
    e.preventDefault();
    const btn = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    const sx = e.clientX, sy = e.clientY;
    const LO = input.current.loadout;
    const mode = input.current.gunNear ? 'take' : LO.guns[i] ? 'lift' : null;
    let fired = false, lifted = false;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      on.setHold(null); on.setDrag(null);
    };
    const timer = mode ? setTimeout(() => {
      fired = true;
      on.setHold(null);
      if (mode === 'take') { done(); if (input.current.takeGun) input.current.takeGun(i); return; }
      lifted = true;
      on.setDrag({ i, x: sx, y: sy });
    }, GUN_HOLD_MS) : 0;
    /** @param {PointerEvent} ev */
    const move = ev => {
      if (lifted) { on.setDrag({ i, x: ev.clientX, y: ev.clientY }); return; }
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { fired = true; done(); }
    };
    /** @param {PointerEvent} ev */
    const up = ev => {
      const tap = !fired;
      done();
      if (tap) { on.tap(); return; }
      if (!lifted) return;
      // let go back over its own button: changed your mind
      const r = btn && btn.getBoundingClientRect();
      if (r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) return;
      if (input.current.dropGun) input.current.dropGun(i, ev.clientX, ev.clientY);
    };
    const cancel = () => { fired = true; done(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    if (mode) on.setHold({ i, mode });
  };
}

// The ring that fills round a held slot over the hold time (CSS: .holdring)
export function HoldRing() {
  return h('svg', { className: 'holdring', viewBox: '0 0 40 40' },
    h('circle', { cx: 20, cy: 20, r: 18, pathLength: 100 }));
}

// The lifted gun, following the finger
/** @param {{ gun: Gun, x: number, y: number }} props */
export function DragGun({ gun, x, y }) {
  return h('div', { className: 'gundrag', style: { left: x + 'px', top: y + 'px' } }, h(GunIcon, { gun }));
}
