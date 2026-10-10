// CaveRunner Auto's screen (stage 2): the title's ▶ opens it; the four sections with their counts (4 nav
// circles, 70 bag slots, 4 buttons); the play area's scene animates with the run's players; the bag scrolls;
// the saved run's items show with their counts; ⏸ opens the pause menu, and holds the scene.
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
  // a saved run: 2 players, a gun, gold, a mod stack
  await page.evaluate(() => {
    const run = newRun();
    bagAdd(run, { kind: 'green', n: 1 });
    addPlayer(run);
    bagAdd(run, { kind: 'gun', gun: scratchPistol(), n: 1 });
    bagAdd(run, { kind: 'gold', n: 120 });
    bagAdd(run, { kind: 'mod', id: 'bolt', n: 3 });
    run.players[0].guns[0] = scratchPistol();   // (stage 8a: a gun with a mod fitted, Bolt in slot 1 of 3)
    run.players[0].guns[1] = null;
    saveAutoRun(run);
  });
  check('the title has ▶ and ⚙ only (no slots)', !!(await page.$('.tstart')) && !!(await page.$('.tgear')) && !(await page.$('.tslot')));
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('▶ opens the auto screen', on && !(await page.$('.title')));
  check('the old game is not mounted', await page.evaluate(() => !window.__lvl));

  const n = await page.evaluate(() => ({
    play: document.querySelectorAll('.auto .aplay canvas').length,
    nav: document.querySelectorAll('.anav .anavc').length, players: document.querySelectorAll('.anav .anavc.on').length,
    slots: document.querySelectorAll('.abag .aslot').length, full: document.querySelectorAll('.abag .aslot.full').length,
    btns: [...document.querySelector('.abtns').children].map(e => e.className).join('|'),
    gold: (document.querySelector('.aslot.k-gold') || {}).textContent, mod: Array.from(document.querySelectorAll('.aslot.k-mod')).map(e => e.textContent).join('|'),
    gun: !!document.querySelector('.aslot.k-gun canvas'),
  }));
  check('four sections: play area, 4 nav circles (2 players), 70 bag slots; buttons B, pill stick, A',
    n.play === 1 && n.nav === 4 && n.players === 2 && n.slots === 70 && n.btns === 'abtn ab|apill|abtn aa', n);
  const pill = await page.evaluate(() => { const p = document.querySelector('.apill').getBoundingClientRect(), b = document.querySelector('.abtn.ab').getBoundingClientRect(), cs = getComputedStyle(document.querySelector('.apill'));
    return { h: p.height, bh: b.height, w: p.width, r: cs.borderTopLeftRadius, ta: cs.touchAction }; });
  check('the pill: the buttons height, round ends, wide, touch-action none', Math.abs(pill.h - 46) < 1 && pill.w > 100 && pill.r === '23px' && pill.ta === 'none', pill);
  // (stage 5a: each player's starter kit puts a Buzzsaw in the bag: 2 players, a stack of 2)
  check('the bag shows the run: gun icon, gold 120, mod ×3, the Buzzsaws', n.full === 4 && n.gun && /120/.test(n.gold) && /3/.test(n.mod), n);
  const order = await page.evaluate(() => ['.aplay', '.anav', '.abag', '.abtns'].map(s => document.querySelector(s).getBoundingClientRect().top));
  check('top to bottom: play, nav, bag, buttons', order.every((v, i) => !i || v > order[i - 1]), order);
  const ph = await page.evaluate(() => document.querySelector('.aplay').getBoundingClientRect().height / innerHeight);
  check('the play area is about 55% of the height', ph > 0.45 && ph < 0.62, ph);

  // the scene runs with the run's players
  let t0 = null, t1 = null;
  for (let i = 0; i < 40 && !t0; i++) { await page.waitForTimeout(50); t0 = await page.$eval('.aplaycvs', c => c.dataset.t); }
  await page.waitForTimeout(600);
  t1 = await page.$eval('.aplaycvs', c => c.dataset.t);
  check('the canvas animates', t0 && Number(t1) > Number(t0), [t0, t1]);
  check('the scene has the run\'s 2 players', await page.evaluate(() => window.__title.S.runners.length === 2));

  // the pill stick: dragging it right runs the leader right (after the teleport-in), up-right lifts him; A away from the exit does nothing
  for (let i = 0; i < 60 && !(await page.evaluate(() => hubState(window.__title.S).arrived[0])); i++) await page.waitForTimeout(50);
  const box = await page.locator('.apill').boundingBox();
  const mx = box.x + box.width / 2, my = box.y + box.height / 2;
  const x0 = await page.evaluate(() => window.__title.S.runners[0].x);
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(box.x + box.width - 4, my, { steps: 4 });
  await page.waitForTimeout(700);
  const x1 = await page.evaluate(() => window.__title.S.runners[0].x);
  const kn = await page.$eval('.apillknob', k => k.style.transform);
  check('dragging the pill right runs the leader right, the knob follows', x1 > x0 + 20 && parseFloat(kn.replace('translate(', '')) > 10, [x0, x1, kn]);
  await page.mouse.move(box.x + box.width - 4, box.y + 2, { steps: 3 });
  let air = false;
  for (let i = 0; i < 20 && !air; i++) { await page.waitForTimeout(50); air = await page.evaluate(() => { const S = window.__title.S, r = S.runners[0]; return !r.ground && r.y + 18 < hubState(S).fy - 4; }); }
  check('pushed up: he jets off the floor', air);
  await page.mouse.up();
  let down = false;
  for (let i = 0; i < 40 && !down; i++) { await page.waitForTimeout(50); down = await page.evaluate(() => window.__title.S.runners[0].ground && window.__title.S.runners[0].vx === 0); }
  check('let go: the knob back in the middle, he lands and stops', down && (await page.$eval('.apillknob', k => k.style.transform)) === 'translate(0px, 0px)');
  await page.locator('.abtn.aa').dispatchEvent('pointerdown');
  check('A away from the exit does nothing', await page.evaluate(() => hubExitFlash(window.__title.S) === 0));

  // stage 8a: the context nav. Tap a player → 4 choices; Guns → 4 gun slots; a gun → its mod tiles; B back up to the
  // players; Exo → 4 categories → 5 slots; Perks → 6 slots. The row keeps its height at every level.
  const navH = async () => page.$eval('.anav', e => e.getBoundingClientRect().height);
  const h0 = await navH(), hs = [];
  const nav = () => page.evaluate(() => { const a = document.querySelector('.anav');
    return { level: a.dataset.level, circles: a.querySelectorAll('.anavc').length, slots: a.querySelectorAll('.anavs').length,
      full: a.querySelectorAll('.anavs.full').length, dim: a.querySelectorAll('.anavc.locked').length, txt: a.textContent }; });
  const tapNav = async sel => { await page.locator('.anav ' + sel).first().dispatchEvent('pointerdown'); await page.waitForTimeout(60); hs.push(await navH()); };
  const B = async () => { await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(60); hs.push(await navH()); };
  await tapNav('[data-player="0"]');
  let v = await nav();
  check('tap player 1: 4 choices (Guns, Exo suit, Perks, Stats), in his colour', v.level === 'player' && v.circles === 4
    && await page.$eval('.anav', e => e.style.borderColor !== ''), v);
  await tapNav('[data-open="guns"]');
  v = await nav();
  check('Guns: 4 gun slots, the empty ones dim', v.level === 'guns' && v.circles === 4 && v.dim >= 1 && !!(await page.$('.anav .anavc.gun canvas')), v);
  await tapNav('[data-open="0"]');
  v = await nav();
  check('a gun: its mod tiles (3, Bolt fitted)', v.level === 'gun' && v.slots === 3 && v.full >= 1, v);
  check('the mod row scrolls sideways (pan-x)', await page.$eval('.anav', e => getComputedStyle(e).touchAction === 'pan-x' && getComputedStyle(e).overflowX === 'auto'));
  await B(); await B(); await B();
  v = await nav();
  check('B three times: back to the players', v.level === 'players' && v.circles === 4, v);
  await B();
  check('B at the top: nothing', (await nav()).level === 'players');
  await tapNav('[data-player="0"]'); await tapNav('[data-open="exo"]');
  v = await nav();
  check('Exo suit: 4 categories', v.level === 'exo' && v.circles === 4, v);
  await tapNav('[data-open="jet"]');
  v = await nav();
  check('a category: 5 slots', v.level === 'cat' && v.slots === 5, v);
  await B(); await B(); await tapNav('[data-open="perks"]');
  v = await nav();
  check('Perks: 6 slots', v.level === 'perks' && v.slots === 6, v);
  await B(); await B();
  check('the nav row keeps its height at every level', hs.every(x => Math.abs(x - h0) < 0.5), [h0, hs]);
  check('the scene kept running (no pause)', await page.$eval('.aplaycvs', c => c.dataset.t) !== t1);

  // stage 4b: A on the exit pad takes the team into the level; the level's exit pad brings it home, tier + 1, healed
  await page.evaluate(() => { const S = window.__title.S, r = S.runners[0]; r.x = hubStopX('exit') - PW / 2; r.vx = 0; hubState(S).lx = hubStopX('exit'); });
  await page.waitForTimeout(100);
  await page.locator('.abtn.aa').dispatchEvent('pointerdown');
  let lvl = false;
  for (let i = 0; i < 60 && !lvl; i++) { await page.waitForTimeout(50); lvl = await page.evaluate(() => !!levelState(window.__title.S)); }
  check('A on the exit pad: the level loads', lvl);
  await page.locator('.anav [data-player="1"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(60);
  check('in a level the nav works too (player 2 → his menu); B back', (await nav()).level === 'player' && (await B(), (await nav()).level === 'players'));
  await page.evaluate(() => { const L = levelState(window.__title.S); L.phase = 'exit'; L.doneT = 0; });
  let home = false;
  for (let i = 0; i < 60 && !home; i++) { await page.waitForTimeout(50); home = await page.evaluate(() => !!hubState(window.__title.S)); }
  check('the level exit pad: back in the hub, tier 2, saved', home && await page.evaluate(() => hubState(window.__title.S).tier === 2
    && JSON.parse(localStorage.getItem('caverunner-auto-run')).run.tier === 2));

  // the bag scrolls
  const sc = await page.evaluate(() => { const b = document.querySelector('.abag'); const was = b.scrollTop; b.scrollTop = 9999; return { was, now: b.scrollTop, over: b.scrollHeight > b.clientHeight, ta: getComputedStyle(b).touchAction }; });
  check('the bag scrolls up and down (pan-y)', sc.over && sc.now > sc.was && sc.ta === 'pan-y', sc);

  // ⏸
  await page.locator('.auto .pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(100);
  check('⏸ opens the pause menu with the volumes', !!(await page.$('.pausecard')) && (await page.$$('.pausecard .tvol')).length === 3);
  const p0 = await page.$eval('.aplaycvs', c => c.dataset.t);
  await page.waitForTimeout(300);
  check('and holds the scene', (await page.$eval('.aplaycvs', c => c.dataset.t)) === p0);
  await page.locator('.pbtn.resume').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  check('Resume closes it, the scene goes on', !(await page.$('.pausecard')) && (await page.$eval('.aplaycvs', c => c.dataset.t)) !== p0);
  check('the run is saved', await page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-auto-run')).run.players.length === 2));
  await page.locator('.auto .pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  await Promise.all([page.waitForEvent('load', { timeout: 10000 }), page.locator('.pbtn.exit').dispatchEvent('pointerdown')]);
  await page.waitForTimeout(300);
  check('Exit goes back to the title', !!(await page.$('.title')) && !(await page.$('.auto')));

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
