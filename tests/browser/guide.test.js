// v0.0.141: a new run's guide hologram (world/guide.js). Walk right out of the dark teleporter end:
// once the teleporter is off screen the hall ahead snaps on and the guide is there, waving; its box
// types the welcome, then it hands out the starter kit (150 gold, 3 red + 1 green crystal, Buzzsaw,
// Bolt, Double Cast, a level 5 gun with 3 slots that doesn't shuffle) and goes; the hall past it
// lights only after. Run through it while it talks: it glitches, says the rude line, gives nothing.
// Screenshots: guide-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_INTRO = true; window.__TEST_VOID = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    return page;
  };
  const g = page => page.evaluate(() => { const L = window.__lvl, q = L.guide; return { st: q && q.st, page: q && q.page, x: q && q.x, t: L.time,
    camX: L.camX, pcx: L.p.x + 6, on: L.shopLit && L.shopLit.on.slice(), hold: q && q.hold }; });
  // walk right (the d key) until the guide shows, or give up
  const walkIn = async page => {
    await page.evaluate(() => { window.__in.current.keys.d = true; });
    for (let i = 0; i < 160; i++) { if ((await g(page)).st !== 'wait') break; await page.waitForTimeout(25); }
    await page.evaluate(() => { window.__in.current.keys.d = false; window.__lvl.p.vx = 0; });
  };
  const until = async (page, ok, tries = 200) => { for (let i = 0; i < tries; i++) { const s = await g(page); if (ok(s)) return s; await page.waitForTimeout(50); } return g(page); };

  // ---- the welcome, start to finish ----
  {
    const page = await open();
    const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'guide-' + n + '.png') });
    let s = await until(page, q => q.t > 2.4);
    check('a new run has a guide waiting', s.st === 'wait', s);
    const W0 = await page.evaluate(() => ({ heal: HEAL_X, buy: VEND_BUY_X, perks: SHOP_MACHINE_X[2], WW, ARRIVAL_X }));
    check('the heal and machines stand at the far right, the way in where it was', W0.ARRIVAL_X === 66 && W0.heal > 500 && W0.perks + 40 < W0.WW, W0);
    await walkIn(page);
    s = await g(page);
    check('it jumps out once the teleporter is off screen', s.st === 'appear' && s.camX > 100, s);
    check('ahead of you, in the empty hall', s.x > s.pcx + 20 && s.x < W0.heal - 40, s);
    const litNow = s.on.filter(v => v >= 0).length;
    check('the hall where it stands snaps on, and no further', litNow >= 2 && s.hold === s.on.indexOf(-1), s);
    await page.waitForTimeout(140);
    await shot('1-appear');
    s = await until(page, q => q.st === 'talk' && q.t > 0);
    await page.waitForTimeout(1600);
    await shot('2-talk');
    const typed = await page.evaluate(() => { const q = window.__lvl.guide; return guideSpeech(q, DEV.guideCps); });
    check('its box types the welcome a letter at a time', typed.n > 5 && typed.n < typed.text.length && typed.text.startsWith('Welcome real person'), typed);
    // the rest at speed
    await page.evaluate(() => { DEV.guideCps = 400; DEV.guideWait = 0.05; });
    s = await until(page, q => q.page >= 6 || q.st === 'give');
    await page.evaluate(() => { DEV.guideCps = 30; });
    await page.waitForTimeout(300);
    await shot('3-last');
    check('the hall past it is still dark while it talks', s.on.slice(s.hold).every(v => v < 0), s);
    s = await until(page, q => q.st === 'gone');
    check('it hands out the kit and goes', s.st === 'gone', s);
    await page.waitForTimeout(700);
    await shot('4-kit');
    const kit = await page.evaluate(() => {
      const L = window.__lvl, P = L.pickups;
      return { gold: L.coins.reduce((a, c) => a + c.amount, 0) + window.__in.current.loadout.gold - START_GOLD,
        red: P.filter(q => q.kind === 'crystal' && !q.green).length, green: P.filter(q => q.kind === 'crystal' && q.green).length,
        mods: P.filter(q => q.kind === 'mod').map(q => q.id).sort(),
        guns: P.filter(q => q.kind === 'gun').map(q => ({ lvl: q.gun.lvl, cap: q.gun.cap, slots: q.gun.slots.length, shuffle: q.gun.shuffle, empty: q.gun.slots.every(x => !x) })) };
    });
    check('150 gold', kit.gold === 150, kit.gold);
    check('3 red crystals and a green', kit.red === 3 && kit.green === 1, kit);
    check('Buzzsaw, Bolt and Double Cast', JSON.stringify(kit.mods) === JSON.stringify(['bolt', 'double', 'saw']), kit.mods);
    check('a level 5 gun, 3 slots, in order', kit.guns.length === 1 && kit.guns[0].lvl === 5 && kit.guns[0].cap === 3 && kit.guns[0].slots === 3 && !kit.guns[0].shuffle && kit.guns[0].empty, kit.guns);
    // the hall lights on as you go once it's gone
    await page.evaluate(() => { window.__in.current.keys.d = true; });
    s = await until(page, q => q.on[q.on.length - 1] >= 0 || q.pcx > 1100, 300);
    await page.evaluate(() => { window.__in.current.keys.d = false; });
    check('and the rest of the hall lights up as you carry on', s.on.filter(v => v >= 0).length > litNow + 3, s.on);
    await page.context().close();
  }

  // ---- run through it ----
  {
    const page = await open();
    const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'guide-' + n + '.png') });
    await until(page, q => q.t > 2.4);
    await walkIn(page);
    let s = await until(page, q => q.st === 'talk' && q.t > 1);
    await page.evaluate(() => { window.__in.current.keys.d = true; });
    s = await until(page, q => q.st === 'rude');
    check('run through it while it talks: it turns rude', s.st === 'rude', s);
    await page.evaluate(() => { window.__in.current.keys.d = false; window.__lvl.p.vx = 0; });
    await page.waitForTimeout(1200);
    await shot('5-rude');
    const say = await page.evaluate(() => guideSpeech(window.__lvl.guide, DEV.guideCps).text);
    check('and says so', say.startsWith('Rude. Yeh OK have fun!'), say);
    s = await until(page, q => q.st === 'gone');
    const got = await page.evaluate(() => ({ p: window.__lvl.pickups.filter(q => q.kind === 'mod' || q.kind === 'gun').length, coins: window.__lvl.coins.length }));
    check('then goes without giving you anything', s.st === 'gone' && got.p === 0 && got.coins === 0, got);
    await page.context().close();
  }

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
