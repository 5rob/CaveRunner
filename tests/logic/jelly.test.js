// The jellyfish (Myrkkymeduusa) swims in pulses: a push along its head, drag bleeding the
// speed off, a turn-rate limit on the head, and a bell that is thin at speed and flat at
// rest. jellyStep is pure, so it runs here on hand-made grids and is measured, not trusted.
// Also covers the shared movement pieces it is built from (roamStep, turnToward, flyMove).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { jellyStep, jellyBell, roamStep, turnToward, flyMove, JELLY, CELL, CW, CH, CREATURES, enemyFor, DEV, DEV_META, DEV_GROUPS, JE_KNOBS, kr, kru, makeLevel, rosterFor, segHitsBox, tentacleTouch, JE_COLS, jellyPal, hexMix, hexRgb, kcol, DEV_DEFAULTS, hsvAdjust, jcol };')({ createElement: () => {} });
const { jellyStep, jellyBell, roamStep, turnToward, flyMove, JELLY, CELL, CW, CH, CREATURES, enemyFor, DEV, DEV_META, DEV_GROUPS, JE_KNOBS, kr, kru, makeLevel, segHitsBox, tentacleTouch, JE_COLS, jellyPal, hexMix, hexRgb, kcol, DEV_DEFAULTS, hsvAdjust, jcol } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const mkRnd = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function grid(W, H, fill) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = fill(x, y) ? 1 : 0;
  const solidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= W || cy >= H || m[cy * W + cx] !== 0;
  return { m, solidCell, W, H };
}
const inRock = (g, x, y) => g.solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
const jelly = (x, y) => ({ x, y, hx: x, hy: y, r: 9 });
const DT = 1 / 60;
// a big open box, 600 x 600 world units, rock round the edge
const box = grid(300, 300, (x, y) => x < 4 || y < 4 || x >= 296 || y >= 296);

// ---- the knobs ----
check('every jelly knob is a min/max pair in the Jellyfish group', JE_KNOBS.every(([k]) =>
  DEV_META.some(m => m.k === k + 'Lo' && m.g === 'jelly') && DEV_META.some(m => m.k === k + 'Hi' && m.g === 'jelly')));
check('and the group is on the Dev panel', DEV_GROUPS.some(g => g[0] === 'jelly'));
{
  const rolls = Array.from({ length: 300 }, () => kr('jeHuntPush'));
  check('a roll lands between its min and max, and varies', rolls.every(v => v >= DEV.jeHuntPushLo && v <= DEV.jeHuntPushHi) &&
    new Set(rolls.map(v => v.toFixed(3))).size > 50);
  check('kru picks by fraction', kru('jeGlowR', 0) === DEV.jeGlowRLo && kru('jeGlowR', 1) === DEV.jeGlowRHi);
}

// ---- the shared pieces ----
{
  let a = 0, worst = 0;
  for (let i = 0; i < 200; i++) { const b = turnToward(a, Math.PI, 0.05); worst = Math.max(worst, Math.abs(b - a)); a = b; }
  check('turnToward never turns more than its limit', worst <= 0.05 + 1e-9, worst);
  check('and gets there in the end', Math.abs(Math.abs(a) - Math.PI) < 1e-6, a);
  check('it takes the short way round', turnToward(3, -3, 0.1) > 3 || turnToward(3, -3, 0.1) < -3, turnToward(3, -3, 0.1));
  let w = 0; for (let i = 0; i < 1000; i++) w = turnToward(w, w + 3, 0.2);
  check('and never winds up past ±π', Math.abs(w) <= Math.PI + 1e-9, w);
}
{
  // a body flung at a wall stops on it and comes back out, never through it
  const g = grid(100, 60, x => x >= 60);
  const e = { x: 60, y: 60 }, V = { vx: 900, vy: 0 };
  let inside = 0;
  for (let i = 0; i < 60; i++) { flyMove(e, V, DT, 7, g.solidCell, 0.5); if (inRock(g, e.x, e.y) || e.x > 120 - 6.9) inside++; }
  check('flyMove stops a body on the rock, never in it', inside === 0 && e.x <= 120 - 6.9, { x: e.x, inside });
  check('and turns its velocity round (a bounce)', V.vx < 0, V.vx);
  const f = { x: 60, y: 60 }, F = { vx: 400, vy: 0 };
  flyMove(f, F, DT, 7, g.solidCell, 0); for (let i = 0; i < 20; i++) flyMove(f, F, DT, 7, g.solidCell, 0);
  check('bounce 0 stops it dead against the rock', Math.abs(F.vx) < 1, F.vx);
}
{
  // the roam spot stays round home
  const R = {}, e = { hx: 300, hy: 300 }, rnd = mkRnd(3);
  let far = 0;
  for (let i = 0; i < 60 * 60; i++) { roamStep(R, e, DT, rnd, 'je'); far = Math.max(far, Math.hypot(R.rx - 300, R.ry - 300)); }
  check('the roam spot wanders but stays near home', far > 10 && far < DEV.jeRoamRHi + 10, far);
}

// ---- pulses and drag ----
{
  const e = jelly(300, 300), rnd = mkRnd(7);
  let pulses = 0, peak = 0, afterPulse = [], inside = 0, maxTurn = 0, prevHd = null;
  for (let i = 0; i < 30 * 60; i++) {
    const out = jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
    const S = e.je;
    if (prevHd !== null) maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(S.hd - prevHd), Math.cos(S.hd - prevHd))) / DT);
    prevHd = S.hd;
    if (out === 'pulse') { pulses++; afterPulse.push(i); }
    peak = Math.max(peak, Math.hypot(S.vx, S.vy));
    if (inRock(box, e.x, e.y)) inside++;
  }
  check('roaming, it pulses now and then', pulses >= 5, pulses);
  check('rests between pulses of the roaming length', afterPulse.slice(1).every((t, i) => (t - afterPulse[i]) * DT >= DEV.jeRoamRestLo * 0.99),
    afterPulse.slice(1).map((t, i) => +((t - afterPulse[i]) * DT).toFixed(2)));
  check('a pulse gets it moving at about the push speed', peak > DEV.jeRoamPushLo * 0.6 && peak < DEV.jeRoamPushHi * 1.2, peak);
  check('the head never turns faster than the turn-rate limit', maxTurn <= DEV.jeTurnHi * Math.PI / 180 + 0.01, +(maxTurn * 180 / Math.PI).toFixed(1));
  check('never inside rock', inside === 0, inside);
  check('it stays round home', Math.hypot(e.x - 300, e.y - 300) < DEV.jeRoamRHi + 80, Math.hypot(e.x - 300, e.y - 300));
}
{
  // one pulse, then watch the speed and the shape as it coasts to a stop
  const e = jelly(300, 300), rnd = mkRnd(11);
  jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
  const S = e.je;
  S.hd = 0; S.rx = 700; S.ry = 300; S.roamR = 1e9; S.roamSpd = 0; S.rest = 0; S.tol = 180;
  S.sink = 0;
  let pulsed = -1; const trace = [];
  for (let i = 0; i < 4 * 60; i++) {
    const out = jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
    if (out === 'pulse' && pulsed < 0) pulsed = i;
    if (pulsed >= 0) trace.push({ v: Math.hypot(S.vx, S.vy), sh: S.shape, vref: S.vref, push: S.push });
    if (pulsed >= 0 && trace.length > 1 && S.rest < 5) S.rest = 5;   // one pulse only
    S.sink = 0;                         // no sinking: this is about the drag alone
  }
  const top = trace.reduce((m, q) => (q.v > m.v ? q : m), trace[0]);
  const coast = trace.slice(trace.indexOf(top));
  let slowing = true; for (let i = 1; i < coast.length; i++) if (coast[i].v > coast[i - 1].v + 1e-6) slowing = false;
  check('after the push, drag only ever slows it', slowing);
  check('it slows right down within a few seconds', coast[coast.length - 1].v < top.v * 0.1, [top.v, coast[coast.length - 1].v]);
  check('at the top of the pulse the bell is thin', top.sh > 0.85, top.sh);
  check('nearly stopped, the bell is flat', coast[coast.length - 1].sh < 0.35, coast[coast.length - 1].sh);
  const half = coast.find(q => q.v < top.vref * 0.5);
  check('weighted to the thin side: at half speed it is still mostly thin', half && half.sh > 0.65, half && half.sh);
  let shapeDown = true; for (let i = 1; i < coast.length; i++) if (coast[i].sh > coast[i - 1].sh + 1e-6) shapeDown = false;
  check('and it flattens smoothly as it slows (no jumps back)', shapeDown);
}
{
  // it won't push until its head is round: a goal behind it means a turn first
  const e = jelly(300, 300), rnd = mkRnd(5);
  jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
  const S = e.je;
  S.hd = 0; S.vx = S.vy = 0; S.rest = 0; S.rx = 100; S.ry = 300; S.roamR = 1e9; S.roamSpd = 0; S.tol = 30;
  let firstPulseHd = null;
  for (let i = 0; i < 6 * 60 && firstPulseHd === null; i++)
    if (jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT) === 'pulse') firstPulseHd = S.hd;
  const off = firstPulseHd === null ? 999 : Math.abs(Math.atan2(Math.sin(firstPulseHd - Math.PI), Math.cos(firstPulseHd - Math.PI))) * 180 / Math.PI;
  check('a goal behind it: it turns round before it pulses', off <= 30.5, off);
}

// ---- hunting ----
{
  const e = jelly(150, 300), rnd = mkRnd(9), goal = { x: 500, y: 300 };
  let closest = 1e9, aimedInRange = 0, pulsesInRange = 0, inside = 0;
  for (let i = 0; i < 15 * 60; i++) {
    const out = jellyStep(e, { solidCell: box.solidCell, hunting: true, goal, rnd }, DT);
    const d = Math.hypot(goal.x - e.x, goal.y - e.y);
    closest = Math.min(closest, d);
    if (e.je.inRange && e.je.aimed) aimedInRange++;
    if (out === 'pulse' && d < DEV.jeRangeLo - 5) pulsesInRange++;
    if (inRock(box, e.x, e.y)) inside++;
  }
  check('hunting, it closes on you to spitting range', closest < DEV.jeRangeHi + 5, closest);
  check('but does not keep pulsing once it is in range', pulsesInRange === 0, pulsesInRange);
  check('and lines its head up on you (so it can spit)', aimedInRange > 60, aimedInRange);
  check('never inside rock while hunting', inside === 0, inside);
  check('it does not ram right into you', closest > 20, closest);
}
{
  // hunting through a wall: it bumps and glances off, it never goes through
  const g = grid(300, 300, (x, y) => x < 4 || y < 4 || x >= 296 || y >= 296 || (x >= 140 && x < 150 && y > 20 && y < 280));
  const e = jelly(150, 300), rnd = mkRnd(13);
  let crossed = false, inside = 0;
  for (let i = 0; i < 20 * 60; i++) {
    jellyStep(e, { solidCell: g.solidCell, hunting: true, goal: { x: 500, y: 300 }, rnd }, DT);
    if (inRock(g, e.x, e.y)) inside++;
    if (e.x > 300 && e.y > 45 && e.y < 555) crossed = true;
  }
  check('a wall in the way: never through it', !crossed && inside === 0, { x: e.x, y: e.y, inside });
}

// ---- tentacles ----
{
  const e = jelly(300, 300), rnd = mkRnd(17);
  jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
  const S = e.je;
  check('it grows the knob\'s number of tentacles', S.tent.length >= Math.round(DEV.jeTentsLo) && S.tent.length <= Math.round(DEV.jeTentsHi), S.tent.length);
  check('each with the knob\'s number of points', S.tent.every(T => T.length >= DEV.jeVertsLo && T.length <= DEV.jeVertsHi), S.tent.map(T => T.length));
  // swim hard to the right: the tentacles stream out behind (to the left)
  S.hd = 0; S.vx = 160; S.vy = 0; S.rest = 99; S.push = 0;
  for (let i = 0; i < 20; i++) { S.vx = 160; S.hd = 0; jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT); }
  const tips = S.tent.map(T => T[T.length - 1]);
  check('swimming right, the tentacle tips trail behind it', tips.every(q => q.x < e.x - 8), tips.map(q => +(q.x - e.x).toFixed(1)));
  const len = kru('jeTentLen', S.u.len);
  const segOk = S.tent.every(T => T.every((q, j) => !j || Math.abs(Math.hypot(q.x - T[j - 1].x, q.y - T[j - 1].y) - len / (T.length - 1)) < 1e-6));
  check('and keep their length (no stretching)', segOk);
  // at rest they hang down
  S.vx = S.vy = 0; S.hd = -Math.PI / 2; S.rest = 99; S.sink = 0; S.turn = 0;
  for (let i = 0; i < 6 * 60; i++) { S.rest = 99; S.vx = S.vy = 0; jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT); }
  const tips2 = S.tent.map(T => T[T.length - 1]);
  check('at rest, head up, they hang below it', tips2.every(q => q.y > e.y + 8), tips2.map(q => +(q.y - e.y).toFixed(1)));
}
{
  const flat = jellyBell(9, 0, 1), thin = jellyBell(9, 1, 1);
  check('the bell is wide and short when flat, narrow and tall when thin', flat.w > thin.w && flat.h < thin.h, { flat, thin });
  check('squash 0 means no change at all', JSON.stringify(jellyBell(9, 1, 0)) === JSON.stringify(jellyBell(9, 0, 1)));
}

// ---- the tentacles sting: an exact line-through-box test ----
{
  const B = [0, 0, 12, 22];                     // a player-sized box
  check('a line straight through the box hits', segHitsBox(-5, 10, 20, 10, ...B));
  check('a line that ends inside hits', segHitsBox(-5, 10, 3, 11, ...B));
  check('a line wholly inside hits', segHitsBox(2, 2, 5, 5, ...B));
  check('a line clipping a corner hits', segHitsBox(-2, 3, 3, -2, ...B));
  check('a line passing just by misses', !segHitsBox(-2, -1, 14, -1, ...B) && !segHitsBox(13, -5, 13, 30, ...B));
  check('a line stopping short misses', !segHitsBox(-10, 10, -0.5, 10, ...B));
  check('a line skimming past a corner misses', !segHitsBox(-3, 1, 1, -3, ...B));
  // a real jelly hanging over the box: tentacles down into it sting, pulled up they don't
  const e = jelly(300, 300), rnd = mkRnd(21);
  jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT);
  const S = e.je; S.hd = -Math.PI / 2; S.turn = 0; S.sink = 0;
  for (let i = 0; i < 4 * 60; i++) { S.rest = 99; S.vx = S.vy = 0; e.x = 300; e.y = 300; jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd }, DT); }
  const tipY = Math.max(...S.tent.map(T => T[T.length - 1].y));
  const under = tentacleTouch(S, 294, tipY - 10, 306, tipY + 12);
  check('a box among the hanging tentacles is stung', !!under, { tipY });
  check('and the sting is placed on a tentacle', under && under.y > 300 && under.y <= tipY + 0.01, under);
  check('a box beside them is not', !tentacleTouch(S, 330, tipY - 10, 342, tipY + 12));
  check('nor one above the bell (the bell is not a tentacle)', !tentacleTouch(S, 294, 270, 306, 292));
}

// ---- colour knobs: each part an A and a B, a jelly a blend between ----
{
  check('every part has a colour A and B in the Jellyfish colours group', JE_COLS.every(([k]) =>
    ['Lo', 'Hi'].every(x => DEV_META.some(m => m.k === k + x && m.g === 'jellycol' && m.type === 'color') &&
      /^#[0-9a-f]{6}$/.test(DEV_DEFAULTS[k + x]))));
  check('and the group is on the Dev panel', DEV_GROUPS.some(g => g[0] === 'jellycol'));
  check('hexMix blends', hexMix('#000000', '#ff8040', 0.5) === '#804020' && hexMix('#123456', '#abcdef', 0) === '#123456' &&
    hexMix('#123456', '#abcdef', 1) === '#abcdef', hexMix('#000000', '#ff8040', 0.5));
  check('hexRgb gives the glow its r,g,b', hexRgb('#6eff5a') === '110,255,90');
  const P = jellyPal(0);
  check('the palette has every part', JE_COLS.every(r => /^#[0-9a-f]{6}$/.test(P[r[4]])), P);
  const k0 = [DEV.jeColBodyLo, DEV.jeColBodyHi];
  DEV.jeColBodyLo = '#ff0000'; DEV.jeColBodyHi = '#0000ff';
  check('a jelly at u = 0 wears colour A, at 1 colour B, between in between',
    jellyPal(0).body === '#ff0000' && jellyPal(1).body === '#0000ff' && jellyPal(0.5).body === '#800080', jellyPal(0.5).body);
  [DEV.jeColBodyLo, DEV.jeColBodyHi] = k0;
  const e = jelly(300, 300);
  jellyStep(e, { solidCell: box.solidCell, hunting: false, goal: null, rnd: mkRnd(4) }, DT);
  check('each jelly rolls its own colour fraction', e.je.u.col >= 0 && e.je.u.col <= 1);
}
{
  const ch = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const near = (a, b) => ch(a).every((v, i) => Math.abs(v - ch(b)[i]) <= 1);
  check('hsvAdjust with nothing moved leaves a colour be', ['#46c94f', '#133d1a', '#e4ff4a', '#ffffff', '#000000', '#808080']
    .every(c => near(hsvAdjust(c, 0, 1, 1), c)));
  check('a hue shift turns the wheel (red +120° is green, +240° blue)',
    hsvAdjust('#ff0000', 120, 1, 1) === '#00ff00' && hsvAdjust('#ff0000', 240, 1, 1) === '#0000ff' && hsvAdjust('#ff0000', -120, 1, 1) === '#0000ff');
  check('saturation 0 makes it grey', (([r, g, b]) => r === g && g === b)(ch(hsvAdjust('#46c94f', 0, 0, 1))), hsvAdjust('#46c94f', 0, 0, 1));
  check('brightness 0 makes it black, 0.5 halves it', hsvAdjust('#46c94f', 0, 1, 0) === '#000000' &&
    near(hsvAdjust('#46c94f', 0, 1, 0.5), '#23652' + '8'), hsvAdjust('#46c94f', 0, 1, 0.5));
  check('the master sliders are in the colour group and default to no change',
    ['jeHue', 'jeSat', 'jeBri'].every(k => DEV_META.some(m => m.k === k && m.g === 'jellycol' && m.type === 'slider')) &&
    DEV_DEFAULTS.jeHue === 0 && DEV_DEFAULTS.jeSat === 1 && DEV_DEFAULTS.jeBri === 1);
  const before = jellyPal(0.3);
  DEV.jeHue = 180;
  const after = jellyPal(0.3);
  check('they move every part of the palette at once', Object.keys(before).filter(k => before[k] !== after[k]).length >= 12,
    Object.keys(before).filter(k => before[k] === after[k]));
  check('and jcol (glow, health bar, death burst) follows them', jcol('jeColGlow', 0.3) === after.glow);
  DEV.jeHue = 0;
  check('back at 0 it is the plain blend again', jellyPal(0.3).body === kcol('jeColBody', 0.3));
}

// ---- the real floor 1: every jelly on it gets about, none stuck in rock ----
{
  let still = 0, total = 0, inside = 0;
  for (const seed of [11, 222, 3333]) {
    const lv = makeLevel(seed, 1, []);
    const solidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || lv.mat[cy * CW + cx] !== 0;
    const js = lv.enemies.filter(e => e.k.act === 'jelly');
    const rnd = mkRnd(seed), path = js.map(() => 0);
    for (let t = 0; t < 30 * 60; t++) js.forEach((e, i) => {
      const x = e.x, y = e.y;
      jellyStep(e, { solidCell, hunting: false, goal: null, rnd }, DT);
      if (t > 3 * 60) path[i] += Math.hypot(e.x - x, e.y - y);
      if (solidCell(Math.floor(e.x / CELL), Math.floor(e.y / CELL))) inside++;
    });
    total += js.length; still += path.filter(p => p < 30).length;
  }
  check('on real floor-1 caves, every roaming jelly swims about (30s each)', still === 0 && total > 10, { still, total });
  check('and none of them ever ends up inside rock', inside === 0, inside);
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall jelly checks passed');
