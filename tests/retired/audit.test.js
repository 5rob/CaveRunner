// The owner's audit (LIST3 #6, save/audit.js + ui/cards.js): a mod card's pin and trash toggles
// (exclusive), Give Feedback → a text screen prefilled with the saved notes, Save; a perk card the
// same; the Dev panel's Copy audit. With CAVERUNNER_SHOTS=<dir> it saves the owner's screenshots there.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const SHOTS = process.env.CAVERUNNER_SHOTS;

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1100);
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };
  const down = sel => page.locator(sel).first().dispatchEvent('pointerdown');
  const audit = () => page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-audit') || '{}'));
  await page.evaluate(() => {
    localStorage.removeItem('caverunner-audit');
    const LO = window.__in.current.loadout;
    LO.bag.push('bounce', 'homing', 'double');
    window.__in.current.perkCollection = PERK_IDS.slice();
    LO.perks = [PERK_IDS[0]];
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(300);
  const el = (await page.$$('.bag .tile'))[0];
  const b = await el.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
  const id = await page.$eval('.bag .tile', t => t.getAttribute('data-mod') || '');
  check('the mod card has a pin and a trash', (await page.$$('.pop [data-audit]')).length === 2);
  await down('.pop [data-audit=keep]');
  await page.waitForTimeout(80);
  let a = await audit();
  const key = Object.keys(a)[0] || '';
  check('pin marks it keep', key.startsWith('mod:') && a[key].mark === 'keep', a);
  await down('.pop [data-audit=trash]');
  await page.waitForTimeout(80);
  a = await audit();
  check('trash replaces the pin', a[key] && a[key].mark === 'trash' && (await page.$$('.aumark.on')).length === 1, a);
  await down('.pop [data-audit=keep]');
  await page.waitForTimeout(80);
  check('and the pin back replaces the trash', (await audit())[key].mark === 'keep');
  await shot('item6-1-modcard.png');

  await down('.pop .aufb');
  await page.waitForTimeout(150);
  check('Give Feedback turns the card into a text box', !!(await page.$('.pop .autext')));
  await page.fill('.pop .autext', 'Feels weak next to Homing.');
  await down('.pop .ausave');
  await page.waitForTimeout(120);
  check('Save stores the notes and keeps the mark', (await audit())[key].notes === 'Feels weak next to Homing.' && (await audit())[key].mark === 'keep');
  check('back to the card, notes peeking', (await page.$eval('.pop .aupeek', e => e.textContent)) === 'Feels weak next to Homing.');
  await down('.pop .aufb');
  await page.waitForTimeout(150);
  check('the box opens with the saved notes', (await page.$eval('.pop .autext', e => e.value)) === 'Feels weak next to Homing.');
  await page.fill('.pop .autext', 'Feels weak next to Homing.\nMaybe +50% damage, or bounce once more off walls?');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(100);
  await shot('item6-2-feedback.png');
  const btn = await page.$eval('.pop .ausave', e => e.getBoundingClientRect().bottom);
  check('Save sits high enough to clear a phone keyboard (top half)', btn < 440, btn);
  await down('.pop .aucancel');
  await page.waitForTimeout(100);
  check('Cancel keeps the old notes', (await audit())[key].notes === 'Feels weak next to Homing.');

  // a perk card: the Exo Suit tab
  await page.locator('[data-tab="suit"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const pk = await page.evaluate(() => {
    const p = document.querySelector('.xperk[data-perk]');
    p.scrollIntoView({ block: 'center' });
    const r = p.getBoundingClientRect();
    return { id: p.getAttribute('data-perk'), x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.tap(pk.x, pk.y);
  await page.waitForTimeout(200);
  check('the perk card has the toggles too', (await page.$$('.pop [data-audit]')).length === 2);
  await down('.pop [data-audit=trash]');
  await page.waitForTimeout(80);
  check('trash marks the perk', ((await audit())['perk:' + pk.id] || {}).mark === 'trash', await audit());

  // Dev: Copy audit
  await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator('.pop .pclose').first().dispatchEvent('pointerdown');
  await page.locator('.btab, [data-tab]').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(100);
  // shut the Bag, open Dev
  await page.evaluate(() => { const d = [...document.querySelectorAll('button')].find(x => /^Done$/.test(x.textContent)); if (d) d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(250);
  await page.tap('.devbtn');
  await page.waitForTimeout(250);
  await down('.devbtns .devaudit');
  await page.waitForTimeout(150);
  const txt = await page.evaluate(() => window.__copied);
  console.log(txt);
  check('Copy audit copies the Markdown', txt && txt.startsWith('CaveRunner audit') && txt.includes('## Remove (trash)') &&
    txt.includes('## Keep (pinned)') && txt.includes('(`' + id + '`) — Feels weak') && txt.includes('(`' + pk.id + '`)'), txt);
  check('and says so', (await page.$eval('.devcopied', e => e.textContent)).includes('Audit copied'));
  await shot('item6-3-devpanel.png');

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
