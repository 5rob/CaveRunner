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

  // ---- 1. a fresh floor has exactly one perk room and one heart room ----
  const rooms = await page.evaluate(() => window.__lvl.rooms);
  check('there are exactly two rooms', Array.isArray(rooms) && rooms.length === 2, rooms);
  const perkRoom = rooms.find(r => r.kind === 'perk');
  const heartRoom = rooms.find(r => r.kind === 'heart');
  check('one of them is a perk room', !!perkRoom, rooms);
  check('the other is a heart room', !!heartRoom, rooms);
  check('the perk room offers a real perk id', typeof perkRoom.id === 'string' && perkRoom.id.length > 0, perkRoom);
  check('neither room starts taken', perkRoom.taken === false && heartRoom.taken === false, rooms);

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
  // tap does: set interact true for a beat, then let it clear
  const takeRoom = (x, y) => page.evaluate(async ({ x, y }) => {
    const { p } = window.__lvl;
    p.x = x - 4; p.y = y - 8; p.vx = 0; p.vy = 0;
    await new Promise(r => requestAnimationFrame(r));
    window.__in.current.interact = true;
    for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 250));
  }, { x, y });

  // ---- 3. collecting the perk ----
  await takeRoom(perkRoom.x, perkRoom.y);
  const afterPerk = await page.evaluate(() => ({
    perks: window.__in.current.loadout.perks,
    roomTaken: window.__lvl.rooms.find(r => r.kind === 'perk').taken,
    pips: document.querySelectorAll('.perkpip').length,
  }));
  check('the perk id ends up in the loadout', afterPerk.perks.length === 1 && afterPerk.perks[0] === perkRoom.id, afterPerk);
  check('the room is marked taken', afterPerk.roomTaken === true, afterPerk.roomTaken);
  check('a perk pip appears in the DOM, one per held perk', afterPerk.pips === afterPerk.perks.length, afterPerk);

  // ---- 4. collecting the heart raises the cap but never heals ----
  const before = await page.evaluate(() => {
    window.__lvl.p.hp = 50;
    return { hp: window.__lvl.p.hp, maxHp: window.__lvl.maxHp() };
  });
  check('hp was set below max to make the heal-check meaningful', before.hp === 50, before);
  await takeRoom(heartRoom.x, heartRoom.y);
  const afterHeart = await page.evaluate(() => ({
    maxHp: window.__lvl.maxHp(),
    hp: window.__lvl.p.hp,
    roomTaken: window.__lvl.rooms.find(r => r.kind === 'heart').taken,
  }));
  check('max health rises by exactly 25', afterHeart.maxHp === before.maxHp + 25, { before: before.maxHp, after: afterHeart.maxHp });
  check('current hp is untouched, not topped up', afterHeart.hp === 50, afterHeart.hp);
  check('the heart room is marked taken', afterHeart.roomTaken === true, afterHeart.roomTaken);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
