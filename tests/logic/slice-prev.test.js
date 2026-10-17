// Dev → Bats / Glow worms: the shared slice preview (auto/slicelab.js; drawn by ui/slicepreview.js). For each enemy: a random
// Coal Seams slice with it on, the auto player crossing to the right edge, a fresh run after DEV.slicePrevWait, the same slice
// each run; and over a few runs nothing piles up and a run costs no more at the end than at the start (the bats' old preview slowed).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const dt = 1 / 60, VH = 320;
for (const kind of ['bats', 'glow']) {
  const f = G.sliceFind(kind, VH, rnd);
  const P = { kind, seed: f.seed, n: f.n, t: 0, dead: 0, wait: 0, runs: 0, done: false };
  const rows = [];
  for (let loop = 0; loop < 4; loop++) {
    const S = G.sliceScene(P, VH, () => 0.5), x0 = S.scroll, has = G.sliceHas(S, kind);
    const t0 = process.hrtime.bigint();
    let i = 0, again = false, doneAt = -1;
    let late = 0;   // his shots fired after he finished (owner: an invisible player kept shooting in the wait)
    for (; i < 60 * 40 && !again; i++) {
      G.titleStep(S, dt); if (doneAt >= 0) late += S.shots.filter(o => !o.foe && !o.old).length;
      again = G.sliceStep(P, S, dt); if (P.done && doneAt < 0) { doneAt = i; for (const o of S.shots) o.old = true; }
    }
    const r = S.runners[0];
    rows.push({ ms: Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(1, i) * 60, has, x0, done: doneAt, wait: (i - doneAt) / 60, edge: P.t < 29.9, late, out: r.out, foes: S.foes.length, parts: S.parts.length });
  }
  check(kind + ': a slice with it on, the same slice every run', rows.every(q => q.has && q.x0 === rows[0].x0), rows.map(q => [q.has, q.x0]));
  check(kind + ': the player crosses to the right edge (or falls), then a fresh run after slicePrevWait', rows.every(q => q.done > 0 && q.done < 60 * 29 && Math.abs(q.wait - D.slicePrevWait) < 0.1), rows.map(q => [q.done, q.edge, +q.wait.toFixed(2)]));
  check(kind + ': no shots from him in the wait', rows.every(q => q.late === 0), rows.map(q => q.late));
  check(kind + ': the runs the same (the same goal): he ends at about the same frame each run (within 0.5 s: the game has a little Math.random), so nothing carried over', rows.every(q => Math.abs(q.done - rows[0].done) <= 30), rows.map(q => q.done));
check(kind + ': nothing piles up over runs (foes, particles)', rows.every(q => q.foes < 120 && q.parts <= G.TITLE_PARTS + 100), rows.map(q => [q.foes, q.parts]));
  check(kind + ': a run\'s second of steps costs no more at the end than at the start (within 2×)', rows[3].ms < Math.max(rows[0].ms, rows[1].ms) * 2, rows.map(q => Math.round(q.ms)));
}
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
