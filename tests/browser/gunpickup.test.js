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
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__lvl.p.x = 30; });      // away from the shop plinths
  await page.waitForTimeout(200);
  const LO = () => page.evaluate(() => {
    const l = window.__in.current.loadout;
    return { sel: l.sel, gold: l.gold, guns: l.guns.map(g => g && g.name) };
  });
  const hold = async (sel, n, ms) => {
    const b = (await page.$$(sel))[n], bb = await b.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(200);
  };

  // --- 1. keyboard after a restart ---
  await page.keyboard.press('2');
  await page.waitForTimeout(120);
  check('keys work at the start', (await LO()).sel === 1, await LO());
  await page.click('.reset');
  await page.waitForTimeout(700);
  await page.keyboard.press('2');
  await page.waitForTimeout(150);
  check('keys still work after Restart', (await LO()).sel === 1, await LO());
  await page.keyboard.press('1');
  await page.waitForTimeout(150);

  // --- 2. gold is pulled in ---
  const pull = await page.evaluate(async () => {
    const { coins, p } = window.__lvl;
    const L = window.__in.current.loadout;
    L.gold = 0; coins.length = 0;
    coins.push({ x: p.x + 28, y: p.y, amount: 7, t: 0, vy: 0 });        // inside the shrunken radius
    await new Promise(r => setTimeout(r, 600));
    return { gold: L.gold, left: coins.length };
  });
  check('gold close by still flies to you', pull.gold === 7 && pull.left === 0, pull);
  const noPull = await page.evaluate(async () => {
    const { coins, p } = window.__lvl;
    const L = window.__in.current.loadout;
    L.gold = 0; coins.length = 0;
    coins.push({ x: p.x + 95, y: p.y - 20, amount: 9, t: 0, vy: 0 });   // used to be in range, now is not
    await new Promise(r => setTimeout(r, 500));
    return { gold: L.gold, left: coins.length };
  });
  check('gold at the old radius is no longer grabbed', noPull.gold === 0 && noPull.left === 1, noPull);

  // --- 3. hold a weapon slot for its card ---
  await hold('.slot', 1, 600);
  let card = await page.evaluate(() => {
    const el = document.querySelector('.pop:not(.ingame)');
    return el && { title: el.querySelector('.ptitle b').textContent,
                   rows: [...el.querySelectorAll('.prow')].length,
                   mods: [...el.querySelectorAll('.dtile')].map(t => t.textContent) };
  });
  check('holding a slot shows that gun', card && card.title === 'Old Blaster', card && card.title);
  check('the card lists its stats', card && card.rows === 9, card && card.rows);
  check('and the mods fitted to it', card && card.mods.join(',').indexOf('Blast') >= 0, card && card.mods);
  check('holding did not change the selection', (await LO()).sel === 0, await LO());
  await page.tap('.shade', { position: { x: 20, y: 20 } });
  await page.waitForTimeout(200);
  check('tapping away closes it', (await page.$('.pop:not(.ingame)')) === null);
  await page.tap('.slot >> nth=1');
  await page.waitForTimeout(180);
  check('a plain tap still selects', (await LO()).sel === 1, await LO());
  await page.tap('.slot >> nth=0');
  await page.waitForTimeout(150);

  // --- 4. walking onto a gun opens the chooser ---
  const before = await LO();
  const foundName = await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const gp = pickups.find(q => q.kind === 'gun');
    gp.x = p.x + 6; gp.y = p.y + 11;
    await new Promise(r => setTimeout(r, 250));
    return gp.gun.name;
  });
  check('the chooser opens', (await page.$('.sheet')) !== null);
  check('it does NOT equip on its own', JSON.stringify((await LO()).guns) === JSON.stringify(before.guns), await LO());
  const paused = await page.evaluate(async () => {
    const y0 = window.__lvl.p.y;
    await new Promise(r => setTimeout(r, 300));
    return y0 === window.__lvl.p.y && window.__in.current.paused === true;
  });
  check('the game is paused behind it', paused);
  const shown = await page.evaluate(() => document.querySelector('.pop.flow .ptitle b').textContent);
  check('it shows the found gun', shown === foundName, { shown, foundName });
  check('with a button per slot', (await page.$$('.swaprow .gtab')).length === 4);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'gun_swap.png') });

  // tap an equipped slot -> its own card
  await page.tap('.swaprow .gtab >> nth=1');
  await page.waitForTimeout(220);
  const peek = await page.evaluate(() => ({
    found: document.querySelector('.pop.flow .ptitle b').textContent,
    peeked: document.querySelector('.sheet .pop:not(.flow) .ptitle b').textContent,
  }));
  check('tapping a slot shows that gun as well', peek.peeked === 'Old Blaster', peek);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'gun_peek.png') });
  await page.tap('.shade', { position: { x: 20, y: 20 } });
  await page.waitForTimeout(200);

  // hold an equipped slot -> swap
  await hold('.swaprow .gtab', 1, 620);
  const after = await LO();
  check('holding a slot takes the gun', after.guns[1] === foundName, { after, foundName });
  check('and does NOT change which gun you hold', after.sel === before.sel, { was: before.sel, now: after.sel });
  check('the chooser closes', (await page.$('.sheet')) === null);
  check('the game resumes', (await page.evaluate(() => window.__in.current.paused)) === false);
  const left = await page.evaluate(() => {
    const gp = window.__lvl.pickups.find(q => q.kind === 'gun' && !q.taken);
    return gp && gp.gun.name;
  });
  check('your old gun is left on the ground', left === before.guns[1], { left, was: before.guns[1] });

  // --- 5. leaving one alone ---
  await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const gp = pickups.find(q => q.kind === 'gun');
    // stands in for walking onto a different gun: the one just dropped is still
    // inside its two-second cooldown, which is what stops it reopening on its own
    gp.lock = false; gp.cool = 0; gp.x = p.x + 6; gp.y = p.y + 11;
    await new Promise(r => setTimeout(r, 250));
  });
  check('chooser opens again for another gun', (await page.$('.sheet')) !== null);
  await page.tap('.done');
  await page.waitForTimeout(250);
  check('Leave it closes without taking', (await page.$('.sheet')) === null && JSON.stringify((await LO()).guns) === JSON.stringify(after.guns), await LO());
  check('and the game resumes', (await page.evaluate(() => window.__in.current.paused)) === false);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
