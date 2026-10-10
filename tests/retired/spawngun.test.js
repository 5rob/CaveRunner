// Dev → Spawn gun: pauses, asks for a level, drops that level's kind of gun in front of
// you and unpauses. Also: the Trajectory Sight line fades in with the right stick's push.
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
  await page.evaluate(() => window.__lvl.sandbox());
  await page.waitForTimeout(200);

  await page.tap('.devbtn');
  await page.waitForTimeout(150);
  await page.tap('.dbg.spawngun');
  await page.waitForTimeout(150);
  let st = await page.evaluate(() => ({ popup: !!document.querySelector('.spawnpanel'),
    dev: !!document.querySelector('.devpanel:not(.spawnpanel)'), paused: window.__in.current.paused }));
  check('Spawn gun opens its popup and closes the Dev panel', st.popup && !st.dev, st);
  check('the popup pauses the game', st.paused === true, st);

  await page.fill('.spawnlvl', '8');
  const before = await page.evaluate(() => window.__lvl.pickups.filter(q => q.kind === 'gun').length);
  await page.tap('.spawngo');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => {
    const L = window.__lvl, p = L.p, guns = L.pickups.filter(q => q.kind === 'gun');
    const g = guns[guns.length - 1];
    return { popup: !!document.querySelector('.spawnpanel'), paused: window.__in.current.paused,
      guns: guns.length, dx: g ? Math.round(g.x - (p.x + 6)) : null, dy: g ? Math.round(g.y - p.y) : null };
  });
  check('Spawn closes the popup and unpauses', !st.popup && st.paused === false, st);
  check('a gun lands just in front of the player', st.guns === before + 1 && Math.abs(st.dx) < 40 && Math.abs(st.dy) < 30, st);

  // trajectory line visibility follows the right stick's push, full at the trigger ring
  const vis = mag => page.evaluate(m => {
    Object.assign(window.__in.current.right, { active: true, nx: 1, ny: 0, mag: m, on: false });
    return new Promise(r => setTimeout(() => r(window.__lvl.p.aim.vis), 80));
  }, mag);
  const v0 = await vis(0), vh = await vis(0.175), v1 = await vis(0.35), v2 = await vis(0.9);
  check('line hidden with the stick at centre', v0 === 0, v0);
  check('line half visible halfway to the trigger ring', Math.abs(vh - 0.5) < 0.02, vh);
  check('line full at and past the trigger ring', v1 === 1 && v2 === 1, { v1, v2 });
  await page.evaluate(() => { window.__in.current.right.active = false; });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
