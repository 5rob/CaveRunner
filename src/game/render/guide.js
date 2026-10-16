// @ts-check
// A new run's guide hologram (world/guide.js, game/systems/guide.js): drawGuide, a little see-through
// blue you hovering over the hall floor, waving, with bright distortion bars rolling down it and a
// glitch as it comes, goes, or is run through (after drawShops, before you, so you pass in front of
// it); drawGuideTalk, its speech box typing out, in screen space over the picture (after the
// messages). Steady hashes of time only: draw shares the simulation's Math.random stream.


/** @param {number} n */
const hash = n => { const v = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };

// The guide's hologram look, for anything drawn into a small layer x (cw × ch pixels): blue by
// brightness, every other line thinner, two bright bars rolling down it that tear it sideways, and
// glitches (gl 0-1) that rip rows across and drop some out. Rewrites x in place. The crystal machines'
// demo (render/shops.js) uses it too
/** @param {CanvasRenderingContext2D} x @param {number} cw @param {number} ch @param {number} t @param {number} gl */
export function holoPass(x, cw, ch, t, gl) {
  const src = x.getImageData(0, 0, cw, ch), d = src.data, out = x.createImageData(cw, ch), o = out.data;
  const fr = Math.floor(t * 30), scan = Math.floor(t * 8) % 2;
  const bars = [((t * 0.9) % 1.6) - 0.3, ((t * 0.9 + 0.8) % 1.6) - 0.3].map(v => v * ch);
  for (let y = 0; y < ch; y++) {
    let shift = 0, lift = 0;
    for (const b of bars) {
      const dy = Math.abs(y - b);
      if (dy < 2.5) { lift = Math.max(lift, 1 - dy / 2.5); shift += Math.round((hash(fr + y) - 0.5) * 3); }
    }
    if (gl > 0 && hash(fr * 3 + Math.floor(y / 3)) < gl * 0.6) shift += Math.round((hash(fr * 7 + y) - 0.5) * 14 * gl);
    const drop = gl > 0 && hash(fr * 5 + y * 3) < gl * 0.25;
    const thin = (y + scan) % 2 ? 0.75 : 1;
    for (let xx = 0; xx < cw; xx++) {
      const sx = xx - shift;
      if (sx < 0 || sx >= cw || drop) continue;
      const i = (y * cw + sx) * 4, j = (y * cw + xx) * 4;
      if (d[i + 3] < 100) continue;
      const L = (d[i] + d[i + 1] + d[i + 2]) / 765;
      // dark parts (the visor) go see-through and deep blue, light ones bright: it still reads as you
      o[j] = Math.min(255, 10 + L * 125 + lift * 200);
      o[j + 1] = Math.min(255, 110 + L * 145 + lift * 100);
      o[j + 2] = 255;
      o[j + 3] = Math.min(255, (70 + L * 185 + lift * 60) * thin);
    }
  }
  // the colour split while it glitches: a red ghost knocked off to one side
  if (gl > 0.3) {
    const k = Math.round((hash(fr + 77) - 0.5) * 6 * gl);
    for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
      const sx = xx - k, j = (y * cw + xx) * 4;
      if (sx < 0 || sx >= cw || o[j + 3]) continue;
      const i = (y * cw + sx) * 4;
      if (d[i + 3] >= 100) { o[j] = 255; o[j + 1] = 70; o[j + 2] = 110; o[j + 3] = 120 * gl; }
    }
  }
  x.putImageData(out, 0, 0);
}

// A hologram's light (additive, a its strength): a pool on the floor under x and a soft glow round
// (x, y); r scales both (1 = the guide's). Leaves ctx in 'lighter'
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} floorY @param {number} a @param {number} [r] */
export function holoLight(ctx, x, y, floorY, a, r = 1) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 * a;
  const pool = ctx.createRadialGradient(x, floorY, 0, x, floorY, 16 * r);
  pool.addColorStop(0, 'rgba(110,200,255,0.55)'); pool.addColorStop(1, 'rgba(110,200,255,0)');
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(x, floorY, 16 * r, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26 * r);
  glow.addColorStop(0, 'rgba(90,180,255,0.22)'); glow.addColorStop(1, 'rgba(90,180,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 26 * r, y - 26 * r, 52 * r, 52 * r);
}

