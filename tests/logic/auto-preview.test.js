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
// (owner, after v1.0.78) a Switch lights the group it picked this pull; the others are skipped (dimmed in the slots)
{
  const sl = ['switch2', 'follow', 'vigour', 'discrim', 'follow', 'vigour'], O = [0, 1, 2, 3, 4, 5];
  const p1 = G.pvPull({ slots: sl, idx: 6, swc: { 0: 1 } }, O, 0), p2 = G.pvPull({ slots: sl, idx: 6, swc: { 0: 2 } }, O, 0);
  check('Switch: pull 1 lights the first group, skips the second', JSON.stringify(p1) === JSON.stringify({ slots: [0, 1, 2], skip: [3, 4, 5] }), p1);
  check('Switch: pull 2 lights the second, skips the first', JSON.stringify(p2) === JSON.stringify({ slots: [0, 3, 4, 5], skip: [1, 2] }), p2);
  const { pl, gi } = withGun(sl), S = G.previewScene(200, 120, pl, gi), pv = G.previewState(S), seen = [];
  for (let i = 0; i < 30 * 8 && seen.length < 4; i++) { const was = pv.lit; G.titleStep(S, 1 / 30); if (pv.lit && pv.lit !== was) seen.push(pv.lit.skip.join()); }
  check('Switch in the window: the skipped group takes turns pull by pull', seen.length >= 4 && seen[0] !== seen[1] && seen[0] === seen[2] && seen[1] === seen[3], seen);
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
  const S = G.previewScene(215, 80, pl, gi, 7), seen = new Set();
  run(S, 120, seen);
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
// blasts eat the floor and walls; they grow back slowly, cell by cell (DEV.autoPvRegrow a second), not all at once
{
  const { pl, gi } = withGun(['blast']);
  const S = G.previewScene(110, 80, pl, gi, 7), pv = G.previewState(S);
  const miss = () => S.cells.reduce((n, v, i) => n + (v !== pv.cells[i] ? 1 : 0), 0);
  for (let i = 0; i < 600 && miss() < 20; i++) G.titleStep(S, 1 / 60);
  S.team[0].guns[gi].slots = [];
  S.shots.length = 0;
  const m0 = miss();
  check('a blast bites the room', m0 >= 20, m0);
  const per = G.DEV.autoPvRegrow;
  G.titleStep(S, 0.05); G.titleStep(S, 0.05);
  const m1 = miss();
  check('a tenth of a second on: some grew back, at the knob rate, not all', m0 - m1 > 0 && m0 - m1 <= Math.ceil(per * 0.1) + 1 && m1 > 0, [m0, m1, per]);
  for (let i = 0; i < 60 * 30; i++) G.titleStep(S, 1 / 60);
  check('in time it is whole again', miss() === 0, miss());
}
// the hologram lights up on a hit
{
  const { pl, gi } = withGun(['bolt']);
  const S = G.previewScene(110, 80, pl, gi, 7), pv = G.previewState(S);
  let lit = false;
  for (let i = 0; i < 240 && !lit; i++) { G.titleStep(S, 1 / 60); lit = pv.hitT > 0; }
  check('a hit lights the hologram (pv.hitT)', lit);
  check('it stands PV_HOLO_X off the right wall', Math.abs(pv.dx - (Math.max(4, Math.floor(110 / 2) - 2) * 2 - G.PV_HOLO_X)) < 1e-6, pv.dx);
}
// the grown window (wider room): he still fires across it
{
  const { pl, gi } = withGun(['bolt']);
  const S = G.previewScene(215, 80, pl, gi, 7), pv = G.previewState(S);
  for (let i = 0; i < 240; i++) G.titleStep(S, 1 / 60);
  check('grown: the target far across the room is still shot', pv.dps > 0 && S.runners[0].x < 10 && pv.dx > 150, [pv.dps, pv.dx]);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
