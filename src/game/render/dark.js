// @ts-check
// Floor 2's dark zones on screen (Level 2 stage 4; the zones themselves: world/dark.js). The owner's
// compositing (round 3), bottom to top: 1. the back wall, 2. the hologram, 3. the silk, multiplied over
// 1-2 and blurring them like frosted glass, 4. the rock, decoration, creatures, loot and you: all black
// inside a zone (silhouettes), only fire lifting the black, 5. the fog of war. How, a frame:
//   darkPrep    (drawTerrain, after the hologram) the backdrop for the zones' box in view, small (terrain
//               pixels): the back wall and the hologram each drawn blurred (DEV.l2dBlur; the wall at
//               DEV.l2dBack, the hologram at DEV.l2dHolo), the silk multiplied over them. Then the zones'
//               backs cut out of the picture (destination-out by the zone's shade, its ragged fringe a
//               gradual edge), so what's drawn next lands on nothing there. And the black mask for
//               drawDark: per fog cell, the ramp in from the zone's edge (tintRamp over DEV.l2dTintDepth)
//               × DEV.l2dDark × (1 - the lift: fire's, the DEV.l2dFire curve over the distance to the
//               nearest fire out to DEV.l2dFireR; and the torch's while it works, darkBeam)
//   drawDark    (just before drawFog) everything drawn in a zone (layer 4) goes black by the mask
//               (source-atop: only where something was drawn), then the backdrop behind it
//               (destination-over)
//   darkCut     (drawGlows) the gun light's beam cut out of the zones (electric light doesn't work there)
//   darkBloomCut (drawFx) the zones cut out of the hologram's bloom (theirs is the blurred one)
//   darkFog     (drawFog) a zone's seen ground is left to this file
// The torch failing at a zone's edge (the gun light and the glow round you flickering out): torchLit in
// world/dark.js, stepped by systems/player.js stepTorch, read by light.js.

import { BCELL, BH, BW, CELL, CH, CW, FH, FOG_U, FW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { DEV, kcurve } from '../../dev/knobs.js';
import { curveFn } from '../../world/byDistance.js';
import { silkColour, silkTint, tintRamp } from '../../world/dark.js';
import { beamLift } from '../../world/vision.js';
import { BG_PAR, holoBright, holoGrid, holoLayer, sizedCanvas } from './holo.js';

/** @type {{ web: Uint8Array | null, webC: HTMLCanvasElement | null, zf: Float32Array | null, zfFor: Uint8Array | null,
 *  zC: HTMLCanvasElement | null, m: HTMLCanvasElement | null, mImg: ImageData | null, mb: HTMLCanvasElement | null,
 *  back: HTMLCanvasElement | null, mt: HTMLCanvasElement | null, on: boolean, fx0: number, fy0: number, fx1: number, fy1: number,
 *  bx0: number, by0: number, bx1: number, by1: number, lift: Float32Array, lut: Float32Array,
 *  zt: Float32Array | null, zd: Float32Array | null, zB: HTMLCanvasElement | null, ztKey: string, ztFor: Uint8Array | null,
 *  beam: { a: number, r: number, n: number, x: number, y: number }, webL: HTMLCanvasElement | null,
 *  lm: HTMLCanvasElement | null, lmImg: ImageData | null, lt: HTMLCanvasElement | null }} */
const D = { web: null, webC: null, zf: null, zfFor: null, zC: null, m: null, mImg: null, mb: null, back: null, mt: null, on: false,
  fx0: 0, fy0: 0, fx1: 0, fy1: 0, bx0: 0, by0: 0, bx1: 0, by1: 0, lift: new Float32Array(FW * FH), lut: new Float32Array(65),
  zt: null, zd: null, zB: null, ztKey: '', ztFor: null, beam: { a: 0, r: 0, n: 0, x: 0, y: 0 }, webL: null,
  lm: null, lmImg: null, lt: null };

/** (light.js drawFog, each frame) the gun light as it is, for the next frame's black: its aim, reach, the glow
 * round you and where you are (world units) @param {number} a @param {number} r @param {number} n @param {number} x @param {number} y */
export function darkBeam(a, r, n, x, y) { const b = D.beam; b.a = a; b.r = r; b.n = n; b.x = x; b.y = y; }

// the black's ramp in from a zone's edge (round 3), per fog cell (its mean), and how deep each fog cell is (mean
// px); and at the terrain's pixels, where the torch stops working (its beam cut: from DEV.l2dTorchDepth on,
// over 16 px). Made per floor and again when a knob it uses changes
/** @param {Uint8Array} depth @param {Uint8Array | null} shade */
function depthField(depth, shade) {
  const zt = new Float32Array(FW * FH), zd = new Float32Array(FW * FH), s = FOG_U / CELL, n = 1 / (s * s), T = DEV.l2dTorchDepth;
  D.zB = sizedCanvas(D.zB, CW, CH);
  const c = D.zB.getContext('2d'), img = c ? c.createImageData(CW, CH) : null;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const v = depth[y * CW + x], sh = shade ? shade[y * CW + x] : 0;
    if (!v && !sh) continue;
    const j = Math.floor(y / s) * FW + Math.floor(x / s);
    // the black: half of it across the ragged fringe outside (by its shade), the rest ramping in over the first
    // DEV.l2dTintDepth px inside: past that, silhouette black (owner: most of a zone dark)
    zt[j] += (v ? 0.5 + 0.5 * tintRamp(v) : 0.5 * sh / 255) * n; zd[j] += v * n;
    if (!v) continue;
    if (img) { const u = Math.min(1, Math.max(0, (v - T) / 16)); img.data[(y * CW + x) * 4 + 3] = Math.round(255 * u * u * (3 - 2 * u)); }
  }
  if (c && img) c.putImageData(img, 0, 0);
  D.zt = zt; D.zd = zd;
}

/** is the dark mask up this frame (a zone in view)? */
export const darkOn = () => D.on;
// how much of fog cell i is dark zone, × the darkness (0..1; 0 when no zone is in view): drawFog takes the
// lamp's light and the remembered dim off there, so in a zone the look is this file's alone
/** @param {number} i */
export const darkFog = i => (D.on && D.zf ? Math.min(1, D.zf[i] * 1.15) * Math.min(1, Math.max(0, DEV.l2dDark)) : 0);

// paint a silk canvas (terrain px) from W.webbing, whole or a box of it, in col's colours: the multiply tint
// (silkTint) or the silk seen plainly, as fire lights it (silkColour)
/** @param {Uint8Array} web @param {CanvasRenderingContext2D} c @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 * @param {(v: number) => number[]} col */
function paintSilk(web, c, x0, y0, x1, y1, col) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(CW - 1, x1); y1 = Math.min(CH - 1, y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, img = c.createImageData(w, h), d = img.data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = web[y * CW + x];
    if (!v) continue;
    const s = col(v), k = ((y - y0) * w + x - x0) * 4;
    d[k] = s[0]; d[k + 1] = s[1]; d[k + 2] = s[2]; d[k + 3] = s[3];
  }
  c.putImageData(img, x0, y0);
}

// the zones' shade (0..1, their ragged fringe included): per fog cell, and per terrain pixel as a canvas
// (its alpha), made once per floor
/** @param {Uint8Array} shade */
function zoneField(shade) {
  const zf = new Float32Array(FW * FH), n = 1 / ((FOG_U / CELL) ** 2) / 255, s = FOG_U / CELL;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const v = shade[y * CW + x]; if (v) zf[Math.floor(y / s) * FW + Math.floor(x / s)] += v * n; }
  D.zC = sizedCanvas(D.zC, CW, CH);
  const c = D.zC.getContext('2d');
  if (c) {
    const img = c.createImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) img.data[i * 4 + 3] = shade[i];
    c.putImageData(img, 0, 0);
  }
  return zf;
}

// fire's lift of the black round (x, y): the Dev curve (D.lut) over the distance, out to r (world units);
// w scales it (a flame's flicker, a blast fading). Each fog cell keeps its strongest
/** @param {number} x @param {number} y @param {number} r @param {number} w */
function addLift(x, y, r, w) {
  const L = D.lift, fx0 = Math.max(D.fx0, Math.floor((x - r) / FOG_U)), fx1 = Math.min(D.fx1 - 1, Math.floor((x + r) / FOG_U));
  const fy0 = Math.max(D.fy0, Math.floor((y - r) / FOG_U)), fy1 = Math.min(D.fy1 - 1, Math.floor((y + r) / FOG_U));
  for (let cy = fy0; cy <= fy1; cy++) for (let cx = fx0; cx <= fx1; cx++) {
    const d = Math.hypot((cx + 0.5) * FOG_U - x, (cy + 0.5) * FOG_U - y);
    if (d >= r) continue;
    const v = D.lut[Math.round(d / r * 64)] * w, i = cy * FW + cx;
    if (v > L[i]) L[i] = v;
  }
}

/** (drawTerrain, right after the hologram) the zones' backdrop made, their backs cut out, the black mask @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function darkPrep(W, G, F) {
  D.on = false;
  if (!W.darkMask || !W.webbing || G.RPV || !W.dark.length) return;
  const { vw, vh } = F, m = 24 + Math.max(0, DEV.l2dFringe) * 2 * CELL;
  if (!W.dark.some(z => z.x1 * CELL + m > W.camX && z.x0 * CELL - m < W.camX + vw && z.y1 * CELL + m > W.camY && z.y0 * CELL - m < W.camY + vh)) return;
  // the silk canvas and the zone field, made per floor; explosions' holes repainted (W.webDirty)
  if (D.web !== W.webbing || !D.webC || !D.webL) {
    D.web = W.webbing; D.webC = sizedCanvas(D.webC, CW, CH); D.webL = sizedCanvas(D.webL, CW, CH);
    const c = D.webC.getContext('2d'), cl = D.webL.getContext('2d');
    if (!c || !cl) return;
    c.clearRect(0, 0, CW, CH); cl.clearRect(0, 0, CW, CH);
    paintSilk(W.webbing, c, 0, 0, CW - 1, CH - 1, silkTint);
    paintSilk(W.webbing, cl, 0, 0, CW - 1, CH - 1, silkColour);
    W.webDirty.length = 0;
  }
  if (W.webDirty.length) {
    const c = D.webC.getContext('2d'), cl = D.webL.getContext('2d');
    /** @type {[CanvasRenderingContext2D, (v: number) => number[]][]} */
    const both = c && cl ? [[c, silkTint], [cl, silkColour]] : [];
    for (const b of W.webDirty) for (const [cc, col] of both) {
      cc.clearRect(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); paintSilk(W.webbing, cc, b.x0, b.y0, b.x1, b.y1, col);
    }
    W.webDirty.length = 0;
  }
  const shade = W.darkShade || W.darkMask;
  if (D.zfFor !== shade || !D.zf) { D.zf = zoneField(W.darkShade || W.darkMask.map(v => (v ? 255 : 0))); D.zfFor = shade; }
  if (!D.zC) return;
  const key = DEV.l2dTintDepth + '/' + DEV.l2dTorchDepth;
  if (W.darkDepth && (D.ztKey !== key || D.ztFor !== W.darkDepth || !D.zt)) { depthField(W.darkDepth, W.darkShade); D.ztKey = key; D.ztFor = W.darkDepth; }
  if (!D.zt || !D.zd || !D.zB) return;
  // the view's fog-cell slab
  const fx0 = D.fx0 = clamp(Math.floor(W.camX / FOG_U) - 2, 0, FW - 1), fy0 = D.fy0 = clamp(Math.floor(W.camY / FOG_U) - 2, 0, FH - 1);
  const fx1 = D.fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 3, 1, FW), fy1 = D.fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 3, 1, FH);
  // the zones' box in view (fog cells, the fringe and the blur's spill included): every pass keeps to it (on a
  // software-drawn phone each full-screen pass costs ~10 ms)
  const s8 = FOG_U / CELL, pad = Math.ceil(DEV.l2dEdge * 2 + Math.max(0, DEV.l2dFringe) * 1.7 / s8) + 1;
  let bx0 = FW, by0 = FH, bx1 = 0, by1 = 0;
  for (const z of W.dark) {
    bx0 = Math.min(bx0, Math.floor(z.x0 / s8) - pad); by0 = Math.min(by0, Math.floor(z.y0 / s8) - pad);
    bx1 = Math.max(bx1, Math.ceil(z.x1 / s8) + pad); by1 = Math.max(by1, Math.ceil(z.y1 / s8) + pad);
  }
  bx0 = D.bx0 = Math.max(bx0, fx0); by0 = D.by0 = Math.max(by0, fy0); bx1 = D.bx1 = Math.min(bx1, fx1); by1 = D.by1 = Math.min(by1, fy1);
  if (bx1 <= bx0 || by1 <= by0) return;
  // ---- the fire's lift: per fog cell, the Dev curve over the distance to the nearest fire ----
  const fc = curveFn(kcurve('l2dFire'));
  for (let k = 0; k <= 64; k++) D.lut[k] = clamp(fc(k / 64), 0, 1);
  for (let cy = fy0; cy < fy1; cy++) D.lift.fill(0, cy * FW + fx0, cy * FW + fx1);
  const R = Math.max(1, DEV.l2dFireR) * CELL, fl = W.fire.list, st = Math.max(1, Math.ceil(fl.length / 300));
  for (let k = 0; k < fl.length; k += st) {
    const i = fl[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
    if (x > W.camX - R && x < W.camX + vw + R && y > W.camY - R && y < W.camY + vh + R) addLift(x, y, R, W.flick);
  }
  for (const f of W.flashes) addLift(f.x, f.y, R + f.r * 2, clamp(2 * (1 - f.t / 0.25), 0, 1));   // a blast: fire for a moment
  for (const e of W.enemies) if (e.burn > 0) addLift(e.x, e.ty, R, W.flick);
  if (W.p.burn > 0 && !W.p.dead) addLift(W.p.x + 6, W.p.y + 11, R, W.flick);
  // the torch, while it works, cuts through the black too (round 3: the stretch in before it fails), on what
  // you can see, never past where it fails
  const bm = D.beam, zd = D.zd, Tq = DEV.l2dTorchDepth;
  if (W.torchLit > 0 && !W.p.dead && (bm.r > 0 || bm.n > 0)) {
    const reach = Math.max(bm.r, bm.n);
    const cx0 = Math.max(bx0, Math.floor((bm.x - reach) / FOG_U)), cx1 = Math.min(bx1 - 1, Math.floor((bm.x + reach) / FOG_U));
    const cy0 = Math.max(by0, Math.floor((bm.y - reach) / FOG_U)), cy1 = Math.min(by1 - 1, Math.floor((bm.y + reach) / FOG_U));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const i = cy * FW + cx;
      if (W.seen[i] !== 2) continue;
      const dx = (cx + 0.5) * FOG_U - bm.x, dy = (cy + 0.5) * FOG_U - bm.y, u = Math.min(1, Math.max(0, (zd[i] - Tq) / 16));
      const v = beamLift(Math.hypot(dx, dy), dx, dy, bm.a, bm.r, bm.n) * (1 - u * u * (3 - 2 * u));
      if (v > D.lift[i]) D.lift[i] = v;
    }
  }
  // ---- the black mask: alpha = the ramp in from the edge × darkness × (1 - lift) ----
  const M = D.m = sizedCanvas(D.m, FW, FH), mc = M.getContext('2d');
  D.mb = sizedCanvas(D.mb, FW, FH);
  const mbc = D.mb.getContext('2d');
  if (!mc || !mbc) return;
  if (!D.mImg) D.mImg = mc.createImageData(FW, FH);
  const md = D.mImg.data, dark = clamp(DEV.l2dDark, 0, 1), zt = D.zt;
  for (let cy = by0; cy < by1; cy++) for (let cx = bx0; cx < bx1; cx++) {
    const i = cy * FW + cx, k = i * 4;
    md[k] = 0; md[k + 1] = 0; md[k + 2] = 0;
    md[k + 3] = Math.round(255 * Math.min(1, zt[i]) * dark * (1 - D.lift[i]));
  }
  mc.putImageData(D.mImg, 0, 0, bx0, by0, bx1 - bx0, by1 - by0);
  mbc.clearRect(bx0, by0, bx1 - bx0, by1 - by0);
  mbc.filter = DEV.l2dEdge > 0 ? `blur(${DEV.l2dEdge}px)` : 'none';
  mbc.drawImage(M, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
  mbc.filter = 'none';
  // at the rock's pixel size for the box (smoothed up once, small), so the passes over the picture are
  // crisp (nearest): a smoothed upscale costs far more on a software canvas
  const tx0 = bx0 * s8, ty0 = by0 * s8, tw = (bx1 - bx0) * s8, th = (by1 - by0) * s8;
  const T = D.mt = sizedCanvas(D.mt, tw, th), tc = T.getContext('2d');
  if (!tc) return;
  tc.clearRect(0, 0, tw, th); tc.imageSmoothingEnabled = true;
  tc.drawImage(D.mb, bx0, by0, bx1 - bx0, by1 - by0, 0, 0, tw, th);
  // ---- the backdrop (terrain px): 1. the back wall and 2. the hologram, blurred; 3. the silk, multiplied ----
  const B = D.back = sizedCanvas(D.back, tw, th), bc = B.getContext('2d');
  if (!bc) return;
  const bl = Math.max(0, DEV.l2dBlur), blur = bl > 0 ? `blur(${bl}px)` : 'none';
  bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalCompositeOperation = 'source-over'; bc.globalAlpha = 1;
  bc.fillStyle = '#000'; bc.fillRect(0, 0, tw, th);
  // the back wall: as drawTerrain lays it (parallax BG_PAR), in this box, blurred, at DEV.l2dBack
  const bgox = W.camX * (1 - BG_PAR), bgoy = W.camY * (1 - BG_PAR);
  const wx0 = tx0 * CELL - bgox, wy0 = ty0 * CELL - bgoy, gx0 = clamp(Math.floor(wx0 / BCELL) - 2, 0, BW - 1), gy0 = clamp(Math.floor(wy0 / BCELL) - 2, 0, BH - 1);
  const gx1 = clamp(Math.ceil((wx0 + tw * CELL) / BCELL) + 2, 1, BW), gy1 = clamp(Math.ceil((wy0 + th * CELL) / BCELL) + 2, 1, BH);
  bc.imageSmoothingEnabled = true; bc.filter = blur; bc.globalAlpha = clamp(DEV.l2dBack, 0, 1);
  const hs = G.bgHiOn ? BCELL / CELL : 1;
  bc.drawImage(G.bgHiOn ? G.bgHi : G.bg, gx0 * hs, gy0 * hs, (gx1 - gx0) * hs, (gy1 - gy0) * hs, (gx0 * BCELL + bgox) / CELL - tx0, (gy0 * BCELL + bgoy) / CELL - ty0, (gx1 - gx0) * BCELL / CELL, (gy1 - gy0) * BCELL / CELL);
  // the hologram over it, as bright as it is (× DEV.l2dHolo), blurred
  const hl = holoLayer(), hb = holoBright() * DEV.l2dHolo;
  if (hl && hb > 0.01) {
    const g = holoGrid.rect;
    bc.globalAlpha = clamp(hb, 0, 1);
    bc.drawImage(hl, 0, 0, hl.width, hl.height, g.x / CELL - tx0, g.y / CELL - ty0, g.w / CELL, g.h / CELL);
  }
  bc.filter = 'none'; bc.globalAlpha = 1;
  // the silk multiplied over both: it darkens and tints what's under it, never lights it
  bc.globalCompositeOperation = 'multiply'; bc.imageSmoothingEnabled = false;
  bc.drawImage(D.webC, tx0, ty0, tw, th, 0, 0, tw, th);
  bc.globalCompositeOperation = 'source-over';
  // near fire (and the torch while it works) the silk's black lifts like everything else's (owner): the silk seen
  // plainly, over the multiplied one, by the same lift (per fog cell, smoothed up)
  let anyLift = false;
  for (let cy = by0; cy < by1 && !anyLift; cy++) for (let cx = bx0; cx < bx1; cx++) if (D.lift[cy * FW + cx] > 0.01) { anyLift = true; break; }
  if (anyLift && D.webL) {
    const LM = D.lm = sizedCanvas(D.lm, FW, FH), lc = LM.getContext('2d');
    const LT = D.lt = sizedCanvas(D.lt, tw, th), ltc = LT.getContext('2d');
    if (lc && ltc) {
      if (!D.lmImg) D.lmImg = lc.createImageData(FW, FH);
      const ld = D.lmImg.data;
      for (let cy = by0; cy < by1; cy++) for (let cx = bx0; cx < bx1; cx++) { const i = cy * FW + cx; ld[i * 4 + 3] = Math.round(255 * D.lift[i]); }
      lc.putImageData(D.lmImg, 0, 0, bx0, by0, bx1 - bx0, by1 - by0);
      ltc.globalCompositeOperation = 'source-over'; ltc.clearRect(0, 0, tw, th); ltc.imageSmoothingEnabled = false;
      ltc.drawImage(D.webL, tx0, ty0, tw, th, 0, 0, tw, th);
      ltc.globalCompositeOperation = 'destination-in'; ltc.imageSmoothingEnabled = true;
      ltc.drawImage(LM, bx0, by0, bx1 - bx0, by1 - by0, 0, 0, tw, th);
      ltc.globalCompositeOperation = 'source-over';
      bc.drawImage(LT, 0, 0);
    }
  }
  D.on = true;
  // ---- the zones' backs cut out of the picture so far (by their shade: the fringe a gradual edge) ----
  const ctx = G.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(D.zC, tx0, ty0, tw, th, tx0 * CELL, ty0 * CELL, tw * CELL, th * CELL);
  ctx.restore();
}

/** (just before drawFog) layer 4 black in the zones, the backdrop behind @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawDark(W, G, F) {
  if (!D.on || !D.mt || !D.back) return;
  const ctx = G.ctx, s8 = FOG_U / CELL, tx0 = D.bx0 * s8, ty0 = D.by0 * s8, MT = D.mt, B = D.back;
  const sx = tx0 * CELL, sy = ty0 * CELL, sw = MT.width * CELL, sh = MT.height * CELL;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // 1. whatever was drawn in the zone goes black (only where something was drawn)
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(MT, 0, 0, MT.width, MT.height, sx, sy, sw, sh);
  // 2. behind it, the backdrop (the zones' backs were cut out: it shows there, gradually through the fringe)
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(B, 0, 0, B.width, B.height, sx, sy, sw, sh);
  ctx.restore();
}

/** (drawFx, the hologram's bloom, under the world's transform) the zones cut out of the bloom: in a zone the
 * hologram is the backdrop's blurred one, its sharp light not spilt over it @param {CanvasRenderingContext2D} c */
export function darkBloomCut(c) {
  if (!D.on || !D.zC) return;
  const s8 = FOG_U / CELL, tx0 = D.bx0 * s8, ty0 = D.by0 * s8, tw = (D.bx1 - D.bx0) * s8, th = (D.by1 - D.by0) * s8;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.imageSmoothingEnabled = true;
  c.drawImage(D.zC, tx0, ty0, tw, th, tx0 * CELL, ty0 * CELL, tw * CELL, th * CELL);
  c.restore();
}

/** (drawGlows, on its glow layer, after the beam) cut the gun light out of the zones past where the torch fails @param {CanvasRenderingContext2D} c */
export function darkCut(c) {
  if (!D.on || !D.zB) return;
  const s8 = FOG_U / CELL, tx0 = D.bx0 * s8, ty0 = D.by0 * s8, tw = (D.bx1 - D.bx0) * s8, th = (D.by1 - D.by0) * s8;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.imageSmoothingEnabled = false;
  c.drawImage(D.zB, tx0, ty0, tw, th, tx0 * CELL, ty0 * CELL, tw * CELL, th * CELL);
  c.drawImage(D.zB, tx0, ty0, tw, th, tx0 * CELL, ty0 * CELL, tw * CELL, th * CELL);
  c.restore();
}
