// The perks you carry: a column going up from above the map button to near the top of the
// screen, then a new column further in; tap one for its card (the game pauses), and R — a right-stick tap, the
// r key, or the card's own line — switches it off and on again.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  const ids = ['unlimited', 'shield', 'tinker', 'sight', 'crit', 'eye', 'gold', 'hearts', 'ghost', 'bounce', 'close', 'conc',
    'contact', 'eradar', 'health', 'knock', 'lev', 'move', 'proj', 'wands'];
  await page.evaluate(ids => { const I = window.__in.current; I.loadout.perks = ids.slice(); I.perksDirty = true; I.notify(); }, ids);
  await page.waitForTimeout(200);

  const lay = await page.evaluate(() => {
    const b = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: r.top, b: r.bottom }; };
    return { map: b(document.querySelector('.mapbtn')), pips: [...document.querySelectorAll('.perkpip')].map(b) };
  });
  const P = lay.pips;
  check('a pip per perk', P.length === ids.length, P.length);
  check('the first sits just above the map button', P[0] && Math.abs(P[0].x - lay.map.x) < 2 && P[0].b < lay.map.t && lay.map.t - P[0].b < 20, { p: P[0], map: lay.map });
  const n1 = P.findIndex(p => Math.abs(p.x - P[0].x) > 2);
  check('they stack upwards', P.slice(1, n1).every((p, i) => p.y < P[i].y - 30));
  check('the first column reaches near the top of the screen', n1 > 8 && P[n1 - 1].t >= 60 && P[n1 - 1].t < 120, { n1, top: P[n1 - 1] && P[n1 - 1].t });
  check('then a new column further in, back at the bottom', P[n1] && P[n1].x > P[0].x + 30 && Math.abs(P[n1].y - P[0].y) < 2, P[n1]);
  check('the pips are 36px', P[0] && Math.round(P[0].b - P[0].t) === 36, P[0]);

  const state = () => page.evaluate(() => ({ paused: window.__in.current.paused, card: !!document.querySelector('.perkinfo'),
    text: (document.querySelector('.perkinfo') || {}).textContent || '', off: window.__in.current.loadout.perksOff || [],
    mana: window.__lvl.pb.mana }));
  await page.tap('.perkpip');
  await page.waitForTimeout(150);
  let s = await state();
  check('tapping a pip opens its card and pauses', s.card && s.paused, s);
  check('the card says how to switch it', /Unlimited Spells/.test(s.text) && /Tap R to toggle on \/ off/.test(s.text), s.text);
  check('unlimited is on to start', s.mana === 0 && /ON/.test(s.text));

  // a dead-zone tap on the right stick
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.sticks .stick')][1], r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await page.waitForTimeout(150);
  s = await state();
  check('a right-stick tap switches it off', s.off.includes(0) && /OFF/.test(s.text) && s.card, s);
  if (process.env.PERK_SHOT) await page.screenshot({ path: process.env.PERK_SHOT });
  await page.keyboard.press('r');
  await page.waitForTimeout(100);
  s = await state();
  check('the r key switches it back on', !s.off.includes(0) && /ON/.test(s.text), s);
  // with the card up, tapping another perk switches the card to it
  const other = await page.evaluate(() => { const r = document.querySelectorAll('.perkpip')[4].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(other.x, other.y);
  await page.waitForTimeout(150);
  s = await state();
  check('tapping another perk shows its card instead', s.card && /Critical|crit/i.test(s.text) && !/Unlimited/.test(s.text), s.text);
  await page.touchscreen.tap(P[0].x, P[0].y);
  await page.waitForTimeout(100);
  await page.tap('.perktoggle');
  await page.waitForTimeout(100);
  // close it: tap the shade up in the play area
  await page.touchscreen.tap(300, 450);
  await page.waitForTimeout(200);
  s = await state();
  check('tapping outside closes it and the game runs', !s.card && !s.paused, s);
  check('off really is off: spells cost mana again', s.off.includes(0) && s.mana !== 0, s.mana);
  const pip = await page.evaluate(() => document.querySelector('.perkpip').className);
  check('an off perk\'s pip shows it', /off/.test(pip), pip);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
