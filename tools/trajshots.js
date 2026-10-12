// Screenshots for the owner: the purple trajectory mods, Part A (auto/traj.js), in the gun panel's firing window grown
// (double tap), and the dev-only Edit mode open on Orbiting Arc's card (ui/trajedit.js). Phone size (412 x 880 @2.625).
//   node tools/trajshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const PART_A = [
  ['orbit', ['orbit', 'bolt', 'bolt'], 'Orbiting Arc + Spark Bolt: circling him with a light trail and glow'],
  ['spiral', ['spiral', 'bolt', 'bolt'], 'Spiral Arc + Spark Bolt: a widening side-to-side wave, capped'],
  ['boomer', ['boomer', 'bolt', 'bolt'], 'Boomerang + Spark Bolt: out ~55 units, turns and comes back to be caught'],
  ['pong', ['pong', 'bolt', 'bolt'], 'Ping-Pong Path + Spark Bolt: out, snaps back a little, on again'],
  ['edit', ['orbit', 'bolt', 'bolt'], "Orbiting Arc's card (tap the slot), Edit tapped: its knobs as sliders, Copy / Reset all / Done", false, true],
];
const PART_B = [
  ['homing', ['homing', 'bolt', 'bolt'], 'Homing + Spark Bolt: curving onto the hologram target'],
  ['autoaim', ['autoaim', 'bolt', 'bolt'], 'Auto-Aim + Spark Bolt: straight at the target from the barrel'],
  ['gravmod', ['gravmod', 'bolt', 'bolt'], 'Gravity + Spark Bolt: arcing down'],
  ['flat', ['flat', 'bolt', 'bolt'], 'Horizontal Path + Spark Bolt: dead level'],
];
// node tools/trajshots.js [outdir] [a|b]   (default: Part B)
const GUNS = process.argv[3] === 'a' ? PART_A : PART_B;

(async () => {
  const browser = await launch();
  for (const [n, slots, what, small, card] of GUNS) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(sl => {
      const run = newRun();
      const g = scratchPistol();
      g.cap = Math.max(4, sl.length); g.slots = sl.concat(Array(g.cap - sl.length).fill(null));
      run.players[0].guns[0] = g; run.players[0].active = 0;
      saveAutoRun(run);
    }, slots);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(5000);
    for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
      await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
      await page.waitForTimeout(150);
    }
    if (card) {
      const b = await page.locator('.anav [data-nslot="0"]').boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(300);
      await page.locator('.modpop .pedit').dispatchEvent('pointerdown');
      await page.waitForTimeout(300);
      await page.$eval('.modpop .pop', p => { const e = p.querySelector('.trajedit'); if (e) p.scrollTop = e.offsetTop - 60; });
      await page.waitForTimeout(200);
    } else if (!small) {
      await page.locator('.apv').dispatchEvent('pointerdown');
      await page.waitForTimeout(80);
      await page.locator('.apv').dispatchEvent('pointerdown');
      await page.waitForTimeout(1700);
    }
    await page.screenshot({ path: path.join(OUT, 'traj-' + n + '.png') });
    console.log(`${path.join(OUT, 'traj-' + n + '.png')}  ${what}`);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
