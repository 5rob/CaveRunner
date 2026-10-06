// @ts-check
// The in-game HUD: the two thumbsticks with their gauge rings (health + fuel on the left,
// mana + recharge + cast delay on the right), the R key of the buy line, the round deck
// buttons' layout, the gold readout, and holdPress (tap vs hold).

import { CRYSTAL_PAL, GREEN_PAL } from '../art/sprites.js';
import { DEV } from '../dev/knobs.js';
import { AIM_DEAD, DEAD, KNOB, triggerRing } from '../core/consts.js';
import { mixHex } from '../core/util.js';
import { hasAssist } from '../spells/assist.js';
import { countdown } from '../core/util.js';
import { h, useEffect, useRef, useState } from './h.js';

// Gold for the deck readout: a bare number under 1000, and above that truncated (not rounded)
// to one decimal with a k, M or B: 999 -> "999", 1234 -> "1.2k", 2000 -> "2k". Negative (a level
// bought on credit) keeps its minus sign: -63999999960 -> "-63.9B".
// Pure and above makeLevel so the logic suite can load it.
/** @param {number} g @returns {string} */
export function fmtGold(g) {
  g = Math.trunc(g || 0);
  if (g < 0) return '-' + fmtGold(-g);
  const units = ['B', 'M', 'k'];
  for (let i = 0; i < 3; i++) {
    const n = 10 ** (9 - i * 3);
    if (g >= n) return (Math.floor(g / (n / 10)) / 10).toString() + units[i];
  }
  return String(g);
}

// The debt's repayment deadline under the debt at the top, ticking every second on its own
// (real time, the device clock: LO.due)
/** @param {{ due: number }} props */
export function DueClock({ due }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(id); }, []);
  const left = due - Date.now();
  return h('div', { className: 'due' + (left < 5 * 60 * 1000 ? ' late' : '') }, 'Settlement due ', h('b', null, countdown(left)));
}

// Where the round deck buttons sit, in css px relative to the sticks row's top-left (the
// row is W wide, the two sticks `size` across, spaced evenly). The gun buttons ride an arc
// centred on the right stick, DECK_PUSH px further out than the old gold spot, from the top of
// the gap between the sticks, clockwise over the top, to near the right edge; each button is as
// big as fits with DECK_GAP px between neighbours (v0.0.137: they were 46px with wide gaps).
// The bag mirrors the last gun on the left, and the map button sits straight above the bag, the
// same size. Returns centres plus the button diameter.
export const DECK_PUSH = 14, DECK_GAP = 6, DECK_MAX = 64;
/** @param {number} W the row's width @param {number} size a stick's @param {number} [n] guns @returns {{ btn: number, R: number, rc: Pt, guns: Pt[], bag: Pt, map: Pt, pin: Pt }} */
export function deckLayout(W, size, n) {
  n = n || 4;
  const g = (W - 2 * size) / 3;
  const rc = { x: 2 * g + 1.5 * size, y: size / 2 };
  const sx = W / 2, sy = size * 0.05 + 10;             // the old gold spot
  const a0 = Math.atan2(sy - rc.y, sx - rc.x);
  let btn = Math.round(Math.max(34, Math.min(46, size * 0.24))), R = 0, a1 = a0;
  // the button size sets how far round the arc may run (the last one stays on screen), and the
  // arc's spacing sets the size: a few rounds settle it
  for (let k = 0; k < 6; k++) {
    R = Math.max(Math.hypot(sx - rc.x, sy - rc.y), size / 2 + btn / 2 + 4) + DECK_PUSH;
    const xmax = W - btn / 2 - 4;
    a1 = Math.max(a0 + 0.3, -Math.acos(Math.max(-1, Math.min(1, (xmax - rc.x) / R))));
    const chord = n > 1 ? 2 * R * Math.sin((a1 - a0) / (n - 1) / 2) : DECK_MAX;
    btn = Math.round(Math.max(34, Math.min(DECK_MAX, chord - DECK_GAP)));
  }
  const guns = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0);
    guns.push({ x: rc.x + Math.cos(a) * R, y: rc.y + Math.sin(a) * R });
  }
  const last = guns[n - 1];
  const bag = { x: W - last.x, y: last.y };
  const map = { x: bag.x, y: bag.y - btn - DECK_GAP - 2 };
  const pin = { x: W - map.x, y: map.y };               // the pin button mirrors the map (v0.0.141)
  return { btn, R, rc, guns, bag, map, pin };
}

// The shade under the controls (owner, v0.0.146): see-through at the map button's top, black
// by the sticks' middles and on down past the screen's bottom. Same coordinates as deckLayout.
/** @param {{ btn: number, map: Pt }} deck @param {number} size a stick's @returns {Record<string, string|number>} */
export function shadeAt(deck, size) {
  const top = Math.round(deck.map.y - deck.btn / 2), mid = Math.round(size / 2 - top);
  return { top, height: mid + size + 200,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, #000 ' + mid + 'px, #000 100%)' };
}

// the circumference of the gauge ring (r=46 in a 0..100 viewBox), used to turn a 0..1
// fraction into a stroke-dasharray so the ring is drawn only as far as the stat reaches
export const GAUGE_R = 46, GAUGE_C = 2 * Math.PI * GAUGE_R;
// the gauge rings' width and line (svg units: the stick is 100 across)
const GAUGE_RW = 3.2, GAUGE_SW = 1.6;
// the right stick's trigger ring, inside its three gauge rings (owner): Dev aimPad px in from the innermost
/** @param {number} size the stick's width (css px) */
export const stickTrigger = size => triggerRing(size, DEV.aimPad, (GAUGE_R - 2 * GAUGE_RW - GAUGE_SW) / 50);
// the three gun stats shown as rings on the right stick and colour-coded in the bag, so a
// ring and its stat read as the same thing: mana gold, recharge blue, cast delay purple
export const GAUGE_COL = { mana: '#ffc93c', rech: '#7ad7ff', cast: '#c58cff', fuel: '#ff9a2e' };
// green -> amber -> red as health falls, so the colour itself reads as danger
/** @param {number} frac @returns {string} */
export function healthCol(frac) {
  return frac > 0.5 ? mixHex('#e6a52c', '#57d267', (frac - 0.5) * 2)
                    : mixHex('#e24a2c', '#e6a52c', frac * 2);
}
// "Tap the right stick", for the buy/take line: a thin white circle with a thin R in it.
export function RKey() {
  return h('svg', { className: 'rkey', viewBox: '0 0 30 30', width: 28, height: 28, 'aria-hidden': true },
    h('circle', { cx: 15, cy: 15, r: 13.5, fill: 'none', stroke: '#fff', strokeWidth: 1 }),
    h('text', { x: 15, y: 15, textAnchor: 'middle', dominantBaseline: 'central', fill: '#fff',
      fontSize: 14, fontWeight: 300, fontFamily: 'system-ui, sans-serif' }, 'R'));
}
// A red crystal: gold's lumpy nugget, bigger, dark red, white glints (CRYSTAL_PAL in art/sprites.js)
/** @param {{ size?: number, green?: boolean }} props */
export function CrystalIcon({ size, green }) {
  const s = size || 26, P = green ? GREEN_PAL : CRYSTAL_PAL;
  return h('svg', { className: 'crystal', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': true },
    h('path', { d: 'M12 2.5 L19.5 6 L21.5 13 L17 20.5 L8.5 21.5 L3 15.5 L4 7.5 Z', fill: P[0] }),
    h('path', { d: 'M12 3.6 L18.8 6.7 L20.4 13 L16.4 19.6 L8.9 20.5 L4 15.1 L5 8 Z', fill: P[1] }),
    h('path', { d: 'M5.6 8.4 L12 4.4 L17.6 7.3 L13.5 11.5 L7 12.2 Z', fill: P[2] }),
    h('rect', { x: 7.4, y: 7.2, width: 2.6, height: 2.6, fill: '#fff' }),
    h('rect', { x: 14.2, y: 13.6, width: 1.5, height: 1.5, fill: '#fff' }));
}

// The crystals you carry, under your gold: a row of crystal silhouettes in their colours, red
// then green, wrapping; past CRYS_MAX of a colour the rest is a +N
export const CRYS_MAX = 24;
/** @param {{ red: number, green: number }} props */
export function CrystalRow({ red, green }) {
  if (!red && !green) return null;
  /** @param {number} n @param {string} cls */
  const bits = (n, cls) => [
    ...Array.from({ length: Math.min(n, CRYS_MAX) }, (_, i) => h('svg', { key: cls + i, className: 'cbit ' + cls, viewBox: '0 0 24 24', 'aria-hidden': true },
      h('path', { d: 'M12 2.5 L19.5 6 L21.5 13 L17 20.5 L8.5 21.5 L3 15.5 L4 7.5 Z' }))),
    n > CRYS_MAX ? h('b', { key: cls + '+', className: 'cmore ' + cls }, '+' + (n - CRYS_MAX)) : null];
  return h('div', { className: 'crysrow', 'aria-label': red + ' red crystals, ' + green + ' green crystals' }, bits(red, 'red'), bits(green, 'green'));
}

/** @param {{ size: number, kind: 'left' | 'right', input: { current: GameInput }, refresh: () => void }} props */
export function Stick({ size, kind, input, refresh }) {
  const [knob, setKnob] = useState({ x: 0, y: 0, jet: false });
  // the live stat this stick shows: hp+fuel on the left, mana on the right. Read off
  // input.current.hud each animation frame, and only re-rendered when a value actually
  // moves (rounded to 1%), so the ring animates without churning the whole tree.
  const [gauge, setGauge] = useState({ ring: 1, fuel: 1, empty: false, dry: true });
  const left = kind === 'left';
  useEffect(() => {
    let raf, prev = '';
    const tick = () => {
      const s = input.current.hud;
      if (s) {
        const g = left
          ? { ring: s.hp, fuel: s.fuel, empty: s.empty, dry: false }
          : { ring: s.hasGun ? s.mana : 0, rech: s.hasGun ? s.rech : 0, cast: s.hasGun ? s.cast : 0,
              has: s.hasGun, fuel: 0, empty: false, dry: !s.hasGun || s.recharging };
        const key = Math.round(g.ring * 100) + '|' + Math.round(g.fuel * 100) + '|' +
          Math.round((g.rech || 0) * 100) + '|' + Math.round((g.cast || 0) * 100) + '|' +
          (g.has ? 1 : 0) + '|' + (g.empty ? 1 : 0) + '|' + (g.dry ? 1 : 0);
        if (key !== prev) { prev = key; setGauge(g); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [left]);
  const ref = useRef(null);
  const pid = useRef(null);
  // right stick only: true while this touch has never left the dead zone. A tap that
  // stays true until release is an interact; a drag out (even one that comes back to
  // centre) sets it false the moment it first crosses AIM_DEAD, and stays false.
  const stayed = useRef(true);
  const peak = useRef(0);               // the furthest this touch has pushed (a menu pointer past DEV.ptrStart)

  const right = kind === 'right';
  const update = e => {
    const r = ref.current.getBoundingClientRect();
    const rad = r.width / 2;
    const dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + rad);
    const dist = Math.hypot(dx, dy);
    const maxD = rad * 0.72;
    const cl = Math.min(dist, maxD);
    const nx = dist ? dx / dist : 0, ny = dist ? dy / dist : 0;
    const mag = cl / maxD;
    // the right stick fires at its trigger ring, out near the edge (Dev aimPad); past AIM_DEAD it's
    // already a drag (aiming, the line shows), not a tap
    const thresh = right ? stickTrigger(r.width).mag : 0.15;
    if (right && mag > AIM_DEAD) stayed.current = false;
    peak.current = Math.max(peak.current, mag);
    // A card is up: left picks up, right leaves, and the one you are pointing at is the
    // one lit. Inside the dead zone neither is lit, because you have not chosen yet.
    if (right && input.current.confirmAct) {
      const side = mag > AIM_DEAD ? (nx < 0 ? 'take' : 'leave') : null;
      if (input.current.confirmAim !== side) { input.current.confirmAim = side; refresh(); }
    }
    const st = input.current[kind];
    st.active = true; st.nx = nx; st.ny = ny; st.mag = mag; st.dy = dy; st.on = mag > thresh; st.fire = thresh;
    st.cx = r.left + rad; st.cy = r.top + rad; st.size = r.width;
    setKnob({ x: nx * cl, y: ny * cl, jet: kind === 'left' && dy < 0 && mag > DEAD });
  };
  const down = e => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    stayed.current = true;
    peak.current = 0;
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) {}
    update(e);
  };
  const move = e => { if (e.pointerId === pid.current) update(e); };
  const end = e => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    const act = input.current.confirmAct;
    if (right && act) {
      // a confirmation is up, so the gesture is "point left or right and let go". The
      // side was decided while dragging, so coming back to the middle before releasing
      // picks nothing, which is the right answer — you were not pointing anywhere.
      const side = input.current.confirmAim;
      input.current.confirmAim = null;
      if (side) act[side]();
    } else if (right && input.current.menuTap) {
      // a vending machine's menu is up: a tap presses its highlight; a drag was its pointer, and
      // letting go of that is the menu's own business (useMenuNav)
      if (peak.current <= DEV.ptrStart) input.current.menuTap();   // past it: the pointer (Dev → Menu pointer)
    } else if (right && stayed.current) {
      input.current.interact = true;
    }
    Object.assign(input.current[kind], { active: false, mag: 0, on: false, dy: 0 });
    setKnob({ x: 0, y: 0, jet: false });
  };

  // the circular gauges, each a thin ring wiped clockwise from the top as its stat falls.
  // Left: health at the edge, jet fuel just inside it (red track when the tank is dry).
  // Right: gold mana at the edge, then recharge and cast delay inside it, so you can see
  // which one is gating your fire.
  const rw = GAUGE_RW, sw = GAUGE_SW;
  const wipe = (r, frac, col, track) => [
    h('circle', { key: 't' + r, cx: 50, cy: 50, r, fill: 'none', stroke: track || 'rgba(0,0,0,0.35)', strokeWidth: sw }),
    h('circle', { key: 'w' + r, cx: 50, cy: 50, r, fill: 'none', stroke: col, strokeWidth: sw,
      strokeLinecap: 'round',
      strokeDasharray: (Math.max(0, Math.min(1, frac)) * 2 * Math.PI * r) + ' ' + (2 * Math.PI * r),
      transform: 'rotate(-90 50 50)' })];
  const ring = left
    ? h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, healthCol(gauge.ring)),
        wipe(GAUGE_R - rw, gauge.fuel, knob.jet ? '#ffc35a' : GAUGE_COL.fuel,
          gauge.empty ? 'rgba(226,74,44,0.7)' : null))
    : h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, gauge.dry ? 'rgba(255,201,60,0.28)' : GAUGE_COL.mana),
        wipe(GAUGE_R - rw, gauge.rech, gauge.has ? GAUGE_COL.rech : 'rgba(122,215,255,0.22)'),
        wipe(GAUGE_R - 2 * rw, gauge.cast, gauge.has ? GAUGE_COL.cast : 'rgba(197,140,255,0.22)'));
  return h('div', {
      ref, className: 'stick' + (knob.jet ? ' jetting' : ''),
      style: { width: size, height: size },
      onPointerDown: down, onPointerMove: move, onPointerUp: end,
      onPointerCancel: end, onLostPointerCapture: end,
    },
    // the centre line splits jet (top half) from walk
    left && h('div', { className: 'stickclip' }, h('div', { className: 'hline' })),
    ring,
    // the right stick's amber ring: the line the knob's edge crosses when the drag starts
    // counting as aiming rather than as a tap on the dead zone
    h('div', { className: 'knob', style: {
      width: (KNOB * 100) + '%', height: (KNOB * 100) + '%',
      transform: `translate(-50%,-50%) translate(${knob.x}px,${knob.y}px)` } }),
    // (none with Aim Assist on the gun in hand: the stick is a pointer then, it fires on its own)
    right && !(input.current.loadout && hasAssist(input.current.loadout.guns[input.current.loadout.sel])) && h('div', { className: 'deadzone', style: {
      width: (stickTrigger(size).ring * 100) + '%', height: (stickTrigger(size).ring * 100) + '%' } }),
    h('span', { className: 'lbl top' }, left ? 'jet' : 'aim'),
    left && h('span', { className: 'lbl bot' }, 'walk')
  );
}

// Tap or hold, told apart: a hold fires on its own after `ms`, a release before
// that counts as a tap, and sliding off cancels both.
/** @param {() => void} onTap @param {() => void} onHold @param {((on: boolean) => void) | null} [onState] @param {number} [ms] */
export function holdPress(onTap, onHold, onState, ms) {
  return e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let fired = false;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (onState) onState(false);
    };
    const timer = setTimeout(() => { fired = true; done(); onHold(); }, ms || 450);
    const move = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) done(); };
    const up = () => { const tap = !fired; done(); if (tap && onTap) onTap(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (onState) onState(true);
  };
}
