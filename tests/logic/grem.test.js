// Grem Mode (src/auto/grem.js, the endless level in src/auto/level.js): the presets' prices and unlocking, the team's size and
// guns, player 1's kit, the endless plan and levelOnward, gold-only drops, the tapped target (S.pick); and (v1.0.85) a White
// Hole with Follow Me comes to its caster.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;

// ---- prices and unlocking ----
const p = [0, 1, 2, 3].map(G.gremPrice);
check('each preset dearer than the last', p.every((v, i) => !i || v > p[i - 1]), p);
check('the first costs the knob', p[0] === D.gremPrice, p[0]);
check('nothing unlocked at 0 gold', G.gremUnlocked(0, 4) === 0);
check('the first unlocked at its price', G.gremUnlocked(p[0], 4) === 1 && G.gremUnlocked(p[0] - 1, 4) === 0);
check('the second needs both paid', G.gremUnlocked(p[0] + p[1] - 1, 4) === 1 && G.gremUnlocked(p[0] + p[1], 4) === 2);
check('never more than there are', G.gremUnlocked(1e12, 3) === 3);
check('fill: half way through the second', Math.abs(G.gremFill(p[0] + p[1] / 2, 1) - 0.5) < 1e-9);
check('fill: an unlocked one is full, a later one empty', G.gremFill(p[0] + 1, 0) === 1 && G.gremFill(p[0] + 1, 2) === 0);

// ---- the team ----
check('one player at level 1', G.gremTeam(1) === 1);
check('players join at the knobs\' levels', G.gremTeam(D.gremP2) === 2 && G.gremTeam(D.gremP3) === 3 && G.gremTeam(D.gremP4) === 4 && G.gremTeam(D.gremP2 - 1) === 1);
check('extra players: none unlocked, no preset', G.gremTeamGun(0, 1) === -1);
check('extra players take the newest unlocked, one each', G.gremTeamGun(5, 1) === 4 && G.gremTeamGun(5, 2) === 3 && G.gremTeamGun(5, 3) === 2);
check('… round again with fewer', G.gremTeamGun(2, 1) === 1 && G.gremTeamGun(2, 2) === 0 && G.gremTeamGun(2, 3) === 1);

// ---- the kit ----
const kit = G.gremKitClean({ exo: { hp: [5, 9, 'x', 2], speed: [1] }, perks: ['ghost', 'nope', 'hp'] });
check('kit: tiers 1-5 kept, junk emptied', JSON.stringify(kit.exo.hp) === JSON.stringify([5, 0, 0, 2, 0]) && kit.exo.speed[0] === 1, kit.exo);
check('kit: named perks only (no unknown, no stat perk)', kit.perks[0] === 'ghost' && kit.perks[1] === null && kit.perks[2] === null, kit.perks);
const run = G.gremRun(kit, G.titleRng(4));
const pl = run.players[0];
check('a Grem run: level 1, one player with a gun', run.tier === 1 && run.players.length === 1 && !!pl.guns[0]);
check('… wearing the kit', pl.exo.hp[0].tier === 5 && pl.exo.hp[3].tier === 2 && pl.perks[0].id === 'ghost');
G.healRun(run);
check('… its health from the kit', pl.hp > G.playerStats(G.newPlayer(0)).maxHp, pl.hp);

// ---- the endless level ----
const P = G.levelPlan(5, 1, 0, 1, true);
check('endless: no exit pad and no solid rock after the arena', P.zp.z[P.zp.z.length - 1].x1 === P.arena.x1 && P.wallX === Infinity);
const S = G.levelScene(300, 5, 1, undefined, run.players, 1, run, true), L = G.levelState(S);
check('a Grem level is endless', L.grem && L.plan.zp.z.every(z => z.x1 < 1e9));
check('no exit pad drawn', G.levelPads(S).every(q => q.id !== 'exit'));
const a0 = L.plan.arena.x1;
L.phase = 'out';
G.levelOnward(S, L);
check('onward: the level + 1, on the scene and the run', S.tier === 2 && run.tier === 2 && L.ups === 1);
check('onward: a new stretch and arena further on', L.plan.z0 === a0 && L.plan.arena.x0 === L.plan.z1 && L.plan.len >= G.TITLE_ZLEN[0], [L.plan.z0, L.plan.z1]);
check('onward: running again, boss to come', L.phase === 'run' && !L.bossDead && !L.boss && !S.gunsOff);
check('onward: the zones join up', L.plan.zp.z.every((z, i) => !i || Math.abs(z.x0 - L.plan.zp.z[i - 1].x1) < 1e-6));

// ---- gold only ----
const loot = S.lvl.loot(S, { k: { boss: true, gold: 5 } });
check('a Grem boss drops gold only', loot.length > 0 && loot.every(it => it.kind === 'gold'), loot.map(it => it.kind));
let rolls = '';
for (let i = 0; i < 40; i++) rolls += G.chestRoll(G.titleRng(i + 1), 3, true)[0].kind[0];
check('a Grem chest holds gold only', /^g+$/.test(rolls), rolls);
const S2 = G.levelScene(300, 5, 1, undefined, G.newRun(2).players, 1, G.newRun(2));
const L2 = G.levelState(S2);
check('the normal level still has its exit', !L2.grem && L2.plan.zp.z[L2.plan.zp.z.length - 1].x1 === 1e9);

// ---- the tapped target ----
const T = G.levelScene(300, 7, 1, undefined, G.newRun(2).players, 1, null);
for (let i = 0; i < 30; i++) G.titleStep(T, 1 / 30);
T.foes.length = 0;
const near = G.titleFoeAt(T, G.enemyFor('rotta', 1), T.scroll + T.runners[0].x + 30);
const far = G.titleFoeAt(T, G.enemyFor('rotta', 1), T.scroll + T.runners[0].x + 150);
check('without a pick: the nearest', G.titleAimPick(T, T.runners[0]) === near);
T.pick = far;
check('with a pick: the picked one', G.titleAimPick(T, T.runners[0]) === far);
far.hp = 0;
check('the pick dead: back to the nearest, the pick cleared', G.titleAimPick(T, T.runners[0]) === near && !T.pick);

// ---- White Hole + Follow Me (v1.0.85: the Follow Me was dropped making the hole) ----
check('a White Hole keeps its Follow Me', G.whiteHole({ r: 64, life: 2, follow: 4 }, 0, 0, 0, 0).follow === 4);
const W = G.levelScene(300, 9, 1, undefined, G.newRun(2).players, 1, null);
for (let i = 0; i < 30; i++) G.titleStep(W, 1 / 30);
const r = W.runners[0], cx = r.x + 6, cy = r.y + 11;
W.team = null;   // (no gun of his own firing)
const hole = G.whiteHole({ r: 64, life: 5, follow: 4 }, 0, cx, cy, 0), still = G.whiteHole({ r: 64, life: 5 }, 0, cx, cy, 0);
W.shots.push(hole, still);
const d0 = Math.hypot(hole.x - cx, hole.y - cy);
for (let i = 0; i < 60; i++) { W.foes.length = 0; G.titleStep(W, 1 / 60); }
const rc = { x: r.x + 6, y: r.y + 11 }, d1 = Math.hypot(hole.x - rc.x, hole.y - rc.y);
check('with Follow Me it comes to its caster', d1 < d0 * 0.4, [d0, d1]);
check('without, it hangs where it was cast', Math.abs(still.x - (cx + G.WH_AHEAD)) < 1, still.x);

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
