// Perks and the two hidden rooms, proven in the real game rather than just the pure
// makeLevel() output (tests/logic/perks.test.js already covers the table and the room
// placement). This drives the actual step loop: walk onto a room's altar, trip interact
// the same way the stick's dead-zone tap does, and check the loadout, the live perk bag
// and the DOM pip actually change. The heart in particular gets proven to raise the cap
// without healing, since a naive read of "+25 Max Health" could easily also top you up.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);

  // ---- 1. a fresh floor has one hidden room, a green crystal on its altar (no heart room) ----
  const rooms = await page.evaluate(() => window.__lvl.rooms);
  check('there is exactly one room', Array.isArray(rooms) && rooms.length === 1, rooms);
  const perkRoom = rooms[0];
  check('its prize is a green crystal', perkRoom.kind === 'green', rooms);
  check('it does not start taken', perkRoom.taken === false, rooms);

  // ---- 2. starting state: no perks, and a neutral bag gives 100 max hp ----
  const start = await page.evaluate(() => ({
    perks: window.__in.current.loadout.perks,
    maxHp: window.__lvl.maxHp(),
    pb: window.__lvl.pb,
  }));
  check('the loadout starts with no perks', Array.isArray(start.perks) && start.perks.length === 0, start.perks);
  check('max health starts at 100', start.maxHp === 100, start.maxHp);
  check('a neutral bag has dmg 1 and no flags', start.pb.dmg === 1 && start.pb.shield === 0 && start.pb.seeAll === 0 && start.pb.tinker === 0, start.pb);

  // walk onto a room's altar and trip interact the same way the real stick's dead-zone
  // tap does. The room interior is hollow, so gravity would pull the player off the altar
  // before the interact is read — hold it pinned there and keep asking for a few frames.
  const takeRoom = (x, y) => page.evaluate(async ({ x, y }) => {
    const { p } = window.__lvl;
    const pin = () => { p.x = x - 4; p.y = y - 8; p.vx = 0; p.vy = 0; };
    pin();
    await new Promise(r => requestAnimationFrame(r));
    for (let i = 0; i < 8; i++) {
      pin();
      window.__in.current.interact = true;
      await new Promise(r => requestAnimationFrame(r));
    }
    await new Promise(r => setTimeout(r, 150));
  }, { x, y });

  // clear the floor of loose pickups and creatures: a mod or gun lying near an altar is
  // offered to the interact tap before the room is, and a creature could chip the player's
  // health while it is pinned — either one turns a room take into a flake
  await page.evaluate(() => {
    const L = window.__lvl;
    L.pickups.length = 0; L.enemies.length = 0; L.enemyShots.length = 0;
  });

  // ---- 3. the room's green crystal ----
  await takeRoom(perkRoom.x, perkRoom.y);
  const got = await page.evaluate(() => ({ greens: (window.__in.current.loadout.greens || []).length, taken: window.__lvl.rooms[0].taken }));
  check('taking it pockets a green crystal', got.greens === 1 && got.taken, got);

  // ---- 4. a perk counts only fitted to the suit; Extra Health comes full ----
  const fit = await page.evaluate(async () => {
    const L = window.__lvl, LO = window.__in.current.loadout;
    LO.perks.push('health');
    await new Promise(r => setTimeout(r, 100));
    const carried = { max: L.maxHp() };
    L.p.hp = 80;
    LO.perks.splice(LO.perks.indexOf('health'), 1); LO.suit[0] = 'health';
    window.__in.current.perksDirty = true; window.__in.current.notify();
    await new Promise(r => setTimeout(r, 150));
    return { carried, max: L.maxHp(), hp: L.p.hp, pips: document.querySelectorAll('.perkpip').length };
  });
  check('carried, a perk does nothing', fit.carried.max === 100, fit);
  check('fitted, it counts: max health 150, the extra comes full', fit.max === 150 && fit.hp === 130, fit);
  check('no perk column on the HUD (v0.0.137: the Bag has them)', fit.pips === 0, fit);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
