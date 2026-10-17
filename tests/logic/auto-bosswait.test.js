// (owner, v2.0.16) Grem: the boss is already waiting in its arena as the team comes into view of it: made at the arena's
// middle while the level is still running, still, not aimed at, holding its fire; the arena starts → its title, then it hunts.
// Also: the boss's size (DEV.autoBossSize) and the elites' bodies at their kind's size (drawn bigger, k.rd)
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
D.autoLvlMin = 0.25; D.autoLvlBossT = 600; D.autoFoeElites = 0;
const run = G.newRun(6);
run.players[0].guns[1] = { name: 'd', cap: 1, castDelay: 0.2, recharge: 0.5, manaMax: 200, manaRegen: 60, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 200, slots: ['saw'] };
const S = G.levelScene(190, 24, 1, undefined, run.players, 1, run, true), L = G.levelState(S);
let seenAt = null, hp0 = 0, moved = 0;
for (let i = 0; i < 9000 && L.phase !== 'arena'; i++) {
  G.titleStep(S, dt);
  const B = L.boss;
  if (B && seenAt === null) { seenAt = { scr: Math.round(L.plan.arena.mid - S.scroll), x: B.x }; hp0 = B.hp; }
  if (B && L.phase === 'run') moved = Math.max(moved, Math.abs(B.x - seenAt.x));
}
check('the boss is made before the arena starts (v2.0.17: the fight starts at its edge)', !!seenAt && seenAt.scr < G.TITLE_VW + 201, seenAt);
const wx = Math.min(L.plan.arena.x1 - 30, L.plan.arena.mid - G.LVL_TEAM + G.TITLE_VW * D.gremBossAt);
check('it waits on the arena\'s right, gremBossAt across the stopped screen (v2.0.17)', !!seenAt && Math.abs(seenAt.x - wx) < 1 && wx > L.plan.arena.mid, [seenAt && seenAt.x, wx, L.plan.arena.mid]);
check('facing left, toward the team', L.boss.lx === -1 && (!L.boss.sp || L.boss.sp.side === -1), [L.boss.lx, L.boss.sp && L.boss.sp.side]);
check('nobody shot it while it waited', !!L.boss && L.boss.hp === hp0, [L.boss && L.boss.hp, hp0]);
check('it stayed near its place', moved < 40, Math.round(moved));
check('the arena: it stops waiting, its title starts', L.phase === 'arena' && (G.titleStep(S, dt), !L.boss.waiting && L.introT != null));
let i = 0;
while (i++ < 400 && !L.boss.aggro) G.titleStep(S, dt);
check('then it hunts', L.boss.aggro === true);
// sizes
const k = G.autoFoe(G.TITLE_KINDS[0], 1), e = G.eliteOf(k, 1);
check('an elite\'s body is its kind\'s size, drawn bigger', e.r === k.r && e.rd > k.r, [e.r, e.rd, k.r]);
check('boss size ≈ 2/3 of the old 4', D.autoBossSize <= 2.7, D.autoBossSize);
// Dev ⏭ (owner v2.0.16): a fresh level still holds its chests', elites' and boss's gold
D.autoFoeElites = 2;
const S2 = G.levelScene(190, 31, 1, undefined, G.newRun(3).players, 2, null, true), L2 = G.levelState(S2), g2 = G.levelSkipGold(S2);
check('skip gold counts chests, elites, boss', g2 > 0 && L2.chests.length > 0, [g2, L2.chests.length, L2.elites.length]);
L2.chests.forEach(c => { c.open = true; }); L2.elites.forEach(e => { e.alive = false; }); L2.bossDead = true;
check('nothing left: 0', G.levelSkipGold(S2) === 0, G.levelSkipGold(S2));
// (owner v2.0.18) level 1's arena, the next level (Coal Seams, bats) past it: no bat in the arena, all the way to the kill
{
  const r5 = G.newRun(9), S5 = G.levelScene(190, 9, 1, undefined, r5.players, 1, r5, true), L5 = G.levelState(S5);
  let inA = 0, bats = 0;
  for (let i = 0; i < 30 * 90 && L5.phase !== 'cleared'; i++) {
    G.titleStep(S5, dt);
    if (L5.boss && L5.introDone) L5.boss.hp = Math.min(L5.boss.hp, 1);
    const B = S5.bats; if (!B) continue;
    bats = Math.max(bats, B.list.length);
    inA += B.list.filter(b => !b.gone && b.x > L5.plan.arena.x0 && b.x < L5.plan.arena.x1).length;
  }
  check('no bats in the boss arena (the next level kept out)', inA === 0, { inA, bats });
}
// (owner v2.0.19: the team flew past the arena and fought from the next level) the fight inside the arena: the screen stops
// with its right edge at the arena's, the boss kept in it, and the next level's look DEV.gremArenaGap past it
for (const seed of [9, 24]) {
  const r6 = G.newRun(seed), S6 = G.levelScene(190, seed, 1, undefined, r6.players, 1, r6, true), L6 = G.levelState(S6);
  let A6 = null, scr = -1e9, pl = -1e9, bo = [1e9, -1e9], nx = 0;
  for (let i = 0; i < 30 * 200 && !(A6 && L6.phase !== 'arena'); i++) {
    G.titleStep(S6, dt);
    if (L6.phase !== 'arena') continue;
    A6 = A6 || Object.assign({}, L6.plan.arena); nx = L6.plan.nextX || 0;
    scr = Math.max(scr, S6.scroll + G.TITLE_VW);
    for (const r of S6.runners) pl = Math.max(pl, S6.scroll + r.x);
    if (L6.boss) bo = [Math.min(bo[0], L6.boss.x), Math.max(bo[1], L6.boss.x)];
  }
  check(`seed ${seed}: the screen stays in the arena, the team and boss too`, !!A6 && scr <= A6.x1 + 0.5 && pl <= A6.x1 && bo[0] >= A6.x0 && bo[1] <= A6.x1, A6 && [scr - A6.x1, pl - A6.x1, bo[0] - A6.x0, bo[1] - A6.x1].map(Math.round));
  check(`seed ${seed}: the next level begins gremArenaGap past it`, !!A6 && Math.abs(nx - A6.x1 - D.gremArenaGap) < 0.5 && S6.looks.some(l => Math.abs(l.x0 - nx) < 0.5), [nx, A6 && A6.x1]);
}
process.exit(fails ? 1 : 0);
