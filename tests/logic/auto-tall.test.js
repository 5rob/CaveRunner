// CaveRunner Auto's tall levels: a level made at the grown play area's height (about twice the old 190) runs from the
// start pad through the arena to the exit pad on the autopilot, the team inside the level all the way, the action band
// covering most of the height, the cave open over much of it (not a thin strip), and the pack camera (camPack) on the
// team inside the level.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
const VH = 400;

// the band: most of the height
const S0 = G.levelScene(VH, 21, 4, G.levelPlan(21, undefined, 0));
check('the band covers most of the tall level', S0.top <= 50 && S0.bot >= VH - 20 && (S0.bot - S0.top) / VH > 0.8, [S0.top, S0.bot]);
const S1 = G.levelScene(190, 21, 4, G.levelPlan(21, undefined, 0));
check('the old height\'s band is unchanged', Math.abs(S1.top - 190 * 0.24) < 1e-9 && Math.abs(S1.bot - 190 * 0.92) < 1e-9, [S1.top, S1.bot]);

// the cave fills the height: over the level, the open air's rows span much more than at the old height
/** @param {any} S */
const openSpan = S => {
  let lo = Infinity, hi = -Infinity;
  for (let x = 40; x < 1600; x += 8) {
    const c = G.titleCeil(x, S), f = G.titleFloor(x, S);
    lo = Math.min(lo, c); hi = Math.max(hi, f);
  }
  return [lo, hi];
};
const [lo, hi] = openSpan(S0), [lo1, hi1] = openSpan(S1);
check('roof and floor reach over most of the tall height', hi - lo > 0.6 * VH && lo >= 0 && hi <= VH, [lo, hi]);
check('… more than the old height did', hi - lo > 1.5 * (hi1 - lo1), [hi - lo, hi1 - lo1]);

// start → boss → exit on the autopilot, several seeds, inside the level
const keep = { m: D.autoLvlMin, b: D.autoLvlBossT };
D.autoLvlMin = 0.25; D.autoLvlBossT = 2;
const dt = 1 / 30, BUDGET = 90 * 30;
for (const seed of [11, 23, 37]) {
  const P = G.levelPlan(seed, undefined, 0), S = G.levelScene(VH, seed, 4, P), L = G.levelState(S);
  const C = G.titleCam(VH / 4, VH); C.pack = true; C.view = VH / 2;
  let f = 0, out = 0, offCam = 0, ys = [Infinity, -Infinity], arena = false;
  for (; f < BUDGET && !G.levelDone(S); f++) {
    G.titleStep(S, dt);
    G.camStep(C, S, dt);
    if (L.phase === 'arena') arena = true;
    for (const r of S.runners) {
      if (r.hide || r.out) continue;
      if (r.y < -2 || r.y + G.PH > VH + 2) out++;
      ys[0] = Math.min(ys[0], r.y); ys[1] = Math.max(ys[1], r.y);
      if (f > 150 && f % 15 === 0 && (r.y + G.PH < C.y - C.ay - 4 || r.y > C.y - C.ay + C.view + 4)) offCam++;
    }
  }
  check(`seed ${seed}: pad → arena → exit at vh ${VH}`, G.levelDone(S) && arena, [f, L.phase]);
  check(`seed ${seed}: the team stayed inside the level`, out === 0, out);
  check(`seed ${seed}: the pack camera kept them in view (half-height view)`, offCam < 10, offCam);
  check(`seed ${seed}: the camera inside the level`, C.y - C.ay >= -0.01 && C.y - C.ay + C.view <= VH + 0.01, [C.y, C.ay]);
  console.log(`  seed ${seed}: team y ${ys.map(v => v.toFixed(0)).join('..')}`);
}
D.autoLvlMin = keep.m; D.autoLvlBossT = keep.b;

// the caves follow the curving zones (DEV.autoZoneOpen): plants hang from rock (titleRoof), not from carved air, and they
// follow the zone the roof looks like (some stand where the zone by x is another)
{
  const S = G.levelScene(VH, 23, 4, G.levelPlan(23, undefined, 0));
  for (let i = 0; i < 300; i++) { S.scroll += 4; G.titleStep(S, 1 / 30); }
  const hung = S.props.filter(p => p.k === 'climb' && !p.host && !p.arc && !p.gone && !p.drop && p.ac >= S.gen - S.ncol);
  const loose = hung.filter(p => !G.TITLE_SOLID[G.titleCell(S, p.ac, p.ar)]);
  check('every hanging plant hangs from rock', hung.length > 6 && loose.length === 0, [hung.length, loose.length]);
  const moved = hung.filter(p => G.titleZoneSpan(p.ox, S).z !== G.titleZoneLook(p.ox, p.y + 1, S).z);
  check('… some where the zone by x is another (they follow the curves)', moved.length > 0, moved.length);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
