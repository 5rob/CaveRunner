// Screenshots for the owner (Grem Mode): a: the title; b: Grem Mode playing (2 guns paid off, the third filling, a
// creature tapped: the red ring; v1.0.90: players among the unlocks, no A / B, the stick centred, lighter dark, a chest's Tap to open.); c: Dev → Presets; d: a preset open in its editor; e: Dev → Grem (player 1's kit).
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
    localStorage.setItem('caverunner-grem-kit', JSON.stringify({ names: ['Grem', 'Mum', 'Dad', 'Pip'] }));
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
  await save('a-title', 'the title (grem branch): ⚙ and ▶, which opens Grem Mode');
  await page.locator('.tstart').dispatchEvent('pointerdown');
  // (v1.0.92) GO! once the team is through the start pad
  for (let i = 0; i < 200; i++) {
    const t = await page.evaluate(() => { const S = window.__gremScene, T = S && levelTitle(S); return T ? T.a : -1; });
    if (t > 0.75) break;
    await page.waitForTimeout(50);
  }
  await save('f-go', 'GO! at the start (the LEVEL CLEARED letters), the name tags over the heads, the pause button twice the size');
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const S = window.__gremScene, run = S.lvl.data.run;
    bagAdd(run, { kind: 'gold', n: gremPaidAt(5) + Math.round(gremPrice(6) * 0.4) });   // 5 guns and player 2 (the unlocks spread them)
  });
  await page.waitForTimeout(650);
  await save('g-join', 'player 2 unlocked: the start pad’s charge where he lands (then its flash); the new unlocks glowing on the row, nothing equipped');
  await page.waitForTimeout(2500);
  await page.locator('.ghelms [data-player="1"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await page.locator('.ggun.open[data-gun]').first().click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const S = window.__gremScene, r = S.runners[0];
    const f = S.foes.filter(q => q.hp > 0).sort((a, b) => Math.abs(a.x - S.scroll - r.x - 80) - Math.abs(b.x - S.scroll - r.x - 80))[0];
    if (f) S.pick = f;
  });
  await page.waitForTimeout(400);
  await save('b-play', 'Grem Mode: the first open gun given to player 2 (picked: white ring), the other new ones still glowing till used; a tapped creature in a red ring');
  await save('b-panel', 'close up: the gold, the unlocks row (random gun order, players among them), the helmets either side of the stick', { x: 0, y: 560, width: 412, height: 320 });
  // (v1.0.92) the boss: made off screen, coming in under its name in red, then the fight and its bar
  await page.evaluate(() => { const S = window.__gremScene, L = S.lvl.data; L.phase = 'arena'; L.arenaT = S.t; });
  await page.waitForTimeout(1300);
  await save('h-boss-title', 'the boss coming in from the right under its name (red LEVEL CLEARED letters); guns down till it’s gone');
  await page.waitForTimeout(2600);
  await save('h-boss-fight', 'the title gone: the fight, the boss’s health bar (the normal game’s) under the level');
  // a chest beside player 1: Tap to open., then a tap on the play area opens it
  await page.evaluate(() => {
    const S = window.__gremScene, L = S.lvl.data, r = S.runners[0];
    const c = L.chests.find(q => !q.open) || (L.chests[0] = { x: 0 });
    Object.assign(c, { x: S.scroll + r.x + 14, y: undefined, set: false, open: false });
    S.pace = 0; L.hold = 99;
  });
  await page.waitForTimeout(600);
  await save('c-chest', 'a chest in reach: Tap to open.');
  await save('c-chest-close', 'close up: the chest twice the size, its green light pulsing behind', { x: 0, y: 300, width: 412, height: 260 });
  await page.locator('.aplay').dispatchEvent('pointerdown', { clientX: 200, clientY: 300 });
  await page.waitForTimeout(700);
  await save('c-chest-open', 'tapped anywhere on the play area: the chest opens, its (doubled) gold spills');
  // the normal game's Dev panel: Presets, a preset open, Grem
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.locator('.devtab[data-t="presets"]').click();
  await page.waitForTimeout(400);
  await save('c-presets', 'Dev → Presets: every saved gun');
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
  await save('e-kit', 'Dev → Grem: the name tags, player 1’s exo mods (tap steps the tier) and perks, then the Grem knobs');
  await browser.close();
  console.log(said.join('\n'));
})();
