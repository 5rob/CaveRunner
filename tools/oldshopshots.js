// Reference shots of the OLD game's shop (main's build), phone size, for the hub rebuild (CaveRunner Auto feedback
// round 2: "make sure it looks the same"). It checks out main into tests/build/oldmain (a detached git worktree, ignored)
// the first time and builds its test page there.
//   node tools/oldshopshots.js [outdir]     (default tests/build/oldshop)
// 1-dark: a new run, the tubes coming on; 2-hint: at the gun machine; 3-shake: the mod machine shaking (paying out);
// 4-demo: near the mod machine, its hologram demo of a crystal going in; 5-pad: the way in, under its sign.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OLD = path.join(ROOT, 'tests', 'build', 'oldmain');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tests', 'build', 'oldshop'));
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(path.join(OLD, 'src'))) execSync('git worktree add --detach "' + OLD + '" main', { cwd: ROOT, stdio: 'inherit' });
require(path.join(OLD, 'tools', 'build'))();
require(path.join(OLD, 'tests', 'build'))();

(async () => {
  const browser = await launch();
  const said = [];
  const shot = async (n, what, intro, act) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(i => { window.__TEST_VOID = true; window.__TEST_EMPTY = true; if (i) window.__TEST_INTRO = true; }, intro);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(OLD, 'tests', 'build', 'test.html'));
    await page.waitForTimeout(800);
    await act(page);
    await page.screenshot({ path: path.join(OUT, 'old-' + n + '.png') });
    said.push(`old-${n}.png  ${what}`);
    await ctx.close();
  };
  // stand the player at x on the shop floor, then wait ms
  const at = (page, x, ms) => page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.y = L.world.SHOP_FLOOR * L.world.CELL - 22; L.p.vx = L.p.vy = 0; }, x)
    .then(() => page.waitForTimeout(ms));
  await shot('1-dark', 'a new run: through the teleporter, the tubes stuttering on one after another', true, p => p.waitForTimeout(3800));
  await shot('2-hint', 'at the gun machine: its hint', false, async p => at(p, await p.evaluate(() => SHOPS.guns.x - 20), 900));
  await shot('3-shake', 'the mod machine shaking as it pays out (its chase lights racing)', false, async p => {
    await at(p, await p.evaluate(() => SHOPS.mods.x - 50), 600);
    await p.evaluate(() => { window.__lvl.machines.mods = { n: 1, t: 1.7 }; });
    await p.waitForTimeout(250);
  });
  await shot('4-demo', 'near the mod machine: the hologram demo of a red crystal going in', false, async p => at(p, await p.evaluate(() => SHOPS.mods.x - 60), 1100));
  await shot('5-pad', 'the way in: the teleporter pad under its TELEPORTER-over-PRINTER sign', false, async p => at(p, await p.evaluate(() => window.__lvl.arrival.x + 30), 700));
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
