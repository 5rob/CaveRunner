// Screenshots of LIST4 #1 and #5, phone size (412 x 880 @2.625), the real game through the test page.
// Not a test: it takes the pictures and prints what each shows.
//   node tools/presetshots.js [outdir]      (default tests/build/presetshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'presetshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  // four guns of different colours in the slots, the second in hand
  await page.evaluate(() => {
    localStorage.removeItem(PRESET_KEY);
    window.__lvl.guide = null;
    const LO = window.__in.current.loadout;
    let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4; i++) if (!LO.guns[i]) LO.guns[i] = caveGun(3 + i, rnd);
    LO.sel = 1;
    window.__in.current.notify();
  });
  await page.waitForTimeout(600);
  const said = [];
  const shot = async (n, what) => { await page.screenshot({ path: path.join(OUT, n + '.png') }); said.push(`${n}.png  ${what}`); };

  await shot('d-slots', 'the play screen: each gun slot ringed in its gun\'s colour with a faint tint; the held one thicker and glowing');

  await page.tap('.dbtn.weapon');
  await page.waitForTimeout(400);
  await shot('a-baghead', 'the Bag: the held gun\'s name in its colour, ✏️ beside it, 💾 where the gold was, then Done');

  await page.tap('.renamebtn');
  await page.waitForTimeout(200);
  await page.fill('.hedin', 'Big Zappy Boi');
  await shot('b-renaming', 'renaming: the header turns into a name box (prefilled), ✓ saves, ✕ cancels; Enter saves too');
  await page.tap('.hedok');
  await page.waitForTimeout(200);
  await page.tap('.presetbtn');
  await page.waitForTimeout(150);
  await shot('b2-presetname', '💾: the same box asks for the preset\'s name (the gun\'s name to start)');
  await page.press('.hedin', 'Enter');
  await page.waitForTimeout(250);
  await shot('b3-saved', 'saved: a green "Saved preset" flash under the header');
  // two more presets from the other guns
  for (const [i, nm] of [[2, 'Long range'], [3, 'Bouncy chaos build with a very long name']]) {
    await page.tap(`.gtab[data-gun="${i}"]`);
    await page.waitForTimeout(150);
    await page.tap('.presetbtn'); await page.waitForTimeout(100);
    await page.fill('.hedin', nm); await page.press('.hedin', 'Enter'); await page.waitForTimeout(100);
  }
  await page.tap('.sheet .done');
  await page.waitForTimeout(300);
  await page.tap('.devbtn'); await page.waitForTimeout(200);
  await page.tap('.dbg.spawngun'); await page.waitForTimeout(250);
  await shot('c-spawnpresets', 'Dev → Spawn gun: under Spawn, the presets, each in its gun\'s colour (tap = spawn it), 🗑️ to remove');
  await page.tap('.prerow[data-preset="1"] .predelask'); await page.waitForTimeout(150);
  await shot('c2-delete', '🗑️ tapped: it turns into a red Delete; tap again to remove');

  await browser.close();
  console.log('Screenshots in ' + OUT + '\n' + said.join('\n'));
})().catch(e => { console.log('ERROR', e); process.exit(1); });
