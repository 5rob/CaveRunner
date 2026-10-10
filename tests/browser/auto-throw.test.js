// CaveRunner Auto: paying the hub's machines with A (feedback round 2; stage 10a's throw from the bag tile is gone), real
// pointer events. Player 1 at the gun machine ("A to Pay": hubPayAt): a tap on A drops one gold out of his chest onto the
// floor in front of him and the machine takes it once it lands; held, a stream (several, out of the bag, all taken); a
// drag from where A was pressed aims them (dragged right and up: they leave right and up); at the mod machine A pays red;
// away from the machines A pays nothing. Stage 10b: a stream paying the gun machine in full (a gun into the bag, the change
// kept), a partial payment surviving a reload.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const start = async page => {
    await page.locator('.tstart').dispatchEvent('pointerdown');
    for (let i = 0; i < 60 && !(await page.$('.auto')); i++) await page.waitForTimeout(50);
    await page.waitForTimeout(2200);   // the player through the pad
  };
  const open = async (gold, red) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; if (!sessionStorage.getItem('fresh')) { localStorage.removeItem('caverunner-auto-run'); sessionStorage.setItem('fresh', '1'); } });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(300);
    await page.evaluate(([g, r]) => {
      const run = newRun();
      if (g) bagAdd(run, { kind: 'gold', n: g });
      if (r) bagAdd(run, { kind: 'red', n: r });
      saveAutoRun(run);
    }, [gold, red]);
    await start(page);
    return { ctx, page };
  };
  // player 1 put at a machine (or anywhere: x), standing still; what A would pay there
  const stand = async (page, id, x) => page.evaluate(([m, wx]) => {
    const S = window.__title.S, L = S.runners[0];
    L.x = (m ? hubStopX(m) : wx) - PW / 2; L.vx = 0;
    return hubPayAt(S);
  }, [id, x]);
  const btnA = async page => { const b = await page.locator('.abtn.aa').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const state = page => page.evaluate(() => {
    const H = hubState(window.__title.S), run = loadAutoRun();
    return { paid: H.paid.gun || 0, all: H.paid, back: H.back.length, out: H.thrown.length, gold: bagCount(run, 'gold'), red: bagCount(run, 'red') };
  });
  const until = async (page, fn, ms) => { let s; for (let i = 0; i < ms / 100; i++) { s = await state(page); if (fn(s)) return s; await page.waitForTimeout(100); } return s; };

  // a tap: one nugget, out of his chest, lands, taken
  {
    const { ctx, page } = await open(30, 0);
    check('at the gun machine: A pays it ("A to Pay")', await stand(page, 'gun') === 'gun');
    const a = await btnA(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    const s1 = await state(page);
    check('tap: one gold out of the bag (saved), out in the room', s1.gold === 29 && s1.out === 1, s1);
    const g = await page.evaluate(() => { const S = window.__title.S, t = hubState(S).thrown[0], L = S.runners[0]; return t ? { dy: t.y - L.y, landed: !!t.landed } : null; });
    check('… from his chest, not landed yet', !!g && g.dy > 0 && g.dy < 20 && !g.landed, g);
    const s = await until(page, s => s.out === 0, 4000);
    check('tap: the machine took it once it landed (paid 1)', s.paid === 1 && s.out === 0, s);
    await ctx.close();
  }
  // held: a stream, ramping; all taken
  {
    const { ctx, page } = await open(30, 0);
    await stand(page, 'gun');
    const a = await btnA(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
    const s1 = await state(page);
    check('held: a stream, several out of the bag', s1.gold <= 30 - 4 && s1.gold >= 0, s1);
    const s = await until(page, s => s.out === 0, 6000);
    check('stream: the gun machine took them all (paid = what left the bag)', s.paid === 30 - s.gold && s.back === 0, s);
    await ctx.close();
  }
  // a drag from the press aims the stream: right and up
  {
    const { ctx, page } = await open(30, 0);
    await stand(page, 'gun');
    const a = await btnA(page);
    await page.evaluate(() => Object.assign(DEV, { autoPayHold: 100, autoStreamRate0: 20, autoStreamRate1: 20 }));
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y - 50, { steps: 4 });
    await page.waitForTimeout(500);
    const v = await page.evaluate(() => hubState(window.__title.S).thrown.filter(t => t.t < 0.08).map(t => [Math.round(t.vx), Math.round(t.vy)]));
    await page.mouse.up();
    check('dragged right and up: the stream leaves right and up', v.length > 0 && v.every(([vx, vy]) => vx > 100 && vy < -60), v);
    await ctx.close();
  }
  // red at the mod machine; nothing away from the machines
  {
    const { ctx, page } = await open(5, 2);
    check('at the mod machine: A pays it', await stand(page, 'mod') === 'mod');
    const a = await btnA(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    const s = await until(page, s => s.all.mod === 1 || s.red === 0 && s.out === 0, 4000);
    check('a tap: one red out, the mod machine took it', s.red === 1 && s.gold === 5, s);
    const at = await stand(page, null, await page.evaluate(() => hubStopX('enter')));
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    const s2 = await state(page);
    check('away from the machines: no "A to Pay", A pays nothing', at === null && s2.gold === 5 && s2.red === 1, { at, s2 });
    await ctx.close();
  }
  // pour a whole stack in: A held (the stream knobs turned up so the test doesn't wait) till the bag is out
  const pour = async page => {
    await page.evaluate(() => Object.assign(DEV, { autoPayHold: 100, autoStreamRate0: 40, autoStreamRate1: 90, autoStreamRamp: 0.2 }));
    await stand(page, 'gun');
    const a = await btnA(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => bagCount(loadAutoRun(), 'gold') === 0)) break; }
    await page.mouse.up();
  };
  // stage 10b: a stack poured in paying the gun machine in full: a gun flies into the bag, the change stays in run.paid.gun
  const saved = page => page.evaluate(() => { const r = loadAutoRun(); return { paid: (r.paid && r.paid.gun) || 0, guns: r.bag.filter(b => b && b.kind === 'gun').length, gold: bagCount(r, 'gold') }; });
  {
    const { ctx, page } = await open(1, 0);
    const price = await page.evaluate(() => hubPrice('gun', 1).n);
    await page.evaluate(p => { const r = loadAutoRun(); r.bag = r.bag.map(b => b && b.kind === 'gold' ? { kind: 'gold', n: p + 7 } : b); saveAutoRun(r); }, price);
    await page.reload(); await page.waitForTimeout(300);
    await start(page);
    const g0 = await saved(page);
    check('pay in full: the run holds the price + 7 in gold, no gun yet', g0.gold === price + 7 && g0.guns === 0, { g0, price });
    await pour(page);
    let s = g0;
    for (let i = 0; i < 80 && !(s.guns === 1 && s.paid === 7); i++) { await page.waitForTimeout(100); s = await saved(page); }
    check('paid in full by a stream: a gun lands in the bag (saved)', s.guns === 1 && s.gold === 0, s);
    check('the change (7) stays in run.paid.gun', s.paid === 7, s);
    await ctx.close();
  }
  // a partial payment survives a reload
  {
    const { ctx, page } = await open(20, 0);
    await pour(page);
    let s = await saved(page);
    for (let i = 0; i < 40 && s.paid !== 20; i++) { await page.waitForTimeout(100); s = await saved(page); }
    check('partial: 20 into the gun machine, saved in run.paid.gun', s.paid === 20 && s.guns === 0, s);
    await page.reload(); await page.waitForTimeout(300);
    await start(page);
    const h = await page.evaluate(() => { const H = window.__title && hubState(window.__title.S); return H ? H.paid.gun : -1; });
    check('after a reload the hub still has 20 paid into the gun machine', h === 20, h);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
