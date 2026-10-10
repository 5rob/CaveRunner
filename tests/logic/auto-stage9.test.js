// CaveRunner Auto stage 9's pure helpers: meterTail (the stats graphs' samples: the last span seconds, oldest first;
// no meter: a flat line), nextSpan (5 → 15 → 30 → 5), gunArc (4 circles above the helmet, kept on screen), arcPick.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

const M = G.meterNew();
for (let i = 0; i < 200; i++) { G.meterAdd(M, i); G.meterStep(M, 0.25); }
G.meterAdd(M, 999);
const t5 = G.meterTail(M, 5);
check('5 s of a 0.25 s meter: 20 buckets', t5.length === 20, t5.length);
check('… oldest first, the one now last', t5[19] === 999 && t5[18] === 199 && t5[0] === 181, t5);
check('30 s: the whole ring', G.meterTail(M, 30).length === 120);
check('more than the ring: the ring', G.meterTail(M, 60).length === 120);
const flat = G.meterTail(null, 15);
check('no meter (the hub): a flat line of zeros', flat.length === 60 && flat.every(v => v === 0), flat.length);
check('spans cycle 5 → 15 → 30 → all → 5', G.nextSpan(5) === 15 && G.nextSpan(15) === 30 && G.nextSpan(30) === 0 && G.nextSpan(0) === 5 && G.spanLabel(0) === 'all');
{ // (feedback round 2) the whole level: every bucket kept, averaged down to ALL_PTS
  const A = G.meterNew();
  for (let i = 0; i < 2000; i++) { G.meterAdd(A, i < 1000 ? 1 : 3); G.meterStep(A, G.METER_DT); }
  const all = G.meterTail(A, 0);
  check('all: the whole level (2000 buckets, more than the 30 s ring), averaged to ALL_PTS', A.all.length === 2000 && all.length === G.ALL_PTS, [A.all.length, all.length]);
  check('… oldest first: 1s then 3s (the last point has the bucket in progress)', Math.abs(all[0] - 1) < 1e-9 && Math.abs(all[all.length - 2] - 3) < 1e-9, [all[0], all[all.length - 2]]);
  const B = G.meterNew(); for (let i = 0; i < 10; i++) { G.meterAdd(B, i); G.meterStep(B, G.METER_DT); }
  check('all, early on: every bucket so far plus now', G.meterTail(B, 0).length === 11);
  check('all, no meter: flat', G.meterTail(null, 0).every(v => v === 0));
}

const a = G.gunArc(200, 500, 412, 110, 30);
check('the arc: 4 circles, left to right, all above the helmet', a.length === 4 && a.every((p, i) => p.y < 500 && (!i || p.x > a[i - 1].x)), a);
check('… symmetric round the helmet in the middle', Math.abs(a[0].x + a[3].x - 400) < 1e-6 && Math.abs(a[1].y - a[2].y) < 1e-6, a);
const e = G.gunArc(40, 500, 412, 110, 30);
check('a helmet at the left edge: the arc shifted on screen', Math.min(...e.map(p => p.x)) >= 30 - 1e-6, e);
const r = G.gunArc(400, 500, 412, 110, 30);
check('… at the right edge too', Math.max(...r.map(p => p.x)) <= 382 + 1e-6, r);
check('arcPick: on circle 2', G.arcPick(a, a[1].x + 5, a[1].y - 5, 28) === 1);
check('arcPick: nowhere near one: -1', G.arcPick(a, 200, 500, 28) === -1);

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
