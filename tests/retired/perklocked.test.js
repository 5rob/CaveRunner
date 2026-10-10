// v0.0.135: in the Exo Suit's perk grid a perk not unlocked yet gives nothing away: a
// blank tile (no glyph, tint, tier or lock) in its own place in the grid (unlocked ones are not sorted
// to the front), and nothing to press. Screenshot: perklocked.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  // in the shop, three perks unlocked through the grid (one carried), the rest locked
  const ids = await page.evaluate(() => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    L.p.x = L.start.x; L.p.y = L.start.y;
    const gen = PERK_IDS.filter(i => !PERKS[i].stat);
    const open = [gen[9], gen[2], gen[5]];
    window.__in.current.perkCollection = open;
    LO.perks = [gen[5]];
    window.__in.current.notify();
    return { open, shut: gen[3], order: PERK_IDS.slice() };
  });
  await page.waitForTimeout(300);
  await page.tap('.weapon');
  await page.waitForTimeout(400);
  await page.locator('[data-tab="suit"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'perklocked.png') });
  const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('.xperk')).map(e => ({
    id: e.dataset.perk, locked: e.classList.contains('locked'), text: e.textContent, style: e.getAttribute('style'), title: e.title,
    pe: getComputedStyle(e).pointerEvents })));
  const locked = tiles.filter(t => t.locked);
  check('every perk not unlocked is a locked tile', locked.length === tiles.length - 3, locked.length);
  check('the grid keeps the perks’ own order', tiles.map(t => t.id).join() === ids.order.join());
  check('the unlocked ones are not', ids.open.every(i => !tiles.find(t => t.id === i).locked));
  check('a locked tile is blank', locked.every(t => t.text === ''), locked.slice(0, 3));
  check('with no tint or name', locked.every(t => !t.style && !t.title));
  check('and takes no touch', locked.every(t => t.pe === 'none'));
  const r = await page.locator('.xperk[data-perk="' + ids.shut + '"]').boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(300);
  check('tapping a locked one opens no card', !(await page.$('.pop')));
  await browser.close();
  console.log(fails ? fails + ' failed' : 'all ok');
  process.exit(fails ? 1 : 0);
})();
