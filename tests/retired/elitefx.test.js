// The elites' flames (v0.0.137), in a sandbox: an elite gives off fire particles that rise off it,
// a moving one leaves a trail, rate 0 turns them off; and Dev → Elites: flames has its preview,
// gradient bar (a tap adds a stop) and opacity ramp (a tap adds a point). Screenshots for the
// owner: elitefx_game.png (an elite on fire, close up), elitefx_dev.png (the editors),
// crystals.png (crystals shedding sparkles).
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1500);

  const st = await page.evaluate(async () => {
    const L = window.__lvl;
    for (const k of Object.keys(DEV_DEFAULTS)) if (k.startsWith('elFx')) DEV[k] = DEV_DEFAULTS[k];
    const room = L.sandbox({ w: 500, h: 300 });
    DEV.zoom = 3.2;
    const proto = makeLevel(5, 1).enemies.find(e => !e.nest && e.k.act !== 'rat') || makeLevel(5, 1).enemies[0];
    const e = Object.assign({}, proto, { x: room.x + 30, y: room.y - 50, ty: room.y - 50, hp: 999, hpMax: 999, tgt: null, aggro: false });
    e.k = eliteOf(Object.assign({}, proto.k, { act: 'turret', range: 0, dmg: 0 }), 0.5);
    L.enemies.push(e);
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame); };
    L.eliteFx.length = 0;
    await frames(40);
    const out = { n: L.eliteFx.length };
    out.above = Math.round(e.ty - L.eliteFx.reduce((s, q) => s + q.y, 0) / Math.max(1, L.eliteFx.length));   // how far above its middle they sit, on average
    // move it sideways fast: the specks it leaves keep some of its speed, then fall behind
    for (let i = 0; i < 20; i++) { e.x += 6; e.fxPx = e.fxPx; await frames(1); }
    out.behind = L.eliteFx.filter(q => q.x < e.x - e.r - 10).length;
    // off
    DEV.elFxRateLo = DEV.elFxRateHi = 0;
    await frames(60);
    out.off = L.eliteFx.length;
    DEV.elFxRateLo = DEV_DEFAULTS.elFxRateLo; DEV.elFxRateHi = DEV_DEFAULTS.elFxRateHi;
    e.x = room.x + 30;
    await frames(50);
    return out;
  });
  check('an elite gives off flames', st.n > 10, st);
  check('they rise off it', st.above >= 4, st);
  check('a moving elite leaves a trail', st.behind > 5, st);
  check('rate 0 turns them off', st.off === 0, st);
  await page.screenshot({ path: path.join(DIR, 'elitefx_game.png') });

  // crystals shedding sparkles (a red and a green, just out of reach)
  const cr = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 500, h: 300 });
    L.enemies.length = 0; L.eliteFx.length = 0; L.motes.length = 0;
    L.pickups.push({ kind: 'crystal', x: room.x - 48, y: room.y - 10, floor: 1, t: 0 },
      { kind: 'crystal', green: true, x: room.x + 48, y: room.y - 10, floor: 1, t: 1 });
    for (let i = 0; i < 90; i++) await new Promise(requestAnimationFrame);
    return { motes: L.motes.filter(q => q.kind === 'breeze').length };
  });
  check('a crystal sheds sparkles on the breeze', cr.motes > 5, cr);
  await page.screenshot({ path: path.join(DIR, 'crystals.png') });

  // the Dev panel's flame editors
  await page.evaluate(() => { localStorage.setItem('caverunner-devgroups', JSON.stringify({ elitefx: true })); window.__lvl.p.vx = 0; });
  await page.tap('.devbtn');
  await page.waitForTimeout(400);
  const ui = await page.evaluate(() => ({ prev: !!document.querySelector('.flameprev'), grad: !!document.querySelector('.gradedit svg'),
    ramp: !!document.querySelector('.rampedit svg') }));
  check('Dev → Elites: flames has a preview, a gradient bar and a ramp', ui.prev && ui.grad && ui.ramp, ui);
  await page.evaluate(() => document.querySelector('.devghead[data-g="elitefx"]').scrollIntoView());
  const n0 = await page.evaluate(() => DEV.elFxGrad.split(' ').length);
  const bar = await page.evaluate(() => { const r = document.querySelector('.gradedit svg').getBoundingClientRect(); return { x: r.left + r.width * 0.62, y: r.top + r.height * 0.25 }; });
  await page.tap('.gradedit svg', { position: { x: bar.x - (await page.evaluate(() => document.querySelector('.gradedit svg').getBoundingClientRect().left)), y: 8 } });
  await page.waitForTimeout(150);
  const n1 = await page.evaluate(() => DEV.elFxGrad.split(' ').length);
  check('a tap on the gradient bar adds a stop', n1 === n0 + 1, { n0, n1 });
  const r0 = await page.evaluate(() => DEV.elFxAlpha.split(' ').length);
  await page.tap('.rampedit svg', { position: { x: 60, y: 30 } });
  await page.waitForTimeout(150);
  const r1 = await page.evaluate(() => DEV.elFxAlpha.split(' ').length);
  check('a tap on the ramp adds a point', r1 === r0 + 1, { r0, r1 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, 'elitefx_dev.png') });
  await page.evaluate(() => { devSet('elFxGrad', DEV_DEFAULTS.elFxGrad); devSet('elFxAlpha', DEV_DEFAULTS.elFxAlpha); localStorage.removeItem('caverunner-devgroups'); });

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
