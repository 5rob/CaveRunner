const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); };

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);

  // --- shooting: hold the right stick and watch mana drain / bullets appear ---
  const shot = await page.evaluate(async () => {
    const LO = window.__in.current.loadout;
    const g = LO.guns[0];
    g.manaRegen = 0;                                  // so the spend is visible
    const before = g.mana;
    let peak = 0;
    Object.assign(window.__in.current.right, { active: true, on: true, nx: 1, ny: -0.6, mag: 1, dy: -1 });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 25));
      peak = Math.max(peak, window.__lvl.bullets.length);
    }
    Object.assign(window.__in.current.right, { active: false, on: false });
    const g2 = LO.guns[0];
    return { before, after: g2.mana, peak };
  });
  check('firing spends mana', shot.after < shot.before, shot);
  check('bullets exist in flight', shot.peak > 0, shot.peak);

  // --- walking onto a mod pickup shows its card; a tap takes it straight to the bag ---
  const grab = await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const LO = window.__in.current.loadout;
    LO.bag.length = 0;
    const mod = pickups.find(q => q.kind === 'mod');
    mod.x = p.x + 6; mod.y = p.y + 11;                  // drop it on the player's head
    mod.cool = 0;
    await new Promise(r => setTimeout(r, 150));
    const beforeTake = { bag: LO.bag.slice(), card: !!document.querySelector('.pop.ingame') };
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 200));
    return { beforeTake, bag: LO.bag.slice(), gone: mod.taken,
      overlay: !!document.querySelector('.modfound') };
  });
  check('walking onto it shows the card, not the bag', grab.beforeTake.card && grab.beforeTake.bag.length === 0, grab.beforeTake);
  check('a tap puts the mod straight in the bag', grab.bag.length === 1 && grab.gone, grab);
  check('with no confirm overlay', !grab.overlay, grab);

  // --- a gun pickup shows its card; interacting opens the swap chooser, not equipping ---
  const gunFind = await page.evaluate(async () => {
    const { pickups, p } = window.__lvl;
    const LO = window.__in.current.loadout;
    const gp = pickups.find(q => q.kind === 'gun' && !q.taken);
    const before = LO.guns.map(g => g && g.name);
    gp.x = p.x + 6; gp.y = p.y + 11; gp.cool = 0;
    await new Promise(r => setTimeout(r, 250));
    const beforeInteract = { sheet: !!document.querySelector('.sheet'), card: !!document.querySelector('.pop.ingame') };
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 250));
    return { before, beforeInteract, after: LO.guns.map(g => g && g.name) };
  });
  check('walking onto it shows the card, not the chooser', gunFind.beforeInteract.card && !gunFind.beforeInteract.sheet, gunFind);
  check('interacting opens the chooser', (await page.$('.sheet')) !== null, gunFind);
  check('it does not equip by itself', JSON.stringify(gunFind.before) === JSON.stringify(gunFind.after), gunFind);
  await page.click('.done');                       // leave it, carry on with the rest
  await page.waitForTimeout(250);
  check('leaving it resumes the game', (await page.evaluate(() => window.__in.current.paused)) === false);

  // --- the mod sheet: drag from bag onto the gun ---
  await page.evaluate(() => {
    const LO = window.__in.current.loadout;
    // a known 4-slot gun to drag onto (the starter Pick Axe has only one slot)
    LO.guns[0] = resetGun({ name: 'Test Wand', cap: 4, castDelay: 0.2, recharge: 1,
      manaMax: 150, manaRegen: 50, spread: 3, multi: 1, shuffle: false, mana: 150,
      slots: ['bolt', 'bolt', 'bolt', null] });
    LO.sel = 0;
    // start from a known bag: the mod the cave handed us above is whatever the
    // level rolled, and if it happens to match one of these the drag checks
    // below cannot tell the two copies apart
    LO.bag.length = 0;
    LO.bag.push('dmg_up', 'homing', 'double', 'bounce', 'scatter', 'borer', 'tip', 'battery');
    window.__in.current.notify();
  });
  await page.click('.weapon');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shot_sheet2.png') });

  const drag = async (fromSel, fromIdx, toSel, toIdx) => {
    const a = (await page.$$(fromSel))[fromIdx];
    const b = (await page.$$(toSel))[toIdx];
    const ba = await a.boundingBox(), bb = await b.boundingBox();
    await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  };

  const slotsNow = () => page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
  const bagNow = () => page.evaluate(() => window.__in.current.loadout.bag.slice());

  const bagBefore = await bagNow();
  const moved = bagBefore[1];
  await drag('.bag .tile', 1, '.slotRow .tile', 1);     // bag[1] -> slot 1
  check('drag bag -> empty slot', (await slotsNow())[1] === moved, { moved, slots: await slotsNow() });
  check('mod left the bag', !(await bagNow()).includes(moved), await bagNow());
  check('the bolt it displaced went back to the bag', (await bagNow()).includes('bolt'), await bagNow());

  await drag('.slotRow .tile', 1, '.slotRow .tile', 0);  // rearrange: swap with the bolt
  check('drag slot -> slot swaps them',
    JSON.stringify((await slotsNow()).slice(0, 2)) === JSON.stringify([moved, 'bolt']), await slotsNow());

  await drag('.slotRow .tile', 0, '.bag .tile', 0);      // pull it back off the gun
  check('drag slot -> bag takes it off', (await slotsNow())[0] === null, await slotsNow());
  check('mod returns to the bag', (await bagNow()).includes(moved), await bagNow());

  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shot_sheet3.png') });

  // pause while the sheet is open
  const paused = await page.evaluate(async () => {
    const t0 = window.__lvl.p.y;
    await new Promise(r => setTimeout(r, 300));
    return t0 === window.__lvl.p.y;
  });
  check('game is paused behind the sheet', paused);

  await page.click('.done');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shot_game2.png') });

  console.log(errors.length ? '\n' + errors.join('\n') : '\nno page errors');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
