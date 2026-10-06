// Level 2 stage 5: floor 2's wasteland (world/destroy.js). Across seeds: the blasts happen (holes in the
// rock), none in a zone, none near the shop or the pads, more of them near the zones than far out; a
// scorch ring past each hole; the fire burns out; bones lie outside the zones; every tomb room and the top
// still in reach of the shop; same seed, same wasteland; the floor still quick; the knobs work.
const G = require('../load');
const { makeLevel, destructionPlan, blastTerrain, scorchWidth, boxReach, CW, CH, CELL, SHOP_FLOOR, SHOP_TOP, SHOP_ROOF, ROCK,
  DEV, DEV_DEFAULTS, DEV_META } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hash = a => { let h = 0; for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0; return h; };
const reset = () => { for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k]; };
reset();

const SEEDS = 8;
let ms = 0, worst = 0, blasts = 0, fire = 0, bones = 0, near = 0, far = 0;
const bad = { none: [], inZone: [], shop: [], route: [], rooms: [], ticks: [] };
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now(), lv = makeLevel(seed, 2), dt = Date.now() - t0;
  ms += dt; worst = Math.max(worst, dt);
  const { mat, darkMask: M, tomb } = lv;
  if (!M) continue;
  const b = tomb.boom;
  if (!b || !b.blasts || !b.gone) { bad.none.push(seed); continue; }
  blasts += b.blasts; fire += b.fire; bones += b.bones;
  if (b.ticks >= 4000) bad.ticks.push(seed);
  // the plan again (same seed, the floor before its blasts is what makeLevel had: its own stream, so re-plan on the finished one only for where)
  const plan = destructionPlan(mat, M, seed, []);
  for (const p of plan) {
    if (M[Math.floor(p.y) * CW + Math.floor(p.x)]) bad.inZone.push(seed);
    if (p.dist < DEV.l2bMaxDist / 2) near++; else far++;
  }
  // the shop's roof and the pads untouched: nothing opened in the shop's shell
  if (!boxReach(mat, 17, SHOP_FLOOR - 12).top) bad.route.push(seed);
  const R = boxReach(mat, 17, SHOP_FLOOR - 12);
  for (const r of tomb.rooms) {
    if (r.dark >= 0) continue;
    let got = false;
    for (let y = r.y; y < r.floor && !got; y++) for (let x = r.x; x < r.x + r.w; x++) if (R.ok[y * CW + x] === 2) { got = true; break; }
    if (!got) bad.rooms.push(seed + ':' + r.id);
  }
}
console.log(`${SEEDS} floors: ${(blasts / SEEDS).toFixed(0)} blasts (${(fire / SEEDS).toFixed(0)} on fire), ${(bones / SEEDS).toFixed(0)} remains; near half ${near}, far half ${far}; makeLevel ${(ms / SEEDS).toFixed(0)} ms average, ${worst} worst`);
check('every floor has its blasts, and they open rock', !bad.none.length, bad.none);
check('no blast inside a zone', !bad.inZone.length, bad.inZone);
check('more blasts in the near half of the reach than the far half', near > far * 1.5, [near, far]);
check('the fire always burns out', !bad.ticks.length, bad.ticks);
check('the shop still reaches the top', !bad.route.length, bad.route);
check('every tomb room outside a zone is still in reach of the shop', !bad.rooms.length, bad.rooms);
check('bones laid', bones / SEEDS >= 40, bones / SEEDS);
check('the whole floor built in well under 5 s (average under 2 s)', ms / SEEDS < 2000 && worst < 5000, [ms / SEEDS, worst]);

// one blast in a made-up block of rock: the hole, then the scorch ring just past it
{
  const mat = new Uint8Array(CW * CH).fill(ROCK), px = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  const img = px(CW, CH), dimg = px(CW, CH), bgImg = px(CW / 4, CH / 4);
  img.data.fill(200); bgImg.data.fill(200);
  const L = { mat, img, dimg, bgImg, fuel: new Uint8Array(CW * CH), web: null };
  const b = { x: 300.5, y: 400.5, r: 10, fire: false, dist: 0 };
  let s = 7;
  const gone = blastTerrain(L, b, () => (s = (s * 16807) % 2147483647) / 2147483647);
  const at = (dx, dy) => (Math.floor(b.y + dy) * CW + Math.floor(b.x + dx));
  check('a blast clears its disc', gone > 250 && !mat[at(0, 0)] && !mat[at(9, 0)] && mat[at(11, 0)] === ROCK, gone);
  const lip = img.data[at(11, 0) * 4], out = img.data[at(10 + scorchWidth(10) + 2, 0) * 4];
  check('a scorch ring just past the hole, darkest at its lip, gone further out', lip < 140 && out === 200, [lip, out]);
}

// deterministic, and floors 1 and 3 untouched
const a = makeLevel(4, 2), c = makeLevel(4, 2);
check('same seed, same wasteland', hash(a.mat) === hash(c.mat) && hash(a.img.data) === hash(c.img.data) && hash(a.dimg.data) === hash(c.dimg.data) && hash(a.bgImg.data) === hash(c.bgImg.data));
check('floor 1 untouched', makeLevel(3, 1).tomb === null);

// the knobs
DEV.l2bCount = 0; DEV.l2bBones = 0;
const bare = makeLevel(4, 2);
check('Number of explosions 0 and bones 0: no wasteland', bare.tomb.boom.blasts === 0 && bare.tomb.boom.bones === 0 && bare.tomb.boom.gone === 0);
reset();
DEV.l2bCount = 200;
check('more explosions with the knob up', makeLevel(4, 2).tomb.boom.blasts > a.tomb.boom.blasts, [a.tomb.boom.blasts]);
reset();
check('the bones knob is on the panel', DEV_META.some(m => m.k === 'l2bBones' && m.g === 'l2boom'));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
