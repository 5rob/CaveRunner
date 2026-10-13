// The purple trajectory mods in CaveRunner Auto, Part A (auto/traj.js trajStep, flown by art/titlescene.js stepShots): Orbiting
// Arc circles its caster inside its radius, Spiral Arc swings side to side within its widest swing, Boomerang comes back and is
// caught, Ping-Pong Path reverses. The pure step first, then each in a real level scene (one player, no creatures).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
for (const id of ['orbit', 'spiral', 'boomer', 'pong']) check(id + ' is off GUN_TODO, with its knob group', !G.GUN_TODO.includes(id) && G.DEV_META.some(m => m.g === G.TRAJ_GROUP[id]));
// the pure step: an orbit about a still caster holds the radius
{
  const s = { x: 0, y: 0, vx: 100, vy: 0, life: 3, orbit: 3.4, age: 0 }, home = { x: 0, y: 0 };
  let worst = 0, ang = 0, last = null;
  for (let i = 0; i < 120; i++) {
    s.age += 1 / 60; const [ex, ey] = G.trajStep(s, 1 / 60, home); s.x += s.vx / 60 + ex; s.y += s.vy / 60 + ey; s.life -= 1 / 60;
    if (s.age > G.DEV.trOrbIn + 0.05) worst = Math.max(worst, Math.abs(Math.hypot(s.x, s.y) - G.DEV.trOrbR));
    const a = Math.atan2(s.y, s.x); if (last != null) ang += Math.atan2(Math.sin(a - last), Math.cos(a - last)); last = a;
  }
  check('pure: an orbit sits on its radius', worst < 0.5, worst);
  check('pure: … and goes round at its speed', Math.abs(Math.abs(ang) - G.DEV.trOrbW * 2) < 1.5, ang);
}
const keep = G.DEV.autoFoeElites;
G.DEV.autoFoeElites = 0;
/** @param {string[]} slots @param {(s: any, home: {x: number, y: number}, st: any) => void} see */
function watch(slots, see) {
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.slots = slots.slice(); g.cap = slots.length; G.resetGun(g);
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
  const st = { n: 0, seen: new Set(), gone: 0 };
  for (let i = 0; i < 600; i++) {
    S.foes.length = 0;
    const before = new Set(S.shots.filter(s => s.sid === 'bolt'));
    G.titleStep(S, 1 / 60);
    const r = S.runners[0], home = { x: r.x + G.PW / 2, y: r.y + G.PH / 2 };
    for (const s of S.shots) if (s.sid === 'bolt') { st.n++; st.seen.add(s); see(s, home, st); }
    for (const s of before) if (!S.shots.includes(s) && s.caught) st.gone++;
  }
  return st;
}
// orbit: once swung out, never further than its radius (plus a step) from the caster, and it goes round
{
  let far = 0, turns = 0;
  const st = watch(['auto', 'orbit', 'bolt'], (s, home) => {
    if (s.age > G.DEV.trOrbIn + 0.05) far = Math.max(far, Math.hypot(s.x - home.x, s.y - home.y));
    const a = Math.atan2(s.y - home.y, s.x - home.x);
    if (s.la != null) { s.turn = (s.turn || 0) + Math.atan2(Math.sin(a - s.la), Math.cos(a - s.la)); turns = Math.max(turns, Math.abs(s.turn) / (2 * Math.PI)); }
    s.la = a;
  });
  check('orbit: bolts fly', st.seen.size > 0, st.seen.size);
  check('orbit: stays within its radius of the caster', far > 0 && far < G.DEV.trOrbR + 4, far);
  check('orbit: goes round at least once', turns >= 1, turns);
}
// spiral: its sideways swing across the shot's line changes side, within the widest swing
{
  let flips = 0, wide = 0;
  const st = watch(['auto', 'spiral', 'bolt'], (s) => {
    const off = G.trajSpiralOff(s.spiral, s.age);
    wide = Math.max(wide, Math.abs(off));
    const side = Math.sign(off); if (s.side0 != null && side && side !== s.side0) flips++; if (side) s.side0 = side;
  });
  check('spiral: bolts fly', st.seen.size > 0);
  check('spiral: swings side to side', flips >= 4, flips);
  check('spiral: … no wider than its widest swing', wide > 2 && wide <= G.DEV.trSpMax + 1e-9, wide);
}
// boomerang: flies out, turns back toward its caster, and is caught
{
  let back = 0;
  const st = watch(['auto', 'boomer', 'bolt'], (s, home) => { if (s.back && (home.x - s.x) * s.vx > 0) back++; });
  check('boomerang: heads back to its caster', back > 0, back);
  check('boomerang: is caught', st.gone > 0, st.gone);
}
// ping-pong: reverses its way, again and again
{
  let rev = 0;
  watch(['auto', 'pong', 'bolt'], (s) => { if (s.lastVx != null && Math.sign(s.vx) !== Math.sign(s.lastVx)) rev++; s.lastVx = s.vx; });
  check('ping-pong: reverses', rev >= 2, rev);
}
// a plain bolt does none of it
{
  let rev = 0;
  watch(['auto', 'bolt'], (s) => { if (s.lastVx != null && Math.sign(s.vx) !== Math.sign(s.lastVx)) rev++; s.lastVx = s.vx; });
  check('a plain bolt never reverses', rev === 0, rev);
}
// the card's Copy: one group's changed knobs in Copy Dev settings' shape
{
  const k = G.DEV.trOrbR; G.DEV.trOrbR = 33;
  const t = G.devReportOf('trajorbit', 'Trajectory: Orbiting Arc');
  check('Copy lists the changed knob', t.includes('(DEV.trOrbR): 33') && !t.includes('trSpHz'), t);
  G.DEV.trOrbR = k;
}
// ---- Part B ----
for (const id of ['homing', 'seeker', 'nearhome', 'autoaim', 'gravmod', 'float', 'flat']) check(id + ' is off GUN_TODO, with its knob group', !G.GUN_TODO.includes(id) && G.DEV_META.some(m => m.g === G.TRAJ_GROUP[id]));
// the scene shot carries which mod it was (shotsOf)
/** @param {string[]} mods */
const shotOf = mods => { const g = G.resetGun(Object.assign(G.scratchPistol(), { slots: mods.concat('bolt'), cap: mods.length + 1 })); const p = G.planCast(g); return G.shotsOf(p.shots[0], 0, 0, 0, () => 0.5, 0)[0]; };
check('shotsOf carries the kinds', shotOf(['homing']).homN === 1 && shotOf(['seeker']).seekN === 1 && shotOf(['nearhome']).nearN === 1 && shotOf(['autoaim']).autoaim === 1);
// homing kinds: a creature placed above and ahead; each turns its shot onto it (pure), Short-range only once near, Seeker locks on
/** @param {any} kind @param {number} fy */
function homeRun(kind, fy) {
  const foe = { x: 60, ty: fy, hp: 5 }, s = Object.assign({ x: 0, y: 0, vx: 135, vy: 0, age: 0 }, kind);
  let first = -1, best = 1e9;
  for (let i = 0; i < 60; i++) {
    s.age += 1 / 60; const tg = G.trajHome(s, [foe], 0, 1 / 60); if (tg && first < 0) first = i;
    s.x += s.vx / 60; s.y += s.vy / 60; best = Math.min(best, Math.hypot(foe.x - s.x, foe.ty - s.y));
  }
  return { first, best: +best.toFixed(1), tgt: !!s.tgt };
}
const plainMiss = (() => { let best = 1e9; for (let i = 0; i < 60; i++) best = Math.min(best, Math.hypot(60 - i * 135 / 60, -30)); return best; })();
const ho = homeRun({ homN: 1 }, -30), se = homeRun({ seekN: 1 }, -30), ne = homeRun({ nearN: 1 }, -30), neFar = homeRun({ nearN: 1 }, -60);
check('homing turns onto a placed creature (closer than a plain shot passes)', ho.first >= 0 && ho.best < plainMiss - 5, { ho, plainMiss });
check('seeker locks on and gets closer than homing', se.tgt && se.best <= ho.best, { se, ho });
check('short-range homing waits till it is near', ne.first > ho.first && ne.best < plainMiss, { ne, ho });
check('… and ignores one out of its reach', neFar.first < 0, neFar);
// auto-aim: its first heading points at the nearest creature
{
  const s = { x: 0, y: 0, vx: 135, vy: 0 }, foes = [{ x: 80, ty: -40, hp: 3 }, { x: 150, ty: 50, hp: 3 }];
  G.trajAim(s, foes, 0);
  const err = Math.abs(Math.atan2(s.vy, s.vx) - Math.atan2(-40, 80));
  check('auto-aim heads straight at the nearest creature', err < 0.01, err);
  const s2 = { x: 0, y: 0, vx: 135, vy: 0 }; G.trajAim(s2, [], 0);
  check('… and flies on with none in reach', s2.vy === 0 && s2.aimed === 1);
}
// gravity, anti-gravity and flat in a real level: the bolt's height change over its flight, against a plain bolt's
/** @param {string[]} slots */
function drop(slots) {
  let dy = 0, n = 0, vyMax = 0;
  // (v1.0.74) its fall: the speed down it gains (s.vy less its first), not the drop (that hangs on the way he aims)
  watch(['auto'].concat(slots, 'bolt'), (s) => { if (s.vy0 == null) s.vy0 = s.vy; if (s.age > 0.15 && s.age < 0.25) { dy += (s.vy - s.vy0) * 0.1; n++; } vyMax = Math.max(vyMax, Math.abs(s.vy)); });
  return { dy: n ? dy / n : 0, vyMax };
}
const pd = drop([]), gd = drop(['gravmod']), fd = drop(['float']), fl = drop(['flat']);
check('gravity: its shot drops more than a plain one', gd.dy > pd.dy + 2, { gd, pd });
check('anti-gravity: its shot rises against a plain one', fd.dy < pd.dy - 2, { fd, pd });
check('flat: vy stays 0', fl.vyMax === 0, fl);
check('flat: hits harder', shotOf(['flat']).dmg > shotOf([]).dmg);
G.DEV.autoFoeElites = keep;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
