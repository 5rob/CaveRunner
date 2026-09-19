// The torch's visibility fan. rayDist and visPoly are pure given a cell predicate, so
// they can be driven straight from here: prove the fan stops at walls, prove a
// one-pixel wall is not stepped over, and price a fan against a real level's terrain.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const g = new Function('React', shim + upto +
  'return { rayDist, visPoly, losClear, FOG_DIM, FOG_DARK, CELL, CW, CH, VIS_RAYS, makeLevel };')(
  { createElement: () => {} });
const { rayDist, visPoly, losClear, FOG_DIM, FOG_DARK, CELL, CW, CH, VIS_RAYS, makeLevel } = g;

let fails = 0;
const check = (name, cond, note) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${note ? ': ' + note : ''}`); }
  else console.log(`  ok  ${name}${note ? ': ' + note : ''}`);
};

const nothing = () => false;                     // no terrain at all
const R = 300;

// ---- an open field: every ray reaches the full radius ----
const pts = visPoly(500, 500, R, nothing, VIS_RAYS);
check('a fan is one point a ray', pts.length === VIS_RAYS * 2, pts.length);
let short = 0, far = 0;
for (let i = 0; i < pts.length; i += 2) {
  const d = Math.hypot(pts[i] - 500, pts[i + 1] - 500);
  if (d < R - 1) short++;
  if (d > R + 0.001) far++;
}
check('in the open every ray reaches full reach', short === 0, `${short} fell short`);
check('and none overshoots', far === 0, `${far} went past it`);

// ---- a wall stops the rays that meet it, and only those ----
const wallX = 560, oy = 500;
const wall = (cx, cy) => cx * CELL >= wallX && cy > 200 && cy < 300;
const p2 = visPoly(500, oy, R, wall, VIS_RAYS);
let through = 0, stopped = 0, around = 0;
for (let i = 0; i < p2.length; i += 2) {
  const x = p2[i], y = p2[i + 1];
  if (x <= wallX + 0.01) continue;              // stopped on the face, which is the point
  // past the face: only legal if the ray was above or below the wall's band when it crossed
  const t = (wallX - 500) / (x - 500);
  const atWall = oy + (y - oy) * t;
  if (atWall > 200 * CELL && atWall < 300 * CELL) through++;
  else around++;
}
check('nothing crosses the wall', through === 0, `${through} rays went through it`);
check('rays that never met it are untouched', around > 10, `${around} went round its ends`);
// and the ones aimed at its face land exactly on it
let onFace = 0;
for (let i = 0; i < p2.length; i += 2) {
  if (Math.abs(p2[i] - wallX) < 0.01 && Math.abs(p2[i + 1] - oy) < 30) onFace++;
}
check('and the ones aimed at it stop on its near face', onFace > 5, `${onFace} on the face`);

// ---- a one-cell wall is not stepped over ----
// CELL world units thick, 3 units away, so a fixed 4-unit sampling step would jump it.
const thin = (cx, cy) => cx === 300 && cy >= 200 && cy <= 300;
const ox = 300 * CELL - 3;
check('a one-cell wall stops a ray dead', Math.abs(rayDist(ox, oy, 1, 0, R, thin) - 3) < 0.01,
  `${rayDist(ox, oy, 1, 0, R, thin).toFixed(3)} units`);
let leaks = 0, blocked = 0;
for (let i = 0; i < 720; i++) {
  const a = (i / 720) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
  const d = rayDist(ox, oy, ca, sa, 6, thin);
  const t = ca > 0 ? 3 / ca : Infinity;                       // where it would cross the wall
  const meets = t < 6 && oy + sa * t >= 200 * CELL && oy + sa * t <= 300 * CELL;
  if (meets) { if (Math.abs(d - t) < 0.01) blocked++; else leaks++; }
  else if (d !== 6) leaks++;
}
check('every ray that crosses it is stopped, at any angle',
  leaks === 0 && blocked > 100, `${leaks} leaked, ${blocked} stopped`);

// ---- the line of sight an enemy is seen through is the same line ----
// The wall spans world y 400..600, so a line above it, or one that crosses its line
// below the wall's end, is clear; one straight through it is not.
check('a line that misses the wall is clear', losClear(597, 300, 700, 300, thin));
check('a line through a one-cell wall is not', !losClear(597, 500, 700, 500, thin));
check('a diagonal that passes its end is clear', losClear(597, 350, 700, 650, thin));
check('a point on top of itself is its own line', losClear(597, 500, 597, 500, thin));

// ---- buried in rock: no ray gets out of the first cell ----
// From a cell centre the furthest a ray can travel before it is in the next cell is a
// corner, which is CELL/sqrt(2)... at most CELL * 0.75 either way.
const p4 = visPoly(501, 501, R, () => true, 64);
let maxD = 0;
for (let i = 0; i < p4.length; i += 2) maxD = Math.max(maxD, Math.hypot(p4[i] - 501, p4[i + 1] - 501));
check('buried in rock, every ray stops in the first cell', maxD < CELL * 0.75,
  `furthest ${maxD.toFixed(2)} units`);

// ---- it is deterministic ----
const a1 = visPoly(500, 500, R, wall, VIS_RAYS), a2 = visPoly(500, 500, R, wall, VIS_RAYS);
check('the same spot twice gives the same fan', a1.join() === a2.join());

// ---- a real floor, checked by dense sampling rather than by marching ----
// The invariant that matters: nothing between the player and a fan point is solid. This
// walks each ray in half-unit steps, which is a completely different method from the
// cell marching under test, so the two have to agree.
const lv = makeLevel(3, 1);
const mat = Uint8Array.from(lv.mat);
const cell = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
const px = lv.start.x + 6, py = lv.start.y + 11;
const fan = visPoly(px, py, 400, cell, VIS_RAYS);
let inRock = 0, checked = 0;
for (let i = 0; i < fan.length; i += 2) {
  const dx = fan[i] - px, dy = fan[i + 1] - py, d = Math.hypot(dx, dy);
  const ux = dx / d, uy = dy / d;
  for (let s = 0.5; s < d; s += 0.5) {
    checked++;
    if (cell(Math.floor((px + ux * s) / CELL), Math.floor((py + uy * s) / CELL))) { inRock++; break; }
  }
}
check('no ray crosses solid rock', inRock === 0, `${inRock} of ${VIS_RAYS} rays, ${checked} samples`);

// ---- and a wall built in front of the player hides everything behind it ----
// Same terrain, same spot, one extra wall: the fan must lose every point behind it.
const wx0 = Math.floor((px + 40) / CELL);                    // wall 40 units to the right
const wcy = Math.floor(py / CELL);
for (let cx = wx0; cx < wx0 + 3; cx++)                        // 3 cells, 6 units thick
  for (let cy = wcy - 15; cy <= wcy + 15; cy++) mat[cy * CW + cx] = 1;
const wallX2 = wx0 * CELL;
const after = visPoly(px, py, 400, cell, VIS_RAYS);
let behind = 0, control = 0;
for (let i = 0; i < after.length; i += 2) {
  if (after[i] <= wallX2 + 0.01 || Math.abs(after[i + 1] - py) > 25) continue;  // in front of it, or round its end
  behind++;
}
for (let i = 0; i < fan.length; i += 2) {
  if (fan[i] > wallX2 + 0.01 && Math.abs(fan[i + 1] - py) <= 25) control++;
}
check('with no wall there, rays do reach past that line', control > 0, `${control} points`);
check('put a wall there and nothing gets behind it', behind === 0, `${behind} points behind it`);

// ---- the mask is dark enough to be worth calling a torch ----
console.log(`  mask: been-here ${FOG_DIM}, never-been ${FOG_DARK}`);
check('somewhere you have been but cannot see is a lot darker than it was',
  FOG_DIM >= 0.8, FOG_DIM);
check('and somewhere you have never been is darker still', FOG_DARK > FOG_DIM, FOG_DARK);

// ---- what a fan costs on real terrain ----
// Cast every frame, so this is the number that has to stay under a frame's worth of time.
let total = 0, worst = 0;
for (let seed = 0; seed < 20; seed++) {
  const l2 = makeLevel(seed, 1);
  const m2 = l2.mat;
  const c2 = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || m2[cy * CW + cx] !== 0;
  const s = process.hrtime.bigint();
  visPoly(l2.start.x + 6, l2.start.y + 11, 400, c2, VIS_RAYS);
  const ms = Number(process.hrtime.bigint() - s) / 1e6;
  total += ms; worst = Math.max(worst, ms);
}
console.log(`  a fan on real terrain: ${(total / 20).toFixed(2)}ms average, ${worst.toFixed(2)}ms worst of 20 floors`);
check('a fan costs well under a frame', total / 20 < 4, `${(total / 20).toFixed(2)}ms`);

console.log(fails ? `\n${fails} FAILED` : '\nvision: all checks passed');
process.exit(fails ? 1 : 0);
