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

  // ---- the control deck: a thumb-sized knob, and two rings on the right stick ----
  const deck = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.sticks .stick')];
    const w = el => el ? Math.round(el.getBoundingClientRect().width) : 0;
    const ring = (el, sel) => { const e = el.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().width) : 0; };
    const bg = getComputedStyle(document.querySelector('.controls')).backgroundColor.match(/\d+/g) || [];
    const half = w(s[1]) / 2;
    return {
      n: s.length, stick: w(s[0]), right: w(s[1]),
      knob: w(s[1].querySelector('.knob')), knobLeft: w(s[0].querySelector('.knob')),
      dead: ring(s[1], '.deadzone'), thr: ring(s[1], '.throw'),
      leftRings: s[0] ? s[0].querySelectorAll('.deadzone, .throw').length : -1,
      // where the amber ring ought to be: the throw you have to make (AIM_DEAD of the
      // knob's travel) plus one knob radius, so the knob's EDGE crosses it exactly as
      // the trigger goes live
      want: 2 * (AIM_DEAD * 0.72 * half + w(s[1].querySelector('.knob')) / 2),
      // how dark the panel actually is, 0 black to 255 white
      lum: bg.length >= 3 ? Math.round((+bg[0] + +bg[1] + +bg[2]) / 3) : 999,
    };
  });
  check('there are two thumb circles', deck.n === 2, deck);
  // the knob is the bit under your thumb, and it has to show an edge around one
  check('the knob you drag is thumb-sized, not a dot',
    deck.knob >= 60 && deck.knob / deck.stick > 0.3, deck);
  check('both sticks carry one', deck.knob === deck.knobLeft, deck);
  check('the amber ring is outside the knob, so crossing it means something',
    deck.dead > deck.knob, deck);
  check('and it is drawn where the trigger actually goes live',
    Math.abs(deck.dead - deck.want) < 8, { ring: deck.dead, shouldBe: Math.round(deck.want) });
  check('the dashed ring is outside that again',
    deck.thr > deck.dead, deck);
  check('the left one has neither ring', deck.leftRings === 0, deck.leftRings);
  check('the deck is black rather than blue', deck.lum < 40, deck.lum);

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

  // ---- 4. walking onto a mod shows the popup, not the bag; interact opens the card,
  //         and the game waits there until the stick points at pick up or leave ----
  const openMod = () => page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const LO = window.__in.current.loadout;
    LO.bag.length = 0;
    const mod = pickups.find(q => q.kind === 'mod' && !q.taken);
    mod.x = p.x + 6; mod.y = p.y + 11; mod.cool = 0;
    await new Promise(r => setTimeout(r, 200));
    const cardShown = !!document.querySelector('.pop.ingame');
    const bagBefore = LO.bag.length;
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 250));
    return { cardShown, bagBefore, bagAfter: LO.bag.length, mod,
      overlay: !!document.querySelector('.modfound'),
      buttons: [...document.querySelectorAll('.modfoundbtn')].map(b => b.textContent),
      paused: window.__in.current.paused };
  });

  let modRes = await openMod();
  check('walking onto a mod shows its card, not the bag', modRes.cardShown && modRes.bagBefore === 0, modRes.cardShown);
  check('interacting on a mod asks instead of taking it', modRes.bagAfter === 0, modRes.bagAfter);
  check('the card comes up with the game paused behind it', modRes.overlay && modRes.paused, modRes);
  check('and it offers exactly pick up or leave',
    modRes.buttons.join('|') === 'Pick up|Leave', modRes.buttons);

  // the gesture the card is built around: drag the right stick at a button and let go.
  // The point is computed from the button's own position, so it holds at any viewport.
  const aimStick = which => page.evaluate(async which => {
    const el = [...document.querySelectorAll('.sticks .stick')][1];
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const btn = [...document.querySelectorAll('.modfoundbtn')][which === 'take' ? 0 : 1];
    const b = btn.getBoundingClientRect();
    const a = Math.atan2(b.top + b.height / 2 - cy, b.left + b.width / 2 - cx);
    const maxD = (r.width / 2) * 0.72;
    const x = cx + Math.cos(a) * maxD * 0.85, y = cy + Math.sin(a) * maxD * 0.85;
    const fire = (type, px, py) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch',
      clientX: px, clientY: py }));
    fire('pointerdown', cx, cy);
    fire('pointermove', x, y);
    await new Promise(r2 => setTimeout(r2, 40));
    fire('pointerup', x, y);
    await new Promise(r2 => setTimeout(r2, 250));
    return { deg: Math.round(a * 180 / Math.PI) };
  }, which);

  await aimStick('take');
  const took = await page.evaluate(() => ({
    bag: window.__in.current.loadout.bag.length,
    overlay: !!document.querySelector('.modfound'),
    paused: window.__in.current.paused,
  }));
  check('dragging the stick at Pick up takes it', took.bag === 1, took);
  check('and closes the card, resuming the game', !took.overlay && !took.paused, took);

  // and the other way out: leaving keeps it on the ground and out of the bag
  modRes = await openMod();
  check('a second mod opens the card again', modRes.overlay && modRes.bagAfter === 0, modRes.overlay);
  await aimStick('leave');
  const left = await page.evaluate(() => ({
    bag: window.__in.current.loadout.bag.length,
    overlay: !!document.querySelector('.modfound'),
    onGround: window.__lvl.pickups.filter(q => q.kind === 'mod' && !q.taken).length,
  }));
  check('dragging the stick at Leave leaves it', left.bag === 0 && !left.overlay, left);
  check('and the mod is still lying there', left.onGround > 0, left.onGround);

  // a tap on the dead zone while the card is up must not take anything, or the card
  // would swallow the very tap that was meant to open it
  modRes = await openMod();
  await gesture([{ mag: 0.1, dy: 0 }]);
  const tapped = await page.evaluate(() => ({
    bag: window.__in.current.loadout.bag.length,
    overlay: !!document.querySelector('.modfound'),
  }));
  check('a plain tap on the dead zone does not decide for you',
    tapped.bag === 0 && tapped.overlay, tapped);
  await aimStick('leave');            // tidy up for the checks below

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
