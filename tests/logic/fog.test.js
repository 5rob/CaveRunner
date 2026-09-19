// The fog of war reveal grid. fogReveal is pure given a fan and a cell predicate, so it
// can be driven straight from here: walk a route, count what lights up, prove nothing goes
// dark again, and prove the thing the owner asked for — that the map only gets what the
// torch could actually see, never what was round a corner.
//
// fogReveal takes the fan visPoly cast from the same spot rather than casting its own, so
// every check here builds one. The bulk sweeps use a coarse fan (FEW) because they only
// care about coverage; the ones that care about a wall use the real thing.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const g = new Function('React', shim + upto +
  'return { fogReveal, fogStart, visPoly, losClear, FOG, FOG_U, FW, FH, SIGHT, CELL, CW, CH, VIS_RAYS, SHOP_TOP, SHOP_ROOF, makeLevel };')(
  { createElement: () => {} });
const { fogReveal, fogStart, visPoly, losClear, FOG, FOG_U, FW, FH, SIGHT, CELL, CW, CH, VIS_RAYS, SHOP_TOP, SHOP_ROOF, makeLevel } = g;
const FEW = 48;                          // a coarse fan, for the sweeps that only count coverage

let fails = 0;
const check = (name, cond, note) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${note ? ': ' + note : ''}`); }
  else console.log(`  ok  ${name}${note ? ': ' + note : ''}`);
};

const open_ = () => false;                                     // no terrain at all
const reveal = (seen, x, y, solid, rays) => {
  const n = rays || VIS_RAYS;
  return fogReveal(seen, x, y, SIGHT, visPoly(x, y, SIGHT, solid || open_, n), n);
};
const matCell = mat => (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;

console.log(`grid ${FW}x${FH} cells, ${FOG_U} world units each, sight ${SIGHT} units, ${VIS_RAYS} rays`);

// ---- the shop starts revealed, the cave does not ----
const s0 = fogStart();
let lit0 = 0;
for (let i = 0; i < s0.length; i++) if (s0[i]) lit0++;
const roofRow = Math.floor((SHOP_TOP - SHOP_ROOF) / FOG);
let shopDark = 0, caveLit = 0;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
  if (y >= roofRow && !s0[y * FW + x]) shopDark++;
  if (y < roofRow && s0[y * FW + x]) caveLit++;
}
check('shop room starts revealed', shopDark === 0, `${shopDark} dark cells in the room`);
check('cave starts dark', caveLit === 0, `${caveLit} lit cells above the shop roof`);
check('the cave is most of the map', lit0 / (FW * FH) < 0.1,
  `${(lit0 / (FW * FH) * 100).toFixed(1)}% of the grid is pre-lit`);

// ---- one reveal in the open lights a disc of about the right size ----
const s1 = new Uint8Array(FW * FH);
const mid = { x: (CW / 2) * CELL, y: (CH / 2) * CELL };
const n1 = reveal(s1, mid.x, mid.y);
const want = Math.PI * (SIGHT / FOG_U) * (SIGHT / FOG_U);
check('one reveal lights a disc', Math.abs(n1 - want) / want < 0.12,
  `${n1} cells, a circle of that radius is ${want.toFixed(0)}`);
let outside = 0;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
  if (!s1[y * FW + x]) continue;
  const d = Math.hypot((x + 0.5) * FOG_U - mid.x, (y + 0.5) * FOG_U - mid.y);
  if (d > SIGHT) outside++;
}
check('nothing outside the radius is lit', outside === 0, `${outside} strays`);

// ---- revealing the same spot twice reports nothing new ----
check('a repeat reveal is a no-op', reveal(s1, mid.x, mid.y) === 0, 'second time round');

// ---- revealed stays revealed ----
const s2 = new Uint8Array(FW * FH);
reveal(s2, mid.x, mid.y);
const snapshot = s2.slice();
for (let i = 0; i < 40; i++) reveal(s2, Math.random() * CW * CELL, Math.random() * CH * CELL);
let lost = 0;
for (let i = 0; i < s2.length; i++) if (snapshot[i] && !s2[i]) lost++;
check('revealed cells stay revealed', lost === 0, `${lost} cells went dark again`);

// ---- a wall keeps its far side off the map ----
// The whole point: the light cannot reach round a corner, so neither can the map. A wall
// sixty units to the right of the player, tall enough to cover the whole sight radius.
const wallX = 560;
const wall = (cx, cy) => cx * CELL >= wallX && cy > 180 && cy < 320;
const s3 = new Uint8Array(FW * FH);
const n3 = reveal(s3, 500, 500, wall);
let behind = 0, inRock = 0, front = 0;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
  if (!s3[y * FW + x]) continue;
  const wx = (x + 0.5) * FOG_U, wy = (y + 0.5) * FOG_U;
  if (wall(Math.floor(wx / CELL), Math.floor(wy / CELL))) inRock++;
  else if (wx > wallX) behind++;
  else if (wx < wallX - 40) front++;
}
console.log(`  a wall 60 units away: ${n3} cells lit, ${front} of them out in the open in front of it`);
check('what is in front of the wall is lit', front > 20, `${front} cells`);
check('nothing inside the wall is lit', inRock === 0, `${inRock} cells inside rock`);
check('and nothing behind it is lit, though it is well inside the sight radius',
  behind === 0, `${behind} cells round the corner`);

// the same spot with no wall, to prove the wall is what did it: with nothing in the way,
// that same ground behind the wall's line does go on the map
const s4 = new Uint8Array(FW * FH);
const n4 = reveal(s4, 500, 500, open_);
let behindOpen = 0;
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
  if (!s4[y * FW + x]) continue;
  const wx = (x + 0.5) * FOG_U, wy = (y + 0.5) * FOG_U;
  if (wx > wallX && wy > 360 && wy < 640 && Math.hypot(wx - 500, wy - 500) <= SIGHT) behindOpen++;
}
check('with no wall, that same ground behind the line does light up', behindOpen > 20,
  `${n3} cells with the wall, ${n4} without, ${behindOpen} of them behind the line`);

// ---- off the edges of the map ----
const s5 = new Uint8Array(FW * FH);
const corners = [[0, 0], [CW * CELL, 0], [0, CH * CELL], [CW * CELL, CH * CELL],
  [-500, -500], [CW * CELL + 500, CH * CELL + 500]];
let threw = false;
for (const [x, y] of corners) { try { reveal(s5, x, y); } catch (e) { threw = true; } }
check('reveals off the map edge are safe', !threw);

// ---- a climb from the shop to the exit ----
// Straight up the middle of a real level, one reveal every 6 world units, which is a long
// frame's worth of travel at full jetpack speed. A coarse fan: this is about how much of
// the map a climb uncovers, not about the shading at the edges of it.
const lv = makeLevel(7, 1);
const seen = fogStart();
let before = 0;
for (let i = 0; i < seen.length; i++) if (seen[i]) before++;
const solid = matCell(lv.mat);
const t0 = process.hrtime.bigint();
let steps = 0;
for (let y = lv.start.y; y > 40; y -= 6) { reveal(seen, lv.start.x, y, solid, FEW); steps++; }
const t1 = process.hrtime.bigint();
let after = 0;
for (let i = 0; i < seen.length; i++) if (seen[i]) after++;
const pct = after / (FW * FH) * 100;
console.log(`  a straight climb (${steps} reveals) lights ${pct.toFixed(1)}% of the map, ` +
  `${((t1 - t0) / BigInt(steps))}ns a reveal`);
check('a straight climb leaves most of the map unexplored', pct < 45,
  `${pct.toFixed(1)}% lit, so there is still somewhere to explore`);
check('a straight climb does reveal the route', after - before > FH * 2,
  `${after - before} new cells over a ${FH}-cell-tall map`);
check('a reveal is cheap', Number(t1 - t0) / steps < 200000, 'under 200us a call');

// ---- and every cell it lights really was in sight ----
// A reveal from each of six spots up a real cave, with every cell each one lit checked by
// marching the line to it. The march is losClear — the same cell-by-cell walk the bullets
// and the enemy sight lines use — because a fixed-step march is exactly the thing that
// tunnels through a one-pixel wall, and this check is worth nothing if it does.
const spots = [150, 300, 450, 600, 750, 900, 1050, 1200, 1350, 1500].map(d => ({ x: lv.start.x, y: lv.start.y - d }));
let blocked = 0, lit = 0;
for (const sp of spots) {
  const s7 = new Uint8Array(FW * FH);
  reveal(s7, sp.x, sp.y, solid);
  for (let i = 0; i < s7.length; i++) {
    if (!s7[i]) continue;
    lit++;
    const x = (i % FW + 0.5) * FOG_U, y = (Math.floor(i / FW) + 0.5) * FOG_U;
    if (!losClear(sp.x, sp.y, x, y, solid)) blocked++;
  }
}
console.log(`  ${spots.length} reveals up a real cave light ${lit} cells between them, against ${n1} for one ` +
  `reveal in the open — a cave gives up very little of itself`);
check('every cell a reveal lights is in plain sight of where it was cast', blocked === 0,
  `${blocked} of ${lit} had rock in the way`);
check('and there was something to check', lit > 60, `${lit} cells over ${spots.length} spots`);
check('a cave gives up far less of the map than the open does', lit / spots.length < n1 / 2,
  `${(lit / spots.length).toFixed(0)} cells a spot against ${n1}`);

// ---- the whole map can be uncovered ----
const s6 = fogStart();
for (let y = 0; y < CH * CELL; y += SIGHT) for (let x = 0; x < CW * CELL; x += SIGHT) reveal(s6, x, y, open_, FEW);
let dark = 0;
for (let i = 0; i < s6.length; i++) if (!s6[i]) dark++;
check('sweeping the map at sight spacing leaves no holes', dark === 0, `${dark} cells still dark`);

console.log(fails ? `\n${fails} FAILED` : '\nfog: all checks passed');
process.exit(fails ? 1 : 0);