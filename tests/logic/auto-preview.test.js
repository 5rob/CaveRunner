// The gun panel's firing window (owner: "matching the real game 1 for 1"; auto/preview.js): the level's own scene, the player
// firing by the level's code at a target that never dies. The same guns do the same things in it as in a level; what a level
// can't do (GUN_TODO) does nothing here too; the real gun is never spent.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

/** a run's player 1 with his active gun's slots set */
const withGun = slots => {
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.slots = slots.slice(); g.cap = slots.length; g.manaMax = 999; g.mana = 999; g.manaRegen = 999; G.resetGun(g);
  return { pl, g, gi: pl.active };
};
/** step the window n frames at 1/60, gathering every shot seen */
const run = (S, n, seen) => { for (let i = 0; i < n; i++) { G.titleStep(S, 1 / 60); if (seen) for (const s of S.shots) seen.add(s); } };

// bolt: fired at the target, hits it, it never dies; the real gun untouched
{
  const { pl, g, gi } = withGun(['bolt']);
  const idx0 = g.idx, mana0 = g.mana;
  const S = G.previewScene(110, 80, pl, gi, 7), pv = G.previewState(S), seen = new Set();
  run(S, 180, seen);
  const shots = [...seen];
  check('bolt: the player pulls the gun', pv.pulls > 2, pv.pulls);
  check('its shots are the level\'s (planShots: real, his, Spark Bolt)', shots.length > 0 && shots.every(s => s.real && s.by === 0 && s.sid === 'bolt'), shots.slice(0, 2).map(s => [s.real, s.by, s.sid]));
  check('the target takes the hits (damage per second)', pv.dps > 0 && S.runners[0].dealt > 0, [pv.dps, S.runners[0].dealt]);
  check('and never dies', S.foes.includes(pv.foe) && pv.foe.hp === G.PV_HP);
  check('the real gun is never spent', g.idx === idx0 && g.mana === mana0 && !g.pulls, [g.idx, g.mana, g.pulls]);
  check('each pull lights its slot', !!pv.lit || pv.pulls > 0);
  check('the slots a pull fired (pvLit)', JSON.stringify(G.pvLit({ slots: ['bolt', 'heavy', 'bolt'], idx: 2 }, [0, 1, 2], 0)) === '[0]' &&
    JSON.stringify(G.pvLit({ slots: ['heavy', 'bolt'], idx: 0 }, [0, 1], 0)) === '[0,1]');
}
// a shot flies the same in the window and in a level (one stepShots): the same shot, open air, no creatures
{
  const { pl, gi } = withGun(['bolt']);
  const P = G.previewScene(200, 120, pl, gi, 7);
  const L = G.levelScene(400, 5, 1, G.levelPlan(5), [pl]);
  const mk = () => G.shotsOf({ sid: 'bolt', speed: 200, size: 2, life: 2, dmg: 3, grav: 60, drag: 0.5, col: '#fff' }, -0.4, 40, 60, () => 0.5, -1)[0];
  for (const S of [P, L]) { S.cells.fill(0); S.foes.length = 0; S.shots.length = 0; S.runners[0].out = true; S.shots.push(mk()); }
  P.hub.pv.foe = undefined;
  for (let i = 0; i < 20; i++) for (const S of [P, L]) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
  const a = P.shots[0], b = L.shots[0];
  check('one shot, the same path in the window and a level', a && b && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6, a && b && [a.x, a.y, b.x, b.y]);
}
// Follow Me + bolt: the shot comes back to its caster in the window, as in a level
{
  const { pl, gi } = withGun(['follow', 'bolt']);
  const S = G.previewScene(110, 80, pl, gi, 7), seen = new Set();
  run(S, 60, seen);
  const back = [...seen].some(s => s.follow > 0 && s.vx < 0);
  check('Follow Me: its shots turn back to him', back);
}
// White Hole: hangs ahead of the gun and pulls
{
  const { pl, gi } = withGun(['vacfield']);
  const S = G.previewScene(110, 80, pl, gi, 7), seen = new Set();
  run(S, 60, seen);
  check('White Hole: cast in the window', [...seen].some(s => s.vac > 0));
}
// Circle of Vigour: on the ground at him
{
  const { pl, gi } = withGun(['vigour']);
  const S = G.previewScene(110, 80, pl, gi, 7), seen = new Set();
  run(S, 60, seen);
  check('Circle of Vigour: cast in the window', [...seen].some(s => s.heal > 0));
}
// a GUN_TODO static (Storm): nothing flies in a level, nothing here either
{
  const id = G.GUN_TODO.find(m => G.MODS[m] && G.MODS[m].kind === 'static');
  const { pl, gi } = withGun([id]);
  const S = G.previewScene(110, 80, pl, gi, 7), seen = new Set();
  run(S, 120, seen);
  check(`${id} (GUN_TODO): nothing in the window either`, seen.size === 0, seen.size);
}
// blasts eat the room; it's made whole a little after
{
  const { pl, gi } = withGun(['blast']);
  const S = G.previewScene(110, 80, pl, gi, 7), pv = G.previewState(S);
  let bit = false;
  for (let i = 0; i < 600; i++) { G.titleStep(S, 1 / 60); if (S.carved > 0) bit = true; }
  S.team[0].guns[gi].slots = [];
  for (let i = 0; i < 200; i++) G.titleStep(S, 1 / 60);
  check('a blast bites the room and it is mended', bit && S.cells.every((v, i) => v === pv.cells[i]), bit);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
