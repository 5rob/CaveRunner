// The repayment deadline running out (src/game/systems/vend.js, stepRepo): the level is
// repossessed (REPOSSESSED on the hologram, the level teleported away with you in the shop),
// the red emergency lights and a ten second countdown, then fire jets out of the shop floor burn
// you until you're dead.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const DIR = path.join(__dirname, '..', 'build');
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.addInitScript(() => { window.__TEST_VOID = true; });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1300);
  const until = async (fn, tries) => {
    for (let i = 0; i < tries; i++) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(100); }
    return false;
  };
  // buy the level, then go up into it
  await page.evaluate(() => { window.__lvl.p.x = VEND_BUY_X - 6; });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__in.current.interact = true; });
  check('bought', await until(() => window.__lvl.hasLvl && !window.__lvl.warp, 60));
  await page.evaluate(() => { const L = window.__lvl; L.sandbox(); L.p.hp = 100; });

  // the clock passes the deadline
  await page.evaluate(() => { window.__in.current.loadout.due = Date.now() - 1; });
  check('the deadline passing starts the repossession', await until(() => !!window.__lvl.repo, 20));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, 'repo_holo.png') });
  check('the level is teleported away, you with it into the shop', await until(() => {
    const L = window.__lvl; return !L.hasLvl && !L.warp && L.p.y > L.world.SHOP_Y;
  }, 80), await page.evaluate(() => ({ has: window.__lvl.hasLvl, py: window.__lvl.p.y })));
  let open = await page.evaluate(() => { const L = window.__lvl; let n = 0; for (let i = 0; i < (L.fog.SHOP_TOP - L.fog.SHOP_ROOF) * L.world.CW; i++) if (!L.mat[i]) n++; return n; });
  check('nothing left above the roof', open === 0, open);
  check('the machines are off limits', await page.evaluate(() => { window.__lvl.p.x = VEND_SELL_X - 6; return true; }) &&
    await until(() => !window.__in.current.prompt, 10));

  // the alarm and the countdown
  check('the alarm starts', await until(() => window.__lvl.repo.t >= REPO_ALARM + 1, 40));
  await page.screenshot({ path: path.join(DIR, 'repo_alarm.png') });
  const hp0 = await page.evaluate(() => window.__lvl.p.hp);
  check('nothing hurts you during the countdown', hp0 === 100, hp0);

  // skip to the fire
  await page.evaluate(() => { window.__lvl.repo.t = REPO_FIRE + 0.5; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(DIR, 'repo_fire.png') });
  const hp1 = await page.evaluate(() => window.__lvl.p.hp);
  check('the fire burns you', hp1 < 100, hp1);
  check('until you are dead', await until(() => window.__lvl.p.dead, 150), await page.evaluate(() => window.__lvl.p.hp));

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
