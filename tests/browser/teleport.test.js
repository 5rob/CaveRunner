// v80 in a sandbox: the two Teleport Bolts move you to where they stop (long one far, short
// one a hop, never into rock), the Vacuum Field snaps a creature, a coin and a shot into its
// middle, a gold seam drops gold when it's dug or blown open, and a gun you swap out loses
// its "new" glow.
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

  const r = await page.evaluate(async () => {
    const L = window.__lvl, p = L.p;
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const frames = async (n, until) => { for (let i = 0; i < n && !(until && until()); i++) await new Promise(requestAnimationFrame); };
    const LO = window.__in.current.loadout, g = LO.guns[0];
    const arm = slots => { LO.sel = 0; g.slots = slots; g.cap = slots.length; g.shuffle = false;
      g.manaMax = g.mana = 9999; g.castDelay = 0.05; g.recharge = 0.05; resetGun(g); };
    const fire = async (nx, ny) => {
      window.__in.current.right = { active: true, nx, ny, mag: 1, dy: 0, on: true };
      await frames(2);
      window.__in.current.right = { active: false, nx, ny, mag: 0, dy: 0, on: false };
    };
    const out = {};

    // 1: Teleport Bolt, level and a touch up, in open air: you end up well along the room
    let room = L.sandbox({ w: 900, h: 260 });
    arm(['tele']);
    let x0 = p.x;
    p.x = room.l + 30; x0 = p.x;
    await fire(1, -0.15);
    await frames(90, () => Math.abs(p.x - x0) > 50 && !L.bullets.length);
    out.longHop = Math.round(p.x - x0);
    out.longClear = !L.bullets.length;

    // 2: Small Teleport Bolt: a short hop the same way
    room = L.sandbox({ w: 900, h: 260 });
    arm(['teleshort']);
    p.x = room.l + 30; x0 = p.x;
    await fire(1, -0.15);
    await frames(60, () => Math.abs(p.x - x0) > 20 && !L.bullets.length);
    out.shortHop = Math.round(p.x - x0);

    // 3: straight down into the brick floor: you land on it, not in it
    room = L.sandbox();
    arm(['tele']);
    await fire(0, 1);
    await frames(30, () => !L.bullets.length);
    await frames(10);
    out.inRock = (() => { for (let y = p.y + 1; y < p.y + 21; y += 4) for (let x = p.x + 1; x < p.x + 11; x += 4)
      if (L.mat[Math.floor(y / L.world.CELL) * L.world.CW + Math.floor(x / L.world.CELL)]) return true; return false; })();
    out.floorGap = Math.round(room.y - (p.y + 22));

    // 4: Vacuum Field snaps a creature, a coin and an enemy shot into its middle
    room = L.sandbox({ w: 400, h: 240 });
    const proto = makeLevel(5, 1).enemies[0];
    const e = Object.assign({}, proto, { x: room.x + 40, y: room.y - 150, ty: room.y - 150, hp: 999, max: 999, tgt: null, aggro: false });
    e.k = Object.assign({}, proto.k, { act: 'turret', range: 0 });
    L.enemies.push(e);
    const c = { x: room.x - 30, y: room.y - 150, amount: 1, t: 0, vy: 0 }; L.coins.push(c);
    const s = { x: room.x, y: room.y - 200, vx: 0, vy: 0, life: 9, col: '#fff', dmg: 0, size: 3 }; L.enemyShots.push(s);
    L.fields.push({ x: room.x, y: room.y - 150, r: 64, field: 'vacuum', life: 0.33, max: 0.33, col: '#b57cff', dmg: 1, tick: 0, payload: null, ang: 0 });
    const f = L.fields[L.fields.length - 1];
    await frames(3);
    out.vacEarly = Math.round(e.x - f.x);                // not yet: it waits a blink
    await frames(40, () => f.done);                    // the frame it snaps (things fall/fly on after)
    out.vac = { e: Math.round(Math.hypot(e.x - f.x, e.ty - f.y)), c: Math.round(Math.hypot(c.x - f.x, c.y - f.y)),
      s: L.enemyShots.includes(s) ? Math.round(Math.hypot(s.x - f.x, s.y - f.y)) : 'gone' };
    await frames(40, () => !L.fields.includes(f));
    out.vac.gone = !L.fields.includes(f);

    // 5: a gold seam in the sandbox's floor: dig it, gold falls out; blow the rest, more
    room = L.sandbox({ w: 300, h: 200 });
    L.coins.length = 0;
    const W = L.world, fy = Math.floor(room.y / W.CELL) + 1;
    let nOre = 0;
    for (let cx = Math.floor(room.x / W.CELL) - 20; cx < Math.floor(room.x / W.CELL) + 20; cx++) { L.ore[fy * W.CW + cx] = 1; nOre++; }
    L.dig(room.x - 20, room.y + 3, 8);
    out.digCoins = L.coins.length;
    const before = L.coins.length;
    L.explode(room.x + 20, room.y + 3, 14, 0);
    out.blastCoins = L.coins.length - before;
    out.coinGold = L.coins.reduce((a, q) => a + q.amount, 0);
    L.dig(room.x - 120, room.y + 3, 8);                 // plain brick, no seam: nothing
    out.plainCoins = L.coins.length - before - out.blastCoins;
    return out;
  });
  check('Teleport Bolt takes you a long way', r.longHop > 200, r.longHop);
  check('and the bolt is gone', r.longClear, r);
  check('Small Teleport Bolt is a short hop', r.shortHop > 40 && r.shortHop < r.longHop / 2, { short: r.shortHop, long: r.longHop });
  check('teleporting at the floor never puts you in rock', !r.inRock, r);
  check('you land at the floor, not somewhere else', r.floorGap >= -1 && r.floorGap < 20, r.floorGap);
  check('Vacuum Field waits a blink', r.vacEarly > 20, r.vacEarly);
  check('then the creature is in its middle', r.vac.e < 3, r.vac);
  check('so is the coin', r.vac.c < 3, r.vac);
  check('and the enemy shot', r.vac.s === 'gone' || r.vac.s < 12, r.vac);
  check('and it is over quickly', r.vac.gone, r.vac);
  check('digging a gold seam drops gold', r.digCoins > 0, r);
  check('blasting one does too', r.blastCoins > 0, r);
  check('the gold is real money', r.coinGold > 0, r);
  check('plain rock drops nothing', r.plainCoins === 0, r);

  // ---- the glow on a gun you haven't had, and not on one you threw back ----
  const glow = await page.evaluate(async () => {
    const L = window.__lvl, p = L.p;
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame); };
    const room = L.sandbox();
    DEV.zoom = 1;
    const gun = caveGun(3, Math.random);
    const q = { kind: 'gun', gun, x: p.x + PW / 2 + 16, y: p.y + PH - 9, t: 0 };
    L.pickups.push(q);
    await frames(4);
    window.__in.current.interact = true;
    await frames(6);
    const opened = !!window.__in.current.found;
    return { opened, qOld: !!q.old };
  });
  check('walking up to a new gun and tapping offers the swap', glow.opened, glow);
  // hold slot 0 (a gun you have) to swap: the gun that comes off lies there as thrown-back
  const before = await page.evaluate(() => { window.__swapQ = window.__in.current.found; return !!window.__swapQ.old; });
  check('a new gun is not marked thrown-back', !before);
  const bb = await (await page.$$('.swaprow .gtab'))[0].boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ old: !!window.__swapQ.old, found: !!window.__in.current.found,
    onGround: window.__lvl.pickups.includes(window.__swapQ) }));
  check('the gun you swap out lies there without its glow', after.old && after.onGround && !after.found, after);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
