// @ts-check
// The title screen's painter (art/titlescene.js steps the scene; this draws it, here in layer 5
// because it uses the game's own bullet looks, drawLook/drawBolt). The terrain is a small canvas,
// one pixel a cell (TCELL world units), a ring of columns painted as the scene makes them and
// repainted where it was carved or burnt (S.dirty), drawn scaled up crisp. Over it: the plants
// (drawProp), floor 1's creatures (drawJelly, drawSpider, drawRat), gold, the runner (drawRunner,
// jetFlame, drawGun with his gun's art), the shots in their game looks, fire, booms.

import { PW, PH } from '../../core/consts.js';
import { CREATURES } from '../../data/creatures.js';
import { THEMES } from '../../data/themes.js';
import { drawJelly } from '../../creatures/jelly.js';
import { drawRat } from '../../creatures/rat.js';
import { drawSpider } from '../../creatures/spider.js';
import { drawProp } from '../../art/props.js';
import { drawGun, drawNugget, drawRunner, jetFlame, pixelSprite } from '../../art/sprites.js';
import { TCELL, TITLE_KITS, TITLE_VW, TM, titleZone } from '../../art/titlescene.js';
import { drawBolt, drawLook } from './looks.js';

const T = THEMES[0];                                   // Mossy caves
/** @type {WeakMap<object, { cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, img: ImageData, painted: number }>} */
const CACHE = new WeakMap();

/** @param {number} c @param {number} r */
const hash = (c, r) => { const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; return s - Math.floor(s); };
/** @param {number[]} a @param {number[]} b @param {number} t @param {number} [k] brightness */
const mixc = (a, b, t, k = 1) => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, (a[2] + (b[2] - a[2]) * t) * k];
const WOOD = [[96, 64, 38], [138, 96, 58]];
// a brick's mortar line, for the paved works' bricks and their back wall
/** @param {number} c @param {number} r */
const mortar = (c, r) => r % 3 === 0 || (c + (Math.floor(r / 3) % 2) * 3) % 6 === 0;

// one cell's colour: its material, its zone's back wall where it's air
/** @param {number} m @param {number} c @param {number} r */
function cellRGB(m, c, r) {
  const h = hash(c, r), hb = hash(Math.floor((c + (Math.floor(r / 3) % 2) * 3) / 6), Math.floor(r / 3));
  if (m === TM.ROCK) return mixc(T.rock[0], T.rock[1], h * 0.6 + hash(c >> 2, r >> 2) * 0.4);
  if (m === TM.MOSS) return mixc(T.moss[0], T.moss[1], h);
  if (m === TM.BRICK) return mortar(c, r) ? T.mortar : mixc(T.brick[0], T.brick[1], hb * 0.8 + h * 0.2);
  if (m === TM.WOOD || m === TM.BEAM) return mixc(WOOD[0], WOOD[1], (c % 3 === 0 ? 0.1 : 0.6) + h * 0.3, m === TM.BEAM ? 0.8 : 1);
  if (m === TM.CHAR) return mixc([30, 26, 26], [52, 44, 40], h);
  const z = titleZone(c * TCELL);
  if (z === 'paved') return mortar(c, r) ? mixc(T.mortar, T.bg, 0.5) : mixc(T.brick[0], T.bg, 0.62 + hb * 0.12);
  if (z === 'timber') return mixc(T.bg, T.bg2, (c % 5 === 0 ? 0.15 : 0.55) + h * 0.15);
  const g = z === 'grove' ? 0.18 : 0;
  return mixc(mixc(T.bg, T.bg2, hash(c >> 3, r >> 3) * 0.6 + h * 0.25), T.moss[0], g);
}

/** @param {import('../../art/titlescene.js').TitleScene} S */
function terrain(S) {
  let C = CACHE.get(S);
  if (!C) {
    const cv = document.createElement('canvas');
    cv.width = S.ncol; cv.height = S.rows;
    const cx = cv.getContext('2d');
    C = { cv, cx, img: cx.createImageData(S.ncol, S.rows), painted: S.gen - S.ncol };
    CACHE.set(S, C);
  }
  const D = C.img.data, N = S.ncol;
  /** @param {number} c @param {number} r */
  const paint = (c, r) => {
    const x = ((c % N) + N) % N, m = S.cells[x * S.rows + r], [cr, cg, cb] = cellRGB(m, c, r), o = (r * N + x) * 4;
    D[o] = cr; D[o + 1] = cg; D[o + 2] = cb; D[o + 3] = 255;
  };
  let ch = false;
  if (S.dirtyAll) { C.painted = S.gen - N; S.dirtyAll = false; S.dirty.length = 0; }
  C.painted = Math.max(C.painted, S.gen - N);
  for (; C.painted < S.gen; C.painted++) { for (let r = 0; r < S.rows; r++) paint(C.painted, r); ch = true; }
  for (const [c0, c1, r0, r1] of S.dirty) {
    for (let c = Math.max(c0, S.gen - N); c <= Math.min(c1, S.gen - 1); c++) for (let r = r0; r <= r1; r++) paint(c, r);
    ch = true;
  }
  S.dirty.length = 0;
  if (ch) C.cx.putImageData(C.img, 0, 0);
  return C.cv;
}

/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S @param {number} cw css width @param {number} ch css height */
export function titleDraw(ctx, S, cw, ch) {
  const k = cw / TITLE_VW;
  ctx.fillStyle = 'rgb(' + T.bg.join(',') + ')'; ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  const sx = (S.rnd() - 0.5) * S.shake * k, sy = (S.rnd() - 0.5) * S.shake * k;
  ctx.translate(sx, sy);
  ctx.scale(k, k);
  // the terrain: the ring of columns, in (up to) two pieces
  const cv = terrain(S), N = S.ncol, c0 = Math.floor(S.scroll / TCELL) - 2, n = Math.ceil(TITLE_VW / TCELL) + 4;
  ctx.imageSmoothingEnabled = false;
  for (let c = c0; c < c0 + n;) {
    const x = ((c % N) + N) % N, w = Math.min(N - x, c0 + n - c);
    ctx.drawImage(cv, x, 0, w, S.rows, c * TCELL - S.scroll, 0, w * TCELL, S.rows * TCELL);
    c += w;
  }
  /** @type {any} */
  const W = { time: S.t };
  /** @type {any} */
  const G = { ctx };
  // plants: burning ones go dark as they burn
  for (const p of S.props) {
    if (p.x < -40 || p.x > TITLE_VW + 40) continue;
    ctx.globalAlpha = p.burn > 0 ? Math.max(0.15, p.burn / 1.4) : 1;
    /** @type {any} */
    const pr = p;
    drawProp(ctx, pr, S.t, T);
  }
  ctx.globalAlpha = 1;
  // gold
  for (const g of S.nuggets) drawNugget(ctx, g.x, g.y, g.r, g.seed, g.ang);
  // smoke under everything bright
  for (const p of S.parts) if (p.kind === 'smoke') {
    ctx.globalAlpha = 0.5 * (p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - p.life / p.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // floor 1's creatures, with the game's painters
  for (const f of S.foes) {
    const C = CREATURES[f.k], fl = f.flash > 0;
    if (f.k === 'rotta') drawRat(ctx, f.x, f.y, f.r, S.t, f.phase, fl, C.col, f.br);
    else if (f.k === 'hamahakki') drawSpider(ctx, f.x, f.y, f.r, S.t, f.phase, fl, C.col, f.br);
    else drawJelly(ctx, f.x, f.y, f.r, S.t, f.phase, fl, C.col, f.br);
  }
  // the runner: body and jet flame on the 1-unit pixel grid like the game's drawPlayer; his gun's art as it is
  const r = S.runner, K = TITLE_KITS[r.kit], pcx = r.x + PW / 2, ax = Math.cos(r.ang), ay = Math.sin(r.ang);
  const lower = r.swap > 0 ? Math.sin(r.swap / 0.3 * Math.PI) * 4 : 0, gy = r.y + PH * 0.45 + lower;
  const hands = { gun: { x: pcx + ax * 2.5, y: gy }, torch: { x: pcx + ax * 7, y: gy + ay * 5 - 0.5 } };
  const ox = Math.round(r.x) - 14, oy = Math.round(r.y) - 8;
  if (r.mode === 'fly') {
    const len = 6 + r.flame * 14 + S.rnd() * 3, bx = pcx - r.face * 4.5, by = r.y + PH * 0.55;
    pixelSprite(ctx, ox - 10, oy, PW + 48, PH + 40, 1, false, c => jetFlame(c, bx, by, 0, 1, len, S.t));
  }
  const gait = r.mode === 'run' ? r.gait : null;
  pixelSprite(ctx, ox, oy, PW + 28, PH + 16, 1, true, c => drawRunner(c, r.x, r.y, PW, PH, r.face, gait, r.mode !== 'run', r.flame, false, hands));
  drawGun(ctx, pcx + ax * 2.5, gy, r.ang, 0.55, K.art, K.art);
  // the bright stuff, added light
  ctx.globalCompositeOperation = 'lighter';
  for (const z of S.zaps) drawBolt(G, z.pts, z.col, 1, z.t / 0.16);
  for (const s of S.shots) {
    /** @type {any} */
    const b = s;
    if (!drawLook(W, G, b)) {
      const sp = Math.hypot(s.vx, s.vy) || 1, tl = Math.min(10, sp * 0.025);
      ctx.globalAlpha = 1; ctx.strokeStyle = s.col; ctx.lineWidth = s.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x - s.vx / sp * tl, s.y - s.vy / sp * tl); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const b of S.booms) {
    const q = b.t / b.max;
    const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.4 + q));
    gr.addColorStop(0, 'rgba(255,250,220,' + (1 - q) + ')'); gr.addColorStop(0.4, 'rgba(255,150,40,' + (0.8 * (1 - q)) + ')');
    gr.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + q), 0, Math.PI * 2); ctx.fill();
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
