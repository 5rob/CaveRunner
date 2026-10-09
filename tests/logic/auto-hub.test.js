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

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
