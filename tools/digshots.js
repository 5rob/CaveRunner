// Screenshots for the owner (v0.0.166), phone size (412 x 880 @2.625), the real page through the test page:
// the title's players sawing through rock with the Buzzsaw, a burning creature on the title in the fire's
// crackle, and in the game a burning creature and a burning vine in the same crackle.
//   node tools/digshots.js [outdir]      (default tests/build/digshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'digshots'));
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
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, 'a-title.png') });
  said.push('a-title.png  the title as it runs (6 s in)');
  const shot = mode => page.evaluate(({ mode }) => {
    const S = titleScene(470, 7, 139, 295), dpr = 2.625, cw = 412, k = cw / TITLE_VW;
    const step = n => { for (let i = 0; i < n; i++) titleStep(S, 1 / 60); };
    let box = { x: 0, y: (S.top - 50) * k, w: cw, h: (S.bot - S.top + 70) * k }, z = 1;
    if (mode === 'saw') {
      let r = null;
      for (let i = 0; i < 60 * 60 && !r; i++) { step(1); r = S.runners.find(q => q.dig > 0.6 && q.x > 20) || null; }
      if (r) { box = { x: (r.x - 40) * k, y: (r.y - 30) * k, w: 100 * k, h: 80 * k }; z = 2; }
    } else if (mode === 'later') {
      step(60 * 25);
    } else {
      step(60 * 3);
      let f = null;
      for (let i = 0; i < 60 * 20 && !f; i++) { step(1); f = S.foes.find(e => e.burn > 0 && e.x - S.scroll > 30 && e.x - S.scroll < 190) || null; }
      // one well away from the players, who hold still for the picture (sturdy, so it lives to be seen)
      S.still = true; S.shots.length = 0;
      const far = e => S.runners.every(q => Math.hypot(q.x + 6 - (e.x - S.scroll), q.y + 11 - e.ty) > 45);
      for (let i = 0; i < 60 * 20 && !(f && far(f)); i++) { step(1); f = S.foes.find(e => e.x - S.scroll > 40 && e.x - S.scroll < 200 && e.k.id !== 'rotta' && far(e)) || null; }
      if (f) { f.hp = f.hpMax = 999; f.burn = 6; f.aggro = false; step(20); }
      for (let i = 0; i < 120 && f && (f.flash > 0 || f.hp <= 0); i++) step(1);   // not mid hit-flash
      if (f) { box = { x: (f.x - S.scroll - 30) * k, y: (f.ty - 35) * k, w: 60 * k, h: 60 * k }; z = 2; }
    }
    const c = document.createElement('canvas'); c.width = cw * dpr; c.height = 880 * dpr;
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); titleDraw(x, S, cw, 880);
    const o = document.createElement('canvas');
    o.width = box.w * dpr * z; o.height = box.h * dpr * z;
    const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false;
    ox.drawImage(c, box.x * dpr, box.y * dpr, box.w * dpr, box.h * dpr, 0, 0, o.width, o.height);
    return o.toDataURL();
  }, { mode });
  save('b-title-saw', await shot('saw'), 'a player sawing through rock (2x): the Buzzsaw gun, its blade spinning off the barrel, the tunnel behind');
  save('c-title-later', await shot('later'), '25 s in: the tunnels the players have sawn');
  save('d-title-burning', await shot('burn'), 'a burning creature on the title (2x): the fire\'s crackle over it, no longer solid white');
  await page.context().close();

  // ---- the game: a burning creature and a burning vine in a sandbox ----
  page = await newPage(false);
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p && window.__lvl.enemies.length)); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const L = window.__lvl;
    const vine = L.props.find(q => q.k === 'climb' && q.st === 'vine' && !q.arc);
    const proto = vine ? JSON.parse(JSON.stringify(vine)) : null;
    const e0 = L.enemies.find(e => e.k.body === 'jelly') || L.enemies[0];
    const ek = Object.assign({}, e0.k, { kp: null, act: 'turret', spd: 0, range: 0 });
    const room = L.sandbox({ w: 360 });
    L.p.x = room.x - 50; L.p.y = room.y - 22;
    if (proto) {
      const pr = L.placeProp(proto, room.x + 30, room.y - 90);
      pr.anc = [Math.floor((room.x + 30) / L.world.CELL), Math.floor(room.y / L.world.CELL) + 1];
      pr.len = 45; pr.b = 45;
      window.__pr = pr;
    }
    const e = { k: ek, x: room.x - 10, y: room.y - 30, ty: room.y - 30, r: e0.r, hp: 999, hpMax: 999, cd: 9, touch: 9, flash: 0, phase: 0, lx: 0, ly: 1, hx: room.x - 10, hy: room.y - 30, burn: 0 };
    L.enemies.push(e);
    await new Promise(r => setTimeout(r, 200));
    e.burn = 30;
    if (window.__pr) { window.__pr.len = 90; window.__pr.b = 90; L.ignite(room.x + 30, room.y - 4, 3, 1); }
    await new Promise(r => setTimeout(r, 3500));
    e.burn = 30; e.flash = 0;
    await new Promise(r => setTimeout(r, 300));
  });
  await page.screenshot({ path: path.join(OUT, 'e-game-burning.png'), clip: { x: 110, y: 200, width: 280, height: 240 } });
  said.push('e-game-burning.png  in the game: a burning creature and a burning vine, both in the burning pixels\' crackle');
  await page.context().close();
  await browser.close();
  console.log(said.join('\n'));
})();
