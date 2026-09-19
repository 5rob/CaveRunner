const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  // a short phone viewport, the worst case for a tall card
  for (const vh of [760, 880]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: vh }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(1200);

    // put every mod in the game on a plinth in turn and measure the card
    const worst = await page.evaluate(async () => {
      const { stock, p } = window.__lvl;
      const ids = Object.keys(MODS);
      const out = [];
      for (const id of ids) {
        stock[1].kind = 'mod'; stock[1].id = id; stock[1].sold = false;
        p.x = stock[1].x - 6; p.y = stock[1].y + 4; p.vx = 0; p.vy = 0;
        window.__in.current.sig = '';
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 90));
        const el = document.querySelector('.pop.ingame');
        if (!el) { out.push({ id, missing: true }); continue; }
        const pad = parseFloat(getComputedStyle(el).paddingBottom);
        out.push({ id, clipped: el.scrollHeight - el.clientHeight, pad,
          bottom: Math.round(el.getBoundingClientRect().bottom) });
      }
      const buy = document.querySelector('.buy');
      return { rows: out, buyTop: buy ? Math.round(buy.getBoundingClientRect().top) : null,
        viewBottom: Math.round(document.querySelector('.view').getBoundingClientRect().bottom) };
    });
    const bad = worst.rows.filter(r => r.missing || r.clipped > 1);
    check(`no mod card clips at ${vh}px tall`, bad.length === 0,
      bad.slice(0, 5).map(b => b.id + ':' + (b.missing ? 'missing' : b.clipped + 'px cut')));
    check(`cards have bottom padding at ${vh}px`, worst.rows.every(r => r.missing || r.pad >= 14),
      worst.rows[0] && worst.rows[0].pad);
    check(`the card still clears the Buy button at ${vh}px`,
      worst.rows.every(r => r.missing || r.bottom < worst.buyTop),
      { maxBottom: Math.max(...worst.rows.filter(r => !r.missing).map(r => r.bottom)), buyTop: worst.buyTop });
    await ctx.close();
  }
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
