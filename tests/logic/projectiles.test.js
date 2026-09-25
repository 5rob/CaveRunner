// Pollen (v74: drags to a stop, floats, locks on in range, pops on contact) and
// Black Hole (4x size, 2x speed, eat radius scaled to match) — data plus the
// things that actually make them behave differently in flight.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);} }\n';
const G = new Function('React', shim + upto +
  'return { MODS, planCast, resetGun, tracePath, MOD_PRICE, MOD_TIER, tierOf };')({ createElement: () => {} });
const { MODS, planCast, resetGun, tracePath, MOD_PRICE, MOD_TIER } = G;

let pass = 0, fail = 0;
const check = (n, ok, x) => { if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const mk = slots => resetGun({ name: 't', cap: slots.length, castDelay: 0.1,
  recharge: 1, manaMax: 9999, manaRegen: 60, spread: 0, multi: 1, shuffle: false,
  mana: 9999, speedMul: 1, slots });
const shotOf = slots => planCast(mk(slots)).shots[0];

// ---- Pollen (v74 nerf): puffs out, drags to a stop, floats up, homes only once a
// creature is inside its lock radius, and pops on contact instead of eating rock ----
const pollen = MODS.pollen;
check('Pollen no longer eats rock', !pollen.eat, pollen.eat);
check('Pollen has a lock radius', pollen.homeR > 0 && pollen.homeR <= 120, pollen.homeR);
check('Pollen pops (small blast) on contact', pollen.pop > 0 && pollen.pop <= 10, pollen.pop);
check('Pollen price unchanged at 20', MOD_PRICE.pollen === 20, MOD_PRICE.pollen);
check('Pollen stays tier 1', MOD_TIER.pollen === 1, MOD_TIER.pollen);

let sh = shotOf(['pollen']);
check('planCast carries drift, lock radius and pop', sh.drift && sh.homeR === pollen.homeR && sh.pop === pollen.pop, sh);

const open = () => false;
const pts = out => { const p = []; for (let i = 0; i < out.length; i += 2) p.push([out[i], out[i + 1]]); return p; };
const trace = (s, nx, ny, solid, enemies) => pts(tracePath(s, 0, 0, nx, ny, solid || open, enemies || [], []));
const straight = trace(shotOf(['pollen']), 1, 0, open, []);
const endPt = straight[straight.length - 1];
check('Pollen slows to a stop (no further than ~90 along)', endPt[0] < 90, Math.round(endPt[0]));
check('Pollen went out at speed first (>40 along)', endPt[0] > 40, Math.round(endPt[0]));
check('once slow it floats upward', endPt[1] < -5, Math.round(endPt[1]));
// the first 0.5s covers far more ground than the last 0.5s
const seg = (a, b) => Math.hypot(straight[b][0] - straight[a][0], straight[b][1] - straight[a][1]);
check('its speed is damped over time', seg(0, 30) > 3 * seg(straight.length - 31, straight.length - 1),
  { early: Math.round(seg(0, 30)), late: Math.round(seg(straight.length - 31, straight.length - 1)) });

// out of lock range: ignored entirely
const far = { x: 60, ty: 150 };
const farPath = trace(shotOf(['pollen']), 1, 0, open, [far]);
check('a creature beyond the lock radius does not bend it',
  JSON.stringify(farPath) === JSON.stringify(straight));
// inside range: it locks and goes for it
const foe = { x: 90, ty: 40 };
const nearest = pth => Math.min(...pth.map(q => Math.hypot(q[0] - foe.x, q[1] - foe.ty)));
const homed = trace(shotOf(['pollen']), 1, 0, open, [foe]);
check('a creature inside the lock radius gets homed on', nearest(homed) < 8,
  Math.round(nearest(homed)));

// rock stops it (no boring without a mod) ...
const wallAt = x0 => (x, y) => x > x0;
const stopsAtWall = trace(shotOf(['bolt']), 1, 0, wallAt(50));
const pollenWall = trace(shotOf(['pollen']), 1, 0, wallAt(30), []);
check('a plain bolt stops at the rock', stopsAtWall[stopsAtWall.length - 1][0] <= 52,
  Math.round(stopsAtWall[stopsAtWall.length - 1][0]));
check('Pollen stops at rock now', pollenWall[pollenWall.length - 1][0] <= 32,
  Math.round(pollenWall[pollenWall.length - 1][0]));
// ... unless a mod lets it
const bored = trace(shotOf(['eater', 'pollen']), 1, 0, wallAt(30), []);
check('with Matter Eater it goes through', bored[bored.length - 1][0] > 32,
  Math.round(bored[bored.length - 1][0]));

// ---- Black Hole: the raw data ----
const void_ = MODS.void;
check('Black Hole is 4x the old size (was 6)', void_.size === 24, void_.size);
check('Black Hole moves at 2x the old speed (was 70)', void_.speed === 140, void_.speed);
check('Black Hole still pulls at the same range (70) — a gravity well reaching well ' +
  'beyond the visible sphere needs no help from the size change',
  void_.pull === 70, void_.pull);
check('Black Hole digs exactly its drawn black core (v57: ~0.78 of size, not the glow)',
  Math.abs(void_.eat - void_.size * 0.78) < 1, { eat: void_.eat, size: void_.size });

// ---- Black Hole: the values reach a built shot ----
sh = shotOf(['void']);
check('planCast gives Black Hole its new size', sh.size === 24, sh.size);
check('planCast gives Black Hole its new speed', sh.speed === 140, sh.speed);
check('planCast gives Black Hole its scaled eat radius', sh.eat === void_.eat, sh.eat);

// ---- Black Hole: still eats through rock rather than stopping at it ----
const voidThrough = trace(shotOf(['void']), 1, 0, wallAt(150), []);
check('Black Hole carries on through rock', voidThrough[voidThrough.length - 1][0] > 200,
  Math.round(voidThrough[voidThrough.length - 1][0]));

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
