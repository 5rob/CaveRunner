// v129 floor 2's Dev knobs (dev/knobs.js L2_KNOBS, L2_LOOK, l2Decor): at their defaults floor 2
// is the cave it was before them (hashes pinned from v130: v128's cave plus the three exits along the top); they reach floor 2 only; turned,
// the cave opens up or closes in, the main route still runs shop to exit, the decoration
// thins out, and the palette follows the colour knobs.
const G = require('../load');
const { makeLevel, DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, L2_KNOBS, L2_LOOK, THEMES, themeFor, hexArr, CW, CH, CELL } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hashMat = m => { let h = 0; for (let i = 0; i < m.length; i++) h = (Math.imul(h, 31) + m[i]) | 0; return h; };
const open = m => { let n = 0; for (let i = 0; i < m.length; i++) if (!m[i]) n++; return n / m.length; };
const reset = () => { for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k]; };
reset();

// at the defaults: the same caves as v130 (v128's, with the exits along the top)
check('defaults: floor 2 is the cave it was (seed 3)', hashMat(makeLevel(3, 2).mat) === -1476989531);
check('defaults: floor 2 is the cave it was (seed 77)', hashMat(makeLevel(77, 2).mat) === -286057203);
check('defaults: the palette is Coal seams\'', JSON.stringify(themeFor(2)) === JSON.stringify(THEMES[1]));

// only floor 2 feels them
const f1 = hashMat(makeLevel(3, 1).mat), f3 = hashMat(makeLevel(3, 3).mat);
DEV.l2WormsLo = DEV.l2WormsHi = 140; DEV.l2OpenLo = DEV.l2OpenHi = 0.25;
check('floor 1 and 3 don\'t feel them', hashMat(makeLevel(3, 1).mat) === f1 && hashMat(makeLevel(3, 3).mat) === f3);
reset();
const base2 = makeLevel(3, 2), base = open(base2.mat);
DEV.l2WormsLo = DEV.l2WormsHi = 140; DEV.l2OpenLo = DEV.l2OpenHi = 0.25;
const wide = makeLevel(3, 2);
reset();
DEV.l2WormsLo = DEV.l2WormsHi = 0; DEV.l2OpenLo = DEV.l2OpenHi = 0.7; DEV.l2PocketLo = DEV.l2PocketHi = 0.2;
const tight = makeLevel(3, 2);
check('more tunnels and vast areas: more open cave', open(wide.mat) > base + 0.03, [base, open(wide.mat)]);
check('fewer: less open cave', open(tight.mat) < base - 0.03, [base, open(tight.mat)]);

// the main route still runs from the shop to the exit, however tight (a 6 x 11 box flood fill)
const reaches = lv => {
  const { mat, start } = lv, pw = 6, ph = 11;
  const fits = (x, y) => { for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= CW || yy >= CH || mat[yy * CW + xx]) return false; } return true; };
  const seen = new Uint8Array(CW * CH), q = [];
  const sx = Math.round(start.x / CELL), sy = Math.round(start.y / CELL);
  if (!fits(sx, sy)) return false;
  q.push(sx, sy); seen[sy * CW + sx] = 1;
  let minY = sy;
  while (q.length) {
    const y = q.pop(), x = q.pop();
    if (y < minY) minY = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || seen[ny * CW + nx] || !fits(nx, ny)) continue;
      seen[ny * CW + nx] = 1; q.push(nx, ny);
    }
  }
  return minY <= 40;
};
check('defaults: the way up is there', reaches(base2));
check('tight: the way up is still there', reaches(tight), [tight.start, tight.portal]);
reset();
DEV.l2SmoothLo = DEV.l2SmoothHi = 0; DEV.l2LedgesLo = DEV.l2LedgesHi = 400; DEV.l2FloatsLo = DEV.l2FloatsHi = 150;
const rough = makeLevel(3, 2);
check('rough and cluttered: the way up is still there', reaches(rough));

// decoration
reset();
const props = makeLevel(3, 2).props.length;
DEV.l2Decor = 0;
const none = makeLevel(3, 2).props.length;
check('decoration ×0: no props', none === 0 && props > 0, [props, none]);
check('and floor 3 keeps its own', makeLevel(3, 3).props.length > 0);

// the look
reset();
DEV.l2Rock1 = '#ff0000'; DEV.l2Bg = '#00ff00';
const T = themeFor(2);
check('the colour knobs paint floor 2', T.rock[0].join() === '255,0,0' && T.bg.join() === '0,255,0' && T.rock[1].join() === THEMES[1].rock[1].join(), T);
check('and its rock comes out that colour', (() => { const lv = makeLevel(3, 2); for (let i = 0; i < lv.mat.length; i++) if (lv.mat[i] === 1) { const d = lv.img.data; return d[i * 4] > d[i * 4 + 1] + 40; } return false; })());
check('other floors keep theirs', themeFor(1) === THEMES[0] && themeFor(3) === THEMES[2]);
check('the theme keeps its name (its ambience)', T.name === 'Coal seams');
reset();
check('the colour defaults are Coal seams\' palette', L2_LOOK.every(([k]) => /^#[0-9a-f]{6}$/.test(DEV_DEFAULTS[k])) &&
  hexArr(DEV_DEFAULTS.l2Mortar).join() === THEMES[1].mortar.join() && hexArr(DEV_DEFAULTS.l2Bed2).join() === THEMES[1].bed[1].join());

// on the panel
check('every knob has a Dev row in its group', L2_KNOBS.every(r => DEV_META.some(m => m.k === r[0] + 'Lo' && m.g === 'level2')) &&
  L2_LOOK.every(r => DEV_META.some(m => m.k === r[0] && m.type === 'color')) && DEV_META.some(m => m.k === 'l2Decor'));
check('and the group is listed', DEV_GROUPS.some(g => g[0] === 'level2'));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
