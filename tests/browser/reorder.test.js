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
    const mk = (name, slots) => { const g = JSON.parse(JSON.stringify(LO.guns[0])); g.name = name; g.slots = slots; g.cap = slots.length; return resetGun(g); };
    LO.guns[0] = mk('Alpha', ['bolt']);
    LO.guns[1] = mk('Beta', ['spark']);
    LO.guns[2] = mk('Gamma', ['slug']);
    LO.guns[3] = null;
    LO.sel = 0;
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(280);
  const order = () => page.evaluate(() => ({
    guns: window.__in.current.loadout.guns.map(g => g && g.name),
    sel: window.__in.current.loadout.sel,
    tabs: [...document.querySelectorAll('.gtabs .gtab')].map(t => t.querySelector('.gname').textContent),
  }));

  const hold = async (fromIdx, toIdx, ms) => {
    const tabs = await page.$$('.gtabs .gtab');
    const a = await tabs[fromIdx].boundingBox(), b = await tabs[toIdx].boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    if (toIdx !== fromIdx) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(220);
  };

  check('start order', JSON.stringify((await order()).guns) === '["Alpha","Beta","Gamma",null]', (await order()).guns);

  // a plain tap still just selects
  await hold(1, 1, 80);
  let o = await order();
  check('a quick tap selects', o.sel === 1 && o.guns[1] === 'Beta', o);

  // hold and drag slot 0 onto slot 2
  await hold(0, 2, 480);
  o = await order();
  check('hold and drag reorders', JSON.stringify(o.guns) === '["Beta","Gamma","Alpha",null]', o.guns);
  check('the tabs redraw in the new order', JSON.stringify(o.tabs.slice(0, 3)) === '["Beta","Gamma","Alpha"]', o.tabs);
  check('your selected gun stays selected', o.guns[o.sel] === 'Beta', { sel: o.sel, name: o.guns[o.sel] });

  // drag the last gun to the front
  await hold(2, 0, 480);
  o = await order();
  check('dragging back to the front works', JSON.stringify(o.guns) === '["Alpha","Beta","Gamma",null]', o.guns);
  check('selection still follows', o.guns[o.sel] === 'Beta', { sel: o.sel, name: o.guns[o.sel] });

  // an empty slot cannot be picked up
  await hold(3, 0, 480);
  o = await order();
  check('an empty slot is not draggable', JSON.stringify(o.guns) === '["Alpha","Beta","Gamma",null]', o.guns);

  // the ghost shows while dragging
  const tabs = await page.$$('.gtabs .gtab');
  const a = await tabs[0].boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  const mid = await page.evaluate(() => {
    const gh = document.querySelector('.gghost');
    return { ghost: gh && gh.textContent, lifted: !!document.querySelector('.gtab.lifted') };
  });
  await page.mouse.move(a.x + 160, a.y + 10, { steps: 6 });
  const target = await page.evaluate(() => !!document.querySelector('.gtab.target'));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'reorder.png') });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check('a floating tab follows the finger', mid.ghost === 'Alpha' && mid.lifted, mid);
  check('the slot under it is highlighted', target === true);
  check('the ghost goes away on release', (await page.evaluate(() => !!document.querySelector('.gghost'))) === false);

  // mods still drag normally
  await page.evaluate(() => { window.__in.current.loadout.bag.push('homing'); window.__in.current.notify(); });
  await page.waitForTimeout(150);
  const bt = await (await page.$$('.bag .tile'))[0].boundingBox();
  const st = await (await page.$$('.slotRow .tile'))[0].boundingBox();
  await page.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2);
  await page.mouse.down();
  await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(220);
  const slots = await page.evaluate(() => window.__in.current.loadout.guns[window.__in.current.loadout.sel].slots.slice());
  check('mod dragging is unaffected', slots.includes('homing'), slots);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
