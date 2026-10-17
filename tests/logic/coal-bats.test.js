// Coal Seams' bats (grem, chunk C4a; creatures/bats.js, stepped by art/titlescene.js batsStep): roosts under rock, slots
// filling outwards alternating sides, a near player scares a roost into flight, they come back and re-roost, never inside
// rock, and a bite of 0 hurts nobody. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
D.autoFoeDmg = 0;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// slots: 0 the anchor, then 1, -1, 2, -2…
check('slots fill outwards, alternating sides', JSON.stringify([0, 1, 2, 3, 4, 5].map(G.slotOff)) === JSON.stringify([0, 1, -1, 2, -2, 3]));

// a hand-made room: a flat roof at y 20, floor at 140, walls at ±200
const solid = (x, y) => y < 20 || y >= 140 || x < -200 || x >= 200;
const B = G.newBats(), ro = G.addRoost(B, 0, 20, rnd, 134);
G.stepBats(B, 1 / 60, [], solid, rnd);
check('a roost of DEV.batsPerRoost bats', B.list.length === D.batsPerRoost, B.list.length);
const xs = B.list.map(b => b.x);
check('… hanging in their slots, slotSpacing apart, alternating sides', xs[1] === D.batSlotSpacing && xs[2] === -D.batSlotSpacing && xs[3] === 2 * D.batSlotSpacing, xs.slice(0, 5));
check('… under the roof (y 20)', B.list.every(b => b.y === 20 && b.st === 'roost'));

// a near player scares them off; away again, they fly a while, come back and re-roost
D.batTakeoff = 0;
const P = [{ x: 0, y: 70 }];
let inRock = 0, maxSp = 0;
G.stepBats(B, 1 / 60, P, solid, rnd);
check('a near player scares the roost into flight', B.list.filter(b => b.st === 'fly' && b.scared).length >= B.list.length - 2, B.list.map(b => b.st[0]).join(''));
for (let i = 0; i < 60; i++) G.stepBats(B, 1 / 60, P, solid, rnd);
const far = [{ x: 0, y: 1e5 }];
let back = -1;
for (let i = 0; i < 60 * 40; i++) {
  G.stepBats(B, 1 / 60, far, solid, rnd);
  for (const b of B.list) { if (solid(b.x, b.y)) inRock++; maxSp = Math.max(maxSp, Math.hypot(b.vx, b.vy)); }
  if (B.list.every(b => b.st === 'roost')) { back = i / 60; break; }
}
check('… they come back and re-roost (within flightMax + a few seconds)', back > 0 && back < D.batFlightMax + 6, back);
check('… each at its slot, no two sharing one', B.list.every(b => Math.abs(b.x - G.slotPos(ro, b.slot, solid).x) < 0.01 && b.y === 20) && new Set(B.list.map(b => b.slot)).size === B.list.length, B.list.map(b => b.slot));
check('… never inside rock', inRock === 0, inRock);
check('… never past maxSpeed', maxSp <= D.batMaxSpeed + 1e-6, Math.round(maxSp));
// flying as a flock: scared all (the button), a second on they stay together (cohesion) and apart (separation)
G.BAT_CMD.scare = true;
for (let i = 0; i < 90; i++) G.stepBats(B, 1 / 60, far, solid, rnd);
const fl = B.list.filter(b => b.st === 'fly');
let close = 0, mean = 0;
for (const a of fl) { let m = Infinity; for (const o of fl) if (o !== a) m = Math.min(m, Math.hypot(a.x - o.x, a.y - o.y)); mean += m; if (m < 1) close++; }
check('Scare all: every bat flying', fl.length === B.list.length, fl.length);
check('… a flock: nearest neighbour within perception, no two on top of each other', mean / fl.length < D.batPerception && close <= 1, { mean: +(mean / fl.length).toFixed(1), close });
G.BAT_CMD.reset = true; G.stepBats(B, 1 / 60, far, solid, rnd);
check('Reset bats: all back in their slots', B.list.every(b => b.st === 'roost' && b.y === 20));
// the toggle off: a near player doesn't scare them
D.batScare = 0; G.stepBats(B, 1 / 60, P, solid, rnd);
check('players-scare off: no take-off', B.list.every(b => b.st === 'roost'));
D.batScare = 1;

// a Grem level at level 2 (Coal Seams): roosts made as it goes, each under rock
const run = G.newRun(9);
const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
S.spawn = 1e9; S.foes.length = 0;
let dist = 0, roosts = new Set();
for (let i = 0; i < 2000 && S.scroll < L.plan.arena.x0 - 300; i++) {
  S.scroll += 3; dist += 3; G.titleStep(S, 1 / 60); S.foes.length = 0;
  for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
  for (const q of (S.bats && S.bats.roosts) || []) roosts.add(q);
}
const per = roosts.size / (dist / G.TITLE_VW);
check('roosts in Coal Seams, about DEV.batRoosts a screen (within 40%)', Math.abs(per / D.batRoosts - 1) < 0.4, { n: roosts.size, per: +per.toFixed(2) });
const TC = G.TCELL, rock = (x, y) => !!G.TITLE_SOLID[G.titleCell(S, Math.floor(x / TC), Math.floor(y / TC))];
const ro2 = [...roosts].filter(q => S.bats.roosts.includes(q));
check('… each anchored on a rock underside (rock over, air at it; burnt coal can open one later: 80%)', ro2.length > 0 && ro2.filter(q => rock(q.x, q.y - 1) && !rock(q.x, q.y + 0.5)).length >= ro2.length * 0.8, ro2.length);
// the sandbox: the scene still, a player walked under a roost: they fly, never into rock, and a bite of 0 hurts nobody
S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0; S.foes.length = 0;
const q = ro2[ro2.length - 1], ru = S.runners[0];
ru.out = false; ru.x = q.x - S.scroll - G.PW / 2; ru.y = q.y + 30;
let hurt = 0; S.lvl.hurt = () => { hurt++; };
let bad = 0;
const mine = S.bats.list.filter(b => b.ro === q);
for (let i = 0; i < 240; i++) { G.titleStep(S, 1 / 60); for (const b of mine) if (b.st !== 'roost' && rock(b.x, b.y)) bad++; }
check('in the level: a player under a roost scares its bats', mine.some(b => b.st === 'fly'), mine.map(b => b.st[0]).join(''));
check('… flying bats never inside rock', bad === 0, bad);
check('… bite 0 (the default): nobody hurt', D.batBite === 0 && hurt === 0, hurt);

// (owner) the Bats knobs have no min / max: a typed value past the old ranges stands (ui/devpanel.js DevRow clamps only rows that have them)
const DP = require('fs').readFileSync(require('path').join(__dirname, '../../src/ui/devpanel.js'), 'utf8');
const rows = G.DEV_META.filter(m => m.g === 'bats');
check('Bats knobs: no min or max on any row', rows.length >= 20 && rows.every(m => m.min == null && m.max == null), rows.filter(m => m.min != null || m.max != null).map(m => m.k));
check('… DevRow clamps only when a row has them', DP.includes('if (meta.min != null)') && DP.includes('if (meta.max != null)'));
// the Dev preview's cave (batLab): steps without errors, the walking player scares a roost, past-range knobs too
{
  const Lb = G.batLab(); let err = null, flew = 0, inR = 0;
  try { for (let i = 0; i < 60 * 12; i++) { G.batLabStep(Lb, 1 / 60, rnd); if (Lb.B.list.some(b => b.st === 'fly' && b.scared)) flew++; for (const b of Lb.B.list) if (b.st !== 'roost' && Lb.solid(b.x, b.y)) inR++; } } catch (e) { err = e.message; }
  check('Dev preview: steps without errors, two roosts', !err && Lb.B.roosts.length === 2, err || Lb.B.roosts.length);
  check('… the walking player scares them', flew > 0, flew);
  check('… no bat inside its rock', inR === 0, inR);
  const keep = { ...D }, n0 = Lb.B.list.length; D.batsPerRoost = 60; D.batMaxSpeed = 600; D.batScareR = 400;
  try { for (let i = 0; i < 120; i++) G.batLabStep(Lb, 1 / 60, rnd); } catch (e) { err = e.message; }
  check('… knobs past the old ranges: rebuilt (60 a roost: more, as many as the rock holds) and stepping', !err && Lb.B.list.length > n0 && Lb.B.list.every(b => isFinite(b.x) && isFinite(b.y)), err || Lb.B.list.length);
  Object.assign(D, keep);
}

// (owner, round 3) they're enemies: a player shoots them; a hit bat panics its whole roost; a dead bat is gone
{
  const keep = { ...D };
  D.batMaxSpeed = 2; D.batScare = 0; D.batTakeoff = 0; D.batHp = 3;
  const run = G.newRun(3), pl = run.players[0];
  pl.guns[0] = G.resetGun({ name: 'm', cap: 3, castDelay: 0.2, recharge: 0.5, manaMax: 5000, manaRegen: 100, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 5000, slots: ['bolt', 'bolt', 'bolt'] });   // (a set gun: a run's random one may not reach)
  pl.active = 0;
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false; S.foes.length = 0;
  const r = S.runners[0]; r.hide = false;
  const bx = S.scroll + r.x + 50, by = r.y + 2;
  S.bats = G.newBats();
  const A = G.addRoost(S.bats, bx, by, rnd), Bo = G.addRoost(S.bats, bx + 400, by, rnd);
  for (const b of S.bats.list) { b.placed = true; b.st = 'fly'; b.t = 1e9; b.x = b.ro.x + (rnd() - 0.5) * 6; b.y = by + (rnd() - 0.5) * 6; A.y0 = Bo.y0 = by - 10; A.y1 = Bo.y1 = by + 10; }
  const n0 = S.bats.list.length;
  let t = 0, hit = null;
  for (; t < 10 && S.bats.list.length === n0; t += 1 / 60) {
    G.titleStep(S, 1 / 60);
    if (!hit) hit = S.bats.list.find(b => b.f && b.f.hp < D.batHp && b.f.hp > 0) || null;
    if (hit && !hit.checked) {
      hit.checked = true; G.titleStep(S, 1 / 60);
      check('a hit bat: its whole roost panics (scared flight)', S.bats.list.filter(b => b.ro === A).every(b => b.st === 'fly' && b.scared && b.panic > 0));
      check("… the other roost doesn't", S.bats.list.filter(b => b.ro === Bo).every(b => !(b.panic > 0)));
    }
  }
  check('the player shoots the bats (one hit, then one killed)', !!hit && S.bats.list.length < n0, { t: +t.toFixed(2), n: S.bats.list.length, n0 });
  for (let i = 0; i < 3; i++) G.titleStep(S, 1 / 60);
  check('… a dead bat removed: out of the flock and out of the foes', S.bats.list.every(b => !b.f || b.f.hp > 0) && S.foes.every(f => !f.bat || f.hp > 0));
  check("… the bats were the guns' targets (stand-ins among the foes)", S.foes.some(f => f.bat));
  Object.assign(D, keep);
}

// (owner, round 4) twitchy flight, fewer wall hits, landing on free slots only
{
  // wall contacts (frames a bat is pushed back by rock) per bat-minute in flight, the Dev preview's cave, scared every 8 s:
  // 560 with round 3's flight (measured, same run), now well under it
  const L = G.batLab(); G.batLabStep(L, 1 / 60, rnd); let flyT = 0;
  for (let i = 0; i < 60 * 120; i++) { if (i % (60 * 8) === 0) G.BAT_CMD.scare = true; G.batLabStep(L, 1 / 60, rnd); flyT += L.B.list.filter(b => b.st !== 'roost').length / 60; }
  const per = (L.B.hits || 0) / (flyT / 60);
  check("wall contacts per bat-minute: far fewer than round 3's 560", per < 120, +per.toFixed(1));
  // the bob: a flying bat's height goes up and down with its wingbeats
  const b = L.B.list[0]; G.BAT_CMD.scare = true; const ys = [];
  for (let i = 0; i < 60; i++) { G.batLabStep(L, 1 / 60, rnd); ys.push(b.vy); }
  let ups = 0; for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] - G.DEV.batFlapLift * 0.5) ups++;
  check('… each wingbeat a lift (the bob): about flapRate a second', ups >= G.DEV.batFlapRate * 0.6, ups);
  // after a scare everyone is back on a slot of their own within flightMax + 10 s (the lab's bumpy roof and boulder)
  const D0 = G.DEV.batTakeoff; G.DEV.batTakeoff = 0;
  for (let i = 0; i < 400; i++) G.batLabStep(L, 1 / 60, rnd);   // (the player off the side)
  L.wait = 1e9; L.px = -1e4; G.BAT_CMD.scare = true;
  let back = -1;
  for (let i = 0; i < 60 * (G.DEV.batFlightMax + 10); i++) { G.batLabStep(L, 1 / 60, rnd); if (L.B.list.every(q => q.st === 'roost')) { back = i / 60; break; } }
  check('after a scare, all re-roost within flightMax + 10 s (never stuck)', back > 0, { back, st: L.B.list.map(q => q.st[0]).join('') });
  // (round 5) out in the open: flying time spent in the cave's open middle (y 35-70 of its 12-90), wings beating whenever not roosting
  G.BAT_CMD.scare = true; let mid = 0, all = 0, still = 0;
  for (let i = 0; i < 60 * 6; i++) {
    const fp = L.B.list.map(q => q.fp);
    G.batLabStep(L, 1 / 60, rnd);
    L.B.list.forEach((q, j) => { if (q.st !== 'roost') { all++; if (q.y > 35 && q.y < 70) mid++; if (q.fp === fp[j]) still++; } });
  }
  check('… flying, they range out into the open middle of the cave (over a third of the time)', mid / all > 0.33, +(mid / all).toFixed(2));
  check('… wings beating whenever not roosting (homing too)', still === 0, still);
  // state stays flat: ten simulated minutes of scares and returns, the roosts' slot lists and the flock don't grow
  const size = () => L.B.list.length + L.B.roosts.reduce((n, ro) => n + ro.n + ro.hy.length, 0);
  const s0 = size();
  for (let i = 0; i < 60 * 600; i++) { if (i % (60 * 7) === 0) G.BAT_CMD.scare = true; G.batLabStep(L, 1 / 60, rnd); }
  check('ten minutes on: the state the same size (the preview stays fast)', size() === s0, [s0, size()]);
  G.DEV.batTakeoff = D0;
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
