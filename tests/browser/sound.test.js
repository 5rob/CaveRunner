// Sound: the engine unlocks on the first tap, every voice (spells, creatures, ambience, UI)
// plays without breaking, the floor's ambience follows its theme, and a Black Hole carries
// its own droning loop for as long as it lives. Sandbox room, so the cave can't get in the way.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(800);

  check('silent until something is touched', await page.evaluate(() => SFX.ready) === false);
  await page.touchscreen.tap(210, 300);
  let ready = false;
  for (let i = 0; i < 20 && !ready; i++) { await page.waitForTimeout(100); ready = await page.evaluate(() => SFX.ready); }
  check('a tap unlocks the sound', ready);

  // the ambience starts for this floor's palette once unlocked (the next frame asks for it)
  await page.waitForTimeout(200);
  const amb = await page.evaluate(() => ({ amb: SFX.ambience, theme: window.__lvl.theme }));
  check('the floor ambience follows its theme', amb.amb === amb.theme, amb);
  check('the jetpack loop is running', await page.evaluate(() => SFX.loops) >= 1);

  // play every voice there is, from a sandbox with the player standing still
  const r = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox();
    const x = room.x, y = room.y - 30, p0 = SFX.stats.played;
    const wait = ms => new Promise(res => setTimeout(res, ms));
    // spells: every shot and static, one at a time so the voice cap doesn't drop any
    const ids = Object.keys(MODS).filter(id => !MODS[id].off && (MODS[id].kind === 'shot' || MODS[id].kind === 'static'));
    for (const id of ids) { SFX.cast([blankShot(MODS[id], 0)], null, null); await wait(25); }
    // creatures: each voice, each thing it does
    const seen = {};
    for (const id of Object.keys(CREATURES)) {
      const k = enemyFor(id, 1), v = creatureSound(k).v;
      if (seen[v]) continue; seen[v] = 1;
      for (const what of ['alert', 'idle', 'fire', 'charge', 'hurt', 'die', 'bite', 'fuse']) { SFX.creature(k, what, x + 40, y, 0.4); await wait(30); }
    }
    for (const kind of AMB_EVENTS) { SFX.env(kind, x + 60, y); await wait(30); }
    for (const what of ['coin', 'mod', 'gun', 'buy', 'poor', 'heal', 'perk', 'heart', 'portal', 'hurt', 'shield', 'die', 'revive', 'empty', 'sputter', 'beat']) {
      SFX.ui(what); await wait(40);
    }
    SFX.boom(x, y, 20); SFX.boom(x, y, 90); SFX.hit(x, y); await wait(60); SFX.rock(x, y); SFX.bounce(x, y); SFX.arc(x, y, true);
    return { played: SFX.stats.played - p0, spells: ids.length, voices: Object.keys(seen).length, errors: SFX.stats.errors };
  });
  check('every voice plays without an error', r.errors.length === 0, r.errors);
  check('and they actually went out', r.played > r.spells + r.voices * 6, r);

  // far away is not heard at all
  const far = await page.evaluate(() => { const p0 = SFX.stats.played, P = window.__lvl.p;
    SFX.hit(P.x + 5000, P.y); return SFX.stats.played - p0; });
  check('a sound far off is not played', far === 0, far);

  // a Black Hole drones while it lives, and the drone stops when it goes
  const bh = await page.evaluate(async () => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    const g = LO.guns[0]; g.slots = ['void']; g.manaMax = 9999; g.mana = 9999; resetGun(g); LO.sel = 0;
    const p0 = SFX.stats.played;
    window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    await new Promise(res => setTimeout(res, 60));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    await new Promise(res => setTimeout(res, 150));
    const b = L.bullets.find(q => q.pull);
    const during = L.bhLoops.size, castSound = SFX.stats.played - p0;
    if (b) b.life = 0;
    await new Promise(res => setTimeout(res, 150));
    return { fired: !!b, during, after: L.bhLoops.size, castSound };
  });
  check('Black Hole fired', bh.fired, bh);
  check('casting it made a sound', bh.castSound > 0, bh);
  check('it drones while alive', bh.during === 1, bh);
  check('the drone stops when it dies', bh.after === 0, bh);

  // a new floor switches the ambience
  const next = await page.evaluate(async () => {
    const L = window.__lvl, P = L.portal;
    L.p.x = P.x + P.w / 2 - 4; L.p.y = P.y + P.h / 2 - 8;
    await new Promise(res => setTimeout(res, 300));
    return { floor: L.floor, amb: SFX.ambience, theme: L.theme };
  });
  check('floor 2 has its own ambience', next.floor === 2 && next.amb === next.theme, next);
  check('no sound errors during play', await page.evaluate(() => SFX.stats.errors.length) === 0,
    await page.evaluate(() => SFX.stats.errors));

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
