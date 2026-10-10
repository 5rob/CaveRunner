// CaveRunner Auto's enemies (src/auto/enemies.js, AUTOBATTLER.md stage 6 part 1): creatures scaled by the run's tier,
// creatures hurting the run's players (a fall, everyone fallen → home with the tier unchanged), the elites (placed,
// in, slowing the pilot, marked dead) and the arena's boss (in when the team gets there, scaled, killed by the team's
// real guns → bossDead). Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, e: D.autoFoeElites, d: D.autoFoeDmg, b: D.autoLvlBossT };
D.autoLvlMin = 0.25; D.autoLvlBossT = 600;
/** steps S until done(S) or cap frames; the frames it took (cap: never) */
// a Buzzsaw gun in slot 2 (a team of starters is blocked at the first wall: auto/clear.js)
const digger = r => { r.players[0].guns[1] = { name: 'd', cap: 1, castDelay: 0.2, recharge: 0.5, manaMax: 200, manaRegen: 60, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 200, slots: ['saw'] }; return r.players; };
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

// ---- tier scaling ----
D.autoFoeElites = 0;
const run = G.newRun(3);
const S = G.levelScene(190, 21, 1, G.levelPlan(21), run.players, 6);
check('the scene knows the tier', S.tier === 6);
until(S, s => s.foes.length > 0, 900);
const f0 = S.foes.find(f => !f.k.elite && !f.k.boss);
check('a creature came in', !!f0);
if (f0) check('it has its kind\'s tier-6 health and damage', f0.hpMax === G.enemyFor(f0.k.id, 6).hp && f0.k.dmg === G.enemyFor(f0.k.id, 6).dmg,
  [f0.hpMax, G.enemyFor(f0.k.id, 6).hp, G.enemyFor(f0.k.id, 1).hp]);
const Sm = G.titleScene(190, 21);
until(Sm, s => s.foes.length > 0, 600);
check('the menu stays at floor 1', Sm.foes.length > 0 && Sm.foes[0].hpMax === G.enemyFor(Sm.foes[0].k.id, 1).hp);

// ---- creatures hurt the players ----
const pl = run.players[0], L = G.levelState(S), hp0 = pl.hp;
D.autoFoeDmg = 0.5;
S.lvl.hurt(S, 0, 10);
check('a hit takes its damage × autoFoeDmg off the real hp', Math.abs(pl.hp - (hp0 - 5)) < 1e-9, pl.hp);
G.titleStep(S, dt);
check('… and the health meter reads it', G.meterValues(L.meters[0].hp).slice(-1)[0] === pl.hp);
// a real bite: a hunting rat put right on him
const r0 = S.runners[0], hp1 = pl.hp;
const rat = G.titleFoeAt(S, G.enemyFor('rotta', 1), S.scroll + r0.x + G.PW / 2 + 2);
rat.aggro = true; rat.hp = rat.hpMax = 9999;
check('a creature bites him for real', until(S, () => pl.hp < hp1, 600) >= 0, [hp1, pl.hp]);
// the fall
S.lvl.hurt(S, 0, 1e6);
check('at 0 hp he falls: out, not alive', pl.hp === 0 && pl.alive === false && r0.out === true);
const seen = new Set();
for (let i = 0; i < 12; i++) { G.titleStep(S, dt); seen.add(!!r0.hide); }
check('the teleport-out flicker (hidden and shown)', seen.has(true) && seen.has(false));
until(S, () => false, 30);
check('then hidden for good', r0.hide === true);
check('one player, fallen: the level is lost', G.levelLost(S) && G.allFallen(S));
const tier0 = run.tier;
G.levelFailed(run);
check('levelFailed: home, tier unchanged, healed and alive', run.tier === tier0 && pl.alive && pl.hp === G.playerStats(pl).maxHp);
// two players: one falls, the level goes on
const run2 = G.newRun(4); G.addPlayer(run2) || run2.players.push(G.newPlayer(1));
const S2 = G.levelScene(190, 22, 2, G.levelPlan(22), run2.players, 1);
until(S2, s => G.levelState(s).phase === 'run', 300);
S2.lvl.hurt(S2, 1, 1e6);
G.titleStep(S2, dt);
check('one of two fallen: not lost', run2.players[1].alive === false && !G.levelLost(S2) && run2.players[0].alive);

// ---- elites ----
D.autoFoeElites = 2;
const run3 = G.newRun(5);
const S3 = G.levelScene(190, 23, 1, G.levelPlan(23), digger(run3), 2), L3 = G.levelState(S3);
check('two elites planned along the zones, alive', L3.elites.length === 2 && L3.elites.every(e => e.alive && e.x > L3.plan.z0 && e.x < L3.plan.z1),
  L3.elites.map(e => Math.round(e.x)));
D.autoFoeDmg = 0;
check('the first elite comes in', until(S3, () => !!L3.elites[0].f, 4000) >= 0);
const E = L3.elites[0].f;
if (E) {
  const base = G.enemyFor(E.k.id, 2);
  check('it\'s an elite of its tier: tougher, tinted', E.k.elite === true && E.hpMax >= base.hp && E.k.col.a !== base.col.a, [E.hpMax, base.hp]);
  check('the pilot slows near it', G.pilotPace({ x: L3.elites[0].x, elites: L3.elites }) < G.pilotPace({ x: L3.elites[0].x, elites: [] }));
  E.hp = 0;
  G.titleStep(S3, dt);
  check('killed: marked dead, the pilot doesn\'t slow', L3.elites[0].alive === false
    && G.pilotPace({ x: L3.elites[0].x, elites: L3.elites }) === G.pilotPace({ x: L3.elites[0].x, elites: [] }));
}

// ---- the boss ----
D.autoFoeElites = 0;
const run4 = G.newRun(6);
const S4 = G.levelScene(190, 24, 1, G.levelPlan(24), digger(run4), 3), L4 = G.levelState(S4);
check('the team reaches the arena', until(S4, () => L4.phase === 'arena', 6000) >= 0, [L4.phase, Math.round(G.levelTeamX(S4)), Math.round(L4.plan.arena.mid)]);
G.titleStep(S4, dt);
const B = L4.boss;
check('the boss comes in, hunting', !!B && B.aggro === true && S4.foes.includes(B));
if (B) {
  const base = G.enemyFor(B.k.id, 3);
  check('scaled: size ×4, health ×12, damage ×3', Math.abs(B.r - base.r * D.autoBossSize) < 1e-9 && B.hpMax === Math.round(base.hp * D.autoBossHp)
    && B.k.dmg === Math.round(base.dmg * D.autoBossDmg), [B.k.id, B.r, B.hpMax, B.k.dmg]);
  check('its kind is the floor\'s', G.TITLE_KINDS.includes(B.k.id));
  const bar = G.levelBoss(S4);
  check('the bar reads it', !!bar && bar.max === B.hpMax && bar.hp === B.hp);
  B.hp = Math.min(B.hp, 6);
  check('the team\'s real guns kill it', until(S4, () => L4.bossDead, 1800) >= 0, [B.hp, Math.round(B.x - S4.scroll), Math.round(B.ty)]);
  check('… bossDead, the bar gone, the team moves on', L4.bossDead && G.levelBoss(S4) === null && until(S4, () => L4.phase !== 'arena', 5) >= 0);
}

D.autoLvlMin = keep.m; D.autoFoeElites = keep.e; D.autoFoeDmg = keep.d; D.autoLvlBossT = keep.b;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
