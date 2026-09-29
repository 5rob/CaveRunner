// Refactor proof for Phase 3 (REFACTOR.md): plays the same scripted run on two builds of the
// game and says whether they did exactly the same thing, frame by frame.
//
//   node tests/determinism.js           this tree's build against the last commit's (HEAD)
//   node tests/determinism.js <ref>     against any commit that has tests/build.js's __lvl hook
//   node tests/determinism.js --self    this tree's build against itself (is the probe stable?)
//
// How: an init script seeds Math.random, freezes performance.now and takes over
// requestAnimationFrame, so nothing runs until the probe pumps a frame, and every frame is
// exactly 1/60 s. Then, in one synchronous go (so React never re-renders mid-run), it plays a
// fixed script: walk, jet and shoot in the shop, dropped next to a creature, then through the
// exit onto floor 2. After every frame it hashes the world (player, creatures, shots, pickups,
// particles, fire, how many random numbers were drawn), every 30 frames the rock too, and
// every 60 the canvas pixels. Same hashes on both builds => the change did nothing a player
// could see. The first frame that differs is printed with both sides' numbers.
//
// Not a suite (tests/run.js doesn't pick it up): a before/after tool, like tools/same.js was
// for the moves. Exit code 1 on any difference.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch } = require('./chromium');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'build');
const FRAMES = { shop: 240, fight: 360, next: 240 };

// the builds to compare: this tree's test page, and a ref's (its own index.html through its
// own tests/build.js, since the hook text changes along with the code it reaches into)
function buildHere() {
  require('../tools/build')();
  delete require.cache[require.resolve('./build')];
  return require('./build')();
}
function buildRef(ref) {
  const dir = path.join(OUT, 'ref');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  const show = f => execFileSync('git', ['show', ref + ':' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  fs.writeFileSync(path.join(dir, 'index.html'), show('index.html'));
  fs.writeFileSync(path.join(dir, 'tests', 'build.js'), show('tests/build.js'));
  const made = require(path.join(dir, 'tests', 'build.js'))();
  const out = path.join(OUT, 'test-ref.html');      // next to test.html, so ../lib/ still finds React
  fs.copyFileSync(made, out);
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

// runs before any of the page's own scripts
const INIT = () => {
  let s = 0x2545f491, n = 0;
  Math.random = () => {                              // mulberry32
    n++; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__rndN = () => n;
  let now = 1000;
  performance.now = () => now;
  const q = new Map();
  let id = 0;
  window.requestAnimationFrame = f => { q.set(++id, f); return id; };
  window.cancelAnimationFrame = i => { q.delete(i); };
  window.__pump = () => {
    now += 1000 / 60;
    const fs = [...q.values()];
    q.clear();
    for (const f of fs) f(now);
  };
};

// the scripted run, inside the page; returns one hash per frame and a summary of each
function script(FRAMES) {
  const L = window.__lvl, I = window.__in.current;
  const fnv = (h, x) => {
    const s = typeof x === 'number' ? (Object.is(x, -0) ? '0' : String(x)) : String(x);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 44; return Math.imul(h, 16777619);
  };
  const cv = document.querySelector('canvas.game');
  const cx = cv.getContext('2d');
  const out = [], sums = [];
  let f = 0;
  const frame = () => {
    window.__pump();
    const p = L.p;
    let h = 0x811c9dc5;
    const sum = { f, rnd: window.__rndN(), floor: L.floor, p: [p.x, p.y, p.vx, p.vy, p.hp, p.fuel, p.dead],
      enemies: L.enemies.length, bullets: L.bullets.length, eshots: L.enemyShots.length,
      pickups: L.pickups.length, coins: L.coins.length, sparks: L.sparks.length, smoke: L.smoke.length,
      dparts: L.dparts.length, fields: L.fields.length, fire: L.fire.list.length, props: L.props.length };
    for (const k in sum) h = fnv(h, Array.isArray(sum[k]) ? sum[k].join() : sum[k]);
    for (const e of L.enemies) { h = fnv(h, e.x); h = fnv(h, e.y); h = fnv(h, e.hp); }
    for (const b of L.bullets) { h = fnv(h, b.x); h = fnv(h, b.y); }
    for (const b of L.enemyShots) { h = fnv(h, b.x); h = fnv(h, b.y); }
    for (const c of L.coins) { h = fnv(h, c.x); h = fnv(h, c.y); }
    for (const q of L.pickups) { h = fnv(h, q.x); h = fnv(h, q.y); h = fnv(h, !!q.taken); }
    for (const list of [L.sparks, L.smoke, L.dparts, L.fields]) for (const o of list) { h = fnv(h, o.x); h = fnv(h, o.y); }
    if (f % 30 === 0) {                              // the rock, and the fog
      let m = 0x811c9dc5;
      const M = L.mat;
      for (let i = 0; i < M.length; i++) m = Math.imul(m ^ M[i], 16777619);
      const S = L.fog.seen;
      for (let i = 0; i < S.length; i++) m = Math.imul(m ^ S[i], 16777619);
      sum.mat = m >>> 0; h = fnv(h, m);
    }
    if (f % 60 === 0) {                              // what was drawn
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let m = 0x811c9dc5;
      for (let i = 0; i < d.length; i += 7) m = Math.imul(m ^ d[i], 16777619);
      sum.pix = m >>> 0; h = fnv(h, m);
    }
    out.push(h >>> 0); sums.push(sum); f++;
  };
  const stick = (s, nx, ny, on) => Object.assign(s, { active: true, on: !!on, nx, ny, mag: 1, dy: ny < 0 ? -1 : 1 });
  const off = s => Object.assign(s, { active: false, on: false, nx: 0, ny: 0, mag: 0, dy: 0 });

  // a busy gun, so shots, blasts, digging and fire all happen
  const g = I.loadout.guns[0];
  g.slots = ['missile', 'fball', 'digbolt', 'bolt'].filter(id => window.MODS[id]);
  g.cap = g.slots.length; g.manaMax = 1000; g.mana = 1000; g.manaRegen = 500;
  g.castDelay = 0.1; g.recharge = 0.2; g.idx = 0;

  // 1. the shop: walk, jet, shoot
  for (let i = 0; i < FRAMES.shop; i++) {
    const t = i / FRAMES.shop;
    stick(I.left, t < 0.3 ? 1 : t < 0.6 ? -0.7 : 0.4, t < 0.3 ? 0 : -0.7);
    stick(I.right, Math.cos(i / 20), -Math.abs(Math.sin(i / 20)), i % 50 < 35);
    frame();
  }
  // 2. dropped beside three of floor 1's creatures in turn (a spider, a jelly, a rat nest),
  // shooting at each while it comes for you; kept alive so the run goes on
  const byY = L.enemies.slice().sort((a, b) => a.y - b.y);
  const foes = ['spider', 'jelly', 'nest'].map(act => byY.find((e, i) => e.k.act === act && i >= byY.length / 3));
  for (const e of foes) {
    if (e) { L.p.x = e.x - 30; L.p.y = e.y - 10; L.p.vx = L.p.vy = 0; }
    for (let i = 0; i < FRAMES.fight / 3; i++) {
      L.p.hp = Math.max(L.p.hp, 50);
      stick(I.left, Math.sin(i / 40), i % 90 < 30 ? -1 : 0.3);
      const tx = e ? e.x - L.p.x : 1, ty = e ? e.y - L.p.y : 0, d = Math.hypot(tx, ty) || 1;
      stick(I.right, tx / d, ty / d, i % 40 < 30);
      frame();
    }
  }
  // 3. through the exit, and a bit of floor 2
  off(I.right);
  const P = L.portal;
  L.p.x = P.x + P.w / 2 - 6; L.p.y = P.y + P.h / 2 - 11; L.p.vx = L.p.vy = 0;
  for (let i = 0; i < FRAMES.next; i++) {
    stick(I.left, i < 120 ? -1 : 1, -0.5);
    if (i > 30) stick(I.right, 0.5, 0.8, i % 30 < 20);
    frame();
  }
  off(I.left); off(I.right);
  return { hashes: out, sums };
}

async function play(browser, file) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file);
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!(window.__lvl && window.__in))); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(400);                     // let React settle (the controls' height, the canvas size)
  const r = await page.evaluate(script, FRAMES);
  await ctx.close();
  r.errors = errors;
  return r;
}

(async () => {
  const arg = process.argv[2] || 'HEAD';
  const self = arg === '--self';
  const here = buildHere();
  const there = self ? here : buildRef(arg);
  const browser = await launch();
  const a = await play(browser, there), b = await play(browser, here);
  await browser.close();
  const n = a.hashes.length;
  let bad = -1;
  for (let i = 0; i < n; i++) if (a.hashes[i] !== b.hashes[i]) { bad = i; break; }
  const last = a.sums[n - 1];
  const peak = k => Math.max(...a.sums.map(s => s[k]));
  const rock = new Set(a.sums.filter(s => s.mat !== undefined).map(s => s.mat)).size;
  console.log(`${self ? 'this build twice' : arg + ' vs this tree'}: ${n} frames, ` +
    `floor ${last.floor} at the end, ${last.rnd} random numbers drawn. Peaks: ${peak('bullets')} shots, ` +
    `${peak('eshots')} creature shots, ${peak('fire')} burning pixels, ${peak('sparks')} sparks; ` +
    `health down to ${Math.round(Math.min(...a.sums.map(s => s.p[4])))}; ` +
    `the rock changed ${rock - 1} times`);
  for (const [w, r] of [[self ? 'first' : arg, a], ['this tree', b]]) if (r.errors.length) console.log(`page errors (${w}): ${r.errors.join(' | ')}`);
  if (bad < 0 && !a.errors.length && !b.errors.length) { console.log('SAME: every frame hashes the same'); return; }
  if (bad >= 0) {
    console.log(`DIFFERENT from frame ${bad}:`);
    console.log('  ' + (self ? 'first' : arg).padEnd(10) + JSON.stringify(a.sums[bad]));
    console.log('  ' + 'this tree'.padEnd(10) + JSON.stringify(b.sums[bad]));
  }
  process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
