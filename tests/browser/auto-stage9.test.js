// CaveRunner Auto stage 9, with real pointer events: hold a helmet → its 4 guns fan out in an arc; slide onto gun 2
// and let go → it's the active gun (saved); let go on none → nothing; a quick tap still opens the player's menu.
// The Stats level: two graphs (red damage, green health), a tap cycles the span 5s → 15s → 30s → 5s; flat in the hub,
// health drawn in a level. A mod dragged onto the gold tile scraps into gold, with a coin burst.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const open = async level => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(l => { window.__TEST_TITLE = true; if (l) window.__AUTO_LEVEL = l; localStorage.removeItem('caverunner-auto-run'); }, level || 0);
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const run = newRun();
      run.players[0].guns[1] = scratchPistol();
      run.players[0].guns[2] = null; run.players[0].guns[3] = null;
      run.players[0].active = 0;
      bagAdd(run, { kind: 'gold', n: 50 });
      bagAdd(run, { kind: 'mod', id: 'bolt', n: 1 });
      bagAdd(run, { kind: 'mod', id: 'spark', n: 1 });
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let on = false;
    for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
    check('the auto screen is up' + (level ? ' (a level)' : ''), on);
    return { ctx, page };
  };
  const centre = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  // a bag item dropped on the play area: out of the bag, onto the ground in front of the team, never vacuumed back
  const leave = async (page, where) => {
    const i = await page.evaluate(() => loadAutoRun().bag.findIndex(x => x && x.id === 'spark'));
    const a = await centre(page, '.abag [data-slot="' + i + '"]'), b = await centre(page, '.aplay');
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y + 20, { steps: 8 });
    const lit = !!(await page.$('.aplay.drop'));
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ bag: loadAutoRun().bag.some(x => x && x.id === 'spark'),
      left: (window.__title.S.loot || []).filter(g => g.left && g.it.id === 'spark').length }));
    check(where + ': a mod over the play area lights it; dropped, it leaves the bag (saved) and lies there, not vacuumed back', lit && !r.bag && r.left === 1, { lit, r });
  };
  const level = page => page.$eval('.anav', n => n.dataset.level);

  const { ctx, page } = await open();
  // the arc
  const hm = await centre(page, '.anav [data-player="0"]');
  await page.mouse.move(hm.x, hm.y); await page.mouse.down();
  await page.waitForTimeout(150);
  check('held a moment: no arc yet', (await page.$$('.aarcc')).length === 0);
  await page.waitForTimeout(400);
  const arc = await page.evaluate(() => [...document.querySelectorAll('.aarcc')].map(c => ({ dim: c.classList.contains('locked'), sel: c.classList.contains('sel'), y: c.getBoundingClientRect().top })));
  check('held: 4 gun circles above the helmet, 2 empty ones dim, gun 1 active', arc.length === 4 && arc.filter(a => a.dim).length === 2 && arc[0].sel && arc.every(a => a.y < hm.y), arc);
  const g2 = await centre(page, '.aarcc[data-arc="1"]');
  await page.mouse.move(g2.x, g2.y, { steps: 6 });
  await page.waitForTimeout(80);
  check('slid onto gun 2: it lights', !!(await page.$('.aarcc[data-arc="1"].drop')));
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('let go: gun 2 is active (saved), the arc gone, the menu not opened',
    (await page.evaluate(() => loadAutoRun().players[0].active)) === 1 && !(await page.$('.aarcc')) && (await level(page)) === 'players');
  // let go on none
  await page.mouse.move(hm.x, hm.y); await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.move(hm.x, hm.y - 300, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('let go on none: nothing changes', (await page.evaluate(() => loadAutoRun().players[0].active)) === 1 && !(await page.$('.aarcc')) && (await level(page)) === 'players');
  // a tap
  await page.mouse.click(hm.x, hm.y);
  await page.waitForTimeout(150);
  check('a quick tap: the player\'s menu', (await level(page)) === 'player');

  // stats
  await page.locator('.anav [data-open="stats"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ n: document.querySelectorAll('.astats canvas').length, span: document.querySelector('.astatspan').textContent,
    peaks: [...document.querySelectorAll('.astats canvas')].map(c => c.dataset.peak), h: document.querySelector('.anav').getBoundingClientRect().height }));
  check('stats: two graphs, 5s, flat in the hub, the row still 66px', st.n === 2 && st.span === '5s' && st.peaks.every(p => p === '0') && Math.abs(st.h - 66) < 1, st);
  const spans = [];
  const tapStats = async () => { await page.locator('.astats').dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(80); };
  for (let i = 0; i < 4; i++) { await tapStats(); spans.push(await page.$eval('.astatspan', e => e.textContent)); }
  check('a tap cycles 15s → 30s → all → 5s', spans.join() === '15s,30s,all,5s', spans);
  await tapStats(); await tapStats(); await page.waitForTimeout(400);
  const n30 = await page.$eval('.astats canvas', c => c.dataset.n);
  check('30 s: 120 samples', n30 === '120', n30);
  // (feedback round 2) hold a graph: pinned above the nav on its side; held again: unpinned
  const holdGraph = async sel => { await page.locator(sel).dispatchEvent('pointerdown'); await page.waitForTimeout(500); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(350); };
  await holdGraph('.astatg.hp');
  const pin = await page.evaluate(() => { const p = document.querySelector('.apin.hp'), n = document.querySelector('.anav').getBoundingClientRect(); if (!p) return null; const r = p.getBoundingClientRect(); return { right: r.left > n.left + n.width / 2, above: r.bottom <= n.top, span: document.querySelector('.astatspan').textContent }; });
  check('held the health graph: pinned above the nav, on the right; the span unchanged', !!pin && pin.right && pin.above && pin.span === '30s', pin);
  await holdGraph('.astatg.dmg');
  check('held the damage graph: pinned on the left', !!(await page.$('.apin.dmg')) && (await page.$$('.apin')).length === 2);
  await holdGraph('.astatg.hp');
  check('held again: unpinned', !(await page.$('.apin.hp')) && !!(await page.$('.apin.dmg')));

  // scrap
  await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.locator('.abtn.ab').dispatchEvent('pointerdown');
  const bag0 = await page.evaluate(() => { const b = loadAutoRun().bag; return { bolt: b.findIndex(x => x && x.id === 'bolt'), gold: b.findIndex(x => x && x.kind === 'gold'), n: b.find(x => x && x.kind === 'gold').n }; });
  const a = await centre(page, '.abag [data-slot="' + bag0.bolt + '"]'), b = await centre(page, '.abag [data-slot="' + bag0.gold + '"]');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  const lit = await page.$('.abag [data-slot="' + bag0.gold + '"].drop');
  await page.mouse.up();
  await page.waitForTimeout(120);
  const bag1 = await page.evaluate(() => { const b = loadAutoRun().bag; return { bolt: b.findIndex(x => x && x.id === 'bolt'), n: b.find(x => x && x.kind === 'gold').n }; });
  check('a mod over the gold tile: it lights', !!lit);
  check('dropped: the mod is gone, the gold went up (saved)', bag1.bolt < 0 && bag1.n > bag0.n, { bag0, bag1 });
  check('… with a coin burst', !!(await page.$('.acoins i')));
  await page.waitForTimeout(1000);
  check('the burst goes away', !(await page.$('.acoins')));
  await leave(page, 'hub');
  await ctx.close();

  // stats in a level: health drawn
  const L = await open(7);
  await L.page.waitForTimeout(2500);
  const lm = await L.page.locator('.anav [data-player="0"]').first();
  await lm.dispatchEvent('pointerdown'); await lm.dispatchEvent('pointerup');
  await L.page.waitForTimeout(80);
  await L.page.locator('.anav [data-open="stats"]').dispatchEvent('pointerdown');
  await L.page.waitForTimeout(500);
  const lp = await L.page.evaluate(() => [...document.querySelectorAll('.astats canvas')].map(c => Number(c.dataset.peak)));
  check('in a level: the health graph has data', lp.length === 2 && lp[1] > 0, lp);
  await L.page.locator('.abtn.ab').dispatchEvent('pointerdown'); await L.page.locator('.abtn.ab').dispatchEvent('pointerdown');
  await leave(L.page, 'level');
  await L.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
