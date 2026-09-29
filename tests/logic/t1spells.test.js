// v95: the tier-1 spells reworked after their Noita twins — each carries its own flight
// (drag, soft bounces, a zig-zag, a droop or a rise), a look, a glow, and some mark on the
// world. These check the numbers made it through planCast and that the aim line follows.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function Game(')) +
  '\nreturn { MODS, MOD_TIER, planCast, resetGun, tracePath, wigTurn, fireDouse, fireNew, fireLight, CW };')({ createElement: () => {} });
const { MODS, MOD_TIER, planCast, resetGun, tracePath, wigTurn, fireDouse, fireNew, fireLight, CW } = api;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const shotOf = slots => planCast(resetGun({ name: 't', cap: slots.length, castDelay: 0.1,
  recharge: 1, manaMax: 9999, manaRegen: 0, spread: 0, multi: 1, shuffle: false,
  mana: 9999, speedMul: 1, slots })).shots[0];
const open = () => false;
const pts = out => { const p = []; for (let i = 0; i < out.length; i += 2) p.push([out[i], out[i + 1]]); return p; };
const trace = (sh, nx, ny, solid) => pts(tracePath(sh, 0, 0, nx, ny, solid || open, [], []));

// every tier-1 shot/static has a look of its own now (or is a field that does its own thing)
const t1 = Object.keys(MOD_TIER).filter(id => MOD_TIER[id] === 1 && MODS[id] && (MODS[id].kind === 'shot'));
for (const id of t1) check(id + ' has a look and a glow', !!MODS[id].look && !!MODS[id].light, MODS[id].look);
check('Brimstone burns', MODS.brim.fire === 1 && MODS.brim.embers > 0);

// the fields make it out of planCast
const b = shotOf(['bolt']);
check('bolt carries drag, pit and look', b.drag > 0 && b.pit > 0 && b.look === 'spark', [b.drag, b.pit, b.look]);
check('arrow carries its knockback', shotOf(['arrow']).knock > 0);
check('a Knockback mod still adds on top', shotOf(['knock', 'arrow']).knock === MODS.arrow.knock + 260);
check('bubble bounces softly', shotOf(['bubble']).bounceE === 0.8 && shotOf(['bubble']).bounce === 20);
check('plain shots keep the old bounce', shotOf(['slug']).bounceE === 0.92);

// Spark Bolt droops a little (Noita's gravity 200)
const bp = trace(b, 1, 0);
check('bolt arcs down', bp[bp.length - 1][1] > 5, bp[bp.length - 1]);
// Bubble Spark rises
const up = trace(Object.assign({}, shotOf(['bubble']), { spread: 0 }), 1, 0);
check('bubble floats up', up[up.length - 1][1] < -3, up[up.length - 1]);
// Spitter drags: it covers much less ground in its second half than its first
const sp = trace(shotOf(['spit']), 1, 0);
const half = Math.floor(sp.length / 2);
const d1 = sp[half][0] - sp[0][0], d2 = sp[sp.length - 1][0] - sp[half][0];
check('spitter slows down in the aim line', d2 < d1 * 0.7, [Math.round(d1), Math.round(d2)]);
// Spark zig-zags: the line swings either side of straight, and ends near where it aimed
const zp = trace(shotOf(['spark']), 1, 0);
const ys = zp.map(q => q[1]);
check('spark zig-zags', Math.max(...ys) > 1 && Math.min(...ys) < -1, [Math.max(...ys), Math.min(...ys)]);
check('the swing is pure in age', wigTurn(10, 1, 0.1) === wigTurn(10, 1, 0.1) && Math.abs(wigTurn(10, 0.001, 0.001) - 10 / 45) < 0.001);
check('and centred: it ends near the aim line', Math.abs(ys[ys.length - 1]) < 15, ys[ys.length - 1]);
// soft bounce: a bubble thrown at a wall comes back slower than a plain bounce would
const wall = x => x > 30;
const bub = Object.assign({}, shotOf(['bubble']), { spread: 0, grav: 0 });
const wp = trace(bub, 1, 0, (x) => wall(x));
const back = wp.findIndex((q, i) => i > 0 && q[0] < wp[i - 1][0]);
check('bubble bounces off the wall', back > 0);
if (back > 0) {
  const vIn = wp[back - 2][0] - wp[back - 3][0], vOut = wp[back + 2][0] - wp[back + 3][0];
  check('and loses a fifth of its speed', vOut < vIn * 0.95, [vIn, vOut]);
}

// ---- v96: the rest of the tiers ----
const skip = { void: 1, saw: 1, zap: 1 };        // Black Hole kept as it is; Buzzsaw is an unseen cut; Lightning has its own bolt
const shots = Object.keys(MODS).filter(id => MODS[id].kind === 'shot' && !MODS[id].off && !MODS[id].base && !skip[id]);
const bare = shots.filter(id => !MODS[id].look);
check('every other shot has a look of its own', bare.length === 0, bare);
// rocket: starts slow, speeds up, never past its top speed
const rk = shotOf(['missile']);
const rp = trace(Object.assign({}, rk, { grav: 0, spread: 0 }), 1, 0);
const st = i => rp[i][0] - rp[i - 1][0];
check('Magic Missile leaves slowly and speeds up', st(2) < st(40) * 0.5, [st(2), st(40)]);
check('to a top speed', Math.abs(st(rp.length - 2) - rk.vmax / 60) < 0.5, [st(rp.length - 2), rk.vmax / 60]);
const lp = trace(shotOf(['lance']), 1, 0);
check('the lance picks up speed', lp[lp.length - 1][0] - lp[lp.length - 2][0] > lp[2][0] - lp[1][0]);
check('Blast is a bomb on a fuse', MODS.blast.lifeBoom === 1 && shotOf(['blast']).lifeBoom === 1 && MODS.blast.explode > 0);
check('Bounce Orb keeps nine-tenths per bounce, under gravity', shotOf(['orb']).bounceE === 0.9 && shotOf(['orb']).grav > 0);
check('Energy Orb blasts a hole', shotOf(['eorb']).pit > 0);
check('Explosion leaves fire', MODS.boom.fire === 1);
// fireDouse puts out burning pixels in the disc only
const fuel = new Uint8Array(CW * 40).fill(1), F = fireNew(fuel);
for (let x = 10; x < 60; x++) fireLight(F, 20 * CW + x);
const out = fireDouse(F, 20, 41, 10);      // world units: pixel (10, 20.5), radius 5 pixels
let lit = 0, near = 0; for (let x = 10; x < 60; x++) if (F.t[20 * CW + x]) { lit++; if (x < 15) near++; }
check('fireDouse puts out the fire in its disc', out > 0 && near === 0 && lit > 30, { out, near, lit });

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
