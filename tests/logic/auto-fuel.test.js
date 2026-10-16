// CaveRunner Auto's jet fuel (src/auto/fuel.js; art/titlescene.js flyStep / ctlStep / jetOver; owner, exo "Jetpack"):
// jetting drains the tank, dry means no thrust till it's back to FUEL_RESTART, the ground refills it, the exo Jetpack
// makes the tank last longer and refill faster; a hand-steered player can't jet dry; the autopilot still gets over a low
// wall, even starting with a near-empty tank (it waits at the wall and refills). Every loop has a frame cap.
const G = require('../load');
G.DEV.autoWallMin = G.DEV.autoWallMax = 0;
G.DEV.autoFoeDmg = 0;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const dt = 1 / 60;

// ---- the pure tank ----
{
  const r = {};
  G.fuelTick(r, 1, false, 1);
  check('jetting drains (full throttle: FUEL_DRAIN a second)', Math.abs(r.fuel - (1 - G.FUEL_DRAIN)) < 1e-9, r.fuel);
  let n = 0;
  while (!r.empty && n++ < 10000) G.fuelTick(r, 1, false, dt);
  check('… till it runs dry', r.empty && r.fuel === 0 && !G.fuelCan(r), [r.fuel, n]);
  G.fuelTick(r, 1, false, 0.5);
  check('dry: jetting drains nothing more (no thrust)', r.fuel === 0 && r.empty);
  G.fuelTick(r, 0, false, 1);
  check('in the air, off: no refill', r.fuel === 0);
  n = 0;
  while (r.fuel < G.FUEL_RESTART - 0.02 && n++ < 10000) { G.fuelTick(r, 1, true, dt); }
  check('on the ground it refills, but still no thrust below FUEL_RESTART', r.fuel > 0 && r.empty && !G.fuelCan(r), r.fuel);
  while (r.empty && n++ < 10000) G.fuelTick(r, 0, true, dt);
  check('… back at FUEL_RESTART it can jet again', !r.empty && r.fuel >= G.FUEL_RESTART - 1e-6, r.fuel);
  while (r.fuel < 1 && n++ < 10000) G.fuelTick(r, 0, true, dt);
  check('the ground fills it up to 1', r.fuel === 1);
}
// ---- the exo Jetpack: a longer tank, a faster refill ----
{
  const run = G.newRun(3), pl = run.players[0], P0 = G.playerStats(pl);
  const dryT = (tank, refill) => { const r = {}; let t = 0; while (!r.empty && t < 100) { G.fuelTick(r, 1, false, dt, tank, refill); t += dt; } return t; };
  const fillT = (tank, refill) => { const r = { fuel: 0 }; let t = 0; while (r.fuel < 1 && t < 100) { G.fuelTick(r, 0, true, dt, tank, refill); t += dt; } return t; };
  let prev = { d: dryT(P0.fuel, P0.refuel), f: fillT(P0.fuel, P0.refuel) };
  const rows = [[+prev.d.toFixed(2), +prev.f.toFixed(2)]];
  let ok = true;
  for (let tier = 1; tier <= 3; tier++) {
    pl.exo.jet[tier - 1] = G.exoMod('jet', tier);
    const P = G.playerStats(pl), cur = { d: dryT(P.fuel, P.refuel), f: fillT(P.fuel, P.refuel) };
    rows.push([+cur.d.toFixed(2), +cur.f.toFixed(2)]);
    if (!(cur.d > prev.d && cur.f < prev.f)) ok = false;
    prev = cur;
  }
  check('each exo Jetpack fitted: the tank lasts longer and refills faster ([dry s, fill s])', ok, rows);
  // and in the level scene the tank is the player's own
  const S = G.levelScene(190, 21, 1, G.levelPlan(21, 1, 0), [pl]);
  check('the level hands the scene the player\'s stats', S.lvl.fuel(S, S.runners[0]).fuel === G.playerStats(pl).fuel);
}
// ---- hand-steered: no thrust when dry ----
{
  const run = G.newRun(3);
  const S = G.levelScene(200, 7, 1, G.levelPlan(7, 1, 0), run.players.slice(0, 1)), r = S.runners[0];
  for (let i = 0; i < 180; i++) G.titleStep(S, dt);
  S.foes.length = 0; S.props.length = 0; S.webs.length = 0;   // (no vines or webs: dry, he would hang on one, auto/hang.js)
  G.levelControl(S, r.id, { active: true, nx: 0, ny: -1, mag: 1 });
  let f = 0, minFuel = 1, flew = false;
  for (; f < 60 * 12 && !r.empty; f++) { G.titleStep(S, dt); S.foes.length = 0; minFuel = Math.min(minFuel, r.fuel ?? 1); if (r.flame > 0.5) flew = true; }
  check('held up: he jets and the tank drains till dry', flew && r.empty, [f, r.fuel]);
  let thrust = 0, vyMax = -1e9;
  for (let i = 0; i < 20 && !r.ground; i++) { G.titleStep(S, dt); if (r.flame > 0) thrust++; vyMax = Math.max(vyMax, r.vy); }
  check('dry, stick still up: no flame, he falls', thrust === 0 && vyMax > 0, [thrust, vyMax]);
  for (let i = 0; i < 60 * 6 && !r.ground; i++) G.titleStep(S, dt);
  check('… down to the ground', r.ground);
  G.levelControl(S, r.id, { active: false, nx: 0, ny: 0, mag: 0 });
  const f0 = r.fuel;
  for (let i = 0; i < 60; i++) G.titleStep(S, dt);   // (v1.0.42: still steered at rest, he settles onto the floor a frame later)
  check('standing: it refills', r.fuel > f0 + 0.1, [f0, r.fuel, r.ground]);
}
// ---- the autopilot gets over a low wall (blocks.js 'brickwall', auto-blocked's case) ----
function wall(tank0) {
  const run = G.newRun(3), pl = run.players[0];
  const plan = G.levelPlan(21, 1, 0), Z = plan.zp.z[1];
  let k = 0;
  Z.blk = G.rollBlock(() => ((k++ * 0.37) % 1), Z, 'brickwall');
  Object.assign(Z.blk, { sev: 0.2, full: false });
  const S = G.levelScene(190, 21, 1, plan, [pl]), L = G.levelState(S), r = S.runners[0];
  S.foes.length = 0; L.elites.length = 0;
  let f = 0, lo = 1, waited = 0, set = false;
  for (; f < 60 * 50 && G.levelTeamX(S) < Z.blk.x1 + 30; f++) {
    if (!set && G.levelTeamX(S) > Z.blk.x0 - 25) { r.fuel = tank0; r.empty = tank0 <= 0; set = true; }
    G.titleStep(S, dt); S.foes.length = 0;
    lo = Math.min(lo, r.fuel ?? 1);
    if (S.fuelWait != null && S.t - S.fuelWait < dt * 1.5) waited++;
  }
  return { over: G.levelTeamX(S) >= Z.blk.x1 + 30, lo, waited, f, blocked: L.blocked };
}
{
  const a = wall(1);
  check('a normal tank: the autopilot gets over the low wall, using fuel', a.over && a.lo < 1, a);
  const b = wall(0.05);
  // (v1.0.56: since going round rock (navAround) he may walk over this low wall dry, no wait needed; a wait is fine too)
  check('nearly dry at the wall: still gets over, never blocked', b.over && !b.blocked, b);
}
// the cough is the old game's own (core/util.js sputterStep, owner): low and jetting it cuts out now and then
{
  const r = { fuel: 0.2, id: 0 };
  let cuts = 0, starts = 0, blocked = 0;
  for (let i = 0; i < 120; i++) {
    r.fuel = 0.2;
    G.fuelTick(r, 1, false, 1 / 60, 100, 1);
    if (r.jetSt && r.jetSt.cut > 0) cuts++;
    if (r.jetSt && r.jetSt.start) starts++;
    if (!G.fuelCan(r)) blocked++;
  }
  check('low and jetting: the old game\'s cough (sputterStep) cuts the jet now and then', starts > 0 && cuts > 0 && blocked === cuts && cuts < 120, { starts, cuts });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
