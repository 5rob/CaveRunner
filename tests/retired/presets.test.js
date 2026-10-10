// Gun presets and the Bag's header (LIST4 #1), and the HUD gun slots in their guns' colours (LIST4 #5):
// ✏️ renames the gun in the Bag; 💾 saves it as a preset (localStorage); Dev → Spawn gun lists it and a
// tap drops that exact gun; 🗑️ then Delete removes it; each slot's ring is its gun's colour.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { localStorage.removeItem(PRESET_KEY); window.__lvl.sandbox(); });
  await page.waitForTimeout(200);

  // ---- the HUD slots: ring = the gun's colour, the held one thicker ----
  let st = await page.evaluate(() => {
    const LO = window.__in.current.loadout;
    const slots = [...document.querySelectorAll('.slots .dbtn.slot')];
    const probe = document.createElement('span');
    document.querySelector('.slots').appendChild(probe);
    const out = slots.map((b, i) => {
      const g = LO.guns[i], cs = getComputedStyle(b);
      probe.style.color = g ? gunColor(g) : '';
      return { gun: !!g, ring: cs.borderTopColor, want: g ? getComputedStyle(probe).color : null,
        w: parseFloat(cs.borderTopWidth), on: b.classList.contains('on'), fill: cs.backgroundColor };
    });
    probe.remove();
    return out;
  });
  const full = st.filter(s => s.gun);
  check('there are guns in the slots', full.length >= 1, st);
  check('each gun slot\'s ring is its gun\'s colour', full.every(s => s.ring === s.want), full);
  check('each gun slot has a faint tint', full.every(s => /rgba\(.*0\.1\d*\)/.test(s.fill) || /0\.3/.test(s.fill)), full.map(s => s.fill));
  const on = st.find(s => s.on), off = full.find(s => !s.on);
  check('the held slot has a thicker ring', on && (!off || on.w > off.w), { on, off });

  // ---- the Bag header: name in colour, rename ----
  await page.tap('.dbtn.weapon');
  await page.waitForTimeout(250);
  st = await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel], el = document.querySelector('.shead .bagname');
    const probe = document.createElement('span'); probe.style.color = gunColor(g); el.parentNode.appendChild(probe);
    const want = getComputedStyle(probe).color; probe.remove();
    return { text: el && el.textContent, name: g.name, col: el && getComputedStyle(el).color, want, hue: gunHue(g),
      title: !!document.querySelector('.shead h2:not(.bagname)'), purse: !!document.querySelector('.sheet .purse'),
      btns: !!document.querySelector('.renamebtn') && !!document.querySelector('.presetbtn') };
  });
  check('the header shows the gun\'s name in its colour', st.text === st.name && st.col === st.want, st);
  check('no page title, no gold; ✏️ and 💾 there', !st.title && !st.purse && st.btns, st);
  const hue0 = st.hue;

  await page.tap('.renamebtn');
  await page.waitForTimeout(150);
  check('✏️ opens the name box, prefilled', await page.evaluate(n => { const i = document.querySelector('.hedin'); return !!i && i.value === n; }, st.name));
  await page.fill('.hedin', 'Testy McGunface');
  await page.tap('.hedok');
  await page.waitForTimeout(150);
  st = await page.evaluate(() => { const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    return { name: g.name, hue: gunHue(g), head: document.querySelector('.shead .bagname').textContent }; });
  check('✓ renames the gun, keeps its colour', st.name === 'Testy McGunface' && st.head === st.name && st.hue === hue0, st);

  // a long name stays on one line at phone width
  st = await page.evaluate(() => { const h = document.querySelector('.shead'), d = h.querySelector('.done').getBoundingClientRect();
    return { hH: h.getBoundingClientRect().height, doneRight: d.right, w: window.innerWidth }; });
  check('the header stays one line', st.hH < 60 && st.doneRight <= st.w, st);

  // ---- 💾 saves a preset ----
  await page.tap('.presetbtn');
  await page.waitForTimeout(150);
  check('💾 asks for a name, prefilled with the gun\'s', await page.evaluate(() => document.querySelector('.hedin').value === 'Testy McGunface'));
  await page.fill('.hedin', 'Preset A');
  await page.press('.hedin', 'Enter');
  await page.waitForTimeout(150);
  st = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'), flash: !!document.querySelector('.hflash') }));
  check('Enter saves the preset to localStorage', st.store.length === 1 && st.store[0].name === 'Preset A' && st.store[0].gun.name === 'Testy McGunface', st.store);
  check('it says Saved preset', st.flash);

  await page.tap('.sheet .done');
  await page.waitForTimeout(250);

  // ---- Dev → Spawn gun lists it; a tap spawns that gun ----
  const openSpawn = async () => {
    await page.tap('.devbtn'); await page.waitForTimeout(150);
    await page.tap('.dbg.spawngun'); await page.waitForTimeout(150);
  };
  await openSpawn();
  st = await page.evaluate(() => [...document.querySelectorAll('.prerow .pregun')].map(b => b.textContent));
  check('Spawn gun lists the preset', st.length === 1 && st[0] === 'Preset A', st);
  const before = await page.evaluate(() => window.__lvl.pickups.filter(q => q.kind === 'gun').length);
  await page.tap('.pregun');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => {
    const guns = window.__lvl.pickups.filter(q => q.kind === 'gun'), g = guns[guns.length - 1], LO = window.__in.current.loadout;
    return { popup: !!document.querySelector('.spawnpanel'), n: guns.length, name: g && g.gun.name,
      same: g && JSON.stringify(g.gun.slots) === JSON.stringify(LO.guns[LO.sel].slots), own: g && g.gun !== LO.guns[LO.sel] };
  });
  check('tapping it closes the panel and drops that gun', !st.popup && st.n === before + 1 && st.name === 'Testy McGunface' && st.same && st.own, st);

  // ---- 🗑️ then Delete removes it ----
  await openSpawn();
  await page.tap('.predelask');
  await page.waitForTimeout(100);
  check('🗑️ turns into Delete (asks once)', await page.evaluate(() => !!document.querySelector('.predel') &&
    JSON.parse(localStorage.getItem(PRESET_KEY)).length === 1));
  await page.tap('.predel');
  await page.waitForTimeout(100);
  st = await page.evaluate(() => ({ rows: document.querySelectorAll('.prerow').length, none: !!document.querySelector('.prenone'),
    store: JSON.parse(localStorage.getItem(PRESET_KEY)) }));
  check('Delete removes it; the empty line shows', st.rows === 0 && st.none && st.store.length === 0, st);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
