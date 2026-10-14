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
// (owner, after v1.0.76: no whole webs left on nothing) what still holds once threads go (orbHeld)
const left = W.map(t => ({ ax: t.ax, ay: t.ay, bx: t.bx, by: t.by, sp: t.spiral, fr: !t.spiral && !!t.bin }));
const all = G.orbHeld(left, () => true);
check('orbHeld: the whole web holds', all.every(v => v === 'keep'), all.filter(v => v !== 'keep').length);
const spokeI = left.map((t, i) => i).filter(i => !left[i].sp);
const cut1 = left.filter((_, i) => i !== spokeI[0]), one1 = G.orbHeld(cut1, () => true);
check('one spoke cut: the rest holds, but the spiral threads on it come down', one1.filter(v => v === 'fall').length > 0 && one1.filter((v, i) => !cut1[i].sp && v === 'keep').length === spokeI.length - 1, one1.filter(v => v === 'fall').length);
const two = left.filter((t, i) => t.sp || spokeI.slice(0, 2).includes(i)), two1 = G.orbHeld(two, () => true);
check('all but 2 spokes cut: the hub goes, those 2 hang from their rock, every spiral thread falls', two1.every((v, i) => (two[i].sp ? v === 'fall' : v === 'hang')), two1);
const dug = G.orbHeld(left, i => i !== spokeI[1] && i !== spokeI[2]);
check("a spoke's rock dug away: that spoke falls", dug[spokeI[1]] === 'fall' && dug[spokeI[0]] === 'keep');
// a frame across an open side: cut it and the spokes ending on it, and their spiral, come down
const open = (x, y) => y <= 0 || x <= 0 || x >= 80;
let F = null;
for (let k = 0; k < 40 && !(F && F.some(t => !t.spiral && !t.bin && !t.ain)); k++) F = G.orbWeb(open, 40, 25 + k % 10, R);   // (a frame with spokes ending on it)
const FL = (F || []).map(t => ({ ax: t.ax, ay: t.ay, bx: t.bx, by: t.by, sp: t.spiral, fr: !t.spiral && !!t.bin }));
const fr = FL.findIndex(t => t.fr), onF = F.filter(t => !t.spiral && !t.bin && !t.ain);
const noF = FL.filter((_, i) => i !== fr), nf = G.orbHeld(noF, i => !!(F.filter((_, j) => j !== fr)[i].ain));
check('frame cut: the spokes ending on it come down', fr >= 0 && onF.length > 0 && nf.filter(v => v === 'fall').length >= onF.length, { fr, onF: onF.length, falls: nf.filter(v => v === 'fall').length });
// the scene: a web's hub cleared (every spoke cut there) leaves nothing of it up
D.autoOrbChance = 1;
let hubGone = null;
for (let seed = 1; seed <= 12 && hubGone === null; seed++) {
  const S = G.titleScene(190, seed);
  for (let f = 0; f < 30 * 60 && hubGone === null; f++) {
    G.titleStep(S, 1 / 30);
    const L = S.webs.find(w => w.orb && !w.sp && !w.fr && w.b0x - S.scroll > 20 && w.b0x - S.scroll < 200);
    if (!L) continue;
    const r = S.runners[0], id = L.orb;
    r.x = L.b0x - S.scroll - G.PW / 2 - 6; r.y = L.b0y - G.PH / 2;   // (titleClearWebs clears round his gun: his middle + 6)
    G.titleClearWebs(S, r, false, 4);
    G.titleStep(S, 1 / 30);
    hubGone = S.webs.filter(w => w.orb === id).length;
  }
}
D.autoOrbChance = keep;
check('hub cleared: none of that web stays up', hubGone === 0, hubGone);
// (owner, after v1.0.78) a spoke gone: the hub moves to a new rest point, away from that spoke's anchor and a little lower
const four = [{ ax: 0, ay: -20 }, { ax: 20, ay: 0 }, { ax: 0, ay: 20 }, { ax: -20, ay: 0 }];
const same = G.orbHubRest(0, 0, four, [true, true, true, true]), noR = G.orbHubRest(0, 0, four, [true, false, true, true]);
check('all spokes: the hub stays put', Math.abs(same.x) + Math.abs(same.y) < 1e-9, same);
check('right spoke gone: the hub swings left and drops', noR.x < -3 && noR.y > 0, noR);
const H = { x: 0, y: 0, vx: 0, vy: 0, tx: noR.x, ty: noR.y };
let moving = true, n = 0, past = false;
for (; moving && n < 600; n++) { moving = G.orbSpring(H, 1 / 60); if (H.x < noR.x) past = true; }
check('the hub swings past and settles there', past && !moving && Math.hypot(H.x - noR.x, H.y - noR.y) < 0.2, { n, H });
// the scene: one spoke cut mid-way, the hub moves and the spiral threads still sit on their spokes
D.autoOrbChance = 1;
let moved = null;
for (let seed = 1; seed <= 12 && moved === null; seed++) {
  const S = G.titleScene(190, seed);
  for (let f = 0; f < 30 * 60 && moved === null; f++) {
    G.titleStep(S, 1 / 30);
    const L = S.webs.find(w => w.orb && !w.sp && !w.fr && w.b0x - S.scroll > 40 && w.b0x - S.scroll < 180 && Math.hypot(w.b0x - w.a0x, w.b0y - w.a0y) > 30);
    if (!L || !S.orbs || !S.orbs[L.orb]) continue;
    const id = L.orb, H0 = { x: S.orbs[id].x, y: S.orbs[id].y };
    L.out = true; S.webs = S.webs.filter(w => w !== L);
    G.titleOrbSettle(S, id);
    for (let k = 0; k < 60; k++) G.titleStep(S, 1 / 30);
    const Hn = S.orbs[id], left = S.webs.filter(w => w.orb === id);
    if (!Hn || !left.length) continue;
    const sp = left.filter(w => w.sp && w.oa), on = sp.every(w => Math.hypot(w.a0x - (w.oa.s.a0x + (w.oa.s.b0x - w.oa.s.a0x) * w.oa.u), w.a0y - (w.oa.s.a0y + (w.oa.s.b0y - w.oa.s.a0y) * w.oa.u)) < 0.01);
    const hubOn = left.filter(w => !w.sp && !w.fr).every(w => Math.abs(w.b0x - Hn.x) < 0.01 && Math.abs(w.b0y - Hn.y) < 0.01);
    moved = { d: Math.hypot(Hn.x - H0.x, Hn.y - H0.y), on, hubOn, sp: sp.length };
  }
}
D.autoOrbChance = keep;
check('a spoke cut in the scene: the hub moved, its spokes and spiral went with it', !!moved && moved.d > 0.5 && moved.on && moved.hubOn, moved);
// (owner, after v1.0.78: webs popped on) a level strings every orb web before it comes into view, big ones too
D.autoOrbChance = 1;
let made = 0, pops = 0, big = 0;
for (let seed = 1; seed <= 4; seed++) {
  const S = G.levelScene(200, seed, 1), seen = new Set();
  for (let f = 0; f < 30 * 30; f++) {
    G.titleStep(S, 1 / 30);
    for (const L of S.webs) if (L.orb && !seen.has(L.orb)) {
      seen.add(L.orb); made++;
      const T = S.webs.filter(w => w.orb === L.orb), x0 = Math.min(...T.map(w => Math.min(w.a0x, w.b0x))), x1 = Math.max(...T.map(w => Math.max(w.a0x, w.b0x)));
      if (x0 - S.scroll < G.TITLE_VW && S.t > 0.1) pops++;
      if (x1 - x0 > 120) big++;
    }
  }
}
D.autoOrbChance = keep;
check('no orb web strung in view in a level, big ones still made', made > 10 && pops === 0 && big > 0, { made, pops, big });
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
