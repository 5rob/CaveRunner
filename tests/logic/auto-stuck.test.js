// Grem: elites and the boss don't get stuck, and a boss spider's legs walk. The cause found (owner: "still not seeing leg
// movement on boss spider", "elites still getting stuck"): a spider sits SPIDER.hold (6) off the rock whatever its size, and
// auto/enemies.js unbury, measuring by its size, called that buried on every floor: lifted, fell, lifted… for good (mode
// 'fall': no walking, no gait). Now a spider's seat is its feet's reach (spiderHold) and unbury measures by that. The fallback:
// unstick (DEV.autoStuckT / autoStuckR / autoStuckHop). In a sandbox (a level scene, emptied), then a few real levels.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
Object.assign(D, { autoFoeDmg: 0 });

const sandbox = seed => {
  const S = G.levelScene(200, seed, 2, undefined, G.newRun(seed).players.slice(0, 2), 1, null, true);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9;
  S.props.length = 0; S.webs.length = 0; S.foes.length = 0; S.still = false;
  for (const r of S.runners) r.hide = false;
  return S;
};
const steps = (S, s, f) => { for (let i = 0; i < Math.round(s * 60); i++) { G.titleStep(S, 1 / 60); if (f) f(i); } };

// ---- a boss spider and an elite spider on the floor walk (not the fall loop), legs cycling ----
for (const [name, mk] of [['boss', () => G.bossKind('hamahakki', 2, G.gremFoe)], ['elite', () => G.eliteOf(G.gremFoe('hamahakki', 2), 1)]]) {
  const S = sandbox(3), x = S.scroll + 170;
  const f = G.titleFoeAt(S, mk(), x);
  f.y = f.ty = G.titleFloor(x, S) - f.r - 1;
  f.aggro = true; S.foes.push(f);
  const modes = {};
  let g0 = null, x0 = f.x, far = 0;
  steps(S, 4, i => { if (i === 30) g0 = f.sp && f.sp.gait || 0; if (f.sp) modes[f.sp.mode] = (modes[f.sp.mode] || 0) + 1; far = Math.max(far, Math.abs(f.x - x0)); });
  const n = Object.values(modes).reduce((a, b) => a + b, 0) || 1;
  check(`${name} spider: hardly ever falling (it was always falling)`, (modes.fall || 0) / n < 0.2, modes);
  check(`${name} spider: walks (moves along)`, far > 15, Math.round(far));
  check(`${name} spider: its legs cycle (gait advances)`, f.sp && f.sp.gait - g0 > 6, f.sp && +(f.sp.gait - g0).toFixed(1));
  check(`${name} spider: sits its feet's reach off the floor (not sunk in, not lifted)`, f.sp && f.sp.mode !== 'surf' || Math.abs(G.titleFloor(f.x, S) - f.y - G.spiderHold(f)) < 4, [Math.round(G.titleFloor(f.x, S) - f.y), +G.spiderHold(f).toFixed(1)]);
}

// ---- unstick: no progress for autoStuckT s, far from the team → on open floor, nearer the team ----
{
  const S = sandbox(5), x = S.scroll + 200;
  const f = G.titleFoeAt(S, G.eliteOf(G.gremFoe('hurtta', 2), 0.5), x);
  f.aggro = true;
  const tx = S.scroll + S.runners[0].x + G.PW / 2;
  G.unstick(S, f);
  check('first look: just noted where it is', f.x === x && f.stk && f.stk.t === S.t);
  S.t += D.autoStuckT * 0.5; G.unstick(S, f);
  check('… not yet past autoStuckT: left alone', f.x === x);
  S.t += D.autoStuckT; G.unstick(S, f);
  const fy = G.titleFloor(f.x, S);
  check('past autoStuckT: moved toward the team', f.x < x - 10 && f.x > tx, [Math.round(x - S.scroll), Math.round(f.x - S.scroll), Math.round(tx - S.scroll)]);
  check('… onto open floor (out of rock, its size above the floor)', !G.titleSolid(S, f.x - S.scroll, f.y) && f.y <= fy - Math.min(f.r, (fy - G.titleCeil(f.x, S)) / 2) + 0.5, [Math.round(f.y), Math.round(fy)]);
  const t = G.titleFoeAt(S, G.eliteOf(G.gremFoe('snipu', 2), 0.5), x);
  t.aggro = true; G.unstick(S, t); S.t += D.autoStuckT * 2; G.unstick(S, t);
  check('a turret holds station: never moved', t.x === x);
  const c = G.titleFoeAt(S, G.eliteOf(G.gremFoe('hurtta', 2), 0.5), tx + 30);
  c.aggro = true; const cx = c.x; G.unstick(S, c); S.t += D.autoStuckT * 2; G.unstick(S, c);
  check('one at the team (fighting it) is not stuck', c.x === cx);
}

// ---- real levels: no elite or boss on screen, hunting, held in one place past autoStuckT + 1 s ----
{
  let worst = 0, where = null;
  for (const seed of [1, 2, 13]) {
    const S = G.levelScene(200, seed, 2, undefined, G.newRun(seed).players.slice(0, 2), 1 + seed % 6, null, true);
    const L = S.lvl.data, tr = new Map();
    for (let i = 0; i < 60 * 120 && L.phase !== 'arena' || (i < 60 * 130 && L.phase === 'arena'); i++) {
      G.titleStep(S, 1 / 60);
      const B = L.boss;
      for (const e of L.elites.map(e => e.f).concat(B ? [B] : [])) {
        if (!e || e.hp <= 0 || e.waiting || !S.foes.includes(e) || e.x - S.scroll < 0 || e.x - S.scroll > G.TITLE_VW || /turret|nest/.test(e.k.act)) continue;
        let t = tr.get(e); if (!t) tr.set(e, t = { x: e.x, y: e.y, t: 0 });
        const nd = Math.min(...S.runners.filter(r => !r.out).map(r => Math.hypot(S.scroll + r.x + G.PW / 2 - e.x, r.y + G.PH / 2 - e.y)));
        if (Math.hypot(e.x - t.x, e.y - t.y) > D.autoStuckR || !e.aggro || nd < e.r + 60) { t.x = e.x; t.y = e.y; t.t = 0; } else t.t += 1 / 60;
        if (t.t > worst) { worst = t.t; where = [seed, e.k.act, e.k.boss ? 'boss' : 'elite', e.sp && e.sp.mode]; }
      }
    }
  }
  check('real levels: none held in one place past autoStuckT + 1 s ', worst < D.autoStuckT + 1, [+worst.toFixed(1), where]);
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall ok');
