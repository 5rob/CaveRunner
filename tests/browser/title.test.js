// The title screen and the pause menu (LIST4 #3, #4): the title shows (window.__TEST_TITLE), its
// action scene runs, 🗑️ then Delete? empties a slot, slot 2 + Start runs a game that saves to the
// '-2' key; ⏸ pauses, the volume slider sets SFX's volume and localStorage, Save writes the run, Exit
// saves and goes back to the title.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__TEST_TITLE = true;
    if (!sessionStorage.getItem('titletest')) {           // the first load only: slot 3 has a run, the rest are empty
      sessionStorage.setItem('titletest', '1');
      for (const k of ['caverunner-save', 'caverunner-save-2', 'caverunner-slot', 'caverunner-volume', 'caverunner-devshow']) localStorage.removeItem(k);
      localStorage.setItem('caverunner-save-3', JSON.stringify({ ver: 'old', floor: 5, hp: 40,
        loadout: { guns: [{ name: 'Pistol', slots: ['bolt'] }, null, null, null], sel: 0, bag: [], gold: 900 } }));
      localStorage.setItem('caverunner-collection-3', '["bolt"]');
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(600);
  const down = sel => page.locator(sel).first().dispatchEvent('pointerdown');
  const press = async sel => { await down(sel); await page.locator(sel).first().dispatchEvent('pointerup'); };   // ⏸ opens on release
  const ls = k => page.evaluate(k => localStorage.getItem(k), k);

  check('the title shows, three slots', (await page.$$('.title .tslot')).length === 3);
  check('no game behind it', await page.evaluate(() => !window.__lvl));
  const k0 = Number(await page.$eval('.titlecvs', c => c.dataset.kills || '0'));
  // the real creatures (their own health and moves) take a while to die: up to 8 s
  let k1 = k0;
  for (let i = 0; i < 16 && k1 <= k0; i++) { await page.waitForTimeout(500); k1 = Number(await page.$eval('.titlecvs', c => c.dataset.kills || '0')); }
  check('the action scene runs (creatures die)', k1 > k0, [k0, k1]);
  check('slot 3 shows its run', (await page.textContent('.tslot[data-slot="3"]')).includes('Floor 5'));
  check('slot 2 is empty', (await page.textContent('.tslot[data-slot="2"]')).includes('Empty'));

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

  // delete: one tap asks, the second empties it
  await down('.tdel[data-del="3"]');
  await page.waitForTimeout(80);
  check('🗑️ asks first', (await page.textContent('.tdel[data-del="3"]')) === 'Delete?' && !!(await ls('caverunner-save-3')));
  await down('.tdel[data-del="3"]');
  await page.waitForTimeout(80);
  check('Delete? empties the slot', !(await ls('caverunner-save-3')) && !(await ls('caverunner-collection-3'))
    && (await page.textContent('.tslot[data-slot="3"]')).includes('Empty'));

  // slot 2 + Start
  await down('.tslot[data-slot="2"]');
  await page.waitForTimeout(50);
  await down('.tstart');
  let up = false;
  for (let i = 0; i < 100 && !(up = await page.evaluate(() => !!(window.__lvl && window.__lvl.p))); i++) await page.waitForTimeout(50);
  check('Start runs the game', up && !(await page.$('.title')));
  check('slot 2 is the active slot', (await ls('caverunner-slot')) === '2');
  await page.evaluate(() => window.__in.current.saveRun());
  check("the run saves to slot 2's key", !!(await ls('caverunner-save-2')) && !(await ls('caverunner-save')));

  // dev mode: on by default on the test page; holding ⏸ 5 s hides the ⚙️ (and the cards' audit, the
  // Bag's 💾) and doesn't open the menu; again brings it back
  const devmode = async () => {
    await down('.pausebtn');
    await page.waitForTimeout(DEV_HOLD + 300);
    await page.locator('.pausebtn').first().dispatchEvent('pointerup');
    await page.waitForTimeout(100);
    return { gear: !!(await page.$('.devbtn')), menu: !!(await page.$('.pausecard')), ls: await ls('caverunner-devshow') };
  };
  const DEV_HOLD = await page.evaluate(() => DEV_HOLD_MS);
  check('the ⚙️ shows on the test page', !!(await page.$('.devbtn')));
  let dm = await devmode();
  check('holding ⏸ hides the ⚙️, no menu', !dm.gear && !dm.menu && dm.ls === '0', dm);
  check('dev mode off: devShown() is false', await page.evaluate(() => !devShown()));
  dm = await devmode();
  check('holding again brings it back', dm.gear && !dm.menu && dm.ls === '1', dm);

  // pause
  await press('.pausebtn');
  await page.waitForTimeout(100);
  check('⏸ opens the pause menu', !!(await page.$('.pausecard')));
  check('and pauses the game', await page.evaluate(() => window.__in.current.paused === true));
  await page.evaluate(() => {
    const el = document.querySelector('.volslider');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '40');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(50);
  check('the slider sets the volume', await page.evaluate(() => Math.abs(SFX.volume - 0.4) < 1e-9), await page.evaluate(() => SFX.volume));
  check('and keeps it', (await ls('caverunner-volume')) === '0.4');
  await page.evaluate(() => localStorage.removeItem('caverunner-save-2'));
  await down('.pbtn.save');
  await page.waitForTimeout(80);
  check('Save writes the run', !!(await ls('caverunner-save-2')) && (await page.textContent('.pbtn.save')).includes('Saved'));
  await down('.pbtn.resume');
  await page.waitForTimeout(80);
  check('Resume closes it', !(await page.$('.pausecard')) && await page.evaluate(() => window.__in.current.paused === false));

  // exit to the title
  await press('.pausebtn');
  await page.waitForTimeout(80);
  await Promise.all([page.waitForEvent('load', { timeout: 10000 }), down('.pbtn.exit')]);
  await page.waitForTimeout(500);
  check('Exit goes back to the title', !!(await page.$('.title')));
  check('slot 2 picked, with its run', !!(await page.$('.tslot.on[data-slot="2"]')) && !(await page.textContent('.tslot[data-slot="2"]')).includes('Empty'));
  check('the volume came back', await page.evaluate(() => Math.abs(SFX.volume - 0.4) < 1e-9));

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
