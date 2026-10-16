// @ts-check
// The shop's ceiling tubes (v0.0.136), after drawGlows: a fixture over each light section
// (world/shoplights.js LIGHT_X), its tube lit as far as the section is on (a new run's dark shop
// stutters them on; otherwise steady), a soft cone of light down to the floor, and, while the shop
// is dark, the teleporter's blue glow round the way in. Hashes of W.time only, never Math.random.
// Since v0.0.144 dust hangs in each lit cone (coneDust): only ever inside it, dust-coloured.


const TUBE_W = 40;                         // a tube's length (world units)
const hs = (/** @type {number} */ n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export const DUST_N = 14;                  // dust specks in a cone
const DUST_COL = '226,214,188';            // dust: a pale grey-beige

// Dust floating in a cone of light (tube's underside at y0, the floor at fy, lv how lit): each speck
// a fixed share of the way across the cone at its height, so it never leaves the cone, sinking slowly
// and wandering a little, catching the light more in the middle and less near the cone's edges, top and floor
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y0 @param {number} fy @param {number} lv @param {number} t @param {number} i */
export function coneDust(ctx, x, y0, fy, lv, t, i) {
  const H = fy - y0 - 3;
  ctx.fillStyle = 'rgb(' + DUST_COL + ')';
  for (let k = 0; k < DUST_N; k++) {
    const s = i * 31 + k * 7.3, sp = 0.025 + 0.035 * hs(s + 2);         // a cone-height every 15-40 s
    const v = (hs(s + 3) + t * sp) % 1;                                    // how far down (0 tube, 1 floor)
    const u = Math.max(-0.95, Math.min(0.95, (hs(s + 1) * 2 - 1) * 0.85 + 0.12 * Math.sin(t * (0.3 + 0.4 * hs(s + 4)) + s)));
    const half = TUBE_W / 2 + 26 * v, px = x + u * half, py = y0 + v * H;
    const a = lv * (1 - u * u) * Math.min(1, v * 6, (1 - v) * 6) * (0.35 + 0.5 * hs(s + 5)) * (0.75 + 0.25 * Math.sin(t * 2 + s));
    if (a <= 0.02) continue;
    const sz = 0.6 + 0.6 * hs(s + 6);
    ctx.globalAlpha = a;
    ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

