// The gun skins (art/gunart.js, LIST4 item 2): every sprite well-formed (h rows of w palette
// chars, indices within its palette, a grip inside it, ids unique), and the save keeps a known
// skin and drops an unknown one (save.js cleanGun).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const A = G.GUN_ART;
check('there are skins', A.length >= 20, A.length);
const ids = new Set();
for (const a of A) {
  const rows = a.px.split('/');
  const bad = [];
  if (rows.length !== a.h) bad.push('rows ' + rows.length + ' != h ' + a.h);
  rows.forEach((r, y) => {
    if (r.length !== a.w) bad.push('row ' + y + ' length ' + r.length);
    for (const ch of r) if (ch !== '.' && !(G.GUN_CH.indexOf(ch) >= 0 && G.GUN_CH.indexOf(ch) < a.pal.length)) bad.push('char ' + ch);
  });
  if (!a.pal.every(c => /^#[0-9a-f]{6}$/.test(c))) bad.push('palette');
  if (!(a.grip[0] >= 0 && a.grip[0] < a.w && a.grip[1] >= 0 && a.grip[1] < a.h)) bad.push('grip ' + a.grip);
  if (!a.name || !/^[a-z0-9]+$/.test(a.id)) bad.push('id/name');
  if (ids.has(a.id)) bad.push('duplicate id');
  ids.add(a.id);
  check(a.id + ' well-formed (' + a.w + '×' + a.h + ', ' + a.pal.length + ' colours)', !bad.length, bad.length ? bad.slice(0, 3) : undefined);
}
check('gunArt finds by id', G.gunArt(A[0].id) === A[0] && G.gunArt('nope') === null && G.gunArt(undefined) === null);

const base = { name: 'Gun', slots: [null, null] };
const kept = G.cleanGun(Object.assign({ art: A[3].id }, base));
check('the save keeps a known skin', kept.art === A[3].id, kept.art);
const dropped = G.cleanGun(Object.assign({ art: 'not-a-skin' }, base));
check('the save drops an unknown skin', !('art' in dropped), dropped.art);

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all passed');
