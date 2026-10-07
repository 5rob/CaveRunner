// @ts-check
// The title screen's background (LIST4 #4): a cave scrolling by, jetpacking runners blasting
// flying creatures, explosions, gold spraying, screen shake. titleScene makes it, titleStep moves
// it (pure: its own seeded random, no canvas, so a logic suite can run it), titleDraw paints it
// with the game's own painters (drawRunner, drawGun, jetFlame, the creatures, drawNugget) and the
// big pixel-font title over it. ui/title.js runs it on one requestAnimationFrame.

import { PW, PH } from '../core/consts.js';
import { CREATURES } from '../data/creatures.js';
import { drawBlob, drawDrone, drawSkull } from '../creatures/classic.js';
import { drawGun, drawNugget, drawRunner, jetFlame, pixelSprite } from './sprites.js';
import { pixText, pixWidth } from './pixfont.js';

export const TITLE_VW = 220;          // world units across the screen
export const TITLE_RUNNERS = 4;
export const TITLE_FOES = 9;         // at most this many creatures at once
export const TITLE_PARTS = 320;       // particle cap
export const TITLE_GOLD = 90;         // nugget cap
const SCROLL = 34;                    // the cave's scroll speed (world units / s)
const GRAV = 260;
// the runners' guns: shot colour, gun accent, how it fires
const KITS = [
  { col: '#5ff3ff', acc: '#5ff3ff', cd: 0.16, n: 1, spd: 380, r: 1.4, kind: 'bolt' },
  { col: '#ff5ff0', acc: '#ff5ff0', cd: 0.5, n: 5, spd: 300, r: 1.2, kind: 'pellet' },
  { col: '#ffb02e', acc: '#ffb02e', cd: 0.9, n: 1, spd: 170, r: 4, kind: 'plasma' },
  { col: '#9dff5a', acc: '#9dff5a', cd: 1.1, n: 1, spd: 0, r: 0, kind: 'zap' },
];
const FLYERS = Object.keys(CREATURES).filter(k => ['drone', 'skull', 'blob'].includes(CREATURES[k].body));

/** @typedef {{ x: number, y: number, vx: number, vy: number, tx: number, ty: number, face: number, ang: number, cd: number, kit: number, flame: number, retarget: number }} TRunner */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, hp: number, k: string, flash: number, phase: number, cd: number }} TFoe */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, col: string, kind: string, life: number, foe: boolean }} TShot */
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, r: number, col: string, kind: string }} TPart */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, seed: number, ang: number, spin: number, life: number, ground: boolean }} TGold */
/** @typedef {{ x: number, y: number, r: number, t: number, max: number }} TBoom */
/** @typedef {{ pts: { x: number, y: number }[], t: number, col: string }} TZap */
/** @typedef {{ t: number, vh: number, top: number, bot: number, seed: number, rnd: () => number, scroll: number, shake: number, spawn: number,
 *   kills: number, gold: number, runners: TRunner[], foes: TFoe[], shots: TShot[], parts: TPart[], nuggets: TGold[],
 *   booms: TBoom[], zaps: TZap[], flash: number }} TitleScene */

/** @param {number} seed @returns {() => number} a seeded random 0..1 (mulberry32) */
export function titleRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the cave's ceiling and floor at world x (scrolled), for a parallax layer: sums of sines
// B: the band the action keeps to (top, bot in world units: under the title, over the menu)
/** @param {number} x @param {number} layer 0 far .. 2 near @param {{ top: number, bot: number }} B */
export const titleFloor = (x, layer, B) => B.bot + 4 - layer * 5 + Math.sin(x * 0.021 + layer * 2) * 9 + Math.sin(x * 0.057 + layer) * 5 + Math.sin(x * 0.13) * 2;
/** @param {number} x @param {number} layer @param {{ top: number, bot: number }} B */
export const titleCeil = (x, layer, B) => B.top - 14 + layer * 5 + Math.sin(x * 0.018 + layer * 3) * 10 + Math.sin(x * 0.049 + 1 + layer) * 6 + Math.sin(x * 0.11) * 2;
/** @param {TitleScene} S @param {number} k 0 the band's top .. 1 its bottom */
const bandY = (S, k) => S.top + (S.bot - S.top) * k;

/** @param {number} vh the view's height in world units @param {number} [seed] @param {number} [top] the action's band (world units) @param {number} [bot] @returns {TitleScene} */
export function titleScene(vh, seed = 7, top = vh * 0.26, bot = vh * 0.6) {
  const rnd = titleRng(seed);
  const S = { t: 0, vh, top, bot, seed, rnd, scroll: 0, shake: 0, spawn: 0, kills: 0, gold: 0, runners: [], foes: [], shots: [],
    parts: [], nuggets: [], booms: [], zaps: [], flash: 0 };
  for (let i = 0; i < TITLE_RUNNERS; i++) {
    const x = 20 + rnd() * 80, y = bandY(S, 0.1 + 0.6 * rnd());
    S.runners.push({ x, y, vx: 0, vy: 0, tx: x, ty: y, face: 1, ang: 0, cd: rnd(), kit: i % KITS.length, flame: 0, retarget: 0 });
  }
  for (let i = 0; i < 4; i++) addFoe(S, 120 + rnd() * 90);
  return S;
}

/** @param {TitleScene} S @param {number} [x] */
function addFoe(S, x) {
  const k = FLYERS[Math.floor(S.rnd() * FLYERS.length)] || 'hiisi', C = CREATURES[k];
  S.foes.push({ x: x === undefined ? TITLE_VW + 20 : x, y: bandY(S, 0.12 + 0.72 * S.rnd()), vx: -(20 + S.rnd() * 26), vy: 0,
    r: (C.r || 9) * (0.9 + S.rnd() * 0.4), hp: 3 + Math.floor(S.rnd() * 5), k, flash: 0, phase: S.rnd() * 6.28, cd: 1 + S.rnd() * 2 });
}

/** @param {TitleScene} S @param {number} x @param {number} y @param {number} n @param {string} col @param {number} spd @param {string} kind @param {number} life */
function burst(S, x, y, n, col, spd, kind, life) {
  for (let i = 0; i < n && S.parts.length < TITLE_PARTS; i++) {
    const a = S.rnd() * Math.PI * 2, v = spd * (0.25 + S.rnd());
    const l = life * (0.5 + S.rnd() * 0.7);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'smoke' ? 20 : 0), life: l, max: l,
      r: kind === 'smoke' ? 3 + S.rnd() * 4 : kind === 'fire' ? 1.5 + S.rnd() * 2.5 : 0.6 + S.rnd() * 0.8, col, kind });
  }
}

/** @param {TitleScene} S @param {TFoe} f */
function killFoe(S, f) {
  f.hp = 0;
  S.kills++;
  S.booms.push({ x: f.x, y: f.y, r: f.r * 3.2, t: 0, max: 0.45 });
  burst(S, f.x, f.y, 26, '#ffd27a', 120, 'fire', 0.6);
  burst(S, f.x, f.y, 10, '#ffffff', 200, 'spark', 0.35);
  burst(S, f.x, f.y, 8, '#3a3346', 30, 'smoke', 1.4);
  burst(S, f.x, f.y, 6, CREATURES[f.k].col.a, 90, 'chunk', 0.9);
  S.shake = Math.min(7, S.shake + 3.5);
  S.flash = Math.min(0.35, S.flash + 0.18);
  const n = 6 + Math.floor(S.rnd() * 8);
  for (let i = 0; i < n && S.nuggets.length < TITLE_GOLD; i++) {
    const a = -Math.PI / 2 + (S.rnd() - 0.5) * 2.2, v = 70 + S.rnd() * 110;
    S.nuggets.push({ x: f.x, y: f.y, vx: Math.cos(a) * v + f.vx, vy: Math.sin(a) * v, r: 1.2 + S.rnd() * 1.3, seed: S.rnd() * 99,
      ang: S.rnd() * 6, spin: (S.rnd() - 0.5) * 14, life: 2.6 + S.rnd() * 1.5, ground: false });
    S.gold++;
  }
}

/** @param {TitleScene} S @param {TFoe} f @param {number} dmg @param {string} col */
function hitFoe(S, f, dmg, col) {
  if (f.hp <= 0) return;
  f.hp -= dmg; f.flash = 0.08;
  burst(S, f.x, f.y, 5, col, 80, 'spark', 0.25);
  if (f.hp <= 0) killFoe(S, f);
}

/** @param {TitleScene} S @param {number} dt seconds */
export function titleStep(S, dt) {
  dt = Math.min(dt, 0.05);
  const R = S.rnd;
  S.t += dt; S.scroll += SCROLL * dt;
  S.shake = Math.max(0, S.shake - dt * 18);
  S.flash = Math.max(0, S.flash - dt * 1.6);
  // creatures keep coming from the right
  S.spawn -= dt;
  if (S.spawn <= 0 && S.foes.length < TITLE_FOES) { addFoe(S); S.spawn = 0.3 + R() * 0.7; }
  // runners: wander about the left two thirds, aim at the nearest creature, fire their kit
  for (const r of S.runners) {
    r.retarget -= dt;
    if (r.retarget <= 0 || Math.hypot(r.tx - r.x, r.ty - r.y) < 6) {
      r.tx = 12 + R() * (TITLE_VW * 0.55); r.ty = bandY(S, 0.05 + R() * 0.6); r.retarget = 1 + R() * 2;
    }
    const ax = (r.tx - r.x) * 2.2 - r.vx * 1.6, ay = (r.ty - r.y) * 2.2 - r.vy * 1.6;
    r.vx += ax * dt; r.vy += ay * dt;
    r.x += r.vx * dt; r.y += r.vy * dt;
    r.flame = Math.max(0, Math.min(1, -ay / 60 + 0.35));
    let best = null, bd = 1e9;
    for (const f of S.foes) { const d = Math.hypot(f.x - r.x, f.y - r.y); if (f.hp > 0 && f.x < TITLE_VW + 5 && d < bd) { bd = d; best = f; } }
    if (best) {
      const want = Math.atan2(best.y - (r.y + PH * 0.45), best.x - (r.x + PW / 2));
      let d = want - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      r.ang += d * Math.min(1, dt * 10);
    }
    r.face = Math.cos(r.ang) >= 0 ? 1 : -1;
    r.cd -= dt;
    if (best && r.cd <= 0) {
      const K = KITS[r.kit], gx = r.x + PW / 2 + Math.cos(r.ang) * 9, gy = r.y + PH * 0.45 + Math.sin(r.ang) * 9;
      r.cd = K.cd * (0.8 + R() * 0.4);
      if (K.kind === 'zap') {
        // a lightning arc straight into the nearest creature
        const pts = [{ x: gx, y: gy }];
        for (let i = 1; i < 7; i++) {
          const k = i / 7;
          pts.push({ x: gx + (best.x - gx) * k + (R() - 0.5) * 10, y: gy + (best.y - gy) * k + (R() - 0.5) * 10 });
        }
        pts.push({ x: best.x, y: best.y });
        S.zaps.push({ pts, t: 0.16, col: K.col });
        hitFoe(S, best, 3, K.col);
      } else {
        for (let i = 0; i < K.n; i++) {
          const a = r.ang + (K.n > 1 ? (i / (K.n - 1) - 0.5) * 0.5 : 0) + (R() - 0.5) * 0.05;
          S.shots.push({ x: gx, y: gy, vx: Math.cos(a) * K.spd, vy: Math.sin(a) * K.spd, r: K.r, col: K.col, kind: K.kind, life: 1.4, foe: false });
        }
        burst(S, gx, gy, 3, K.col, 40, 'spark', 0.12);
      }
    }
  }
  // creatures: drift left, bob, now and then spit at the runners
  for (const f of S.foes) {
    f.flash = Math.max(0, f.flash - dt);
    f.vy = Math.sin(S.t * 2 + f.phase) * 18;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.cd -= dt;
    if (f.cd <= 0 && f.x < TITLE_VW) {
      f.cd = 1.5 + R() * 2.5;
      const tg = S.runners[Math.floor(R() * S.runners.length)];
      const a = Math.atan2(tg.y + PH / 2 - f.y, tg.x + PW / 2 - f.x);
      S.shots.push({ x: f.x, y: f.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, r: 2, col: '#ff3b3b', kind: 'orb', life: 2, foe: true });
    }
  }
  S.foes = S.foes.filter(f => f.hp > 0 && f.x > -30);
  // shots
  for (const s of S.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.kind === 'plasma') burst(S, s.x, s.y, 1, '#ff7a1a', 15, 'fire', 0.3);
    if (s.foe) {
      for (const r of S.runners) if (Math.abs(r.x + PW / 2 - s.x) < 7 && Math.abs(r.y + PH / 2 - s.y) < 11) { s.life = 0; burst(S, s.x, s.y, 6, '#ff8080', 60, 'spark', 0.25); }
      continue;
    }
    for (const f of S.foes) {
      if (f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < f.r + s.r) {
        s.life = 0;
        if (s.kind === 'plasma') {
          S.booms.push({ x: s.x, y: s.y, r: 22, t: 0, max: 0.35 });
          burst(S, s.x, s.y, 14, '#ffb02e', 90, 'fire', 0.5);
          S.shake = Math.min(7, S.shake + 1.5);
          for (const g of S.foes) if (Math.hypot(g.x - s.x, g.y - s.y) < 26) hitFoe(S, g, 4, s.col);
        } else hitFoe(S, f, s.kind === 'pellet' ? 1 : 1.5, s.col);
        break;
      }
    }
    if (s.y < titleCeil(s.x + S.scroll, 2, S) || s.y > titleFloor(s.x + S.scroll, 2, S)) {
      s.life = 0; burst(S, s.x, s.y, 4, '#c9b8a0', 50, 'spark', 0.3);
    }
  }
  S.shots = S.shots.filter(s => s.life > 0 && s.x > -10 && s.x < TITLE_VW + 30);
  // particles
  for (const p of S.parts) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const drag = p.kind === 'smoke' ? 1.5 : 3;
    p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
    if (p.kind === 'chunk') p.vy += GRAV * 0.6 * dt;
    if (p.kind === 'fire') p.vy -= 30 * dt;
    p.x -= (p.kind === 'smoke' ? SCROLL * 0.3 : 0) * dt;
  }
  S.parts = S.parts.filter(p => p.life > 0);
  // the gold: flies, falls, bounces on the floor and rides away with it
  for (const g of S.nuggets) {
    g.life -= dt;
    if (!g.ground) {
      g.vy += GRAV * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.ang += g.spin * dt;
      const fl = titleFloor(g.x + S.scroll, 2, S) - g.r;
      if (g.y > fl) { g.y = fl; g.vy *= -0.45; g.vx *= 0.6; if (Math.abs(g.vy) < 25) g.ground = true; }
    } else { g.x -= SCROLL * dt; g.y = titleFloor(g.x + S.scroll, 2, S) - g.r; }
  }
  S.nuggets = S.nuggets.filter(g => g.life > 0 && g.x > -10);
  for (const b of S.booms) b.t += dt;
  S.booms = S.booms.filter(b => b.t < b.max);
  for (const z of S.zaps) z.t -= dt;
  S.zaps = S.zaps.filter(z => z.t > 0);
}

// ---- drawing (canvas; ctx already scaled so 1 = one css pixel) ----
const LAYERS = [
  { par: 0.25, top: '#2a1a4a', bot: '#2a1640' },
  { par: 0.55, top: '#3a2160', bot: '#3a1d52' },
  { par: 1, top: '#140b24', bot: '#140b24' },
];

/** @param {CanvasRenderingContext2D} ctx @param {TitleScene} S @param {number} cw css width @param {number} ch css height */
export function titleDraw(ctx, S, cw, ch) {
  const k = cw / TITLE_VW, vh = S.vh;
  // the sky: a deep cave glow
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, '#08040f'); bg.addColorStop(0.5, '#1b0d2e'); bg.addColorStop(1, '#2a0f1a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  const sx = (S.rnd() - 0.5) * S.shake * k, sy = (S.rnd() - 0.5) * S.shake * k;
  ctx.translate(sx, sy);
  ctx.scale(k, k);
  // three rock layers, far to near, with glowing crystals in the near one
  LAYERS.forEach((L, li) => {
    const off = S.scroll * L.par;
    for (const fn of [titleCeil, titleFloor]) {
      ctx.fillStyle = fn === titleCeil ? L.top : L.bot;
      ctx.beginPath();
      const edge = fn === titleCeil ? -20 : vh + 20;
      ctx.moveTo(-10, edge);
      for (let x = -10; x <= TITLE_VW + 10; x += 4) {
        const y = fn(x + off, li, S) + (fn === titleCeil ? -li * 6 + 12 : li * 6 - 12) * (2 - li) * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(TITLE_VW + 10, edge);
      ctx.closePath(); ctx.fill();
    }
  });
  // the near rock's lit rim and crystals
  ctx.strokeStyle = 'rgba(255,120,60,0.35)'; ctx.lineWidth = 0.8;
  for (const fn of [titleCeil, titleFloor]) {
    ctx.beginPath();
    for (let x = -10; x <= TITLE_VW + 10; x += 4) { const y = fn(x + S.scroll, 2, S); if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const cs = 37;
  for (let i = Math.floor(S.scroll / cs) - 1; i < (S.scroll + TITLE_VW) / cs + 1; i++) {
    const wx = i * cs + ((i * 17) % 13), x = wx - S.scroll, top = (i * 7) % 3 === 0;
    const y = top ? titleCeil(wx, 2, S) - 2 : titleFloor(wx, 2, S) + 2;
    const pulse = 0.6 + 0.4 * Math.sin(S.t * 3 + i);
    const hue = (i * 47) % 2 ? '255,60,90' : '90,220,255';
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 14);
    gr.addColorStop(0, 'rgba(' + hue + ',' + (0.45 * pulse) + ')'); gr.addColorStop(1, 'rgba(' + hue + ',0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.fillStyle = 'rgb(' + hue + ')';
    ctx.beginPath();
    const d = top ? 1 : -1;
    ctx.moveTo(x - 2, y); ctx.lineTo(x, y + d * 6); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
  }
  // gold on the ground and in the air
  for (const g of S.nuggets) {
    ctx.globalAlpha = Math.min(1, g.life * 2);
    drawNugget(ctx, g.x, g.y, g.r, g.seed, g.ang);
  }
  ctx.globalAlpha = 1;
  // smoke under everything bright
  for (const p of S.parts) if (p.kind === 'smoke') {
    ctx.globalAlpha = 0.5 * (p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - p.life / p.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // creatures
  for (const f of S.foes) {
    const C = CREATURES[f.k], body = C.body, lx = -1, ly = 0;
    if (body === 'skull') drawSkull(ctx, f.x, f.y, f.r, lx, ly, S.t, f.phase, f.flash > 0, C.col);
    else if (body === 'blob') drawBlob(ctx, f.x, f.y, f.r, lx, ly, S.t, f.phase, f.flash > 0, C.col);
    else drawDrone(ctx, f.x, f.y, f.r, lx, ly, S.t, f.phase, f.flash > 0, C.col);
  }
  // the runners: body, jet flame and gun on the 1-unit pixel grid, like the game's drawPlayer
  for (const r of S.runners) {
    const K = KITS[r.kit], pcx = r.x + PW / 2, gy = r.y + PH * 0.45, ax = Math.cos(r.ang), ay = Math.sin(r.ang);
    const hands = { gun: { x: pcx + ax * 2.5, y: gy }, torch: { x: pcx + ax * 7, y: gy + ay * 5 - 0.5 } };
    const ox = Math.round(r.x) - 14, oy = Math.round(r.y) - 8;
    const len = 6 + r.flame * 14 + S.rnd() * 3, bx = pcx - r.face * 4.5, by = r.y + PH * 0.55;
    pixelSprite(ctx, ox - 10, oy, PW + 48, PH + 40, 1, false, c => jetFlame(c, bx, by, 0, 1, len, S.t + r.kit));
    pixelSprite(ctx, ox, oy, PW + 28, PH + 16, 1, true, c => drawRunner(c, r.x, r.y, PW, PH, r.face, null, true, r.flame, false, hands));
    pixelSprite(ctx, ox, oy, PW + 28, PH + 16, 1, false, c => drawGun(c, pcx + ax * 2.5, gy, r.ang, 0.55, K.acc));
  }
  // the bright stuff, added light
  ctx.globalCompositeOperation = 'lighter';
  for (const z of S.zaps) {
    for (const [w, a] of [[3, 0.35], [1, 1]]) {
      ctx.strokeStyle = z.col; ctx.globalAlpha = a * (z.t / 0.16); ctx.lineWidth = w;
      ctx.beginPath(); z.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const s of S.shots) {
    const sp = Math.hypot(s.vx, s.vy) || 1, tl = Math.min(10, sp * 0.025);
    const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
    gr.addColorStop(0, s.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.col; ctx.lineWidth = s.r * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x - s.vx / sp * tl, s.y - s.vy / sp * tl); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of S.booms) {
    const q = b.t / b.max;
    const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.4 + q));
    gr.addColorStop(0, 'rgba(255,250,220,' + (1 - q) + ')'); gr.addColorStop(0.4, 'rgba(255,150,40,' + (0.8 * (1 - q)) + ')');
    gr.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + q), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,' + (1 - q) + ')'; ctx.lineWidth = 1.5 * (1 - q);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.5 + q * 1.2), 0, Math.PI * 2); ctx.stroke();
  }
  for (const p of S.parts) if (p.kind !== 'smoke') {
    const q = p.life / p.max;
    ctx.globalAlpha = q;
    ctx.fillStyle = p.kind === 'fire' ? (q > 0.6 ? '#fff0b0' : q > 0.3 ? '#ff9a2e' : '#c8301a') : p.col;
    const rr = p.kind === 'fire' ? p.r * (0.5 + q) : p.r;
    ctx.fillRect(p.x - rr / 2, p.y - rr / 2, rr, rr);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // a white flash on a big kill, and a vignette
  if (S.flash > 0) { ctx.fillStyle = 'rgba(255,230,200,' + (S.flash * 0.4) + ')'; ctx.fillRect(0, 0, cw, ch); }
  const vg = ctx.createRadialGradient(cw / 2, ch * 0.45, Math.min(cw, ch) * 0.3, cw / 2, ch * 0.45, Math.max(cw, ch) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
}

// The big title: CAVE over RUNNER in the game's blocky pixel font, each letter bobbing on its own
// beat, a deep 3D extrusion, a hot gradient face, a glow, and a shine sweeping across now and then.
/** @param {CanvasRenderingContext2D} ctx @param {number} t seconds @param {number} cw css width @param {number} top css y of the title's top */
export function titleText(ctx, t, cw, top) {
  const lines = ['CAVE', 'RUNNER'];
  const px = titlePx(cw), ph = px;
  let y = top + 7 * ph;
  const shine = ((t * 0.45) % 1.6) - 0.3;          // a sweep across, then a rest
  lines.forEach((s, li) => {
    const w = pixWidth(s, px, 1);
    let x = (cw - w) / 2;
    [...s].forEach((c, i) => {
      const n = li * 4 + i;
      const bob = Math.sin(t * 3.2 + n * 0.7) * px * 0.45, cx = x, cy = y + bob;
      // extrusion: dark layers down-right
      for (let d = Math.ceil(px * 0.9); d > 0; d--) {
        ctx.fillStyle = d > px * 0.45 ? '#2a0610' : '#6a1220';
        pixText(ctx, c, cx + d * 0.5, cy + d, px, ph, 1, 8);
      }
      // the face: yellow to orange to red down the letter, with a glow
      const g = ctx.createLinearGradient(0, cy - 7 * ph, 0, cy);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.35, '#ffd23a'); g.addColorStop(0.7, '#ff8a1f'); g.addColorStop(1, '#e8361a');
      ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.shadowBlur = px * 2.2;
      ctx.fillStyle = g;
      pixText(ctx, c, cx, cy, px, ph, 1, 8);
      ctx.shadowBlur = 0;
      // the shine: a white band sweeping across the whole title
      const lx = (cx + pixWidth(c, px, 1) / 2) / cw;
      const sh = 1 - Math.abs(lx - shine) * 5;
      if (sh > 0) { ctx.globalAlpha = sh * 0.8; ctx.fillStyle = '#ffffff'; pixText(ctx, c, cx, cy, px, ph, 1, 8); ctx.globalAlpha = 1; }
      x += pixWidth(c, px, 1) + (1) * px;
    });
    y += 7 * ph + Math.ceil(px * 2.2);
  });
  // the tagline under it
  const ty = titleBottom(cw, top) - 4;
  ctx.font = '800 12px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.shadowColor = 'rgba(255,110,30,0.95)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffe2b0';
  ctx.fillText('JETPACK · BLAST · LOOT · DIG', cw / 2 + 2, ty);
  ctx.shadowBlur = 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'start';
}
// the title's pixel size, and where it and its tagline end (css px), for a screen cw wide
/** @param {number} cw */
const titlePx = cw => Math.max(4, Math.floor(Math.min(cw * 0.92 / pixWidth('RUNNER', 1, 1), 15)));
/** @param {number} cw css width @param {number} top the title's top @returns {number} */
export const titleBottom = (cw, top) => top + titlePx(cw) * 16 + Math.ceil(titlePx(cw) * 2.2) + 20;
