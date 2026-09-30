// @ts-check
// The rats' and nests' Game side (REFACTOR.md D20; the brain, ratStep, and the sprites,
// drawRat and drawNest, are in creatures/rat.js): their view of the terrain, the cached ways
// home / to a coin / to you, a new rat out of a nest, the per-frame goal picking and safety
// nets (ratFrame), and the two acts' hooks: a rat's frame, a nest's frame (letting rats out)
// and a nest's death (the gold shower).

import { SFX } from '../../audio/sfx.js';
import { CELL, CW, PH, WH, WW } from '../../core/consts.js';
import { roamStep } from '../../creatures/common.js';
import { pathLen, ratSpread, ratStep } from '../../creatures/rat.js';
import { enemyFor } from '../../data/creatures.js';
import { kr } from '../../dev/knobs.js';
import { NAV, navField, navWay } from '../../world/nav.js';
import { burst } from '../systems/particles.js';
import { hurt } from '../systems/player.js';
import { solidCell } from '../systems/terrain.js';
import { webDist } from '../systems/webs.js';

// a spider's web line under a rat's feet counts as ground: rats run along webs
/** @param {WebLine[]} list @returns {(x: number, y: number) => boolean} */
export const onWebIn = list => (x, y) => { for (const L of list) if (webDist(L, x, y) < 3) return true; return false; };

// A rat's view of the terrain: rock, plus the burrows (so it runs over a hole rather than
// falling in and wedging in a tunnel it only ever walks as a path). burrow is per floor.
/** @param {World} W @param {number} cx @param {number} cy */
export const ratSolid = (W, cx, cy) => solidCell(W, cx, cy) || (W.burrow !== null && W.burrow[cy * CW + cx] === 1);
// a goal's distance field, kept on `o` and made again when the goal moves or the rock changes
/** @param {World} W @param {NavCache} o @param {Pt} goal @param {number} R */
export function navFor(W, o, goal, R) {
  // (the rock changing only counts once a second, or a drill would rebuild them every frame)
  if (!o.F || (o.v !== W.terrainV && W.time - o.t > 1) || Math.hypot(goal.x - o.fx, goal.y - o.fy) > (o === W.navYou ? 12 : 6) ||
      (o === W.navYou && W.time - o.t > 0.4) || (o.wn !== W.webs.length && W.time - o.t > 1)) {
    // only the web lines that cross the field's square, so a floor of webs costs nothing
    const half = (R + 1) * NAV * CELL, near = W.webs.filter(L =>
      Math.max(L.a0x, L.b0x) > goal.x - half && Math.min(L.a0x, L.b0x) < goal.x + half &&
      Math.max(L.a0y, L.b0y) > goal.y - half && Math.min(L.a0y, L.b0y) < goal.y + half);
    o.F = navField((cx, cy) => ratSolid(W, cx, cy), goal.x, goal.y, R, near.length ? onWebIn(near) : null);
    o.v = W.terrainV; o.fx = goal.x; o.fy = goal.y; o.t = W.time; o.wn = W.webs.length;
  }
  return o.F;
}
// a new rat, down in nest `n`'s room, on its way out up the tunnel
/** @param {World} W @param {Enemy} n */
export function spawnRat(W, n) {
  const k = enemyFor('rotta', W.floor), P = n.nest.path, m = n.nest.mouth;
  const e = { x: P[0].x, y: P[0].y, ty: P[0].y, r: k.r, phase: Math.random() * 6.28, hp: 1, hpMax: 1,
    cd: 0, flash: 0, lx: 0, ly: 1, hx: m.x, hy: m.y, tgt: null, rest: 0, k, touch: 0, charge: 0,
    home: n, path: P, carry: 0 };
  e.ra = { mode: 'tunnel', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: 0, side: 1, face: 1, s: 0, dir: 1, wait: 0 };
  W.enemies.push(e);
  return e;
}
// a rat that's stuck with a job on: a hop in some direction; the third time, a carrier
// slips into a crack and goes home underground, anyone else forgets it for a while
/** @param {World} W @param {Enemy} e @param {RatBrain} S @param {boolean} home carrying gold home */
export function unstick(W, e, S, home) {
  e.stN = (e.stN || 0) + 1;
  if (e.stN >= 3 && home) {
    burst(W, e.x, e.y, 6, '#6a5a48');
    S.mode = 'tunnel'; S.len = pathLen(e.path); S.s = S.len * 0.7; S.dir = -1; S.wait = 0;
    e.stN = 0;
  } else if (e.stN >= 3) { e.giveUp = 4; e.aggro = false; e.stN = 0; }
  else {
    S.mode = 'air'; S.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80); S.vy = -150 - Math.random() * 120;
    e.x += S.nx * 1.5; e.y += S.ny * 1.5;
  }
}
// One rat's frame. What it wants, in order: home, if it has gold in its mouth; any loose
// gold it can smell; you, if it has noticed you; else its roam spot round the nest.
// Reaching you it bites, and knocks gold out of you over its head (triple bite if you've
// none); reaching gold it picks it up; reaching the nest room it drops it off.
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {number} dt @param {number} dist @param {boolean} hunting @param {number} pcx @param {number} pcy */
export function ratFrame(W, G, e, dt, dist, hunting, pcx, pcy) {
  const N = e.home && !e.home.dead ? e.home : null, k = e.k;
  const wake = N ? N.nest.wake || 520 : 520;
  const S = e.ra;
  // far off and not falling: asleep, so a floor full of rats costs nothing
  if (dist > wake * 1.3 && S && S.mode !== 'air') return;
  let goal = null, home = false, fast = false, jump = true, want = null;
  if (e.giveUp > 0) e.giveUp -= dt;
  if (e.carry > 0 && N) { goal = N.nest.mouth; home = true; fast = true; }
  else if (e.giveUp > 0) {
    const R = e.roam || (e.roam = {});
    roamStep(R, e, dt, Math.random, 'ra');
    goal = { x: R.rx, y: R.ry }; jump = false;
  } else {
    let bd = e.smell || (e.smell = kr('raSmell'));
    for (const g of W.coins) {
      if (g.nopull > 0 && g.vy < 0) continue;            // still on its way up
      const d = Math.hypot(g.x - e.x, g.y - e.y);
      if (d < bd) { bd = d; want = g; }
    }
    if (want) { goal = want; fast = true; }
    else if (hunting) { goal = { x: pcx, y: W.p.y + PH - 2 }; fast = true; }
    else {
      const R = e.roam || (e.roam = {});
      roamStep(R, e, dt, Math.random, 'ra');
      // keep apart from the other loose rats: the push walks this rat's roam spot away
      // from the crowd, so the pack fans out round the nest
      const D = e.spread || (e.spread = kr('raSpread')), sp = ratSpread(e, W.enemies.filter(o => o.ra && o.ra.mode !== 'tunnel' &&
        Math.abs(o.x - e.x) < D && Math.abs(o.y - e.y) < D), D);
      R.rx += sp.x * D * 1.5 * dt; R.ry += sp.y * D * 1.5 * dt;
      goal = { x: R.rx + sp.x * D, y: R.ry + sp.y * D }; jump = false;
    }
  }
  if (!e.arrive || Math.random() < dt) e.arrive = kr('raArrive');
  // with a job on, it follows the way there (navField) rather than a straight line
  let way = goal, follow = false, air = false;
  if (fast && S && S.mode !== 'tunnel') {
    const F = home ? navFor(W, N.nest, goal, 100) : want ? navFor(W, want, goal, 36) : navFor(W, W.navYou, goal, 56);
    const w = F && navWay(F, e.x, e.y, 1);
    if (w) { way = w.dist > 2 ? w : goal; follow = true; air = w.air && w.dist > 2; }
    // v95: getting no nearer along the way for 4s (hopping back and forth over a gap it
    // can't clear) counts as stuck, the same as standing still
    const job = home ? N : want || W.navYou;
    if (w && (e.jobO !== job || w.dist < e.bestD - 3)) { e.jobO = job; e.bestD = w.dist; e.bestT = 0; }
    else if (w && (e.bestT += dt) > 4) { e.bestT = 0; e.bestD = w.dist; unstick(W, e, S, home); }
  }
  const cold = e.chill && e.chill < 1 ? e.chill : 1;
  const ev = ratStep(e, { solidCell: (cx, cy) => ratSolid(W, cx, cy), rnd: Math.random, goal: way, hunting: fast, home, path: e.path, follow, air, onWeb: G.ratOnWeb,
    speedMul: cold, arrive: way === goal && !want && hunting ? e.arrive : 3, jump }, dt);
  // stuck (wedged, or running on the spot) with a job on: a hop in some direction
  if (fast && (S.mode === 'surf' || S.mode === 'path')) {
    e.stT = (e.stT || 0) + dt;
    if (e.stT > 1.2) {
      if (Math.hypot(e.x - (e.stX || 0), e.y - (e.stY || 0)) < 6 && Math.hypot(goal.x - e.x, goal.y - e.y) > 14) unstick(W, e, S, home);
      else if (!(e.bestT > 0)) e.stN = 0;
      e.stT = 0; e.stX = e.x; e.stY = e.y;
    }
  }
  if (ev === 'home') {
    if (N && e.carry > 0) { N.nest.stash += e.carry; SFX.fx('coinland', e.x, e.y); }
    if (N) e.carry = 0;
  } else if (ev === 'jump') SFX.creature(k, 'alert', e.x, e.y);
  if (e.ra.mode === 'tunnel') return;
  // wedged in the rock or pushed off the map somehow: back out of its hole (or gone)
  const inRock = e.x < 0 || e.x >= WW || e.y < 0 || e.y >= WH || ratSolid(W, Math.floor(e.x / CELL), Math.floor(e.y / CELL));
  e.rockT = inRock ? (e.rockT || 0) + dt : 0;
  if (e.rockT > 0.5) {
    e.rockT = 0;
    if (N) { e.ra.mode = 'tunnel'; e.ra.len = pathLen(e.path); e.ra.s = e.ra.len * 0.8; e.ra.dir = 1; e.ra.wait = 0; }
    else { const j = W.enemies.indexOf(e); if (j >= 0) W.enemies.splice(j, 1); }
    return;
  }
  // a coin in reach: in its mouth
  if (want && Math.hypot(want.x - e.x, want.y - e.y) < e.r + 5) {
    const i = W.coins.indexOf(want);
    if (i >= 0) { W.coins.splice(i, 1); e.carry = (e.carry || 0) + want.amount; SFX.fx('coinland', e.x, e.y); }
  }
  // you, in reach: a bite, and a coin knocked out of you over its head
  if (hunting && !want && !(e.giveUp > 0) && !(e.carry > 0 && N) && dist < e.r + 12 && e.touch <= 0 && !W.p.dead) {
    const LO = G.input.current.loadout, broke = !(LO.gold > 0);
    hurt(W, G, Math.round(kr('raBite') * (broke ? kr('raBroke') : 1)));
    e.touch = kr('raBiteCd');
    SFX.creature(k, 'bite', e.x, e.y);
    if (!broke) {
      const amt = Math.min(LO.gold, Math.max(1, Math.round(kr('raSteal'))));
      LO.gold -= amt;
      G.input.current.notify();
      const side = e.x >= pcx ? 1 : -1;
      W.coins.push({ x: pcx, y: W.p.y + 4, amount: amt, t: Math.random() * 6.28,
        vx: side * kr('raPopX'), vy: -kr('raPopY'), pop: 1, nopull: 0.7 });
      SFX.ui('coin');
    }
  }
}

// A rat's frame (ACTS): ratFrame, then nothing after its move runs for it
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function ratMove(W, G, e, C) {
  const { dt, dist, hunting, pcx, pcy } = C;
  ratFrame(W, G, e, dt, dist, hunting, pcx, pcy);
  e.chill = 1; e.ty = e.y;
  return true;
}

// A nest's frame: it never moves, and nothing after its move runs for it
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function nestMove(W, G, e, C) {
  const { dt, dist } = C;
  // lets a rat out now and then, while it has fewer than its max alive; only while
  // you're near enough for it to matter
  const N = e.nest;
  if (!N.max) { N.max = Math.round(kr('raMax')); N.wake = kr('raWake'); }
  if (dist < N.wake && (N.t -= dt) <= 0) {
    N.t = kr('raSpawn');
    let out = 0;
    for (const r of W.enemies) if (r.home === e) out++;
    if (out < N.max) spawnRat(W, e);
  }
  e.chill = 1; e.ty = e.y;
  return true;
}

// A nest dies (damageEnemy, once it's out of the list): no ordinary coin
/** @param {World} W @param {Enemy} e */
export function nestDie(W, e) {
  // a nest: its own gold and everything its rats brought home, in a little shower
  const all = Math.round(kr('raNestGold') * W.pb.gold) + e.nest.stash;
  const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
  for (let k = 0; k < n; k++)
    W.coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
      t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
  SFX.fx('coinland', e.x, e.y);
  return true;
}
