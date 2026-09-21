const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__lvl.p.x = 30;
    const LO = window.__in.current.loadout;
    // a roomy gun so the sheet is a realistic height (the 1-slot starter Pick Axe would
    // leave the bag sitting up under the floating detail card)
    LO.guns[0] = resetGun({ name: 'Test Wand', cap: 6, castDelay: 0.2, recharge: 1,
      manaMax: 200, manaRegen: 60, spread: 3, multi: 1, shuffle: false, mana: 200,
      slots: ['bolt', null, null, null, null, null] });
    LO.sel = 0;
    LO.bag.push('saw', 'fast', 'cold', 'trigger', 'over_heat');
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(250);
  const card = async n => {
    const b = await (await page.$$('.bag .tile'))[n].boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const el = document.querySelector('.pop:not(.ingame)');
      return el && { title: el.querySelector('.ptitle b').textContent,
        info: el.querySelector('.pinfo') && el.querySelector('.pinfo').textContent,
        note: el.querySelector('.pnote') && el.querySelector('.pnote').textContent,
        rows: [...el.querySelectorAll('.prow')].map(r => r.textContent),
        demo: [...el.querySelectorAll('.drow')].map(r => r.textContent) };
    });
  };
  let c = await card(0);
  check('Buzzsaw card opens', c && c.title === 'Buzzsaw', c && c.title);
  console.log('   note:', c.note);
  console.log('   rows:', JSON.stringify(c.rows));
  console.log('   demo:', JSON.stringify(c.demo));
  check('it explains the reset', /sets the gun/i.test(c.note) && /after it/i.test(c.note), c.note);
  check('it says to put it last', /last/i.test(c.note));
  check('the demo shows a multicast group', /Double Cast/.test(c.demo[0]) && /Buzzsaw/.test(c.demo[0]), c.demo[0]);
  check('and shows the wrong order', /adds its delay back/.test(c.demo[1]), c.demo[1]);
  check('it reports the recharge cut', c.rows.some(r => /recharge/.test(r)), c.rows);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'saw_card.png') });

  await card(0);                                       // close
  c = await card(1);
  check('Fast Cast explains cast delay too', c && /cast delay/i.test(c.note || ''), c && c.note);
  check('and warns a reset wipes it', c && /wipes this/i.test(c.note || ''), c && c.note);
  console.log('   fast note:', c.note);

  await card(1);
  c = await card(2);
  check('Cold Start explains recharge', c && /recharge is the pause/i.test(c.note || ''), c && c.note);
  check('and that position is irrelevant', c && /position does not matter/i.test(c.note || ''), c && c.note);
  check('its row shows the multiplier', c && c.rows.some(r => /recharge1s/.test(r.replace(/\s/g, ''))), c && c.rows);
  console.log('   cold rows:', JSON.stringify(c.rows));
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
