// @ts-check
// What each Noita-style shot sheds as it flies, bounces, grinds and dies (v95 spell looks):
// glowing dparts, chips and puffs. The draw side (drawLook) is still in Game's draw().

import { SFX } from '../../audio/sfx.js';
import { CELL, CH, CW } from '../../core/consts.js';
import { FIRE_COLS } from '../../world/fire.js';

// ---- v95 spell looks: what each Noita-style shot sheds as it flies, bounces and dies.
// Trails are glowing dparts (drawn after the fog, only where it has lifted), chips are
// sparks, puffs are smoke. `look` is set on the spell in MODS.
/** @param {World} W @param {number} x @param {number} y @param {number} vx @param {number} vy @param {string} c @param {number} s @param {number} life @param {number} [g] */
export const glowDot = (W, x, y, vx, vy, c, s, life, g) =>
  W.dparts.push({ x, y, vx, vy, g: g || 0, c, s, life, max: life, glow: 1 });
/** @param {number} a @param {number} b */
export const rnd = (a, b) => a + Math.random() * (b - a);
/** @param {World} W @param {Bullet} b @param {number} dt */
export function shotTrail(W, b, dt) {
  const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
  const chance = n => Math.random() < n * dt;
  if (L === 'spark') {                    // fading pink plasma, a few specks a frame
    if (chance(70)) glowDot(W, b.x + rnd(-1, 1), b.y + rnd(-1, 1), rnd(-8, 8), rnd(-8, 8),
      Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.6 ? '#ff9cf5' : '#d86ad0', rnd(0.8, 1.5), rnd(0.12, 0.5));
  } else if (L === 'crackle') {           // hot yellow sparks that drop away
    if (chance(22)) glowDot(W, b.x, b.y, -ux * 40 + rnd(-50, 50), -uy * 40 + rnd(-60, 20),
      Math.random() < 0.5 ? '#fff6c0' : '#ffd23c', rnd(0.7, 1.1), rnd(0.15, 0.35), 0.5);
  } else if (L === 'ember') {             // green flames licking off the pellet
    if (chance(40)) glowDot(W, b.x + rnd(-1, 1), b.y + rnd(-1, 1), -ux * 20 + rnd(-10, 10), -uy * 20 - rnd(5, 25),
      Math.random() < 0.4 ? '#e6ffc8' : '#8dff5a', rnd(0.7, 1.3), rnd(0.1, 0.25), -0.02);
  } else if (L === 'glob') {              // the odd pink drip
    if (chance(10)) glowDot(W, b.x, b.y, b.vx * 0.2, b.vy * 0.2, '#f578dc', rnd(0.8, 1.2), rnd(0.3, 0.6), 0.6);
  } else if (L === 'bubble') {            // tiny fizz off the skin
    if (chance(6)) glowDot(W, b.x + rnd(-3, 3), b.y + rnd(-3, 3), rnd(-6, 6), rnd(-20, -8),
      '#bfe8ff', rnd(0.6, 1), rnd(0.3, 0.6));
  } else if (L === 'arrow') {             // green sparks hanging in the air behind it
    if (chance(35)) glowDot(W, b.x - ux * 3, b.y - uy * 3, rnd(-6, 6), rnd(-6, 6),
      Math.random() < 0.3 ? '#e8ffd8' : '#78ff50', rnd(0.7, 1.2), rnd(0.5, 1.1), 0.03);
  } else if (L === 'drill') {             // a puff of blue smoke
    if (chance(18)) W.smoke.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-12, 4), r: rnd(1.2, 2.2),
      life: 0.5, max: 0.5, c: '#4e7fc8', a: 0.4 });
  } else if (L === 'sparks') {            // it IS its trail: a streak of blue sparks
    const n = Math.min(8, Math.max(1, Math.round(sp * dt / 3)));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      glowDot(W, b.x - b.vx * dt * f + rnd(-1, 1), b.y - b.vy * dt * f + rnd(-1, 1), rnd(-15, 15), rnd(-15, 15),
        Math.random() < 0.3 ? '#ffffff' : '#8fe8ff', rnd(0.8, 1.4), rnd(0.3, 0.6));
    }
  } else if (L === 'heavy') {             // Magic Bolt: green and yellow sparks spat backward
    if (chance(45)) glowDot(W, b.x, b.y, -ux * rnd(20, 60) + rnd(-25, 25), -uy * rnd(20, 60) + rnd(-25, 25),
      Math.random() < 0.5 ? '#c8ff5a' : '#ffe84a', rnd(0.8, 1.3), rnd(0.2, 0.45), 0.3);
  } else if (L === 'lance') {             // sparks of its own colour peeling off the shaft
    if (chance(40)) glowDot(W, b.x - ux * rnd(0, 8), b.y - uy * rnd(0, 8), rnd(-12, 12), rnd(-12, 12),
      Math.random() < 0.3 ? '#ffffff' : b.col, rnd(0.7, 1.1), rnd(0.2, 0.5), 0.05);
  } else if (L === 'rubber') {            // fading green plasma
    if (chance(30)) glowDot(W, b.x, b.y, rnd(-5, 5), rnd(-5, 5), Math.random() < 0.5 ? '#9ef07a' : '#5ad05a', rnd(0.8, 1.3), rnd(0.2, 0.45));
  } else if (L === 'bomb') {              // the fuse fizzing
    const fx = b.x + Math.cos(b.spin * 0.5 - 1.2) * b.size, fy = b.y + Math.sin(b.spin * 0.5 - 1.2) * b.size;
    if (chance(40)) glowDot(W, fx, fy, rnd(-30, 30), rnd(-50, 0), Math.random() < 0.4 ? '#ffffff' : '#ffb347', rnd(0.6, 1), rnd(0.1, 0.25), 0.4);
  } else if (L === 'rocket') {            // exhaust: sparks and a rope of grey smoke
    if (chance(50)) glowDot(W, b.x - ux * 4, b.y - uy * 4, -ux * rnd(30, 90) + rnd(-15, 15), -uy * rnd(30, 90) + rnd(-15, 15),
      FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.3), rnd(0.08, 0.2));
    if (chance(25)) W.smoke.push({ x: b.x - ux * 5, y: b.y - uy * 5, vx: rnd(-6, 6), vy: rnd(-8, 2), r: rnd(1.2, 2.4),
      life: 0.9, max: 0.9, c: '#5a5652', a: 0.4 });
  } else if (L === 'flame') {             // fire licking up off it, and smoke off the big ones
    const big = b.size >= 4;
    if (chance(big ? 70 : 40)) glowDot(W, b.x + rnd(-b.size, b.size), b.y + rnd(-b.size, b.size), -ux * 20 + rnd(-15, 15), -uy * 20 - rnd(10, 40),
      FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.2 + b.size * 0.2), rnd(0.12, 0.35), -0.03);
    if (chance(big ? 14 : 5)) W.smoke.push({ x: b.x, y: b.y, vx: rnd(-6, 6), vy: rnd(-14, -4), r: rnd(1.5, 1 + b.size * 0.6),
      life: 1, max: 1, c: '#3a3430', a: 0.35 });
  } else if (L === 'orb') {               // fading plasma of its colour
    if (chance(35)) glowDot(W, b.x + rnd(-b.size, b.size) * 0.6, b.y + rnd(-b.size, b.size) * 0.6, rnd(-6, 6), rnd(-6, 6),
      Math.random() < 0.3 ? '#e8f4ff' : b.col, rnd(0.8, 1.4), rnd(0.2, 0.5));
  } else if (L === 'chain') {             // bright violet sparks jumping off it
    if (chance(35)) glowDot(W, b.x, b.y, rnd(-60, 60), rnd(-60, 60), Math.random() < 0.3 ? '#ffffff' : '#e0a0ff', rnd(0.7, 1.1), rnd(0.08, 0.2));
  } else if (L === 'cross') {             // cyan plasma off its arms
    if (chance(25)) { const a = b.spin * 0.8 + Math.floor(Math.random() * 4) * 1.571;
      glowDot(W, b.x + Math.cos(a) * b.size * 1.6, b.y + Math.sin(a) * b.size * 1.6, rnd(-6, 6), rnd(-6, 6), b.col, rnd(0.8, 1.2), rnd(0.2, 0.4)); }
  } else if (L === 'nuke') {              // dripping radioactive green, and smoke
    if (chance(20)) glowDot(W, b.x, b.y + b.size * 0.6, b.vx * 0.1, b.vy * 0.1, Math.random() < 0.5 ? '#b4ff5a' : '#6adf3a', rnd(1, 1.6), rnd(0.5, 0.9), 0.6);
    if (chance(10)) W.smoke.push({ x: b.x - ux * 6, y: b.y - uy * 6, vx: rnd(-5, 5), vy: rnd(-10, 0), r: rnd(2, 3), life: 1, max: 1, c: '#4a4a40', a: 0.35 });
  } else if (L === 'pollen') {            // yellow dust drifting off it
    if (chance(8)) glowDot(W, b.x + rnd(-2, 2), b.y + rnd(-2, 2), rnd(-5, 5), rnd(-8, 2),
      '#e8ff9a', rnd(0.6, 0.9), rnd(0.4, 0.8), -0.01);
  }
}
/** @param {World} W @param {Bullet} b */
export function shotBounce(W, b) {
  const L = b.look;
  if (L === 'glob') for (let k = 0; k < 2; k++)
    glowDot(W, b.x, b.y, rnd(-40, 40), rnd(-50, -10), '#f578dc', 1, rnd(0.15, 0.3), 0.6);
  else if (L === 'bubble') glowDot(W, b.x, b.y, 0, 0, '#bfe8ff', 1.4, 0.12);
  else if (L === 'ember') for (let k = 0; k < 3; k++)
    glowDot(W, b.x, b.y, rnd(-60, 60), rnd(-60, -10), '#8dff5a', 1, rnd(0.1, 0.25), 0.4);
  else if ((L === 'disc' || L === 'flame' || L === 'rubber' || L === 'orb') && Math.hypot(b.vx, b.vy) > 60)
    for (let k = 0; k < (L === 'disc' ? 5 : 2); k++)            // a saw skipping off rock throws sparks
      glowDot(W, b.x, b.y, rnd(-70, 70), rnd(-80, -10), L === 'disc' ? (Math.random() < 0.5 ? '#ffe7a0' : '#ffb347') : L === 'flame' ? '#ffb347' : b.col,
        rnd(0.7, 1.1), rnd(0.1, 0.25), 0.5);
}
/** @param {World} W @param {Bullet} b */
export function shotDeath(W, b) {
  const L = b.look;
  if (L === 'bubble') {                   // it pops: a ring of droplets
    SFX.pop(b.x, b.y);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283;
      glowDot(W, b.x + Math.cos(a) * b.size, b.y + Math.sin(a) * b.size, Math.cos(a) * 45, Math.sin(a) * 45,
        '#bfe8ff', 1, rnd(0.15, 0.3), 0.3); }
  } else if (L === 'spark' || L === 'arrow' || L === 'crackle') {
    const c = L === 'spark' ? '#ff9cf5' : L === 'arrow' ? '#78ff50' : '#ffe066';
    for (let k = 0; k < 5; k++) glowDot(W, b.x, b.y, rnd(-70, 70), rnd(-70, 40), k ? c : '#ffffff', 1, rnd(0.12, 0.3), 0.3);
  } else if (L === 'glob') {
    for (let k = 0; k < 4; k++) glowDot(W, b.x, b.y, rnd(-50, 50), rnd(-60, 0), '#f578dc', 1.1, rnd(0.2, 0.4), 0.6);
  } else if (L === 'orb' || L === 'chain' || L === 'rubber' || L === 'heavy') {   // bursts into its own sparks
    for (let k = 0; k < 7; k++) glowDot(W, b.x, b.y, rnd(-80, 80), rnd(-80, 60), k ? b.col : '#ffffff', rnd(0.8, 1.3), rnd(0.15, 0.35), 0.3);
  }
}
// a digging bolt chewing rock: chips of whatever it's chewing thrown back out
/** @param {World} W @param {Bullet} b @param {number} x @param {number} y */
export function shotGrind(W, b, x, y) {
  if (b.look !== 'drill' || Math.random() < 0.5) return;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || !W.mat[cy * CW + cx]) return;
  const k = (cy * CW + cx) * 4, d = W.img.data, sp = Math.hypot(b.vx, b.vy) || 1;
  W.sparks.push({ x, y, vx: -b.vx / sp * rnd(40, 110) + rnd(-50, 50), vy: -b.vy / sp * rnd(40, 110) - rnd(20, 70),
    life: rnd(0.4, 0.8), max: 0.8, c: 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')', size: rnd(1, 1.8), heavy: true });
}
