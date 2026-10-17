// The rebuilt Dev menu (dev/knobs.js DEV_PLACES, DEV_KNOB_PLACE, devPlaceOf; ui/devpanel.js): every knob sits on exactly
// one page, every page exists and has something on it, the sides and levels are real, and Copy Dev settings still holds
// every knob a page shows (a change on any page reaches the copy).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x).slice(0, 400) : ''}`); };

const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

const ids = G.DEV_PLACES.map(p => p.id);
check('page ids unique', new Set(ids).size === ids.length, ids);
const lvIds = G.DEV_LEVELS.map(l => l[0]);
check('every page on a real side and level', G.DEV_PLACES.every(p => (p.side === 'global' && !p.lv) || (p.side === 'level' && lvIds.includes(p.lv))),
  G.DEV_PLACES.filter(p => !(p.side === 'global' || lvIds.includes(p.lv))).map(p => p.id));
check('the levels: the game\'s own numbers and names (auto/maps.js floorName)', G.DEV_LEVELS.every(([, n, name]) => G.floorName(G.levelFloor(n)) === name), G.DEV_LEVELS);
check('both sides have pages; every level has a page', ['global', 'level'].every(s => G.DEV_PLACES.some(p => p.side === s)) && lvIds.every(l => G.DEV_PLACES.some(p => p.lv === l)));
// each group listed on one page at most, and every group with rows is on one
const groupPages = {};
for (const p of G.DEV_PLACES) for (const g of p.groups) (groupPages[g] = groupPages[g] || []).push(p.id);
check('no group on two pages', Object.values(groupPages).every(v => v.length === 1), Object.entries(groupPages).filter(([, v]) => v.length > 1));
const known = new Set(G.DEV_GROUPS.map(x => x[0]));
check('every page group is a real group', Object.keys(groupPages).every(g => known.has(g)), Object.keys(groupPages).filter(g => !known.has(g)));
// every knob: exactly one page (devPlaceOf gives one id, and it is a real page)
const unplaced = G.DEV_META.filter(m => !ids.includes(G.devPlaceOf(m))).map(m => m.k + ' (' + m.g + ')');
check('every DEV_META knob is placed on a page (' + G.DEV_META.length + ' knobs)', unplaced.length === 0, unplaced);
const keys = G.DEV_META.map(m => m.k);
check('knob keys unique (so each is placed once)', new Set(keys).size === keys.length, keys.filter((k, i) => keys.indexOf(k) !== i));
check('every knob rule points at a page', G.DEV_KNOB_PLACE.every(([, id]) => ids.includes(id)));
// every page shows something: knobs, its own panel or its preview
const count = {};
for (const m of G.DEV_META) count[G.devPlaceOf(m)] = (count[G.devPlaceOf(m)] || 0) + 1;
check('no empty page', G.DEV_PLACES.every(p => count[p.id] || p.page || p.pin), G.DEV_PLACES.filter(p => !(count[p.id] || p.page || p.pin)).map(p => p.id));
check('Coal Seams split: gas, stalactites, timber, props off the Coal page',
  G.devPlaceOf({ k: 'coalGas', g: 'coal' }) === 'coalgas' && G.devPlaceOf({ k: 'coalStalDense', g: 'coal' }) === 'coalstal'
  && G.devPlaceOf({ k: 'coalLadders', g: 'coal' }) === 'coaltimber' && G.devPlaceOf({ k: 'coalLamps', g: 'coal' }) === 'coalprops'
  && G.devPlaceOf({ k: 'coalAmount', g: 'coal' }) === 'coal');
check('the live previews: Fire, Bats, Zones pinned', ['firesim', 'bats', 'zones'].every(id => G.DEV_PLACES.find(p => p.id === id).pin));
check('Presets and Grem keep their own panels', G.DEV_PLACES.find(p => p.id === 'presets').page === 'presets' && G.DEV_PLACES.find(p => p.id === 'grem').page === 'grem');
// Copy Dev settings still complete: a change to one knob on every page shows in the copy
const changed = [];
for (const p of G.DEV_PLACES) {
  const m = G.DEV_META.find(x => G.devPlaceOf(x) === p.id && typeof G.DEV_DEFAULTS[x.k] === 'number' && x.type !== 'curve');
  if (!m) continue;
  G.devSet(m.k, G.DEV_DEFAULTS[m.k] + 0.5);
  changed.push(m.k);
}
const t = G.devCopyText();
const missing = changed.filter(k => !t.includes(k));
check('Copy Dev settings holds a change from every page (' + changed.length + ' pages)', missing.length === 0, missing);
// the panel reads the layout from the data, not its own lists
const DP = G.source;
check('the panel builds its tabs from DEV_PLACES', /DEV_PLACES\.filter\(p => p\.side === place\.side/.test(DP));

// (owner) the rows' ◀ ▶ arrows: whole-number knobs by 1, the rest by 0.1, clamped, no float noise
check('step: 1 for a whole-number knob, 0.1 for a float', G.devStepSize({ k: 'x', step: 1 }) === 1 && G.devStepSize({ k: 'x', step: 0.05 }) === 0.1 && G.devStepSize({ k: 'x', step: 5 }) === 1);
check('no step: by the default (whole: 1, else 0.1)', G.devStepSize({ k: 'batsPerRoost' }) === (Number.isInteger(G.DEV_DEFAULTS.batsPerRoost) ? 1 : 0.1));
check('0.2 + 0.1 = 0.3 (no float noise)', G.devStepped({ k: 'x', step: 0.01 }, 0.2, 1) === 0.3, G.devStepped({ k: 'x', step: 0.01 }, 0.2, 1));
let v = 0; for (let i = 0; i < 7; i++) v = G.devStepped({ k: 'x', step: 0.01 }, v, 1);
check('seven steps up from 0: 0.7 exactly', v === 0.7, v);
check('clamped to max and min', G.devStepped({ k: 'x', step: 1, min: 0, max: 5 }, 5, 1) === 5 && G.devStepped({ k: 'x', step: 0.1, min: 0.05, max: 1 }, 0.1, -1) === 0.05);
check('whole numbers step down by 1', G.devStepped({ k: 'x', step: 1, min: 0, max: 10 }, 4, -1) === 3);
// a double tap on the name: 0, greyed; again: the old value back; a move off 0 ends the grey
const zk = G.DEV_META.find(m => typeof G.DEV_DEFAULTS[m.k] === 'number' && G.DEV_DEFAULTS[m.k] !== 0 && !m.type).k;
const before = G.DEV[zk];
check('double tap: the knob goes to 0, greyed', G.devToggleZero(zk) === 0 && G.DEV[zk] === 0 && G.devIsZeroed(zk));
check('Copy Dev settings shows it as 0 (nothing else kept)', new RegExp(zk + '\\): 0\\b').test(G.devCopyText()), G.devCopyText().split('\n').filter(l => l.includes(zk)));
check('again: the old value back, not greyed', G.devToggleZero(zk) === before && G.DEV[zk] === before && !G.devIsZeroed(zk));
G.devToggleZero(zk); G.devSet(zk, 0.5);
check('moved off 0 by other means: the grey goes', !G.devIsZeroed(zk));
G.devSet(zk, before);

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
