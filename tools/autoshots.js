// Screenshots for the owner (CaveRunner Auto stage 2), phone size (412 x 880 @2.625), the real page
// through the test page: the title's ▶ opens the auto screen. A quiet one (a new run: one player, empty
// bag) and a busy one (2 players; a gun, mods, a gold stack, gems, an exo mod in the bag). Stage 3a: the hub
// (the teleport-in in the dark, just through, lit at the exo machine, the whole row zoomed out). Stage 3b: walked
// with > to the gun machine (its price), at the exit pad (the "Tap A" hint), 3 players lined up on the move.
//   node tools/autoshots.js [outdir]      (default tests/build/autoshots; ONLY=ghij: just shots g, h, i, j)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const ONLY = process.env.ONLY || '';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  // after: run in the page once the screen is up (the scene is window.__title: { S, C }); wait: ms before the shot
  const shot = async (n, busy, what, wait, after) => {
    if (ONLY && !ONLY.includes(n[0])) return;   // ONLY=ghij: just those shots
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    if (busy === 3) {
      await page.evaluate(() => {
        const run = newRun();
        bagAdd(run, { kind: 'green', n: 2 });
        addPlayer(run); addPlayer(run);
        saveAutoRun(run);
      });
    } else if (busy) {
      await page.evaluate(() => {
        const run = newRun();
        bagAdd(run, { kind: 'green', n: 1 });
        addPlayer(run);
        bagAdd(run, { kind: 'gun', gun: scratchPistol(), n: 1 });
        for (const id of ['bolt', 'spark', 'buck', 'lance']) bagAdd(run, { kind: 'mod', id, n: 1 });
        bagAdd(run, { kind: 'mod', id: 'bolt', n: 2 });
        bagAdd(run, { kind: 'gold', n: 245 });
        bagAdd(run, { kind: 'red', n: 3 });
        bagAdd(run, { kind: 'green', n: 1 });
        bagAdd(run, exoMod('hp', 2));
        bagAdd(run, exoMod('jet', 1));
        saveAutoRun(run);
      });
    }
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(wait || (busy === true ? 9000 : 2500));
    if (after) { await page.evaluate(after); await page.waitForTimeout(400); }
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-quiet', false, 'a new run: one player in the scene, his ring in the nav, three locked circles, the empty bag');
  await shot('b-busy', true, '2 players, 9 s in; the bag: a gun, 4 mods (Bolt ×3), 245 gold, 3 red, 1 green, two exo mods');
  await shot('c-teleport', false, 'the hub, dark: the enter pad charging, the player about to come through', 700);
  await shot('d-arrived', false, 'the hub, just after: he is through, the lightning, the first tubes stuttering on', 1500);
  await shot('e-lit-machine', false, 'the hub lit, the player moved to the exo machine (its own teal hue, the exo glyphs)', 7000,
    () => { const { S, C } = window.__title; S.runners[0].x = hubStopX('exo') - 40; C.lock = 0; });
  await shot('f-whole-hub', false, 'zoomed all the way out: the whole hub row, enter pad, gun, exo, mod, perk machines, exit pad', 7000,
    () => { const { C } = window.__title; C.lock = -1; C.z = C.zmin; C.zt = 0; });
  // (hubGo walks the team; the shot waits in the page till they get there, or mid-walk)
  await shot('g-price', false, '> once: stopped just left of the gun machine, its price (120 G.) on the coin panel', 7000,
    async () => { hubGo(window.__title.S, 1); await new Promise(r => setTimeout(r, 2600)); });
  await shot('h-exit', false, '> five times: on the exit pad, the "Tap A to exit" hint over it', 7000,
    async () => { for (let i = 0; i < 5; i++) hubGo(window.__title.S, 1); await new Promise(r => setTimeout(r, 8000)); });
  await shot('i-lineup', 3, '3 players walking right (> three times), lined up behind the leader', 7000,
    async () => { for (let i = 0; i < 3; i++) hubGo(window.__title.S, 1); await new Promise(r => setTimeout(r, 2200)); });
  await shot('j-gems', false, 'zoomed out, lit: every machine with its price (gun and exo gold, mod 1 red, perk 1 green)', 7000,
    () => { const { C } = window.__title; C.lock = -1; C.z = C.zmin; C.zt = 0; });
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
