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


// ---- stage 3b: arrow travel, the exit, the prices ----
const D = G.DEV, OFF = D.autoHubOff, SP = D.autoHubSpace;
const cx = rr => rr.x + G.PW / 2;
// step until the leader stands still at a stop (capped)
const settle = (Sx, cap = 1200) => { const Hx = G.hubState(Sx); let i = 0; for (; i < cap && Hx.at < 0; i++) G.titleStep(Sx, 1 / 30); for (let k = 0; k < 60; k++) G.titleStep(Sx, 1 / 30); return i < cap; };
const T = G.hubScene(vh, 7, 1), TH = G.hubState(T), L = T.runners[0];
check('no travel before he is through', G.hubGo(T, 1) === false && TH.goal === 0);
for (let i = 0; i < 80; i++) G.titleStep(T, 1 / 30);
check('at the enter pad, stop 0', TH.at === 0 && Math.abs(cx(L) - G.hubStopX('enter')) < 0.1, [TH.at, cx(L)]);
check('< at the left end does nothing', G.hubGo(T, -1) === false);
// > to each stop in turn: stops just left of each machine, on the exit pad
const right = [];
for (let k = 1; k < G.HUB_STOPS.length; k++) {
  G.hubGo(T, 1);
  let ran = false, faced = true;
  for (let i = 0; i < 20; i++) { G.titleStep(T, 1 / 30); if (!L.stand) ran = true; if (L.face !== 1) faced = false; }
  const ok = settle(T), st = G.HUB_STOPS[k], want = st.id === 'exit' ? st.x : st.x - OFF;
  right.push({ id: st.id, ok, at: TH.at, d: +(cx(L) - want).toFixed(2), ran, faced, stand: L.stand });
}
check('> walks to each stop and stops just left of each machine (on the exit pad)', right.every((o, k) => o.ok && o.at === k + 1 && Math.abs(o.d) < 0.1 && o.ran && o.faced && o.stand), right);
check('> at the right end does nothing', G.hubGo(T, 1) === false);
// < back: stops just right of each machine
G.hubGo(T, -1); settle(T);
check('< stops just right of the perk machine, facing left', TH.at === 4 && Math.abs(cx(L) - (G.hubStopX('perk') + OFF)) < 0.1 && L.face === -1 && L.stand, [TH.at, cx(L)]);
// it eases in: slower over the last stretch than in the middle
{
  G.hubGo(T, -1);
  const v = []; let last = cx(L);
  for (let i = 0; i < 400 && TH.at < 0; i++) { G.titleStep(T, 1 / 30); v.push(Math.abs(cx(L) - last) * 30); last = cx(L); }
  const top = Math.max(...v), end = v.filter(x => x > 0).slice(-3);
  check('eases in: walks at the knob speed, slows at the end', Math.abs(top - D.autoHubWalk) < 1 && end.every(x => x < top * 0.5), { top, end });
}
// queueing: two taps on the move go two stops
G.hubGo(T, -1); G.titleStep(T, 1 / 30); G.titleStep(T, 1 / 30); G.hubGo(T, -1);
check('a tap on the move queues the next stop', TH.goal === 1 && TH.at < 0, [TH.goal, TH.at]);
settle(T);
check('…and he goes on to it (just right of the gun machine)', TH.at === 1 && Math.abs(cx(L) - (G.hubStopX('gun') + OFF)) < 0.1, [TH.at, cx(L)]);
// the exit: only at the exit pad
check('A away from the exit: nothing', G.hubAtExit(T) === false && G.hubExit(T) === false && G.hubExitFlash(T) === 0);
for (let k = 0; k < 4; k++) G.hubGo(T, 1);
check('…not on the way there', G.hubAtExit(T) === false && G.hubExit(T) === false);
settle(T);
check('at the exit pad: A flashes it', G.hubAtExit(T) && G.hubExit(T) === true && G.hubExitFlash(T) > 0.9, G.hubExitFlash(T));
for (let i = 0; i < 30; i++) G.titleStep(T, 1 / 30);
check('the flash fades', G.hubExitFlash(T) === 0);

// 3 players: they line up behind the leader, in order, SP apart
const P = G.hubScene(vh, 9, 3), PHs = G.hubState(P);
for (let i = 0; i < 120; i++) G.titleStep(P, 1 / 30);
G.hubGo(P, 1); G.hubGo(P, 1);
let mid = null;
for (let i = 0; i < 600 && PHs.at < 0; i++) { G.titleStep(P, 1 / 30); if (!mid && cx(P.runners[0]) > G.hubStopX('gun') + 20) mid = P.runners.map(cx); }
check('mid-travel right: the others close behind (left of) the leader, in order', mid && mid[0] > mid[1] && mid[1] > mid[2]
  && mid[0] - mid[1] < SP + 6 && mid[1] - mid[2] < SP + 6, mid);
settle(P);
const xs3 = P.runners.map(cx);
check('stopped: lined up SP apart behind him, all standing', Math.abs(xs3[0] - xs3[1] - SP) < 0.5 && Math.abs(xs3[1] - xs3[2] - SP) < 0.5
  && P.runners.every(rr => rr.stand && rr.face === 1), xs3);
G.hubGo(P, -1); settle(P);
const xs4 = P.runners.map(cx);
check('going left they line up on his right', Math.abs(xs4[1] - xs4[0] - SP) < 0.5 && Math.abs(xs4[2] - xs4[1] - SP) < 0.5, xs4);
check('everyone stays on the floor', P.runners.every(rr => Math.abs(rr.y + G.PH - PHs.fy) < 0.01));

// prices follow the tier
const p1 = G.hubPrice('gun', 1), p3 = G.hubPrice('gun', 3);
check('gun machine: the run gun price, growing with the tier', p1.kind === 'gold' && p1.n === G.autoGunPrice(1) && p3.n === G.autoGunPrice(3) && p3.n > p1.n, [p1, p3]);
check('exo machine: the exo price', G.hubPrice('exo', 2).n === G.autoExoPrice(2) && G.hubPrice('exo', 2).kind === 'gold');
check('mod machine: 1 red, perk machine: 1 green, pads: none', G.hubPrice('mod', 4).kind === 'red' && G.hubPrice('mod', 4).n === 1
  && G.hubPrice('perk', 2).kind === 'green' && G.hubPrice('perk', 2).n === 1 && G.hubPrice('exit', 1) === null);
check('the scene carries the run tier', G.hubState(G.hubScene(vh, 1, 1, 3)).tier === 3 && TH.tier === 1);

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
