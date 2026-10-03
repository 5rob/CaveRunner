// @ts-check
// The light of draw() (render/draw.js), each a part it calls in order with its frame object F
// (REFACTOR.md D19): the torchlight and the fog of war, then every light drawn over the fog.
// drawFog is not only a picture: it writes the fog memory (fogReveal), so it keeps its place

import { drawProp, propGlow } from '../../art/props.js';
import { drawSconce, glowAt } from '../../art/sprites.js';
import { CELL, CW, FH, FOG_U, FW, LAMP_REACH, PH, PW, SHOP_Y, SIGHT } from '../../core/consts.js';
import { clamp, hexRgb } from '../../core/util.js';
import { DEV, carrotAt, jcol, kru } from '../../dev/knobs.js';
import { PAD_LIT, shopDark } from '../../world/shoplights.js';
import { webPath } from '../../world/sway.js';
import { VIS_RAYS, fogReveal, visPoly } from '../../world/vision.js';
import { fogLit } from '../systems/fog.js';
import { plantGlow } from '../systems/plantglow.js';
import { torchHand } from '../systems/player.js';
import { solidCell } from '../systems/terrain.js';
import { holoBright, holoGrid, holoMask, sizedCanvas } from './holo.js';

// The fog of war alone (never-seen ground; none of the dark outside your torchlight), baked and
// blurred beside the full fog: the hologram is darkened by this one only. Made on first use
/** @type {{ c: HTMLCanvasElement | null, img: ImageData | null, blur: HTMLCanvasElement | null, mask: HTMLCanvasElement | null, over: HTMLCanvasElement | null, sil: HTMLCanvasElement | null, dark: HTMLCanvasElement | null }} */
const war = { c: null, img: null, blur: null, mask: null, over: null, sil: null, dark: null };
/** the blurred fog-of-war-only canvas (FW x FH), or null before the first frame */
export const fogWarC = () => war.blur;
/** this frame's silhouettes over the hologram (holoGrid's size), or null: fx.js keeps the bloom off them */
export const holoSil = () => war.sil;

// Blur a slab of a fog canvas into its blurred copy (at source size: cheap). The blur sees nothing
// past the level, which thinned the fog to a see-through strip down both sides, so the sharp edge
// cells go back underneath
/** @param {HTMLCanvasElement} src @param {CanvasRenderingContext2D} dst @param {number} fx0 @param {number} fy0 @param {number} fx1 @param {number} fy1 */
function blurSlab(src, dst, fx0, fy0, fx1, fy1) {
  const ew = fx1 - fx0, eh = fy1 - fy0;
  dst.clearRect(fx0, fy0, ew, eh);
  dst.filter = 'blur(0.9px)';
  dst.drawImage(src, fx0, fy0, ew, eh, fx0, fy0, ew, eh);
  dst.filter = 'none';
  dst.globalCompositeOperation = 'destination-over';
  if (fx0 === 0) dst.drawImage(src, 0, fy0, 1, eh, 0, fy0, 1, eh);
  if (fx1 === FW) dst.drawImage(src, FW - 1, fy0, 1, eh, FW - 1, fy0, 1, eh);
  if (fy0 === 0) dst.drawImage(src, fx0, 0, ew, 1, fx0, 0, ew, 1);
  if (fy1 === FH) dst.drawImage(src, fx0, FH - 1, ew, 1, fx0, FH - 1, ew, 1);
  dst.globalCompositeOperation = 'source-over';
}

// The torchlight and the fog of war: the line of sight lifts the fog (fogReveal writes the fog
// memory here, every frame), then the fog overlay is baked, blurred and drawn with the lamp
// brightening only ground already uncovered
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawFog(W, G, F) {
  const { vw, vh, pcx, pcy } = F;
  // ---- torchlight, masked by the fog of war ----
  // Line of sight is what lifts the fog: fogReveal marks every cell the fan reaches as
  // somewhere you have been, and it stays marked for the rest of the floor. The lamp
  // then lights that lifted ground — brightest at your feet, fading out to torchR — but
  // it is MASKED by the fog: a cell you have never had line of sight to stays dark even
  // with the torch right on top of it, so the cave ahead of you is a real unknown. The
  // lamp does not itself stop at walls; it is the *reveal* that respects them, so what
  // you have already uncovered round a corner still lights up. `flick` is the flame's
  // own number, so both the reach and the brightness breathe exactly as the fire does.
  const sight = SIGHT * DEV.torch * carrotAt('caTorch', W.pb.carrot);   // dev knob and Carrot scale the whole bubble
  W.torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * W.flick), 120, 1400);
  W.visPts = visPoly(pcx, pcy, sight, (cx, cy) => solidCell(W, cx, cy), VIS_RAYS);
  fogReveal(W.seen, pcx, pcy, sight, W.visPts, VIS_RAYS);   // line of sight lifts the fog
  if (!G.RPV || G.RPV.fog) {                                 // a replay can turn the fog off
    // bake the visible slab of the overlay every frame: the base darkness is the fog
    // state, then the lamp brightens the cells the fog has already been lifted from
    if (!war.c) { war.c = sizedCanvas(null, FW, FH); war.blur = sizedCanvas(null, FW, FH); }
    const wctx = war.c.getContext('2d'), wbctx = war.blur && war.blur.getContext('2d');
    if (!wctx || !wbctx || !war.blur) return;
    if (!war.img) war.img = wctx.createImageData(FW, FH);
    const fdat = G.fogImg.data, wdat = war.img.data;
    const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
    const lr2 = W.torchR * W.torchR;
    const shopL = G.RPV ? null : W.shopLit, shopRow = Math.floor(SHOP_Y / FOG_U) - 1;
    const fx0 = clamp(Math.floor(W.camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(W.camY / FOG_U) - 1, 0, FH - 1);
    const fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 2, 1, FH);
    for (let cy = fy0; cy < fy1; cy++) {
      const ddy = (cy + 0.5) * FOG_U - pcy;
      for (let cx = fx0; cx < fx1; cx++) {
        const i = cy * FW + cx, k = i * 4;
        fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
        wdat[k] = 9; wdat[k + 1] = 10; wdat[k + 2] = 14;
        let s = W.seen[i];
        // push the dark off ground you have seen: an unseen cell that borders a seen one
        // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
        // shows instead of the darkness sitting right on its edge
        if (!s && !(W.deepFog && W.deepFog[i]) && ((cx > 0 && W.seen[i - 1]) || (cx < FW - 1 && W.seen[i + 1]) ||
            (cy > 0 && W.seen[i - FW]) || (cy < FH - 1 && W.seen[i + FW]) ||
            (cx > 0 && cy > 0 && W.seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && W.seen[i - FW + 1]) ||
            (cx > 0 && cy < FH - 1 && W.seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && W.seen[i + FW + 1]))) s = 1;
        let a = s === 2 ? 0 : s ? dim : dark;
        // a new run's shop, dark but for the sections lit so far, the teleporter's glow and your torch
        if (s === 2 && shopL && cy >= shopRow) {
          const wx = (cx + 0.5) * FOG_U, pd = Math.hypot(wx - W.arrival.x, (cy + 0.5) * FOG_U - W.arrival.y);
          a = Math.round(dark * shopDark(shopL, wx, W.time) * (pd < PAD_LIT ? 0.3 + 0.7 * pd / PAD_LIT : 1));
        }
        wdat[k + 3] = s ? 0 : dark;          // the fog of war alone
        if (s && a) {                        // the lamp only reaches ground the fog has lifted
          const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
          if (dd2 < lr2) {
            const t = Math.sqrt(dd2) / W.torchR;               // 0 at your feet, 1 at the edge
            const lift = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
            a = a * (1 - lift);
          }
        }
        fdat[k + 3] = a;
      }
    }
    G.fctx.putImageData(G.fogImg, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
    wctx.putImageData(war.img, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
    // blur the slab at source resolution (cheap: an 80x200 canvas), then upscale the soft
    // copy — a source-px of blur becomes ~a fog cell of blur on screen, so the fog edge
    // reads as a gradient rather than a hard line
    blurSlab(G.fogC, G.fbctx, fx0, fy0, fx1, fy1);
    blurSlab(war.c, wbctx, fx0, fy0, fx1, fy1);
    const sx = fx0 * FOG_U, sy = fy0 * FOG_U, sw = (fx1 - fx0) * FOG_U, sh = (fy1 - fy0) * FOG_U;
    if (!(holoBright() > 0)) {
      war.sil = null;
      G.ctx.imageSmoothingEnabled = true;     // the upscale further softens the edge
      G.ctx.drawImage(G.fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0, sx, sy, sw, sh);
      G.ctx.imageSmoothingEnabled = false;
      return;
    }
    // Where the hologram shows, it takes only the fog of war, not the dark outside your
    // torchlight: on the hologram's pixel grid (holoGrid), the full fog with the hologram's
    // visible part cut out of it, and the fog of war alone laid under that hole; then that over
    // the picture (crisp, or smooth with DEV.pixelFx off)
    const w = holoGrid.w, h = holoGrid.h;
    // The vines, chains and spider webs in front of it are silhouettes instead: they keep the
    // full fog, three times over, so out of the torchlight they go black against it
    const M = war.mask = sizedCanvas(war.mask, w, h), O = war.over = sizedCanvas(war.over, w, h);
    const S = war.sil = sizedCanvas(war.sil, w, h), E = war.dark = sizedCanvas(war.dark, w, h);
    const mc = M.getContext('2d'), oc = O.getContext('2d'), scx = S.getContext('2d'), ec = E.getContext('2d');
    if (!mc || !oc || !scx || !ec) return;
    const world = holoGrid.world;
    const flat = x => x.setTransform(1, 0, 0, 1, 0, 0);
    for (const x of [mc, oc, scx, ec]) { flat(x); x.clearRect(0, 0, w, h); world(x); }
    holoMask(mc, W, G, F, 1);
    for (const pr of W.props)
      if (pr.k === 'climb' && pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 &&
        pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90) drawProp(scx, pr, W.time, F.TH);
    scx.strokeStyle = '#000'; scx.lineWidth = 1; scx.lineCap = 'round';
    scx.beginPath();
    for (const Ln of W.webs) webPath(scx, Ln);
    for (const b of W.silk) { scx.moveTo(b.ax, b.ay); scx.lineTo(b.x, b.y); }
    for (const e of W.enemies) {
      const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
      if (sh) { scx.moveTo(sh.ax0, sh.ay0); scx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
    }
    scx.stroke();
    flat(scx); scx.globalCompositeOperation = 'destination-in'; scx.drawImage(M, 0, 0);   // only over the hologram
    scx.globalCompositeOperation = 'source-over';
    flat(mc); mc.globalCompositeOperation = 'destination-out'; mc.drawImage(S, 0, 0); mc.globalCompositeOperation = 'source-over';
    oc.imageSmoothingEnabled = true; ec.imageSmoothingEnabled = true;
    oc.drawImage(G.fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0, sx, sy, sw, sh);
    ec.drawImage(G.fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0, sx, sy, sw, sh);
    flat(ec); ec.globalCompositeOperation = 'destination-in'; ec.drawImage(S, 0, 0); ec.globalCompositeOperation = 'source-over';
    flat(oc);
    oc.globalCompositeOperation = 'destination-out'; oc.drawImage(M, 0, 0);
    world(oc);
    oc.globalCompositeOperation = 'destination-over';
    oc.drawImage(war.blur, fx0, fy0, fx1 - fx0, fy1 - fy0, sx, sy, sw, sh);
    flat(oc);
    oc.globalCompositeOperation = 'source-over';
    oc.drawImage(E, 0, 0); oc.drawImage(E, 0, 0);
    holoGrid.place(G.ctx, O, !(DEV.pixelFx > 0));
  }
}

// the glows' layer: the rock's pixel grid over the view (made on first use)
/** @type {{ c: HTMLCanvasElement | null }} */
const glow = { c: null };

// Light over the fog, only where it has lifted (fogLit): wall torches, glowing props, the
// jellies' glow and their plant glow, glowing shots, fire, burning creatures and you, the hand
// torch's glow; then glowing particles; then the wall torches themselves. The glows are drawn
// at the rock's pixel size into their own layer (G.ctx is swapped for it meanwhile, so
// plantGlow's drawing lands there too) and added over the picture in one go, crisp or smooth
// (DEV.pixelFx); the particles are too small for that and go straight on
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawGlows(W, G, F) {
  const { vw, vh, pcx, pcy, TH, onView, ax } = F;
  // ---- firelight on top of the fog: the wall torches (where you have been) and the hand
  // torch's glow plus its small, warm second light round you. Additive, so it only ever
  // brightens; the map lighting under it is unchanged. The glow gutters on its own,
  // quicker and deeper than the lamp.
  G.ctx.globalCompositeOperation = 'lighter';
  const main = G.ctx;
  const gx0 = Math.floor(W.camX / CELL) - 1, gy0 = Math.floor(W.camY / CELL) - 1;
  const lw = Math.ceil(vw / CELL) + 3, lh = Math.ceil(vh / CELL) + 3;
  const GC = glow.c = sizedCanvas(glow.c, lw, lh), low = GC.getContext('2d');
  if (low) {
    low.setTransform(1, 0, 0, 1, 0, 0); low.clearRect(0, 0, lw, lh);
    low.setTransform(1 / CELL, 0, 0, 1 / CELL, -gx0, -gy0);
    low.globalCompositeOperation = 'lighter';
    G.ctx = low;
  }
  const gl = clamp(0.82 + W.glowN + 0.08 * Math.sin(W.time * 23) + 0.06 * Math.sin(W.time * 37), 0.5, 1.1);
  const scOn = sc => !(sc.y > W.camY + vh + 30 || sc.y < W.camY - 30 || sc.x < W.camX - 30 || sc.x > W.camX + vw + 30) &&
    fogLit(W, sc.x, sc.y);
  for (const sc of W.sconces) {
    if (!scOn(sc)) continue;
    const sg = 0.85 + 0.15 * Math.sin(W.time * 11 + sc.ph) * Math.sin(W.time * 5.3 + sc.ph);
    glowAt(G.ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
    glowAt(G.ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
  }
  // lit props and glowing motes, only where the fog has lifted — except the eyes, which
  // watch from the dark
  for (const pr of W.props) {
    if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
      (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
    if (pr.k !== 'eyes' && !fogLit(W, pr.x, pr.y)) continue;
    propGlow(G.ctx, pr, W.time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), W.torchR);
  }
  // and the green round each jelly glows and twinkles in its colour (plantGlow)
  for (const e of W.enemies)
    if (e.je && onView(e.x, e.ty, 160) && fogLit(W, e.x, e.ty)) plantGlow(W, G, e, TH);
  // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
  // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
  // every other light out here it shows only where the fog has lifted
  for (const e of W.enemies) {
    const k = e.k;
    if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(W, e.x, e.ty)) continue;
    const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
    const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
    const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
    glowAt(G.ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
    glowAt(G.ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
  }
  for (const b of W.enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(W, b.x, b.y)) glowAt(G.ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
  // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
  for (const b of W.bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(W, b.x, b.y))
    glowAt(G.ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
  // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
  if (W.fireVis.length) {
    G.ctx.fillStyle = 'rgba(255,140,50,0.32)';
    G.ctx.beginPath();
    for (const i of W.fireVis) {
      const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
      if (W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) G.ctx.rect(x, y, CELL, CELL);
    }
    G.ctx.fill();
    const st = Math.max(1, Math.ceil(W.fireVis.length / 24));
    for (let k = W.fireN % st; k < W.fireVis.length; k += st) {
      const i = W.fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
      if (fogLit(W, x, y)) glowAt(G.ctx, x, y, 20, Math.min(0.14, 0.03 + W.fireVis.length / 3000) * W.flick, '255,120,40');
    }
  }
  for (const e of W.enemies)
    if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(W, e.x, e.ty)) glowAt(G.ctx, e.x, e.ty, e.r * 2.4, 0.22 * W.flick, '255,130,50');
  for (const pr of W.firePlants)
    if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(W, pr.x, pr.y + pr.len))
      glowAt(G.ctx, pr.x, pr.y + pr.len, 16, 0.2 * W.flick, '255,130,50');
  if (W.p.burn > 0 && !W.p.dead) glowAt(G.ctx, W.p.x + PW / 2, W.p.y + PH / 2, 22, 0.25 * W.flick, '255,130,50');
  if (!W.p.dead) {
    const th = torchHand(W), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
    glowAt(G.ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
    glowAt(G.ctx, gfx + W.leanX * 0.5, gfy + W.leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
  }
  if (low) {                                // the layer, added over the picture
    G.ctx = main;
    main.imageSmoothingEnabled = !(DEV.pixelFx > 0);
    main.drawImage(GC, 0, 0, lw, lh, gx0 * CELL, gy0 * CELL, lw * CELL, lh * CELL);
    main.imageSmoothingEnabled = false;
  }
  for (const list of [W.dparts, W.amb]) for (const q of list) {
    if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(W, q.x, q.y)) continue;
    G.ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
    G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.globalAlpha = 1;
  G.ctx.globalCompositeOperation = 'source-over';
  for (const sc of W.sconces) if (scOn(sc)) drawSconce(G.ctx, sc.x, sc.y, W.time, sc.ph);
}
