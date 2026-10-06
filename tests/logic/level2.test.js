// v129 floor 2's Dev knobs (dev/knobs.js L2_KNOBS, L2_LOOK, l2Decor): they reach floor 2 only; the
// decoration thins out, and the palette follows the colour knobs. (Floor 2's noise-cave knobs went
// with the noise cave in Level 2 stage 2: L2_KNOBS is the tomb's layout now, tests/logic/tomb.test.js.)
const G = require('../load');
const { makeLevel, DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, L2_KNOBS, L2_LOOK, THEMES, themeFor, hexArr, CW, CH, CELL } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hashMat = m => { let h = 0; for (let i = 0; i < m.length; i++) h = (Math.imul(h, 31) + m[i]) | 0; return h; };
const open = m => { let n = 0; for (let i = 0; i < m.length; i++) if (!m[i]) n++; return n / m.length; };
const reset = () => { for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k]; };
reset();

// floor 2 is the tomb since Level 2 stage 2 (world/tomb.js; its layout knobs: tests/logic/tomb.test.js).
// The palette at its defaults is still Tombs', and the other floors don't feel floor 2's knobs
check('defaults: the palette is Tombs\'',JSON.stringify(themeFor(2)) === JSON.stringify(THEMES[1]));
const f1 = hashMat(makeLevel(3, 1).mat), f3 = hashMat(makeLevel(3, 3).mat);
DEV.l2RoomsLo = DEV.l2RoomsHi = 20; DEV.l2GapLo = DEV.l2GapHi = 40;
check('floor 1 and 3 don\'t feel them', hashMat(makeLevel(3, 1).mat) === f1 && hashMat(makeLevel(3, 3).mat) === f3);
reset();

// decoration
reset();
// (since Level 2 stage 3 floor 2's decoration is the rooms' kits, baked into dimg: world/furnish.js)
const painted = lv => { let n = 0; for (let i = 3; i < lv.dimg.data.length; i += 4) if (lv.dimg.data[i] && !(lv.darkShade && lv.darkShade[i >> 2])) n++; return n; };   // (not the dark zones' fringe silk)
const props = painted(makeLevel(3, 2));
DEV.l2Decor = 0;
const none = painted(makeLevel(3, 2));
check('decoration ×0: no decoration', none === 0 && props > 0, [props, none]);
check('and floor 3 keeps its own', makeLevel(3, 3).props.length > 0);

// the look
reset();
DEV.l2Rock1 = '#ff0000'; DEV.l2Bg = '#00ff00';
const T = themeFor(2);
check('the colour knobs paint floor 2', T.rock[0].join() === '255,0,0' && T.bg.join() === '0,255,0' && T.rock[1].join() === THEMES[1].rock[1].join(), T);
check('and its rock comes out that colour', (() => { const lv = makeLevel(3, 2); for (let i = 0; i < lv.mat.length; i++) if (lv.mat[i] === 1) { const d = lv.img.data; return d[i * 4] > d[i * 4 + 1] + 40; } return false; })());
check('other floors keep theirs', themeFor(1) === THEMES[0] && themeFor(3) === THEMES[2]);
check('the theme keeps its name (its ambience)', T.name === 'Tombs');
reset();
check('the colour defaults are Tombs\' palette', L2_LOOK.every(([k]) => /^#[0-9a-f]{6}$/.test(DEV_DEFAULTS[k])) &&
  hexArr(DEV_DEFAULTS.l2Mortar).join() === THEMES[1].mortar.join() && hexArr(DEV_DEFAULTS.l2Bed2).join() === THEMES[1].bed[1].join());

// on the panel
check('every knob has a Dev row in its group', L2_KNOBS.every(r => DEV_META.some(m => m.k === r[0] + 'Lo' && m.g === 'level2')) &&
  L2_LOOK.every(r => DEV_META.some(m => m.k === r[0] && m.type === 'color')) && DEV_META.some(m => m.k === 'l2Decor'));
check('and the group is listed', DEV_GROUPS.some(g => g[0] === 'level2'));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
