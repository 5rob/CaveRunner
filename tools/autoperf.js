// CaveRunner Auto's frame time on a "mid phone" (AUTOBATTLER.md stage 14): the phone-size page (412 x 880 @2.625), a level
// (seed 7, 2 players), Chromium's CPU slowed ×4 (CDP Emulation.setCPUThrottlingRate). After the arrival, the
// requestAnimationFrame gaps over a few seconds: mean, p95, worst, and the share over 1/60 s and 1/30 s. Also ×1 for comparison.
//   node tools/autoperf.js [seconds=5] [rate=4]
// Not a test: it prints numbers.
const { launch } = require('../tests/chromium');
const path = require('path');
require('./build')();
require('../tests/build')();

const SECS = +(process.argv[2] || 5), RATE = +(process.argv[3] || 4);

(async () => {
  const browser = await launch();
  for (const rate of [1, RATE]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__AUTO_LEVEL = 7; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'green', n: 1 }); addPlayer(run); saveAutoRun(run); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__autoScene && levelState(window.__autoScene).phase === 'run')); i++) await page.waitForTimeout(100);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(1000);   // settle
    const d = await page.evaluate(ms => new Promise(res => {
      const out = []; let last = performance.now();
      const t0 = last;
      const f = () => { const n = performance.now(); out.push(n - last); last = n; if (n - t0 < ms) requestAnimationFrame(f); else res(out); };
      requestAnimationFrame(f);
    }), SECS * 1000);
    const st = await page.evaluate(() => { const S = window.__autoScene, L = levelState(S); return { phase: L.phase, foes: S.foes.length, parts: S.parts.length }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const s = d.slice().sort((a, b) => a - b), mean = d.reduce((a, b) => a + b, 0) / d.length;
    const p95 = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
    const over = ms => (100 * d.filter(x => x > ms).length / d.length).toFixed(0) + '%';
    console.log(`CPU ×${rate}: ${d.length} frames in ${SECS} s · mean ${mean.toFixed(1)} ms (${(1000 / mean).toFixed(0)} fps) · p95 ${p95.toFixed(1)} ms · worst ${s[s.length - 1].toFixed(1)} ms · over 16.7 ms ${over(17.5)} · over 33 ms ${over(34)}  (at the end: ${st.phase}, ${st.foes} foes, ${st.parts} particles)`);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
