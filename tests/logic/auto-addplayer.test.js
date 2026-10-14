// CaveRunner Auto stage 12: a player added mid-scene (auto/addrunner.js sceneAddRunner, after run.js addPlayer):
// in the hub he comes through the enter pad (after v1.0.78); in a level he arrives at once with a flash, sparks and lightning beside
// player 1, and in a level he fires his own starter gun.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- the hub ---- (owner, after v1.0.78) he comes through the enter teleporter: it charges, then he's through with its
// flash, lightning and arc (heard wherever the team is: H.far, the play area's flash from the left when it's off screen)
{
  const run = G.newRun(4);
  const S = G.hubScene(200, 4, run.players.length, run.tier, {});
  for (let t = 0; t < 4; t += 1 / 60) G.titleStep(S, 1 / 60);
  const H = G.hubState(S);
  H.stick = { active: true, nx: 1, ny: 0, mag: 1, dy: 0 };   // (player 1 walks off down the hallway)
  for (let t = 0; t < 3; t += 1 / 60) G.titleStep(S, 1 / 60);
  H.stick = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 };
  G.bagAdd(run, { kind: 'green', n: 1 });
  const pl = G.addPlayer(run);
  const n0 = S.runners.length, pad = G.hubStopX('enter');
  const r = G.sceneAddRunner(S);
  check('hub: addPlayer gives a second player', !!pl && run.players.length === 2);
  check("hub: one more runner, player 2's, hidden on the enter pad", !!r && S.runners.length === n0 + 1 && r.hide && r.id === 1 && Math.abs(r.x + G.PW / 2 - pad) < 1 && !H.arrived[1], r && { n: S.runners.length, x: r.x, hide: r.hide });
  check('hub: the pad charges', G.hubCharge(S).ch >= 0 && G.hubCharge(S).ch < 0.1);
  for (let t = 0; t < 0.5; t += 1 / 60) G.titleStep(S, 1 / 60);
  check('hub: half way, still charging, not through', G.hubCharge(S).ch > 0.4 && r.hide && !H.arrived[1], G.hubCharge(S));
  const z0 = S.zaps.length;
  let snd = false;
  for (let t = 0; t < 0.7 && !H.arrived[1]; t += 1 / 60) { S.flash = 0; G.titleStep(S, 1 / 60); snd = snd || S.snd.some(e => e.k === 'arc' && e.a && e.a.near); }
  check('hub: through after the charge, with lightning and the arc heard from afar', H.arrived[1] && !r.hide && S.zaps.length > z0 && snd && H.far === S.t, { arr: H.arrived[1], zaps: S.zaps.length - z0, snd, far: H.far, t: S.t });
  check('hub: on the floor on the pad, the team far off', Math.abs(r.y + G.PH - H.fy) < 1e-6 && Math.abs(r.x + G.PW / 2 - pad) < 8 && S.runners[0].x - r.x > 100, { x: r.x, l: S.runners[0].x });
  for (let t = 0; t < 6; t += 1 / 60) G.titleStep(S, 1 / 60);
  const gap = Math.abs(S.runners[0].x - S.runners[1].x);
  check('hub: he runs to the team and follows, kept apart', gap > 4 && gap < 60, gap);
  const r3 = G.sceneAddRunner(S), r4 = G.sceneAddRunner(S), r5 = G.sceneAddRunner(S);
  check('hub: at most 4 runners', !!r3 && !!r4 && r5 === null && S.runners.length === 4);
}

// ---- a level: he fires his own gun ----
{
  const run = G.newRun(3);
  // (a level whose first zone is open cave: the creature he shoots at stands in the open; zones shift when one's added)
  let ls = 3;
  while (G.levelPlan(ls).zp.z[1].z !== 'webs' && ls < 200) ls++;   // (not moss: the start pad is moss, and no zone follows its own kind)
  const S = G.levelScene(200, ls, 1, undefined, run.players);
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
