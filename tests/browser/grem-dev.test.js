// The Dev panel in Grem Mode (owner, v1.0.100; src/ui/auto/GremScreen.js): ⏸ held DEV_HOLD_MS (5 s) turns dev mode on as
// in the normal game: a ⚙️ shows beside ⏸ and opens the Dev panel (its Presets and Grem pages); a short press only pauses.
// Real mouse events. Screenshots tests/build/autoshots/grem-dev-btn.png, grem-dev-panel.png.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = path.join(__dirname, '..', 'build', 'autoshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; if (!sessionStorage.getItem('set')) { localStorage.setItem('caverunner-devshow', '0'); sessionStorage.setItem('set', '1'); } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tgrem').dispatchEvent('pointerdown');
  await page.waitForTimeout(800);
  check('no ⚙️ before dev mode', !(await page.$('.grem .adevbtn')));
  const box = await page.locator('.grem .pausebtn').boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // a short press: the pause menu only
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
  await page.waitForTimeout(300);
  check('a short press pauses', !!(await page.$('.volumes')));
  check('… and no ⚙️', !(await page.$('.grem .adevbtn')));
  await page.locator('.pbtn.resume').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  // held 5 s: dev mode, the ⚙️ beside ⏸
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(5300); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.locator('.pbtn.resume').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  check('held 5 s: the ⚙️ shows', !!(await page.$('.grem .adevbtn')));
  await page.screenshot({ path: path.join(OUT, 'grem-dev-btn.png') });
  await page.locator('.grem .adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  check('the ⚙️ opens the Dev panel', !!(await page.$('.devtab')));
  check('… with its Presets and Grem tabs', !!(await page.$('.devtab[data-t="presets"]')) && !!(await page.$('.devtab[data-t="grem"]')));
  // (v1.0.109) only what Grem plays with: no old-game Level 2 tab; the Auto tab without the hub, maps, bag, throw or prices
  const tabsShown = await page.evaluate(() => [...document.querySelectorAll('.devtab')].map(b => b.getAttribute('data-t')));
  check('Grem Mode tabs: no old game Level 2, the creatures, zones, fire and trajectories there', !tabsShown.includes('level2') && ['creatures', 'zones', 'firesim', 'traj', 'auto'].every(t => tabsShown.includes(t)), tabsShown);
  await page.locator('.devtab[data-t="auto"]').click();
  await page.waitForTimeout(200);
  const autoGroups = await page.evaluate(() => [...document.querySelectorAll('.devgroup')].map(g => g.textContent || ''));
  check('… the Auto tab: level, enemies, chests; no hub, maps, bag, throw or economy', autoGroups.some(t => /Auto: level/.test(t)) && autoGroups.some(t => /Auto: enemies/.test(t))
    && !autoGroups.some(t => /Auto: (hub|maps|bag|throw|economy|blocks)/.test(t)), autoGroups.map(t => t.slice(0, 24)));
  await page.screenshot({ path: path.join(OUT, 'grem-dev-panel.png') });
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
