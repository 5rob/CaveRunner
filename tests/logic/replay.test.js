// The death replay's pure parts: snapshot copies (rpClone), blending between snapshots
// (rpLerp / rpList / rpAt / rpFrame) and the terrain patches (rpCut / rpPaste / rpMerge).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const R = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { rpClone, rpLerp, rpList, rpAt, rpFrame, rpCut, rpPaste, rpMerge, RP_LISTS, RP_NUMS, RP_HZ, RP_BEFORE, RP_AFTER, RP_KEEP };')({ createElement: () => {} });

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---- the numbers the owner asked for ----
check('10 seconds before the death', R.RP_BEFORE === 10, R.RP_BEFORE);
check('3 seconds after it', R.RP_AFTER === 3, R.RP_AFTER);
check('keeps at least the 10 seconds while alive', R.RP_KEEP >= R.RP_BEFORE, R.RP_KEEP);

// ---- rpClone: own fields copied, RP_DEEP parts copied, anything else shared ----
const k = { name: 'static creature table' };
const e = { x: 1, y: 2, k, je: { hd: 0.5, tent: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]], u: { col: 0.3 } } };
const c = R.rpClone(e, 7);
check('clone has the id', c._r === 7, c._r);
check('clone is a new object', c !== e && c.x === 1);
check('creature table is shared', c.k === k);
check('brain is copied', c.je !== e.je && c.je.hd === 0.5);
check('tentacles are copied down to the points', c.je.tent[0][1] !== e.je.tent[0][1] && c.je.tent[0][1].x === 2);
check('looks (je.u) are shared, not copied', c.je.u === e.je.u);
e.x = 99; e.je.tent[0][1].x = 99; e.je.hd = 3;
check('later changes do not reach the copy', c.x === 1 && c.je.tent[0][1].x === 2 && c.je.hd === 0.5);
const typed = { x: 0, aim: { nx: 1, ny: 0, buf: new Float32Array(4) } };
const tc = R.rpClone(typed);
check('typed arrays are shared, not mangled', tc.aim.buf === typed.aim.buf);

// ---- rpLerp: positions slide, the rest jumps at halfway, angles go the short way ----
const a = { x: 0, y: 10, face: -1, mode: 'surf', hd: Math.PI - 0.1, aim: { nx: 1, ny: 0 } };
const b = { x: 10, y: 20, face: 1, mode: 'air', hd: -Math.PI + 0.1, aim: { nx: 0, ny: 1 } };
let m = R.rpLerp(a, b, 0.25);
check('x blends', near(m.x, 2.5), m.x);
check('y blends', near(m.y, 12.5), m.y);
check('facing does not blend (never 0)', m.face === -1, m.face);
check('strings take the nearer snapshot', m.mode === 'surf' && R.rpLerp(a, b, 0.75).mode === 'air');
check('nested aim blends', near(m.aim.nx, 0.75) && near(m.aim.ny, 0.25), m.aim);
check('angles go the short way round', Math.abs(Math.abs(R.rpLerp(a, b, 0.5).hd) - Math.PI) < 1e-9, R.rpLerp(a, b, 0.5).hd);
check('inputs untouched', a.x === 0 && b.x === 10 && a.aim.nx === 1);
const t1 = { je: { tent: [[{ x: 0, y: 0 }]] } }, t2 = { je: { tent: [[{ x: 4, y: 8 }]] } };
m = R.rpLerp(t1, t2, 0.5);
check('tentacle points blend', m.je.tent[0][0].x === 2 && m.je.tent[0][0].y === 4, m.je.tent);
const t3 = { je: { tent: [[{ x: 4, y: 8 }, { x: 5, y: 5 }]] } };
m = R.rpLerp(t1, t3, 0.25);
check('mismatched arrays snap instead of blending', m.je.tent[0].length === 1, m.je.tent);

// ---- rpList: matched by id; the dead fade out at halfway, the newborn in ----
const A = [{ _r: 1, x: 0 }, { _r: 2, x: 0 }], B = [{ _r: 1, x: 10 }, { _r: 3, x: 5 }];
let L = R.rpList(A, B, 0.3);
check('early: the matched one blends', L.find(q => q._r === 1).x === 3);
check('early: the one that died still shows', L.some(q => q._r === 2));
check('early: the newborn not yet', !L.some(q => q._r === 3));
L = R.rpList(A, B, 0.7);
check('late: the one that died is gone', !L.some(q => q._r === 2));
check('late: the newborn shows', L.some(q => q._r === 3));

// ---- rpAt: finds the pair either side and the fraction ----
const snaps = [0, 0.05, 0.1, 0.15].map(t => ({ t }));
let at = R.rpAt(snaps, 0.075);
check('rpAt picks the pair', at.a.t === 0.05 && at.b.t === 0.1, [at.a.t, at.b.t]);
check('rpAt fraction', near(at.u, 0.5), at.u);
at = R.rpAt(snaps, -1);
check('before the start: the first', at.a === snaps[0] && at.u === 0);
at = R.rpAt(snaps, 9);
check('after the end: the last', at.a === snaps[3] && at.u === 0);

// ---- rpFrame: a whole scene ----
const snap = (t, px) => {
  const S = { t, p: { x: px, y: 0, aim: { nx: 1, ny: 0 } }, ghost: null, fire: new Int32Array(0), fireT: new Uint16Array(0) };
  for (const k2 of R.RP_LISTS) S[k2] = [];
  for (const k2 of R.RP_NUMS) S[k2] = t * 10;
  S.enemies = [{ _r: 5, x: px * 2, ty: 1, k: {} }];
  return S;
};
const F = R.rpFrame([snap(0, 0), snap(0.05, 10)], 0.02);
check('frame: player blends', near(F.p.x, 4), F.p.x);
check('frame: enemies blend', near(F.enemies[0].x, 8), F.enemies[0].x);
check('frame: numbers blend', near(F.time, 0.2), F.time);
check('frame: every list is there', R.RP_LISTS.every(k2 => Array.isArray(F[k2])));
check('frame: near snapshot for the discrete bits', F.near && F.near.t === 0);

// ---- terrain patches ----
const W = 8, H = 6, data = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < data.length; i++) data[i] = i % 251;
const cut = R.rpCut(data, W, 2, 1, 3, 2);
check('cut is the right size', cut.length === 3 * 2 * 4, cut.length);
check('cut takes the right pixels', cut[0] === data[(1 * W + 2) * 4] && cut[cut.length - 1] === data[((2 * W + 4) * 4) + 3]);
const blank = new Uint8ClampedArray(W * H * 4);
R.rpPaste(blank, W, { x: 2, y: 1, w: 3, h: 2, px: cut });
let same = true, outside = true;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let ch = 0; ch < 4; ch++) {
  const i = (y * W + x) * 4 + ch, inside = x >= 2 && x < 5 && y >= 1 && y < 3;
  if (inside && blank[i] !== data[i]) same = false;
  if (!inside && blank[i] !== 0) outside = false;
}
check('paste puts it back in place', same);
check('paste touches nothing else', outside);

// rpMerge: clipped to the map, per layer, one box when close together
let M = R.rpMerge([['t', 10, 10, 4, 4], ['t', 12, 12, 4, 4], ['d', 0, 0, 2, 2]], 640, 1600);
check('merge: close rects become one box per layer', M.length === 2, M);
check('merge: the box covers both', M.some(r => r[0] === 't' && r[1] === 10 && r[2] === 10 && r[3] === 6 && r[4] === 6), M);
M = R.rpMerge([['t', 0, 0, 4, 4], ['t', 600, 1500, 4, 4]], 640, 1600);
check('merge: far apart stay separate', M.length === 2 && M.every(r => r[3] === 4), M);
M = R.rpMerge([['t', -5, -5, 10, 10], ['d', 638, 10, 10, 4]], 640, 1600);
check('merge: clipped to the map', M.find(r => r[0] === 't')[1] === 0 && M.find(r => r[0] === 't')[3] === 5 &&
  M.find(r => r[0] === 'd')[3] === 2, M);
check('merge: nothing in, nothing out', R.rpMerge([], 640, 1600).length === 0);

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
