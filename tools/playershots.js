// Screenshots for the owner (v0.0.165), phone size (412 x 880 @2.625), the real title through the test page:
// four players in their colours with many more creatures and guns, the mine works' roof sloping down
// naturally, and vines / web lines cut by fire hanging from their ends with the crackling fire on them.
//   node tools/playershots.js [outdir]      (default tests/build/playershots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'playershots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  const save = (n, url, what) => { fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(url.split(',')[1], 'base64')); said.push(`${n}.png  ${what}`); };

  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'a-title.png') });
  said.push('a-title.png  the title as it runs (4 s in)');
  // the scene drawn by hand, stopped where wanted and cropped
  const shot = mode => page.evaluate(({ mode }) => {
    const S = titleScene(470, 7, 139, 295), dpr = 2.625, cw = 412, k = cw / TITLE_VW;
    const step = n => { for (let i = 0; i < n; i++) titleStep(S, 1 / 60); };
    const quiet = n => { for (let i = 0; i < n; i++) { S.foes.length = 0; S.spawn = 99; S.runners.forEach(q => { q.cd = 9; }); titleStep(S, 1 / 60); } };
    let box = { x: 0, y: (S.top - 50) * k, w: cw, h: (S.bot - S.top + 60) * k }, z = 1;
    if (mode === 'players') {
      step(60 * 6);
      for (let i = 0; i < 600 && !S.runners.every(r => r.mode === 'run'); i++) step(1);
      const xs = S.runners.map(r => r.x), ys = S.runners.map(r => r.y);
      box = { x: (Math.min(...xs) - 16) * k, y: (Math.min(...ys) - 20) * k, w: (Math.max(...xs) - Math.min(...xs) + 44) * k, h: (Math.max(...ys) - Math.min(...ys) + 46) * k };
      z = 2;
    } else if (mode === 'timber') {
      quiet(Math.round((TITLE_ZLEN * 2 - 110 - S.scroll) / 34 * 60));
    } else if (mode === 'arch' || mode === 'arch2') {
      for (let i = 0; i < 60 * 45 && !S.props.some(p => p.arc && p.x > 50 && p.x + p.span < 200); i++) quiet(1);
      const a = S.props.find(p => p.arc && p.x > 50 && p.x + p.span < 200);
      if (a) { a.burn = 1; a.u0 = a.u1 = 0.45; }
      quiet(mode === 'arch' ? 20 : 150);
    } else if (mode === 'web') {
      for (let i = 0; i < 60 * 20 && !S.webs.some(L => L.a0x - S.scroll > 60 && L.b0x - S.scroll < 190 && Math.abs(L.b0x - L.a0x) > 30 && Math.min(L.a0y, L.b0y) < S.top + 10); i++) quiet(1);
      const L = S.webs.find(L => L.a0x - S.scroll > 60 && L.b0x - S.scroll < 190 && Math.abs(L.b0x - L.a0x) > 30 && Math.min(L.a0y, L.b0y) < S.top + 10);
      if (L) L.fu = [0.5, 0.5];
      quiet(50);
    }
    const c = document.createElement('canvas'); c.width = cw * dpr; c.height = 880 * dpr;
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); titleDraw(x, S, cw, 880);
    const o = document.createElement('canvas');
    o.width = box.w * dpr * z; o.height = box.h * dpr * z;
    const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false;
    ox.drawImage(c, box.x * dpr, box.y * dpr, box.w * dpr, box.h * dpr, 0, 0, o.width, o.height);
    return o.toDataURL();
  }, { mode });
  save('b-players', await shot('players'), 'the four players close up (2x): blue, red, green, yellow on the backpack and a stripe over the helmet');
  save('c-mine-slope', await shot('timber'), 'into the mine works: the roof comes down over a long lumpy S-curve, not a straight step');
  save('d-arch-cut', await shot('arch'), 'an arched vine set alight: cut where it caught, both sides swinging down from their ends');
  save('e-arch-hanging', await shot('arch2'), '2.5 s on: the two halves hang from their ends, burning up from the cut with the crackling fire squares');
  save('f-web-cut', await shot('web'), 'a web line lit: its two halves of silk hang from the rock, burning');
  await ctx.close();
  await browser.close();
  console.log(said.join('\n'));
})();
