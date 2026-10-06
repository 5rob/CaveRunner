// @ts-check
// Fire (v86): what the cave's fire (world/fire.js, fireStep) does to the level. Burnt-out pixels,
// plants, arched vines, web lines and minecarts catching, creatures and you set alight, a blast's
// heat, and fireFrame, one frame of all of it; and the Levitation Trail's burning patches
// (stepTrail, a part of step()). It goes through the terrain canvases the same way dig does
// (G.tctx / G.dctx, the recorder's wrapped ones).

import { HEAR_FIRE } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import { CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { kr } from '../../dev/knobs.js';
import { archAt, archNear } from '../../world/decorate.js';
import { FIRE_WET, FLAMMABLE, fireArea, fireNear, fireStep } from '../../world/fire.js';
import { damageEnemy } from './enemies.js';
import { hurt } from './player.js';
import { blowProp } from './props.js';
import { webDist } from './webs.js';

// ---- fire (v86): the cave's fire runs in fireStep; this is what it does to the level ----
// A pixel whose fuel is spent: grass and timber go (a fleck of ash now and then stays),
// moss leaves the rock under it scorched. Changed areas are put back once a frame.
/** @param {number[]} b a dirty box: x0, y0, x1, y1 @param {number} x @param {number} y */
export const growBox = (b, x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
/** @param {World} W @param {GameCtx} G @param {number} i */
export function fireOut(W, G, i) {
  const x = i % CW, y = (i / CW) | 0, k = i * 4, r = Math.random();
  if (W.mat[i]) {
    const d = W.img.data;
    d[k] = 34 + r * 16; d[k + 1] = 28 + r * 12; d[k + 2] = 24 + r * 10;
    growBox(G.fireBox.t, x, y);
  } else if (W.dimg) {
    const dd = W.dimg.data;
    if (r < 0.16) { const a = 30 + r * 120; dd[k] = a; dd[k + 1] = a * 0.9; dd[k + 2] = a * 0.85; }
    else dd[k + 3] = 0;
    growBox(G.fireBox.d, x, y);
  }
}
/** @param {World} W @param {GameCtx} G */
export function flushFire(W, G) {
  for (const [b, c, im] of [[G.fireBox.t, G.tctx, W.img], [G.fireBox.d, G.dctx, W.dimg]]) {
    if (b[2] < b[0] || !im) continue;
    // @ts-expect-error the loop's [box, context, pixels] rows are read as a union of their elements (noise)
    c.putImageData(im, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
    b[0] = CW; b[1] = CH; b[2] = -1; b[3] = -1;
  }
}
// a plant catches: it burns up from its tip toward the rock it hangs from
/** @param {Prop} pr */
export function catchPlant(pr) {
  if (pr.burn || pr.gone) return;
  pr.burn = 1;
  SFX.fx('whoosh', pr.x, pr.y + pr.len);
}
// an arched vine catches at fraction u along it; the fire runs out both ways from there
/** @param {Prop} pr @param {number} u */
export function catchArch(pr, u) {
  if (pr.burn || pr.gone) return;
  pr.burn = 1; pr.u0 = pr.u1 = u;
  const q = archAt(pr, u);
  SFX.fx('whoosh', q.x, q.y);
}
// a web line catches: it flares along its length and is gone
/** @param {World} W @param {number} w */
export function burnWeb(W, w) {
  const L = W.webs[w];
  for (let u = 0; u <= 1; u += 0.1)
    W.dparts.push({ x: L.a0x + (L.b0x - L.a0x) * u, y: L.a0y + (L.b0y - L.a0y) * u, vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 30, g: -0.02, c: Math.random() < 0.5 ? '#ffd35a' : '#ff8a2a', s: 1.4, life: 0.4, max: 0.4, glow: 1 });
  W.webs.splice(w, 1);
  SFX.fx('whoosh', (L.a0x + L.b0x) / 2, (L.a0y + L.b0y) / 2);
}
// everything that burns within r of (x, y) catches at `chance`: grass, moss and timber
// pixels, plants, web lines — and a minecart goes up
/** @param {World} W @param {GameCtx} G @param {number} x @param {number} y @param {number} r @param {number} chance */
export function ignite(W, G, x, y, r, chance) {
  fireList(W);
  const n = fireArea(W.fire, x, y, r, chance);
  for (const pr of W.firePlants)
    if (!pr.gone && !pr.burn && x > pr.x - 5 - r && x < pr.x + 5 + r && y > pr.y - r && y < pr.y + pr.len + r &&
      Math.random() < chance) catchPlant(pr);
  for (let w = W.webs.length - 1; w >= 0; w--) if (webDist(W.webs[w], x, y) < r + 2 && Math.random() < chance) burnWeb(W, w);
  for (const pr of W.fireArches) {
    if (pr.gone || pr.burn || x < pr.x + pr.l - r || x > pr.x + pr.r + r || y < pr.y + pr.t0 - r || y > pr.y + pr.b + r) continue;
    const q = archNear(pr, x, y);
    if (q.d < r + 3 && Math.random() < chance) catchArch(pr, q.k / (pr.arc.length - 1));
  }
  for (const pr of W.fireCarts)
    if (!pr.gone && x > pr.x + pr.l - r && x < pr.x + pr.r + r && y > pr.y + pr.t0 - r && y < pr.y + pr.b + r &&
      Math.random() < chance) blowProp(W, G, pr);
  if (n > 4) SFX.fx('whoosh', x, y);
  return n;
}
/** @param {Enemy} e */
export function setAlight(e) {
  if (!(e.burn > 0)) SFX.fx('whoosh', e.x, e.ty);
  e.burn = Math.max(e.burn || 0, kr('fireBurn'));
}
/** @param {World} W */
export function youAlight(W) {
  if (W.p.dead || W.pb.fireImm) return;           // the Fire Immunity perk: you never catch
  if (!(W.p.burn > 0)) { SFX.fx('whoosh', W.p.x + PW / 2, W.p.y + PH / 2); W.strings.length = 0; }   // spider silk burns off
  W.p.burn = Math.max(W.p.burn || 0, kr('fireYou'));
}
// a blast's heat: fuel round it catches, and creatures (and you) in it may go up
/** @param {World} W @param {GameCtx} G @param {number} x @param {number} y @param {number} R @param {number} [hot] */
export function fireBlast(W, G, x, y, R, hot) {
  const ch = hot ? 0.9 : kr('fireBoom');
  ignite(W, G, x, y, R * 1.3, ch);
  for (const e of W.enemies) if (Math.hypot(e.x - x, e.ty - y) < R + e.r && Math.random() < ch) setAlight(e);
  if (!W.p.dead && Math.hypot(W.p.x + PW / 2 - x, W.p.y + PH / 2 - y) < R + 6 && Math.random() < ch * 0.5) youAlight(W);
}
// a flame licking up off a burning spot
/** @param {World} W @param {number} x @param {number} y @param {number} [sp] */
export const flameAt = (W, x, y, sp) => W.dparts.push({ x, y, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * (sp || 40),
  g: -0.03, c: Math.random() < 0.4 ? '#ffd35a' : Math.random() < 0.6 ? '#ff8a2a' : '#e8461c', s: 1 + Math.random() * 1.2,
  life: 0.25 + Math.random() * 0.3, max: 0.55, glow: 1 });
/** @param {World} W @param {number} x @param {number} y */
export const fireSmoke = (W, x, y) => W.smoke.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -25 - Math.random() * 20,
  r: 2 + Math.random() * 2.5, life: 1.4, max: 1.4, c: '#2a2624', a: 0.35 });
// One frame of fire: the cave's fire moves on, plants, webs and carts catch off it,
// burning creatures (and you) take damage and spread it, flames and smoke come off
// what's on view, and the crackle sits at the nearest blaze.
// the props that burn, relisted whenever props came or went (a test room, a drop)
/** @param {World} W */
export function fireList(W) {
  if (W.props.length === W.firePropN && W.props[W.props.length - 1] === W.firePropLast) return;
  W.firePropN = W.props.length; W.firePropLast = W.props[W.props.length - 1];
  W.firePlants = W.props.filter(pr => pr.k === 'climb' && FLAMMABLE[pr.st] && !pr.arc);
  W.fireArches = W.props.filter(pr => pr.arc && FLAMMABLE[pr.st]);
  W.fireCarts = W.props.filter(pr => pr.k === 'barrel');
}
/** @param {World} W @param {GameCtx} G @param {number} dt @param {number} pcx @param {number} pcy */
export function fireFrame(W, G, dt, pcx, pcy) {
  fireList(W);
  const ticks = fireStep(W.fire, dt, (i) => fireOut(W, G, i));
  W.fireN += ticks;
  const L = W.fire.list, any = L.length > 0;
  if (ticks && any) {
    for (let k = W.fireN & 3; k < W.firePlants.length; k += 4) {       // a quarter of the plants a tick
      const pr = W.firePlants[k];
      if (pr.gone || pr.burn) continue;
      for (let yy = pr.y + 2; yy < pr.y + pr.len; yy += 8) if (fireNear(W.fire, pr.x, yy, 2)) { catchPlant(pr); break; }
    }
    for (const pr of W.fireArches) {
      if (pr.gone || pr.burn) continue;
      const n = pr.arc.length - 1;
      for (let k = 0; k <= n; k += 2) { const q = archAt(pr, k / n); if (fireNear(W.fire, q.x, q.y, 2)) { catchArch(pr, k / n); break; } }
    }
    for (let w = W.webs.length - 1; w >= 0; w--) {
      const ln = W.webs[w];
      for (let u = 0; u <= 1; u += 0.25)
        if (fireNear(W.fire, ln.a0x + (ln.b0x - ln.a0x) * u, ln.a0y + (ln.b0y - ln.a0y) * u, 2)) { burnWeb(W, w); break; }
    }
    for (const pr of W.fireCarts) if (!pr.gone && fireNear(W.fire, pr.x, pr.y - 4, 8)) blowProp(W, G, pr);
  }
  // burning plants: the fire climbs from the tip to the rock, lighting what's round it
  for (const pr of W.firePlants) {
    if (!pr.burn || pr.gone) continue;
    pr.len -= kr('firePlant') * dt; pr.b = Math.max(0, pr.len);
    const ty = pr.y + Math.max(0, pr.len);
    if (Math.random() < dt * 30) flameAt(W, pr.x + (Math.random() - 0.5) * 4, ty);
    if (Math.random() < dt * 4) fireSmoke(W, pr.x, ty);
    if (ticks) {
      fireArea(W.fire, pr.x, ty, 5, 0.3);
      for (const o of W.firePlants)
        if (!o.burn && !o.gone && Math.abs(o.x - pr.x) < 10 && ty > o.y - 4 && ty < o.y + o.len + 4 && Math.random() < 0.25) catchPlant(o);
      if (!W.p.dead && W.zfx.climb === pr) youAlight(W);
    }
    if (pr.len < 4) { pr.gone = true; fireArea(W.fire, pr.x, pr.y, 6, 1); }
  }
  // burning arched vines: the fire runs both ways along it from where it caught, lighting
  // the strands as it reaches them, and the vine is gone when it meets both ends
  for (const pr of W.fireArches) {
    if (!pr.burn || pr.gone) continue;
    const du = kr('fireArch') * dt / Math.max(1, pr.alen);
    pr.u0 = Math.max(0, pr.u0 - du); pr.u1 = Math.min(1, pr.u1 + du);
    for (const u of [pr.u0, pr.u1]) {
      const q = archAt(pr, u);
      if (Math.random() < dt * 30) flameAt(W, q.x + (Math.random() - 0.5) * 4, q.y);
      if (Math.random() < dt * 4) fireSmoke(W, q.x, q.y);
      if (ticks) fireArea(W.fire, q.x, q.y, 5, 0.3);
    }
    if (ticks) {
      for (const o of W.firePlants) if (o.on === pr && !o.burn && !o.gone && o.u >= pr.u0 && o.u <= pr.u1) catchPlant(o);
      if (!W.p.dead && W.zfx.climb === pr) youAlight(W);
    }
    if (pr.u0 <= 0 && pr.u1 >= 1) pr.gone = true;
  }
  // burning creatures: hurt in chunks (so they flash, not flicker), spread it where they go
  for (let j = W.enemies.length - 1; j >= 0; j--) {
    const e = W.enemies[j];
    if (ticks && any && !(e.burn > 0) && fireNear(W.fire, e.x, e.ty, e.r * 0.7)) setAlight(e);
    if (!(e.burn > 0)) continue;
    e.burn -= dt;
    e.burnAcc = (e.burnAcc || 0) + kr('fireDps') * dt;
    if (Math.random() < dt * 40) flameAt(W, e.x + (Math.random() - 0.5) * e.r * 1.4, e.ty + (Math.random() - 0.3) * e.r);
    if (Math.random() < dt * 6) fireSmoke(W, e.x, e.ty - e.r);
    if (ticks) ignite(W, G, e.x, e.ty + e.r * 0.4, e.r * 0.8, 0.35);
    if (!W.p.dead && Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 8 && Math.random() < dt * 2) youAlight(W);
    if (e.burnAcc >= 0.5 || e.burn <= 0) { const d = e.burnAcc; e.burnAcc = 0; if (d > 0 && W.enemies[j] === e) damageEnemy(W, j, d); }
  }
  // you: fire underfoot or round you lights you; water, snow or slime puts you out
  if (!W.p.dead) {
    if (ticks && any && !(W.p.burn > 0) && (fireNear(W.fire, pcx, W.p.y + PH - 3, 3) || fireNear(W.fire, pcx, pcy, 3))) youAlight(W);
    if (W.p.burn > 0 && FIRE_WET[W.zfx.surface]) { W.p.burn = 0; W.p.burnAcc = 0; SFX.fx('sizzle', pcx, W.p.y + PH); }
    if (W.p.burn > 0) {
      W.p.burn -= dt;
      W.p.burnAcc = (W.p.burnAcc || 0) + kr('fireYouDps') * dt;
      if (Math.random() < dt * 40) flameAt(W, W.p.x + Math.random() * PW, W.p.y + PH * (0.2 + Math.random() * 0.8));
      if (Math.random() < dt * 6) fireSmoke(W, pcx, W.p.y);
      if (ticks) fireArea(W.fire, pcx, W.p.y + PH - 2, 5, 0.3);
      if (W.p.burnAcc >= 2 || W.p.burn <= 0) { const d = Math.round(W.p.burnAcc); W.p.burnAcc -= d; if (d > 0) hurt(W, G, d); }
    }
  } else W.p.burn = 0;
  // flames and smoke off the burning pixels you can see, and the crackle at the nearest blaze
  if (any) {
    const x0 = W.camX / CELL - 4, x1 = (W.camX + W.viewW) / CELL + 4, y0 = W.camY / CELL - 4, y1 = (W.camY + W.viewH) / CELL + 4;
    const want = Math.min(20, Math.ceil(L.length * dt * 2.5));
    for (let a = 0, got = 0; a < want * 3 && got < want && W.dparts.length < 700; a++) {
      const i = L[(Math.random() * L.length) | 0], x = i % CW, y = (i / CW) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      got++;
      flameAt(W, (x + Math.random()) * CELL, y * CELL);
      if (Math.random() < 0.12) fireSmoke(W, x * CELL, y * CELL - 3);
    }
    const st = Math.max(1, Math.floor(L.length / 300));
    let bd = HEAR_FIRE, bx = 0, by = 0, near = 0;
    for (let k = 0; k < L.length; k += st) {
      const x = (L[k] % CW) * CELL, y = ((L[k] / CW) | 0) * CELL, d = Math.hypot(x - pcx, y - pcy);
      if (d < 220) near += st;
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    if (bd < HEAR_FIRE) {
      if (!W.fireLoop && SFX.ready) W.fireLoop = SFX.loop('fire');
      if (W.fireLoop) W.fireLoop.set(Math.min(1, 0.35 + near / 300) * 0.7, bx, by);
    }
  }
  flushFire(W, G);
}

// ---- Levitation Trail (a part of step) ----
// Flying lays down fire that burns what it touches: a new patch under you, and each patch
// setting creatures alight until it fades.
/** @param {World} W @param {StepFrame} F */
export function stepTrail(W, F) {
  const { dt, pcx } = F;
  if (W.pb.trail && W.p.flame > 0 && !W.p.dead) {
    const bn = { x: pcx + (Math.random() - 0.5) * 6, y: W.p.y + PH, life: 0.7, max: 0.7 };
    W.burns.push(bn);
    if (W.burns.length > 48) W.burns.shift();
    fireArea(W.fire, bn.x, bn.y + 2, 4, 0.4);
  }
  for (let i = W.burns.length - 1; i >= 0; i--) {
    const bn = W.burns[i]; bn.life -= dt;
    for (let j = W.enemies.length - 1; j >= 0; j--)
      if (Math.hypot(W.enemies[j].x - bn.x, W.enemies[j].ty - bn.y) < 15) { setAlight(W.enemies[j]); damageEnemy(W, j, 22 * dt); }
    if (bn.life <= 0) W.burns.splice(i, 1);
  }
}
