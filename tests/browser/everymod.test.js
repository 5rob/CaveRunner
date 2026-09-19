const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await c.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1600);
  // fire every single mod, one at a time, and make sure nothing throws
  const ids = await page.evaluate(() => Object.keys(MODS));
  const report = await page.evaluate(async idList => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    const out = [];
    // solid terrain cells in a box around the player: big enough to hold anything
    // a single cast builds or digs, small enough to count 111 times cheaply
    const solids = () => {
      const m = L.mat, W = L.world.CW, H = L.world.CH, C = L.world.CELL, R = 60;
      const cx = Math.round(L.p.x / C), cy = Math.round(L.p.y / C);
      const x0 = Math.max(0, cx - R), x1 = Math.min(W, cx + R);
      const y0 = Math.max(0, cy - R), y1 = Math.min(H, cy + R);
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (m[y * W + x]) n++;
      return n;
    };
    for (const id of idList) {
      const g = LO.guns[0];
      g.slots = [id, 'bolt', null, null];
      g.manaMax = 9999; g.mana = 9999; g.recharge = 0.05;
      resetGun(g);
      window.__in.current.right = { active: true, nx: 1, ny: -0.2, mag: 1, dy: -1, on: true };
      // clear the world first, then see whether this mod put anything into it.
      // Counting a delta would miss short-lived shots that are born and die inside
      // the window, and beams, which are instant by design.
      L.bullets.length = 0; L.fields.length = 0; L.beams.length = 0; L.flashes.length = 0;
      // Summon Wall and Summon Platform really do build things, so clear a pocket
      // first or the run ends up firing into terrain it built two mods ago.
      L.dig(L.p.x + 60, L.p.y - 10, 70);
      const hpBefore = L.enemies.reduce((t, e) => t + e.hp, 0) + L.enemies.length * 100;
      const rockBefore = solids();
      let peak = 0;
      for (let k = 0; k < 9; k++) {
        await new Promise(r => setTimeout(r, 22));
        peak = Math.max(peak, L.bullets.length + L.fields.length + L.beams.length + L.flashes.length);
      }
      const hpAfter = L.enemies.reduce((t, e) => t + e.hp, 0) + L.enemies.length * 100;
      // a shot that lands on an enemy the same frame it is born never shows up as a
      // bullet, so count damage dealt as evidence too
      // ...and Summon Wall / Summon Platform put nothing in any of those lists at
      // all: what they make IS the terrain, so a change in the rock around you
      // counts too. Digging mods move the same number the other way.
      out.push({ id, made: peak + (hpBefore > hpAfter ? 1 : 0) + (solids() !== rockBefore ? 1 : 0) });
      L.p.hp = 100; L.p.dead = false;   // the blood mods really will kill you
    }
    return out;
  }, ids);
  check('every mod can be equipped and fired without throwing', errs.length === 0, errs.slice(0, 4));
  const silent = report.filter(r => r.made <= 0).map(r => r.id);
  console.log(`     ${report.length} mods fired; ${report.length - silent.length} put something into the world`);
  check('every single mod puts something into the world', silent.length === 0, silent);
  // a heavy build with everything expensive on it
  await page.evaluate(() => {
    window.__in.current.right = { active: true, nx: 1, ny: -0.2, mag: 1, dy: -1, on: true };
    const g = window.__in.current.loadout.guns[0];
    g.slots = ['omega', 'myriad', 'nuke', 'void', 'storm', 'chain', 'plasma', 'meteor'];
    g.cap = 8; g.manaMax = 99999; g.mana = 99999; resetGun(g);
  });
  await page.waitForTimeout(1200);
  check('a silly eight-slot build does not crash it', errs.length === 0, errs.slice(0, 3));
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { if (++n < 60) requestAnimationFrame(tick); else res(Math.round(60000 / (performance.now() - t0))); };
    requestAnimationFrame(tick);
  }));
  check('and still runs at a playable rate', fps > 30, fps + ' fps');
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
