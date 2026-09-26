// Rats, rat nests and lanterns in a sandbox (v88). A nest lets rats out up to its max; a
// rat bites you and knocks gold out of you over its head, runs after it, carries it home
// and drops it off in the nest; a dead rat drops what it carried; broke, the bite is triple;
// a dead nest pays 60 plus its stash; a shot lantern pops and sets the grass alight.
// ratStep and the nest carving are proved on hand-made grids / real caves in
// tests/logic/rats.test.js.
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
    const L = window.__lvl, p = L.p, LO = window.__in.current.loadout;
    const frame = () => new Promise(requestAnimationFrame);
    const frames = async (n, until) => { for (let i = 0; i < n; i++) { await frame(); if (until && until()) return true; } return false; };
    const out = {};
    // the real floor had nests and lanterns before the sandbox wipes them
    out.nests = L.enemies.filter(e => e.nest).length;
    const lampProto = L.props.find(q => q.k === 'lamp' && q.st === 'hanglamp');
    out.lamps = L.props.filter(q => q.k === 'lamp').length;
    const room = L.sandbox({ w: 500, h: 200, roof: true });
    const fix = (k, v) => { DEV[k + 'Lo'] = DEV[k + 'Hi'] = v; };
    fix('raSpawn', 0.3); fix('raMax', 3); fix('raBite', 4); fix('raBroke', 3); fix('raSteal', 5);
    fix('raNestRest', 0.2); fix('raWake', 2000);
    // a nest just under the floor on the right, its tunnel coming up through the floor
    const k = enemyFor('pesa', 1), nx = room.x + 150, ny = room.y + 14;
    const mouth = { x: nx, y: room.y - 3.5 };
    const nest = { x: nx, y: ny, ty: ny, r: k.r, phase: 0, hp: k.hp, hpMax: k.hp, cd: 0, flash: 0, lx: 0, ly: 1,
      hx: nx, hy: ny, tgt: null, rest: 0, k, touch: 0, charge: 0,
      nest: { path: [{ x: nx, y: ny }, { x: nx + 4, y: room.y + 4 }, mouth], mouth, t: 0, stash: 0, max: 0 } };
    L.enemies.push(nest);
    p.x = room.l + 30; p.y = room.y - 22.5; p.hp = 100;
    // 1: rats come out, up to its max and no more
    await frames(300, () => L.enemies.filter(e => e.home === nest).length >= 3);
    await frames(90);
    const rats = () => L.enemies.filter(e => e.home === nest);
    out.rats = rats().length;
    out.outside = rats().filter(e => e.ra && e.ra.mode === 'surf').length;
    out.onFloor = rats().every(e => e.ra.mode !== 'surf' || Math.abs(e.y - (room.y - 3.5)) < 3);
    // keep one rat, the rest out of the way
    const rat = rats().find(e => e.ra.mode === 'surf') || rats()[0];
    for (const e of rats()) if (e !== rat) L.enemies.splice(L.enemies.indexOf(e), 1);
    nest.nest.t = 999;                                         // no more for now
    // 2: it comes for you, bites, and a coin pops out over its head
    LO.gold = 100; p.hp = 100; p.hitT = 0;
    p.x = rat.x - 70; p.y = room.y - 22.5; p.vx = p.vy = 0;
    rat.aggro = true;
    const bit = await frames(400, () => LO.gold < 100);
    out.bit = bit; out.hp = p.hp; out.gold = LO.gold;
    const coin = L.coins.find(c => c.pop || c.nopull != null);
    out.coinSide = coin ? Math.sign(coin.vx) === Math.sign(rat.x - (p.x + 6)) : null;
    // stand well back so you don't pull it in, and watch where it lands
    p.x = room.l + 20;
    await frames(120, () => coin && coin.vy === 0 && !coin.pop);
    out.coinAway = coin ? Math.abs(coin.x - (rat.x)) : null;
    // 3: the rat grabs it and takes it home
    rat.aggro = false;
    const got = await frames(400, () => rat.carry > 0);
    out.carried = rat.carry;
    out.coinGone = coin ? !L.coins.includes(coin) : null;
    await frames(600, () => nest.nest.stash > 0);
    out.stash = nest.nest.stash; out.carryAfter = rat.carry;
    // 4: a dead rat drops what it was carrying (and its own)
    rat.carry = 7; const c0 = L.coins.length;
    L.enemies.splice(L.enemies.indexOf(rat), 1); L.enemies.push(rat);
    rat.hp = 0.5; L.explode(rat.x, rat.y, 4, 5);
    out.ratDrop = L.coins.slice(c0).map(c => c.amount);
    // 5: broke, the bite is triple
    L.coins.length = 0;
    nest.nest.t = 0; nest.nest.max = 1;
    await frames(200, () => rats().some(e => e.ra.mode === 'surf'));
    const r2 = rats()[0];
    LO.gold = 0; p.hp = 100; p.x = r2 ? r2.x - 60 : p.x; p.y = room.y - 22.5;
    if (r2) r2.aggro = true;
    await frames(400, () => p.hp < 100);
    out.brokeHit = 100 - p.hp; out.brokeCoins = L.coins.length;
    // 6: kill the nest: 60 and its stash
    nest.nest.stash = 11; L.coins.length = 0; p.x = room.l + 20;
    for (const e of rats()) L.enemies.splice(L.enemies.indexOf(e), 1);
    nest.hp = 0.5; L.explode(nest.x, nest.y, 6, 5);
    out.nestDead = !L.enemies.includes(nest);
    out.nestGold = L.coins.reduce((a, c) => a + c.amount, 0);
    L.coins.length = 0;
    // 7: a lantern over grass: shoot it and the grass catches
    if (lampProto) {
      const pr = L.placeProp(Object.assign({}, lampProto, { len: 10, b: 19, anc: null }), room.x - 60, room.y - 200);
      pr.anc = [Math.floor(pr.x / 2), Math.floor(pr.y / 2) - 1];
      pr.y = room.y - 200 + 2; pr.x = room.x - 60;
      const F = L.fire, W = L.world;
      for (let x = Math.floor((pr.x - 50) / 2); x < (pr.x + 50) / 2; x++) for (let y = room.y / 2 - 3; y < room.y / 2; y++) F.fuel[y * W.CW + x] = 1;
      const g = LO.guns[0];
      LO.sel = 0; g.slots = ['bolt']; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
      g.castDelay = 0.1; g.recharge = 0.1; resetGun(g);
      p.x = room.x - 140; p.y = room.y - 22.5; p.hp = 9999;
      await frames(5);
      const gx = p.x + 6, gy = p.y + 22 * 0.4, dx = pr.x - gx, dy = pr.y + 15 - gy, d = Math.hypot(dx, dy);
      window.__in.current.right = { active: true, nx: dx / d, ny: dy / d, mag: 1, dy: 0, on: true };
      await frames(120, () => pr.gone);
      window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
      out.lampGone = !!pr.gone;
      out.embers = L.dparts.filter(q => q.ember).length;
      await frames(150, () => L.fire.list.length > 0);
      out.burning = L.fire.list.length;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  check('floor 1 has rat nests', r.nests >= 8, r.nests);
  check('and lanterns', r.lamps >= 20, r.lamps);
  check('a nest lets rats out up to its max, no more', r.rats === 3, r.rats);
  check('they come out of the hole onto the floor', r.outside >= 1 && r.onFloor, r);
  check('a rat bites you: health and gold go down', r.bit && r.hp === 96 && r.gold === 95, { hp: r.hp, gold: r.gold });
  check('the gold pops out over its head, away from you', r.coinSide === true && r.coinAway > 15, { side: r.coinSide, away: r.coinAway });
  check('the rat picks the gold up', r.carried === 5 && r.coinGone, { carried: r.carried });
  check('and takes it home to the nest', r.stash === 5 && r.carryAfter === 0, { stash: r.stash, carry: r.carryAfter });
  check('a dead rat drops what it carried', r.ratDrop.includes(7) && r.ratDrop.length === 2, r.ratDrop);
  check('broke, the bite is triple and nothing pops out', r.brokeHit === 12 && r.brokeCoins === 0, { hit: r.brokeHit, coins: r.brokeCoins });
  check('a dead nest pays 60 plus its stash', r.nestDead && r.nestGold === 71, r.nestGold);
  check('a shot lantern pops', r.lampGone === true, r.lampGone);
  check('and its burning oil sets the grass alight', r.burning > 0, { embers: r.embers, burning: r.burning });
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall rat checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
