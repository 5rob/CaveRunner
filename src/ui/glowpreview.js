// Dev → Glow worms: the live preview (owner): a small cave room of glow worms stepped by the real creatures/glowworm.js
// (glowLab) with the live DEV knobs, drawn the scene's way (pixel look, glow behind, the effects layer, green light), and a
// player walking across and back so they stand up, strike, and now and then one is shot and blows up. Reset worms: GLOW_CMD.

import { GLOW_LAB_H, GLOW_LAB_W, drawGlowFace, drawGlowWorm, drawWormGlow, glowLab, glowLabStep, wormBox, wormCol, wormFlicker, wormFxFill } from '../creatures/glowworm.js';
import { glowAt, pixelSprite } from '../art/sprites.js';
import { DEV } from '../dev/knobs.js';
import { h, useEffect, useRef } from './h.js';

export function GlowPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const L = glowLab();
    // the rock, painted once (it never changes); the effects layer's small canvas, reused
    const rock = document.createElement('canvas'); rock.width = GLOW_LAB_W; rock.height = GLOW_LAB_H;
    const rc = rock.getContext('2d');
    if (rc) { rc.fillStyle = '#34343c'; for (let x = 0; x < GLOW_LAB_W; x += 2) for (let y = 0; y < GLOW_LAB_H; y += 2) if (L.solid(x + 1, y + 1)) rc.fillRect(x, y, 2, 2); }
    const fx = document.createElement('canvas'), FW = GLOW_LAB_W / 2, FH = GLOW_LAB_H / 2; fx.width = FW; fx.height = FH;
    const fc = fx.getContext('2d');
    let raf, last = performance.now();
    const tick = (/** @type {number} */ now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      glowLabStep(L, dt);
      window.__glowLab = L;   // (tools/coalshots.js, tests)
      const dpr = window.devicePixelRatio || 1, cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
      if (!cw || !ch || !ctx) return;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const sc = Math.min(cw / GLOW_LAB_W, ch / GLOW_LAB_H);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(sc, 0, 0, sc, (cw - GLOW_LAB_W * sc) / 2, (ch - GLOW_LAB_H * sc) / 2);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(rock, 0, 0);
      // the player: a little figure
      const px = L.px, fy = L.floor;
      ctx.fillStyle = '#d9d2c0'; ctx.fillRect(px - 2, fy - 9, 4, 5); ctx.fillStyle = '#6a8fd0'; ctx.fillRect(px - 2, fy - 4, 4, 4);
      // the worms, in the scene's pixel look, and their faces
      for (const w of L.worms) {
        const b = wormBox(w, 0);
        pixelSprite(ctx, b.x, b.y, b.w, b.h, 1, false, q => drawGlowWorm(q, w, 0));
        drawGlowFace(ctx, w, 0, L.t);
      }
      // added light: the effects layer, each one's light and glow, the particles, the blasts
      ctx.globalCompositeOperation = 'lighter';
      if (fc && L.worms.length) {
        const im = new ImageData(FW, FH);
        if (wormFxFill(im.data, FW, FH, { ox: 0, oy: 0, px: 2, t: L.t, worms: L.worms })) { fc.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(fx, 0, 0, GLOW_LAB_W, GLOW_LAB_H); }
      }
      for (const w of L.worms) {
        const m = w.pts[2];
        glowAt(ctx, m.x, m.y, DEV.glowLightR, DEV.glowLight * 0.35 * wormFlicker(w, L.t), String(wormCol(w, 0.3)));
        drawWormGlow(ctx, w, 0, L.t);
      }
      for (const p of L.parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
      ctx.globalAlpha = 1;
      for (const o of L.booms) glowAt(ctx, o.x, o.y, DEV.glowBlastR * (0.6 + o.t * 2), 0.9 * (1 - o.t / 0.5), '125,255,58');
      ctx.globalCompositeOperation = 'source-over';
      // debug: each worm's agro and strike reach, round its back foot
      if (DEV.glowDebug > 0.5) {
        ctx.lineWidth = 0.4;
        for (const w of L.worms) {
          ctx.strokeStyle = 'rgba(255,200,80,0.5)'; ctx.beginPath(); ctx.arc(w.r.x, w.r.y, DEV.glowAgroR, 0, 6.29); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,70,70,0.7)'; ctx.beginPath(); ctx.arc(w.r.x, w.r.y, DEV.glowStrikeR, 0, 6.29); ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'jellyprev glowprev' });
}
