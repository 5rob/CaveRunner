// @ts-check
// CaveRunner Auto (stage: shots, first half): what each shot sheds as it flies in a level, pure. Each mod is
// known by its spell id (`sid`, carried from planCast's Shot by art/scenegun.js shotsOf). The scene
// (art/titlescene.js stepShots) pushes what these return into S.parts (under its own cap); the sprites and
// lights are game/render/autolooks.js. Particle kinds: 'glow' (an added speck that fades), 'fall' (the same,
// falling), 'smoke' (a dark puff that swells), 'fire' (rises, white → orange → red).

import { matchesTarget } from '../spells/discrim.js';
import { DEV } from '../dev/knobs.js';
import { PH, PW } from '../core/consts.js';

export const FX_ROOM = 60;          // trails stop while the scene has fewer than this many particles of room
export const FX_TRAIL = 8;          // positions a shot remembers for its afterimages (Disc Projectile)
export const MISSILE_TURN = 3.2;    // Magic Missile: how hard it turns onto its creature (rad/s)
export const MISSILE_WAIT = 0.12;   // s it flies straight out first
/** @type {Record<string, number>} */
export const SPRAY = { fball: 6, fbolt: 3 };   // fire drops a fireball throws where it lands
/** @type {Record<string, number>} */
export const LIFE_K = { buck: 0.45 };          // short range: Buckshot's life × this

/** @param {string} col @param {number} x @param {number} y @param {number} vx @param {number} vy @param {number} life @param {number} r @param {string} kind @returns {import('../art/titlescene.js').TPart} */
const P = (col, x, y, vx, vy, life, r, kind) => ({ x, y, vx, vy, life, max: life, r, col, kind });

// the particles shot `s` sheds this frame (dt s), R the scene's random
/** @param {import('../art/titlescene.js').TShot} s @param {number} dt @param {() => number} R @returns {import('../art/titlescene.js').TPart[]} */
export function autoTrail(s, dt, R) {
  /** @type {import('../art/titlescene.js').TPart[]} */
  const out = [];
  const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
  /** @param {number} n */
  const ch = n => R() < n * dt;
  /** @param {number} a @param {number} b */
  const rr = (a, b) => a + R() * (b - a);
  switch (s.sid) {
    case 'bolt':      // Noita's spark bolt (the game's v95 look): fading pink plasma, white flecks
      for (let k = 0; k < 2; k++) if (ch(45)) out.push(P(R() < 0.3 ? '#ffffff' : R() < 0.6 ? '#ff9cf5' : '#d86ad0',
        s.x - ux * rr(0, 4) + rr(-1, 1), s.y - uy * rr(0, 4) + rr(-1, 1), rr(-8, 8), rr(-8, 8), rr(0.15, 0.45), rr(0.8, 1.5), 'glow'));
      break;
    case 'spark':     // hot yellow sparks spat backward that drop away
      if (ch(40)) out.push(P(R() < 0.5 ? '#fff6c0' : '#ffd23c', s.x, s.y, -ux * 40 + rr(-50, 50), -uy * 40 + rr(-60, 10), rr(0.15, 0.35), rr(0.7, 1.1), 'fall'));
      break;
    case 'buck':      // the odd metal glint
      if (ch(8)) out.push(P('#e8ecf4', s.x, s.y, rr(-10, 10), rr(-10, 10), 0.1, 0.7, 'glow'));
      break;
    case 'lance':     // blue light peeling off the blade
      if (ch(30)) out.push(P(R() < 0.3 ? '#ffffff' : '#7ad7ff', s.x - ux * rr(0, 12), s.y - uy * rr(0, 12), rr(-10, 10), rr(-10, 10), rr(0.15, 0.35), rr(0.6, 1), 'glow'));
      break;
    case 'blast': {   // smoke behind it as it's thrown; smoke up off the fuse once it rests
      const fx = s.x + Math.cos(s.spin * 0.5 - 1.2) * s.size * 1.7, fy = s.y + Math.sin(s.spin * 0.5 - 1.2) * s.size * 1.7;
      if (sp > 25) { if (ch(30)) out.push(P('#4a4652', s.x - ux * s.size, s.y - uy * s.size, rr(-4, 4), rr(-8, 0), rr(0.5, 0.9), rr(1, 1.8), 'smoke')); }
      else if (ch(9)) out.push(P('#5a5660', fx, fy, rr(-3, 3), rr(-22, -12), rr(0.9, 1.4), rr(0.8, 1.4), 'smoke'));
      if (ch(30)) out.push(P(R() < 0.4 ? '#ffffff' : '#ffb347', fx, fy, rr(-25, 25), rr(-40, 0), rr(0.08, 0.2), rr(0.5, 0.9), 'fall'));
      break;
    }
    case 'arrow': {   // a white streak fading off its path: specks laid along this frame's flight
      const n = Math.min(4, Math.max(1, Math.round(sp * dt / 2)));
      for (let k = 0; k < n; k++) { const f = k / n;
        out.push(P(k % 2 ? '#ffffff' : '#e8ffe0', s.x - s.vx * dt * f, s.y - s.vy * dt * f, 0, 0, 0.22, 0.7, 'glow')); }
      break;
    }
    case 'missile':   // a hot rocket trail: fire at the nozzle going to smoke fast, and a long rope of smoke
      if (ch(60)) out.push(P('#ffb02e', s.x - ux * 4, s.y - uy * 4, -ux * rr(20, 60) + rr(-10, 10), -uy * rr(20, 60) + rr(-10, 10), rr(0.06, 0.14), rr(1, 1.8), 'fire'));
      if (ch(28)) out.push(P('#5a5652', s.x - ux * 5, s.y - uy * 5, rr(-3, 3), rr(-4, 1), rr(1.2, 1.8), rr(0.8, 1.3), 'smoke'));
      break;
    case 'fball': case 'fbolt': case 'flamer': {   // flames licking off it, and smoke
      const big = s.sid === 'fball';
      if (ch(big ? 55 : s.sid === 'flamer' ? 14 : 35)) out.push(P('#ff9a2e', s.x + rr(-s.size, s.size) * 0.6, s.y + rr(-s.size, s.size) * 0.6,
        -ux * 25 + rr(-12, 12), -uy * 25 - rr(5, 25), rr(0.15, 0.35), rr(1, 1.5 + s.size * 0.3), 'fire'));
      if (ch(big ? 14 : s.sid === 'flamer' ? 2 : 6)) out.push(P('#3a3430', s.x - ux * s.size, s.y - uy * s.size, rr(-4, 4), rr(-14, -4), rr(0.8, 1.2), rr(1, 0.8 + s.size * 0.4), 'smoke'));
      break;
    }
    case 'bubble':    // twinkles shed off the skin
      if (ch(12)) out.push(P(R() < 0.5 ? '#ffffff' : '#9fdcff', s.x + rr(-4, 4), s.y + rr(-4, 4), rr(-6, 6), rr(-18, -6), rr(0.3, 0.6), rr(0.6, 1), 'glow'));
      break;
    case 'spit':      // pink drops falling off it (the jellyfish's spit)
      if (ch(30)) out.push(P(R() < 0.3 ? '#ffd0f2' : '#f578dc', s.x + rr(-1, 1), s.y + rr(-1, 1), s.vx * 0.1 + rr(-8, 8), rr(0, 15), rr(0.35, 0.7), rr(0.8, 1.3), 'fall'));
      break;
    case 'eorb': case 'esph': {   // energy crackling off the orb's skin (the sphere's from its rim)
      const r = s.size * (s.sid === 'eorb' ? 1.3 : 2.2);
      if (ch(s.sid === 'eorb' ? 30 : 22)) { const a = rr(0, 6.283);
        out.push(P(R() < 0.35 ? '#ffffff' : s.sid === 'eorb' ? '#8fd2ff' : '#5a9cff', s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, Math.cos(a) * 18 - ux * 10, Math.sin(a) * 18 - uy * 10, rr(0.15, 0.35), rr(0.6, 1), 'glow')); }
      break;
    }
    case 'zap':       // white-blue flecks shaken off the bolt
      if (ch(40)) out.push(P(R() < 0.5 ? '#ffffff' : '#a8e4ff', s.x - ux * rr(0, 30), s.y - uy * rr(0, 30), rr(-30, 30), rr(-30, 30), rr(0.08, 0.2), rr(0.5, 0.8), 'glow'));
      break;
    case 'chain':     // a raging little ball: purple sparks spat every way, dark motes
      if (ch(45)) { const a = rr(0, 6.283), v = rr(25, 60);
        out.push(P(R() < 0.25 ? '#ffffff' : R() < 0.6 ? '#d27aff' : '#8a2cff', s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, rr(0.06, 0.16), rr(0.5, 0.8), 'glow')); }
      if (ch(10)) out.push(P('#20082e', s.x, s.y, rr(-6, 6), rr(-6, 6), rr(0.3, 0.5), rr(0.8, 1.2), 'smoke'));
      break;
    case 'vacfield': { // White Hole: pale-blue motes drawn in from its reach to the core, a white twinkle at the middle
      const rv = s.vac || 64;
      // owner (v1.0.40): spawned over its whole reach, they fly onto it and are sucked in (titlescene.js steps a part with `to`)
      for (let k = 0; k < 3; k++) if (ch(40)) {
        const a = R() * 6.28, d = rv * rr(0.45, 1), v = rr(10, 30);
        const p = P(R() < 0.3 ? '#ffffff' : R() < 0.6 ? '#c8ecff' : '#7cc4ff', s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, -Math.sin(a) * v, Math.cos(a) * v, 2.5, rr(0.8, 1.4), 'glow');
        p.to = s; out.push(p);
      }
      break;
    }
    case 'void': {    // the old game's black-hole trail: purple motes drifting round its rim (as bullets.js, ~0.9 a frame)
      const n = Math.min(3, Math.round(dt * 54 + R() * 0.5));
      for (let k = 0; k < n; k++) { const a = rr(0, 6.283), q = s.size * 2 * rr(0.6, 1.1);   // round the doubled look (autolooks.js VOID_K)
        out.push(P(R() < 0.3 ? '#f0e0ff' : R() < 0.6 ? '#c58cff' : '#8a5cff', s.x + Math.cos(a) * q, s.y + Math.sin(a) * q,
          rr(-10, 10) - Math.sin(a) * 14, rr(-10, 10) + Math.cos(a) * 14, rr(0.6, 1.3), rr(0.8, 1.6), 'glow')); }
      break;
    }
    case 'cross':     // sparkles: white and cyan twinkles left hanging behind it
      if (ch(28)) out.push(P(R() < 0.45 ? '#ffffff' : R() < 0.7 ? '#9ff0ff' : '#23d2ff', s.x + rr(-5, 5), s.y + rr(-5, 5), rr(-6, 6), rr(-6, 6), rr(0.3, 0.7), rr(0.5, 1.1), 'glow'));
      break;
    case 'nuke':      // a green-gold glow behind it, and smoke
      if (ch(40)) out.push(P(R() < 0.4 ? '#ffffff' : R() < 0.7 ? '#ffe066' : '#b4ff5a', s.x - ux * s.size + rr(-2, 2), s.y - uy * s.size + rr(-2, 2), -ux * 20 + rr(-8, 8), -uy * 20 + rr(-8, 8), rr(0.2, 0.4), rr(0.8, 1.4), 'glow'));
      if (ch(14)) out.push(P('#4a4652', s.x - ux * s.size * 1.5, s.y - uy * s.size * 1.5, rr(-4, 4), rr(-8, 0), rr(0.8, 1.2), rr(1.2, 2), 'smoke'));
      break;
    case 'meteor':    // a big burning trail: flames streaming off it, a thick rope of smoke behind
      for (let k = 0; k < 2; k++) if (ch(50)) out.push(P(R() < 0.3 ? '#fff2b0' : '#ff9a2e', s.x - ux * rr(0, s.size * 2) + rr(-s.size, s.size) * 0.6, s.y - uy * rr(0, s.size * 2) + rr(-s.size, s.size) * 0.6,
        -ux * rr(30, 70) + rr(-12, 12), -uy * rr(30, 70) + rr(-15, 5), rr(0.2, 0.45), rr(1.4, 2.4), 'fire'));
      if (ch(30)) out.push(P('#3a3430', s.x - ux * s.size * 2, s.y - uy * s.size * 2, rr(-5, 5), rr(-10, -2), rr(1.2, 1.8), rr(1.6, 2.6), 'smoke'));
      break;
    case 'plasma': case 'ldrill':   // sparks spat where the beam lands
      if (s.bx != null && ch(60)) out.push(P(R() < 0.4 ? '#ffffff' : s.sid === 'plasma' ? '#e07aff' : '#9dff6a', s.bx, s.by2 || 0, rr(-50, 50), rr(-60, 10), rr(0.1, 0.25), rr(0.6, 1), 'fall'));
      break;
    case 'pollen':    // a faint trail of specks
      if (ch(10)) out.push(P(R() < 0.5 ? '#f4ffb0' : '#d8ff6a', s.x, s.y, rr(-4, 4), rr(-4, 4), rr(0.4, 0.8), rr(0.5, 0.9), 'glow'));
      break;
  }
  return out;
}

// a puff of smoke out of the gun's tip as it fires (Slug), at angle `a`
/** @param {string} sid @param {number} x @param {number} y @param {number} a @param {() => number} R @returns {import('../art/titlescene.js').TPart[]} */
export function muzzleFx(sid, x, y, a, R) {
  /** @type {import('../art/titlescene.js').TPart[]} */
  const out = [];
  if (sid !== 'slug') return out;
  for (let k = 0; k < 5; k++) {
    const v = 20 + R() * 40, b = a + (R() - 0.5) * 0.8;
    out.push(P(R() < 0.5 ? '#8a8690' : '#6a6670', x, y, Math.cos(b) * v, Math.sin(b) * v - 6, 0.5 + R() * 0.4, 1.2 + R() * 1.2, 'smoke'));
  }
  out.push(P('#fff2c0', x, y, 0, 0, 0.06, 3, 'glow'));
  return out;
}

// the nearest living creature within maxD of screen point (x, y) (creatures keep world x: scroll subtracted), or null
/** @template {{ x: number, ty: number, hp: number }} F @param {F[]} foes @param {number} x @param {number} y @param {number} scroll @param {number} maxD @returns {F | null} */
export function nearestFoe(foes, x, y, scroll, maxD) {
  let tg = null, td = maxD;
  for (const f of foes) { const d = Math.hypot(f.x - scroll - x, f.ty - y); if (f.hp > 0 && d < td) { td = d; tg = f; } }
  return tg;
}

// a shot turned toward (tx, ty) by at most `turn` radians, its speed kept
/** @param {import('../art/titlescene.js').TShot} s @param {number} tx @param {number} ty @param {number} turn */
export function steerTo(s, tx, ty, turn) {
  const sp = Math.hypot(s.vx, s.vy) || 1, want = Math.atan2(ty - s.y, tx - s.x), a = Math.atan2(s.vy, s.vx);
  const da = Math.atan2(Math.sin(want - a), Math.cos(want - a)), na = a + Math.max(-turn, Math.min(turn, da));
  s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
}

// the fire a fireball throws where it lands: little burning drops in a fan, up and away from the hit (each lights
// what it lands in: the scene's own fire). `fire` = the drops carry fire; sid 'fdrop' so they don't spray again
/** @param {import('../art/titlescene.js').TShot} s @param {() => number} R @returns {import('../art/titlescene.js').TShot[]} */
export function fireSpray(s, R) {
  const n = SPRAY[s.sid || ''] || 0;
  /** @type {import('../art/titlescene.js').TShot[]} */
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / Math.max(1, n - 1) - 0.5) * 2.4 + (R() - 0.5) * 0.4, v = 70 + R() * 70;
    out.push({ x: s.x - s.vx * 0.02, y: s.y - s.vy * 0.02 - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1.5, col: '#ff8a1f', look: 'flame', life: 0.9,
      foe: false, spin: R() * 6, grav: 260, drag: 0.5, explode: 0, pit: 0, fire: 1, bounce: 0, bounceE: 0.5, pierce: 0, dmg: 0.2,
      real: true, by: s.by, sid: 'fdrop', age: 0 });
  }
  return out;
}

// remember where the shot was (newest first), for its afterimages (Disc), the bolt (Lightning Bolt), the streak (Chain Bolt)
/** @type {Record<string, number>} */
export const TRAIL_N = { disc: FX_TRAIL, zap: 12, chain: 4 };
/** @param {import('../art/titlescene.js').TShot} s */
export function keepTrail(s) {
  const n = TRAIL_N[s.sid || ''];
  if (!n) return;
  const t = s.tr || (s.tr = []);
  t.unshift(s.x, s.y);
  if (t.length > n * 2) t.length = n * 2;
}

// a lightning bolt's fork (the old game's lightningStep, looks only here): a jagged arc from the bolt's head to the
// nearest creature within ZAP_FORK, else a short throw off to the side; null when it doesn't fork this frame
export const ZAP_FORK = 90;
/** @template {{ x: number, ty: number, hp: number }} F @param {import('../art/titlescene.js').TShot} s @param {F[]} foes @param {number} scroll @param {number} dt @param {() => number} R @returns {{ x: number, y: number }[] | null} */
export function zapFork(s, foes, scroll, dt, R) {
  if (s.sid !== 'zap' || R() > dt * 22) return null;
  const f = nearestFoe(foes, s.x, s.y, scroll, ZAP_FORK);
  const a = Math.atan2(s.vy, s.vx) + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.9), d = 14 + R() * 18;
  const x1 = f ? f.x - scroll : s.x + Math.cos(a) * d, y1 = f ? f.ty : s.y + Math.sin(a) * d;
  return jagPts(s.x, s.y, x1, y1, 4, R);
}
// a zig-zag from (x0, y0) to (x1, y1): a kink every ~8 units knocked sideways up to amp (the game's jag)
/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} amp @param {() => number} R */
export function jagPts(x0, y0, x1, y1, amp, R) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, n = Math.max(2, Math.min(20, Math.round(d / 8))), px = -dy / d, py = dx / d;
  const pts = [{ x: x0, y: y0 }];
  for (let k = 1; k < n; k++) { const f = k / n, o = (R() - 0.5) * 2 * amp; pts.push({ x: x0 + dx * f + px * o, y: y0 + dy * f + py * o }); }
  pts.push({ x: x1, y: y1 });
  return pts;
}

// a beam (Plasma Beam, Luminous Drill) traced once, the frame it's cast: from its spot along its angle to its length
// or the first rock. solid(x, y) is the scene's rock test. The end, and whether it hit rock
/** @param {import('../art/titlescene.js').TShot} s @param {(x: number, y: number) => boolean} solid */
export function traceBeam(s, solid) {
  const a = s.ang || 0, L = s.beam || 0, cx = Math.cos(a), cy = Math.sin(a);
  for (let d = 3; d <= L; d += 2) if (solid(s.x + cx * d, s.y + cy * d)) return { x: s.x + cx * d, y: s.y + cy * d, rock: true, len: d };
  return { x: s.x + cx * L, y: s.y + cy * L, rock: false, len: L };
}

// a nuke's or meteor's blast, the look (the gameplay radius stays the shot's): a fireball of flame, smoke rolling
// out, hot debris thrown up and falling. r = the blast's radius. At most BIG_BOOM_PARTS (phone)
export const BIG_BOOM_PARTS = 70;
/** @param {string} sid @param {number} x @param {number} y @param {number} r @param {() => number} R @returns {import('../art/titlescene.js').TPart[]} */
export function bigBoomFx(sid, x, y, r, R) {
  /** @type {import('../art/titlescene.js').TPart[]} */
  const out = [];
  if (sid !== 'nuke' && sid !== 'meteor') return out;
  const hot = sid === 'nuke' ? ['#ffffff', '#fff6a0', '#d8ff6a', '#ffb02e'] : ['#ffffff', '#ffd35a', '#ff9a2e', '#ff5a1a'];
  for (let k = 0; k < 30; k++) { const a = R() * 6.283, v = 30 + R() * 110;
    out.push(P(hot[Math.floor(R() * 4)], x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, Math.cos(a) * v, Math.sin(a) * v - 30, 0.4 + R() * 0.5, 1.5 + R() * 2, 'fire')); }
  for (let k = 0; k < 16; k++) { const a = R() * 6.283, v = 15 + R() * 40;
    out.push(P(R() < 0.5 ? '#3a3346' : '#5a5660', x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, Math.cos(a) * v, Math.sin(a) * v - 15, 1.2 + R(), 2 + R() * 2.5, 'smoke')); }
  for (let k = 0; k < 24; k++) { const a = -Math.PI / 2 + (R() - 0.5) * 2.8, v = 80 + R() * 160;
    out.push(P(R() < 0.4 ? '#ffffff' : hot[1 + Math.floor(R() * 3)], x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5 + R() * 0.7, 0.6 + R() * 0.6, 'fall')); }
  return out.slice(0, BIG_BOOM_PARTS);
}
// how long a boom's look lasts, and how much bigger it draws than the blast (nuke and meteor: much more)
/** @param {string} [sid] */
export const boomLook = sid => sid === 'nuke' ? { max: 1.1, k: 2.4 } : sid === 'meteor' ? { max: 0.9, k: 2 } : { max: 0.38, k: 1 };

// Black Hole's pull (owner, v1.0.40), as the old game's (game/systems/bullets.js): creatures within reach are hauled
// in, harder the closer they are, never past the centre; enemy shots near it bend in, and are swallowed at its edge.
// `reach` is DEV.bhPull × pull / 70. Mutates the creatures and the shots; returns the swallowed shots' places.
/** @param {import('../art/titlescene.js').TShot} s @param {{ x: number, y: number, ty: number, hp: number }[]} foes @param {number} scroll @param {import('../art/titlescene.js').TShot[]} shots @param {number} dt @param {number} reach @returns {{x: number, y: number}[]} */
export function holePull(s, foes, scroll, shots, dt, reach) {
  for (const f of foes) {
    if (!(f.hp > 0)) continue;
    const dx = s.x - (f.x - scroll), dy = s.y - f.ty, d = Math.hypot(dx, dy) || 1;
    if (d < reach) {
      const v = Math.min(d / dt, 60 + 420 * (1 - d / reach));
      f.x += dx / d * v * dt; f.y += dy / d * v * dt; f.ty += dy / d * v * dt;
    }
  }
  const ate = [];
  for (const q of shots) {
    if (!q.foe || q.life <= 0) continue;
    const dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy) || 1;
    if (d < s.size + 6) { q.life = 0; ate.push({ x: q.x, y: q.y }); }
    else if (d < reach) { q.vx += dx / d * 900 * dt; q.vy += dy / d * 900 * dt; }
  }
  return ate;
}

// White Hole (owner, v1.0.40; the game's 'vacuum' field, game/systems/fields.js): a steady strong pull into its middle,
// through walls, harming nothing. Creatures within `s.vac` are hauled in at `pull` units/s at the edge (faster further
// in) and held at the middle; enemy shots are bent in and slowed, so they settle rather than swing through.
/** @param {import('../art/titlescene.js').TShot} s @param {{ x: number, y: number, ty: number, hp: number, k?: { id: string } }[]} foes @param {number} scroll @param {import('../art/titlescene.js').TShot[]} shots @param {number} dt @param {number} pull @param {Coin[]} [coins] @param {import('../art/titlescene.js').TLoot[]} [loot] @param {{ x: number, y: number, id: number, out?: boolean }[]} [runners] */
export function vacPull(s, foes, scroll, shots, dt, pull, coins, loot, runners) {
  const reach = s.vac || 64, only = s.only || null;
  /** @param {number} d */
  const sp = d => pull * (0.35 + 0.65 * (1 - d / reach));
  // Discriminate (owner, v1.0.71): a White Hole carrying `only` pulls that and nothing else: one creature kind,
  // or gold nuggets (coins, world coords), or red / green crystal pickups (loot, world coords)
  if (!only || only.kind === 'creature') for (const f of foes) {
    if (!(f.hp > 0)) continue;
    if (only && !matchesTarget(only, { kind: 'creature', id: f.k ? f.k.id : '' })) continue;
    const dx = s.x - (f.x - scroll), dy = s.y - f.ty, d = Math.hypot(dx, dy) || 1;
    if (d < reach) { const m = Math.min(d, sp(d) * dt); f.x += dx / d * m; f.y += dy / d * m; f.ty += dy / d * m; }
  }
  if (only && only.kind === 'object') {
    /** @type {{ x: number, y: number, vx?: number, vy?: number }[]} */
    const things = only.id === 'gold' ? (coins || []) : (loot || []).filter(g => g.it && g.it.kind === only.id);
    for (const g of things) {
      const dx = s.x + scroll - g.x, dy = s.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (d >= reach) continue;
      const m = Math.min(d, sp(d) * dt);
      g.x += dx / d * m; g.y += dy / d * m; g.vx = 0; g.vy = 0;   // held at the middle (its own fall can't win)
    }
  }
  // Discriminate:Pn: player n's runner (id n - 1) drawn gently in, DEV.autoDiscPull units a second
  if (only && only.kind === 'player') for (const r of runners || []) {
    if (r.out || r.id !== Number(only.id) - 1) continue;
    const dx = s.x - (r.x + PW / 2), dy = s.y - (r.y + PH / 2), d = Math.hypot(dx, dy) || 1;
    if (d < reach) { const m = Math.min(d, DEV.autoDiscPull * dt); r.x += dx / d * m; r.y += dy / d * m; }
  }
  if (!only) for (const q of shots) {
    if (!q.foe || q.life <= 0) continue;
    const dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy) || 1;
    if (d < reach) { const k = Math.exp(-4 * dt); q.vx = q.vx * k + dx / d * 900 * dt; q.vy = q.vy * k + dy / d * 900 * dt; }
  }
}
