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
// (owner, v1.0.90) the 3 extra players are unlocks spread among the guns, not by level
const seq = n => G.gremUnlocks(n).map(q => ('gun' in q ? 'G' : 'P')).join('');
check('8 presets: a player after every 2 guns', seq(8) === 'GGPGGPGGPGG', seq(8));
check('1 preset: the gun first', seq(1) === 'GPPP', seq(1));
check('no presets: just the players', seq(0) === 'PPP', seq(0));
check('the guns stay in order', G.gremUnlocks(9).filter(q => 'gun' in q).every((q, i) => q.gun === i));
check('a gun\'s place on the list', G.gremGunAt(2, 8) === 3 && G.gremGunAt(0, 8) === 0, G.gremGunAt(2, 8));
check('open: 3 unlocks of 8 presets = 2 guns, 2 players', JSON.stringify(G.gremOpen(3, G.gremUnlocks(8))) === JSON.stringify({ guns: [0, 1], team: 2 }), G.gremOpen(3, G.gremUnlocks(8)));
check('open: all = every gun, 4 players', G.gremOpen(11, G.gremUnlocks(8)).guns.length === 8 && G.gremOpen(11, G.gremUnlocks(8)).team === 4);
// (owner, v1.0.92) a random gun order, the players where they were
{
  const r = G.gremUnlocks(9, G.titleRng(11)), plain = G.gremUnlocks(9);
  const kinds = l => l.map(q => ('gun' in q ? 'G' : 'P')).join('');
  check('random order: the players in the same places', kinds(r) === kinds(plain), kinds(r));
  check('… every gun once', r.filter(q => 'gun' in q).map(q => q.gun).sort((a, b) => a - b).join() === '0,1,2,3,4,5,6,7,8');
  check("… not the presets' order", r.filter(q => 'gun' in q).map(q => q.gun).join() !== '0,1,2,3,4,5,6,7,8');
  check('open guns in the order they opened', JSON.stringify(G.gremOpen(4, r).guns) === JSON.stringify(r.slice(0, 4).filter(q => 'gun' in q).map(q => q.gun)));
}
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

// ---- (owner, v1.0.90) no damage, a gentler climb, double gold ----
{
  const R = G.gremRun(G.gremKitNew(), G.titleRng(3));
  G.healRun(R);
  const Q = G.levelScene(300, 5, 1, undefined, R.players, 1, R, true), hp = R.players[0].hp;
  G.levelHurt(Q, 0, 999);
  check('a Grem player takes no damage', R.players[0].hp === hp && !Q.runners[0].out, R.players[0].hp);
  const N = G.newRun(2); G.healRun(N);
  const Q2 = G.levelScene(300, 5, 1, undefined, N.players, 1, N), hp2 = N.players[0].hp;
  G.levelHurt(Q2, 0, 1);
  check('… a normal one still does', N.players[0].hp < hp2);
  const a = G.autoFoe('rotta', 9), g = G.gremFoe('rotta', 9), g3 = G.autoFoe('rotta', 3);
  check('Grem level 9 creature = level 3 in Auto (a quarter of the climb)', g.hp === g3.hp && g.dmg === g3.dmg && g.hp < a.hp, [g.hp, g3.hp, a.hp]);
  check('… its gold still level 9\'s', g.gold === a.gold, [g.gold, a.gold]);
  check('the pace climbs a quarter as fast', Math.abs(G.levelState(G.levelScene(300, 5, 1, undefined, R.players, 9, R, true)).base - G.lvlPace(3)) < 1e-9);
  const S9 = G.levelScene(300, 5, 1, undefined, R.players, 1, R, true);
  const raw = G.killLoot('foe', 1, G.titleRng(8), 5)[0].n, got = S9.lvl.loot(Object.assign(S9, { rnd: G.titleRng(8) }), { k: { gold: 5 } })[0].n;
  check('kill gold × DEV.gremGold', got === Math.round(raw * D.gremGold), [raw, got]);
  const keep = ['autoChestMod', 'autoChestExo', 'autoChestRed', 'autoChestPerk', 'autoChestGreen'].map(k => [k, D[k]]);
  for (const [k] of keep) D[k] = 0;   // (every chest gold, so both rolls use the random the same way)
  const c1 = G.chestRoll(G.titleRng(5), 2, false), c2 = G.chestRoll(G.titleRng(5), 2, true);
  for (const [k, v] of keep) D[k] = v;
  check('chest gold × DEV.gremGold', Math.abs(c2[0].n - c1[0].n * D.gremGold) <= D.gremGold, [c1[0].n, c2[0].n]);
}

// ---- (owner, v1.0.92) name tags, guns that keep up, the boss's entrance, GO!, players teleporting in ----
{
  const k = G.gremKitClean({ names: ['Grem', 42, 'A very long name indeed'] });
  check('names: kept, junk emptied, cut to the max', k.names[0] === 'Grem' && k.names[1] === '' && k.names[2].length === G.GREM_NAME_MAX && k.names[3] === '', k.names);
  check('damage × 1 at level 1', G.gremDmgMul(1) === 1);
  const hp9 = G.gremFoe('rotta', 9).hp / G.gremFoe('rotta', 1).hp;
  check("damage at level 9 keeps up with the creatures' health", Math.abs(G.gremDmgMul(9) - hp9) / hp9 < 0.1, [G.gremDmgMul(9), hp9]);
  check('boss name lines: capitals, accents gone, a line a word', JSON.stringify(G.bossLines('Elävät luut')) === '["ELAVAT","LUUT"]', G.bossLines('Elävät luut'));
  const R = G.gremRun(G.gremKitNew(), G.titleRng(5));
  G.healRun(R);
  const B = G.levelScene(300, 6, 1, undefined, R.players, 1, R, true), L = G.levelState(B);
  check('a Grem scene: the damage and gold wait set', B.dmgMul === 1 && B.coinWait === D.gremGoldWait);
  for (let i = 0; i < 400 && L.phase === 'arrive'; i++) G.titleStep(B, 1 / 30);
  for (let i = 0; i < 10; i++) G.titleStep(B, 1 / 30);
  const T = G.levelTitle(B);
  check('GO! as the team sets off', !!T && T.lines[0] === 'GO!' && !T.red, T);
  B.scroll = L.plan.arena.x0 - G.LVL_TEAM;   // (v2.0.17) the fight starts as the team enters the arena
  for (let i = 0; i < 90 && !(L.phase === 'arena' && L.boss && G.levelTitle(B) && G.levelTitle(B).red); i++) G.titleStep(B, 1 / 30);
  const boss = L.boss;
  check('the arena: the boss already at its place (v2.0.17: no slide-in)', L.phase === 'arena' && !!boss && Math.abs(boss.x - L.bossTo) < 1, boss && [boss.x, L.bossTo]);
  const bt = G.levelTitle(B);
  check('its name in red', !!bt && bt.red && bt.lines.join(' ').length > 0, bt);
  check('guns off under its title', B.gunsOff === true);
  for (let i = 0; i < 30 * 12 && !L.introDone; i++) G.titleStep(B, 1 / 30);
  check('in its place once the title is gone', Math.abs(boss.x - L.bossTo) < 30 && boss.x - B.scroll < G.TITLE_VW, [boss.x, L.bossTo]);
  check('then the fight: guns on, it hunts', !B.gunsOff && boss.aggro === true && !G.levelTitle(B));
  const r = G.sceneAddRunner(B);
  check('a joining player: hidden while the pad charges', !!r && r.hide === true && L.joins.length === 1);
  for (let i = 0; i < Math.ceil(G.JOIN_CH * 30) + 2; i++) G.titleStep(B, 1 / 30);
  check('… then shows', r.hide === false && L.joins[0].done === true);
}

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

// the HUD's level panel: levelProgress 0 at the start, the share of the run to the arena, 1 from the arena on
{
  const P = G.levelScene(300, 5, 1, undefined, G.newRun(3).players, 1, G.newRun(3), true), PL = G.levelState(P);
  P.scroll = PL.plan.z0 - G.levelTeamX({ ...P, scroll: 0 }) - 50; PL.phase = 'run';
  check('progress 0 before the level', G.levelProgress(P) === 0, G.levelProgress(P));
  P.scroll += 50 + PL.plan.len * 0.4;
  check('progress 0.4 at 40%', Math.abs(G.levelProgress(P) - 0.4) < 1e-6, G.levelProgress(P));
  PL.phase = 'arena';
  check('progress 1 in the arena', G.levelProgress(P) === 1, G.levelProgress(P));
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
