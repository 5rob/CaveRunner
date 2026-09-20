// The real game, on real floors, proving the two things v32 added: a floor keeps its
// own palette and its own creatures, and the creatures behave like the thing they are
// drawn as. The logic suite proves the tables; this proves the game reads them.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await c.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGE ERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1500);

  // ---- a floor's palette is the floor's own, and it is painted, not just named ----
  const pal = await page.evaluate(() => {
    // average the terrain colours makeLevel actually paints, per floor
    const sample = f => {
      const lv = makeLevel(4242, f);
      const d = lv.img.data;
      let r = 0, g = 0, bl = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 211) {
        if (!d[i + 3]) continue;
        r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++;
      }
      return { rgb: [Math.round(r / n), Math.round(g / n), Math.round(bl / n)], theme: lv.theme };
    };
    return { f1: sample(1), f3: sample(3), f7: sample(7), f1b: sample(1) };
  });
  const dist = (a, x) => Math.hypot(a[0] - x[0], a[1] - x[1], a[2] - x[2]);
  // Averaging a whole map's terrain washes the palette out — most of the map is the
  // same materials whatever the colours are. So the bar is "clearly not the same
  // painting", not "far apart": the same floor twice measures 0, and every pair of
  // different floors has to be well clear of that.
  const pairs = [[pal.f1, pal.f3], [pal.f3, pal.f7], [pal.f1, pal.f7]];
  const gaps = pairs.map(([a, x]) => +dist(a.rgb, x.rgb).toFixed(1));
  check('floor 1 paints its own palette', pal.f1.theme === 'Mossy caves', pal.f1.theme);
  check('and paints it the same way every time', dist(pal.f1.rgb, pal.f1b.rgb) < 1, [pal.f1.rgb, pal.f1b.rgb]);
  check('every floor paints a different cave', Math.min(...gaps) > 15,
    pairs.map(([a, x]) => `${a.theme} ${a.rgb} vs ${x.theme} ${x.rgb} = ${dist(a.rgb, x.rgb).toFixed(1)}`));
  check('the live floor 1 is wearing floor 1\'s palette',
    (await page.evaluate(() => window.__lvl.theme)) === 'Mossy caves',
    await page.evaluate(() => window.__lvl.theme));

  // ---- the live level is populated off the floor's roster ----
  const live = await page.evaluate(() => ({
    floor: window.__lvl.floor, roster: window.__lvl.roster.slice(),
    ids: [...new Set(window.__lvl.enemies.map(e => e.k.id))],
    expected: rosterFor(1).slice(),
    hp: window.__lvl.enemies.map(e => e.hp),
    hpMax: window.__lvl.enemies.map(e => e.hpMax),
    named: window.__lvl.enemies.every(e => typeof e.k.name === 'string' && e.k.name.length > 0),
  }));
  check('floor 1 holds exactly its roster', live.roster.join() === live.expected.join(), live.roster);
  check('and every enemy in the cave is one of them', live.ids.every(id => live.roster.includes(id)), live.ids);
  check('all of the roster turned up', live.roster.every(id => live.ids.includes(id)), live.ids);
  check('each enemy knows what it is called', live.named);
  check('and starts at full health', live.hp.every((h, i) => h === live.hpMax[i] && h > 0));

  // ---- climb a few floors and watch the identity come with you ----
  const hop = async () => {
    await page.evaluate(() => {
      const L = window.__lvl, pt = L.portal;
      L.p.x = pt.x + pt.w / 2 - 6; L.p.y = pt.y + pt.h / 2 - 11;
      L.p.vx = 0; L.p.vy = 0; L.p.hp = 100; L.p.dead = false;
    });
    await page.waitForTimeout(800);
    return page.evaluate(() => ({
      floor: window.__lvl.floor, theme: window.__lvl.theme, roster: window.__lvl.roster.slice(),
      expectedTheme: themeFor(window.__lvl.floor).name,
      expectedRoster: rosterFor(window.__lvl.floor).slice(),
      ids: [...new Set(window.__lvl.enemies.map(e => e.k.id))],
      enemies: window.__lvl.enemies.length,
      charged: window.__lvl.enemies.some(e => e.k.act === 'turret' && e.k.tele > 0),
      chasers: window.__lvl.enemies.filter(e => e.k.act === 'chase' || e.k.act === 'bomb').length,
    }));
  };

  const floors = [];
  for (let i = 0; i < 5; i++) floors.push(await hop());
  check('the portal keeps climbing', floors.map(f => f.floor).join() === '2,3,4,5,6', floors.map(f => f.floor));
  check('every floor is wearing its own palette',
    floors.every(f => f.theme === f.expectedTheme), floors.map(f => [f.floor, f.theme, f.expectedTheme]));
  check('and no two of those floors look alike',
    new Set(floors.map(f => f.theme)).size === 5, floors.map(f => f.theme));
  check('every floor is populated off its own roster',
    floors.every(f => f.roster.join() === f.expectedRoster.join() && f.ids.every(id => f.roster.includes(id))),
    floors.map(f => [f.floor, f.roster, f.ids]));
  check('and the rosters are not all the same mix',
    new Set(floors.map(f => f.roster.slice().sort().join())).size > 1, floors.map(f => f.roster));
  check('deeper floors hold more enemies',
    floors[4].enemies > floors[0].enemies, [floors[0].enemies, floors[4].enemies]);
  check('floor 6 is the sniper floor, and it has a wind-up shooter on it',
    floors[4].charged && floors[4].roster.includes('snipu'), floors[4].roster);
  check('and it has things that come at you', floors[4].chasers > 0, floors[4].chasers);

  // ---- a turret winds up before it fires, and hits hard when it does ----
  const snipe = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p;
    const e = L.enemies.find(x => x.k.act === 'turret' && x.k.tele > 0);
    if (!e) return res({ none: true });
    // stand it right in front of the player, in the open shop, and give it a line
    e.x = p.x + 90; e.y = p.y - 10; e.ty = e.y; e.hx = e.x; e.hy = e.y; e.cd = 0;
    p.hp = 100;
    let sawCharge = 0, shots = 0, dmg = 0, col = null, n = 0;
    const tick = () => {
      if (e.charge > 0) sawCharge = Math.max(sawCharge, e.charge);
      if (L.enemyShots.length > shots) {
        const s = L.enemyShots[L.enemyShots.length - 1];
        shots = L.enemyShots.length; dmg = s.dmg; col = s.col;
      }
      if (++n < 400 && !shots) return requestAnimationFrame(tick);
      res({ id: e.k.id, sawCharge: +sawCharge.toFixed(2), shots, dmg, col,
            base: CREATURES[e.k.id].dmg, floor: L.floor, hp: p.hp });
    };
    requestAnimationFrame(tick);
  }));
  check('a wind-up turret shows the charge before it fires', snipe.none || snipe.sawCharge > 0, snipe);
  check('then it fires', snipe.none || snipe.shots > 0, snipe);
  check('its shot carries its own damage, not a global constant',
    snipe.none || (snipe.dmg >= snipe.base && snipe.dmg > 10), snipe);
  check('and its own colour, so you can read what hit you',
    snipe.none || (typeof snipe.col === 'string' && /^#/.test(snipe.col)), snipe.col);

  // ---- a chaser hurts you by reaching you ----
  const bite = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p;
    const e = L.enemies.find(x => x.k.act === 'chase');
    if (!e) return res({ none: true });
    e.x = p.x + 70; e.y = p.y - 10; e.ty = e.y; e.hx = e.x; e.hy = e.y; e.tgt = null; e.touch = 0;
    p.hp = 100;
    const before = p.hp;
    let n = 0;
    const tick = () => {
      if (++n < 120 && p.hp >= before) return requestAnimationFrame(tick);
      const after = p.hp;
      L.enemies.splice(L.enemies.indexOf(e), 1);
      p.hp = 100; p.dead = false;
      res({ id: e.k.id, before, after, base: CREATURES[e.k.id].dmg, floor: L.floor });
    };
    requestAnimationFrame(tick);
  }));
  check('a chaser reaches you and does damage', bite.none || bite.after < bite.before, bite);
  check('and the damage is its own, scaled by the floor it lives on',
    bite.none || bite.before - bite.after >= bite.base, bite);

  // ---- a bomber takes itself out ----
  const boom = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p;
    const before = L.enemies.length;
    const e = L.enemies.find(x => x.k.act === 'bomb');
    if (!e) return res({ none: true });
    e.x = p.x + 40; e.y = p.y - 6; e.ty = e.y; e.hx = e.x; e.hy = e.y; e.tgt = null; e.touch = 0;
    p.hp = 100;
    let n = 0;
    const tick = () => {
      const still = L.enemies.indexOf(e) >= 0;
      if (++n < 150 && still) return requestAnimationFrame(tick);
      const after = L.enemies.length, hp = p.hp;
      p.hp = 100; p.dead = false;
      res({ id: e.k.id, before, after, hp, gone: !still });
    };
    requestAnimationFrame(tick);
  }));
  check('a bomber bursts on contact and is gone', boom.none || boom.gone, boom);
  check('and it took something off you for it', boom.none || boom.hp < 100, boom);

  // ---- a kill pays what the creature is worth on this floor ----
  const pay = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p;
    L.coins.length = 0;
    const e = L.enemies[0];
    if (!e) return res({ none: true });
    const want = e.k.gold, id = e.k.id;
    e.x = p.x; e.y = p.y - 60; e.ty = e.y; e.hp = 0.0001;
    L.bullets.push({ x: e.x, y: e.ty, vx: 60, vy: 0, life: 1, dmg: 5, size: 3,
      col: '#fff', spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null });
    let n = 0;
    const tick = () => {
      if (++n < 90 && !L.coins.length) return requestAnimationFrame(tick);
      res({ id, want, floor: L.floor, paid: L.coins.length ? L.coins[0].amount : 0 });
    };
    requestAnimationFrame(tick);
  }));
  check('killing something pays its gold', pay.none || pay.paid > 0, pay);
  check('and pays at least what that creature is worth on this floor',
    pay.none || pay.paid >= pay.want, pay);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
