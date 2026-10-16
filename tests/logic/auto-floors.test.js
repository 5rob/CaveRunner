// CaveRunner Auto's old floors (v1.0.97, src/auto/maps.js levelLook): level 1 is today's Mossy Caves level (no theme, no
// roster: the zones' own creatures); from level 2 the levels cycle the old game's floors 2..12 (Coal Seams … Void Hollow),
// each with its palette (S.theme) and its creatures (S.roster = ROSTERS, as the old game's floors). The old classic
// creatures (shooters, turrets, chasers, bombers) come in, act and hurt the team. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, e: D.autoFoeElites, d: D.autoFoeDmg, b: D.autoLvlBossT };
D.autoLvlMin = 0.5; D.autoLvlBossT = 600;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

// ---- which floor a level plays as ----
check('level 1 is floor 1, level 2 floor 2 … level 12 floor 12', G.levelFloor(1) === 1 && G.levelFloor(2) === 2 && G.levelFloor(12) === 12);
check('then round again from floor 2 (floor 1 only once)', G.levelFloor(13) === 2 && G.levelFloor(14) === 3 && G.levelFloor(24) === 2, [G.levelFloor(13), G.levelFloor(24)]);
check('floor 2 is the old Coal Seams', G.floorName(2) === 'Coal Seams' && G.floorName(1) === 'Mossy Caves' && G.floorName(3) === 'Frozen Deep');

const run = G.newRun(4);
const at = lv => { run.maps[0].level = lv; G.syncTier(run); return G.levelLook(run, 77); };
const l1 = at(1);
check('level 1: no roster (the zones decide, unchanged)', l1.floor === 1 && l1.roster === null);
for (let lv = 2; lv <= 11; lv++) {
  const L = at(lv), f = G.levelFloor(lv);
  if (f <= 10 && JSON.stringify(L.roster) !== JSON.stringify(G.ROSTERS[f - 1])) check('level ' + lv + ': floor ' + f + '\'s roster', false, L.roster);
}
check('levels 2-10: the old floors\' fixed rosters', true);
const l11 = at(12);
check('floor 12: a roster rolled off the seed, the same each time', l11.roster.length >= 2 && JSON.stringify(l11.roster) === JSON.stringify(G.levelLook(run, 77).roster), l11.roster);
check('each floor its own palette', at(4).theme === G.THEMES[3] && at(2).theme === G.THEMES[1]);

// ---- in a level ----
D.autoFoeElites = 0;
run.maps[0].level = 1; G.syncTier(run);
const S1 = G.levelScene(190, 31, 1, undefined, run.players, run.tier, run);
check('level 1\'s scene: no theme, no roster', !S1.theme && !S1.roster);
const L1 = G.levelState(S1);
check('… named Mossy Caves', L1.floor === 1 && L1.name === 'Mossy Caves');

run.maps[0].level = 4; G.syncTier(run);   // floor 4: hiisi, mato, lima, kobold
const S = G.levelScene(190, 31, 1, undefined, run.players, run.tier, run);
check('level 4\'s scene: Ember halls\'s palette, floor 4\'s roster', S.theme === G.THEMES[3] && JSON.stringify(S.roster) === JSON.stringify(G.ROSTERS[3]), S.roster);
run.players[0].hp = 1e6;   // (kept alive: the checks below need him)
const seen = new Set();
until(S, s => { for (const f of s.foes) seen.add(f.k.id); return seen.size >= 3; }, 3600);
check('its creatures come in, only off its roster', seen.size >= 2 && [...seen].every(id => G.ROSTERS[3].includes(id)), [...seen]);

// a shooter fires at him and hurts him (a Hiisi in the air in front of him, sight clear)
const r0 = S.runners[0], pl = run.players[0];
S.foes.length = 0; S.shots = S.shots.filter(s => !s.foe);
pl.hp = 1e6; D.autoFoeDmg = 1;
const sky = (S.top + S.bot) / 2;
const hi = G.titleFoeAt(S, G.autoFoe('hiisi', 1), S.scroll + r0.x + 40);
hi.y = hi.ty = hi.hy = Math.min(sky, r0.y); hi.hp = hi.hpMax = 1e6; hi.cd = 0;
const hp0 = pl.hp;
check('a Hiisi shoots a ball at him', until(S, s => s.shots.some(b => b.foe && b.look === 'ball'), 300) >= 0);
check('… and it hurts', until(S, () => pl.hp < hp0, 300) >= 0, [hp0, pl.hp]);
// a chaser comes at him
S.foes.length = 0;
const ko = G.titleFoeAt(S, G.autoFoe('kobold', 1), S.scroll + r0.x + 70);
ko.hp = ko.hpMax = 1e6;
const d0 = Math.hypot(ko.x - (S.scroll + r0.x), ko.y - r0.y), hp1 = pl.hp;
check('a Kobold hunts him down and bites', until(S, () => pl.hp < hp1, 600) >= 0, [d0]);
// a bomber bursts on him and is gone
S.foes.length = 0;
const li = G.titleFoeAt(S, G.autoFoe('lima', 1), S.scroll + r0.x + 60);
li.hp = li.hpMax = 1e6;
const hp2 = pl.hp;
check('a Limanuljaska comes at him, bursts, and is gone', until(S, s => !s.foes.includes(li), 600) >= 0 && pl.hp < hp2, [hp2, pl.hp]);

Object.assign(D, { autoLvlMin: keep.m, autoFoeElites: keep.e, autoFoeDmg: keep.d, autoLvlBossT: keep.b });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
