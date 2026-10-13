// CaveRunner Auto (v1.0.79): the gun panel's firing window keeps its DPS graph when the gun changes (the scene is
// rebuilt each change; the graph carries over, a mark where it changed), so a change's effect can be compared.
// A gun of Spark Bolt ×2 fires a while; a bolt is dragged off it into the bag (real mouse); the graph is still there,
// longer, with one mark.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const run = newRun();
    const g = scratchPistol();
    g.cap = 4; g.slots = ['bolt', 'bolt', null, null];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 60 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('the auto screen is up', on);
  await page.waitForTimeout(1500);
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(340);
  }
  const graph = () => page.evaluate(() => { const S = window.__pvScene, pv = S && S.hub && S.hub.pv; return pv ? { n: pv.graph.length, marks: pv.gmark.filter(Boolean).length, slots: S.team[0].guns[S.team[0].active].slots.filter(Boolean).length } : null; });
  await page.waitForTimeout(2000);
  const a = await graph();
  check('the graph fills while it fires', a && a.n > 10 && a.marks === 0, a);
  const from = await page.locator('.anav [data-nslot="1"]').first().boundingBox();
  const empty = await page.evaluate(() => { const r = loadAutoRun(); return r.bag.findIndex(b => !b); });
  const to = await page.locator('.abag [data-slot="' + empty + '"]').boundingBox();
  check('found a bolt and an empty bag slot', !!from && !!to);
  if (from && to) {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(800);
  const b = await graph();
  check('the gun changed (one bolt left)', b && b.slots === 1, b);
  check('the graph kept its history over the change', b && a && b.n > a.n, { a, b });
  check('the change is marked once', b && b.marks === 1, b);
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
