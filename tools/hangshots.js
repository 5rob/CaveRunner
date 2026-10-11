// Screenshots for the owner (CaveRunner Auto: hanging on vines and web lines, auto/hang.js): phone size (412 x 880 @2.625),
// a fresh run in level 1, player 1 picked and steered by hand; a vine and a web line placed at him in the air.
//   h-a-vine.png    hanging on a vine (the stick let go: he holds on), + h-a-zoom.png
//   h-b-swing.png   swinging on it after a shove, the vine through his hands, + h-b-zoom.png
//   h-c-web.png     hanging on a web line, + h-c-zoom.png
//   node tools/hangshots.js [outdir]      (default tests/build/hang)
// Not a test: it takes the pictures and prints what they show.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'hang'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 1; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.assign(DEV, { autoWallMin: 60, autoWallMax: 60, autoFoeDmg: 0 }); saveAutoRun(newRun(9)); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  const zoom = async name => {
    const box = await page.evaluate(() => {
      const S = window.__autoScene, r = S.runners[0], C = window.__autoCam.current, cv = document.querySelector('.aplaycvs').getBoundingClientRect();
      const v = camTo(C, r.x + PW / 2, r.y + PH / 2), k = cv.width / TITLE_VW;
      return { x: cv.left + v.x * k - 45, y: cv.top + v.y * k - 50, width: 90, height: 90 };
    });
    const png = await page.screenshot({ clip: box });
    await page.evaluate(async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.id = 'zoomshot'; c.width = 360; c.height = 360;
      Object.assign(c.style, { position: 'fixed', left: '26px', top: '200px', width: '360px', height: '360px', zIndex: 99999, border: '2px solid #fff' });
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, 360, 360); document.body.appendChild(c);
    }, png.toString('base64'));
    await page.locator('#zoomshot').screenshot({ path: path.join(OUT, name) });
    await page.evaluate(() => document.getElementById('zoomshot').remove());
  };
  const st = () => page.evaluate(() => { const S = window.__autoScene, r = S.runners[0]; return { hang: r.hang ? (r.hang.st || 'web') : null, swing: r.swing, x: r.x + S.scroll, y: r.y }; });
  // pick player 1 (his helmet held: manual mode), as roamshots.js
  const holdMs = await page.evaluate(() => DEV.autoHoldMs);
  await page.locator('.anav [data-player="0"]').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(holdMs + 200);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  // a vine at him, up in the air where there's room; the pill stick pushed down a little (no jet): he grabs, then let go
  await page.evaluate(() => {
    const S = window.__autoScene, r = S.runners[0];
    S.foes.length = 0; S.spawn = 1e9;
    let up = 0;
    while (up < 60 && !titleSolid(S, r.x + PW / 2, r.y - up - 4)) up += 2;
    r.y -= Math.max(0, up - 8); r.vy = 0; r.ground = false;
    S.props.push({ k: 'climb', st: 'vine', ox: r.x + PW / 2 + S.scroll, x: 0, y: r.y - 30, len: 80, seed: 0.4, side: 1, burn: 0, ac: 0, ar: 0 });
  });
  const flick = async (dx, dy) => { await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + dx, py + dy, { steps: 2 }); await page.waitForTimeout(120); await page.mouse.up(); };
  await flick(0, 18);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'h-a-vine.png') }); await zoom('h-a-zoom.png');
  console.log('h-a-vine.png   hanging on a vine', JSON.stringify(await st()));
  await page.evaluate(() => { window.__autoScene.runners[0].cvx = 90; });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'h-b-swing.png') }); await zoom('h-b-zoom.png');
  console.log('h-b-swing.png  swinging', JSON.stringify(await st()));
  // a web line at his hands, off the vine
  await page.evaluate(() => {
    const S = window.__autoScene, r = S.runners[0];
    S.props = S.props.filter(p => p.st !== 'vine' || p.len !== 80);
    r.hang = null;
    const cx = r.x + PW / 2 + S.scroll, ly = r.y + 3;
    S.webs.push({ ax: cx - 50, ay: ly - 12, bx: cx + 50, by: ly + 12, a0x: cx - 50, a0y: ly - 12, b0x: cx + 50, b0y: ly + 12, ain: { x: cx - 50, y: ly - 12 }, bin: { x: cx + 50, y: ly + 12 }, owner: null, sag: 0 });
  });
  await flick(18, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'h-c-web.png') }); await zoom('h-c-zoom.png');
  console.log('h-c-web.png    hanging on a web line', JSON.stringify(await st()));
  await browser.close();
})();
