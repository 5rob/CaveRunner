// Dev → Presets (owner, v1.0.89), with real pointer events (the mouse): the ⠿ handle drags a preset onto another's place
// (the saved order changes); in the editor a slot's mod dragged onto another slot swaps them, onto the mod grid throws it
// away, a mod's grab circle in the grid drags a new one onto a slot; 🖼️ opens the gun look gallery and a pick sets `art`.
// Save changes writes it all back. Screenshots (tests/build/autoshots/presets-*.png) for the owner.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = path.join(__dirname, '..', 'build', 'autoshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.setItem('caverunner-devshow', '1'); localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    let list = [];
    for (const [name, slots] of [['A', ['bolt', null, null, null]], ['B', ['spark', 'slug', null, null]], ['C', ['orb', null, null, null]]]) {
      const g = starterKit().gun; g.slots = slots; g.cap = slots.length; list = addPreset(list, name, g);
    }
    savePresets(list);
  });
  await page.reload();
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.adevbtn'))); i++) await page.waitForTimeout(50);
  check('the auto screen is up', on);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.locator('.devtab[data-t="presets"]').click();
  await page.waitForTimeout(300);
  const centre = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const mdrag = async (from, to, shot) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    if (shot) await page.screenshot({ path: path.join(OUT, shot) });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const names = () => page.evaluate(() => loadPresets().map(p => p.name).join(''));

  // the order: A's handle onto C's tile → B C A
  await mdrag(await centre('.apltile[data-preset="0"] .aplhandle'), await centre('.apltile[data-preset="2"]'), 'presets-a-reorder.png');
  check('dragging preset 1 onto 3 moves it there', (await names()) === 'BCA', await names());

  // open B (now first): spark, slug
  await page.locator('.apltile[data-preset="0"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(800);
  const slots = () => page.evaluate(() => [...document.querySelectorAll('.apledslots [data-eslot]')].map(b => (b.classList.contains('full') ? 'x' : '.')).join(''));
  check('the editor is open with B\'s slots', (await slots()) === 'xx..', await slots());
  // slot 1 onto slot 3: swap (spark to slot 3)
  await mdrag(await centre('[data-eslot="0"]'), await centre('[data-eslot="2"]'), 'presets-b-slotdrag.png');
  check('a slot\'s mod onto an empty slot moves it', (await slots()) === '.xx.', await slots());
  // a mod from the grid (its grab circle) onto slot 1
  await page.locator('.apledgrid .mgtile[data-mod="lance"]').scrollIntoViewIfNeeded();
  await mdrag(await centre('.apledgrid .mgtile[data-mod="lance"] .agrab'), await centre('[data-eslot="0"]'), 'presets-c-griddrag.png');
  check('a mod dragged from the grid lands in the slot', (await slots()) === 'xxx.', await slots());
  // slot 2 (slug) into the grid: thrown away
  const grid = await page.locator('.apledgrid').boundingBox();
  await mdrag(await centre('[data-eslot="1"]'), { x: grid.x + grid.width / 2, y: grid.y + 60 }, 'presets-d-bin.png');
  check('a slot\'s mod dragged onto the grid is thrown away', (await slots()) === 'x.x.', await slots());
  // a tap on a slot still picks it
  await page.mouse.click(...Object.values(await centre('[data-eslot="0"]')));
  await page.waitForTimeout(150);
  check('a tap on a slot picks it', !!(await page.$('[data-eslot="0"].sel')));
  // the gun look
  await page.locator('.apledart').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  check('🖼️ opens the gun look gallery', !!(await page.$('.artsheet')));
  await page.screenshot({ path: path.join(OUT, 'presets-e-look.png') });
  await page.mouse.click(...Object.values(await centre('.artpick[data-art="goldpistol"]')));
  await page.waitForTimeout(300);
  check('a pick closes it', !(await page.$('.artsheet')));
  await page.locator('.apledsave').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  const saved = await page.evaluate(() => { const p = loadPresets()[0]; return { slots: p.gun.slots, art: p.gun.art }; });
  check('Save changes keeps the slots and the look', JSON.stringify(saved) === JSON.stringify({ slots: ['lance', null, 'spark', null], art: 'goldpistol' }), saved);
  await page.screenshot({ path: path.join(OUT, 'presets-f-saved.png') });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
