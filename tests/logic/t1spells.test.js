// v95: the tier-1 spells reworked after their Noita twins — each carries its own flight
// (drag, soft bounces, a zig-zag, a droop or a rise), a look, a glow, and some mark on the
// world. These check the numbers made it through planCast and that the aim line follows.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function Game(')) +
  '\nreturn { MODS, MOD_TIER, planCast, resetGun, tracePath, wigTurn };')({ createElement: () => {} });
const { MODS, MOD_TIER, planCast, resetGun, tracePath, wigTurn } = api;
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

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
