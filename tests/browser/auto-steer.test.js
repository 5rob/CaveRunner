// CaveRunner Auto feedback round 2 (hold-to-steer), real pointer events in a level: a TAP on player 1's helmet in the nav
// opens his menu and steers no one; a HOLD (past DEV.autoHoldMs) puts him in manual mode: the level's own scroll stops,
// the pill stick walks him forward and back through the world with the scroll following (S.scroll up, then down), the
// view eases him toward the middle, the others follow; B lets him go: the autopilot and the pilot's pace come back.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { Object.assign(DEV, { autoFoeDmg: 0, autoWallMin: 0, autoWallMax: 0 }); saveAutoRun(newRun()); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  for (let i = 0; i < 60 && !(await page.$('.auto')); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(3500);
  const st = () => page.evaluate(() => {
    const S = window.__autoScene, r = S.runners[0], C = window.__title.C;
    return { x: r.x, off: r.x + PW / 2 - TITLE_VW / 2, cvx: r.cvx || 0, ctl: !!r.ctl, lock: C.lock, pace: S.pace, scroll: S.scroll,
      others: S.runners.slice(1).map(o => o.x) };
  });
  const level = () => page.$eval('.anav', n => n.dataset.level);
  const helm = () => page.locator('.anav [data-player="0"]').first();
  const up = () => page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  const B = async () => { await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(300); };

  let s = await st();
  check('the level runs on the pilot\'s pace', s.pace > 0.3 && !s.ctl, s);

  // a tap: his menu, nobody steered
  await helm().dispatchEvent('pointerdown'); await up(); await page.waitForTimeout(400);
  s = await st();
  const lv = await level();
  check('helmet tap: his menu opens, no steering', !s.ctl && s.lock === -1 && lv === 'player', { s, lv });
  await B();
  check('B: back to the player row', (await level()) === 'players');

  // a hold: manual mode
  const hold = await page.evaluate(() => DEV.autoHoldMs);
  await helm().dispatchEvent('pointerdown'); await page.waitForTimeout(hold + 200); await up();
  await page.waitForTimeout(800);
  s = await st();
  check('helmet held: manual mode (steered, the level\'s scroll stops)', s.ctl && s.lock === 0 && Math.abs(s.pace) < 0.6, s);
  check('… no gun arc and no menu in a level', (await page.$$('.aarcc')).length === 0 && (await level()) === 'players');

  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py, { steps: 3 });
  await page.waitForTimeout(1500);
  const sR = await st();
  check('stick right: he walks forward, the scroll follows (goes up)', sR.cvx > 50 && sR.scroll > s.scroll + 30 && sR.pace > 0, { s, sR });
  check('… the others follow, behind him', sR.others.every(x => x < sR.x + 4), sR);
  await page.mouse.move(px - 60, py, { steps: 3 });
  await page.waitForTimeout(2000);
  const sL = await st();
  check('stick left: he walks back, the scroll goes back (down)', sL.cvx < -50 && sL.scroll < sR.scroll - 30 && sL.pace < 0, { sR, sL });
  await page.mouse.move(px, py, { steps: 2 }); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__autoScene.runners[0].x = 20; });
  const o0 = (await st()).off;
  await page.waitForTimeout(1200);
  const sC = await st();
  check('the stick let go off the middle: the view eases him toward the middle', Math.abs(sC.off) < Math.abs(o0) * 0.6, { o0, sC });

  await B();
  s = await st();
  check('B: let go (autopilot, nobody locked)', !s.ctl && s.lock === -1, s);
  await page.waitForTimeout(2500);
  s = await st();
  check('… and the pilot\'s pace is back', s.pace > 0.3, s);

  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
