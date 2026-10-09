// CaveRunner Auto's screen (stage 2): the title's ▶ opens it; the four sections with their counts (4 nav
// circles, 70 bag slots, 4 buttons); the play area's scene animates with the run's players; the bag scrolls;
// the saved run's items show with their counts; ⏸ opens the pause menu, and holds the scene.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  // a saved run: 2 players, a gun, gold, a mod stack
  await page.evaluate(() => {
    const run = newRun();
    bagAdd(run, { kind: 'green', n: 1 });
    addPlayer(run);
    bagAdd(run, { kind: 'gun', gun: scratchPistol(), n: 1 });
    bagAdd(run, { kind: 'gold', n: 120 });
    bagAdd(run, { kind: 'mod', id: 'bolt', n: 3 });
    saveAutoRun(run);
  });
  check('the title has ▶ and ⚙ only (no slots)', !!(await page.$('.tstart')) && !!(await page.$('.tgear')) && !(await page.$('.tslot')));
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('▶ opens the auto screen', on && !(await page.$('.title')));
  check('the old game is not mounted', await page.evaluate(() => !window.__lvl));

  const n = await page.evaluate(() => ({
    play: document.querySelectorAll('.auto .aplay canvas').length,
    nav: document.querySelectorAll('.anav .anavc').length, players: document.querySelectorAll('.anav .anavc.on').length,
    slots: document.querySelectorAll('.abag .aslot').length, full: document.querySelectorAll('.abag .aslot.full').length,
    btns: document.querySelectorAll('.abtns button').length,
    gold: (document.querySelector('.aslot.k-gold') || {}).textContent, mod: (document.querySelector('.aslot.k-mod') || {}).textContent,
    gun: !!document.querySelector('.aslot.k-gun canvas'),
  }));
  check('four sections: play area, 4 nav circles (2 players), 70 bag slots, 4 buttons',
    n.play === 1 && n.nav === 4 && n.players === 2 && n.slots === 70 && n.btns === 4, n);
  check('the bag shows the run: gun icon, gold 120, mod ×3', n.full === 3 && n.gun && /120/.test(n.gold) && /3/.test(n.mod), n);
  const order = await page.evaluate(() => ['.aplay', '.anav', '.abag', '.abtns'].map(s => document.querySelector(s).getBoundingClientRect().top));
  check('top to bottom: play, nav, bag, buttons', order.every((v, i) => !i || v > order[i - 1]), order);
  const ph = await page.evaluate(() => document.querySelector('.aplay').getBoundingClientRect().height / innerHeight);
  check('the play area is about 55% of the height', ph > 0.45 && ph < 0.62, ph);

  // the scene runs with the run's players
  let t0 = null, t1 = null;
  for (let i = 0; i < 40 && !t0; i++) { await page.waitForTimeout(50); t0 = await page.$eval('.aplaycvs', c => c.dataset.t); }
  await page.waitForTimeout(600);
  t1 = await page.$eval('.aplaycvs', c => c.dataset.t);
  check('the canvas animates', t0 && Number(t1) > Number(t0), [t0, t1]);
  check('the scene has the run\'s 2 players', await page.evaluate(() => window.__title.S.runners.length === 2));

  // stage 3b: > walks the team to the gun machine (after the teleport-in), A there does nothing
  for (let i = 0; i < 60 && !(await page.evaluate(() => hubState(window.__title.S).arrived[0])); i++) await page.waitForTimeout(50);
  const x0 = await page.evaluate(() => window.__title.S.runners[0].x);
  await page.locator('.abtn.ar').dispatchEvent('pointerdown');
  let at = -1;
  for (let i = 0; i < 80 && at !== 1; i++) { await page.waitForTimeout(50); at = await page.evaluate(() => hubState(window.__title.S).at); }
  const x1 = await page.evaluate(() => window.__title.S.runners[0].x);
  check('> walks the leader right to the gun machine', at === 1 && x1 > x0 + 50, [at, x0, x1]);
  await page.locator('.abtn.aa').dispatchEvent('pointerdown');
  check('A away from the exit does nothing', await page.evaluate(() => hubExitFlash(window.__title.S) === 0));

  // the bag scrolls
  const sc = await page.evaluate(() => { const b = document.querySelector('.abag'); const was = b.scrollTop; b.scrollTop = 9999; return { was, now: b.scrollTop, over: b.scrollHeight > b.clientHeight, ta: getComputedStyle(b).touchAction }; });
  check('the bag scrolls up and down (pan-y)', sc.over && sc.now > sc.was && sc.ta === 'pan-y', sc);

  // ⏸
  await page.locator('.auto .pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(100);
  check('⏸ opens the pause menu with the volumes', !!(await page.$('.pausecard')) && (await page.$$('.pausecard .tvol')).length === 3);
  const p0 = await page.$eval('.aplaycvs', c => c.dataset.t);
  await page.waitForTimeout(300);
  check('and holds the scene', (await page.$eval('.aplaycvs', c => c.dataset.t)) === p0);
  await page.locator('.pbtn.resume').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  check('Resume closes it, the scene goes on', !(await page.$('.pausecard')) && (await page.$eval('.aplaycvs', c => c.dataset.t)) !== p0);
  check('the run is saved', await page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-auto-run')).run.players.length === 2));
  await page.locator('.auto .pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  await Promise.all([page.waitForEvent('load', { timeout: 10000 }), page.locator('.pbtn.exit').dispatchEvent('pointerdown')]);
  await page.waitForTimeout(300);
  check('Exit goes back to the title', !!(await page.$('.title')) && !(await page.$('.auto')));

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
