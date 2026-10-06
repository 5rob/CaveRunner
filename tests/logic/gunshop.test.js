// The gun machine's offer (src/spells/gunshop.js) and the elites (data/creatures.js eliteOf):
// three guns of the floor's pool, priced on stats and level; rerolls dearer each use; the boosted
// reroll's crystals one more each time, its guns deeper and better; elites tougher, gold-tinted,
// richer; the cave's pickups all red crystals.
const G = require('../load');
const { newOffer, rollOffer, shopGun, shopGunPrice, rerollPrice, boostCost, gunPrice, makeGun, GUN_OFFER,
  eliteOf, enemyFor, makeLevel, MOD_DROPS, GUN_DROPS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let s = 11;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

const o = newOffer(rnd, 3);
check('three guns on offer', o.guns.length === GUN_OFFER && o.guns.every(Boolean) && GUN_OFFER === 3);
check('the floor\'s level or (rarely) deeper', o.guns.every(g => g.lvl >= 3));
// price: the stats' worth, lifted by level
const a = makeGun(rnd, 1), b = JSON.parse(JSON.stringify(a)); b.lvl = 8;
check('a gun\'s price grows with its stats\' worth', shopGunPrice(a) >= gunPrice(a) - 5, [shopGunPrice(a), gunPrice(a)]);
check('and with its level', shopGunPrice(b) > shopGunPrice(a), [shopGunPrice(a), shopGunPrice(b)]);
check('rerolls get dearer on the same floor', rerollPrice(2, 0) < rerollPrice(2, 1) && rerollPrice(2, 1) < rerollPrice(2, 2));
check('and cost more deeper down', rerollPrice(6, 0) > rerollPrice(1, 0));
check('the boosted reroll: one crystal, then one more each time', boostCost(0) === 1 && boostCost(1) === 2 && boostCost(4) === 5);

// boosted guns: deeper levels, better stats than a plain roll of the same level
let deeper = 0, better = 0;
for (let i = 0; i < 40; i++) {
  const g = shopGun(rnd, 3, true);
  if (g.lvl >= 4 && g.boosted) deeper++;
  const plain = makeGun(() => 0.5, g.lvl), seed = G.boostGun(makeGun(() => 0.5, g.lvl));
  if (seed.castDelay < plain.castDelay && seed.manaMax > plain.manaMax && seed.cap === plain.cap + 1) better++;
}
check('boosted guns come from deeper levels', deeper === 40, deeper);
check('with boosted stats and a slot more', better === 40, better);
rollOffer(rnd, o, true);
check('a boosted reroll rolls all three boosted', o.guns.every(g => g.boosted));

// elites
const k = enemyFor('hiisi' in G.CREATURES ? 'hiisi' : Object.keys(G.CREATURES)[0], 3), e = eliteOf(k);
check('an elite is tougher and hits harder', e.hp > k.hp && e.dmg >= k.dmg && e.elite, { k: [k.hp, k.dmg], e: [e.hp, e.dmg] });
check('and pays more: gold, red and green crystals (Dev → Elites, rolled when it dies)', G.DEV.elGoldLo > 1 && G.DEV.elRedLo >= 1 && G.DEV.elGreenLo >= 1);
check('its knobs are on the Dev panel in their own group', G.DEV_GROUPS.some(g => g[0] === 'elite') &&
  ['elCount', 'elHp', 'elDmg', 'elGold', 'elRed', 'elGreen', 'elScale', 'elTintAmt', 'elGlow', 'elGlowR', 'elTint'].every(k => G.DEV_META.some(m => m.k === k + 'Lo' && m.g === 'elite')));
{
  const sizes = [0.5, 1, 2].map(s => { G.DEV.elScaleLo = G.DEV.elScaleHi = s; return eliteOf(k).r; });
  G.DEV.elScaleLo = G.DEV_DEFAULTS.elScaleLo; G.DEV.elScaleHi = G.DEV_DEFAULTS.elScaleHi;
  check('the size knob scales it', sizes[0] === k.r * 0.5 && sizes[2] === k.r * 2, sizes);
}
check('its colours are tinted, the kind itself untouched', e.col.a !== k.col.a && !k.elite);
let elites = 0, foes = 0, other = 0, crystals = 0, inRange = 0;
for (let seed = 1; seed <= 6; seed++) {
  // (floor 3: floor 2 has no creatures since Level 2 stage 6, loot instead)
  const lv = makeLevel(seed * 97, 3), n = lv.enemies.filter(x => x.k.elite).length;
  if (n >= G.DEV.elCountLo && n <= G.DEV.elCountHi) inRange++;
  elites += n; foes += lv.enemies.length;
  other += lv.pickups.filter(q => q.kind !== 'crystal').length;
  crystals += lv.pickups.length;
}
check('the Dev count of elites per floor', inRange === 6 && elites / foes < 0.1, { perFloor: elites / 6, share: elites / foes });
{
  G.DEV.elCountLo = G.DEV.elCountHi = 7;
  const a = makeLevel(5, 3), b = makeLevel(5, 3);
  G.DEV.elCountLo = G.DEV.elCountHi = 0;
  const c = makeLevel(5, 3);
  G.DEV.elCountLo = G.DEV_DEFAULTS.elCountLo; G.DEV.elCountHi = G.DEV_DEFAULTS.elCountHi;
  check('set to 7: seven, the same ones each time; set to 0: none', a.enemies.filter(x => x.k.elite).length === 7 &&
    a.enemies.map(x => !!x.k.elite).join() === b.enemies.map(x => !!x.k.elite).join() && c.enemies.every(x => !x.k.elite));
  check('the elite count leaves the cave itself alone', a.enemies.map(x => x.x + ',' + x.y).join() === c.enemies.map(x => x.x + ',' + x.y).join());
}
check('the cave hands out only red crystals', other === 0, other);
check('as many as the guns and mods there were', crystals / 6 > (MOD_DROPS + GUN_DROPS) * 0.8, crystals / 6);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
