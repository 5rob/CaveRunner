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
    const L = window.__lvl;
    // keep a real vine (floor 1 has them) before the sandbox clears the props away
    window.__vine = Object.assign({}, L.props.find(q => q.k === 'climb' && q.st === 'vine'));
    const room = L.sandbox();
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

  // every small sound in the fx table, with each surface and material it takes
  const fxr = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const surfaces = ['rock', 'snow', 'ice', 'slime', 'puddle', 'ash', 'glass', 'log', 'acid'];
    const mats = ['ice', 'glass', 'crystal', 'salt', 'bone', 'stone'];
    const p0 = SFX.stats.played; let calls = 0;
    for (const n of SFX.FX_NAMES) {
      const args = n === 'step' ? surfaces : n === 'land' ? surfaces.map(s => ({ v: 600, s })) : n === 'shatter' ? mats : [undefined];
      for (const a of args) { SFX.fx(n, null, null, a); calls++; await wait(n === 'healtick' ? 380 : n === 'whirl' ? 420 : 220); }
    }
    return { calls, played: SFX.stats.played - p0, names: SFX.FX_NAMES.length, errors: SFX.stats.errors };
  });
  check('every fx sound plays without an error', fxr.errors.length === 0, fxr.errors);
  check('and every one of them went out', fxr.played >= fxr.calls, fxr);

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

  // vines: count rustles as the player climbs up through a clump of them
  const vines = await page.evaluate(async () => {
    const L = window.__lvl, proto = window.__vine;
    if (!proto || !proto.k) return null;
    const room = L.sandbox();
    let n = 0; const orig = SFX.rustle;
    SFX.rustle = function () { n++; return orig.apply(null, arguments); };
    // a thick clump: eight vines side by side, hanging round head height
    const top = room.y - 70;
    for (let i = 0; i < 8; i++)
      L.props.push(Object.assign({}, proto, { x: room.x + i * 7, y: top - proto.t0, anc: null, fall: false, gone: false }));
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // stand clear of them, then step into the first one and let go of everything: a grab
    L.p.x = room.x - 60; L.p.y = top + 4; L.p.vx = L.p.vy = 0;
    await wait(300);
    let n0 = n;
    L.p.x = room.x - 4; L.p.y = top + 4; L.p.vx = L.p.vy = 0;
    await wait(150);
    const grab = n - n0;
    await wait(250);
    n0 = n;
    await wait(1000);                                // hang still
    const still = n - n0;
    // then drag the runner sideways through the whole clump, frame by frame, for a second
    n0 = n;
    const t0 = performance.now();
    while (performance.now() - t0 < 1000) {
      const f = (performance.now() - t0) / 1000;
      L.p.x = room.x - 4 + f * 56; L.p.y = top + 4; L.p.vx = 180; L.p.vy = 0;
      await wait(16);
    }
    const climbed = n - n0;
    SFX.rustle = orig;
    return { grab, still, climbed, len: proto.b - proto.t0 };
  });
  check('grabbing the vines rustles', vines && vines.grab >= 1, vines);
  check('hanging still in them is quiet', vines && vines.still <= 1, vines);
  check('moving through a clump rustles, but not per vine per frame', vines && vines.climbed >= 1 && vines.climbed <= 14, vines);

  // walking makes footsteps, and a drop makes a landing
  const feet = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox(), wait = ms => new Promise(res => setTimeout(res, ms));
    const seen = {}; const orig = SFX.fx;
    SFX.fx = function (n) { seen[n] = (seen[n] || 0) + 1; return orig.apply(null, arguments); };
    L.p.x = room.l + 20; L.p.vx = L.p.vy = 0;
    await wait(300);
    window.__in.current.left = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    await wait(1500);
    window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    await wait(300);
    const steps = seen.step || 0;
    L.p.y = room.y - 160; L.p.vy = 0;
    await wait(900);
    SFX.fx = orig;
    return { steps, land: seen.land || 0 };
  });
  check('walking makes footsteps, a few a second', feet.steps >= 4 && feet.steps <= 9, feet);
  check('dropping onto the floor makes a landing', feet.land >= 1, feet);
  check('the exit portal hums (a loop is running for it)', await page.evaluate(() => SFX.loops) >= 2);

  // a new floor switches the ambience
  const next = await page.evaluate(async () => {
    const L = window.__lvl, P = L.portal, seen = {}, orig = SFX.fx;
    SFX.fx = function (n) { seen[n] = 1; return orig.apply(null, arguments); };
    L.p.x = P.x + P.w / 2 - 4; L.p.y = P.y + P.h / 2 - 8;
    await new Promise(res => setTimeout(res, 300));
    await new Promise(res => setTimeout(res, 200));
    SFX.fx = orig;
    return { floor: L.floor, amb: SFX.ambience, theme: L.theme, portalIn: !!seen.portalIn, portalOut: !!seen.portalOut };
  });
  check('floor 2 has its own ambience', next.floor === 2 && next.amb === next.theme, next);
  check('stepping into the portal and out the other side both sound', next.portalIn && next.portalOut, next);
  // exploding props: hop floors until there is a minecart, then a spore pod, and set each off
  const hop = () => page.evaluate(async () => { const L = window.__lvl, P = L.portal;
    L.p.x = P.x + P.w / 2 - 4; L.p.y = P.y + P.h / 2 - 8; await new Promise(r => setTimeout(r, 300)); });
  const blow = kind => page.evaluate(async kind => {
    const L = window.__lvl, P = L.p, pr = L.props.find(q => q.k === kind && !q.gone);
    if (!pr) return null;
    const calls = {}; const keep = {};
    for (const f of ['boom', 'debris', 'pop']) { keep[f] = SFX[f]; SFX[f] = function () { calls[f] = (calls[f] || 0) + 1; return keep[f].apply(null, arguments); }; }
    P.x = pr.x - 60; P.y = pr.y - 30; P.hp = 9999;
    await new Promise(r => setTimeout(r, 60));
    pr.hurt = 1;
    await new Promise(r => setTimeout(r, 200));
    for (const f in keep) SFX[f] = keep[f];
    return calls;
  }, kind);
  let cartR = null, podR = null;
  for (let i = 0; i < 8 && !(cartR && podR); i++) {
    if (!cartR) cartR = await blow('barrel');
    if (!podR) podR = await blow('pod');
    if (!(cartR && podR)) await hop();
  }
  check('a minecart goes up with a bang and clattering debris', cartR && cartR.boom >= 1 && cartR.debris >= 1, cartR);   // a big blast can set off a neighbour too
  check('a spore pod bursts with a pop', podR && podR.pop === 1, podR);

  check('no sound errors during play', await page.evaluate(() => SFX.stats.errors.length) === 0,
    await page.evaluate(() => SFX.stats.errors));

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
