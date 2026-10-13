// The play area's FPS graph (auto/fps.js): frames counted in 0.25 s buckets, the last FPS_N kept.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const F = G.fpsNew();
for (let t = 0; t <= 1000; t += 1000 / 60) G.fpsTick(F, t);
check('60 frames a second read as about 60', F.graph.length >= 3 && F.graph.every(v => Math.abs(v - 60) < 5), F.graph);
const n = F.graph.length;
G.fpsTick(F, 1500);  // a half-second hitch
check('a hitch shows as a low bucket', F.graph.length === n + 1 && F.graph[n] < 30, F.graph[n]);
for (let t = 1500; t < 60000; t += 1000 / 30) G.fpsTick(F, t);
check('it keeps only the last FPS_N', F.graph.length === G.FPS_N);
check('30 frames a second read as about 30', Math.abs(F.graph[F.graph.length - 1] - 30) < 4, F.graph.slice(-3));
console.log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
