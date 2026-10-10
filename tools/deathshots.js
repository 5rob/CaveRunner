// Screenshots for the owner (CaveRunner Auto feedback round 2): the old game's jetpack and ragdoll, ported.
//   node tools/deathshots.js [outdir]      (default tests/build/deathshots; ONLY=o: just the old game's, ONLY=n: just the new)
// old-jet: the OLD game (main's src, unpacked with git archive into tests/build/oldarch, its own test page) jetting up
// and right: the flame tilted away from the thrust, its smoke. new-1-jet: a level, player 1 steered up and right (the
// same push). new-2-rag: player 2 fallen, a ragdoll lying in the level. new-3-prompt: everyone down, the scroll stopped,
// "Tap A to Teleport back to Hub". new-4-lamp: A pressed, the helmet light blinking. new-5-boom: the blast.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ONLY = process.env.ONLY || '';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tests', 'build', 'deathshots'));
const OLD = path.join(ROOT, 'tests', 'build', 'oldarch');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const said = [];
  const ctxOf = () => browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  if (!ONLY || ONLY.includes('o')) {
    if (!fs.existsSync(path.join(OLD, 'src'))) { fs.mkdirSync(OLD, { recursive: true }); execSync('git archive main src tests tools | tar -x -C "' + OLD + '"', { cwd: ROOT, stdio: 'inherit' }); }
    require(path.join(OLD, 'tools', 'build'))();
    require(path.join(OLD, 'tests', 'build'))();
    const ctx = await ctxOf();
    await ctx.addInitScript(() => { window.__TEST_VOID = true; window.__TEST_EMPTY = true; });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(OLD, 'tests', 'build', 'test.html'));
    await page.waitForTimeout(800);
    await page.evaluate(() => { const L = window.__lvl; L.p.y -= 60; });
    for (let i = 0; i < 25; i++) {
      await page.evaluate(() => { window.__in.current.left = { active: true, nx: 0.7, ny: -0.7, mag: 1, dy: -1, on: true }; });
      await page.waitForTimeout(40);
    }
    await page.screenshot({ path: path.join(OUT, 'old-jet.png') });
    said.push('old-jet.png  the OLD game jetting up and right: the flame tilted back from the nozzle, its smoke');
    await ctx.close();
  }
  if (!ONLY || ONLY.includes('n')) {
    require('./build')();
    require('../tests/build')();
    const ctx = await ctxOf();
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 7; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(ROOT, 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); addPlayer(run) || run.players.push(newPlayer(1)); saveAutoRun(run); DEV.autoFoeCap0 = 0; DEV.autoFoeCap1 = 0; });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(9000);
    const save = async (n, what) => { await page.screenshot({ path: path.join(OUT, 'new-' + n + '.png') }); said.push(`new-${n}.png  ${what}`); };
    // pick player 1 (the camera follows him, zoomed in), steer him up and right
    await page.locator('.anav [data-player="0"]').first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    for (let i = 0; i < 18; i++) {
      await page.evaluate(() => levelControl(window.__autoScene, 0, { active: true, nx: 0.7, ny: -0.7, mag: 1 }));
      await page.waitForTimeout(40);
    }
    await save('1-jet', 'player 1 steered up and right (as the old shot): the flame out of the backpack\'s nozzle, tilted back, its smoke');
    await page.evaluate(() => levelControl(window.__autoScene, 0, null));
    // player 2 falls: a ragdoll
    await page.evaluate(() => window.__autoScene.lvl.hurt(window.__autoScene, 1, 1e6));
    await page.waitForTimeout(2200);
    await save('2-rag', 'player 2 fallen: the old ragdoll lying on the level\'s floor (it scrolls away with the cave)');
    // everyone down (player 1, followed, last): the slow stop, the prompt
    await page.evaluate(() => window.__autoScene.lvl.hurt(window.__autoScene, 0, 1e6));
    await page.waitForTimeout(1000 * 1.5 + 1200);
    await save('3-prompt', 'everyone down: the scroll eased to a stop on the last ragdoll, "Tap A to Teleport back to Hub"');
    await page.locator('.abtn.aa').dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    for (let i = 0; i < 60 && !(await page.evaluate(() => { const S = window.__autoScene; return S.runners.some(r => r.lamp) && S.t - levelState(S).tpT > 0.3; })); i++) await page.waitForTimeout(15);
    await save('4-lamp', 'A pressed: the little red light on his helmet blinking fast');
    for (let i = 0; i < 200 && !(await page.evaluate(() => !!levelState(window.__autoScene).boomed)); i++) await page.waitForTimeout(10);
    await page.waitForTimeout(90);
    await save('5-boom', 'then the big blast at his body (then home to the hub, on the teleporter)');
    await page.waitForTimeout(2500);
    await save('6-home', 'home: the hub, the team teleporting in on the pad');
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
