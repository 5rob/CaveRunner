// The level vending machines (src/game/systems/vend.js): a run starts with no level (solid dark
// over a sealed shop roof); the buy machine sells it on credit (gold goes negative) and it
// teleports in; the exit portal drops you back in the shop; the sell machine is red and refuses
// while anything biological is left, then pays LVL_SELL and the level teleports away; the buy
// machine then offers the next floor's.
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

  const state = () => page.evaluate(() => {
    const L = window.__lvl, C = L.world.CELL, W = L.world.CW;
    let open = 0;                                   // open cells above the shop's roof
    for (let i = 0; i < (L.fog.SHOP_TOP - L.fog.SHOP_ROOF) * W; i++) if (!L.mat[i]) open++;
    let roofHole = 0;
    for (let y = L.fog.SHOP_TOP - L.fog.SHOP_ROOF; y < L.fog.SHOP_TOP; y++) for (let x = 0; x < W; x++) if (!L.mat[y * W + x]) roofHole++;
    return { has: L.hasLvl, warp: !!L.warp, floor: L.floor, gold: window.__in.current.loadout.gold, debt: window.__in.current.loadout.debt || 0, open, roofHole,
      enemies: L.enemies.length, px: L.p.x, py: L.p.y, C,
      prompt: window.__in.current.prompt && window.__in.current.prompt.text,
      can: window.__in.current.prompt && window.__in.current.prompt.can };
  });
  const standAt = x => page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.vx = 0; L.p.hp = 9999; }, x);
  const tap = () => page.evaluate(() => { window.__in.current.interact = true; });
  const waitWarp = async () => {
    for (let i = 0; i < 80; i++) { if (!(await state()).warp) return true; await page.waitForTimeout(100); }
    return false;
  };
  const X = await page.evaluate(() => ({ buy: VEND_BUY_X, sell: VEND_SELL_X, LVL_BUY, LVL_SELL }));

  let s = await state();
  check('a run starts with no level', !s.has && s.open === 0 && s.enemies === 0, s);
  check('and the shop roof sealed', s.roofHole === 0, s.roofHole);
  let gold0 = s.gold;

  await standAt(X.buy);
  await page.waitForTimeout(200);
  s = await state();
  check('the buy machine offers "Tap R to buy"', s.prompt === 'Tap R to buy' && s.can, s.prompt);
  await page.screenshot({ path: path.join(DIR, 'vend_start.png') });

  await tap();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(DIR, 'vend_flash.png') });
  check('the teleport ran out', await waitWarp());
  s = await state();
  check('bought: the level is here', s.has && s.open > 10000 && s.enemies > 20, { open: s.open, enemies: s.enemies });
  check('the roof has its hole again', s.roofHole > 0, s.roofHole);
  check('the price went on your debt, not your gold', s.gold === gold0 && s.debt === X.LVL_BUY, s);
  check('the debt shows in red at the top', await page.evaluate(() => { const d = document.querySelector('.gold .debt'); return !!d && d.getBoundingClientRect().top < 100; }));
  // five real days to repay it, on the device's clock, and saved with the run
  const due = await page.evaluate(() => window.__in.current.loadout.due - Date.now() - DEADLINE_MS);
  check('the repayment deadline is five days out', Math.abs(due) < 10000, due);
  await page.evaluate(() => window.__in.current.saveRun());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-save')).loadout.due);
  check('the deadline is in the save', saved === await page.evaluate(() => window.__in.current.loadout.due), saved);
  check('you stayed at the machine', Math.abs(s.px + 6 - X.buy) < 4, s.px);
  await page.screenshot({ path: path.join(DIR, 'vend_bought.png') });

  // the exit portal drops you back in the shop, the level still there
  await page.evaluate(() => { const L = window.__lvl, P = L.portal; L.p.x = P.x + P.w / 2 - 6; L.p.y = P.y + P.h / 2 - 11; L.p.vx = L.p.vy = 0; });
  await page.waitForTimeout(300);
  s = await state();
  check('the exit portal takes you back to the shop', s.py > await page.evaluate(() => window.__lvl.world.SHOP_Y) && s.floor === 1 && s.has, s);

  // the sell machine refuses while anything biological is left
  await standAt(X.sell);
  await page.waitForTimeout(200);
  s = await state();
  check('the sell machine is locked while creatures live', s.prompt && !s.can, s.prompt);
  await page.screenshot({ path: path.join(DIR, 'vend_locked.png') });
  await tap();
  await page.waitForTimeout(100);
  s = await state();
  check('and a tap does nothing', s.has && s.gold === gold0 && s.debt === X.LVL_BUY);

  // clear it (the nests too: they let more rats out), then it's green and sells
  await page.evaluate(() => { const L = window.__lvl; L.enemies.length = 0; });
  await page.waitForTimeout(200);
  s = await state();
  check('cleared: "Tap R to sell"', s.prompt === 'Tap R to sell' && s.can, s.prompt);
  await page.screenshot({ path: path.join(DIR, 'vend_green.png') });
  await tap();
  await page.waitForTimeout(150);
  check('the teleport ran out again', await waitWarp());
  s = await state();
  check('sold: the level is gone', !s.has && s.open === 0 && s.enemies === 0 && s.roofHole === 0, s);
  check('debt paid off, and 1000 to you', s.gold === gold0 + 1000 && s.debt === 0, s);
  check('and no deadline any more', !(await page.evaluate(() => window.__in.current.loadout.due)));
  check('the debt line is gone', await page.evaluate(() => !document.querySelector('.gold .debt')));
  check('and the next floor is up for sale', s.floor === 2, s.floor);
  await standAt(X.buy);
  await page.waitForTimeout(200);
  s = await state();
  check('the buy machine is back on', s.prompt === 'Tap R to buy', s.prompt);
  await page.screenshot({ path: path.join(DIR, 'vend_next.png') });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
