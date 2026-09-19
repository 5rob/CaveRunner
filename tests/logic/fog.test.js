// The fog of war reveal grid. fogReveal and fogStart are pure, so they can be driven
// straight from here: walk a route, count what lights up, and prove nothing goes dark
// again. Measures rather than claims - the interesting numbers are how much of the map
// one climb actually uncovers and what a reveal costs per step.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const g = new Function('React', shim + upto +
  'return { fogReveal, fogStart, FOG, FOG_U, FW, FH, SIGHT, CW, CH, CELL, SHOP_TOP, SHOP_ROOF, makeLevel };')(
  { createElement: () => {} });
const { fogReveal, fogStart, FOG, FOG_U, FW, FH, SIGHT, CW, CH, CELL, SHOP_TOP, SHOP_ROOF, makeLevel } = g;

let fails = 0;
const check = (name, cond, note) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${note ? ': ' + note : ''}`); }
  else console.log(`  ok  ${name}${note ? ': ' + note : ''}`);
};

console.log(`grid ${FW}x${FH} cells, ${FOG_U} world units each, sight ${SIGHT} units`);

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

// ---- one reveal lights a disc of about the right size ----
const s1 = new Uint8Array(FW * FH);
const mid = { x: (CW / 2) * CELL, y: (CH / 2) * CELL };
const n1 = fogReveal(s1, mid.x, mid.y, SIGHT);
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
const n2 = fogReveal(s1, mid.x, mid.y, SIGHT);
check('a repeat reveal is a no-op', n2 === 0, `${n2} new cells the second time`);

// ---- revealed stays revealed ----
const s2 = new Uint8Array(FW * FH);
fogReveal(s2, mid.x, mid.y, SIGHT);
const snapshot = s2.slice();
for (let i = 0; i < 40; i++) fogReveal(s2, Math.random() * CW * CELL, Math.random() * CH * CELL, SIGHT);
let lost = 0;
for (let i = 0; i < s2.length; i++) if (snapshot[i] && !s2[i]) lost++;
check('revealed cells stay revealed', lost === 0, `${lost} cells went dark again`);

// ---- off the edges of the map ----
const s3 = new Uint8Array(FW * FH);
const corners = [[0, 0], [CW * CELL, 0], [0, CH * CELL], [CW * CELL, CH * CELL],
  [-500, -500], [CW * CELL + 500, CH * CELL + 500]];
let threw = false;
for (const [x, y] of corners) { try { fogReveal(s3, x, y, SIGHT); } catch (e) { threw = true; } }
check('reveals off the map edge are safe', !threw);

// ---- a climb from the shop to the exit ----
// Straight up the middle of a real level, one reveal every 6 world units, which is a
// long frame's worth of travel at full jetpack speed.
const lv = makeLevel(7, 1);
const seen = fogStart();
let before = 0;
for (let i = 0; i < seen.length; i++) if (seen[i]) before++;
const t0 = process.hrtime.bigint();
let steps = 0;
for (let y = lv.start.y; y > 40; y -= 6) { fogReveal(seen, lv.start.x, y, SIGHT); steps++; }
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
check('a reveal is cheap', Number(t1 - t0) / steps < 60000, 'under 60us a call');

// ---- the whole map can be uncovered ----
const s4 = fogStart();
for (let y = 0; y < CH * CELL; y += SIGHT) for (let x = 0; x < CW * CELL; x += SIGHT) fogReveal(s4, x, y, SIGHT);
let dark = 0;
for (let i = 0; i < s4.length; i++) if (!s4[i]) dark++;
check('sweeping the map at sight spacing leaves no holes', dark === 0, `${dark} cells still dark`);

console.log(fails ? `\n${fails} FAILED` : '\nfog: all checks passed');
process.exit(fails ? 1 : 0);
