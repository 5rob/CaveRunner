// Screenshots for the owner (CaveRunner Auto, vine fire: DEV.autoVineFire, autoVineSpread): in a real level, three vines 12 apart and a
// web line hung off a rock ledge placed in view, the middle vine lit at its tip; close-ups cut from the play canvas at moments after (a sheet, 2 x 2), plus the frame.
// Phone size (412 x 880 @2.625).   node tools/vinefireshots.js [outdir] [spread]   (default tests/build/vinefire)
//   v-frame.png   the play area just after lighting     v-sheet.png   at 0.15, 0.4, 0.7, 1.1 s
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'vinefire'));
const SPREAD = process.argv[3] ? +process.argv[3] : null;
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 11; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(sp => { Object.assign(DEV, { autoFoeDmg: 0, autoWallMin: 999, autoWallMax: 999, autoBlockN: 0 }); if (sp) DEV.autoVineSpread = sp; saveAutoRun(newRun(4)); }, SPREAD);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  // a vine of our own (the cave's may hang out of view): a rock ledge across the view's upper part, a 70-long vine off it, lit
  const v = await page.evaluate(() => {
    const S = window.__autoScene, C = window.__autoCam.current;
    S.pace = 0; S.foes.length = 0; S.spawn = 1e9;
    for (const r of S.runners) r.x = 20;
    const top = C.y - C.ay + 40, ox = 140, c0 = Math.floor((ox + S.scroll) / TCELL), r1 = Math.floor(top / TCELL);
    for (let dc = -14; dc <= 14; dc++) for (let r = r1 - 6; r <= r1; r++) S.cells[(((c0 + dc) % S.ncol + S.ncol) % S.ncol) * S.rows + r] = TM.ROCK;
    S.dirtyAll = true;
    const y = (r1 + 1) * TCELL, P = { k: 'climb', st: 'vine', ox: ox + S.scroll, x: 0, y, len: 70, seed: 0.4, side: 1, burn: 0, ac: c0, ar: r1 };
    S.props.push(P); window.__vine = P;
    for (const dx of [-12, 12]) S.props.push({ ...P, ox: P.ox + dx, len: 60 + dx, seed: 0.5 + dx / 100, ac: c0 + Math.round(dx / TCELL) });
    const wx = P.ox + 22, L = { ax: wx, ay: y, bx: wx + 26, by: y + 60, a0x: wx, a0y: y, b0x: wx + 26, b0y: y + 60, ain: { x: wx, y: y - 1 }, bin: { x: wx + 26, y: y + 61 }, owner: null, sag: 0 };
    S.webs.push(L);
    return { len: 70 };
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__vine.burn = 1; });
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'sheet';
    Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0b0910', zIndex: 99999, display: 'none', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '40px 8px', alignContent: 'start', font: '16px sans-serif', color: '#fff' });
    document.body.appendChild(d);
  });
  let t0 = Date.now();
  const grab = label => page.evaluate(([label, len]) => {
    const S = window.__autoScene, C = window.__autoCam.current, p = window.__vine, cv = document.querySelector('.aplaycvs'), k = cv.width / TITLE_VW;
    const B = Math.max(90, len + 30), v = camTo(C, p.ox - S.scroll + 8, p.y + len / 2);
    const c = document.createElement('canvas'); c.width = c.height = 190;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(cv, v.x * k - B / 2 * k, v.y * k - B / 2 * k, B * k, B * k, 0, 0, 190, 190);
    const w = document.createElement('div'); w.append(c, document.createTextNode(label));
    document.getElementById('sheet').appendChild(w);
  }, [label, v.len]);
  for (const ms of [150, 400, 700, 1100]) {
    while (Date.now() - t0 < ms) await page.waitForTimeout(10);
    await grab((ms / 1000).toFixed(2) + ' s');
    if (ms === 400) await page.screenshot({ path: path.join(OUT, 'v-frame.png') });
  }
  await page.evaluate(() => { document.getElementById('sheet').style.display = 'grid'; });
  await page.screenshot({ path: path.join(OUT, 'v-sheet.png') });
  console.log(`vine ${v.len.toFixed(0)} long; v-frame.png at 0.4 s, v-sheet.png 0.15/0.4/0.7/1.1 s`);
  await browser.close();
})();
