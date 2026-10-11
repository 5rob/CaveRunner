// @ts-check
// Hanging on vines and web lines (owner: "port from the old game the ability to hang on vines and webs, the same
// mechanics"): the hand-steered player in a level (art/titlescene.js ctlStep) grabs as the old game's player does
// (game/systems/player.js movePlayer, props.js): overlapping a vine, chain or root (or an arched vine, or a spider's web
// line) and not jetting, he hangs on and the tank refills. A straight vine: the stick climbs him; not pushed across, he
// swings on it like a pendulum about its root. An arch or a web line: the stick runs him along it, hands on it; pushed
// across it or past an end, he lets go (0.35 s before he grabs another). Web lines he touches slow him (webSlow).
// The autopilot never grabs. World coordinates throughout: cx his middle's world x, top his top.

import { AIR_ACC, CLIMB, GRAVITY, GROUND_ACC, PH, PW, WALK, WEB_HAND } from '../core/consts.js';
import { approach, clamp } from '../core/util.js';
import { DEV, kr, spr } from '../dev/knobs.js';
import { archNear } from '../world/decorate.js';
import { bendAwake, bendStep, hangRootX, hangRootY, lineLetGo, swings, vinePt, webNearU } from '../world/sway.js';

// (a title prop: TProp in art/titlescene.js; the old helpers type it as the game's Prop, so loosely here)
/** @typedef {any} HProp */
/** @typedef {WebLine & { grab?: number, climb?: number, slow?: number, wh?: boolean, out?: boolean }} HWeb */
/** @typedef {{ climb: HProp | HWeb | null, arch: HProp | null, web: HWeb | null, webMul: number }} Hold */
/** @typedef {{ cvx?: number, vy: number, ground: boolean, hangGo?: number, swing?: number }} Hanger */

export const LET_GO_T = 0.35;   // after letting go of a line: no grabbing one again for this long (the old game's webLetGo)

// an arched vine at its world x (archNear reads x)
/** @param {HProp} p */
export const archView = p => ({ x: p.ox, y: p.y, arc: p.arc, wx: p.wx, wy: p.wy, wu: p.wu });

// what he's holding, if he holds on (old props.js: the vine he overlaps, an arch in reach beats it, a web line only when
// nothing else; letGo: just let go of a line, none for now). webMul: × his speed for the web lines he's touching
/** @param {HProp[]} props @param {HWeb[]} webs @param {number} cx @param {number} top @param {boolean} letGo @returns {Hold} */
export function hangFind(props, webs, cx, top, letGo) {
  const hy = top + WEB_HAND, cy = top + PH / 2;
  /** @type {HProp | null} */
  let climb = null, arch = null;
  let archD = Infinity, wd = Infinity, webMul = 1;
  /** @type {HWeb | null} */
  let web = null;
  for (const p of props) {
    if (p.k !== 'climb' || p.gone || p.drop || p.fall) continue;
    if (p.arc) {
      if (cx < p.ox - 40 || cx > p.ox + (p.span || 0) + 40) continue;
      // held, it can bend away faster than he follows: hold on further out
      const R = (p.grab || (p.grab = kr('arGrab'))) + (p.wh ? DEV.bendMax : 0), d = archNear(archView(p), cx, hy).d;
      if (d <= R && d < archD) { arch = p; archD = d; }
      continue;
    }
    if (!p.len) continue;
    const ry = hangRootY(p);
    if (top + PH < p.y + ry || top > p.y + ry + p.len) continue;
    const q = vinePt(p, clamp(cy - p.y - ry, 0, p.len));
    if (Math.abs(p.ox + q.x - cx) < PW / 2 + 1) climb = p;
  }
  for (const L of webs) {
    if (L.out) continue;
    const R = (L.grab || (L.grab = spr('webGrab'))) + (L.wh ? DEV.bendMax : 0), give = (L.sag || 0) + DEV.bendMax;
    if (cx < Math.min(L.a0x, L.b0x) - R - give || cx > Math.max(L.a0x, L.b0x) + R + give) continue;
    const a = webNearU(L, cx, hy), d = Math.hypot(a.x - cx, a.y - hy), b = webNearU(L, cx, cy);
    if (Math.min(d, Math.hypot(b.x - cx, b.y - cy)) > R) continue;
    webMul *= L.slow || (L.slow = spr('webSlow'));
    if (d <= R && d < wd) { wd = d; web = L; }
  }
  if (letGo) { arch = null; web = null; }
  /** @type {HProp | HWeb | null} */
  let c = arch || climb;
  if (web && !c) c = web;
  else if (c !== web) web = null;
  return { climb: c, arch, web, webMul };
}

// a frame hanging on (h.climb set, not jetting): his speeds (world units/s) from the stick (nx, ny at strength m past the
// dead zone). k: the scene's speed scale (DEV.autoMoveK × DEV.move); cx, top: where he is
/** @param {Hanger} r @param {Hold} h @param {number} nx @param {number} ny @param {number} m @param {number} cx @param {number} top @param {number} k @param {number} dt */
export function hangSteer(r, h, nx, ny, m, cx, top, k, dt) {
  const tied = h.webMul, hy = top + WEB_HAND;
  /** @param {number} ux @param {number} uy @param {{ x: number, y: number }} q @param {number} speed @param {boolean} atA @param {boolean} atB */
  const along = (ux, uy, q, speed, atA, atB) => {
    if (lineLetGo(nx, ny, m, ux, uy, atA, atB)) {
      r.hangGo = LET_GO_T;
      r.cvx = nx * m * WALK * k * 0.8;
      r.vy = Math.max(-90, ny * m * 90);
      return;
    }
    const v = (m > 0 ? (nx * ux + ny * uy) * m : 0) * speed * k * tied;
    r.cvx = approach(r.cvx || 0, ux * v + (q.x - cx) * 14, 1800 * dt);
    r.vy = approach(r.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
  };
  r.swing = 0;
  if (h.arch) {
    const ar = h.arch, A = ar.arc || [], av = archView(ar), q = archNear(av, cx, hy);
    const a = A[q.k], b = A[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const A0 = A[0], A1 = A[A.length - 1];
    const atA = Math.hypot(q.x - ar.ox - A0[0], q.y - ar.y - A0[1]) < 1.5, atB = Math.hypot(q.x - ar.ox - A1[0], q.y - ar.y - A1[1]) < 1.5;
    along((b[0] - a[0]) / ul, (b[1] - a[1]) / ul, q, ar.climb || (ar.climb = kr('arClimb')), atA, atB);
  } else if (h.web) {
    const ln = h.web, wl = Math.hypot(ln.b0x - ln.a0x, ln.b0y - ln.a0y) || 1, q = webNearU(ln, cx, hy);
    const atA = Math.hypot(q.x - ln.a0x, q.y - ln.a0y) < 1.5, atB = Math.hypot(q.x - ln.b0x, q.y - ln.b0y) < 1.5;
    along((ln.b0x - ln.a0x) / wl, (ln.b0y - ln.a0y) / wl, q, ln.climb || (ln.climb = spr('webClimb')), atA, atB);
  } else {
    /** @type {any} */
    const vine = h.climb;
    const target = m > 0 ? nx * m * WALK * k * tied : 0;
    // not pushed across: he swings on it like a pendulum about its root (world/sway.js), until it settles
    if (vine && swings(vine) && !r.ground && Math.abs(target) < WALK * k * 0.25) {
      const Lh = clamp(hy - vine.y - hangRootY(vine), 6, vine.len);
      const s = clamp((cx - vine.ox - hangRootX(vine)) / Lh, -1, 1), a = Math.asin(s);
      r.cvx = (r.cvx || 0) + (-GRAVITY * DEV.vineGrav * s * Math.sqrt(1 - s * s) - DEV.vineDamp * r.cvx) * dt;
      if (Math.abs(a) > DEV.vineMax && r.cvx * a > 0) r.cvx = 0;   // the widest it swings
      r.swing = 1;
    } else r.cvx = approach(r.cvx || 0, target, (r.ground ? GROUND_ACC : AIR_ACC) * DEV.autoMoveK * dt);
    r.vy = approach(r.vy, m > 0 ? ny * m * CLIMB * k * tied : 0, 1800 * dt);
  }
}

// the vine he swings on hangs through his hands (old props.js): its angle from his place, its joint at his hands
/** @param {HProp} p @param {number} cx @param {number} top @param {number} cvx */
export function vineHeld(p, cx, top, cvx) {
  const Lh = clamp(top + WEB_HAND - p.y - hangRootY(p), 6, p.len);
  p.sw = clamp(Math.asin(clamp((cx - p.ox - hangRootX(p)) / Lh, -1, 1)), -DEV.vineMax, DEV.vineMax);
  p.swv = cvx / Lh;
  p.sj = Lh;
}

// a line that gives (an arch, a web line) held: it dips under him at his hands (u along it), with a bounce from how fast
// he grabbed it; let go, it springs back and sleeps once still (old props.js lineSway)
/** @param {any} o @param {boolean} held @param {number} u @param {number} vx @param {number} vy @param {number} dt */
export function lineHold(o, held, u, vx, vy, dt) {
  if (held) {
    if (!o.wh) { o.wvx = (o.wvx || 0) + vx * DEV.bendGrab; o.wvy = (o.wvy || 0) + vy * DEV.bendGrab; }
    o.wu = clamp(u, 0.05, 0.95);
  }
  o.wh = held;
  if (held || bendAwake(o)) bendStep(o, 0, held ? DEV.bendDip : 0, DEV.bendK, DEV.bendDamp, DEV.bendMax, dt);
}
