// The title screen (LIST4 #4; CaveRunner Auto branch): the title shows (window.__TEST_TITLE), its action
// scene runs, the camera's pinch / drag / tap-to-follow, its sounds, ⚙ and ▶ (the settings; ▶ opens the auto
// screen). The auto screen's pause menu: tests/browser/auto-screen.test.js. (The 3-slot picker, delete, and the
// old game's pause / dev-mode checks were retired with the slots on this branch: stage 2.)
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
  await page.waitForTimeout(600);
  const down = sel => page.locator(sel).first().dispatchEvent('pointerdown');
  const ls = k => page.evaluate(k => localStorage.getItem(k), k);

  check('the title shows, ▶ and ⚙ only (one save, no slots)', !!(await page.$('.title .tstart')) && !!(await page.$('.title .tgear')) && !(await page.$('.tslot')));
  check('no game behind it', await page.evaluate(() => !window.__lvl));
  const k0 = Number(await page.$eval('.titlecvs', c => c.dataset.kills || '0'));
  // the real creatures (their own health and moves) take a while to die: up to 8 s
  let k1 = k0;
  for (let i = 0; i < 16 && k1 <= k0; i++) { await page.waitForTimeout(500); k1 = Number(await page.$eval('.titlecvs', c => c.dataset.kills || '0')); }
  check('the action scene runs (creatures die)', k1 > k0, [k0, k1]);

  // the camera (v0.0.168), by real touches: two fingers spread zoom in, one drags, a tap on a player follows them,
  // again lets go; it never shows past the screen's box
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const cam = () => page.evaluate(() => { const { C, S } = window.__title; return { z: C.z, x: C.x, y: C.y, lock: C.lock, ay: C.ay, by: C.by }; });
  const boxed = c => c.x - 110 / c.z > -0.01 && c.x + 110 / c.z < 220.01 && c.y - c.ay / c.z > -0.01 && c.y + (c.by - c.ay) / c.z < c.by + 0.01;
  await touch('touchStart', [[180, 350], [230, 350]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[180 - i * 5, 350], [230 + i * 5, 350]]);
  await touch('touchEnd', []);
  const c1 = await cam();
  check('a pinch zooms in, the view inside the box', c1.z > 2 && c1.z < 3.2 && boxed(c1), c1);
  await touch('touchStart', [[20, 380]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[20 + i * 45, 380 - i * 20]]);
  await touch('touchEnd', []);
  const c2 = await cam();
  check('a drag pans, and stops at the box\'s edge', c2.x < c1.x && Math.abs(c2.x - 110 / c2.z) < 0.01 && boxed(c2), c2);
  // back to the whole screen, then tap a player where they are on screen (one over the menu)
  const who = await page.evaluate(() => {
    const { C, S } = window.__title, top = document.querySelector('.titlemenu').getBoundingClientRect().top;
    Object.assign(C, { z: 1, x: 110, y: C.ay });
    return S.runners.findIndex(r => r.x > 4 && r.x < 200 && (r.y + 22) * 412 / 220 < top - 6);
  });
  const tapAt = () => page.evaluate(i => {
    const { C, S } = window.__title, r = S.runners[i], k = 412 / 220;
    return [((r.x + 6 - C.x) * C.z + 110) * k, ((r.y + 11 - C.y) * C.z + C.ay) * k];
  }, who);
  let p = await tapAt();
  await touch('touchStart', [p]); await touch('touchEnd', []);
  await page.waitForTimeout(1500);
  const c3 = await cam();
  check('a tap on a player follows them, zoomed in', who >= 0 && c3.lock === who && c3.z > 1.8 && boxed(c3), { who, c3 });
  p = await tapAt();
  await touch('touchStart', [p]); await touch('touchEnd', []);
  await page.waitForTimeout(100);
  check('a tap on them again lets go', (await cam()).lock === -1);

  // the title's sound (v0.0.174): the touches unlocked it; the scene's sounds play, none break, the loops run
  let snd = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    snd = await page.evaluate(() => ({ ready: SFX.ready, played: SFX.stats.played, errors: SFX.stats.errors.slice(), loops: SFX.loops, amb: SFX.ambience, music: Music.playing, mstep: Music.step }));
    if (snd.ready && snd.played > 5) break;
  }
  check('the title plays its sounds (the scene\'s, the game\'s voices)', snd.ready && snd.played > 5 && !snd.errors.length, snd);
  check('the jetpacks and the cave\'s ambience run', snd.loops >= 4 && snd.amb === 'Mossy caves', snd);
  check('the title track plays', snd.music && snd.mstep > 0, snd);

  // the buttons (v0.0.174): ▶ and ⚙ square, ⚙ left, ▶ right; ⚙ turns the window into the settings
  const bx = await page.evaluate(() => ['.tgear', '.tstart'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.width, r.height]; }));
  check('▶ and ⚙ are square, ⚙ left of ▶', Math.abs(bx[0][1] - bx[0][2]) < 0.5 && Math.abs(bx[1][1] - bx[1][2]) < 0.5 && bx[0][0] < bx[1][0], bx);
  await down('.tgear');
  await page.waitForTimeout(80);
  check('⚙ opens the settings: three sliders, no ▶', (await page.$$('.titlemenu .tvol')).length === 3 && !(await page.$('.tstart')));
  await page.evaluate(() => {
    const el = document.querySelector('.tvol[data-vol="fx"] input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '30');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(50);
  check('the FX slider sets and keeps its volume', await page.evaluate(() => Math.abs(SFX.fxVolume - 0.3) < 1e-9) && (await ls('caverunner-vol-fx')) === '0.3');
  await down('.tclose');
  await page.waitForTimeout(80);
  check('× goes back to ▶ and ⚙', !!(await page.$('.title .tstart')) && !(await page.$('.tvol')));
  await page.evaluate(() => localStorage.removeItem('caverunner-vol-fx'));

  // ▶ opens CaveRunner Auto (a new run, saved at once)
  await down('.tstart');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('▶ opens the auto screen, not the old game', on && !(await page.$('.title')) && await page.evaluate(() => !window.__lvl));
  check('a new run is made and saved', await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('caverunner-auto-run') || 'null'); return !!v && v.run.players.length === 1; }));

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
