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
  await page.waitForTimeout(4300);

  const card = () => page.evaluate(() => {
    const el = document.querySelector('.pop.ingame');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { title: el.querySelector('.ptitle b').textContent,
             rows: [...el.querySelectorAll('.prow')].map(t => t.textContent),
             demo: [...el.querySelectorAll('.drow')].length,
             clickThrough: getComputedStyle(el).pointerEvents === 'none',
             bottom: Math.round(r.bottom) };
  });
  const waitFor = async (fn, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() - t0 > ms) return null;
      await page.waitForTimeout(60);
    }
  };
  const stand = i => page.evaluate(async n => {
    const { p, stock } = window.__lvl;
    p.x = stock[n].x - 6; p.y = stock[n].y + 4; p.vx = 0; p.vy = 0;
    await new Promise(r => setTimeout(r, 280));
  }, i);

  // the shop exit is random, so we may have spawned on a plinth: step clear first
  await page.evaluate(async () => {
    const { p, stock } = window.__lvl;
    p.x = Math.min(...stock.map(i => i.x)) - 120;
    await new Promise(r => setTimeout(r, 260));
  });
  check('no card before you walk up to anything', (await card()) === null);

  await stand(1);
  let c = await waitFor(card);
  const want = await page.evaluate(() => MODS[window.__lvl.stock[1].id].name);
  check('standing on a mod shows its card', c !== null);
  check('it is the right mod', c && c.title === want, { got: c && c.title, want });
  check('the card carries the effect rows', c && c.rows.length > 0, c && c.rows);
  check('and the placement demo', c && c.demo === 2, c && c.demo);
  check('the card never eats a tap', c && c.clickThrough === true);
  const buyBox = await page.evaluate(() => { const b = document.querySelector('.buy'); const r = b.getBoundingClientRect(); return Math.round(r.top); });
  check('it sits clear of the Buy button', c && c.bottom < buyBox, { cardBottom: c && c.bottom, buyTop: buyBox });
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shop_card.png') });

  await stand(2);
  const want2 = await page.evaluate(() => MODS[window.__lvl.stock[2].id].name);
  c = await waitFor(async () => { const x = await card(); return x && x.title === want2 ? x : null; });
  check('walking to the next plinth switches the card', c && c.title === want2, { got: c && c.title, want: want2 });

  await stand(0);
  check('the free heal shows no mod card', (await card()) === null);
  const healBtn = await page.evaluate(() => document.querySelector('.buy').textContent);
  check('but still offers the heal', /Take/.test(healBtn), healBtn);

  // step away
  await page.evaluate(async () => {
    const { p } = window.__lvl; p.x = 40; p.y = 780 * 2 - 22;
    await new Promise(r => setTimeout(r, 280));
  });
  check('walking away hides the card', (await card()) === null);
  check('and the Buy button', (await page.$('.buy')) === null);

  // buying from the plinth still works with the card up
  await stand(3);
  const it = await page.evaluate(() => ({ id: window.__lvl.stock[3].id, price: window.__lvl.stock[3].price }));
  await page.evaluate(() => { window.__in.current.loadout.gold = 999; window.__in.current.sig = ''; });
  await page.waitForTimeout(220);
  await page.tap('.buy');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({ bag: window.__in.current.loadout.bag.slice(),
    gold: window.__in.current.loadout.gold, sold: window.__lvl.stock[3].sold, card: !!document.querySelector('.pop.ingame') }));
  check('you can still buy with the card showing', after.sold && after.bag.includes(it.id) && after.gold === 999 - it.price, { after, it });
  check('the card clears once it is sold', after.card === false, after);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
