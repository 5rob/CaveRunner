// v125: the runner as a white astronaut with jointed limbs (art/sprites.js runnerPose, reach,
// ragPose), the ragdoll's elbows and second hand, the shop's high-tech shell (world/level.js
// shopPanel), the vending machines left to right, and the teleporter pads (render/pads.js).
const G = require('../load');
const { reach, runnerPose, ragPose, ragNew, ragStep, RAG_POSE, RAG_STICKS, RAG_BRACE, THIGH, SHIN, UPPER, FORE,
  shopPanel, makeLevel, themeFor, SHOPS, padSpots, CW, CELL, SHOP_TOP, SHOP_ROOF, SHOP_FLOOR } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- two-bone reach ----
{
  const a = { x: 0, y: 0 }, t = { x: 3, y: 4 };
  const r = reach(a, t, 3, 3, 1);
  check('reach keeps both bones their length', Math.abs(d(a, r.j) - 3) < 1e-6 && Math.abs(d(r.j, r.e) - 3) < 1e-6);
  check('and lands on a target in reach', d(r.e, t) < 0.02, r.e);
  const far = reach(a, { x: 100, y: 0 }, 3, 3, 1);
  check('a target out of reach: the limb points at it, nearly straight', Math.abs(far.e.y) < 1e-6 && far.e.x > 5.9 && far.e.x <= 6, far.e);
  const up = reach(a, t, 3, 3, 1).j, dn = reach(a, t, 3, 3, -1).j;
  check('bend picks the side it folds to', Math.sign((t.x - a.x) * (up.y - a.y) - (t.y - a.y) * (up.x - a.x)) !== Math.sign((t.x - a.x) * (dn.y - a.y) - (t.y - a.y) * (dn.x - a.x)));
}

// ---- the live pose ----
for (const face of [1, -1]) {
  const P = runnerPose(100, 50, 12, face, null, false);
  check(`standing (face ${face}): both feet on the ground`, P.ft.every(f => Math.abs(f.y - 71) < 0.01), P.ft);
  check(`knees fold forward, the way you face (face ${face})`, P.kn.every((k, i) => (k.x - (P.hp[i].x + P.ft[i].x) / 2) * face > 0.2), P.kn);
  check(`legs keep their length (face ${face})`, P.kn.every((k, i) => Math.abs(d(P.hp[i], k) - THIGH) < 1e-6 && Math.abs(d(k, P.ft[i]) - SHIN) < 0.05));
}
{
  const xs = [], lifted = [];
  for (let k = 0; k < 12; k++) {
    const P = runnerPose(100, 50, 12, 1, k * Math.PI / 6, false);
    xs.push(P.ft[1].x); lifted.push(P.ft.map(f => f.y < 70.9));
  }
  check('running: the feet swing back and forth', Math.max(...xs) - Math.min(...xs) > 5, [Math.min(...xs), Math.max(...xs)]);
  check('one foot lifts while the other is planted', lifted.every(([a, b]) => !(a && b)) && lifted.some(([a, b]) => a || b));
  const air = runnerPose(100, 50, 12, 1, null, true);
  check('in the air the legs tuck up', air.ft.every(f => f.y < 70.6), air.ft);
}
{
  const gun = { x: 110, y: 61 }, torch = { x: 100.5, y: 59 };
  const P = runnerPose(100, 50, 12, 1, null, false, { gun, torch });
  check('the near hand is on the gun', d(P.ha[1], gun) < 0.05, P.ha[1]);
  check('the far hand holds the torch', d(P.ha[0], { x: torch.x, y: torch.y + 1.5 }) < 0.05, P.ha[0]);
  check('arms keep their length', P.el.every((e, i) => Math.abs(d(P.sh[i], e) - UPPER) < 1e-6 && Math.abs(d(e, P.ha[i]) - FORE) < 0.05));
  check('elbows hang down, not up', P.el.every((e, i) => e.y >= Math.min(P.sh[i].y, P.ha[i].y) - 0.01), P.el);
}

// ---- the ragdoll: elbows and both hands ----
check('the ragdoll has eleven joints and its braces come last', RAG_POSE.length === 11 && RAG_STICKS.length === RAG_BRACE + 2);
check('every joint is on a stick', RAG_POSE.every((_, i) => RAG_STICKS.some(s => s.includes(i))));
{
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const R = ragNew(100, 78, 12, 1, 0, 0, rnd);
  for (let i = 0; i < 180; i++) ragStep(R, 1 / 60, (x, y) => y >= 100);
  const P = ragPose(R);
  check('the corpse\'s pose has both arms and legs', P.el.length === 2 && P.ha.length === 2 && P.kn.length === 2 && P.ft.length === 2 && P.ha[0] !== P.ha[1]);
  const arms = RAG_STICKS.slice(6, 10).map(([a, b], k) => Math.abs(d(R.joints[a], R.joints[b]) / R.len[6 + k] - 1));
  check('the arms hold together', Math.max(...arms) < 0.25, arms);
  const old = { face: 1, joints: R.joints.slice(0, 8) };
  const Q = ragPose(old);
  check('an old 8-joint replay still gets a whole body', Q.el.every(Boolean) && Q.ha.every(Boolean));
}

// ---- the shop: steel, not the floor's brick ----
{
  const top = SHOP_TOP - SHOP_ROOF;
  check('ceiling lights along the roof\'s underside', [0, 5, 10].every(x => shopPanel(x + 16, SHOP_TOP - 1)[2] > 200) && shopPanel(12, SHOP_TOP - 1)[2] < 100);
  for (const floor of [1, 4, 7]) {
    const lv = makeLevel(77 + floor, floor), T = themeFor(floor), dd = lv.img.data;
    let brick = 0, n = 0;
    for (const cy of [top + 1, top + 3, SHOP_FLOOR + 2]) for (let cx = 10; cx < CW - 10; cx += 7) {
      const i = (cy * CW + cx) * 4;
      if (!lv.mat[cy * CW + cx]) continue;
      n++;
      const c = [dd[i], dd[i + 1], dd[i + 2]];
      // the theme's brick has red over blue; the steel is blue-grey
      if (c[0] > c[2] + 8) brick++;
    }
    check(`floor ${floor}: the shop's roof and floor are steel, not ${T.name || 'the theme'}'s brick`, n > 100 && brick === 0, { n, brick });
  }
}

// ---- letting go of a web line or arched vine (lineLetGo): any push off it, or past its end ----
{
  const { lineLetGo } = G;
  check('a level line: pushing down or up lets go, along it does not', lineLetGo(0, 1, 1, 1, 0, false, false) && lineLetGo(0, -1, 1, 1, 0, false, false) && !lineLetGo(1, 0, 1, 1, 0, false, false));
  check('an upright line: pushing sideways lets go (it used to hold you)', lineLetGo(1, 0, 1, 0, 1, false, false) && lineLetGo(-1, 0, 1, 0, 1, false, false));
  check('a slanted line: a push close to along it slides', !lineLetGo(Math.SQRT1_2, Math.SQRT1_2, 1, Math.cos(0.6), Math.sin(0.6), false, false));
  check('at the end of a line, pushing on past it lets go; back along it does not', lineLetGo(1, 0, 1, 1, 0, false, true) && !lineLetGo(-1, 0, 1, 1, 0, false, true));
  check('at the start likewise', lineLetGo(-1, 0, 1, 1, 0, true, false) && !lineLetGo(1, 0, 1, 1, 0, true, false));
  check('a light touch on the stick never lets go', !lineLetGo(1, 0, 0.3, 0, 1, true, true));
}

// ---- the vending machines, left to right: mods, guns, perks ----
check('vending machines run mods, guns, perks left to right', SHOPS.mods.x < SHOPS.guns.x && SHOPS.guns.x < SHOPS.perks.x, [SHOPS.mods.x, SHOPS.guns.x, SHOPS.perks.x]);

// ---- the teleporter pads: the way in on the shop floor, the exit under its portal, only with a level ----
{
  const W = { arrival: { x: 34, y: 100 }, portal: { x: 630, y: 38, w: 20, h: 30 }, hasLvl: true };
  const P = padSpots(W);
  check('two pads with a level: the way in on the shop floor, the exit under its portal',
    P.length === 2 && P[0].x === 34 && P[0].y === SHOP_FLOOR * CELL && P[1].x === 640 && P[1].y === 68, P);
  check('no exit pad while there is no level', padSpots(Object.assign({}, W, { hasLvl: false })).length === 1);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
