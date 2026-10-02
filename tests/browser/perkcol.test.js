// The perks fitted to the Exo Suit: a column going up from above the map button; tap one for its
// card (the game pauses), tap another to switch, tap away to close. Carried perks don't show.
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
  // fitted: six general perks and a stat perk in each stat slot; carried ones don't show
  const suit = ['unlimited', 'shield', 'tinker', 'sight', 'crit', 'eye', 'st_hp1', 'st_walk2', 'st_fuel3', 'st_refuel4', 'st_pull5'];
  await page.evaluate(suit => { const I = window.__in.current; I.loadout.suit = suit.slice(); I.loadout.perks = ['gold', 'ghost']; I.perksDirty = true; I.notify(); }, suit);
  await page.waitForTimeout(200);

  const lay = await page.evaluate(() => {
    const b = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: r.top, b: r.bottom }; };
    return { map: b(document.querySelector('.mapbtn')), pips: [...document.querySelectorAll('.perkpip')].map(b) };
  });
  const P = lay.pips;
  check('a pip per fitted perk, none for carried ones', P.length === suit.length, P.length);
  check('the first sits just above the map button', P[0] && Math.abs(P[0].x - lay.map.x) < 2 && P[0].b < lay.map.t && lay.map.t - P[0].b < 20, { p: P[0], map: lay.map });
  check('they stack upwards', P.slice(1).every((p, i) => p.y < P[i].y - 30 || Math.abs(p.x - P[i].x) > 2));
  check('the pips are 36px', P[0] && Math.round(P[0].b - P[0].t) === 36, P[0]);
  check('fitted stat perks count (Movement Speed II)', await page.evaluate(() => Math.abs(window.__lvl.pb.walk - 1.16) < 1e-9));

  const state = () => page.evaluate(() => ({ paused: window.__in.current.paused, card: !!document.querySelector('.perkinfo'),
    text: (document.querySelector('.perkinfo') || {}).textContent || '' }));
  await page.tap('.perkpip');
  await page.waitForTimeout(150);
  let s = await state();
  check('tapping a pip opens its card and pauses', s.card && s.paused, s);
  check('the card says it is fitted to the suit', /Unlimited Spells/.test(s.text) && /Exo Suit/.test(s.text), s.text);
  const other = await page.evaluate(() => { const r = document.querySelectorAll('.perkpip')[4].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(other.x, other.y);
  await page.waitForTimeout(150);
  s = await state();
  check('tapping another perk shows its card instead', s.card && /Critical|crit/i.test(s.text) && !/Unlimited/.test(s.text), s.text);
  await page.touchscreen.tap(300, 450);
  await page.waitForTimeout(200);
  s = await state();
  check('tapping outside closes it and the game runs', !s.card && !s.paused, s);

  await browser.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
