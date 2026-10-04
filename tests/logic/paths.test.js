// The flight-path mods (v0.0.137, spells/paths.js): Boomerang comes back halfway through its flight,
// Ping-Pong snaps back and on, Spiral swings in a widening wave along its line, Orbit circles what
// cast it (and a moving anchor), Follow Me heads for you; a field moves by the same rules. Plus the
// matched pairs: Enlarge / Shrink and Longer / Shorter Flight undo each other.
const G = require('../load');
const { planCast, resetGun, tracePath, pathStep, ORBIT_R, BOOM_CATCH, FOLLOW_AHEAD, MODS } = G;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const shotOf = slots => planCast(resetGun({ name: 't', cap: slots.length, castDelay: 0.1,
  recharge: 1, manaMax: 9999, manaRegen: 0, spread: 0, multi: 1, shuffle: false,
  mana: 9999, speedMul: 1, slots })).shots[0];
const open = () => false;
const trace = sh => { const o = tracePath(sh, 0, 0, 1, 0, open, [], [], { x: 0, y: 0 }); const p = [];
  for (let i = 0; i < o.length; i += 2) p.push([o[i], o[i + 1]]); return p; };

// --- Boomerang: out, then back to you ---
// (a short flight, so the aim line's 110 steps see it all the way back)
let p = trace(Object.assign(shotOf(['boomer', 'arrow']), { grav: 0, drag: 0, speed: 400, life: 1 }));
const far = Math.max(...p.map(q => q[0])), end = p[p.length - 1];
check('a boomerang flies well out', far > 120, Math.round(far));
check('and comes back to you (caught)', Math.hypot(end[0], end[1]) < BOOM_CATCH + 12, end.map(Math.round));
const iFar = p.findIndex(q => q[0] === far);
check('it turns about halfway through its flight', iFar > p.length * 0.3 && iFar < p.length * 0.75, { iFar, n: p.length });

// --- Ping-Pong: forward, back a little, forward again: net progress ---
p = trace(Object.assign(shotOf(['pong', 'arrow']), { grav: 0, drag: 0 }));
let backs = 0;
for (let i = 2; i < p.length; i++) if (p[i][0] < p[i - 1][0] - 0.5 && !(p[i - 1][0] < p[i - 2][0] - 0.5)) backs++;
check('ping-pong reverses more than once', backs >= 2, backs);
check('but still gets somewhere', p[p.length - 1][0] > 100, Math.round(p[p.length - 1][0]));

// --- Spiral: follows the aim, swinging side to side wider and wider ---
p = trace(Object.assign(shotOf(['spiral', 'arrow']), { grav: 0, drag: 0 }));
let cross = 0;
for (let i = 1; i < p.length; i++) if (Math.sign(p[i][1]) !== Math.sign(p[i - 1][1]) && p[i][1] !== 0) cross++;
const third = Math.floor(p.length / 3);
const amp = arr => Math.max(...arr.map(q => Math.abs(q[1])));
check('spiral crosses its line again and again', cross >= 3, cross);
check('its swing widens as it goes', amp(p.slice(2 * third)) > amp(p.slice(0, third)) * 1.5,
  { early: amp(p.slice(0, third)).toFixed(1), late: amp(p.slice(2 * third)).toFixed(1) });
check('it keeps heading where you aimed', p[p.length - 1][0] > 200, Math.round(p[p.length - 1][0]));

// --- Orbit: round your gun, at ORBIT_R ---
p = trace(Object.assign(shotOf(['orbit', 'arrow']), { grav: 0, drag: 0 }));
const late = p.slice(20);
check('an orbit stays on its circle round you', late.every(q => Math.abs(Math.hypot(q[0], q[1]) - ORBIT_R) < 3),
  late.slice(0, 3).map(q => Math.hypot(q[0], q[1]).toFixed(1)));
const angs = new Set(late.map(q => Math.round(Math.atan2(q[1], q[0]) * 2)));
check('and goes right round', angs.size >= 12, angs.size);

// an orbit round a moving anchor (a trigger's carrier) travels with it
let o = { x: 10, y: 0, vx: 300, vy: 0, age: 0, orbit: 3.4 };
const anc = { x: 0, y: 0 };
for (let i = 0; i < 60; i++) {
  anc.x += 200 / 60; o.age += 1 / 60;
  const [ex, ey] = pathStep(o, 1 / 60, { home: { x: 0, y: 0 }, ahead: { x: 0, y: 0 }, anchor: anc });
  o.x += o.vx / 60 + ex; o.y += o.vy / 60 + ey;
}
check('an orbit round a moving carrier moves with it', Math.abs(Math.hypot(o.x - anc.x, o.y - anc.y) - ORBIT_R) < 1, { o: [o.x.toFixed(1), o.y.toFixed(1)], anc: anc.x.toFixed(1) });

// --- Follow Me: a shot curves round to you; a field settles just ahead of your gun ---
o = { x: 200, y: 0, vx: 300, vy: 0, age: 0, follow: 4 };
let minD = 1e9;
for (let i = 0; i < 120; i++) {
  o.age += 1 / 60;
  pathStep(o, 1 / 60, { home: { x: 0, y: 0 }, ahead: { x: 30, y: 0 }, anchor: null });
  o.x += o.vx / 60; o.y += o.vy / 60; if (i > 30) minD = Math.min(minD, Math.hypot(o.x, o.y));
}
check('a Follow Me shot turns back and comes past you', minD < 80, Math.round(minD));
const f = { x: 100, y: -80, vx: 0, vy: 0, age: 0, still: 1, follow: 4 };
for (let i = 0; i < 180; i++) {
  f.age += 1 / 60;
  const [ex, ey] = pathStep(f, 1 / 60, { home: { x: 0, y: 0 }, ahead: { x: FOLLOW_AHEAD, y: 0 }, anchor: null });
  f.x += f.vx / 60 + ex; f.y += f.vy / 60 + ey;
}
check('a Follow Me field comes to rest ahead of your gun', Math.hypot(f.x - FOLLOW_AHEAD, f.y) < 3, [f.x.toFixed(1), f.y.toFixed(1)]);
check('the White Hole carries Follow Me on the planner', shotOf(['follow', 'vacfield']).follow > 0 && shotOf(['follow', 'vacfield']).field === 'vacuum');
check('Vacuum Field is the White Hole now', MODS.vacfield.name === 'White Hole');

// --- the matched pairs ---
const base = shotOf(['void']), up = shotOf(['grow', 'void']), both = shotOf(['grow', 'shrink', 'void']);
check('Enlarge: bigger shot and every radius (Black Hole: core, pull)', up.size > base.size * 1.4 && up.eat > base.eat * 1.4 && up.pull > base.pull * 1.4,
  { size: [base.size, up.size], pull: [base.pull, up.pull] });
check('Shrink undoes Enlarge', Math.abs(both.size - base.size) < 1e-9 && Math.abs(both.pull - base.pull) < 1e-9);
check('Enlarge widens a field', shotOf(['grow', 'vacfield']).r > shotOf(['vacfield']).r * 1.4);
check('Enlarge widens a blast', shotOf(['grow', 'blast']).explode > shotOf(['blast']).explode * 1.4);
check('Shrink shrinks', shotOf(['shrink', 'bolt']).size < shotOf(['bolt']).size);
const L0 = shotOf(['bolt']).life;
check('Longer Flight: x1.5', Math.abs(shotOf(['lifeup', 'bolt']).life - L0 * 1.5) < 1e-9);
check('Shorter Flight undoes it', Math.abs(shotOf(['lifeup', 'lifedn', 'bolt']).life - L0) < 1e-9);
check('the pairs drop by floor 5', ['grow', 'shrink', 'lifeup', 'lifedn'].every(id => G.modWeight(id, 5) > 0));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
