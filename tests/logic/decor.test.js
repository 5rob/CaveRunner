// v58: level decoration (pass 2 bakes + pass 3 props). Pure checks on decorate():
// every theme's five entries turn up, nothing lands in the shop or on a keep-out spot,
// no two props overlap, every prop starts anchored, the cave's solid/open shape is untouched,
// and a floor's decoration is the floor's own (floor 13 dresses like floor 1).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { PLANTS, makeLevel, decorate, decorFor, cullDecor, propAnchored, DECOR, CW, CH, BW, BH, CELL, SHOP_Y, ImageData };')(
  { createElement: () => {} });
const { makeLevel, decorate, decorFor, cullDecor, propAnchored, DECOR, CW, CH, BW, BH, SHOP_Y, ImageData } = G;

let pass = 0, fail = 0;
const check = (n, ok, x) => { if (ok) pass++; else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

check('twelve themes, five decorations each', DECOR.length === 12 && DECOR.every(t => t.length === 5), DECOR.map(t => t.length));
check('floor 13 dresses like floor 1', decorFor(13) === decorFor(1));

// an arched vine (v87) is a curve over a big box, so it's the curve that mustn't cross a prop
const inBox = (x, y, b) => x > b.x + b.l && x < b.x + b.r && y > b.y + b.t0 && y < b.y + b.b;
const overlap = (a, b) => !(a.k === 'climb' && b.k === 'climb') && (a.arc ? a.arc.some(([x, y]) => inBox(a.x + x, a.y + y, b)) :
  b.arc ? b.arc.some(([x, y]) => inBox(b.x + x, b.y + y, a)) :
  a.x + a.l < b.x + b.r && a.x + a.r > b.x + b.l && a.y + a.t0 < b.y + b.b && a.y + a.b > b.y + b.t0);
for (let floor = 1; floor <= 12; floor++) {
  for (const seed of [3, 71]) {
    const lv = makeLevel(seed, floor);
    const tag = 'floor ' + floor + ' seed ' + seed;
    const ids = new Set(lv.props.map(p => p.id));
    const want = decorFor(floor);
    for (const d of want) {
      if (d.kind === 'amb') check(tag + ': ' + d.name + ' is in the ambience', lv.amb.includes(d.style));
      else if (d.kind !== 'bake') check(tag + ': ' + d.name + ' placed', ids.has(d.id), [...ids]);
    }
    check(tag + ': nothing in the shop', lv.props.every(p => p.y + p.b < SHOP_Y));
    let bad = 0;
    for (let i = 0; i < lv.props.length; i++) for (let j = i + 1; j < lv.props.length; j++)
      if (overlap(lv.props[i], lv.props[j])) bad++;
    check(tag + ': no two props overlap', bad === 0, bad);
    check(tag + ': every prop starts anchored', lv.props.every(p => propAnchored(p, lv.mat)));
    const near = (p, q, r) => Math.hypot(p.x - q.x, p.y - q.y) < r;
    check(tag + ': clear of the way in and the exit', !lv.props.some(p => near(p, lv.arrival, 30) || near(p, lv.start, 20)));

    // run it again on a copy: the cave's solid/open shape must be exactly what it was
    const before = Uint8Array.from(lv.mat, v => v ? 1 : 0);
    const mat = Uint8Array.from(lv.mat);
    const r = decorate(mat, new ImageData(CW, CH), new ImageData(CW, CH), new ImageData(BW, BH), floor, seed, []);
    let changed = 0;
    for (let i = 0; i < mat.length; i++) if ((mat[i] ? 1 : 0) !== before[i]) changed++;
    check(tag + ': decoration never makes or clears rock', changed === 0, changed);
    for (const d of want) if (d.kind === 'bake') check(tag + ': ' + d.name + ' baked', r.baked[d.id] > 0, r.baked);
    if (want.some(d => d.kind === 'climb' && G.PLANTS[d.style])) {
      check(tag + ': it grows groves', r.baked.groves >= 8, r.baked.groves);
      // no lonely vines: nearly every plant has another within a few steps
      const pl = lv.props.filter(p => p.k === 'climb' && G.PLANTS[p.st]);
      const alone = pl.filter(p => !pl.some(q => q !== p && Math.abs(q.x - p.x) < 24 && Math.abs(q.y - p.y) < 30)).length;
      check(tag + ': vines come in bunches', alone / pl.length < 0.15, [alone, pl.length]);
    }
  }
}

// the decoration layer only ever paints open cells (it must not hide behind rock or block anything)
{
  const lv = makeLevel(9, 2);
  let onRock = 0, painted = 0;
  for (let i = 0; i < CW * CH; i++) if (lv.dimg.data[i * 4 + 3]) { painted++; if (lv.mat[i]) onRock++; }
  check('the decoration layer has something on it', painted > 1000, painted);
  check('and none of it is on rock', onRock === 0, onRock);
}

// the load-time cleanup keeps the first of two clashing props and drops keep-out spots
{
  const a = { x: 0, y: 0, l: -5, t0: -5, r: 5, b: 5 }, b = { x: 4, y: 0, l: -5, t0: -5, r: 5, b: 5 };
  const c = { x: 100, y: 0, l: -5, t0: -5, r: 5, b: 5 };
  const out = cullDecor([a, b, c], [{ x: 100, y: 0, r: 10 }]);
  check('cleanup keeps the first of an overlapping pair', out.length === 1 && out[0] === a, out.length);
}
// an anchor holds while any of its three cells is rock
{
  const mat = new Uint8Array(CW * CH);
  const pr = { anc: [10, 10] };
  check('no rock: not anchored', !propAnchored(pr, mat));
  mat[10 * CW + 11] = 1;
  check('a neighbour cell still holds it', propAnchored(pr, mat));
  check('a free-floating prop is always fine', propAnchored({}, mat));
}

console.log(fail ? fail + ' failed' : pass + ' passed, 0 failed');
process.exit(fail ? 1 : 0);
