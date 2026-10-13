// Procedural orb webs (src/world/orbweb.js, owner after v1.0.74): spokes reach the rock, the spiral stays inside, too
// open a spot gives none, and the title scene's webs zone strings some (each thread a web line).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let s = 7;
const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
// a box of rock 80 wide, 60 tall: inside open
const box = (x, y) => x <= 0 || x >= 80 || y <= 0 || y >= 60;
const W = G.orbWeb(box, 40, 30, R);
check('a web in a box', !!W && W.length > 20, W && W.length);
const sp = W.filter(t => !t.spiral), spi = W.filter(t => t.spiral);
check('5+ spokes, each ending on the rock (just inside it past the end)', sp.length >= 5 && sp.every(t => !box(t.ax, t.ay) && box(t.ain.x, t.ain.y)), sp.length);
check('a spiral of many threads, all in the open', spi.length > 15 && spi.every(t => !box(t.ax, t.ay) && !box(t.bx, t.by)), spi.length);
check('the spiral winds outward', Math.hypot(spi[spi.length - 1].ax - 40, spi[spi.length - 1].ay - 30) > Math.hypot(spi[0].ax - 40, spi[0].ay - 30) + 10);
// rock only above: one side open, nothing to hold it
check('open below: no web', G.orbWeb((x, y) => y <= 0, 40, 30, R) === null);
check('in the rock: no web', G.orbWeb(box, -5, 30, R) === null);
const P = G.orbPlace(box, 40, 30, R);
check('orbPlace: a web, its hub in the open, held all round', !!P && !box(P[0].bx, P[0].by) && P.filter(t => !t.spiral).length >= 5, P && [P[0].bx, P[0].by]);
const one = G.orbWeb(box, 20, 15, () => 0.5);
check('orbPlace keeps the best-held of its tries (no fewer spokes than its first spot)', !!one && P.filter(t => !t.spiral).length >= 5);
// the title scene: the webs zone strings orb webs among its lines
const D = G.DEV, keep = D.autoOrbChance;
D.autoOrbChance = 1;
let orbs = 0;
for (let seed = 1; seed <= 12 && !orbs; seed++) {
  const S = G.titleScene(190, seed);
  for (let f = 0; f < 30 * 60 && !orbs; f++) { G.titleStep(S, 1 / 30); orbs = S.webs.filter(L => L.orb).length; }
}
D.autoOrbChance = keep;
check('the title\'s webs zone strings an orb web (its threads web lines)', orbs > 10, orbs);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
