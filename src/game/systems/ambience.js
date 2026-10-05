// @ts-check
// The theme's ambience (spores, frost, embers, motes, ash, dust devils), pooled round the
// camera, and the spore puffs a jelly's pulse blows out of its rim.

import { rgbA } from '../../art/props.js';
import { jellyBell } from '../../creatures/jelly.js';
import { CELL, SHOP_FLOOR, SHOP_Y } from '../../core/consts.js';
import { themeFor } from '../../data/themes.js';
import { kr, kru } from '../../dev/knobs.js';
import { solidAt } from './terrain.js';

// ---- the theme's ambience, pooled round the camera rather than tied to a spot ----
export const AMB_RATE = { spores: 5, frost: 3, embers: 8, motes: 4, ashfall: 55 };
export const AMB_MAX = { spores: 40, frost: 20, embers: 60, motes: 50, ashfall: 280 };
// one of the Luminescent Spores that drift about the green floors. The jellies puff the
// very same thing out of their rims (puffSpores), so it is made in one place
/** @param {World} W @param {number} x @param {number} y @param {number} r */
export const spore = (W, x, y, r) => ({ kind: 'spores', x, y, vx: (r - 0.5) * 8, vy: 0, wob: r * 9, life: 5 + r * 3, max: 8,
  c: rgbA(themeFor(W.floor).moss[1]), s: 1.3, glow: 1 });
// a jelly's pulse blows a puff of spores out of its rim, back the way it pushes; drag
// (kx, ky fading at kd) settles them, then they drift like any other spore
/** @param {World} W @param {Enemy} e */
export function puffSpores(W, e) {
  if (e.x < W.camX - 150 || e.x > W.camX + W.viewW + 150 || e.y < W.camY - 150 || e.y > W.camY + W.viewH + 150) return;
  const S = e.je, B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
  const c = Math.cos(S.hd), sn = Math.sin(S.hd), n = Math.round(kr('jeSpores'));
  for (let i = 0; i < n && W.amb.length < 500; i++) {
    const lx = (Math.random() * 2 - 1) * B.rw * 0.7;
    const q = spore(W, e.x - lx * sn - B.rim * c, e.y + lx * c - B.rim * sn, Math.random());
    const a = S.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
    q.kx = Math.cos(a) * v; q.ky = Math.sin(a) * v; q.kd = kr('jeSporeDrag');
    W.amb.push(q);
  }
}

// the shop is indoors: none of the floor's ambience in it (v0.0.144: the green spores showed in the tubes'
// light); its own dust is render/shoplights.js's, inside the cones
/** @param {number} y */
const inShopRoom = y => y >= SHOP_Y && y <= SHOP_FLOOR * CELL;

/** @param {World} W @param {number} dt */
export function stepAmbience(W, dt) {
  const x0 = W.camX - 30, y0 = W.camY - 30, w = W.viewW + 60, h = W.viewH + 60;
  const T = themeFor(W.floor);
  for (const kind of W.ambKinds) {
    if (kind === 'devils') {
      if (W.devils.length < 2 && Math.random() < dt * 0.4) {
        let x = x0 + Math.random() * w, y = y0 + Math.random() * h, k = 0;
        while (k++ < 120 && !solidAt(W, x, y + 1)) y += 2;
        if (k < 120 && !solidAt(W, x, y - 30)) W.devils.push({ x, y, vx: (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20), life: 6 + Math.random() * 3, max: 9 });
      }
      continue;
    }
    // @ts-expect-error a boolean counted as 0/1, on purpose (noise)
    const n = W.amb.reduce((a, q) => a + (q.kind === kind), 0);
    let want = AMB_RATE[kind] * dt;
    while (want > 0 && n < AMB_MAX[kind]) {
      if (Math.random() >= want) break;
      want -= 1;
      const x = x0 + Math.random() * w, y = y0 + Math.random() * h;
      if (solidAt(W, x, y) || inShopRoom(y)) continue;
      const r = Math.random();
      if (kind === 'spores') W.amb.push(spore(W, x, y, r));
      else if (kind === 'frost') {
        const dir = W.floor % 2 ? 1 : -1;
        W.amb.push({ kind, x, y, vx: dir * (100 + r * 60), vy: (r - 0.5) * 10, life: 0.9 + r * 0.5, max: 1.4, c: 'rgba(215,238,255,0.5)', s: 1, streak: 10 });
      } else if (kind === 'embers') W.amb.push({ kind, x, y, vx: 0, vy: -20 - r * 30, wob: r * 9, life: 3 + r * 2, max: 5, c: r < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.2, glow: 1 });
      else if (kind === 'motes') W.amb.push({ kind, x, y, vx: (r - 0.5) * 6, vy: (Math.random() - 0.5) * 4, wob: r * 9, life: 6 + r * 3, max: 9, c: 'rgba(235,225,200,0.8)', s: 1 });
      else if (kind === 'ashfall') W.amb.push({ kind, x, y, vx: 8, vy: 20 + r * 22, wob: r * 9, life: 4 + r * 3, max: 7, c: 'rgba(150,146,142,0.75)', s: 1 + r });
    }
  }
  for (let i = W.amb.length - 1; i >= 0; i--) {
    const q = W.amb[i];
    q.life -= dt;
    if (q.wob != null) q.x += Math.sin(W.time * 1.3 + q.wob) * 6 * dt;
    if (q.kx || q.ky) {                             // a puff's kick, dying away under drag
      q.x += q.kx * dt; q.y += q.ky * dt;
      const k = Math.exp(-q.kd * dt); q.kx *= k; q.ky *= k;
    }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.life <= 0 || solidAt(W, q.x, q.y) || inShopRoom(q.y) || q.x < x0 - 200 || q.x > x0 + w + 200 || q.y < y0 - 200 || q.y > y0 + h + 200) W.amb.splice(i, 1);
  }
  for (let i = W.devils.length - 1; i >= 0; i--) {
    const dv = W.devils[i];
    dv.life -= dt;
    const nx = dv.x + dv.vx * dt;
    if (solidAt(W, nx + Math.sign(dv.vx) * 6, dv.y - 4)) dv.vx = -dv.vx; else dv.x = nx;
    if (!solidAt(W, dv.x, dv.y + 2)) dv.y += 40 * dt;
    else if (solidAt(W, dv.x, dv.y)) dv.y -= 2;
    if (dv.life <= 0) W.devils.splice(i, 1);
  }
}
