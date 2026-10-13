// The play area's Dev performance graphs (auto/fps.js): frames counted in 0.25 s buckets, the last FPS_N kept per graph.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const F = G.fpsNew();
let k = 0;
for (let t = 0; t <= 1000; t += 1000 / 60) G.fpsTick(F, t, { step: 2, draw: 4, shots: k++ % 5, parts: 7, foes: 3, burn: 0 });
const g = F.graphs;
check('every row has its graph', G.PERF_ROWS.every(r => Array.isArray(g[r.key]) && g[r.key].length === g.fps.length));
check('60 frames a second read as about 60', g.fps.length >= 3 && g.fps.every(v => Math.abs(v - 60) < 5), g.fps);
check('the slowest frame about 16.7 ms', g.worst.every(v => Math.abs(v - 16.7) < 1), g.worst);
check('update and draw averaged', g.step.every(v => Math.abs(v - 2) < 1e-6) && g.draw.every(v => Math.abs(v - 4) < 1e-6), [g.step, g.draw]);
check('counts keep the most in the bucket', g.shots.every(v => v === 4) && g.foes.every(v => v === 3), g.shots);
const n = g.fps.length;
G.fpsTick(F, 1500);  // a half-second hitch
check('a hitch shows as a low fps and a slow worst frame', g.fps[n] < 30 && g.worst[n] >= 400, [g.fps[n], g.worst[n]]);
for (let t = 1500; t < 60000; t += 1000 / 30) G.fpsTick(F, t);
check('it keeps only the last FPS_N', G.PERF_ROWS.every(r => g[r.key].length === G.FPS_N));
check('30 frames a second read as about 30', Math.abs(g.fps[g.fps.length - 1] - 30) < 4, g.fps.slice(-3));
console.log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
