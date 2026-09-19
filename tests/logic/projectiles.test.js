// Pollen (slower, longer-lived, stronger homing, eats a little rock) and
// Black Hole (4x size, 2x speed, eat radius scaled to match) — data plus the
// things that actually make them behave differently in flight.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
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

// ---- Pollen: the raw data ----
const pollen = MODS.pollen;
check('Pollen moves slower than before (was 130)', pollen.speed < 130 && pollen.speed > 0, pollen.speed);
check('Pollen lives longer than before (was 3)', pollen.life > 3, pollen.life);
check('Pollen homes noticeably harder than before (was 2.5)', pollen.homing >= 5, pollen.homing);
check('Pollen eats a little rock', pollen.eat > 0, pollen.eat);
check('Pollen\'s rock bite is small next to a dedicated digger (Digging Bolt bore 5)',
  pollen.eat < MODS.digbolt.bore, { pollen: pollen.eat, digbolt: MODS.digbolt.bore });
check('Pollen\'s homing is not stronger than the dedicated Seeker mod bonus (10)',
  pollen.homing < 10, pollen.homing);

// ---- Pollen: still tier 1 / 20 gold, and that still makes sense ----
// (raw dps is untouched — dmg, mana and count are unchanged — so the shop economy,
// which prices off gunRate/shotPower, doesn't see any of this buff)
check('Pollen price unchanged at 20', MOD_PRICE.pollen === 20, MOD_PRICE.pollen);
check('Pollen stays tier 1', MOD_TIER.pollen === 1, MOD_TIER.pollen);

// ---- Pollen: the values actually reach a built shot ----
let sh = shotOf(['pollen']);
check('planCast gives pollen its slow speed', sh.speed === pollen.speed, sh.speed);
check('planCast gives pollen its long life', sh.life === pollen.life, sh.life);
check('planCast gives pollen its homing', sh.homing === pollen.homing, sh.homing);
check('planCast gives pollen its eat radius', sh.eat === pollen.eat, sh.eat);

// ---- Pollen: homing actually bends the flight path (this was dead before — a shot's
// own `homing` field never reached blankShot, only a homing *mod*'s f() did) ----
// tracePath's preview caps at 110 steps (~1.83s), so pollen at its new, slower speed
// only gets ~120 units from the barrel in the preview window — put the target and
// the wall well inside that reach, not out at aim-line-preview ranges a slow drifter
// never gets close to.
const open = () => false;
const pts = out => { const p = []; for (let i = 0; i < out.length; i += 2) p.push([out[i], out[i + 1]]); return p; };
const trace = (s, nx, ny, solid, enemies) => pts(tracePath(s, 0, 0, nx, ny, solid || open, enemies || [], []));
const foe = { x: 100, ty: 40 };
const nearest = pth => Math.min(...pth.map(q => Math.hypot(q[0] - foe.x, q[1] - foe.ty)));
const straight = trace(shotOf(['pollen']), 1, 0, open, []);
const homed = trace(shotOf(['pollen']), 1, 0, open, [foe]);
check('Pollen curves toward an enemy on its own (no Homing mod equipped)',
  nearest(homed) < nearest(straight) - 20,
  { homed: Math.round(nearest(homed)), straight: Math.round(nearest(straight)) });

// ---- Pollen: eat lets it push through solid rock like a borer/eater does ----
const wallAt = x0 => (x, y) => x > x0;
const stopsAtWall = trace(shotOf(['bolt']), 1, 0, wallAt(50));
const throughWall = trace(shotOf(['pollen']), 1, 0, wallAt(50), []);
check('a plain bolt stops at the rock', stopsAtWall[stopsAtWall.length - 1][0] <= 52,
  Math.round(stopsAtWall[stopsAtWall.length - 1][0]));
check('Pollen (eat) carries on through rock instead of stopping',
  throughWall[throughWall.length - 1][0] > 80, Math.round(throughWall[throughWall.length - 1][0]));

// ---- Black Hole: the raw data ----
const void_ = MODS.void;
check('Black Hole is 4x the old size (was 6)', void_.size === 24, void_.size);
check('Black Hole moves at 2x the old speed (was 70)', void_.speed === 140, void_.speed);
check('Black Hole still pulls at the same range (70) — a gravity well reaching well ' +
  'beyond the visible sphere needs no help from the size change',
  void_.pull === 70, void_.pull);
check('Black Hole\'s eat radius grew in step with its size (same eat/size ratio as before)',
  Math.abs(void_.eat / void_.size - 7 / 6) < 0.001, { eat: void_.eat, size: void_.size });

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
