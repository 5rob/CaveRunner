// Level 2 stage 2: floor 2 as the tomb, in the real game at phone size. Goes to floor 2 (Dev → Floor 2),
// checks the level carries its room list (W.tomb) and you can stand in its rooms, and takes the
// owner's screenshots: the whole floor (full size, and with each room's type written on it), the
// map screen with the fog lifted, a few rooms of different shapes and types at normal zoom, a
// gallery and a shaft. Shots go to tests/build/tomb-*.png (TOMB_SHOTS=<dir> to put them elsewhere).
// Creatures are cleared for the shots (one kept, parked in the shop), so the rooms show.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = process.env.TOMB_SHOTS || path.join(__dirname, '..', 'build');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  const shot = n => page.screenshot({ path: path.join(OUT, 'tomb-' + n + '.png') });

  // to floor 2, a fixed seed (the Dev button rolls a fresh one: pin it so the shots are the same tomb each run)
  await page.evaluate(() => { Math.random = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  let lvl = null;
  for (let i = 0; i < 40 && !(lvl && lvl.floor === 2 && lvl.tomb); i++) {
    await page.waitForTimeout(100);
    lvl = await page.evaluate(() => ({ floor: window.__lvl.floor, tomb: !!window.__lvl.tomb, seed: window.__lvl.seed }));
  }
  check('Dev → Floor 2 gives a tomb, its room list on the level', lvl.floor === 2 && lvl.tomb, lvl);
  const info = await page.evaluate(() => {
    const T = window.__lvl.tomb;
    return { rooms: T.rooms.length, corridors: T.corridors.length, prize: T.prize, types: T.rooms.map(r => r.type) };
  });
  check('a tomb\'s worth of rooms and corridors', info.rooms >= 30 && info.corridors >= info.rooms - 1, info);

  // the whole floor at full size: background, rock, decoration; and the same with each room's type on it
  const full = await page.evaluate(labels => {
    const W = window.__lvl, { CW, CH } = W.world;
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    const layer = im => { const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; t.getContext('2d').putImageData(im, 0, 0); return t; };
    x.imageSmoothingEnabled = false;
    x.drawImage(layer(makeLevel(W.seed, 2).bgImg), 0, 0, CW, CH);   // (the game keeps only its canvas)
    x.drawImage(layer(W.img), 0, 0);
    x.drawImage(layer(W.dimg), 0, 0);
    const plain = c.toDataURL('image/png');
    x.font = '9px sans-serif'; x.textAlign = 'center';
    for (const r of W.tomb.rooms) {
      x.strokeStyle = 'rgba(255,220,120,0.5)'; x.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      x.fillStyle = '#000'; x.fillText(r.type + ' · ' + r.shape, r.cx + 1, r.y + r.h / 2 + 4);
      x.fillStyle = '#ffe9a0'; x.fillText(r.type + ' · ' + r.shape, r.cx, r.y + r.h / 2 + 3);
    }
    for (const k of W.tomb.corridors) { x.strokeStyle = k.kind === 'shaft' ? 'rgba(120,200,255,0.6)' : 'rgba(140,255,140,0.6)'; x.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1); }
    return { plain, labelled: c.toDataURL('image/png') };
  });
  const save = (n, url) => fs.writeFileSync(path.join(OUT, 'tomb-' + n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  save('1-floor', full.plain);
  save('1-floor-labelled', full.labelled);

  // lift the fog everywhere, clear the creatures, and look about
  await page.evaluate(() => { const W = window.__lvl; W.seen.fill(2); W.fog.paint(); W.enemyShots.length = 0; W.p.hp = 9999;
    // one creature kept, parked in the shop's far corner (none left would put up the all-clear banner)
    W.enemies.length = 1; const e = W.enemies[0]; e.x = e.hx = 30; e.y = e.hy = e.ty = (W.world.SHOP_FLOOR - 12) * W.world.CELL; });
  await page.waitForTimeout(3000);   // the floor's name fades
  // the map screen
  await page.tap('.mapbtn');
  await page.waitForTimeout(500);
  await shot('2-map');
  await page.tap('.mapbtn');
  await page.waitForTimeout(300);

  // stand somewhere (terrain px: the middle of a floor) and let the camera settle
  const standAt = async (x, y) => {
    await page.evaluate(([x, y]) => {
      const W = window.__lvl, C = W.world.CELL;
      W.p.x = x * C - 6; W.p.y = y * C - 22 - 0.5; W.p.vx = 0; W.p.vy = 0; W.enemyShots.length = 0; W.p.hp = 9999;
    }, [x, y]);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(150);
      await page.evaluate(([x, y]) => { const W = window.__lvl, C = W.world.CELL; W.p.x = x * C - 6; W.p.y = y * C - 22 - 0.5; W.p.vx = 0; W.p.vy = 0; }, [x, y]);
    }
  };
  // a few rooms, different shapes and types: the prize altar, a pillar maze, an orrery, then the biggest others
  const picks = await page.evaluate(() => {
    const T = window.__lvl.tomb, R = T.rooms.filter(r => r.type !== 'gate' && r.type !== 'vestibule'), out = [];
    const take = f => { const r = R.find(q => f(q) && !out.includes(q)); if (r) out.push(r); };
    take(r => r.id === T.prize);
    take(r => r.type === 'pillars');
    take(r => r.type === 'orrery');
    for (const s of ['dome', 'ziggurat', 'octagon', 'arch', 'rect']) take(r => r.big && r.shape === s && !out.some(o => o.shape === s));
    take(r => !r.big && r.shape === 'arch');
    return out.slice(0, 6).map(r => ({ id: r.id, type: r.type, shape: r.shape, x: r.cx, y: r.floor, w: r.w, h: r.h }));
  });
  for (const [i, r] of picks.entries()) {
    await standAt(r.x + (r.type === 'pillars' ? 0 : 0), r.y);
    const at = await page.evaluate(() => { const W = window.__lvl, q = tombRoomAt(W.tomb, W.p.x + 6, W.p.y + 11, W.world.CELL); return q ? q.id : -1; });
    check(`you stand in room ${r.id} (${r.type}, ${r.shape})`, at === r.id, at);
    await shot(`3-room${i + 1}-${r.type}-${r.shape}`);
  }
  // a shaft with ledges, from inside, and a long gallery
  const runs = await page.evaluate(() => {
    const T = window.__lvl.tomb;
    const sh = T.corridors.filter(c => c.kind === 'shaft' && c.ledges.length >= 2).sort((a, b) => b.h - a.h)[0];
    const ga = T.corridors.filter(c => c.kind === 'gallery' && c.y > 60).sort((a, b) => b.w - a.w)[0];
    return { sh: sh && { x: sh.x + sh.w / 2, y: sh.ledges[1].y, h: sh.h }, ga: ga && { x: ga.x + ga.w / 2, y: ga.y + ga.h, w: ga.w } };
  });
  check('there is a shaft with ledges and a gallery to show', !!runs.sh && !!runs.ga, runs);
  if (runs.ga) { await standAt(runs.ga.x, runs.ga.y); await shot('4-gallery'); }
  if (runs.sh) { await standAt(runs.sh.x, runs.sh.y); await shot('5-shaft'); }
  // the top: an exit hall and its gallery
  await page.evaluate(() => { const W = window.__lvl, P = W.portals[0]; W.p.x = P.x + 40; W.p.y = P.y + P.h - 22 - 0.5; });
  await standAt(await page.evaluate(() => window.__lvl.tomb.rooms[0].cx + 20), 34);
  await shot('6-exit-hall');

  await browser.close();
  console.log(`shots in ${OUT}`);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
