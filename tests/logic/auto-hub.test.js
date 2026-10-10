// CaveRunner Auto's hub strip (src/auto/hub.js; AUTOBATTLER.md stage 3a): the stops in order and evenly
// spaced, the strip fixed (stepping never scrolls it), the room's cells (steel floor and roof, open inside),
// the player hidden until the enter pad has charged, then on that pad and on the floor, staying there,
// and the tubes going from dark to lit over time.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const ids = G.HUB_STOPS.map(s => s.id), xs = G.HUB_STOPS.map(s => s.x);
check('the stops, left to right: enter, gun, exo, mod, perk, exit', ids.join() === 'enter,gun,exo,mod,perk,exit', ids);
const gaps = xs.slice(1).map((x, i) => x - xs[i]);
check('evenly spaced', gaps.every(g => g === gaps[0]) && gaps[0] > 56, gaps);
check('all inside the strip, the same margin each end', xs[0] > 0 && Math.abs(xs[0] - (G.HUB_W - xs[5])) < 1e-9, [xs[0], G.HUB_W]);
check('hubStopX finds them', G.hubStopX('perk') === xs[4] && G.hubStopX('exit') === xs[5]);
check('each machine has its look; the exo machine its own hue and glyphs', ['gun', 'exo', 'mod', 'perk'].every(k => G.HUB_MACHINES[k])
  && new Set(['gun', 'exo', 'mod', 'perk'].map(k => G.HUB_MACHINES[k].hue)).size === 4 && G.HUB_EXO_GLYPHS.length === 4);

const vh = 190, S = G.hubScene(vh, 101, 1), H = G.hubState(S), fy = G.hubFloor(vh);
check('a fixed strip: as wide as the hub, no creatures', S.hub && S.ncol * G.TCELL === G.HUB_W && S.foes.length === 0, S.ncol);
const solid = (x, y) => G.titleSolid(S, x, y);
check('steel floor and roof, open between, walls at the ends', solid(100, fy + 1) && solid(100, fy - G.HUB_ROOM - 1) && !solid(100, fy - 10)
  && !solid(100, fy - G.HUB_ROOM + 2) && solid(2, fy - 20) && solid(G.HUB_W - 2, fy - 20));
check('the floor is steel (TM.STEEL), the back wall open brick and steel', G.titleCell(S, 50, fy / G.TCELL) === G.TM.STEEL
  && G.titleCell(S, 50, (fy - 60) / G.TCELL) === G.TM.BWALL && G.titleCell(S, 50, (fy - 4) / G.TCELL) === G.TM.SWALL);
const r = S.runners[0];
check('one player, hidden at first (the pad charging)', S.runners.length === 1 && r.hide === true);
check('in the dark: no tube on', H.on.every(t => t < 0) && G.hubTube(S, 0) === 0);
for (let i = 0; i < 10; i++) G.titleStep(S, 0.05);   // (titleStep takes at most 0.05 a step)
check('charging half way', Math.abs(G.hubCharge(S).ch - 0.5) < 0.05 && r.hide, G.hubCharge(S));
const cells0 = Buffer.from(S.cells).toString('base64');
let seen = false, minX = 1e9, maxX = -1e9, offFloor = 0, lit = [];
for (let i = 0; i < 300; i++) {
  G.titleStep(S, 1 / 30);
  if (!r.hide) { seen = true; minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); if (Math.abs(r.y + G.PH - fy) > 0.01) offFloor++; }
  if (i % 30 === 0) lit.push(+G.hubTube(S, 0).toFixed(2));
}
check('he came through (a flash, a zap)', seen && H.arrived[0] && H.zap > 0);
const px = G.hubStopX('enter');
check('he stands on the enter pad', Math.abs(minX + G.PW / 2 - px) < 1 && Math.abs(maxX + G.PW / 2 - px) < 1, [minX, maxX, px]);
check('…on the floor the whole time', offFloor === 0, offFloor);
check('the strip is fixed: no scroll, no new terrain', S.scroll === 0 && Buffer.from(S.cells).toString('base64') === cells0);
check('the tubes come on over time: dark, stuttering, then lit', lit[0] === 0 && lit[lit.length - 1] === 1, lit);
check('every tube on by 10 s', S.t > 10 && G.HUB_STOPS.every((_, i) => G.hubTube(S, i) === 1), S.t);
const S2 = G.hubScene(vh, 101, 3);
check('3 players: they come through one after another', S2.runners.length === 3 && G.hubArriveT(1) > G.hubArriveT(0));


// ---- free roam (the pill stick), the exit ----
const D = G.DEV, SP = D.autoHubSpace;
const cx = rr => rr.x + G.PW / 2;
const step = (Sx, n) => { for (let i = 0; i < n; i++) G.titleStep(Sx, 1 / 30); };
// a push: nx, ny its direction, mag 0-1 (dy < 0 up)
const stick = (Sx, nx, ny, mag = 1) => G.hubStick(Sx, { active: mag > 0, nx, ny, mag, dy: ny * mag });
const T = G.hubScene(vh, 7, 1), TH = G.hubState(T), L = T.runners[0];
stick(T, 1, 0); step(T, 20);
check('no control before he is through', Math.abs(cx(L) - G.hubStopX('enter')) < 0.1, cx(L));
step(T, 60);
const x0 = cx(L); step(T, 30);
check('pushed right: he runs right, facing right, running', cx(L) > x0 + 20 && L.face === 1 && !L.stand && L.ground, [x0, cx(L)]);
check('…at the old game\'s walk speed', Math.abs(Math.abs(L.vx) - G.WALK) < 1, L.vx);
const x1 = cx(L); stick(T, 0.5, 0, 0.5); step(T, 30);
const half = cx(L) - x1;
check('a half push runs slower', half > 0 && half < G.WALK * 0.6, half);
stick(T, -1, 0); step(T, 40);
check('pushed left: he runs left, facing left', L.vx < -1 && L.face === -1, [L.vx, L.face]);
stick(T, 0, 0, 0); step(T, 30);
check('let go: he stops and stands', L.vx === 0 && L.stand && L.ground);
// walls
stick(T, -1, 0); step(T, 300);
check('the left wall holds him', cx(L) >= G.HUB_WALL * G.TCELL && cx(L) < G.HUB_WALL * G.TCELL + G.PW + 1, cx(L));
stick(T, 1, 0); step(T, 400);
check('the right wall holds him', cx(L) <= G.HUB_W - G.HUB_WALL * G.TCELL && cx(L) > G.HUB_W - G.HUB_WALL * G.TCELL - G.PW - 1, cx(L));
// jet (away from the wall first)
stick(T, -1, 0); step(T, 60); stick(T, 0, 0, 0); step(T, 30);
stick(T, 0, -1); step(T, 10);
check('pushed up: he jets off the floor (flying, the flame on)', L.y + G.PH < TH.fy - 5 && !L.ground && L.mode === 'fly' && L.flame > 0, [L.y, TH.fy]);
step(T, 120);
check('the roof holds him', L.y >= TH.roof && L.y < TH.roof + 3, [L.y, TH.roof]);
stick(T, 0.71, -0.71); const xj = cx(L); step(T, 15);
check('up-right: he flies right', cx(L) > xj + 3 && L.face === 1, [xj, cx(L)]);
stick(T, 0, 0, 0); step(T, 120);
check('let go: he falls and lands on the floor', L.ground && Math.abs(L.y + G.PH - TH.fy) < 0.01 && L.mode === 'run', [L.y, TH.fy]);
stick(T, 0, -1, 0.08); step(T, 10);
check('inside the dead zone: nothing', L.ground && L.vx === 0);
// the exit: only on the pad
stick(T, 0, 0, 0);
const goTo = (Sx, x, cap = 600) => { const Lx = Sx.runners[0]; let i = 0; for (; i < cap && Math.abs(cx(Lx) - x) > 3; i++) { stick(Sx, Math.sign(x - cx(Lx)), 0, Math.min(1, 0.3 + Math.abs(x - cx(Lx)) / 30)); G.titleStep(Sx, 1 / 30); } stick(Sx, 0, 0, 0); step(Sx, 30); return i < cap; };
goTo(T, G.hubStopX('perk'));
check('A away from the exit: nothing', G.hubAtExit(T) === false && G.hubExit(T) === false && G.hubExitFlash(T) === 0);
check('he walked to the exit pad', goTo(T, G.hubStopX('exit')), cx(L));
stick(T, 0, -1); step(T, 10);
check('over the pad but in the air: no exit', !G.hubAtExit(T) && G.hubExit(T) === false);
stick(T, 0, 0, 0); step(T, 120);
check('back on the exit pad', G.hubAtExit(T));
check('on the exit pad: A flashes it, everyone goes', G.hubExit(T) === true && G.hubExitFlash(T) > 0.9 && T.runners.every(r => r.hide), G.hubExitFlash(T));
check('not yet left (the flash), A again does nothing', !G.hubLeft(T) && G.hubExit(T) === false);
const lx0 = L.x;
stick(T, 1, 0); step(T, 30); stick(T, 0, 0, 0);
check('the flash fades, the team has left; the stick no longer moves him', G.hubExitFlash(T) === 0 && G.hubLeft(T) && L.x === lx0);

// 3 players: they line up behind the leader, in order, SP apart
const P = G.hubScene(vh, 9, 3), PHs = G.hubState(P);
step(P, 120);
stick(P, 1, 0);
let mid = null;
for (let i = 0; i < 300 && !mid; i++) { G.titleStep(P, 1 / 30); if (cx(P.runners[0]) > G.hubStopX('gun') + 20) mid = P.runners.map(cx); }
check('running right: the others close behind (left of) the leader, in order', mid && mid[0] > mid[1] && mid[1] > mid[2]
  && mid[0] - mid[1] < SP + 8 && mid[1] - mid[2] < SP + 8, mid);
stick(P, 0, 0, 0); step(P, 90);
const xs3 = P.runners.map(cx);
check('stopped: lined up SP apart behind him, all standing', Math.abs(xs3[0] - xs3[1] - SP) < 0.5 && Math.abs(xs3[1] - xs3[2] - SP) < 0.5
  && P.runners.every(rr => rr.stand && rr.face === 1), xs3);
stick(P, -1, 0); step(P, 20); stick(P, 0, 0, 0); step(P, 90);
const xs4 = P.runners.map(cx);
check('going left they line up on his right', Math.abs(xs4[1] - xs4[0] - SP) < 0.5 && Math.abs(xs4[2] - xs4[1] - SP) < 0.5, xs4);
stick(P, 0, -1); step(P, 15);
check('he jets, the others stay on the floor', !P.runners[0].ground && P.runners.slice(1).every(rr => Math.abs(rr.y + G.PH - PHs.fy) < 0.01));

// prices follow the tier
const p1 = G.hubPrice('gun', 1), p3 = G.hubPrice('gun', 3);
check('gun machine: the run gun price, growing with the tier', p1.kind === 'gold' && p1.n === G.autoGunPrice(1) && p3.n === G.autoGunPrice(3) && p3.n > p1.n, [p1, p3]);
check('exo machine: the exo price', G.hubPrice('exo', 2).n === G.autoExoPrice(2) && G.hubPrice('exo', 2).kind === 'gold');
check('mod machine: 1 red, perk machine: 1 green, pads: none', G.hubPrice('mod', 4).kind === 'red' && G.hubPrice('mod', 4).n === 1
  && G.hubPrice('perk', 2).kind === 'green' && G.hubPrice('perk', 2).n === 1 && G.hubPrice('exit', 1) === null);
check('the scene carries the run tier', G.hubState(G.hubScene(vh, 1, 1, 3)).tier === 3 && TH.tier === 1);

// feedback round 2: the old shop's layout (core/consts.js) and its crystal machines' demo (stepHubDemo)
check('the old shop\'s spacing, room height and way-in margin', G.HUB_GAP === G.SHOP_SLOT && G.HUB_GAP === 120
  && G.HUB_ROOM === G.SHOP_H * G.CELL && G.HUB_EDGE === G.ARRIVAL_X && G.HUB_WALL === 3, [G.HUB_GAP, G.HUB_ROOM, G.HUB_EDGE]);
{
  const D = G.hubState(G.hubScene(vh, 1, 1)), mod = G.hubStopX('mod'), perk = G.hubStopX('perk');
  G.stepHubDemo(D, mod - 40, 0.5);
  check('near the mod machine: its demo plays, on his side; the perk machine\'s does not', D.demo.mod && D.demo.mod.t === 0.5 && D.demo.mod.side === -1 && !D.demo.perk, D.demo);
  G.stepHubDemo(D, mod - 40, 0.25);
  check('and runs on', D.demo.mod.t === 0.75);
  G.stepHubDemo(D, perk + 30, 0.1);
  check('by the perk machine: the mod\'s stops, the perk\'s starts on the right', !D.demo.mod && D.demo.perk && D.demo.perk.side === 1, D.demo);
  G.stepHubDemo(D, mod - G.DEV.autoHubDemoNear - 5, 0.1);
  check('too far off: none', !D.demo.mod && !D.demo.perk, D.demo);
  D.paid.mod = 1; G.stepHubDemo(D, mod, 0.1);
  check('once something is paid in: no demo there', !D.demo.mod, D.demo);
  const L = G.demoAt(0.1), M = G.demoAt(G.DEMO_IN + 0.1);
  check('the old demo timing (in, then sit)', L.ph === 'in' && M.ph === 'sit', [L, M]);
}

{ // (feedback round 2) the jet flame points away from the way he travels: the hub's stick, a level's autopilot
  const Sj = G.hubScene(190, 3, 1);
  for (let i = 0; i < 90; i++) G.titleStep(Sj, 1 / 30);
  const Lj = Sj.runners[0];
  stick(Sj, 0.7, -0.7);
  for (let i = 0; i < 20; i++) G.titleStep(Sj, 1 / 30);
  const f1 = G.titleFlameDir(Lj);
  stick(Sj, -0.7, -0.7);
  for (let i = 0; i < 20; i++) G.titleStep(Sj, 1 / 30);
  const f2 = G.titleFlameDir(Lj);
  check('hub: jetting up and right, the flame points down and left; up and left, down and right', Lj.flame > 0 && f1.fx < -0.3 && f1.fy > 0 && f2.fx > 0.3, [f1, f2]);
  stick(Sj, 0, 0, 0);
  const Sl = G.levelScene(200, 7, 1), R0 = Sl.runners[0];
  for (let i = 0; i < 120; i++) G.titleStep(Sl, 1 / 30);   // (through the start pad)
  R0.wvx = 60; R0.vx = 0;
  for (let i = 0; i < 30; i++) { R0.wvx = 60; G.titleStep(Sl, 1 / 30); }
  check('level: an autopilot player going right through the world (keeping pace on screen): the flame leans back', G.titleFlameDir(R0).fx < -0.2, G.titleFlameDir(R0));
}

check('jet: lowering the stick lowers the thrust (full up climbs at JET, level sinks, the flame drops)', G.jetLift(-1, 1) === -G.JET && G.jetLift(-0.5, 1) > G.jetLift(-1, 1) && G.jetLift(-0.05, 1) > 0 && G.jetThrottle(-0.3, 1) < G.jetThrottle(-1, 1), [G.jetLift(-1, 1), G.jetLift(-0.5, 1), G.jetLift(-0.05, 1)]);

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
