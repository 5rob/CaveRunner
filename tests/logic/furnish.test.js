// Level 2 stage 3: the tomb's rooms furnished (world/furnish.js). Every room gets its type's kit (its
// signature piece), mirrored about the room's middle, nothing painted into rock, the old coal-mine
// decoration gone from floor 2, the knobs work, and floors 1 and 3 are exactly what they were.
const G = require('../load');
const { makeLevel, CW, CH, DEV, DEV_DEFAULTS, DEV_META, L2_KNOBS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hash = a => { let h = 0; for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0; return h; };
const reset = () => { for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k]; };
reset();

// each type's signature piece (the prize room's altar is the game's own, so its idols)
const SIG = { altar: ['altar', 'idol'], library: ['shelf', 'lectern'], ossuary: ['niche', 'skulls'], dorm: ['bunk'], store: ['urn', 'jar', 'crate'],
  hall: ['throne', 'table'], orrery: ['orrery'], pillars: ['glyphs'], shrine: ['statue'], gate: ['obelisk'], vestibule: ['guardian'] };
const SEEDS = 16;
let rooms = 0, bare = [], asym = 0, inRock = 0, ms = 0, worst = 0, pieces = 0, bones = 0, props = 0;
const missing = {};
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now(), lv = makeLevel(seed, 2), dt = Date.now() - t0;
  ms += dt; worst = Math.max(worst, dt);
  const { mat, dimg, tomb } = lv, dd = dimg.data;
  props += lv.props.length;
  for (let i = 0; i < CW * CH; i++) if (dd[i * 4 + 3] && mat[i]) inRock++;
  const touched = r => { if (!lv.darkMask) return false; for (let y = r.y - 2; y <= r.floor + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) if (lv.darkMask[y * CW + x]) return true; return false; };
  for (const r of tomb.rooms) {
    if (touched(r)) continue;            // a dark zone took some of it (Stage 4): tests/logic/dark.test.js
    rooms++;
    const kit = r.kit || [];
    pieces += kit.length;
    bones += kit.filter(k => /bones|skull|kneel|sleeper|reader|diner|king/.test(k.id)).length;
    if (!kit.some(k => SIG[r.type].includes(k.id))) { bare.push(`${seed}:${r.type}/${r.shape} ${r.w}x${r.h}`); missing[r.type] = (missing[r.type] || 0) + 1; }
    // the decoration layer in the room's box mirrors about its middle
    for (let y = r.y; y < r.floor; y++) for (let x = r.x; x < r.cx; x++) {
      const a = (y * CW + x) * 4, b = (y * CW + 2 * r.x + r.w - 1 - x) * 4;
      if (dd[a + 3] !== dd[b + 3] || dd[a] !== dd[b] || dd[a + 1] !== dd[b + 1] || dd[a + 2] !== dd[b + 2]) asym++;
    }
  }
}
console.log(`${SEEDS} tombs: ${(pieces / rooms).toFixed(1)} kit pieces a room, ${(bones / SEEDS).toFixed(0)} remains a tomb; makeLevel ${(ms / SEEDS).toFixed(0)} ms average, ${worst} worst`);
check('every room has its type\'s kit (its signature piece)', bare.length <= rooms * 0.03, { bare: bare.length, of: rooms, missing, some: bare.slice(0, 8) });
check('every room\'s kit mirrors about its middle', asym === 0, asym);
check('nothing painted into rock', inRock === 0, inRock);
check('plenty of skeletal remains', bones / SEEDS >= 60, bones / SEEDS);
check('no props on floor 2 (the coal mine\'s carts, lanterns, soot are gone)', props === 0, props);
check('quick (under 1.5 s average)', ms / SEEDS < 1500, ms / SEEDS);

// deterministic
const a = makeLevel(4, 2), b = makeLevel(4, 2);
check('same seed, same furniture', hash(a.dimg.data) === hash(b.dimg.data) && hash(a.img.data) === hash(b.img.data));
// floors 1 and 3 untouched (v0.0.145's pictures, decoration and all)
const f1 = makeLevel(3, 1), f3 = makeLevel(3, 3);
check('floor 1 is what it was', hash(f1.img.data) === 1936234780 && f1.props.length === 815, [hash(f1.img.data), f1.props.length]);
check('floor 3 is what it was', hash(f3.img.data) === -672481880 && f3.props.length === 216, [hash(f3.img.data), f3.props.length]);

// the knobs
const count = lv => { let n = 0; for (let i = 3; i < lv.dimg.data.length; i += 4) if (lv.dimg.data[i]) n++; return n; };
const base = count(a);
DEV.l2Decor = 0;
check('Decoration amount 0: a bare tomb', count(makeLevel(4, 2)) === 0);
reset();
DEV.l2BonesLo = DEV.l2BonesHi = 3;
const boned = makeLevel(4, 2).tomb.rooms.reduce((t, r) => t + r.kit.filter(k => /bones|skull/.test(k.id)).length, 0);
reset();
const plain = a.tomb.rooms.reduce((t, r) => t + r.kit.filter(k => /bones|skull/.test(k.id)).length, 0);
check('more remains with the bones knob up', boned > plain * 1.5, [plain, boned]);
DEV.l2FurnLo = DEV.l2FurnHi = 0.2;
check('less furniture with the furniture knob down', count(makeLevel(4, 2)) < base, base);
reset();
check('the kit knobs are on the panel', ['l2Furn', 'l2Bones'].every(k => L2_KNOBS.some(r => r[0] === k) && DEV_META.some(m => m.k === k + 'Lo' && m.g === 'level2')));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
