// Aim Assist (LIST3 #10): the mod is a proper modifier, and the pointer's pure parts
// (spells/assist.js): where it goes for a stick push, and how it snaps onto creatures.
const G = require('../load');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const D = G.DEV;

// the mod
const m = G.MODS.aimassist;
ok('aimassist is a modifier', m && m.kind === 'mod', m && m.kind);
ok('it has a price, family and Noita twin', G.MOD_PRICE.aimassist > 0 && G.FAMILY_OF.aimassist && G.NOITA_OF.aimassist);
ok('in ALL_IDS', G.ALL_IDS.includes('aimassist'));
const mk = slots => G.resetGun({ name: 'T', cap: slots.length, castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60,
  spread: 0, multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots });
ok('hasAssist sees it anywhere on the gun', G.hasAssist(mk(['bolt', 'aimassist', 'bolt'])) && !G.hasAssist(mk(['bolt'])) && !G.hasAssist(null));
const p = G.planCast(mk(['aimassist', 'bolt']));
ok('the spell after it is assisted', p.shots[0].assist === 1, p.shots[0].assist);

// the pointer: out from the gun, the push mapped onto the reach, held in the view
const view = { x: 0, y: 0, w: 400, h: 300 };
const far = Math.hypot(400 - 100, 300 - 150);   // gun at (100,150): the far corner
const a = G.assistPointer(100, 150, 1, 0, 0.5, view);
ok('half a push goes half the reach', Math.abs(a.x - (100 + far * 0.5 * D.aaReach)) < 1e-6 && a.y === 150, a);
const b = G.assistPointer(100, 150, -1, 0, 1, view);
ok('held inside the view', b.x === 0, b);

// the snap
const e1 = { x: 200, ty: 100, r: 6 }, e2 = { x: 300, ty: 100, r: 6 };
const all = () => true;
let s = G.assistSnap({ x: 200 + 6 + D.aaHit - 1, y: 100 }, [e1, e2], all);
ok('within aaHit of its edge it is ON the creature', s.on === e1, s);
ok('and the point is pulled towards it', s.x < 200 + 6 + D.aaHit - 1, s);
s = G.assistSnap({ x: 200 + 6 + D.aaHit + 5, y: 100 }, [e1], all);
ok('just past aaHit: pulled but not on', s.on === null && s.x < 200 + 6 + D.aaHit + 5, s);
s = G.assistSnap({ x: 200 + 6 + D.aaHit + 5, y: 100 }, [e1], all, e1);
ok('a creature it was already on stays on (aaHold)', s.on === e1, s);
s = G.assistSnap({ x: 200 + 6 + D.aaHit - 1, y: 100 }, [e1], () => false);
ok('one it cannot see is ignored', s.on === null && s.x === 200 + 6 + D.aaHit - 1, s);
s = G.assistSnap({ x: 50, y: 250 }, [e1, e2], all);
ok('far from everything: no snap, no pull', s.on === null && s.x === 50 && s.y === 250, s);
s = G.assistSnap({ x: 296, y: 100 }, [e1, e2], all);
ok('the nearest one wins', s.on === e2, s);

// the knobs are on the Dev panel, in their own group
ok('Dev group Aim Assist', G.DEV_GROUPS.some(g => g[0] === 'aimassist'));
ok('every aa knob has a row', ['aaStart', 'aaReach', 'aaSnapR', 'aaPull', 'aaHit', 'aaHold', 'aaDelay', 'aaSize', 'aaLine', 'aaDot']
  .every(k => G.DEV_META.some(r => r.k === k && r.g === 'aimassist') && typeof G.DEV_DEFAULTS[k] === 'number'));

console.log(`aimassist: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
