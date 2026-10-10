// CaveRunner Auto feedback round 2 (recheck), real pointer events in a level: player 1 picked by his helmet in the nav is
// steered by the pill stick (the camera follows him; pushed right he gains on the team, up he jets; nothing else moves
// the team's pace); B back to the player row lets him go (autopilot, camera free, no ring). Picking a player by tapping
// him in the play area works the same, and B lets him go.
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
  await page.waitForTimeout(3000);
  const st = () => page.evaluate(() => { const S = window.__autoScene, r = S.runners[0], C = window.__title.C; return { x: r.x, y: r.y, cvx: r.cvx || 0, ctl: !!r.ctl, lock: C.lock, flame: r.flame }; });
  const tapNav = async sel => { await page.locator('.anav ' + sel).first().dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(350); };
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  const stick = async (dx, dy, ms) => { await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + dx, py + dy, { steps: 3 }); await page.waitForTimeout(ms); };
  const B = async () => { await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(300); };

  await tapNav('[data-player="0"]');
  let s = await st();
  check('player 1 picked by his helmet: steered, the camera follows him', s.ctl && s.lock === 0, s);
  await page.evaluate(() => { window.__autoScene.runners[0].x = 30; });
  await stick(60, 0, 900);
  s = await st();
  const hold = await page.evaluate(() => levelState(window.__autoScene).hold);
  check('stick right: he walks right through the world, past where the autopilot keeps players', s.cvx > 100 && s.x > 60, s);
  check('… and the team\'s pace is left alone', hold === 0, hold);
  await page.mouse.move(px, py - 60, { steps: 3 }); await page.waitForTimeout(400);
  const s2 = await st();
  check('stick up: he jets', s2.flame > 0.5 && s2.y < s.y, { s, s2 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await B();
  s = await st();
  check('B back to the player row: let go (autopilot, camera free, no helmet ring)', !s.ctl && s.lock === -1 && !(await page.$('.anav .anavc.sel')), s);

  // picked by a tap in the play area
  await page.evaluate(() => { const C = window.__title.C, S = window.__autoScene; C.lock = S.runners[0].id; });
  await page.waitForTimeout(300);
  s = await st();
  check('picked in the play area: steered', s.ctl, s);
  await B();
  s = await st();
  check('B: let go', !s.ctl && s.lock === -1, s);

  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
