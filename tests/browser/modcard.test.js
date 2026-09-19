const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const LO = window.__in.current.loadout;
    LO.bag.push('bounce', 'homing', 'double', 'heavy', 'scatter', 'battery', 'slug', 'tight');
    LO.guns[0].slots = ['bounce', 'bolt', 'bolt', null];
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(250);

  const pop = () => page.evaluate(() => {
    const el = document.querySelector('.pop');
    if (!el) return null;
    return { title: el.querySelector('.ptitle b').textContent,
             kind: el.querySelector('.ptitle span').textContent,
             info: el.querySelector('.pinfo') && el.querySelector('.pinfo').textContent,
             rows: [...el.querySelectorAll('.prow')].map(r => r.textContent),
             demo: [...el.querySelectorAll('.drow')].map(r => r.textContent) };
  });
  // tap at the centre of the nth bag tile, through whatever is on top
  const tapTile = async (sel, n) => {
    const el = (await page.$$(sel))[n];
    await el.scrollIntoViewIfNeeded();          // the bag scrolls when a card is open
    await page.waitForTimeout(80);
    const b = await el.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(190);
  };

  await tapTile('.bag .tile', 0);
  let d = await pop();
  check('tap opens the card', d !== null);
  check('card names the mod', d && d.title === 'Bouncing', d && d.title);
  console.log('   rows:', JSON.stringify(d.rows));
  console.log('   demo:', JSON.stringify(d.demo));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'pop_mod.png') });

  await tapTile('.bag .tile', 0);
  check('tapping the same mod again closes it', (await pop()) === null);

  await tapTile('.bag .tile', 0);
  await tapTile('.bag .tile', 1);
  d = await pop();
  check('tapping another mod switches the card', d && d.title === 'Homing', d && d.title);

  await tapTile('.bag .tile', 2); d = await pop();
  check('multicast card', d && d.title === 'Double Cast', d && d.title);
  console.log('   rows:', JSON.stringify(d.rows));
  console.log('   demo:', JSON.stringify(d.demo));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'pop_multi.png') });

  await tapTile('.bag .tile', 6); d = await pop();
  check('shot card', d && d.title === 'Slug' && /shot/i.test(d.kind), d && [d.title, d.kind]);
  console.log('   rows:', JSON.stringify(d.rows));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'pop_shot.png') });

  await tapTile('.bag .tile', 5); d = await pop();
  check('passive card', d && d.title === 'Mana Battery' && /always on/i.test(d.kind), d && [d.title, d.kind]);
  console.log('   demo:', JSON.stringify(d.demo));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'pop_passive.png') });

  await tapTile('.slotRow .tile', 0);
  check('tap a mod already on the gun', (await pop()) !== null);
  const gap = await page.evaluate(() => {          // a point on no tile and no card
    const r = document.querySelector('.info').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.tap(gap.x, gap.y);
  await page.waitForTimeout(190);
  check('tapping empty space closes', (await pop()) === null);

  // --- drag must NOT open the card ---
  const slotsNow = () => page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
  const before = await slotsNow();
  const a = (await page.$$('.bag .tile'))[0], b = (await page.$$('.slotRow .tile'))[3];
  const ba = await a.boundingBox(), bb = await b.boundingBox();
  await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(220);
  check('drag still moves the mod', JSON.stringify(await slotsNow()) !== JSON.stringify(before), { before, after: await slotsNow() });
  check('drag does NOT open the card', (await pop()) === null);

  // a small wobble is still a tap
  const c = (await page.$$('.bag .tile'))[0], bc = await c.boundingBox();
  await page.mouse.move(bc.x + bc.width / 2, bc.y + bc.height / 2);
  await page.mouse.down();
  await page.mouse.move(bc.x + bc.width / 2 + 3, bc.y + bc.height / 2 + 2, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check('a 4px wobble is still a tap', (await pop()) !== null);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
