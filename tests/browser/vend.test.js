// The level vending machines (src/game/systems/vend.js): a run starts with no level (solid dark
// over a sealed shop roof, no ambience); at the buy machine a right-stick flick up/down picks the
// floor (floor 1 for sale, floor 2 greyed, no further), its screens follow, a tap buys it, and the level bought on credit teleports in, made ahead by the
// worker (game/levelgen.js); the exit portal drops you back in the shop; the sell machine is red and
// refuses while anything biological is left, then pays LVL_SELL and the level teleports away; the
// machine then sells floor 2 too, its debt the exponential lvlBuy(2). The sell machine is lit from the
// start, green with no "biological" line; half a second after a buy it glitches to red with it.
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
  // a real flick on the right stick (ui/hud.js): down, out past the trigger ring up or down, let go
  const flick = dir => page.evaluate(dir => {
    const el = document.querySelectorAll('.stick')[1], r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, o = { pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: cx, clientY: cy }));
    el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: cx + 2, clientY: cy - dir * r.width * 0.4 }));
    // held a few frames, as a thumb would, before letting go
    return new Promise(res => setTimeout(() => { el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: cx + 2, clientY: cy - dir * r.width * 0.4 })); res(); }, 80));
  }, dir);
  const buyLook = () => page.evaluate(() => {
    const L = window.__lvl, f = pickedFloor(L), ok = canBuyFloor(window.__in.current.loadout.soldTop || 0, f);
    return { f, ok, pick: !!document.querySelector('.pbuy.pick'), cant: !!document.querySelector('.pbuy.pick .popt.cant'),
      bullets: L.bullets.length };
  });
  const waitWarp = async () => {
    for (let i = 0; i < 80; i++) { if (!(await state()).warp) return true; await page.waitForTimeout(100); }
    return false;
  };
  const X = await page.evaluate(() => ({ buy: VEND_BUY_X, sell: VEND_SELL_X, LVL_BUY, LVL_SELL }));

  let s = await state();
  check('a run starts with no level', !s.has && s.open === 0 && s.enemies === 0, s);
  check('and the shop roof sealed', s.roofHole === 0, s.roofHole);
  const sellLook = () => page.evaluate(() => { const r = sellScreen(window.__lvl); return { hue: r.hue, text: r.top.concat(r.bot).join(' '), glitch: !!r.from, t: window.__lvl.time }; });
  let sl = await sellLook();
  check('the sell machine is lit green from the start, no "biological" line', sl.hue === '#00ff3c' && !/biological/.test(sl.text) && !sl.glitch, sl);
  let gold0 = s.gold;

  await standAt(X.buy);
  await page.waitForTimeout(200);
  s = await state();
  check('the buy machine offers "Tap R to Buy"', s.prompt === 'Tap R to Buy' && s.can, s.prompt);
  await page.screenshot({ path: path.join(DIR, 'vend_start.png') });

  check('no level: no ambience', await page.evaluate(() => SFX.ambience === null), await page.evaluate(() => SFX.ambience));
  // the worker makes floor 1's level meanwhile
  let made = false;
  for (let i = 0; i < 100 && !made; i++) { made = await page.evaluate(() => !!LVLGEN.ready); if (!made) await page.waitForTimeout(100); }
  check('the worker made floor 1 ahead of time', made && await page.evaluate(() => LVLGEN.ready.floor === 1 && !LVLGEN.broken),
    await page.evaluate(() => ({ broken: LVLGEN.broken, pend: !!LVLGEN.pend })));

  // the hint is two options: Select Level (the R with arrows) and Tap R to Buy
  let bl = await buyLook();
  check('two options: Select Level and Tap R to Buy', bl.pick && !bl.cant && bl.f === 1, bl);
  check('the right stick picks the level there', await page.evaluate(() => window.__in.current.lvlPick === true));
  await page.screenshot({ path: path.join(DIR, 'vend_start.png') });
  await flick(1); await page.waitForTimeout(150);
  bl = await buyLook();
  check('stick input hides the hint', await page.evaluate(() => !!document.querySelector('.buypanel.pickhide')));
  await page.waitForTimeout(1000);
  check('still hidden a second later', await page.evaluate(() => !!document.querySelector('.buypanel.pickhide')));
  await page.waitForTimeout(900);
  check('back after 1.5 s without input', await page.evaluate(() => !!document.querySelector('.buypanel.pickpanel:not(.pickhide)')));
  check('a flick up picks floor 2, greyed (not for sale)', bl.f === 2 && !bl.ok && bl.cant, bl);
  check('the buy screen shows floor 2 in grey', await page.evaluate(() => pickedFloor(window.__lvl) === 2));
  await page.screenshot({ path: path.join(DIR, 'vend_grey.png') });
  await flick(1); await page.waitForTimeout(150);
  bl = await buyLook();
  check('no further than one past what is for sale', bl.f === 2, bl);
  await tap(); await page.waitForTimeout(150);
  check('a greyed floor will not buy', await page.evaluate(() => !window.__lvl.hasLvl && !window.__lvl.warp));
  await flick(-1); await page.waitForTimeout(150);
  bl = await buyLook();
  check('a flick down: back to floor 1, green', bl.f === 1 && bl.ok && !bl.cant, bl);
  await flick(-1); await page.waitForTimeout(150);
  check('and no lower than floor 1', (await buyLook()).f === 1);
  const t0 = await page.evaluate(() => window.__lvl.time);
  await tap();
  // the sell screen: still green for SELL_WAIT, glitches, then red with the biological line
  let green = 0, glitched = false, redAt = -1, shot = false;
  for (let i = 0; i < 200 && redAt < 0; i++) {
    sl = await sellLook();
    if (sl.glitch) { glitched = true; if (!shot && sl.t - t0 > 0.7) { shot = true; await page.screenshot({ path: path.join(DIR, 'vend_glitch.png') }); } }
    else if (sl.hue === '#00ff3c' && !/biological/.test(sl.text)) green = sl.t - t0;
    else if (sl.hue === '#ff0000' && /biological/.test(sl.text)) redAt = sl.t - t0;
    await page.waitForTimeout(15);
  }
  check('after the buy the sell screen stays green about half a second', green > 0.35, green);
  check('then glitches', glitched);
  check('and lands red, with "no biological entities accepted"', redAt > 0.9 && redAt < 1.6, redAt);
  await page.screenshot({ path: path.join(DIR, 'vend_flash.png') });
  check('the teleport ran out', await waitWarp());
  s = await state();
  check('bought: the level is here', s.has && s.open > 10000 && s.enemies > 20, { open: s.open, enemies: s.enemies });
  check('it was the worker level', await page.evaluate(() => LVLGEN.made === 1), await page.evaluate(() => LVLGEN.made));
  check('drawn in all the way (bottom to top)', await page.evaluate(() => window.__lvl.reveal === 0));
  check('the floor ambience is on', await page.evaluate(() => !!SFX.ambience || !SFX.ready));
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
  check('three exits, evenly spaced across the top', await page.evaluate(() => {
    const P = window.__lvl.portals, c = P.map(q => q.x + q.w / 2);
    return P.length === 3 && Math.abs((c[1] - c[0]) - (c[2] - c[1])) < 4 && P.every(q => q.y === P[0].y);
  }));
  // stand beside the left exit a moment (a screenshot of it, its pad lit, no crackle until used)
  await page.evaluate(() => { const L = window.__lvl, P = L.portals[0]; L.p.x = P.x + 40; L.p.y = P.y + P.h - 22; L.p.vx = L.p.vy = 0; L.toasts.length = 0; L.levelT = 99; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(DIR, 'vend_exit.png') });
  check('an exit pad does not crackle before it is used', await page.evaluate(() => !(window.__lvl.padZap[2] > 0)));
  await page.evaluate(() => { const L = window.__lvl, P = L.portals[2]; L.p.x = P.x + P.w / 2 - 6; L.p.y = P.y + P.h / 2 - 11; L.p.vx = L.p.vy = 0; });
  await page.waitForTimeout(300);
  s = await state();
  check('an exit portal takes you back to the shop', s.py > await page.evaluate(() => window.__lvl.world.SHOP_Y) && s.floor === 1 && s.has, s);
  check('and both its pads crackle', await page.evaluate(() => { const L = window.__lvl; return L.time - L.padZap[4] < 1 && L.time - L.padZap[1] < 1; }));

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
  check('debt paid off, and the reward (1,000) to you', s.gold === gold0 + 1000 && s.debt === 0, s);
  check('and no deadline any more', !(await page.evaluate(() => window.__in.current.loadout.due)));
  check('the debt line is gone', await page.evaluate(() => !document.querySelector('.gold .debt')));
  check('and the next floor is up for sale', s.floor === 2, s.floor);
  await standAt(X.buy);
  await page.waitForTimeout(200);
  s = await state();
  check('the buy machine is back on', s.prompt === 'Tap R to Buy', s.prompt);
  check('sold once: floor 2 is for sale', await page.evaluate(() => window.__in.current.loadout.soldTop === 1));
  bl = await buyLook();
  check('floor 2 picked and for sale', bl.f === 2 && bl.ok, bl);
  await flick(1); await page.waitForTimeout(150);
  bl = await buyLook();
  check('a flick up shows floor 3 greyed', bl.f === 3 && !bl.ok && bl.cant, bl);
  await page.screenshot({ path: path.join(DIR, 'vend_next.png') });
  await flick(-1); await page.waitForTimeout(150);
  await tap();
  await page.waitForTimeout(300);
  check('the teleport ran out (floor 2)', await waitWarp());
  s = await state();
  const X2 = await page.evaluate(() => ({ b2: lvlBuy(2), s2: lvlSell(2) }));
  check('floor 2 bought: its debt is bigger, exponentially', s.has && s.floor === 2 && s.debt === X2.b2 && X2.b2 === X.LVL_BUY * 3 && X2.s2 > X.LVL_SELL, { s, X2 });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
