// Autosave: change the run, save, reload the page, and the same run comes back — the same
// cave, minus what was killed, sold and taken. A save from another version brings back the
// gear on a fresh cave; dying wipes the save; Restart wipes it.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  // pagehide saves over anything written from the page, so an "old version" save is forged
  // at the start of the next load instead, before the game reads it
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('forgeOld')) return;
    sessionStorage.removeItem('forgeOld');
    const s = JSON.parse(localStorage.getItem('caverunner-save'));
    s.ver = 'v1'; s.loadout.bag.push('gone_forever');
    localStorage.setItem('caverunner-save', JSON.stringify(s));
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  const URL = 'file://' + path.join(__dirname, '..', 'build', 'test.html');
  await page.goto(URL);
  await page.waitForTimeout(900);

  const before = await page.evaluate(() => {
    const I = window.__in.current, L = window.__lvl;
    I.loadout.gold = 777; I.loadout.bag.push('homing', 'bounce'); I.loadout.sel = 1;
    L.p.hp = 42;
    const killed = L.enemies.splice(0, 2).map(e => e.sid);
    const sold = L.stock.findIndex(it => it.kind === 'mod');
    L.stock[sold].sold = true;
    I.saveRun();
    return { seed: L.seed, enemies: L.enemies.map(e => e.sid), killed, sold,
      pickups: L.pickups.filter(q => !q.taken).length };
  });
  await page.reload();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const I = window.__in.current, L = window.__lvl;
    return { seed: L.seed, enemies: L.enemies.map(e => e.sid), gold: I.loadout.gold,
      bag: I.loadout.bag.join(), sel: I.loadout.sel, hp: L.p.hp, stock: L.stock.map(it => !!it.sold),
      pickups: L.pickups.length };
  });
  check('same cave after reload', after.seed === before.seed, [before.seed, after.seed]);
  check('gold restored', after.gold === 777, after.gold);
  check('bag restored', after.bag === 'homing,bounce', after.bag);
  check('held gun restored', after.sel === 1, after.sel);
  check('health restored', Math.round(after.hp) === 42, after.hp);
  check('killed creatures stay dead', after.enemies.join() === before.enemies.join() &&
    !before.killed.some(k => after.enemies.includes(k)), after.enemies);
  check('sold stock stays sold', after.stock[before.sold] === true, after.stock);
  check('ground loot count kept', after.pickups === before.pickups, [before.pickups, after.pickups]);

  // walking through the portal saves the new floor at once
  await page.evaluate(() => { const L = window.__lvl, P = L.portal;
    L.p.x = P.x + P.w / 2 - 4; L.p.y = P.y + P.h / 2 - 8; });
  await page.waitForTimeout(400);
  const fl = await page.evaluate(() => [window.__lvl.floor, JSON.parse(localStorage.getItem('caverunner-save')).floor]);
  check('new floor is saved', fl[0] === 2 && fl[1] === 2, fl);

  // a save written by another version: gear and floor, fresh cave
  await page.evaluate(() => sessionStorage.setItem('forgeOld', '1'));
  const oldSeed = await page.evaluate(() => window.__lvl.seed);
  await page.reload();
  await page.waitForTimeout(900);
  const up = await page.evaluate(() => ({ floor: window.__lvl.floor, seed: window.__lvl.seed,
    gold: window.__in.current.loadout.gold, bag: window.__in.current.loadout.bag.join() }));
  check('update: floor kept', up.floor === 2, up);
  check('update: gear kept, removed mod dropped', up.gold === 777 && up.bag === 'homing,bounce', up);
  check('update: fresh cave', up.seed !== oldSeed, up);

  // dying wipes it
  await page.evaluate(() => window.__lvl.hurt(1e6));
  await page.waitForTimeout(200);
  const dead = await page.evaluate(() => ({ dead: window.__lvl.p.dead, save: localStorage.getItem('caverunner-save') }));
  check('death wipes the save', dead.dead && dead.save === null, dead);
  await page.waitForTimeout(2300);
  check('a dead run is not re-saved', await page.evaluate(() => localStorage.getItem('caverunner-save')) === null);
  await page.reload();
  await page.waitForTimeout(900);
  const fresh = await page.evaluate(() => ({ floor: window.__lvl.floor, gold: window.__in.current.loadout.gold }));
  check('after death a new run starts', fresh.floor === 1 && fresh.gold !== 777, fresh);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
