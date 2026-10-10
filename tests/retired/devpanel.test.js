// The Dev panel's layout (v0.0.149, ui/devpanel.js DevPanel): tabs (dev/knobs.js DEV_TABS), each a page of
// collapsible groups that open on a tap and stay open across a reopen; a search box that finds knobs on
// any tab; the actions on top. With CAVERUNNER_SHOTS=<dir> it also saves the owner's screenshots there.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const SHOTS = process.env.CAVERUNNER_SHOTS;

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1500);
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };

  await page.tap('.devbtn');
  await page.waitForTimeout(250);
  const tabs = await page.$$eval('.devtab', b => b.map(x => x.getAttribute('data-t')));
  check('a tab per DEV_TABS entry', tabs.join() === (await page.evaluate(() => DEV_TABS.map(t => t[0]).join())), tabs);
  check('the actions are all there', (await page.$$eval('.devbtns .dbg', b => b.map(x => x.textContent))).join() ===
    'All mods,All perks,Spawn gun,Spawn level,Restart run,Copy Dev settings,Copy mod & perk audit');
  check('the first tab shows only its groups, shut', (await page.$$eval('.devghead', b => b.map(x => x.getAttribute('data-g')))).join() ===
    (await page.evaluate(() => DEV_TABS[0][2].join())) && (await page.$$('.devrow')).length === 0);
  // every group of every tab appears on its tab
  const missing = [];
  for (const t of tabs) {
    await page.tap('.devtab[data-t=' + t + ']');
    await page.waitForTimeout(60);
    const gs = await page.$$eval('.devghead', b => b.map(x => x.getAttribute('data-g')));
    const want = await page.evaluate(t => DEV_GROUPS.map(g => g[0]).filter(g => devTabOf(g) === t), t);
    if (gs.join() !== want.join()) missing.push({ t, gs, want });
  }
  check('every group is on its tab', missing.length === 0, missing);
  await page.tap('.devtab[data-t=look]');
  await page.waitForTimeout(80);
  await shot('item3-1-tabs.png');

  // a tap opens a group, and another shuts it
  await page.tap('.devghead[data-g=light]');
  await page.waitForTimeout(120);
  const nOpen = (await page.$$('.devrow')).length;
  check('a tap opens a group', nOpen > 0, nOpen);
  await shot('item3-2-numbers-open.png');
  await page.evaluate(() => devSet('zoom', 2));
  await page.tap('.devpanel .done');
  await page.waitForTimeout(150);
  await page.tap('.devbtn');
  await page.waitForTimeout(200);
  check('the tab and the open group are remembered', (await page.$$('.devrow')).length === nOpen &&
    (await page.$eval('.devtab.on', b => b.getAttribute('data-t'))) === 'look');
  check('a changed knob shows on its group header', (await page.$eval('.devghead[data-g=view]', b => b.textContent)).includes('1 changed'));
  await page.tap('.devghead[data-g=light]');
  await page.waitForTimeout(120);
  check('a second tap shuts it', (await page.$$('.devrow')).length === 0);

  // search: finds a knob on another tab, opened, with only the matches
  await page.fill('.devsearch', 'black hole');
  await page.waitForTimeout(120);
  const found = await page.$$eval('.devrow label', ls => ls.map(l => l.textContent));
  check('search finds the Black Hole knobs from any tab', found.length >= 2 && found.every(l => /black hole/i.test(l)), found);
  await shot('item3-3-search.png');
  await page.tap('.devclear');
  await page.waitForTimeout(100);
  check('clearing the search brings the tabs back', !!(await page.$('.devtabs')) && (await page.$$('.devrow')).length === 0);

  // a group with sliders, colours and a live preview (Creatures → Jellyfish colours)
  await page.tap('.devtab[data-t=creatures]');
  await page.waitForTimeout(80);
  await page.tap('.devghead[data-g=jellycol]');
  await page.waitForTimeout(400);
  check('Jellyfish colours opens with its sliders and preview', !!(await page.$('.jellyprev')) && (await page.$$('.devrow input[type=range]')).length >= 3);
  await page.evaluate(() => { const b = document.querySelector('.devbody'), r = document.querySelector('.devrow input[type=range]');
    b.scrollTop += r.getBoundingClientRect().top - b.getBoundingClientRect().top - 300; });
  await page.waitForTimeout(300);
  await shot('item3-4-sliders.png');
  await page.tap('.devghead[data-g=jellycol]');
  await page.waitForTimeout(80);

  // Copy report still copies the same report
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.tap('.devcopy');
  await page.waitForTimeout(250);
  const same = await page.evaluate(async () => (await navigator.clipboard.readText()) === devReport());
  check('Copy report copies devReport()', same);
  await page.evaluate(() => { devSet('zoom', DEV_DEFAULTS.zoom); localStorage.removeItem('caverunner-devgroups'); localStorage.removeItem('caverunner-devtab'); });
  await shot('item3-5-actions.png');
  // Spawn level: the floors to pick from (owner: New cave + Floor 2 in one)
  await page.tap('.dbg.spawnlevel');
  await page.waitForTimeout(200);
  check('Spawn level opens a floor picker', (await page.$$('.lvlgo')).length > 2);
  await shot('item3-6-spawnlevel.png');

  await browser.close();
  console.log(fails ? `${fails} failed` : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
