// The right stick now has a dead zone: drag past it to aim/fire, tap inside it (down,
// never leave, release) to interact. This proves the discrimination itself with real
// PointerEvents on the stick (not the input ref directly, the way other suites drive
// firing), and then proves interact is how pickups and the shop are taken now that
// walking onto something and the Buy button no longer do it.
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

  // Drive the right stick with real PointerEvents, the same way a finger would:
  // down at points[0], a move to each later point, then up at the last one. `mag` on
  // each point is a fraction of the stick's max throw (matching what Stick() computes
  // internally), not a raw pixel offset, so this works at any viewport size.
  const gesture = (points, holdMs = 30) => page.evaluate(async ({ points, holdMs }) => {
    const el = [...document.querySelectorAll('.sticks .stick')][1];
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const maxD = (r.width / 2) * 0.72;
    const at = p => ({ x: cx + p.mag * maxD, y: cy + (p.dy || 0) * maxD });
    const fire = (type, p) => { const xy = at(p);
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
        pointerId: 7, pointerType: 'touch', clientX: xy.x, clientY: xy.y })); };
    window.__lvl.bullets.length = 0;
    fire('pointerdown', points[0]);
    let peak = window.__lvl.bullets.length;
    for (let i = 1; i < points.length; i++) {
      fire('pointermove', points[i]);
      await new Promise(res => setTimeout(res, holdMs));
      peak = Math.max(peak, window.__lvl.bullets.length);
    }
    fire('pointerup', points[points.length - 1]);
    await new Promise(res => setTimeout(res, 150));
    return { peak };
  }, { points, holdMs });

  // stand at the free heal: a plinth gives interact an effect (full hp) that a bullet
  // never produces, so the two can be told apart without touching game internals
  const healUp = async () => page.evaluate(async () => {
    const { p, stock } = window.__lvl;
    const heal = stock.find(s => s.kind === 'heal');
    p.x = heal.x - 6; p.y = heal.y + 4; p.vx = 0; p.vy = 0; p.hp = 10;
    const g = window.__in.current.loadout.guns[0];
    g.manaRegen = 0; g.mana = g.manaMax;
    await new Promise(r => setTimeout(r, 250));
  });

  // ---- 1. a tap that never leaves the dead zone: no bullets, does interact ----
  await healUp();
  let res = await gesture([{ mag: 0.15, dy: 0 }]);
  let hp = await page.evaluate(() => window.__lvl.p.hp);
  check('a tap inside the dead zone fires no bullets', res.peak === 0, res);
  check('and it interacts (heal applied)', hp === 100, hp);

  // ---- 2. a drag beyond the dead zone: fires, and releasing out there does not interact ----
  await healUp();
  res = await gesture([{ mag: 0.15, dy: 0 }, { mag: 0.7, dy: 0 }, { mag: 0.7, dy: 0 }], 60);
  hp = await page.evaluate(() => window.__lvl.p.hp);
  check('dragging past the dead zone fires', res.peak > 0, res);
  check('releasing out there does not interact', hp === 10, hp);

  // ---- 3. drag out and back to centre: still does not interact ----
  await healUp();
  res = await gesture([{ mag: 0.15, dy: 0 }, { mag: 0.7, dy: 0 }, { mag: 0.1, dy: 0 }], 60);
  hp = await page.evaluate(() => window.__lvl.p.hp);
  check('it fired while it was out', res.peak > 0, res);
  check('coming back to centre before release still does not interact', hp === 10, hp);

  // ---- 4. walking onto a mod shows the popup, not the bag; interact takes it ----
  const modRes = await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const LO = window.__in.current.loadout;
    LO.bag.length = 0;
    const mod = pickups.find(q => q.kind === 'mod');
    mod.x = p.x + 6; mod.y = p.y + 11;
    await new Promise(r => setTimeout(r, 200));
    const cardShown = !!document.querySelector('.pop.ingame');
    const bagBefore = LO.bag.length;
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 200));
    return { cardShown, bagBefore, bagAfter: LO.bag.length, gone: !pickups.includes(mod) };
  });
  check('walking onto a mod shows its card, not the bag', modRes.cardShown && modRes.bagBefore === 0, modRes);
  check('interacting collects it', modRes.bagAfter === 1 && modRes.gone, modRes);

  // ---- 5. same for a gun: popup first, chooser only on interact ----
  const gunRes = await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const gp = pickups.find(q => q.kind === 'gun');
    gp.x = p.x + 6; gp.y = p.y + 11;
    await new Promise(r => setTimeout(r, 200));
    const cardShown = !!document.querySelector('.pop.ingame');
    const sheetBefore = !!document.querySelector('.sheet');
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 200));
    return { cardShown, sheetBefore, sheetAfter: !!document.querySelector('.sheet') };
  });
  check('walking onto a gun shows its card, not the chooser', gunRes.cardShown && !gunRes.sheetBefore, gunRes);
  check('interacting opens the chooser', gunRes.sheetAfter, gunRes);
  await page.evaluate(() => [...document.querySelectorAll('.done')]
    .find(x => /Leave/.test(x.textContent)).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(200);

  // ---- 6. no Buy button anywhere, but buying in the shop still works via interact ----
  check('there is no .buy button in the page', (await page.$('.buy')) === null);
  const shopRes = await page.evaluate(async () => {
    const { p, stock } = window.__lvl;
    const mod = stock.find(s => s.kind === 'mod' && !s.sold);
    p.x = mod.x - 6; p.y = mod.y + 4; p.vx = 0; p.vy = 0;
    window.__in.current.loadout.gold = 999;
    window.__in.current.sig = '';
    await new Promise(r => setTimeout(r, 250));
    const bagBefore = window.__in.current.loadout.bag.length;
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 200));
    return { bagBefore, bagAfter: window.__in.current.loadout.bag.length, sold: mod.sold, id: mod.id };
  });
  check('buying in the shop works via interact', shopRes.sold && shopRes.bagAfter === shopRes.bagBefore + 1, shopRes);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
