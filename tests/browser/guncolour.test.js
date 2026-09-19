// Every gun gets a random, stable colour for its name (item 7). Prove:
//  - the same gun renders the same colour in the toolbar, the build-screen
//    tab and the detail card
//  - that colour clears a contrast floor against every background it can
//    land on, in both the light and the dark theme
//  - the always-dark in-game card forces the dark-theme variant even when
//    the site itself is in light mode
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// WCAG relative luminance / contrast ratio, evaluated in the page against
// getComputedStyle's resolved rgb() colours.
const CONTRAST_JS = `
function parseRgb(s) {
  const m = s.match(/rgba?\\(([^)]+)\\)/);
  const [r, g, b] = m[1].split(',').map(x => parseFloat(x));
  return [r, g, b];
}
function luminance([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(a, b) {
  const l1 = luminance(parseRgb(a)), l2 = luminance(parseRgb(b));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
`;

async function run(scheme) {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true,
    isMobile: true, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.addScriptTag({ content: CONTRAST_JS });
  await page.waitForTimeout(1200);

  await page.evaluate(() => { window.__lvl.p.x = 30; });

  // --- same gun, same colour in all three places ---
  await page.evaluate(() => { window.__in.current.loadout.guns[0].hue = 210; window.__in.current.notify(); });
  const toolbarCol = await page.evaluate(() =>
    getComputedStyle(document.querySelectorAll('.slots .gname')[0]).color);

  await page.tap('.weapon');
  await page.waitForTimeout(280);
  const tabCol = await page.evaluate(() =>
    getComputedStyle(document.querySelectorAll('.gtabs .gname')[0]).color);
  await page.tap('.done');
  await page.waitForTimeout(250);

  // hold slot 0 to open its detail card
  const slot = (await page.$$('.slots .slot'))[0];
  const bb = await slot.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const cardCol = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.pop:not(.ingame) .ptitle b')).color);

  check(`[${scheme}] toolbar and build-screen tab match`, toolbarCol === tabCol, { toolbarCol, tabCol });
  check(`[${scheme}] build-screen tab and detail card match`, tabCol === cardCol, { tabCol, cardCol });

  // --- contrast floor across many hues, against every real background ---
  const bg = scheme === 'dark'
    ? { bg: 'rgb(16,25,35)', btn: 'rgb(26,38,51)' }      // --bg / --btn, dark theme
    : { bg: 'rgb(207,219,228)', btn: 'rgb(227,235,241)' }; // --bg / --btn, light theme
  const worst = await page.evaluate(({ bg, btn }) => {
    let min = 99, minHue = -1;
    for (let h = 0; h < 360; h += 5) {
      window.__in.current.loadout.guns[0].hue = h;
      window.__in.current.notify();
      const el = document.querySelectorAll('.slots .gname')[0];
      const col = getComputedStyle(el).color;
      const c1 = contrastRatio(col, bg), c2 = contrastRatio(col, btn);
      const c = Math.min(c1, c2);
      if (c < min) { min = c; minHue = h; }
    }
    return { min, minHue };
  }, bg);
  check(`[${scheme}] every hue clears a 4.5:1 contrast floor`, worst.min >= 4.5, worst);
  console.log(`  [${scheme}] worst-case contrast measured: ${worst.min.toFixed(2)}:1 at hue ${worst.minHue}`);

  // --- the always-dark in-game card forces the dark-theme variant ---
  await page.evaluate(() => {
    const L = window.__lvl, LO = window.__in.current.loadout;
    LO.gold = 500;
    const gun = Object.assign({}, LO.guns[1], { hue: 210 });
    L.stock[1] = { kind: 'gun', gun, x: L.p.x, y: L.p.y + 4, price: 50, sold: false };
    window.__in.current.sig = '';
  });
  await page.waitForTimeout(400);
  const ingameCol = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.pop.ingame .ptitle b')).color);
  const ingameBg = 'rgb(18,20,26)';
  const ingameContrast = await page.evaluate(([col, bg]) => contrastRatio(col, bg), [ingameCol, ingameBg]);
  check(`[${scheme}] the in-game card's gun-name colour clears the floor against its dark backdrop`,
    ingameContrast >= 4.5, { ingameCol, ingameContrast });
  if (scheme === 'light') {
    // it must NOT be the light-theme (dark-text) variant, which would be
    // unreadable on this backdrop no matter the site's own theme
    check('[light] the in-game card overrides the site theme (uses the dark-bg variant)',
      ingameContrast >= 4.5 && toolbarCol !== ingameCol, { toolbarCol, ingameCol });
  }

  await browser.close();
}

(async () => {
  await run('light');
  await run('dark');
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
