// Dev → Glow worms' live preview (creatures/glowworm.js glowLab, drawn by ui/glowpreview.js): the worms stand up, strike and
// blow up as the stand-in player passes, are put back, and over a few simulated minutes nothing piles up (the worm count, the
// particles, the blasts stay capped) and a step costs no more at the end than at the start (the bats' preview once slowed down).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const L = G.glowLab(), dt = 1 / 60;
G.glowLabStep(L, dt, rnd);
check('the room filled: GLOW_LAB_N worms, none in rock', L.worms.length === G.GLOW_LAB_N && L.worms.every(w => !L.solid(w.r.x, w.r.y)), L.worms.length);
check('… on more than the floor (a roof or a wall too)', L.worms.some(w => w.r.ny > -0.5), L.worms.map(w => +w.r.ny.toFixed(1)));
let maxW = 0, maxP = 0, maxB = 0, agro = 0, inRock = 0;
const ms = [];
for (let m = 0; m < 4; m++) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 60 * 60; i++) {
    G.glowLabStep(L, dt, rnd);
    maxW = Math.max(maxW, L.worms.length); maxP = Math.max(maxP, L.parts.length); maxB = Math.max(maxB, L.booms.length);
    if (L.worms.some(w => w.st !== 'roam')) agro++;
    for (const w of L.worms) if (L.solid(w.r.x, w.r.y) || L.solid(w.f.x, w.f.y)) inRock++;
  }
  ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
check('the player passing: worms stand up (agro), strike, and some blow up', agro > 600 && L.strikes > 0 && L.kills > 2, { agro, strikes: L.strikes, kills: L.kills });
check('… put back: still GLOW_LAB_N worms or close after 4 minutes', L.worms.length >= G.GLOW_LAB_N - 1 && maxW <= G.GLOW_LAB_N, { now: L.worms.length, max: maxW });
check('nothing piles up: particles and blasts capped', maxP <= G.GLOW_LAB_PARTS && maxB < 10, { maxP, maxB });
check('a minute of steps costs no more at the end than at the start (within 2×)', ms[3] < Math.max(ms[0], ms[1]) * 2, ms.map(Math.round));
check('never inside rock', inRock === 0, inRock);
G.GLOW_CMD.reset = true; G.glowLabStep(L, dt, rnd);
check('Reset worms: a fresh room', L.worms.length === G.GLOW_LAB_N && L.parts.length < 12 && L.booms.length === 0 && !G.GLOW_CMD.reset, { n: L.worms.length, p: L.parts.length, b: L.booms.length });
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
