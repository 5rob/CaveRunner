// Frames of a pack of aliens moving (darkness off so they show), 0.15 s apart, cut round you and laid side
// by side in one picture, for the owner: one still can't show the legs walking.
//   node tools/alienframes.js [outdir]   (default tests/build/alienframes; frames.png, then flee.png after a fire)
const fs = require('fs');
const path = require('path');
const { launch } = require('../tests/chromium');
require('./build')();
require('../tests/build')();

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'alienframes'));
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; window.__in.current.newCave = 2; });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  // stand in the first zone's chamber, pinned; the fire (window.__fire) is a blast renewed every frame
  await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, c = W.dark[0].chamber;
    W.seen.fill(2); W.fog.paint();
    let y = c.y;
    while (y < c.floor + 3 && !W.mat[(y + 1) * CW + c.x]) y++;
    window.__pin = { x: c.x * CELL - 6, y: (y + 1) * CELL - 22.5 };
    const loop = () => {
      const p = window.__pin;
      W.p.x = p.x; W.p.y = p.y; W.p.vx = W.p.vy = 0; W.p.hp = 9999; W.enemyShots.length = 0;
      if (window.__fire) W.flashes.push({ x: window.__fire.x, y: window.__fire.y, r: 3, t: 0 });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // gather a pack round you so the shots have one in view
    const a = W.enemies.filter(e => e.k.act === 'alien' && !e.al.black);
    a.slice(0, 40).forEach((e, i) => { e.x = window.__pin.x + 6 + Math.cos(i) * (30 + i * 2); e.y = window.__pin.y + 10 - Math.abs(Math.sin(i)) * 25; });
  });
  await page.evaluate(() => { window.DEV.l2dDark = 0; window.DEV.zoom = 2.6; });
  await page.waitForTimeout(4000);
  // a run of frames, each the middle of the screen, then one picture of them in a row
  const strip = async (name, n, gap) => {
    const shots = [];
    for (let k = 0; k < n; k++) { shots.push((await page.screenshot({ clip: { x: 56, y: 250, width: 300, height: 300 } })).toString('base64')); await page.waitForTimeout(gap); }
    const url = await page.evaluate(async list => {
      const imgs = await Promise.all(list.map(b => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b; })));
      const w = imgs[0].width, h = imgs[0].height, c = document.createElement('canvas'); c.width = w * 2 + 8; c.height = Math.ceil(imgs.length / 2) * (h + 8);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, k) => x.drawImage(im, (k % 2) * (w + 8), Math.floor(k / 2) * (h + 8)));
      return c.toDataURL('image/png');
    }, shots);
    const to = path.join(OUT, name); fs.writeFileSync(to, Buffer.from(url.split(',')[1], 'base64')); console.log(to);
  };
  await strip('frames.png', 6, 150);
  await page.evaluate(() => { const p = window.__pin; window.__fire = { x: p.x + 40, y: p.y + 10 }; });
  await strip('flee.png', 4, 250);
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
