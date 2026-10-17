// Coal Seams' bats (creatures/bats.js, the owner's rewrite spec; stepped by art/titlescene.js batsStep): spawners on the rock's
// underside, each releasing a group; HANGING, ROAMING, FLEEING, ATTACKING, RETURNING; never inside rock; the players shoot them;
// a hit sends the group fleeing; the Dev preview's cave steps cleanly and stays the same size. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
D.autoFoeDmg = 0;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const keep0 = { ...D };

// ---- a hand-made room: a flat roof at y 20, floor at 140, walls at ±200; a spawner on the roof ----
const solid = (x, y) => y < 20 || y >= 140 || x < -200 || x >= 200;
const far = [{ x: 0, y: 1e5 }];
const B = G.newBats(), sp = G.addSpawner(B, 0, 20, rnd);
G.stepBats(B, 1 / 60, far, solid, rnd);
check('a spawner releases batPerSpawn (min-max) bats', B.list.length >= D.batPerSpawnLo && B.list.length <= D.batPerSpawnHi, B.list.length);
check('… HANGING under the roof near it (within batHangDist)', B.list.every(b => b.st === 'hang' && b.y === 20 && Math.abs(b.x) <= D.batHangDistHi + 1e-9), B.list.map(b => Math.round(b.x)));

// roaming on its own: flies about within batRoamDist of the spawner, then RETURNS and hangs again; never inside rock
D.batRoamChance = 1e9; G.stepBats(B, 1 / 60, far, solid, rnd); D.batRoamChance = 0;
check('HANGING → ROAMING (its chance)', B.list.every(b => b.st === 'roam'), B.list.map(b => b.st));
const seen = new Set(); let inRock = 0, out = 0, back = -1, ys = [];
for (let i = 0; i < 60 * 30; i++) {
  G.stepBats(B, 1 / 60, far, solid, rnd);
  for (const b of B.list) { seen.add(b.st); if (solid(b.x, b.y)) inRock++; if (b.st === 'roam' && Math.hypot(b.tx - sp.x, b.ty - sp.y) > D.batRoamDistHi + 5) out++; }
  if (i < 60) ys.push(B.list[0].y - B.list[0].by);
  if (B.list.every(b => b.st === 'hang') && i > 60) { back = i / 60; break; }
}
check('… then RETURNING, then HANGING again (all, within flight max + returning max)', back > 0 && back < D.batFlightHi + D.batReturnT, back);
check('… roam targets within batRoamDist of the spawner', out === 0, out);
check('… never inside rock', inRock === 0, inRock);
check('… bobbing while it flies', Math.max(...ys) - Math.min(...ys) > D.batBobLo, +(Math.max(...ys) - Math.min(...ys)).toFixed(2));

// a player near: FLEEING (faster), away from him; then ATTACKING him (a bite with batBite over 0); gone again, back to ROAMING
D.batBite = 1; D.batAttackChance = 3;
const P = [{ x: 0, y: 60 }];
let bites = 0, fled = false, attacked = false, awayOk = 0, awayN = 0;
for (let i = 0; i < 60 * 6; i++) {
  G.stepBats(B, 1 / 60, P, solid, rnd, () => { bites++; });
  for (const b of B.list) {
    if (b.st === 'flee') { fled = true; awayN++; if ((b.tx - b.bx) * (b.bx - P[0].x) + (b.ty - b.by) * (b.by - P[0].y) >= -1e-6 || Math.hypot(b.tx - b.bx, b.ty - b.by) < 3) awayOk++; }
    if (b.st === 'attack') attacked = true;
  }
}
check('a player near: they FLEE', fled);
check('… fleeing targets away from him (mostly: a fallback when none is)', awayOk / Math.max(1, awayN) > 0.8, +(awayOk / Math.max(1, awayN)).toFixed(2));
check('… and turn ATTACKING him', attacked);
check('… a bite when one reaches him', bites > 0, bites);
D.batBite = 0; bites = 0;
for (let i = 0; i < 60 * 3; i++) G.stepBats(B, 1 / 60, P, solid, rnd, () => { bites++; });
check('… bite 0 (the default): nobody hurt', bites === 0, bites);
D.batAttackChance = keep0.batAttackChance;
let calm = -1;
for (let i = 0; i < 60 * 6; i++) { G.stepBats(B, 1 / 60, far, solid, rnd); if (B.list.every(b => b.st === 'roam' || b.st === 'return' || b.st === 'hang')) { calm = i / 60; break; } }
check('… players gone: back to ROAMING after batCalm', calm >= 0 && calm < D.batCalmHi + 1, calm);
check('every state met: hang, roam, return, flee, attack', ['hang', 'roam', 'return', 'flee', 'attack'].every(s => seen.has(s) || (s === 'flee' && fled) || (s === 'attack' && attacked)));
// the buttons
G.BAT_CMD.scare = true; G.stepBats(B, 1 / 60, P, solid, rnd);
check('Scare all: every bat FLEEING', B.list.every(b => b.st === 'flee'));
G.BAT_CMD.reset = true; G.stepBats(B, 1 / 60, far, solid, rnd);
check('Reset bats: all hanging at their spots', B.list.every(b => b.st === 'hang' && b.y === 20));
D.batScare = 0; G.stepBats(B, 1 / 60, P, solid, rnd);
check('players-scare off: no fleeing', B.list.every(b => b.st === 'hang'));
Object.assign(D, keep0);

// ---- a Grem level at level 2 (Coal Seams): spawners made as it goes, each under rock ----
{
  const run = G.newRun(9);
  const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
  S.spawn = 1e9; S.foes.length = 0;
  let dist = 0; const sps = new Set();
  for (let i = 0; i < 2000 && S.scroll < L.plan.arena.x0 - 300; i++) {
    S.scroll += 3; dist += 3; G.titleStep(S, 1 / 60); S.foes.length = 0;
    for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
    for (const q of (S.bats && S.bats.spawners) || []) sps.add(q);
  }
  const per = sps.size / (dist / G.TITLE_VW);
  check('spawners in Coal Seams, about DEV.batSpawners a screen (within 40%)', Math.abs(per / D.batSpawners - 1) < 0.4, { n: sps.size, per: +per.toFixed(2) });
  const TC = G.TCELL, rock = (x, y) => !!G.TITLE_SOLID[G.titleCell(S, Math.floor(x / TC), Math.floor(y / TC))];
  const live = S.bats.spawners;
  check('… on a rock underside (rock over, air at it; burnt coal can open one later: 80%)', live.length > 0 && live.filter(q => rock(q.x, q.y - 1) && !rock(q.x, q.y + 0.5)).length >= live.length * 0.8, live.length);
  // the sandbox: the scene still, a player walked under a spawner: its bats flee; never into rock
  S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0; S.foes.length = 0;
  const q = live[live.length - 1], ru = S.runners[0];
  ru.out = false; ru.x = q.x - S.scroll - G.PW / 2; ru.y = q.y + 30;
  let hurt = 0; S.lvl.hurt = () => { hurt++; };
  let bad = 0; const mine = S.bats.list.filter(b => b.sp === q);
  const st = new Set();
  for (let i = 0; i < 240; i++) { G.titleStep(S, 1 / 60); for (const b of mine) { st.add(b.st); if (b.st !== 'hang' && rock(b.x, b.y)) bad++; } }
  check('in the level: a player near a spawner sends its bats FLEEING', st.has('flee'), [...st]);
  check('… flying bats never inside rock', bad === 0, bad);
  check('… bite 0 (the default): nobody hurt', D.batBite === 0 && hurt === 0, hurt);
}

// ---- they're enemies: a player shoots them; a hit sends the whole group FLEEING; a dead bat is gone ----
{
  D.batScare = 0; D.batRoamChance = 0; D.batHp = 3; D.batSpeedLo = D.batSpeedHi = 2;
  const run = G.newRun(3), pl = run.players[0];
  pl.guns[0] = G.resetGun({ name: 'm', cap: 3, castDelay: 0.2, recharge: 0.5, manaMax: 5000, manaRegen: 100, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 5000, slots: ['bolt', 'bolt', 'bolt'] });   // (a set gun: a run's random one may not reach)
  pl.active = 0;
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false; S.foes.length = 0;
  const r = S.runners[0]; r.hide = false;
  const bx = S.scroll + r.x + 50, by = r.y + 2;
  S.bats = G.newBats();
  const A = G.addSpawner(S.bats, bx, by, rnd), Bo = G.addSpawner(S.bats, bx + 400, by, rnd);
  for (const b of S.bats.list) { b.placed = true; b.st = 'roam'; b.t = 1e9; b.hx = b.bx = b.x = b.sp.x + (rnd() - 0.5) * 6; b.hy = b.by = b.y = by + (rnd() - 0.5) * 6; b.tx = b.bx; b.ty = b.by; }
  const n0 = S.bats.list.length;
  let t = 0, hit = null;
  for (; t < 10 && S.bats.list.length === n0; t += 1 / 60) {
    G.titleStep(S, 1 / 60);
    if (!hit) hit = S.bats.list.find(b => b.f && b.f.hp < D.batHp && b.f.hp > 0) || null;
    if (hit && !hit.checked) {
      hit.checked = true; G.titleStep(S, 1 / 60);
      check('a hit bat: its whole group FLEES', S.bats.list.filter(b => b.sp === A).every(b => b.st === 'flee' || b.st === 'attack'), S.bats.list.filter(b => b.sp === A).map(b => b.st));
      check("… the other group doesn't", S.bats.list.filter(b => b.sp === Bo).every(b => b.st === 'roam'));
    }
  }
  check('the player shoots the bats (one hit, then one killed)', !!hit && S.bats.list.length < n0, { t: +t.toFixed(2), n: S.bats.list.length, n0 });
  for (let i = 0; i < 3; i++) G.titleStep(S, 1 / 60);
  check('… a dead bat removed: out of its group and out of the foes', S.bats.list.every(b => !b.f || b.f.hp > 0) && S.foes.every(f => !f.bat || f.hp > 0));
  check('… the bats were the guns\' targets (stand-ins among the foes)', S.foes.some(f => f.bat));
  Object.assign(D, keep0);
}

// ---- the Dev preview's cave (batLab): steps cleanly, the walking player scares them, the state stays the same size ----
{
  const L = G.batLab(); let err = null, fled = 0, inR = 0;
  try {
    for (let i = 0; i < 60 * 12; i++) {
      G.batLabStep(L, 1 / 60, rnd);
      if (L.B.list.some(b => b.st === 'flee')) fled++;
      for (const b of L.B.list) if (b.st !== 'hang' && L.solid(b.x, b.y)) inR++;
    }
  } catch (e) { err = e.message; }
  check('Dev preview: steps without errors, two spawners', !err && L.B.spawners.length === 2, err || L.B.spawners.length);
  check('… the walking player scares them', fled > 0, fled);
  check('… no bat inside its rock', inR === 0, inR);
  const size = () => L.B.list.length + L.B.spawners.length;
  const s0 = size();
  for (let i = 0; i < 60 * 600; i++) G.batLabStep(L, 1 / 60, rnd);
  check('ten minutes on: the state the same size (the preview stays fast)', size() === s0, [s0, size()]);
  D.batPerSpawnLo = D.batPerSpawnHi = 30;
  try { for (let i = 0; i < 120; i++) G.batLabStep(L, 1 / 60, rnd); } catch (e) { err = e.message; }
  check('… a new group size: released afresh (30 a spawner)', !err && L.B.list.length === 60, err || L.B.list.length);
  Object.assign(D, keep0);
}
// (owner) the Bats knobs have no min / max
const rows = G.DEV_META.filter(m => m.g === 'bats');
check('Bats knobs: no min or max on any row', rows.length >= 30 && rows.every(m => m.min == null && m.max == null), rows.length);

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
