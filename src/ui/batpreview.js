// Dev → Bats: the live preview (owner): a small cave of bats stepped by the real creatures/bats.js (batLab) with the live DEV
// knobs, a player walking across and back every few seconds to scare them. Reset bats / Scare all act on it too (BAT_CMD).

import { BAT_LAB_H, BAT_LAB_W, batLab, batLabStep, drawBats } from '../creatures/bats.js';
import { pixelSprite } from '../art/sprites.js';
import { h, useEffect, useRef } from './h.js';

export function BatPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const L = batLab();
    let raf, last = performance.now();
    const tick = (/** @type {number} */ now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      batLabStep(L, dt);
      window.__batLabScared = L.px > 30 && L.px < 150 ? L.B.list.filter(b => b.scared).length : 0;   // (for tools/coalshots.js batdev)
      const dpr = window.devicePixelRatio || 1, cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
      if (!cw || !ch) return;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const sc = Math.min(cw / BAT_LAB_W, ch / BAT_LAB_H);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(sc, 0, 0, sc, (cw - BAT_LAB_W * sc) / 2, (ch - BAT_LAB_H * sc) / 2);
      // the rock: a column at a time, the cave's air the dark ground
      ctx.fillStyle = '#3a3a44';
      for (let x = 0; x < BAT_LAB_W; x += 2) for (let y = 0; y < BAT_LAB_H; y += 2) if (L.solid(x + 1, y + 1)) ctx.fillRect(x, y, 2.05, 2.05);
      // the player: a little figure
      const px = L.px, fy = L.floor;
      ctx.fillStyle = '#d9d2c0'; ctx.fillRect(px - 2, fy - 9, 4, 5); ctx.fillStyle = '#6a8fd0'; ctx.fillRect(px - 2, fy - 4, 4, 4);
      ctx.fillStyle = '#20242c'; ctx.fillRect(px + (L.dir > 0 ? 0.5 : -1.5), fy - 8, 1, 1);
      drawBats(ctx, L.B, 0, L.t, [{ x: px, y: fy - 6 }], (x, y, e, paint) => pixelSprite(ctx, x - e, y - e, 2 * e, 2 * e, 1, false, paint));   // (the scene's pixel look)
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'jellyprev batprev' });
}
