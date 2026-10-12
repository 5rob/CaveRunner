// CaveRunner Auto: Discriminate (owner, v1.0.71). A set copy ('discrim:<kind>:<id>', spells/discrim.js) puts its
// target on the next spell's shot (`only`): a bolt then hits only that creature kind, passing through the rest;
// a White Hole pulls only that: a creature kind, gold nuggets (S.coins) or red / green crystal pickups (S.loot).
// An unset copy changes nothing.
const G = require('../load');
let fails = 0;
const check = (name, ok, info) => { console.log((ok ? '  ok  ' : '  FAIL ') + name + (ok || info === undefined ? '' : ' ' + JSON.stringify(info))); if (!ok) fails++; };

const R0 = () => 0.5;
const gunOf = slots => G.resetGun({ name: 'm', cap: slots.length, castDelay: 0.2, recharge: 0.5, manaMax: 5000, manaRegen: 100, spread: 0,
  multi: 1, shuffle: false, speedMul: 1, mana: 5000, slots: slots.slice() });
const shotsFor = slots => G.planShots(G.planCast(gunOf(slots)), 0, 0, 0, R0, 0);

const RAT = G.discrimId({ kind: 'creature', id: 'rotta' });
const GOLD = G.discrimId({ kind: 'object', id: 'gold' });
const RED = G.discrimId({ kind: 'object', id: 'red' });

// ---- the bridge carries the target ----
check('a set copy is its own registered mod', !!G.MODS[RAT] && G.MODS[RAT].base === 'discrim');
check('Discriminate:rat puts the rat on the bolt', JSON.stringify(shotsFor([RAT, 'bolt'])[0].only) === JSON.stringify({ kind: 'creature', id: 'rotta' }));
check('…and on a White Hole', JSON.stringify(shotsFor([GOLD, 'vacfield'])[0].only) === JSON.stringify({ kind: 'object', id: 'gold' }));
check('an unset copy changes nothing', JSON.stringify(shotsFor(['discrim', 'bolt'])) === JSON.stringify(shotsFor(['bolt'])));
check('Discriminate is off GUN_TODO', !G.GUN_TODO.includes('discrim'));

// ---- a bolt with Discriminate:rat passes through a jellyfish and hits a rat (the scene's sandbox) ----
function scene() {
  const run = G.newRun(3);
  for (const pl of run.players) pl.guns = pl.guns.map(() => null);
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false;
  S.foes.length = 0; S.shots.length = 0;
  return S;
}
function foeAt(S, id, x, y) {
  const k = G.enemyFor(id, 1);
  const f = { x: S.scroll + x, y, ty: y, r: k.r, phase: 0, hp: 9999, hpMax: 9999, cd: 99, flash: 0, lx: 0, ly: 1,
    hx: S.scroll + x, hy: y, tgt: null, rest: 99, k, touch: 0, charge: 0 };
  S.foes.push(f);
  return f;
}
{
  const S = scene(), r = S.runners[0], y = r.y + G.PH / 2;
  const jelly = foeAt(S, 'meduusa', r.x + 40, y), rat = foeAt(S, 'rotta', r.x + 90, y);
  const sh = G.planCast(gunOf([RAT, 'bolt'])).shots[0];
  for (const s of G.shotsOf(sh, 0, r.x + G.PW / 2 + 6, y, R0, 0)) S.shots.push(s);
  for (let i = 0; i < 90; i++) { G.titleStep(S, 1 / 60); for (const f of [jelly, rat]) { f.x = f.hx; f.y = f.ty = y; } }
  check('the bolt passes through the jellyfish', jelly.hp === 9999, jelly.hp);
  check('…and hits the rat', rat.hp < 9999, rat.hp);
}
{
  const S = scene(), r = S.runners[0], y = r.y + G.PH / 2;
  const jelly = foeAt(S, 'meduusa', r.x + 40, y);
  for (const s of G.shotsOf(G.planCast(gunOf(['bolt'])).shots[0], 0, r.x + G.PW / 2 + 6, y, R0, 0)) S.shots.push(s);
  for (let i = 0; i < 90; i++) { G.titleStep(S, 1 / 60); jelly.x = jelly.hx; jelly.y = jelly.ty = y; }
  check('a plain bolt still hits the jellyfish', jelly.hp < 9999, jelly.hp);
}

// ---- White Hole: vacPull with `only` (pure) ----
const hole = only => Object.assign(G.whiteHole({ r: 64, life: 2 }, 0, 0, 0, 0), { x: 100, y: 50, only });
const foe = id => ({ x: 130, y: 50, ty: 50, hp: 5, k: { id } });
const run = (s, foes, coins, loot) => { for (let i = 0; i < 20; i++) G.vacPull(s, foes, 0, [], 1 / 60, 200, coins, loot); };
{
  const f = foe('rotta'), c = { x: 70, y: 50, amount: 1, t: 0 };
  run(hole({ kind: 'object', id: 'gold' }), [f], [c], []);
  check('White Hole + Discriminate:gold pulls a gold nugget', c.x > 70, c.x);
  check('…and doesn\'t move a creature', f.x === 130, f.x);
}
{
  const c = { x: 70, y: 50, amount: 1, t: 0 }, red = { x: 130, y: 50, vx: 0, vy: 0, it: { kind: 'red' }, t: 0 }, green = { x: 100, y: 80, vx: 0, vy: 0, it: { kind: 'green' }, t: 0 };
  run(hole({ kind: 'object', id: 'red' }), [], [c], [red, green]);
  check('Discriminate:red pulls a red pickup', red.x < 130, red.x);
  check('…not a gold nugget', c.x === 70, c.x);
  check('…not a green one', green.y === 80, green.y);
}
{
  const rat = foe('rotta'), jelly = Object.assign(foe('meduusa'), { x: 70 });
  run(hole({ kind: 'creature', id: 'rotta' }), [rat, jelly], [], []);
  check('Discriminate:rat pulls rats only', rat.x < 130 && jelly.x === 70, [rat.x, jelly.x]);
}
{
  const f = foe('rotta'), c = { x: 70, y: 50, amount: 1, t: 0 };
  run(hole(null), [f], [c], []);
  check('an unset White Hole pulls creatures as before, and not gold', f.x < 130 && c.x === 70, [f.x, c.x]);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
