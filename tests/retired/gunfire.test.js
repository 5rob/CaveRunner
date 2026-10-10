// The Bag's firing window (GunFire, item 4): the gun buttons are a row under the mod grid, and
// where they were a small canvas shows the selected gun firing each pull of the fire preview, in
// time with the slot lights, following the build as it changes. Saves 412×880 screenshots to
// CAVERUNNER_SHOTS (a folder) when it is set.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const SHOTS = process.env.CAVERUNNER_SHOTS || '';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.cap = 8; g.multi = 1; g.shuffle = false; g.castDelay = 0.25; g.recharge = 0.6; g.manaMax = 999; g.manaRegen = 999;
    g.slots = ['bolt', 'triple', 'slug', 'buck', 'bubble', 'double', 'arrow', 'spit'];
    resetGun(g);
    for (const id of ['lance', 'orb', 'fball', 'zap', 'dmg_up', 'homing', 'scatter', 'big']) LO.bag.push(id);
    window.__in.current.notify();
  });
  await page.click('.weapon');
  await page.waitForTimeout(400);

  // the layout: the window sits by the stats, the gun buttons in one row under the bag grid
  const lay = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const tabs = [...document.querySelectorAll('.gtabs.gunrow .gtab')].map(e => e.getBoundingClientRect());
    return { fire: r('.btop .gfire'), stats: r('.btop .gstats'), bag: r('.bagW'), tabs,
      vw: innerWidth, vh: innerHeight };
  });
  check('the firing window is beside the stats', lay.fire && lay.stats && lay.fire.left >= lay.stats.right - 1 &&
    lay.fire.height > 90, lay.fire);
  check('four gun buttons in one row', lay.tabs.length === 4 && lay.tabs.every(t => Math.abs(t.top - lay.tabs[0].top) < 1));
  check('the row spans the bag, buttons equal width', lay.tabs.length === 4 && lay.bag &&
    Math.abs(lay.tabs[3].right - lay.bag.right) < 3 && lay.tabs.every(t => Math.abs(t.width - lay.tabs[0].width) < 1),
    lay.tabs.map(t => Math.round(t.width)));
  check('the row is under the mod grid, on screen', lay.bag && lay.tabs[0].top >= lay.bag.bottom - 1 &&
    lay.tabs[0].bottom <= lay.vh, { bag: lay.bag && lay.bag.bottom, row: lay.tabs[0] });

  // it fires: pulls counted, and the canvas has coloured shot pixels away from the gun
  const shotPx = () => page.evaluate(() => {
    const c = document.querySelector('.gfire'), x = c.getContext('2d');
    const d = x.getImageData(Math.round(c.width * 0.5), 0, Math.round(c.width * 0.5), c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 150) n++;
    return { n, pulls: Number(c.dataset.pulls || 0) };
  });
  let best = 0, pulls = 0;
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(k ? 380 : 260);
    const s = await shotPx();
    best = Math.max(best, s.n); pulls = s.pulls;
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `item4-${k + 1}.png`) });
  }
  check('the window shows the pulls firing', pulls >= 2, pulls);
  check('shots drawn out past the muzzle', best > 20, best);

  // live: change the build and the window keeps up (the sim restarts, pulls keep coming)
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.slots = ['scatter', 'buck', 'quad', 'bolt', 'bolt', 'bolt', 'bolt', 'bubble']; resetGun(g); window.__in.current.notify();
  });
  await page.waitForTimeout(600);
  const after = await shotPx();
  check('after a change it still fires', after.pulls >= 1 && after.n > 20, after);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'item4-4.png') });

  // the wall at the far right (owner): a trigger bolt hits it and its payload goes off there
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.slots = ['bolt_t', 'buck', 'bolt_t', 'fball', null, null, null, null]; resetGun(g); window.__in.current.notify();
    document.querySelector('.gfire').dataset.payloads = '0';
  });
  let pays = 0;
  for (let i = 0; i < 40 && !pays; i++) { await page.waitForTimeout(150); pays = await page.evaluate(() => +(document.querySelector('.gfire').dataset.payloads || 0)); }
  check('a trigger bolt hitting the wall lets its payload go', pays > 0, pays);
  await page.waitForTimeout(120);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'gfwall.png'), clip: { x: 0, y: 0, width: 412, height: 230 } });

  // the dummy you in front of the wall (owner): homing bolts steer into it while the gun sways
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.slots = ['homing', 'bolt', 'homing', 'arrow', 'bounce', 'bolt', null, null]; resetGun(g); window.__in.current.notify();
    document.querySelector('.gfire').dataset.hits = '0';
  });
  let hits = 0;
  for (let i = 0; i < 50 && hits < 2; i++) { await page.waitForTimeout(150); hits = await page.evaluate(() => +(document.querySelector('.gfire').dataset.hits || 0)); }
  check('shots hit the dummy (it never dies)', hits >= 2, hits);
  check('the DPS graph is keeping its history', await page.evaluate(() => +document.querySelector('.gfire').dataset.graph) > 5);
  check('its DPS shows over its head', await page.evaluate(() => +document.querySelector('.gfire').dataset.dps) > 0);
  if (SHOTS) {
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, `gfdummy-${i}.png`), clip: { x: 0, y: 0, width: 412, height: 230 } }); }
  }

  // you at the far left, the gun in your hand: Follow Me shots curve back round to you (owner)
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.slots = ['follow', 'bubble', 'follow', 'orb', 'follow', 'bolt', null, null]; resetGun(g); window.__in.current.notify();
    document.querySelector('.gfire').dataset.back = '0';
  });
  let back = 0;
  for (let i = 0; i < 50 && !back; i++) { await page.waitForTimeout(150); back = await page.evaluate(() => +(document.querySelector('.gfire').dataset.back || 0)); }
  check('a Follow Me shot comes back to you', back > 0, back);
  if (SHOTS) for (let i = 0; i < 3; i++) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, `gffollow-${i}.png`), clip: { x: 0, y: 0, width: 412, height: 230 } }); }

  // a gun button in the new row still switches gun
  const before = await page.evaluate(() => window.__in.current.loadout.sel);
  const other = await page.evaluate(sel => window.__in.current.loadout.guns.findIndex((g, i) => g && i !== sel), before);
  if (other >= 0) {
    await page.click(`.gtabs.gunrow .gtab[data-gun="${other}"]`);
    await page.waitForTimeout(200);
    check('tapping a gun in the row selects it', await page.evaluate(() => window.__in.current.loadout.sel) === other);
  }

  // closing the Bag stops the window's loop (the canvas goes with it)
  await page.click('.sheet .done');
  await page.waitForTimeout(200);
  check('the window is gone with the Bag', await page.evaluate(() => !document.querySelector('.gfire')));
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
