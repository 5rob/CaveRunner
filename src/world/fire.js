// Fire: the pixel-by-pixel spread of burning grass, moss and timber (fireNew, fireStep,
// fireArea, fireDouse…) and what burns or puts you out. Pure: the Game owns one state F.

import { CELL, CH, CW } from '../core/consts.js';
import { kr } from '../dev/knobs.js';

export const FLAMMABLE = { vine: 1, myc: 1 };                  // the ones that burn (kelp's wet, the roots are fossil)
export const FIRE_WET = { puddle: 1, snow: 1, ice: 1, slime: 1 };   // standing in these puts you out
export const FIRE_COLS = ['#ffe07a', '#ff9a2e', '#f0561c', '#8a2a14'];   // bright, flame, deep, dying ember

// ---- fire (v86) ----
// Grass, moss and timber burn. makeLevel hands back `fuel`, one byte per terrain pixel: the
// kind of fuel painted there (0 = none). Timber and grass live in the decoration layer, so
// you walk through them and still burn them; moss is painted on the rock, and burning it
// leaves the rock scorched. The Game keeps one fire state F = fireNew(fuel).
export const FUEL_GRASS = 1, FUEL_MOSS = 2, FUEL_WOOD = 3;
export const FIRE_TICK = 0.05;                 // the fire moves on 20 times a second, not every frame
export const FIRE_MAX = 5000;                  // most pixels alight at once, so a blaze can't stall a phone
export const FIRE_CATCH = [0, 1, 0.6, 0.45];   // how readily each kind catches: grass, moss, timber
export const FIRE_KNOB = [null, 'fireGrass', 'fireMoss', 'fireWood'];
// Fire climbs: a pixel above catches about three times as readily as one below, one beside
// nearly as readily as above. FIRE_NB is every spot within two pixels as [pixel-index offset,
// weight]; the ring two out is at 0.3 of that, so fire crosses a hairline gap but not open air.
export const FIRE_UPW = dy => dy < 0 ? 1 : dy === 0 ? 0.9 : 0.35;
export const FIRE_NB = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
  if (dx || dy) FIRE_NB.push([dy * CW + dx, FIRE_UPW(dy) * (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? 0.3 : 1)]);
// t: ticks of burning left per pixel (0 = not alight); list: the pixels alight
export function fireNew(fuel) { return { fuel, t: new Uint16Array(fuel.length), list: [], acc: 0 }; }
// set pixel i alight if it has fuel and isn't already burning; true if it caught
export function fireLight(F, i, rnd) {
  const kind = F.fuel[i];
  if (!kind || F.t[i] || F.list.length >= FIRE_MAX) return false;
  F.t[i] = Math.max(1, Math.round(kr(FIRE_KNOB[kind], rnd) / FIRE_TICK));
  F.list.push(i);
  return true;
}
// everything with fuel within r world units of (x, y) catches, each at `chance`; how many did
// v96: put out the burning pixels in a disc (the fuel stays, so it can catch again later).
// Returns how many went out.
export function fireDouse(F, x, y, r) {
  const cx0 = x / CELL, cy0 = y / CELL, rc = r / CELL;
  const x0 = Math.max(0, Math.floor(cx0 - rc)), x1 = Math.min(CW - 1, Math.ceil(cx0 + rc));
  const y0 = Math.max(0, Math.floor(cy0 - rc)), y1 = Math.min(CH - 1, Math.ceil(cy0 + rc));
  let n = 0;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const i = cy * CW + cx;
    if (F.t[i] && Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) { F.t[i] = 0; n++; }
  }
  return n;
}
export function fireArea(F, x, y, r, chance, rnd) {
  rnd = rnd || Math.random;
  const cx0 = x / CELL, cy0 = y / CELL, rc = r / CELL;
  const x0 = Math.max(0, Math.floor(cx0 - rc)), x1 = Math.min(CW - 1, Math.ceil(cx0 + rc));
  const y0 = Math.max(0, Math.floor(cy0 - rc)), y1 = Math.min(CH - 1, Math.ceil(cy0 + rc));
  let n = 0;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const i = cy * CW + cx;
    if (!F.fuel[i] || F.t[i] || Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc || rnd() >= chance) continue;
    if (fireLight(F, i, rnd)) n++;
  }
  return n;
}
// is anything burning within r world units of (x, y)? (a square test — cheap, and fire is ragged)
export function fireNear(F, x, y, r) {
  const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL), rc = Math.ceil(r / CELL);
  for (let cy = Math.max(0, cy0 - rc); cy <= Math.min(CH - 1, cy0 + rc); cy++)
    for (let cx = Math.max(0, cx0 - rc); cx <= Math.min(CW - 1, cx0 + rc); cx++)
      if (F.t[cy * CW + cx]) return true;
  return false;
}
// Run the fire on by dt, in FIRE_TICK steps. Each tick every burning pixel burns a tick of
// its fuel and tries every spot within two pixels (FIRE_NB); a spot with fuel catches at the
// spread chance × how readily its kind lights × which way it lies (up beats sideways beats
// down, two out is a long shot). A pixel whose fuel is spent goes to
// out(i, kind) — the Game erases it (grass, timber) or chars it (moss on rock) — and its fuel
// is gone for good, so the fire dies once it runs out. A pixel whose t was zeroed from outside
// (dug or blasted away) just drops off the list. Returns the ticks run.
export function fireStep(F, dt, out, rnd) {
  rnd = rnd || Math.random;
  F.acc = Math.min(F.acc + dt, FIRE_TICK * 4);
  let ticks = 0;
  while (F.acc >= FIRE_TICK) {
    F.acc -= FIRE_TICK; ticks++;
    const L = F.list, n0 = L.length, sp = kr('fireSpread', rnd), N = F.fuel.length;
    let w = 0;
    for (let k = 0; k < n0; k++) {
      const i = L[k];
      if (!F.t[i]) continue;
      for (const [o, w] of FIRE_NB) {
        const j = i + o;
        if (j >= 0 && j < N && F.fuel[j] && !F.t[j] && rnd() < sp * w * FIRE_CATCH[F.fuel[j]]) fireLight(F, j, rnd);
      }
      if (--F.t[i] === 0) { const kind = F.fuel[i]; F.fuel[i] = 0; if (out) out(i, kind); }
      else L[w++] = i;
    }
    for (let k = n0; k < L.length; k++) L[w++] = L[k];   // the ones lit this tick
    L.length = w;
  }
  return ticks;
}
