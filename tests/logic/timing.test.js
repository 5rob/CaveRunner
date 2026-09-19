const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { MODS, planCast, resetGun, gunPassives, effRecharge, MIN_CAST, MIN_RECH };')({ createElement: () => {} });
const { MODS, planCast, resetGun, effRecharge, MIN_CAST, MIN_RECH } = api;

let pass = 0, fail = 0;
const check = (n, got, want) => {
  const ok = typeof want === 'number' ? Math.abs(got - want) < 1e-6 : got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}: ${got}${ok ? '' : '  (want ' + want + ')'}`);
};
const gun = (slots, extra) => resetGun(Object.assign({ name: 't', cap: slots.length,
  castDelay: 0.5, recharge: 1.0, manaMax: 9999, manaRegen: 0, spread: 0, multi: 1,
  shuffle: false, mana: 9999, speedMul: 1, slots }, extra || {}));

console.log('--- cast delay is walked in order ---');
check('a plain bolt: 0.5 gun + 0.10 bolt', planCast(gun(['bolt'])).delay, 0.6);
check('Buzzsaw alone zeroes it', planCast(gun(['saw'])).delay, MIN_CAST);
check('Buzzsaw LAST in a double cast wipes the bolt delay',
  planCast(gun(['double', 'bolt', 'saw'])).delay, MIN_CAST);
check('Buzzsaw FIRST: the bolt adds its delay back',
  planCast(gun(['double', 'saw', 'bolt'])).delay, 0.10);
check('two shots after the saw both add back',
  planCast(gun(['triple', 'saw', 'bolt', 'slug'])).delay, 0.10 + 0.26);
check('a modifier after the saw still counts',
  planCast(gun(['double', 'bolt', 'saw'])).delay, MIN_CAST);
check('Heavy Shot before the saw is wiped too',
  planCast(gun(['double', 'heavy', 'bolt', 'saw'])).delay, MIN_CAST);
check('the saw still fires its own shot', planCast(gun(['double', 'bolt', 'saw'])).shots.length, 2);
check('and it digs', planCast(gun(['saw'])).shots[0].bore, 4);

console.log('\n--- order does not matter for ordinary delay mods ---');
check('Fast Cast before the bolt', planCast(gun(['fast', 'bolt'])).delay, 0.5 - 0.08 + 0.10);
check('Fast Cast after the bolt', planCast(gun(['bolt', 'fast'])).delay, 0.5 + 0.10);

console.log('\n--- recharge counts from any slot ---');
check('base recharge', effRecharge(gun(['bolt'])), 1.0);
check('Quick Recharge -0.33', effRecharge(gun(['bolt', 'recharge'])), 0.67);
check('position is irrelevant', effRecharge(gun(['recharge', 'bolt'])), 0.67);
check('Buzzsaw also shaves 0.17', effRecharge(gun(['bolt', 'saw'])), 0.83);
check('Hair Trigger -0.15', effRecharge(gun(['bolt', 'trigger'])), 0.85);
check('Spark carries -0.05', effRecharge(gun(['spark'])), 0.95);
check('Cold Start x0.55', effRecharge(gun(['bolt', 'cold'])), 0.55);
check('Overheat x1.8', effRecharge(gun(['bolt', 'over_heat'])), 1.8);
check('flat then multiplied', effRecharge(gun(['bolt', 'recharge', 'cold'])), 0.67 * 0.55);
check('stacking cannot go below the floor',
  effRecharge(gun(['recharge', 'recharge', 'recharge', 'saw'])), MIN_RECH);
check('Hair Trigger pays with cast delay', planCast(gun(['trigger', 'bolt'])).delay, 0.65);
check('Overheat doubles damage', planCast(gun(['over_heat', 'bolt'])).shots[0].dmg, 2);

console.log('\n--- the full rapid-fire build ---');
const rapid = gun(['double', 'bolt', 'saw', 'cold', 'recharge'], { castDelay: 0.5, recharge: 1.0 });
const rp = planCast(rapid);
const cycle = rp.delay + effRecharge(rapid);
console.log(`    [double, bolt, saw, cold, recharge]  delay ${rp.delay.toFixed(3)}s + recharge ${effRecharge(rapid).toFixed(2)}s`);
console.log(`    -> ${(1 / cycle).toFixed(1)} pulls/sec, ${rp.shots.length} shots each, ` +
  `${(rp.cost / cycle).toFixed(0)} mana/sec`);
check('a slow gun becomes fast', cycle < 0.3, true);
// the point of the saw: cast delay stops being the bottleneck and recharge takes over
check('recharge now dominates the cycle', effRecharge(rapid) > rp.delay * 10, true);
const plain = gun(['double', 'bolt', 'bolt'], { castDelay: 0.5, recharge: 1.0 });
check('same gun without the saw is far slower',
  (planCast(plain).delay + effRecharge(plain)) / cycle > 4, true);

// a longer list fires several pulls before it has to recharge
const chain = gun(['double', 'bolt', 'saw', 'double', 'bolt', 'saw', 'cold'],
  { castDelay: 0.5, recharge: 1.0 });
const first = planCast(chain);
check('first pull does not wrap', first.wrap, false);
check('and it is instant', first.delay, MIN_CAST);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
