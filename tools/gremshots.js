// Screenshots for the owner (Grem Mode): a: the title's GREM MODE; b: Grem Mode playing (2 guns paid off, the third filling, a
// creature tapped: the red ring); c: Dev → Presets; d: a preset open in its editor; e: Dev → Grem (player 1's kit).
//   node tools/gremshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const PRESETS = [['Pea Shooter', ['bolt']], ['Double Spark', ['double', 'spark']], ['Bouncer', ['bounce', 'slug', 'slug']], ['Fireball', ['fball', 'big']],
  ['Triple Orb', ['triple', 'orb']], ['Missiles', ['homing', 'missile', 'missile']], ['Lance', ['pierce', 'lance']], ['Buzz', ['saw', 'double', 'saw']], ['Big Wand', ['triple', 'bolt', 'spark', 'slug', 'orb', 'bounce', 'double', 'bolt', 'spark', 'fball', 'big', 'pierce', 'lance', 'bolt', 'spark', 'orb', null, null, null, null, null, null, null, null, null]]];

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(p => {
    window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.setItem('caverunner-devshow', '1');
    window.__PRESETS = p;
  }, PRESETS);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  const url = 'file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html');
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    DEV.autoFoeDmg = 0;
    let list = [];
    for (const [name, slots] of window.__PRESETS) {
      const g = starterKit().gun;
      g.slots = slots.concat(Array(Math.max(0, 4 - slots.length)).fill(null)); g.cap = g.slots.length; g.name = name;
      list = addPreset(list, name, g);
    }
    savePresets(list);
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const save = async (n, what, clip) => { await page.screenshot({ path: path.join(OUT, 'grem-' + n + '.png'), clip }); said.push(`grem-${n}.png  ${what}`); };
  await save('a-title', 'the title: GREM MODE between ⚙ and ▶');
  await page.locator('.tgrem').dispatchEvent('pointerdown');
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    const S = window.__gremScene, run = S.lvl.data.run;
    bagAdd(run, { kind: 'gold', n: gremPaidAt(1) + Math.round(gremPrice(2) * 0.4) });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__gremScene.lvl.data.run.tier = 10; });   // players 2 and 3 join
  await page.waitForTimeout(1500);
  await page.locator('.ghelms [data-player="1"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await page.locator('.ggun[data-gun="0"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const S = window.__gremScene, r = S.runners[0];
    const f = S.foes.filter(q => q.hp > 0).sort((a, b) => Math.abs(a.x - S.scroll - r.x - 80) - Math.abs(b.x - S.scroll - r.x - 80))[0];
    if (f) S.pick = f;
  });
  await page.waitForTimeout(400);
  await save('b-play', 'Grem Mode: one row of guns (scrolls sideways): gun 1 given to player 2 (picked: white ring on his helmet and on his gun), gun 2 still flashing NEW, gun 3 filling; the helmets with health rings; a tapped creature in a red ring');
  await save('b-panel', 'close up: the gold and the guns', { x: 0, y: 560, width: 412, height: 320 });
  // the normal game's Dev panel: Presets, a preset open, Grem
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator('.devtab[data-t="presets"]').click();
  await page.waitForTimeout(400);
  await save('c-presets', 'Dev → Presets: every saved gun in its unlock order, its Grem price under it');
  await page.locator('.apltile[data-preset="8"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(2500);
  await page.locator('.apledslots [data-eslot="1"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await save('d-edit', 'a preset open: its stats and firing window, its slots (slot 2 picked), ◀ ▶ order, 🗑️, Save changes, the mod grid below');
  await page.locator('.apledback').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.locator('.devtab[data-t="grem"]').click();
  await page.waitForTimeout(300);
  await page.locator('.agkrow[data-cat="hp"] .agkslot[data-slot="0"]').dispatchEvent('pointerdown');
  await page.locator('.agkrow[data-cat="hp"] .agkslot[data-slot="0"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await save('e-kit', 'Dev → Grem: player 1’s exo mods (tap steps the tier) and perks, then the Grem knobs');
  await browser.close();
  console.log(said.join('\n'));
})();
