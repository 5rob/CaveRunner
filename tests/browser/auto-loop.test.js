// CaveRunner Auto stage 14: the full loop on the phone-size page, speeded up by knobs. A fresh run (save cleared) →
// the hub → the gold paid into the gun machine with A held (real pointer) → a gun in the bag → the pill stick walks player 1
// onto the exit pad, A → the level (short, no blockages, harmless foes, a weak boss) → elites come in → a chest opened
// with A → the boss dies → LEVEL CLEARED → the hub at tier 2 → a green gem dragged onto an empty player circle → 2 players.
// Shortcuts: player 1 starts with a Buzzsaw as his second gun (digs through rock); the run starts with the gun's price in gold and a green gem in the bag (no earning); the level's knobs
// (autoLvlMin, no slowing at elites and chests, autoBlockN 0, autoFoeDmg 0, autoBossHp 1); if the team hasn't killed the boss in 3 s its hp is cut to 0.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };
const T0 = Date.now();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  const price = await page.evaluate(() => {
    Object.assign(DEV, { autoLvlMin: 0.25, autoBlockN: 0, autoFoeDmg: 0, autoFoeElites: 2, autoBossHp: 1, autoChestN: 2, autoLvlElite: 1, autoLvlChest: 1, autoClearT: 1, autoClearWait: 1 });
    const run = newRun(), p = hubPrice('gun', 1).n;
    bagAdd(run, { kind: 'gold', n: p });
    bagAdd(run, { kind: 'green', n: 1 });
    // a digging gun (a Buzzsaw) as player 1's second gun, so rock in the way never stops the team
    const g = Object.assign({}, run.players[0].guns[0], { name: 'Buzzsaw', slots: ['saw', null, null] });
    resetGun(g);
    run.players[0].guns[1] = g;
    saveAutoRun(run);
    return p;
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 60 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('▶: a fresh run opens in the hub (1 player, tier 1)', on && await page.evaluate(() => !!window.__autoHub && hubState(window.__autoHub).tier === 1 && loadAutoRun().players.length === 1));
  for (let i = 0; i < 80 && !(await page.evaluate(() => hubState(window.__title.S).arrived[0])); i++) await page.waitForTimeout(50);

  // the gun machine: the whole gold stack poured in by a stream (the stream knobs turned up so it doesn't wait)
  const saved = () => page.evaluate(() => { const r = loadAutoRun(); return { gold: bagCount(r, 'gold'), guns: r.bag.filter(b => b && b.kind === 'gun').length, players: r.players.length, tier: r.tier }; });
  // (feedback round 2) paid with A: player 1 put at the gun machine, A held (the stream knobs turned up)
  await page.evaluate(() => { const L = window.__title.S.runners[0]; L.x = hubStopX('gun') - PW / 2; L.vx = 0; Object.assign(DEV, { autoPayHold: 100, autoStreamRate0: 40, autoStreamRate1: 90, autoStreamRamp: 0.2 }); });
  const ab = await page.locator('.abtn.aa').boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down();
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if ((await saved()).gold === 0) break; }
  await page.mouse.up();
  let s = await saved();
  for (let i = 0; i < 60 && s.guns < 1; i++) { await page.waitForTimeout(100); s = await saved(); }
  check(`the gun machine paid in full (${price} gold): a gun in the bag`, s.guns === 1 && s.gold === 0, s);

  // the pill stick: walk player 1 onto the exit pad (full push far off, a light one near), let go, A
  const pill = await page.locator('.apill').boundingBox();
  const px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  const dxExit = () => page.evaluate(() => { const S = window.__title.S, r = S.runners[0]; return { dx: hubStopX('exit') - (r.x + PW / 2), at: hubAtExit(S) }; });
  let e = await dxExit(), down = false;
  for (let i = 0; i < 150 && !e.at; i++) {
    const near = Math.abs(e.dx) < 50;
    if (Math.abs(e.dx) < 4) { if (down) { await page.mouse.up(); down = false; } }
    else {
      if (!down) { await page.mouse.move(px, py); await page.mouse.down(); down = true; }
      await page.mouse.move(px + Math.sign(e.dx) * (near ? 0.3 : 0.48) * pill.width, py);
    }
    await page.waitForTimeout(40);
    e = await dxExit();
  }
  if (down) await page.mouse.up();
  for (let i = 0; i < 20 && !e.at; i++) { await page.waitForTimeout(50); e = await dxExit(); }
  check('the pill stick walks player 1 onto the exit pad', e.at, e);
  await page.locator('.abtn.aa').dispatchEvent('pointerdown');
  let lvl = false;
  for (let i = 0; i < 80 && !lvl; i++) { await page.waitForTimeout(50); lvl = await page.evaluate(() => !!window.__autoScene && !!levelState(window.__title.S)); }
  check('A on the exit pad: the level', lvl);

  // the level: pill held right (hurry) on the way in and out; let go and tap A while a chest is in range; the boss cut after 3 s if need be
  const look = () => page.evaluate(() => {
    const S = window.__title.S, L = levelState(S);
    if (!L) return { hub: !!hubState(S), tier: hubState(S) && hubState(S).tier };
    const B = L.boss;
    return { phase: L.phase, elites: L.elites.filter(x => x.f).length, chest: !!chestInRange(S), opened: L.chests.filter(c => c.open).length,
      sc: Math.round(S.scroll), pace: S.pace, hold: L.hold, boss: !!B, bossHp: B ? B.hp : null, arenaT: L.arenaT, t: S.t, cleared: levelClearedAge(S) >= 0, failed: !!L.failed };
  });
  let v = await look(), elites = 0, opened = 0, boss = false, cleared = false, cut = false, held = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 60000 && v.phase) {
    elites = Math.max(elites, v.elites); opened = Math.max(opened, v.opened); boss = boss || v.boss; cleared = cleared || v.cleared;
    if (v.chest) {
      if (held) { await page.mouse.up(); held = false; }
      await page.locator('.abtn.aa').dispatchEvent('pointerdown');
    } else if ((v.phase === 'run' || v.phase === 'out') && !held) {
      await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 0.48 * pill.width, py, { steps: 2 }); held = true;
    }
    if (v.phase !== 'run' && v.phase !== 'out' && held) { await page.mouse.up(); held = false; }
    if (v.phase === 'arena' && v.boss && v.bossHp > 0 && v.t - v.arenaT > 3 && !cut) { cut = true; await page.evaluate(() => { levelState(window.__title.S).boss.hp = 0; }); }
    await page.waitForTimeout(60);
    if (process.env.LOOPDBG) console.log(JSON.stringify(v));
    v = await look();
  }
  if (held) await page.mouse.up();
  console.log(`     (level: ${((Date.now() - t1) / 1000).toFixed(1)} s; boss ${cut ? 'cut to 0 hp (shortcut)' : 'killed by the team'})`);
  check('elites came in', elites >= 1, elites);
  check('a chest opened with A', opened >= 1, opened);
  check('the boss came and died', boss);
  check('LEVEL CLEARED showed', cleared);
  check('back in the hub at tier 2 (saved)', !!v.hub && v.tier === 2 && (await saved()).tier === 2, v);

  // the hub again: a green gem onto the empty player circle → 2 players
  for (let i = 0; i < 80 && !(await page.evaluate(() => hubState(window.__title.S).arrived[0])); i++) await page.waitForTimeout(50);
  const centre = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const gn = await page.evaluate(() => loadAutoRun().bag.findIndex(b => b && b.kind === 'green'));
  const a = await centre('.abag [data-slot="' + gn + '"]'), b = await centre('.anav [data-pslot="1"]');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const s2 = await saved();
  check('a green gem on the empty circle: 2 players (saved, the hub has 2 runners)', s2.players === 2 && await page.evaluate(() => window.__autoHub.runners.length === 2), s2);

  await browser.close();
  console.log(`     (the loop took ${((Date.now() - T0) / 1000).toFixed(1)} s)`);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
