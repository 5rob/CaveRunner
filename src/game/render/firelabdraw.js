// The Dev panel's Fire sim backdrop (owner v1.0.56: a worn firearms testing range): behind the open air of the room
// (art/firelab.js), drawn by titleDraw's S.back hook before the terrain, in world units, panned with S.scroll. Concrete
// panels with seams and stains, a faded hazard band along the floor, painted distance marks every 100, paper targets
// shot full of holes, scorch marks. Everything from a hash of the world position: it holds still as you pan.
import { pixText } from '../../art/pixfont.js';
import { TITLE_VW } from '../../art/titlescene.js';
import { LAB_FLOOR, LAB_ROOF, LAB_W } from '../../art/firelab.js';

/** @param {number} a @param {number} b */
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function labBack(ctx, S) {
  const y0 = LAB_ROOF, y1 = S.vh - LAB_FLOOR, x0 = Math.floor(S.scroll), sx = S.scroll;
  // concrete, 40 wide panels, each its own shade
  for (let px = Math.floor(x0 / 40) * 40; px < x0 + TITLE_VW + 40; px += 40) {
    const h = hash(px, 1), g = 52 + Math.round(h * 10);
    ctx.fillStyle = `rgb(${g},${g - 3},${g - 8})`; ctx.fillRect(px - sx, y0, 40, y1 - y0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px - sx, y0, 1, y1 - y0);                    // the seam
    ctx.fillRect(px - sx, y0 + (y1 - y0) * 0.5, 40, 1);
    // stains and chips: a few blotches a panel
    for (let i = 0; i < 6; i++) {
      const bx = px + Math.floor(hash(px, i + 3) * 38), by = y0 + Math.floor(hash(px + i, 7) * (y1 - y0 - 4)), d = hash(i, px) < 0.6;
      ctx.fillStyle = d ? 'rgba(20,16,12,0.25)' : 'rgba(255,240,220,0.06)';
      ctx.fillRect(bx - sx, by, 2 + Math.floor(hash(bx, by) * 4), 1 + Math.floor(hash(by, bx) * 3));
    }
    // a scorch mark now and then, low on the wall
    if (hash(px, 9) < 0.35) {
      const cx = px + 10 + hash(px, 10) * 20, cy = y1 - 8 - hash(px, 11) * 20;
      for (let r = 9; r > 0; r -= 2) { ctx.fillStyle = `rgba(10,8,6,${0.06 + (9 - r) * 0.025})`; ctx.fillRect(cx - r - sx, cy - r * 0.8, r * 2, r * 1.6); }
    }
  }
  // the hazard band along the floor: worn yellow and black stripes
  const bh = 4, by = y1 - 7;
  for (let x = Math.floor(x0 / 4) * 4; x < x0 + TITLE_VW + 4; x += 4) {
    const worn = hash(x, 21) < 0.25;
    ctx.fillStyle = (x / 4) % 2 ? (worn ? 'rgba(40,36,30,0.6)' : 'rgba(30,26,22,0.85)') : (worn ? 'rgba(150,120,40,0.35)' : 'rgba(190,150,40,0.6)');
    ctx.fillRect(x - sx, by, 4, bh);
  }
  // paper targets between the marks, faded, shot through
  for (let tx = 50; tx < LAB_W; tx += 100) {
    if (tx < x0 - 20 || tx > x0 + TITLE_VW + 20) continue;
    const cy = y0 + (y1 - y0) * 0.38;
    ctx.fillStyle = 'rgba(200,185,150,0.22)'; ctx.fillRect(tx - 9 - sx, cy - 12, 18, 24);
    for (const [r, a] of [[8, 0.22], [5.5, 0.26], [3, 0.3]]) {
      ctx.strokeStyle = `rgba(60,30,25,${a})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(tx - sx, cy, r, 0, 6.29); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(15,10,8,0.7)';
    for (let i = 0; i < 7; i++) ctx.fillRect(tx - 7 + hash(tx, i) * 14 - sx, cy - 9 + hash(i, tx) * 18, 1, 1);
  }
  // distance marks every 100: a tick and a painted number
  ctx.fillStyle = 'rgba(225,215,190,0.4)';
  for (let mx = 0; mx <= LAB_W; mx += 100) {
    if (mx < x0 - 30 || mx > x0 + TITLE_VW + 10) continue;
    ctx.fillRect(mx - sx, y0, 1, 6);
    ctx.fillRect(mx - sx, by - 4, 1, 4);
    pixText(ctx, String(mx / 10), mx + 2 - sx, y0 + 9, 0.6, 0.6);
  }
}
