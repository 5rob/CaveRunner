// @ts-check
// Floor 2's dark zones on screen (Level 2 stage 4; the zones themselves: world/dark.js).
// Inside one the gun light dies, a coat of spun silk hides the hologram (only a haze of it gets
// through) and everything in front shows as a black silhouette against the faintly lit silk. Fire,
// explosions and glowing shots still light it. How, cheaply, a frame:
//   darkPrep    (drawTerrain, after the hologram) a fog-cell-sized darkness mask for the view: the
//               zones (soft edged, DEV.l2dEdge) × DEV.l2dDark × (1 - this frame's firelight); the silk
//               drawn over the background; then the background cut out of the canvas by the mask
//               (destination-out), so the zone's back is see-through when the rock, props, creatures
//               and you are drawn over it
//   drawDark    (just before drawFog) everything drawn in the zone is blacked by the mask (source-atop:
//               only where something was drawn), then behind it (destination-over) the silk, faintly
//               lit (DEV.l2dBack), the hologram's light diffused through it (DEV.l2dHolo: a wide soft glow,
//               DEV.l2dHoloBlur, and a tighter one caught in the silk), and near-black
//   darkBloomCut (drawFx) the zones cut out of the hologram's bloom (their glow is drawDark's)
//   darkCut     (drawGlows) the gun light's beam cut out of the zones (electric light doesn't work there)
// Nothing here lifts or writes the fog: the fog of war is drawn over all of it as ever.

import { CELL, CH, CW, FH, FOG_U, FW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { DEV } from '../../dev/knobs.js';
import { silkColour } from '../../world/dark.js';
import { holoBright, holoGrid, holoLayer, sizedCanvas } from './holo.js';

/** @type {{ web: Uint8Array | null, webC: HTMLCanvasElement | null, zf: Float32Array | null, zfFor: Uint8Array | null,
 *  m: HTMLCanvasElement | null, mImg: ImageData | null, mb: HTMLCanvasElement | null, haze: HTMLCanvasElement | null,
 *  back: HTMLCanvasElement | null, glow: HTMLCanvasElement | null, mt: HTMLCanvasElement | null, on: boolean, fx0: number, fy0: number, fx1: number, fy1: number,
 *  bx0: number, by0: number, bx1: number, by1: number, light: Float32Array }} */
const D = { web: null, webC: null, zf: null, zfFor: null, m: null, mImg: null, mb: null, haze: null, back: null, glow: null, mt: null, on: false,
  fx0: 0, fy0: 0, fx1: 0, fy1: 0, bx0: 0, by0: 0, bx1: 0, by1: 0, light: new Float32Array(FW * FH) };

/** is the dark mask up this frame (a zone in view)? */
export const darkOn = () => D.on;
// how much of fog cell i is dark zone, × the darkness (0..1; 0 when no zone is in view): drawFog takes the
// lamp's light and the remembered dim off there, so in a zone the look is this file's alone
/** @param {number} i */
export const darkFog = i => (D.on && D.zf ? Math.min(1, D.zf[i] * 1.15) * Math.min(1, Math.max(0, DEV.l2dDark)) : 0);

// paint the silk canvas (terrain px) from W.webbing, whole or a box of it
/** @param {Uint8Array} web @param {Uint8Array} mask @param {CanvasRenderingContext2D} c @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
function paintSilk(web, mask, c, x0, y0, x1, y1) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, img = c.createImageData(w, h), d = img.data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = mask[y * CW + x] ? web[y * CW + x] : 0;      // (the fringe's silk is baked into the decoration layer)
    if (!v) continue;
    const s = silkColour(v), k = ((y - y0) * w + x - x0) * 4;
    d[k] = s[0]; d[k + 1] = s[1]; d[k + 2] = s[2]; d[k + 3] = s[3];
  }
  c.putImageData(img, x0, y0);
}

// how dark each fog cell is (0..1: the zones' shade, their ragged fringe included), made once per floor
/** @param {Uint8Array} shade */
function zoneField(shade) {
  const zf = new Float32Array(FW * FH), n = 1 / ((FOG_U / CELL) ** 2) / 255, s = FOG_U / CELL;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const v = shade[y * CW + x]; if (v) zf[Math.floor(y / s) * FW + Math.floor(x / s)] += v * n; }
  return zf;
}

// light a fog-cell grid round (x, y): w at the middle, nothing past r (world units)
/** @param {number} x @param {number} y @param {number} r @param {number} w */
function addLight(x, y, r, w) {
  const L = D.light, fx0 = Math.max(D.fx0, Math.floor((x - r) / FOG_U)), fx1 = Math.min(D.fx1 - 1, Math.floor((x + r) / FOG_U));
  const fy0 = Math.max(D.fy0, Math.floor((y - r) / FOG_U)), fy1 = Math.min(D.fy1 - 1, Math.floor((y + r) / FOG_U));
  for (let cy = fy0; cy <= fy1; cy++) for (let cx = fx0; cx <= fx1; cx++) {
    const d = Math.hypot((cx + 0.5) * FOG_U - x, (cy + 0.5) * FOG_U - y);
    if (d < r) L[cy * FW + cx] += w * (1 - d / r);
  }
}

/** (drawTerrain, right after the hologram) the silk over the background, and the zones' backs cut out @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function darkPrep(W, G, F) {
  D.on = false;
  if (!W.darkMask || !W.webbing || G.RPV || !W.dark.length) return;
  const { vw, vh } = F, m = 24;
  if (!W.dark.some(z => z.x1 * CELL > W.camX - m && z.x0 * CELL < W.camX + vw + m && z.y1 * CELL > W.camY - m && z.y0 * CELL < W.camY + vh + m)) return;
  // the silk canvas and the zone field, made per floor; explosions' holes repainted (W.webDirty)
  if (D.web !== W.webbing || !D.webC) {
    D.web = W.webbing; D.webC = sizedCanvas(D.webC, CW, CH);
    const c = D.webC.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, CW, CH);
    for (const z of W.dark) paintSilk(W.webbing, W.darkMask, c, z.x0, z.y0, z.x1, z.y1);
    W.webDirty.length = 0;
  }
  if (W.webDirty.length) {
    const c = D.webC.getContext('2d');
    if (c) for (const b of W.webDirty) { c.clearRect(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); paintSilk(W.webbing, W.darkMask, c, b.x0, b.y0, b.x1, b.y1); }
    W.webDirty.length = 0;
  }
  const shade = W.darkShade || W.darkMask;
  if (D.zfFor !== shade || !D.zf) { D.zf = zoneField(W.darkShade || W.darkMask.map(v => (v ? 255 : 0))); D.zfFor = shade; }
  // the view's fog-cell slab
  const fx0 = D.fx0 = clamp(Math.floor(W.camX / FOG_U) - 2, 0, FW - 1), fy0 = D.fy0 = clamp(Math.floor(W.camY / FOG_U) - 2, 0, FH - 1);
  const fx1 = D.fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 3, 1, FW), fy1 = D.fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 3, 1, FH);
  // this frame's light: fire, explosion flashes, glowing shots, anything burning
  for (let cy = fy0; cy < fy1; cy++) D.light.fill(0, cy * FW + fx0, cy * FW + fx1);
  const fl = W.fire.list, st = Math.max(1, Math.ceil(fl.length / 300));
  for (let k = 0; k < fl.length; k += st) {
    const i = fl[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
    if (x > W.camX - 60 && x < W.camX + vw + 60 && y > W.camY - 60 && y < W.camY + vh + 60) addLight(x, y, 56, 0.12 * st * W.flick);
  }
  for (const f of W.flashes) addLight(f.x, f.y, f.r * 3.5 + 30, 2 * (1 - f.t / 0.25));
  for (const b of W.bullets) if (b.light && !b.hidden) addLight(b.x, b.y, (b.lightR || 20) * 1.8, 1);
  for (const e of W.enemies) if (e.burn > 0) addLight(e.x, e.ty, 60, 0.7);
  if (W.p.burn > 0 && !W.p.dead) addLight(W.p.x + 6, W.p.y + 11, 60, 0.8);
  // the mask: alpha = zone × darkness × (1 - light), black
  const M = D.m = sizedCanvas(D.m, FW, FH), mc = M.getContext('2d');
  D.mb = sizedCanvas(D.mb, FW, FH);
  const bc = D.mb.getContext('2d');
  if (!mc || !bc) return;
  if (!D.mImg) D.mImg = mc.createImageData(FW, FH);
  const md = D.mImg.data, dark = clamp(DEV.l2dDark, 0, 1), zf = D.zf;
  for (let cy = fy0; cy < fy1; cy++) for (let cx = fx0; cx < fx1; cx++) {
    const i = cy * FW + cx, k = i * 4;
    md[k] = 2; md[k + 1] = 2; md[k + 2] = 4;
    md[k + 3] = Math.round(255 * Math.min(1, zf[i] * 1.15) * dark * clamp(1 - D.light[i], 0, 1));
  }
  mc.putImageData(D.mImg, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
  bc.clearRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  bc.filter = DEV.l2dEdge > 0 ? `blur(${DEV.l2dEdge}px)` : 'none';
  bc.drawImage(M, fx0, fy0, fx1 - fx0, fy1 - fy0, fx0, fy0, fx1 - fx0, fy1 - fy0);
  bc.filter = 'none';
  D.on = true;
  // every pass after this keeps to the zones' box in view (fog cells; the blur's spill included): on a
  // software-drawn phone each full-screen pass costs ~10 ms
  const s8 = FOG_U / CELL, pad = Math.ceil(DEV.l2dEdge * 2) + 1;
  let bx0 = FW, by0 = FH, bx1 = 0, by1 = 0;
  for (const z of W.dark) {
    bx0 = Math.min(bx0, Math.floor(z.x0 / s8) - pad); by0 = Math.min(by0, Math.floor(z.y0 / s8) - pad);
    bx1 = Math.max(bx1, Math.ceil(z.x1 / s8) + pad); by1 = Math.max(by1, Math.ceil(z.y1 / s8) + pad);
  }
  D.bx0 = Math.max(bx0, fx0); D.by0 = Math.max(by0, fy0); D.bx1 = Math.min(bx1, fx1); D.by1 = Math.min(by1, fy1);
  if (D.bx1 <= D.bx0 || D.by1 <= D.by0) { D.on = false; return; }
  // the mask at the rock's pixel size for the box (smoothed up once, small), so the passes over the
  // picture are crisp (nearest) and pixel-style: a smoothed upscale costs far more on a software canvas
  const { bx0: a, by0: b, bx1: c, by1: d } = D, tw = (c - a) * s8, th = (d - b) * s8;
  const T = D.mt = sizedCanvas(D.mt, tw, th), tc = T.getContext('2d');
  if (!tc) { D.on = false; return; }
  tc.clearRect(0, 0, tw, th); tc.imageSmoothingEnabled = true;
  tc.drawImage(D.mb, a, b, c - a, d - b, 0, 0, tw, th);
  // the zones' backs cut out of the picture so far (see-through for what's drawn over them)
  const ctx = G.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(T, 0, 0, tw, th, a * FOG_U, b * FOG_U, (c - a) * FOG_U, (d - b) * FOG_U);
  ctx.restore();
}

/** (just before drawFog) silhouettes, and the faint silk behind them @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawDark(W, G, F) {
  if (!D.on || !D.mt || !D.webC) return;
  const ctx = G.ctx, { bx0, by0, bx1, by1 } = D, MT = D.mt;
  const sx = bx0 * FOG_U, sy = by0 * FOG_U, sw = (bx1 - bx0) * FOG_U, sh = (by1 - by0) * FOG_U;
  // the backdrop, made small (terrain pixels): near-black, the silk faintly lit, the hologram's haze
  const s8 = FOG_U / CELL, tx0 = bx0 * s8, ty0 = by0 * s8, tw = (bx1 - bx0) * s8, th = (by1 - by0) * s8;
  const B = D.back = sizedCanvas(D.back, tw, th), bc = B.getContext('2d');
  if (!bc) return;
  bc.globalAlpha = 1; bc.fillStyle = '#050508'; bc.fillRect(0, 0, tw, th);
  bc.globalAlpha = clamp(DEV.l2dBack, 0, 1);
  bc.drawImage(D.webC, tx0, ty0, tw, th, 0, 0, tw, th);
  const hl = holoLayer(), hb = holoBright() * DEV.l2dHolo;
  if (hl && hb > 0.01) {
    // the hologram diffused by the silk, as light: its layer shrunk, then added (lighter) twice, a wide soft
    // glow over the whole back (DEV.l2dHoloBlur) and a tighter one caught in the silk itself (only where
    // there is silk, as thick as it is), so it shows as a glow through the threads, never as its shapes
    const hw = Math.max(1, Math.round(hl.width / 4)), hh = Math.max(1, Math.round(hl.height / 4));
    const Hz = D.haze = sizedCanvas(D.haze, hw, hh), hc = Hz.getContext('2d');
    const Gl = D.glow = sizedCanvas(D.glow, tw, th), gc = Gl.getContext('2d');
    if (hc && gc) {
      hc.clearRect(0, 0, hw, hh); hc.imageSmoothingEnabled = true; hc.drawImage(hl, 0, 0, hw, hh);
      const g = holoGrid.rect, gx = g.x / CELL - tx0, gy = g.y / CELL - ty0, gw = g.w / CELL, gh = g.h / CELL, bl = Math.max(0, DEV.l2dHoloBlur);
      bc.globalCompositeOperation = 'lighter'; bc.imageSmoothingEnabled = true;
      bc.filter = bl > 0 ? `blur(${bl}px)` : 'none';
      bc.globalAlpha = clamp(hb * 0.6, 0, 1);
      bc.drawImage(Hz, 0, 0, hw, hh, gx, gy, gw, gh);
      bc.filter = 'none';
      gc.globalCompositeOperation = 'source-over'; gc.clearRect(0, 0, tw, th); gc.imageSmoothingEnabled = true;
      gc.filter = bl > 0 ? `blur(${(bl * 0.4).toFixed(2)}px)` : 'none';
      gc.drawImage(Hz, 0, 0, hw, hh, gx, gy, gw, gh);
      gc.filter = 'none';
      gc.globalCompositeOperation = 'destination-in';
      gc.drawImage(D.webC, tx0, ty0, tw, th, 0, 0, tw, th);
      gc.globalCompositeOperation = 'source-over';
      bc.globalAlpha = clamp(hb, 0, 1);
      bc.drawImage(Gl, 0, 0);
      bc.globalCompositeOperation = 'source-over';
    }
  }
  bc.globalAlpha = 1;
  ctx.save();
  // 1. whatever was drawn in the zone goes black (only where something was drawn)
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(MT, 0, 0, MT.width, MT.height, sx, sy, sw, sh);
  // 2. behind it, the backdrop
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(B, 0, 0, tw, th, sx, sy, sw, sh);
  ctx.restore();
}

/** (drawFx, the hologram's bloom, under the world's transform) the zones cut out of the bloom: in a zone its glow
 * is drawDark's diffused one alone, not the sharp hologram's light over the silhouettes @param {CanvasRenderingContext2D} c */
export function darkBloomCut(c) {
  if (!D.on || !D.mt) return;
  const { bx0, by0, bx1, by1 } = D, MT = D.mt;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.imageSmoothingEnabled = true;
  c.drawImage(MT, 0, 0, MT.width, MT.height, bx0 * FOG_U, by0 * FOG_U, (bx1 - bx0) * FOG_U, (by1 - by0) * FOG_U);
  c.restore();
}

/** (drawGlows, on its glow layer, after the beam) cut the gun light out of the zones @param {CanvasRenderingContext2D} c */
export function darkCut(c) {
  if (!D.on || !D.mt) return;
  const { bx0: fx0, by0: fy0, bx1: fx1, by1: fy1 } = D, MT = D.mt;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.imageSmoothingEnabled = false;
  c.drawImage(MT, 0, 0, MT.width, MT.height, fx0 * FOG_U, fy0 * FOG_U, (fx1 - fx0) * FOG_U, (fy1 - fy0) * FOG_U);
  c.drawImage(MT, 0, 0, MT.width, MT.height, fx0 * FOG_U, fy0 * FOG_U, (fx1 - fx0) * FOG_U, (fy1 - fy0) * FOG_U);
  c.restore();
}
