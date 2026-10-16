// Copy Dev settings (v1.0.94, auto/devcopy.js): everything the owner can set in Dev is in it, so a pasted copy can
// become the defaults and a new device plays the same: every DEV key (the Zones page's check boxes too), the gun
// presets and Grem's kit as JSON when they differ from the built-in ones; a device keeps only the knobs it changed.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

let t = G.devCopyText();
check('a fresh device: nothing changed, presets and kit the defaults', /nothing changed/.test(t) && /Gun presets.*the same as the default/.test(t) && /Grem kit.*the same as the default/.test(t), t);
const zv = Object.keys(G.DEV_DEFAULTS).find(k => k.startsWith('zv_'));
G.devSet(zv, G.DEV_DEFAULTS[zv] ? 0 : 1);
G.devSet('zoom', 0.1 + 0.2);
t = G.devCopyText();
check('a zone check box (no panel row) is in it', t.includes('(DEV.' + zv + '): '), t.split('\n').slice(0, 5));
check('slider float noise rounded', /\(DEV\.zoom\): 0\.3 /.test(t));
// (grem branch) every knob the panel has: its rows and the zone check boxes (the fixed values left from cut pages are not)
const panelKeys = [...new Set(G.DEV_META.map(m => m.k).concat(Object.keys(G.DEV_DEFAULTS).filter(k => k.startsWith('zv_'))))];
check('every panel knob named once (changed or unchanged)', panelKeys.every(k => t.includes('(DEV.' + k + ')') || new RegExp('[ ,]' + k + '(,|\\n|$)').test(t)));
check('a device keeps only what it changed', Object.keys(JSON.parse(store[G.DEV_KEY])).sort().join() === [zv, 'zoom'].sort().join(), store[G.DEV_KEY]);
G.devSet('zoom', G.DEV_DEFAULTS.zoom); G.devSet(zv, G.DEV_DEFAULTS[zv]);
check('…and nothing once they are back', store[G.DEV_KEY] === '{}', store[G.DEV_KEY]);

// the presets: a gun saved on this device → its JSON between the markers, and the same JSON as the default reads back
const gun = G.starterKit(() => 0.5).gun;
G.savePresets(G.addPreset(G.loadPresets(), 'Zapper', gun));
const kit = G.gremKitNew(); kit.names[0] = 'Rob'; kit.exo[G.EXO_CATS[0]][0] = 2;
G.gremKitSave(kit);
t = G.devCopyText();
const between = (tag) => { const m = new RegExp(tag + '-BEGIN\\n(.*)\\n' + tag + '-END').exec(t); return m && JSON.parse(m[1]); };
const pj = between('PRESETS-JSON'), kj = between('GREM-KIT-JSON');
const nDef = G.cleanPresets(G.DEFAULT_PRESETS).length;
check('the presets are in it, by name and as JSON (the built-in ones, then the new one)', new RegExp((nDef + 1) + ' guns?: .*Zapper').test(t) && pj && pj.length === nDef + 1 && pj[nDef].name === 'Zapper',
  pj && pj.map(p => p.name));
check('the Grem kit is in it, name tags and fitted', /name tags: Rob/.test(t) && kj && kj.names[0] === 'Rob' && kj.exo[G.EXO_CATS[0]][0] === 2);
check('the presets JSON cleans to the same list (it can be the default as it is)', JSON.stringify(G.cleanPresets(pj)) === JSON.stringify(G.loadPresets()));
check('the kit JSON cleans to the same kit', JSON.stringify(G.gremKitClean(kj)) === JSON.stringify(G.gremKitLoad()));
delete store[G.PRESET_KEY]; delete store[G.GREM_KIT_KEY];
check('a device that never saved them gets the built-in ones', JSON.stringify(G.loadPresets()) === JSON.stringify(G.cleanPresets(G.DEFAULT_PRESETS))
  && JSON.stringify(G.gremKitLoad()) === JSON.stringify(G.gremKitClean(G.GREM_KIT_DEFAULT)));
store[G.PRESET_KEY] = '[]';
check('one that deleted all its presets keeps none', G.loadPresets().length === 0);
check('the Dev panel copies this text', G.source.includes('copyText(devCopyText)'));
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('all passed');
