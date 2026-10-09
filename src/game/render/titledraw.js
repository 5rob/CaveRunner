// @ts-check
// The title screen's painter (art/titlescene.js steps the scene; this draws it, here in layer 5
// because it uses the game's own bullet looks, drawLook/drawBolt). The terrain is a small canvas,
// one pixel a cell (TCELL world units), a ring of columns painted as the scene makes them and
// repainted where it was carved or burnt (S.dirty), drawn scaled up crisp. Over it: the plants
// (drawProp), floor 1's creatures (drawJelly, drawSpider, drawRat), gold, the runner (drawRunner,
// jetFlame, drawGun with his gun's art), the shots in their game looks, fire, booms.

import { LAMP_REACH, PW, PH, SIGHT } from '../../core/consts.js';
import { hexArr } from '../../core/util.js';
import { DEV, jcol, kru } from '../../dev/knobs.js';
import { plantGlowFill, plantWhite } from '../../creatures/jelly.js';
import { THEMES } from '../../data/themes.js';
import { drawEnemy } from '../../creatures/draw.js';
import { coinR } from '../../world/nuggets.js';
import { FIRE_COLS } from '../../world/fire.js';
import { vinePt } from '../../world/sway.js';
import { crackleAt, crackleBody } from '../../art/crackle.js';
import { drawProp, propGlow } from '../../art/props.js';
import { GUN_HELD, gunMuzzle, drawGun, drawNugget, glowAt, drawRunner, jetFlame, pixelHeld, pixelSprite } from '../../art/sprites.js';
import { TCELL, TITLE_SOLID, TITLE_VW, TM, titleNoise, titleSolid, titleSolidCell, titleWebAt } from '../../art/titlescene.js';
import { visPoly } from '../../world/vision.js';
import { drawBolt, drawLook } from './looks.js';
import { hubBack, hubGlow, hubLight } from './hubdraw.js';
import { levelBack, levelGlow, levelLight } from './leveldraw.js';

const T = THEMES[0];                                   // Mossy caves
/** @type {WeakMap<object, { cv: HTMLCanvasElement, cx: CanvasRenderingContext2D, img: ImageData, painted: number, white?: number, whiteT?: number }>} */
const CACHE = new WeakMap();

/** @param {number} c @param {number} r */
const hash = (c, r) => { const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; return s - Math.floor(s); };
/** @param {number[]} a @param {number[]} b @param {number} t @param {number} [k] brightness */
const mixc = (a, b, t, k = 1) => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, (a[2] + (b[2] - a[2]) * t) * k];
const TIMBER = [112, 80, 50];                          // strata.js timberFrame's wood
/** @param {number} x @param {number} y fbm-ish: two octaves of the title's noise */
const fbm = (x, y) => titleNoise(x, y) * 0.65 + titleNoise(x * 2.1 + 17, y * 2.1 + 5) * 0.35;
// one cell's colour, painted as world/level.js and decorate.js paint the level: rock mottled on a
// smooth lattice, moss where the rock faces up (a cell or two under open air), bricks in courses, the
// bright grass tufts and rubble of the moss patches, the timber frames' wood (lit and shaded); the
// back wall (air) dark, its pattern and its big slow blotches of shadow as the level's.
// `up` is open air one or two cells above
/** @param {number} m @param {number} c @param {number} r @param {boolean} up */
function cellRGB(m, c, r, up) {
  const h = hash(c, r), j = (h - 0.5) * 10;
  /** @param {number[]} q */
  const J = q => [q[0] + j, q[1] + j, q[2] + j];
  if (m === TM.ROCK) return J(up ? mixc(T.moss[0], T.moss[1], h) : mixc(T.rock[0], T.rock[1], fbm(c / 6 + 100, r / 6 + 100)));
  if (m === TM.MOSS) return J(mixc(T.moss[0], T.moss[1], h));
  if (m === TM.BRICK) {
    const k = c + (r % 2) * 3;
    if (k % 6 === 0) return J(T.mortar);
    const q = mixc(T.brick[0], T.brick[1], hash(Math.floor(k / 6), r));
    return J(up ? q.map(v => v * 1.18) : q);
  }
  if (m === TM.GRASS || m === TM.RUBM) return mixc(T.moss[1], T.moss[1], 0, 0.9 + h * 0.25);
  if (m === TM.RUB) return J(h < 0.2 ? T.mortar : mixc(T.brick[0], T.brick[1], hash(c * 3, r * 5)));
  if (m === TM.BEAM || m === TM.WOOD) return J(mixc(TIMBER, TIMBER, 0, 0.95));
  if (m === TM.BEAMD) return J(mixc(TIMBER, TIMBER, 0, 0.7));
  if (m === TM.CHAR) return mixc([30, 26, 26], [52, 44, 40], h);
  // the auto hub's room (auto/hub.js): steel plates (a seam every 8 cells, rivets), the brick back wall (the bricks, darker),
  // the steel wainscot (tall panels)
  if (m === TM.STEEL) return c % 8 === 0 || r % 6 === 0 ? [34, 38, 46] : (c % 8 === 1 && r % 6 === 1) ? [96, 104, 118] : mixc([62, 68, 80], [74, 80, 92], h);
  if (m === TM.BWALL) { const k = c + (r % 2) * 3; return k % 6 === 0 || r % 3 === 0 ? [22, 20, 22] : mixc(T.brick[0], T.brick[1], hash(Math.floor(k / 6), r), 0.5); }
  if (m === TM.SWALL) return c % 10 === 0 ? [20, 23, 28] : r % 14 === 0 ? [58, 64, 76] : mixc([36, 40, 48], [42, 46, 54], h);
  // the back wall: the level's is a quarter-size picture (one pixel = 4 cells), so the same scale here
  const bx = c / 4, by = r / 4, t = Math.pow(fbm(bx / 10 + 300, by / 10 + 300), 1.6);
  const big = fbm(bx / 34 + 700, by / 34 + 500), shade = 1 - 0.55 * Math.max(0, Math.min(1, (big - 0.35) / 0.3));
  return mixc(T.bg, T.bg2, Math.min(1, t * 1.3), shade).map(v => v + (h - 0.5) * 4);
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
    const x = ((c % N) + N) % N, col = x * S.rows, m = S.cells[col + r];
    const up = r > 1 && (!TITLE_SOLID[S.cells[col + r - 1]] || !TITLE_SOLID[S.cells[col + r - 2]]);
    const [cr, cg, cb] = cellRGB(m, c, r, up), o = (r * N + x) * 4;
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

// cam: the title's camera (art/titlescene.js titleCam: pinch zoom, pan, following a player), none: the whole screen
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S @param {number} cw css width @param {number} ch css height @param {import('../../art/titlescene.js').TitleCam} [cam] */
export function titleDraw(ctx, S, cw, ch, cam) {
  const k = cw / TITLE_VW;
  ctx.fillStyle = 'rgb(' + T.bg.join(',') + ')'; ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  const sx = (S.rnd() - 0.5) * S.shake * k, sy = (S.rnd() - 0.5) * S.shake * k;
  ctx.translate(sx, sy);
  ctx.scale(k, k);
  if (cam && (cam.z !== 1 || cam.w)) { ctx.translate(TITLE_VW / 2, cam.ay); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
  // the terrain: the ring of columns, in (up to) two pieces
  const cv = terrain(S), N = S.ncol, c0 = S.hub ? 0 : Math.floor(S.scroll / TCELL) - 2, n = S.hub ? N : Math.ceil(TITLE_VW / TCELL) + 4;
  ctx.imageSmoothingEnabled = false;
  for (let c = c0; c < c0 + n;) {
    const x = ((c % N) + N) % N, w = Math.min(N - x, c0 + n - c);
    ctx.drawImage(cv, x, 0, w, S.rows, c * TCELL - S.scroll, 0, w * TCELL + 0.6, S.rows * TCELL);   // a hair over: no seam where the pieces meet
    c += w;
  }
  // the burning cells, over the rock they're eating, as render/cave.js draws them: by the fire's colours,
  // a new flicker each fire tick, the dying ones as embers
  if (S.fire.length) {
    /** @type {number[][]} */
    const buckets = [[], [], [], []];
    for (const f of S.fire) {
      const h = (Math.imul(f.c * 977 + f.r, 2654435761) + S.fireN * 40503) >>> 30;
      buckets[f.t <= 3 ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1].push(f.c, f.r);
    }
    for (let k = 0; k < 4; k++) {
      const B = buckets[k];
      if (!B.length) continue;
      ctx.fillStyle = FIRE_COLS[k]; ctx.beginPath();
      for (let i = 0; i < B.length; i += 2) ctx.rect(B[i] * TCELL - S.scroll, B[i + 1] * TCELL, TCELL, TCELL);
      ctx.fill();
    }
  }
  /** @type {any} */
  const W = { time: S.t };
  /** @type {any} */
  const G = { ctx };
  // (v0.0.170, owner) the plants, decorations, web lines, silk and gold in the players' pixel look: one layer at
  // 1 world unit a pixel, solid or clear, its grid pinned to the world so it rides with the cave as it scrolls
  const gx = Math.floor(S.scroll) - S.scroll - 50;
  pixelSprite(ctx, gx, 0, TITLE_VW + 100, S.vh, 1, false, c => worldLayer(c, S));
  // a burning vine or piece of silk: its burning stretch drawn as the burning cells are (the fire's colours in
  // the terrain's grid, a new flicker each fire tick), the very tip as embers
  for (const p of S.props) {
    if (!p.burn || p.gone || p.arc || p.x < -20 || p.x > TITLE_VW + 20) continue;
    /** @type {any} */
    const pr = p, bent = p.sw || p.tl, reach = p.st === 'silk' ? 3 : 7;
    ctx.save(); ctx.translate(-S.scroll, 0);
    for (let k = Math.max(0, p.len - reach); k <= p.len; k += TCELL * 0.75) {
      const q = bent ? vinePt(pr, k) : { x: 0, y: k };
      crackleAt(ctx, p.ox + q.x, p.y + q.y, TCELL, S.fireN, p.len - k < 1.5);
    }
    ctx.restore();
  }
  // a burning line's two fronts: a short glowing stretch of silk either side of the burnt span
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  for (const L of S.webs) if (L.fu) for (const [u, d] of [[L.fu[0], -1], [L.fu[1], 1]]) {
    if (u <= 0 && d < 0 || u >= 1 && d > 0) continue;
    const a = titleWebAt(L, u), b = titleWebAt(L, Math.max(0, Math.min(1, u + d * 4 / Math.max(4, Math.hypot(L.b0x - L.a0x, L.b0y - L.a0y)))));
    ctx.strokeStyle = (S.fireN + Math.round(u * 50)) % 3 ? '#ff9a2e' : '#fff0b0';
    ctx.beginPath(); ctx.moveTo(a.x - S.scroll, a.y); ctx.lineTo(b.x - S.scroll, b.y); ctx.stroke();
  }
  // smoke under everything bright
  for (const p of S.parts) if (p.kind === 'smoke') {
    ctx.globalAlpha = 0.5 * (p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - p.life / p.max), 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'fsmoke') {   // fire's smoke, as render/effects.js puffs it
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.35;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // floor 1's creatures, drawn by the game's own drawEnemy (they live in world coordinates), each in the players'
  // pixel look (v0.0.170) on a grid pinned to it, as the players' is
  for (const f of S.foes) {
    const sx = f.x - S.scroll;
    if (sx < -60 || sx > TITLE_VW + 60) continue;
    const e = f.r * 3 + 20;
    pixelSprite(ctx, sx - e, f.ty - e, 2 * e, 2 * e + 30, 1, false, c => { c.translate(-S.scroll, 0); drawEnemy(c, f, S.t); });
    if (f.burn > 0) { ctx.save(); ctx.translate(-S.scroll, 0); crackleBody(ctx, f.x, f.ty, f.r * 0.85, TCELL, S.fireN); ctx.restore(); }   // on fire: the burning pixels' crackle over it
  }
  // the four players: body and jet flame on the 1-unit pixel grid like the game's drawPlayer, the gun in it
  // (pixelHeld), each with its colour on the backpack and helmet
  if (S.hub) hubBack(ctx, S);
  if (S.lvl) levelBack(ctx, S);   // the auto level's pads (game/render/leveldraw.js)   // the auto hub's machines, pads and tubes (game/render/hubdraw.js)
  for (const r of S.runners) if (!r.hide) drawTitleRunner(ctx, S, r);
  // the game's dark over it all, the players' gun lights, the lanterns, fire and the jellyfish cutting through it (v0.0.171)
  titleDark(ctx, S);
  // the bright stuff, added light
  ctx.globalCompositeOperation = 'lighter';
  // each jellyfish's green glow on the plants and moss round it, as the game's (systems/plantglow.js, plantGlowFill)
  for (const f of S.foes) if (f.je && f.x - S.scroll > -40 && f.x - S.scroll < TITLE_VW + 40) titlePlantGlow(ctx, S, f);
  for (const r of S.runners) if (!r.hide) titleBeam(ctx, S, r, DK.vis[r.id]);
  if (S.hub) hubGlow(ctx, S);
  if (S.lvl) levelGlow(ctx, S);
  // the shots and lightning in the pixel look too (owner, v0.0.171): one layer on the world's grid, added as before
  if (S.shots.length || S.zaps.length) pixelSprite(ctx, gx, 0, TITLE_VW + 100, S.vh, 1, false, c => {
    /** @type {any} */
    const G2 = { ctx: c };
    c.globalCompositeOperation = 'lighter';
    for (const z of S.zaps) drawBolt(G2, z.pts, z.col, 1, z.t / 0.16);
    for (const s of S.shots) {
      /** @type {any} */
      const b = s;
      if (!drawLook(W, G2, b)) {
        const sp = Math.hypot(s.vx, s.vy) || 1, tl = Math.min(10, sp * 0.025);
        c.globalAlpha = 1; c.strokeStyle = s.col; c.lineWidth = s.size; c.lineCap = 'round';
        c.beginPath(); c.moveTo(s.x - s.vx / sp * tl, s.y - s.vy / sp * tl); c.lineTo(s.x, s.y); c.stroke();
      }
    }
  });
  ctx.globalAlpha = 1;
  for (const b of S.booms) {
    const q = b.t / b.max;
    const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.4 + q));
    gr.addColorStop(0, 'rgba(255,250,220,' + (1 - q) + ')'); gr.addColorStop(0.4, 'rgba(255,150,40,' + (0.8 * (1 - q)) + ')');
    gr.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + q), 0, Math.PI * 2); ctx.fill();
  }
  // the lanterns' warm light (art/props.js propGlow, as the game adds it after the fog)
  for (const p of S.props) if (p.k === 'lamp' && p.x > -60 && p.x < TITLE_VW + 60) {
    /** @type {any} */
    const pr = p;
    propGlow(ctx, pr, S.t, T, 0, 1);
  }
  // a burning web line's fronts glow
  for (const L of S.webs) if (L.fu) for (const u of L.fu) { const w = titleWebAt(L, u); glowAt(ctx, w.x - S.scroll, w.y, 9, 0.18, '255,140,50'); }
  // fire's light, as render/light.js adds it: the burning cells brighten, a few warm glows
  if (S.fire.length) {
    ctx.fillStyle = 'rgba(255,140,50,0.32)'; ctx.beginPath();
    for (const f of S.fire) ctx.rect(f.c * TCELL - S.scroll, f.r * TCELL, TCELL, TCELL);
    ctx.fill();
    const st = Math.max(1, Math.ceil(S.fire.length / 24));
    for (let k = S.fireN % st; k < S.fire.length; k += st) {
      const f = S.fire[k];
      glowAt(ctx, (f.c + 0.5) * TCELL - S.scroll, (f.r + 0.5) * TCELL, 20, Math.min(0.14, 0.03 + S.fire.length / 3000), '255,120,40');
    }
  }
  for (const p of S.parts) if (p.kind !== 'smoke' && p.kind !== 'fsmoke') {
    if (p.kind === 'flame' || p.kind === 'ember') {   // the game's flame specks and a lantern's burning oil (glowing dparts: bright until their last third)
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.3)); ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      continue;
    }
    const q = p.life / p.max;
    // spores fade in and out (the level's luminescent spores); drips are solid water
    ctx.globalAlpha = p.kind === 'spore' ? Math.sin(Math.PI * q) * 0.8 : p.kind === 'drip' ? 0.8 : q;
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

// one title player (art/titlescene.js TRunner)
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S @param {import('../../art/titlescene.js').TRunner} r */
function drawTitleRunner(ctx, S, r) {
  const K = r.kit, pcx = r.x + PW / 2, ax = Math.cos(r.ang), ay = Math.sin(r.ang);
  const lower = r.swap > 0 ? Math.sin(r.swap / 0.3 * Math.PI) * 4 : 0, gy = r.y + PH * 0.45 + lower;
  const hands = { gun: { x: pcx + ax * 2.5, y: gy }, torch: { x: pcx + ax * 7, y: gy + ay * 5 - 0.5 } };
  const ox = r.x - 14, oy = r.y - 8;     // the pixel grid rides with him (as the game's drawPlayer): not rounded, or it slides over his body
  if (r.mode === 'fly') {
    const len = 6 + r.flame * 14 + S.rnd() * 3, bx = pcx - r.face * 4.5, by = r.y + PH * 0.55;
    pixelSprite(ctx, ox - 10, oy, PW + 48, PH + 40, 1, false, c => jetFlame(c, bx, by, 0, 1, len, S.t));
  }
  const gait = r.mode === 'run' && !r.stand ? r.gait : null;
  pixelHeld(ctx, ox + 14, oy + 8, 1, false, c => {   // no outline (owner, v0.0.171)
    drawRunner(c, r.x, r.y, PW, PH, r.face, gait, r.mode !== 'run', r.flame, false, hands, null, r.col);
    drawGun(c, pcx + ax * 2.5, gy, r.ang, GUN_HELD, K.art);
  });
  // sawing through rock: the Buzzsaw's blade spinning off the barrel (the game's sawblade look)
  if (r.dig) {
    const mz = gunMuzzle(pcx + ax * 2.5, gy, r.ang, GUN_HELD, K.art);
    /** @type {any} */
    const blade = { look: 'disc', x: mz.x + ax * 3, y: mz.y + ay * 3, vx: ax, vy: ay, size: 3.2, spin: S.t * 9, col: '#d9dde4' };
    /** @type {any} */
    const W = { time: S.t };
    /** @type {any} */
    const G = { ctx };
    pixelSprite(ctx, blade.x - 6, blade.y - 6, 12, 12, 1, false, c => { G.ctx = c; drawLook(W, G, blade); });   // the pixel look, on a grid pinned to it
  }
}

// The plants, decorations, web lines, the spiders' strings and the gold, for the pixel layer (titleDraw): silk drawn
// solid (the layer is solid or clear), in the grey the see-through silk showed as over the dark
/** @param {CanvasRenderingContext2D} c @param {import('../../art/titlescene.js').TitleScene} S */
function worldLayer(c, S) {
  const SILK = '#9fa2ad';
  c.lineCap = 'round';
  // plants (a burning one is shorter by what's burnt: drawProp draws its len; an arch, its u0..u1 gone)
  for (const p of S.props) {
    if (p.gone || p.x + (p.span || 0) < -40 || p.x > TITLE_VW + 40) continue;
    /** @type {any} */
    const pr = p;
    if (p.st === 'silk') {             // a cut web line's piece: silk hanging from its end, as the lines are drawn
      c.strokeStyle = SILK; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(p.x, p.y);
      for (let k = 2; k <= p.len + 1.9; k += 2) { const q = vinePt(pr, Math.min(k, p.len)); c.lineTo(p.x + q.x, p.y + q.y); }
      c.stroke();
      continue;
    }
    drawProp(c, pr, S.t, T);
  }
  // the spiders' web lines, silk as the game draws it (render: game/creatures/spider.js drawSilk)
  c.strokeStyle = SILK; c.lineWidth = 0.9; c.globalAlpha = 1;
  c.beginPath();
  for (const L of S.webs) {
    if (Math.max(L.a0x, L.b0x) < S.scroll - 10 || Math.min(L.a0x, L.b0x) > S.scroll + TITLE_VW + 10) continue;
    if (!L.fu) {
      c.moveTo(L.a0x - S.scroll, L.a0y);
      for (let i = 1; i <= 8; i++) { const p = titleWebAt(L, i / 8); c.lineTo(p.x - S.scroll, p.y); }
      continue;
    }
    // burning: what's left either side of the burnt span
    for (const [u0, u1] of [[0, L.fu[0]], [L.fu[1], 1]]) {
      if (u1 - u0 < 0.01) continue;
      for (let i = 0; i <= 8; i++) { const p = titleWebAt(L, u0 + (u1 - u0) * i / 8); if (i) c.lineTo(p.x - S.scroll, p.y); else c.moveTo(p.x - S.scroll, p.y); }
    }
  }
  // the strings spiders shoot at him (as the game draws W.silk: a line from where it left)
  for (const b of S.silk) { c.moveTo(b.ax - S.scroll, b.ay); c.lineTo(b.x - S.scroll, b.y); }
  c.stroke();
  // gold, the game's nuggets (its size from its amount: coinR), turned as they roll
  for (const g of S.coins) drawNugget(c, g.x - S.scroll, g.y, coinR(g), g.t, g.a || 0);
  drawLoot(c, S);
}

// CaveRunner Auto's drops (S.loot: a gun mod, gems, an exo mod): a small glowing gem in the item's colour, pulsing; one
// waiting (the bag full) pulses slowly and dimmer
/** @param {CanvasRenderingContext2D} c @param {import('../../art/titlescene.js').TitleScene} S */
function drawLoot(c, S) {
  if (!S.loot || !S.loot.length) return;
  c.save();
  for (const g of S.loot) {
    const x = g.x - S.scroll, y = g.y, p = 0.5 + 0.5 * Math.sin(g.t * (g.wait ? 2 : 8)), r = 2.6;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (g.wait ? 0.25 : 0.45) + 0.25 * p;
    const gr = c.createRadialGradient(x, y, 0, x, y, r * 4);
    gr.addColorStop(0, g.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = g.col;
    c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.3); c.lineTo(x - r, y); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.globalAlpha = 0.6 + 0.4 * p; c.fillRect(x - 0.7, y - 1.2, 1.2, 1.2); c.globalAlpha = 1;
  }
  c.restore();
}

// A jellyfish's green glow on the plants and moss round it (owner, v0.0.170), the game's (systems/plantglow.js): the
// art in reach (the terrain's own pixels, the plants drawn over them at the terrain's grid and read back) keyed,
// ramped, twinkled by plantGlowFill and added in the jelly's glow colour. The white point is the cave's brightest
// green (plantWhite over the painted terrain, every 2 s)
/** @type {{ c: HTMLCanvasElement | null, x: CanvasRenderingContext2D | null, g: HTMLCanvasElement | null, gx: CanvasRenderingContext2D | null }} */
const PG = { c: null, x: null, g: null, gx: null };
// the title's glow reach × the game's (owner, v0.0.170: the game's lit the whole narrow title screen; it's 80–280 there)
export const TITLE_PLANTR = 0.25;
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S @param {Enemy} e */
function titlePlantGlow(ctx, S, e) {
  const u = e.je.u, reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant) * TITLE_PLANTR, strength = kru('jePlantGlow', u.plant);
  const C = CACHE.get(S);
  if (reach < 2 || strength <= 0 || !C) return;
  if (C.white === undefined || S.t - (C.whiteT || 0) > 2) { C.white = plantWhite(C.img.data); C.whiteT = S.t; }
  const N = S.ncol, c0 = Math.max(S.gen - N, Math.floor((e.x - reach) / TCELL)), c1 = Math.min(S.gen, Math.ceil((e.x + reach) / TCELL));
  const r0 = Math.max(0, Math.floor((e.y - reach) / TCELL)), r1 = Math.min(S.rows, Math.ceil((e.y + reach) / TCELL));
  const w = c1 - c0, h = r1 - r0;
  if (w <= 0 || h <= 0) return;
  if (!PG.c) { PG.c = document.createElement('canvas'); PG.x = PG.c.getContext('2d', { willReadFrequently: true }); PG.g = document.createElement('canvas'); PG.gx = PG.g.getContext('2d'); }
  const pc = PG.c, px = PG.x, gc = PG.g, gx = PG.gx;
  if (!px || !gc || !gx) return;
  if (pc.width < w || pc.height < h) { pc.width = Math.max(pc.width, w); pc.height = Math.max(pc.height, h); }
  if (gc.width < w || gc.height < h) { gc.width = Math.max(gc.width, w); gc.height = Math.max(gc.height, h); }
  // the plants in reach, at the terrain's grid (screen x: the props' x is on screen)
  const ox = c0 * TCELL - S.scroll, oy = r0 * TCELL;
  px.setTransform(1, 0, 0, 1, 0, 0); px.clearRect(0, 0, w, h);
  px.setTransform(1 / TCELL, 0, 0, 1 / TCELL, -ox / TCELL, -oy / TCELL);
  for (const p of S.props) {
    if (p.k !== 'climb' || p.gone || p.st === 'silk' || p.st === 'chain' || p.x + (p.span || 0) < ox - 20 || p.x > ox + w * TCELL + 20) continue;
    /** @type {any} */
    const pr = p;
    drawProp(px, pr, S.t, T);
  }
  const pd = px.getImageData(0, 0, w, h).data, D = C.img.data, A = new Uint8ClampedArray(w * h * 4);
  // the terrain's pixels (rock with its moss; the back wall's dark), the plants over them
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((r0 + y) * N + (((c0 + x) % N) + N) % N) * 4, o = (y * w + x) * 4, m = S.cells[(((c0 + x) % N) + N) % N * S.rows + r0 + y];
    let r = 0, g = 0, b = 0, a = 0;
    if (TITLE_SOLID[m] || m === TM.GRASS || m === TM.RUBM) { r = D[si]; g = D[si + 1]; b = D[si + 2]; a = 255; }
    if (pd[o + 3]) {
      const pa = pd[o + 3] / 255;
      if (a) { r += (pd[o] - r) * pa; g += (pd[o + 1] - g) * pa; b += (pd[o + 2] - b) * pa; a = Math.max(a, pd[o + 3]); }
      else { r = pd[o]; g = pd[o + 1]; b = pd[o + 2]; a = pd[o + 3]; }
    }
    A[o] = r; A[o + 1] = g; A[o + 2] = b; A[o + 3] = a;
  }
  const out = new ImageData(w, h);
  // in world coordinates (the twinkle is a pattern in the world: owner, v0.0.173, it stood still on the screen as the cave went by)
  if (!plantGlowFill(out.data, A, w, h, { ox: c0 * TCELL, oy, px: TCELL, cx: e.x, cy: e.y, reach, white: C.white,
    top: kru('jePlantTop', u.plant) / 100, strength, t: S.t * kru('jePlantTwinkle', u.plant),
    size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)) })) return;
  gx.putImageData(out, 0, 0);
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gc, 0, 0, w, h, ox, oy, w * TCELL, h * TCELL);
  ctx.imageSmoothingEnabled = sm;
}

// The game's dark (owner, v0.0.171): the cave at the game's outside-the-torchlight darkness (DEV.fogDim) and lights
// cutting it, each only as far as it can see (visPoly: the rock throws shadows), as render/light.js lights the game:
// every player's gun light (a cone out along the gun, soft at its sides, DEV.beamDeg wide and the game's reach, and
// the round glow at his feet, DEV.beamNear), the lanterns (warm pools), fire, burning creatures and the jellyfish.
// Drawn into a small layer at the terrain's grid (the light added up, then cut out of the dark), smoothed up
/** @type {{ L: HTMLCanvasElement | null, D: HTMLCanvasElement | null, vis: number[][] }} */
const DK = { L: null, D: null, vis: [] };   // vis: this frame's line-of-sight fan of each player (screen x), for the beam
export const TITLE_EDGE = 6;            // light reaches this far into the rock it falls on (the dark fades in from the edge: owner, v0.0.171)
export const TITLE_LAMPR = 60;          // a lantern's pool of light (world units)
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
function titleDark(ctx, S) {
  const x0 = -40, w = Math.ceil(((S.hub ? S.ncol * TCELL : TITLE_VW) + 80) / TCELL), h = Math.ceil(S.vh / TCELL);
  if (!DK.L) { DK.L = document.createElement('canvas'); DK.D = document.createElement('canvas'); }
  const L = DK.L, D = DK.D;
  if (!D) return;
  for (const c of [L, D]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const lc = L.getContext('2d'), dc = D.getContext('2d');
  if (!lc || !dc) return;
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, w, h);
  lc.setTransform(1 / TCELL, 0, 0, 1 / TCELL, -x0 / TCELL, 0);
  // lights add up as a union (source-over: a + b - ab), so where they overlap they don't burn out into one big disc
  lc.globalCompositeOperation = 'source-over';
  const solid = titleSolidCell(S);
  /** the line-of-sight fan from (x, y) (screen x) out to r, as a clip path @param {number} x @param {number} y @param {number} r @param {number} rays */
  const fan = (x, y, r, rays) => {
    const p = visPoly(x + S.scroll, y, r, solid, rays), wx = x + S.scroll;
    // a ray that met rock goes TITLE_EDGE on into it: the rock's face it lights
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - wx, dy = p[i + 1] - y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < r - 0.5) { p[i] += dx / d * TITLE_EDGE; p[i + 1] += dy / d * TITLE_EDGE; }
    }
    for (let i = 0; i < p.length; i += 2) p[i] -= S.scroll;
    lc.beginPath(); lc.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) lc.lineTo(p[i], p[i + 1]);
    lc.closePath();
    return p;
  };
  /** a round light: full to a fraction 'full' of r, then fading @param {number} x @param {number} y @param {number} r @param {number} a @param {number} [full] */
  const pool = (x, y, r, a, full = 0.5) => {
    const g = lc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(full, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.fillStyle = g; lc.beginPath(); lc.arc(x, y, r, 0, Math.PI * 2); lc.fill();
  };
  // the players' gun lights, the game's sizes: the old torch's reach (SIGHT × DEV.torch × LAMP_REACH), the cone that × DEV.beamReach
  const torchR = SIGHT * DEV.torch * LAMP_REACH * 1.05, R = torchR * Math.max(1, DEV.beamReach), N = torchR * DEV.beamNear;
  const half = DEV.beamDeg * Math.PI / 360;
  DK.vis.length = 0;
  for (const r of S.runners) {
    if (r.hide) continue;
    const cx = r.x + PW / 2, cy = r.y + PH * 0.45;
    lc.save();
    DK.vis[r.id] = fan(cx, cy, R, 120); lc.clip();
    pool(cx, cy, N, 1);
    // the cone, its soft sides as the game's beamSide (full to half, fading over 0.4 × half more): three nested wedges
    for (const [k, a] of [[1, 0.6], [1.2, 0.25], [1.4, 0.15]]) {
      const g = lc.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.55, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lc.fillStyle = g; lc.beginPath(); lc.moveTo(cx, cy); lc.arc(cx, cy, R, r.ang - half * k, r.ang + half * k); lc.closePath(); lc.fill();
    }
    lc.restore();
  }
  if (S.hub) hubLight(S, pool);
  if (S.lvl) levelLight(S, pool);
  // the lanterns (not fallen or popped), their own shadows
  for (const p of S.props) if (p.k === 'lamp' && !p.gone && !p.fall && p.x > -TITLE_LAMPR - 40 && p.x < TITLE_VW + TITLE_LAMPR + 40) {
    const ly = p.y + p.len + 3;
    lc.save(); fan(p.x, ly, TITLE_LAMPR, 72); lc.clip(); pool(p.x, ly, TITLE_LAMPR, 0.95, 0.25); lc.restore();
  }
  // fire (a few of its cells, as the game's glows sample it), burning creatures and plants, and the jellyfish
  if (S.fire.length) {
    // (owner: the old big pools summed into one disc) a small light at each of up to 80 of its cells, hugging the flames
    const st = Math.max(1, Math.ceil(S.fire.length / 80));
    for (let k = 0; k < S.fire.length; k += st) { const f = S.fire[k]; pool((f.c + 0.5) * TCELL - S.scroll, (f.r + 0.5) * TCELL, 12, 0.45, 0); }
  }
  for (const f of S.foes) {
    const fx = f.x - S.scroll;
    if (fx < -60 || fx > TITLE_VW + 60) continue;
    if (f.burn > 0) pool(fx, f.ty, f.r * 4 + 10, 0.8, 0.3);
    if (f.je) pool(fx, f.ty, f.r * 3 + 16, 0.55, 0.3);
  }
  for (const p of S.props) if (p.burn && !p.gone && p.x > -30 && p.x < TITLE_VW + 30) pool(p.x, p.y + Math.min(p.len, 20), 20, 0.6, 0.2);
  // the dark, the light cut out of it, laid over the scene smoothed
  dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, w, h);
  dc.fillStyle = 'rgba(9,10,14,' + DEV.fogDim + ')'; dc.fillRect(0, 0, w, h);
  dc.globalCompositeOperation = 'destination-out'; dc.filter = 'blur(1.5px)'; dc.drawImage(L, 0, 0); dc.filter = 'none';
  dc.globalCompositeOperation = 'source-over';
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(D, 0, 0, w, h, x0, 0, w * TCELL, h * TCELL);
  ctx.imageSmoothingEnabled = sm;
}

// A player's gun light as you see it, the game's drawBeam (render/light.js): three soft cones out of the gun's muzzle
// (DEV.beamDeg wide, DEV.beamGlow × TITLE_BEAMA bright, a cool white) cut to what the player can see, the lens, the spill.
// Owner, v0.0.171: four of them added up to white (TITLE_BEAMA), and the cone fades in from the muzzle (it began at its
// brightest: against a wall, where the player sees only a sliver, that filled it as a bright square); no lens in the rock
export const TITLE_BEAMA = 0.25;
/** @param {CanvasRenderingContext2D} c @param {import('../../art/titlescene.js').TitleScene} S @param {import('../../art/titlescene.js').TRunner} r @param {number[] | undefined} pts */
function titleBeam(c, S, r, pts) {
  const torchR = SIGHT * DEV.torch * LAMP_REACH * 1.05, R = torchR * Math.max(1, DEV.beamReach), g = DEV.beamGlow * TITLE_BEAMA;
  const pcx = r.x + PW / 2, pcy = r.y + PH * 0.45, lower = r.swap > 0 ? Math.sin(r.swap / 0.3 * Math.PI) * 4 : 0;
  const mz = gunMuzzle(pcx + Math.cos(r.ang) * 2.5, r.y + PH * 0.45 + lower, r.ang, GUN_HELD, r.kit.art), ox = mz.x, oy = mz.y, a = r.ang;
  if (g > 0 && pts && pts.length > 4) {
    c.save();
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.clip();
    const half = DEV.beamDeg * Math.PI / 360;
    for (const k of [1.3, 1, 0.7]) {
      const gr = c.createRadialGradient(ox, oy, 2, ox, oy, R);
      gr.addColorStop(0, 'rgba(225,240,255,0)'); gr.addColorStop(0.08, 'rgba(225,240,255,' + 0.16 * g + ')'); gr.addColorStop(0.45, 'rgba(215,232,255,' + 0.07 * g + ')');
      gr.addColorStop(1, 'rgba(210,230,255,0)');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, R, a - half * k, a + half * k); c.closePath(); c.fill();
    }
    c.restore();
  }
  if (!titleSolid(S, ox, oy)) glowAt(c, ox, oy, 7, 0.5 * TITLE_BEAMA * 2, '230,242,255');
  glowAt(c, pcx, pcy, torchR * DEV.beamNear, 0.06 * TITLE_BEAMA, '220,235,255');
}
