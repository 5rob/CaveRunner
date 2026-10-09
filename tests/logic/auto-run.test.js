// CaveRunner Auto's run model (src/auto/run.js, src/auto/save.js; AUTOBATTLER.md stage 1): every move,
// stacking, scrap, a full bag, the exo category rule and its additive stacking, the carrot cap, and the
// save round-trip through a fake storage.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gun = () => G.makeGun(rnd, 1);
const filled = run => run.bag.filter(Boolean).length;

// ---- newRun ----
let run = G.newRun();
const p0 = run.players[0];
// (stage 5a: a new run comes with the starter kit, a gun in slot 1 and a Buzzsaw in the bag; the checks after these
// clear both, so they run on the empty run they were written for)
check('newRun: tier 1, one player, 70 bag slots, only the Buzzsaw in it', run.tier === 1 && run.players.length === 1
  && run.bag.length === 70 && G.BAG_SLOTS === 70 && filled(run) === 1 && run.bag[0].kind === 'mod' && run.bag[0].id === 'saw');
check('the player: blue, the starter gun in slot 1 (active), 3 empty, 6 perk slots, 5 per exo category, alive at full health',
  p0.col === G.TITLE_COLS[0] && p0.guns.length === 4 && !!p0.guns[0] && p0.active === 0 && p0.guns.slice(1).every(g => g === null) && p0.perks.length === 6
  && G.EXO_CATS.every(c => p0.exo[c].length === 5) && p0.alive && p0.hp === G.PLAYER_HP);
run.bag.fill(null); p0.guns.fill(null);

// ---- bagAdd and stacking ----
check('gold goes in', G.bagAdd(run, { kind: 'gold', n: 50 }) === null && G.bagCount(run, 'gold') === 50);
G.bagAdd(run, { kind: 'gold', n: 25 });
check('gold stacks without limit (one slot)', G.bagCount(run, 'gold') === 75 && filled(run) === 1);
G.bagAdd(run, { kind: 'gold', n: 1e6 });
check('…however much', G.bagCount(run, 'gold') === 1e6 + 75 && filled(run) === 1);
G.bagAdd(run, { kind: 'red', n: 2 }); G.bagAdd(run, { kind: 'red', n: 3 }); G.bagAdd(run, { kind: 'green', n: 1 });
check('gems stack by colour', G.bagCount(run, 'red') === 5 && G.bagCount(run, 'green') === 1 && filled(run) === 3);
G.bagAdd(run, { kind: 'mod', id: 'spark', n: 1 }); G.bagAdd(run, { kind: 'mod', id: 'spark', n: 2 });
G.bagAdd(run, { kind: 'mod', id: 'bounce', n: 1 });
const sparkI = run.bag.findIndex(x => x && x.id === 'spark');
check('mods stack by id', run.bag[sparkI].n === 3 && filled(run) === 5);
G.bagAdd(run, { kind: 'gun', gun: gun(), n: 1 }); G.bagAdd(run, { kind: 'gun', gun: gun(), n: 1 });
check('guns never stack', run.bag.filter(x => x && x.kind === 'gun').length === 2);
G.bagAdd(run, G.exoMod('hp', 2)); G.bagAdd(run, G.exoMod('hp', 2)); G.bagAdd(run, G.exoMod('hp', 3));
check('exo mods stack by category and tier', run.bag.filter(x => x && x.kind === 'exo').length === 2
  && run.bag.find(x => x && x.kind === 'exo' && x.tier === 2).n === 2);

// ---- spend ----
check('spend: enough gold is paid', G.spend(run, 'gold', 75) && G.bagCount(run, 'gold') === 1e6);
check('spend: not enough is refused, nothing taken', !G.spend(run, 'red', 6) && G.bagCount(run, 'red') === 5);
check('spend: the last of a stack empties its slot', G.spend(run, 'red', 5) && !run.bag.some(x => x && x.kind === 'red'));

// ---- bag overflow ----
{
  const r = G.newRun();
  for (let i = 0; i < 70; i++) G.bagAdd(r, { kind: 'gun', gun: gun(), n: 1 });
  const g = { kind: 'gun', gun: gun(), n: 1 };
  check('a full bag hands back what did not fit', filled(r) === 70 && G.bagAdd(r, g) === g);
  const m = { kind: 'mod', id: 'spark', n: 4 };
  check('a new stack has no room either', G.bagAdd(r, m) === m);
  r.bag[69] = { kind: 'gold', n: 1 };
  check('…but a full bag still takes onto a stack it has', G.bagAdd(r, { kind: 'gold', n: 9 }) === null && G.bagCount(r, 'gold') === 10);
}

// ---- fitGun / setActive ----
run = G.newRun();
run.bag.fill(null); run.players[0].guns.fill(null);   // without the starter kit (stage 5a)
const gA = gun(), gB = gun();
G.bagAdd(run, { kind: 'gun', gun: gA, n: 1 }); G.bagAdd(run, { kind: 'gun', gun: gB, n: 1 });
check('fitGun: a gun from the bag into a slot', G.fitGun(run, 0, 0, 2) && run.players[0].guns[2] === gA && run.bag[0] === null);
check('…and the first gun fitted becomes the active one', run.players[0].active === 2);
check('fitGun onto a fitted gun swaps it into the bag slot', G.fitGun(run, 1, 0, 2) && run.players[0].guns[2] === gB
  && run.bag[1].gun === gA);
check('fitGun refuses a non-gun, a bad slot', !G.fitGun(run, 5, 0, 0) && !G.fitGun(run, 1, 0, 4));
check('setActive: a slot with a gun', G.fitGun(run, 1, 0, 0) && G.setActive(run, 0, 0) && run.players[0].active === 0);
check('setActive refuses an empty slot', !G.setActive(run, 0, 3) && run.players[0].active === 0);
check('unfitGun puts it back in the bag', G.unfitGun(run, 0, 0) && run.players[0].guns[0] === null
  && run.bag.some(x => x && x.gun === gA));

// ---- fitMod / unfitMod ----
const gm = run.players[0].guns[2];
gm.slots = [null, null, null];
G.bagAdd(run, { kind: 'mod', id: 'spark', n: 2 });
let mi = run.bag.findIndex(x => x && x.kind === 'mod');
check('fitMod: one off the stack into the slot', G.fitMod(run, mi, 0, 2, 1) && gm.slots[1] === 'spark' && run.bag[mi].n === 1);
G.bagAdd(run, { kind: 'mod', id: 'bounce', n: 1 });
const bi = run.bag.findIndex(x => x && x.id === 'bounce');
check('fitMod onto a fitted mod sends that one back to the bag', G.fitMod(run, bi, 0, 2, 1) && gm.slots[1] === 'bounce'
  && run.bag[mi].n === 2 && run.bag[bi] === null);
check('fitMod refuses a slot the gun lacks, a gun slot with no gun', !G.fitMod(run, mi, 0, 2, 3) && !G.fitMod(run, mi, 0, 1, 0));
check('unfitMod: back to the bag', G.unfitMod(run, 0, 2, 1) && gm.slots[1] === null
  && run.bag.find(x => x && x.id === 'bounce').n === 1);
check('unfitMod refuses an empty slot', !G.unfitMod(run, 0, 2, 0));
{
  const r = G.newRun();
  const g = gun(); g.slots = ['spark', null];
  r.players[0].guns[0] = g;
  for (let i = 0; i < 70; i++) r.bag[i] = { kind: 'gun', gun: gun(), n: 1 };
  check('unfitMod refuses into a full bag (the mod stays)', !G.unfitMod(r, 0, 0, 0) && g.slots[0] === 'spark');
  r.bag[5] = { kind: 'mod', id: 'bounce', n: 2 };
  check('fitMod refuses when the swapped-out mod has no room, nothing changes', !G.fitMod(r, 5, 0, 0, 0)
    && g.slots[0] === 'spark' && r.bag[5].n === 2 && r.bag[5].id === 'bounce');
  r.bag[5].n = 1;
  check('…but taking the last of a stack frees its slot for the swap', G.fitMod(r, 5, 0, 0, 0)
    && g.slots[0] === 'bounce' && r.bag[5].id === 'spark');
}

// ---- fitExo ----
run = G.newRun();
run.bag.fill(null);   // without the starter kit's Buzzsaw (stage 5a)
G.bagAdd(run, G.exoMod('speed', 1)); G.bagAdd(run, G.exoMod('speed', 1)); G.bagAdd(run, G.exoMod('hp', 4));
check('fitExo refuses another category (speed into hp)', !G.fitExo(run, 0, 0, 'hp', 0) && run.players[0].exo.hp[0] === null);
check('fitExo: speed into speed, one off the stack', G.fitExo(run, 0, 0, 'speed', 0) && run.players[0].exo.speed[0].tier === 1
  && run.bag[0].n === 1);
check('fitExo refuses a sixth slot', !G.fitExo(run, 0, 0, 'speed', 5));
G.fitExo(run, 0, 0, 'speed', 3);
check('two +8% speed = +16% (additive)', near(G.exoBonus(run.players[0]).walk, 1.16), G.exoBonus(run.players[0]).walk);
check('fitExo: hp', G.fitExo(run, 1, 0, 'hp', 2) && G.exoBonus(run.players[0]).hpAdd === 95);
G.bagAdd(run, G.exoMod('hp', 1));
G.fitExo(run, run.bag.findIndex(x => x && x.cat === 'hp'), 0, 'hp', 0);
check('hp adds (95 + 20)', G.exoBonus(run.players[0]).hpAdd === 115);
G.bagAdd(run, G.exoMod('hp', 5));
G.fitExo(run, run.bag.findIndex(x => x && x.cat === 'hp'), 0, 'hp', 2);
check('fitExo onto a fitted one swaps it back to the bag', G.exoBonus(run.players[0]).hpAdd === 150
  && run.bag.some(x => x && x.cat === 'hp' && x.tier === 4));
check('unfitExo', G.unfitExo(run, 0, 'hp', 2) && G.exoBonus(run.players[0]).hpAdd === 20);
G.bagAdd(run, G.exoMod('jet', 2));
G.fitExo(run, run.bag.findIndex(x => x && x.cat === 'jet'), 0, 'jet', 0);
let eb = G.exoBonus(run.players[0]);
check('one jet exo mod gives fuel and recharge together', near(eb.fuel, 1.3) && near(eb.refuel, 1.3), [eb.fuel, eb.refuel]);
for (const t of [3, 4, 5]) {
  G.bagAdd(run, G.exoMod('carrot', t));
  G.fitExo(run, run.bag.findIndex(x => x && x.cat === 'carrot'), 0, 'carrot', t - 1);
}
check('carrot adds levels, capped at V (3+4+5 → 5)', G.exoBonus(run.players[0]).carrot === 5);

// ---- fitPerk and playerStats ----
G.bagAdd(run, { kind: 'perk', id: 'move', n: 1 });
G.bagAdd(run, { kind: 'perk', id: 'st_hp2', n: 1 });
const pmi = run.bag.findIndex(x => x && x.id === 'move');
check('fitPerk refuses a stat perk (those are exo mods now)', !G.fitPerk(run, run.bag.findIndex(x => x && x.id === 'st_hp2'), 0, 0));
check('fitPerk: into one of 6 slots', G.fitPerk(run, pmi, 0, 5) && run.players[0].perks[5].id === 'move' && !G.fitPerk(run, pmi, 0, 6));
const st = G.playerStats(run.players[0]);
check('playerStats: exo speed, then the perk on top (1.16 × 1.3)', near(st.walk, 1.16 * 1.3), st.walk);
check('playerStats: max health from exo hp', st.maxHp === G.PLAYER_HP + 20, st.maxHp);
check('playerStats: jet and carrot carried through', near(st.fuel, 1.3) && near(st.refuel, 1.3) && st.carrot === 5);
check('unfitPerk', G.unfitPerk(run, 0, 5) && run.players[0].perks[5] === null && near(G.playerStats(run.players[0]).walk, 1.16));

// ---- prices and scrap ----
check('autoGunPrice: knob base at tier 1, climbing', G.autoGunPrice(1) === G.DEV.autoGunBase && G.autoGunPrice(3) > G.autoGunPrice(2));
check('autoExoPrice: 60% of the gun price (rounded to 5)', G.autoExoPrice(1) === Math.round(G.autoGunPrice(1) * 0.6 / 5) * 5);
check('scrap: gold is itself', G.scrap({ kind: 'gold', n: 12 }, 3) === 12);
check('scrap: a gun is 25% of the price', G.scrap({ kind: 'gun', gun: gun(), n: 1 }, 1) === Math.round(G.autoGunPrice(1) / 4));
check('scrap: a red gem 40 × goldScale', G.scrap({ kind: 'red', n: 1 }, 1) === 40 && G.scrap({ kind: 'red', n: 1 }, 3) === Math.round(40 * G.goldScale(3)));
check('scrap: green 150 × goldScale, a stack counts every one', G.scrap({ kind: 'green', n: 2 }, 1) === 300);
check('scrap: an exo mod by its own tier', G.scrap(G.exoMod('hp', 2), 1) === Math.round(G.autoExoPrice(2) / 4));
check('scrap follows its Dev knob', (() => { const o = G.DEV.autoScrap; G.DEV.autoScrap = 50;
  const v = G.scrap({ kind: 'gun', n: 1 }, 1); G.DEV.autoScrap = o; return v === Math.round(G.autoGunPrice(1) / 2); })());
{
  const r = G.newRun();
  r.bag.fill(null);   // without the starter kit's Buzzsaw (stage 5a)
  G.bagAdd(r, { kind: 'red', n: 2 }); G.bagAdd(r, { kind: 'gold', n: 10 });
  check('scrapAt: the stack becomes gold on the gold stack', G.scrapAt(r, 0) === 80 && r.bag[0] === null && G.bagCount(r, 'gold') === 90);
  check('scrapAt refuses the gold itself', G.scrapAt(r, 1) === 0 && G.bagCount(r, 'gold') === 90);
}

// ---- addPlayer ----
{
  const r = G.newRun();
  check('addPlayer refuses without a green gem', G.addPlayer(r) === null && r.players.length === 1);
  G.bagAdd(r, { kind: 'green', n: 5 });
  const p = G.addPlayer(r);
  check('addPlayer: costs one green, next colour', p && r.players.length === 2 && p.col === G.TITLE_COLS[1] && G.bagCount(r, 'green') === 4);
  G.addPlayer(r); G.addPlayer(r);
  check('at most 4 (the green is kept)', r.players.length === 4 && G.addPlayer(r) === null && G.bagCount(r, 'green') === 2);
  check('the four colours', r.players.map(x => x.col).join() === G.TITLE_COLS.join());
}

// ---- save ----
{
  const mem = {};
  const fake = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  check('nothing saved: null', G.loadAutoRun(fake) === null);
  run.tier = 4;
  check('saveAutoRun writes its own key, versioned', G.saveAutoRun(run, fake) && JSON.parse(mem[G.AUTO_SAVE_KEY]).v === 1
    && G.AUTO_SAVE_KEY === 'caverunner-auto-run');
  const back = G.loadAutoRun(fake);
  check('round trip: the same run', back && JSON.stringify(back) === JSON.stringify(run) && back.tier === 4);
  check('…and its stats still add up', back && near(G.exoBonus(back.players[0]).walk, 1.16));
  mem[G.AUTO_SAVE_KEY] = JSON.stringify({ v: 99, run });
  check('another version: null', G.loadAutoRun(fake) === null);
  mem[G.AUTO_SAVE_KEY] = '{not json';
  check('junk: null', G.loadAutoRun(fake) === null);
  const bad = { getItem: () => { throw new Error('private'); }, setItem: () => { throw new Error('full'); } };
  check('a store that throws: null / false, no crash', G.loadAutoRun(bad) === null && G.saveAutoRun(run, bad) === false);
}

// ---- Dev knobs ----
// ---- between levels (stage 4b) ----
{
  const r = G.newRun(5);
  check('newRun keeps its seed; a random one without', r.seed === 5 && G.newRun().seed >= 1);
  const s1 = G.levelSeed(r);
  check('levelSeed: the same run and tier, the same level; the next tier another', s1 === G.levelSeed(G.newRun(5)) && s1 >= 1
    && (r.tier = 2, G.levelSeed(r) !== s1) && G.levelSeed({ tier: 1, players: [], bag: [] }) >= 1);
  r.tier = 1;
  r.players.push(G.newPlayer(1));
  r.players[0].hp = 3; r.players[1].hp = 0; r.players[1].alive = false;
  G.healRun(r);
  check('healRun: everyone full and alive', r.players.every(p => p.alive && p.hp === G.playerStats(p).maxHp) && r.players[0].hp === 100);
  r.players[0].hp = 9;
  G.levelCleared(r);
  check('levelCleared: tier + 1, healed', r.tier === 2 && r.players[0].hp === 100);
}

check('the Auto tab holds the auto group', G.DEV_TABS.some(t => t[0] === 'auto' && t[2].includes('auto'))
  && G.DEV_GROUPS.some(g => g[0] === 'auto') && G.DEV_META.filter(m => m.g === 'auto').length >= 7);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
