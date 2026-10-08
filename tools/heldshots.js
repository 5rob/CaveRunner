// Screenshots for the owner (v0.0.164), phone size (412 x 880 @2.625), the real game through the test page:
// the gun in hand in the body's pixel look (game, the Bag's firing window, the title), a creature in front
// of a vending machine, and fire jumping between web lines and vines on the title.
//   node tools/heldshots.js [outdir]      (default tests/build/heldshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'heldshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const newPage = async title => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    if (title) await ctx.addInitScript(() => { window.__TEST_TITLE = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    return page;
  };
  const save = (n, url, what) => { fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(url.split(',')[1], 'base64')); said.push(`${n}.png  ${what}`); };

  // ---- the title ----
  let page = await newPage(true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'a-title.png') });
  said.push('a-title.png  the title as it runs');
  // the title scene drawn by hand, so it can be stopped where wanted and cropped up big
  const titleCrop = (n, mode) => page.evaluate(({ mode }) => {
    const S = titleScene(470, 7, 139, 295), dpr = 2.625, cw = 412, k = cw / TITLE_VW;
    const quiet = m => { for (let i = 0; i < m; i++) { S.foes.length = 0; S.spawn = 99; S.runner.cd = 9; titleStep(S, 1 / 60); } };
    let box;
    if (mode === 'gun') {
      for (let i = 0; i < 60 * 3; i++) titleStep(S, 1 / 60);
      for (let i = 0; i < 600 && !(S.runner.mode === 'run' && S.foes.some(f => f.x - S.scroll < 180)); i++) titleStep(S, 1 / 60);
      const r = S.runner;
      box = { x: (r.x - 30) * k, y: (r.y - 22) * k, w: 80 * k, h: 60 * k };
    } else {
      // into the webs zone, a line burning and a vine burning beside others
      for (let i = 0; i < 60 * 12 && !(S.webs.filter(L => L.a0x - S.scroll > 40 && L.a0x - S.scroll < 200).length >= 4); i++) quiet(1);
      // light a line that nearly touches another line or a vine, at the far end from where they meet
      const ws = S.webs.filter(L => L.a0x - S.scroll > 40 && L.a0x - S.scroll < 200);
      const pts = L => Array.from({ length: 17 }, (_, i) => titleWebAt(L, i / 16));
      const vpts = p => (p.arc ? [] : Array.from({ length: 9 }, (_, i) => ({ x: p.ox, y: p.y + p.len * i / 8 })));
      let pick = null;
      for (const L of ws) {
        const others = S.webs.filter(o => o !== L).map(pts).concat(S.props.filter(p => p.k === 'climb').map(vpts));
        const k = pts(L).findIndex(a => others.some(o => o.some(b => Math.hypot(a.x - b.x, a.y - b.y) < TITLE_JUMP)));
        if (k >= 0) { pick = { L, u: k / 16 < 0.5 ? 0.9 : 0.1 }; break; }
      }
      if (pick) pick.L.fu = [pick.u, pick.u]; else if (ws[0]) ws[0].fu = [0.5, 0.5];
      // web1: just lit; web2: once the fire has jumped to something else (or 4 s)
      const b0 = S.burnt;
      if (mode === 'web1') quiet(12);
      else for (let i = 0; i < 240 && S.burnt < b0 + 1; i++) quiet(1);
      if (mode !== 'web1') quiet(15);
      box = { x: 20 * k, y: (S.top - 45) * k, w: 190 * k, h: (S.bot - S.top + 50) * k };
    }
    const c = document.createElement('canvas'); c.width = cw * dpr; c.height = 880 * dpr;
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); titleDraw(x, S, cw, 880);
    const z = mode === 'gun' ? 2 : 1, o = document.createElement('canvas');
    o.width = box.w * dpr * z; o.height = box.h * dpr * z;
    const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false;
    ox.drawImage(c, box.x * dpr, box.y * dpr, box.w * dpr, box.h * dpr, 0, 0, o.width, o.height);
    return o.toDataURL();
  }, { mode });
  save('b-title-gun', await titleCrop('b', 'gun'), 'the title runner close up (2x): his gun now in the same chunky pixel look and dark outline as his body');
  save('c-title-web-fire', await titleCrop('c', 'web1'), 'the title\'s webs: one line just lit, burning out both ways (it used to vanish at once)');
  save('d-title-web-fire-later', await titleCrop('d', 'web2'), 'the same, ~3/4 s on: the fire has jumped to the lines and vines it nearly touched');
  await page.context().close();

  // ---- the game ----
  page = await newPage(false);
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(800);
  // a crop of the game's canvas (no HUD over it), world box (x, y, w, h), scaled up z crisp
  const canvasCrop = (x, y, w, h, z) => page.evaluate(({ x, y, w, h, z }) => {
    const L = window.__lvl, c = document.querySelector('canvas'), s = c.width / L.viewW;
    const o = document.createElement('canvas'); o.width = w * s * z; o.height = h * s * z;
    const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false;
    ox.drawImage(c, (x - L.camX) * s, (y - L.camY) * s, w * s, h * s, 0, 0, o.width, o.height);
    return o.toDataURL();
  }, { x, y, w, h, z });
  // a creature at the buy machine, you a little way off
  await page.evaluate(() => {
    const L = window.__lvl; L.guide = null; DEV.zoom = 1;
    const e = L.enemies[0];
    const k = Object.assign({}, e.k, { kp: null, act: 'turret', spd: 0, range: 0 });
    L.enemies.push({ k, r: e.r, cd: 99, touch: 99, flash: 0, phase: 0, x: VEND_BUY_X, y: VEND_TOP + 40, ty: VEND_TOP + 40, hp: 999, hpMax: 999, lx: 0, ly: 1 });
    L.p.x = VEND_BUY_X - 70; L.p.vx = 0; L.p.hp = 9999;
  });
  await page.waitForTimeout(900);
  const V = await page.evaluate(() => ({ x: VEND_BUY_X, y: VEND_TOP }));
  save('e-vend', await canvasCrop(V.x - 100, V.y - 20, 170, 110, 3), 'a creature in front of the buy machine: drawn over it now (it was behind)');
  const P = await page.evaluate(() => ({ x: window.__lvl.p.x, y: window.__lvl.p.y }));
  save('f-game-gun', await canvasCrop(P.x - 24, P.y - 16, 60, 44, 5), 'you in the game with your gun (close up): the gun in the body\'s pixel look');
  await page.click('.weapon');
  await page.waitForTimeout(700);
  const gf = await page.evaluate(() => { const r = document.querySelector('.btop .gfire').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await page.screenshot({ path: path.join(OUT, 'g-bag-window.png'), clip: gf });
  said.push('g-bag-window.png  the Bag\'s firing window: you and the gun, the same look');
  await browser.close();
  console.log('Shots in ' + OUT + ':\n' + said.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
