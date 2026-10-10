// CaveRunner Auto stage 12: a player added mid-scene (auto/addrunner.js sceneAddRunner, after run.js addPlayer):
// in the hub and in a level the runner count goes up, he arrives at once with a flash, sparks and lightning beside
// player 1, and in a level he fires his own starter gun.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- the hub ----
{
  const run = G.newRun(4);
  const S = G.hubScene(200, 4, run.players.length, run.tier, {});
  for (let t = 0; t < 4; t += 1 / 60) G.titleStep(S, 1 / 60);
  const H = G.hubState(S);
  G.bagAdd(run, { kind: 'green', n: 1 });
  const pl = G.addPlayer(run);
  const n0 = S.runners.length, z0 = S.zaps.length, p0 = S.parts.length;
  S.flash = 0;
  const r = G.sceneAddRunner(S);
  check('hub: addPlayer gives a second player', !!pl && run.players.length === 2);
  check('hub: one more runner, not hidden, player 2\'s', !!r && S.runners.length === n0 + 1 && !r.hide && r.id === 1, { n: S.runners.length });
  check('hub: he arrives with a flash, sparks, lightning and the arc sound', S.flash > 0 && S.parts.length > p0 && S.zaps.length > z0 && S.snd.some(s => s.k === 'arc'));
  check('hub: he stands on the floor near player 1', !!r && Math.abs(r.y + G.PH - H.fy) < 1e-6 && Math.abs(r.x - S.runners[0].x) < 60, r && { x: r.x, l: S.runners[0].x });
  check('hub: counted as arrived', H.arrived[1] === true);
  // the leader walks; he follows in the line
  H.stick = { active: true, nx: 1, ny: 0, mag: 1, dy: 0 };
  for (let t = 0; t < 1.5; t += 1 / 60) G.titleStep(S, 1 / 60);
  H.stick = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 };
  for (let t = 0; t < 3; t += 1 / 60) G.titleStep(S, 1 / 60);
  const gap = Math.abs(S.runners[0].x - S.runners[1].x);
  check('hub: he follows the leader, kept apart', gap > 4 && gap < 60, gap);
  const r3 = G.sceneAddRunner(S), r4 = G.sceneAddRunner(S), r5 = G.sceneAddRunner(S);
  check('hub: at most 4 runners', !!r3 && !!r4 && r5 === null && S.runners.length === 4);
}

// ---- a level: he fires his own gun ----
{
  const run = G.newRun(3);
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  const L = G.levelState(S);
  for (let t = 0; t < 4; t += 1 / 60) G.titleStep(S, 1 / 60);
  G.bagAdd(run, { kind: 'green', n: 1 });
  const pl = G.addPlayer(run);
  const z0 = S.zaps.length;
  S.flash = 0;
  const r = G.sceneAddRunner(S);
  check('level: one more runner, arrived, with meters', !!r && S.runners.length === 2 && L.arrived[1] === true && !!L.meters[1]);
  check('level: he arrives with a flash and lightning', S.flash > 0 && S.zaps.length > z0);
  check('level: S.team is the run\'s players (his gun is in it)', S.team === run.players && S.team[1] === pl);
  // a quiet sandbox in front of him: no phases, a creature to shoot at
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false; S.foes.length = 0;
  const k = G.enemyFor('rotta', 1);
  const fy = r.y + G.PH - k.r - 1;
  const foe = { x: S.scroll + r.x + 60, y: fy, ty: fy, r: k.r, phase: 0, hp: k.hp * 50, hpMax: k.hp * 50, cd: 99, flash: 0, lx: 0, ly: 1,
    hx: S.scroll + r.x + 60, hy: fy, tgt: null, rest: 99, k, touch: 0, charge: 0 };
  S.foes.push(foe);
  const m0 = pl.guns[0].mana;
  let low = m0;
  for (let t = 0; t < 4; t += 1 / 60) { G.titleStep(S, 1 / 60); foe.x = foe.hx; foe.y = foe.ty = fy; G.levelMeters(S, L, 1 / 60); low = Math.min(low, pl.guns[0].mana); }
  check('level: his starter gun fires (its mana spent)', low < m0, { m0, low });
  check('level: his damage is his own', (r.dealt || 0) > 0 && G.meterSum(L.meters[1].dmg) > 0, r.dealt);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
