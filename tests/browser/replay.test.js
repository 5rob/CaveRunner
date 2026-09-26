// The death replay ("Witness yourself", v90) in a sandbox. The recorder snapshots RP_HZ a
// second, keeps ~10s while you're alive (older terrain changes fold into its base picture),
// runs on 3s past the death and stops; then the death screen offers WITNESS YOURSELF, which
// plays the recording back through the real draw() with a scrub bar, speeds, fog toggle,
// drag-to-pan and Close — and leaves the live world exactly as it was.
// The pure parts (copying, blending, patches) are in tests/logic/replay.test.js.
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
  await page.evaluate(() => { DEV.zoom = 1; });

  const r = await page.evaluate(async () => {
    const L = window.__lvl, p = L.p, R = L.rec;
    const frame = () => new Promise(requestAnimationFrame);
    const frames = async (n, until) => { for (let i = 0; i < n; i++) { await frame(); if (until && until()) return true; } return false; };
    const out = {};
    const room = L.sandbox({ w: 400, h: 200 });
    // a creature to be recorded, well clear of you
    const k = enemyFor(L.roster[0], 1);
    const ex = room.x + 120, ey = room.y - 60;
    L.enemies.push({ x: ex, y: ey, ty: ey, r: k.r, phase: 0, hp: k.hp, hpMax: k.hp, cd: 99, flash: 0, lx: 0, ly: 1,
      hx: ex, hy: ey, tgt: null, rest: 0, k, touch: 0, charge: 0 });
    // hole A in the floor now: by the death it's older than the window, so it's in the base
    const A = { x: room.x - 80, y: room.y + 8 }, B = { x: room.x + 80, y: room.y + 8 };
    window.__holes = { A, B };
    L.dig(A.x, A.y, 7);
    await frames(40);
    out.snapsEarly = R.snaps.length;
    const dts = R.snaps.slice(1).map((s, i) => s.t - R.snaps[i].t);
    out.meanGap = dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length);
    out.hasEnemy = R.snaps[R.snaps.length - 1].enemies.length === 1;
    out.hasPlayer = !!R.snaps[R.snaps.length - 1].p;
    // live for 11.5s of game time (the window is 10.5)
    const t0 = R.t;
    await frames(2000, () => R.t - t0 > 11.5);
    out.keptSpan = R.snaps[R.snaps.length - 1].t - R.snaps[0].t;
    out.patchesOld = R.patches.filter(q => q.t < R.t - 10.6).length;
    // hole B, then death
    L.dig(B.x, B.y, 7);
    await frames(3);
    out.patchB = R.patches.some(q => q.t > R.t - 0.2);
    p.hp = 1; L.hurt(50);
    out.dead = p.dead;
    const dt0 = performance.now();
    await frames(400, () => !!window.__in.current.witness);
    out.waited = (performance.now() - dt0) / 1000;
    const W = window.__in.current.witness;
    out.W = W && { after: W.t1 - W.death, before: W.death - W.t0 };
    out.done = R.done;
    const n = R.snaps.length;
    await frames(20);
    out.stoppedRecording = R.snaps.length === n;
    return out;
  });
  check('snapshots come in', r.snapsEarly >= 20, r.snapsEarly);
  check('about 20 a second', Math.abs(r.meanGap - 0.05) < 0.012, r.meanGap);
  check('the creature is in the snapshot', r.hasEnemy);
  check('you are in the snapshot', r.hasPlayer);
  check('while alive, only ~10.5s is kept', r.keptSpan > 10 && r.keptSpan < 10.7, r.keptSpan);
  check('old terrain patches fold into the base', r.patchesOld === 0, r.patchesOld);
  check('a dig makes a patch', r.patchB);
  check('you died', r.dead);
  check('recording runs on ~3s past the death', r.W && Math.abs(r.W.after - 3) < 0.1, r.W);
  check('and covers 10s before it', r.W && Math.abs(r.W.before - 10) < 0.1, r.W);
  check('then stops', r.done && r.stoppedRecording, [r.done, r.stoppedRecording]);

  // the button, and the replay
  const btn = await page.$('.witnessbtn');
  check('death screen offers WITNESS YOURSELF', !!btn && (await btn.textContent()) === 'WITNESS YOURSELF');
  const live = await page.evaluate(() => {
    const L = window.__lvl;
    window.__live = { bullets: L.bullets, enemies: L.enemies, px: L.p.x, py: L.p.y, n: L.enemies.length };
    return true;
  });
  await page.tap('.witnessbtn');
  await page.waitForTimeout(300);
  const q = await page.evaluate(async () => {
    const L = window.__lvl, R = L.rec, RT = L.rt, V = window.__in.current.replay, W = window.__in.current.witness;
    const frame = () => new Promise(requestAnimationFrame);
    const out = {};
    out.open = !!document.querySelector('.witness');
    out.controlsHidden = getComputedStyle(document.querySelector('.controls')).visibility === 'hidden';
    out.playing = V.playing && V.t > W.t0;
    // the terrain at the start of the replay has hole A but not hole B; at the end, both
    const alphaAt = (x, y) => RT.tC.getContext('2d').getImageData(Math.floor(x / L.world.CELL), Math.floor(y / L.world.CELL), 1, 1).data[3];
    V.playing = false; V.t = W.t0; await frame(); await frame();
    const A = window.__holes.A, B = window.__holes.B;
    out.startA = alphaAt(A.x, A.y); out.startB = alphaAt(B.x, B.y);
    V.t = W.t1; await frame(); await frame();
    out.endA = alphaAt(A.x, A.y); out.endB = alphaAt(B.x, B.y);
    V.t = W.t0; await frame(); await frame();
    out.backB = alphaAt(B.x, B.y);
    // the live world was put back after every replay frame
    out.sameArrays = L.bullets === window.__live.bullets && L.enemies === window.__live.enemies;
    out.sameEnemies = L.enemies.length === window.__live.n;
    out.samePlace = L.p.x === window.__live.px && L.p.y === window.__live.py;
    out.stillDead = L.p.dead;
    return out;
  }).catch(e => ({ err: e.message }));
  check('the replay screen opens', q.open, q);
  check('the sticks are hidden under it', q.controlsHidden);
  check('it plays', q.playing);
  check('start of replay: old hole A is there', q.startA === 0, q.startA);
  check('start of replay: hole B not dug yet', q.startB === 255, q.startB);
  check('end of replay: both holes', q.endA === 0 && q.endB === 0, [q.endA, q.endB]);
  check('scrubbing back refills hole B', q.backB === 255, q.backB);
  check('live world arrays untouched', q.sameArrays && q.sameEnemies);
  check('live player untouched', q.samePlace && q.stillDead);

  // the controls
  await page.tap('.wplay');
  let c = await page.evaluate(() => window.__in.current.replay.playing);
  check('play button plays', c === true, c);
  await page.tap('.wplay');
  c = await page.evaluate(() => window.__in.current.replay.playing);
  check('and pauses', c === false, c);
  const speeds = await page.$$('.wspeed');
  await speeds[0].tap();
  c = await page.evaluate(() => window.__in.current.replay.speed);
  check('0.25x', c === 0.25, c);
  await page.tap('.wfog');
  c = await page.evaluate(() => window.__in.current.replay.fog);
  check('fog toggles off', c === false, c);
  const box = await (await page.$('.wscene')).boundingBox();
  const before = await page.evaluate(() => window.__in.current.replay.cx);
  await page.mouse.move(box.x + 200, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 300, { steps: 5 });
  await page.mouse.up();
  c = await page.evaluate(() => ({ cx: window.__in.current.replay.cx, follow: window.__in.current.replay.follow }));
  check('dragging pans the camera and stops following', c.cx > before + 20 && c.follow === false, [before, c]);
  await page.tap('.wfollow');
  c = await page.evaluate(() => window.__in.current.replay.follow);
  check('Follow comes back to you', c === true, c);
  const sb = await (await page.$('.wscrub')).boundingBox();
  await page.tap('.wscrub', { position: { x: sb.width * 0.5, y: sb.height / 2 } });
  c = await page.evaluate(() => { const V = window.__in.current.replay, W = window.__in.current.witness; return (V.t - W.t0) / (W.t1 - W.t0); });
  check('the scrub bar seeks', Math.abs(c - 0.5) < 0.05, c);
  await page.waitForTimeout(200);
  await page.tap('.wclose');
  await page.waitForTimeout(200);
  c = await page.evaluate(() => ({ open: !!document.querySelector('.witness'), rv: window.__in.current.replay,
    btn: !!document.querySelector('.witnessbtn') }));
  check('Close shuts it and offers it again', !c.open && c.rv === null && c.btn, c);
  await page.evaluate(() => window.__in.current.requestRestart());
  await page.waitForTimeout(400);
  c = await page.evaluate(() => ({ btn: !!document.querySelector('.witnessbtn'), w: window.__in.current.witness,
    snaps: window.__lvl.rec.snaps.length, dead: window.__lvl.p.dead }));
  check('a restart clears it and records afresh', !c.btn && c.w === null && !c.dead && c.snaps > 0, c);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
