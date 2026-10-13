// Screenshots for the owner (after v1.0.76): an orb web cut apart (world/orbweb.js orbHeld, art/titlescene.js orbSettle):
// whole; two spokes cut (the spiral on them comes down, the rest holds); the hub cut (it all comes down, the spokes
// hanging from their rock).
//   node tools/cutshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 9; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { Object.assign(DEV, { autoFoeDmg: 0, autoLvlPace: 3, autoBlockN: 0 }); saveAutoRun(newRun()); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let x = 0;
  for (let i = 0; i < 300 && x < 250; i++) { await page.waitForTimeout(200); x = await page.evaluate(() => (window.__autoScene ? levelTeamX(window.__autoScene) : 0)); }
  // hold the scene still
  const id = await page.evaluate(() => {
    const S = window.__autoScene; S.still = true;
    Object.defineProperty(S, 'pace', { get: () => 0, set: () => {} });   // (the level's pilot sets it each frame)
    const r = S.runners[0], d = {};   // (the web whose hub is nearest player 1: the camera's on him)
    for (const L of S.webs) if (L.orb && !L.sp && !L.fr) d[L.orb] = Math.hypot(L.b0x - S.scroll - r.x - 70, L.b0y - r.y);   // (a little ahead of him: mid-screen)
    return +Object.keys(d).sort((a, b) => d[a] - d[b])[0];
  });
  const count = () => page.evaluate(id => { const W = window.__autoScene.webs.filter(L => L.orb === id); return W.filter(L => !L.sp && !L.fr).length + ' spokes, ' + W.filter(L => L.sp).length + ' spiral, ' + W.filter(L => L.fr).length + ' frame'; }, id);
  const save = async (n, what) => { what += ' [' + await count() + ']'; await page.screenshot({ path: path.join(OUT, 'cut-' + n + '.png'), clip: { x: 0, y: 0, width: 412, height: 480 } }); said.push(`cut-${n}.png  ${what}`); };
  // cut at a point (world), as a blast there does (titleClearWebs clears round a runner's gun: his middle + 6)
  const cut = (px, py, rad) => page.evaluate(([px, py, rad]) => {
    const S = window.__autoScene, r = S.runners[0], ox = r.x, oy = r.y;
    r.x = px - S.scroll - PW / 2 - 6; r.y = py - PH / 2;
    titleClearWebs(S, r, false, rad);
    r.x = ox; r.y = oy;
  }, [px, py, rad]);
  await page.waitForTimeout(300);
  await save('1-whole', 'the web whole (web ' + id + ')');
  // two spokes cut near their rock ends
  const sp = await page.evaluate(id => window.__autoScene.webs.filter(L => L.orb === id && !L.sp && !L.fr && L.ain).map(L => [L.a0x * 0.8 + L.b0x * 0.2, L.a0y * 0.8 + L.b0y * 0.2]), id);
  for (const [px, py] of sp.slice(0, 2)) await cut(px, py, 1.5);
  await page.waitForTimeout(500);
  await save('2-spokes', 'two spokes cut: their ends hang off the rock, the spiral strung on them comes down, the rest holds');
  const hub = await page.evaluate(id => { const L = window.__autoScene.webs.find(L => L.orb === id && !L.sp && !L.fr); return L ? [L.b0x, L.b0y] : null; }, id);
  if (hub) await cut(hub[0], hub[1], 3);
  await page.waitForTimeout(250);
  await save('3-hub', 'the hub cut: nothing holds the middle, so the whole web comes down, falling silk');
  await page.waitForTimeout(1200);
  await save('4-after', 'a moment later: only the spokes still on their rock are left, hanging');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
