const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
// take everything up to the React components
const head = js.slice(0, js.indexOf('function makeLevel'));
const api = new Function('React', head + '\nreturn { MODS, planCast, resetGun, gunPassives, makeGun, startingGuns, SHOT_IDS, ALL_IDS };')
  ({ createElement: () => {} });
const { MODS, planCast, resetGun, gunPassives, makeGun, startingGuns } = api;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = Math.abs(got - want) < 1e-6 || got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got}${ok ? '' : ', want ' + want}`);
};
const gun = (slots, extra) => resetGun(Object.assign({
  name: 't', cap: slots.length, castDelay: 0.2, recharge: 1, manaMax: 500, manaRegen: 10,
  spread: 0, multi: 1, shuffle: false, mana: 500, slots }, extra || {}));

// a bare shot
let p = planCast(gun(['bolt']));
check('bolt fires 1 shot', p.shots.length, 1);
check('bolt damage', p.shots[0].dmg, 1);
check('bolt cost', p.cost, 5);
check('list ends -> wrap', p.wrap, true);

// modifier BEFORE the shot applies
p = planCast(gun(['dmg_up', 'bolt']));
check('dmg_up then bolt -> 2.5 dmg', p.shots[0].dmg, 2.5);
check('dmg_up adds its mana', p.cost, 10);

// modifier AFTER the shot does not apply on this cast
p = planCast(gun(['bolt', 'dmg_up']));
check('bolt then dmg_up -> 1 dmg', p.shots[0].dmg, 1);

// order changes the result with multiplicative mods
check('heavy then big', planCast(gun(['heavy', 'big', 'bolt'])).shots[0].dmg, 1 * 2.5 * 1.3);
check('two speed mods stack', planCast(gun(['speed', 'light', 'bolt'])).shots[0].speed, 540 * 2.5 * 4);

// multicast pulls the next N shots into one trigger pull
p = planCast(gun(['double', 'bolt', 'bolt']));
check('double cast fires 2', p.shots.length, 2);
p = planCast(gun(['triple', 'bolt', 'spark', 'slug']));
check('triple cast fires 3', p.shots.length, 3);
p = planCast(gun(['double', 'dmg_up', 'bolt', 'bolt']));
check('mod inside multicast hits both', p.shots[1].dmg, 2.5);

// a gun keeps its place across trigger pulls, then recharges
const g2 = gun(['bolt', 'slug']);
let a = planCast(g2);
check('first pull is the bolt', a.shots[0].dmg, 1);
check('first pull does not wrap', a.wrap, false);
let b = planCast(g2);
check('second pull is the slug', b.shots[0].dmg, 4);
check('second pull wraps', b.wrap, true);

// empty slots are skipped, not wasted
check('gaps skipped', planCast(gun([null, 'dmg_up', null, 'bolt'])).shots[0].dmg, 2.5);

// modifiers with no shot behind them
p = planCast(gun(['dmg_up', 'homing']));
check('no shot -> nothing fires', p.shots.length, 0);
check('no shot -> wraps', p.wrap, true);

// scatter and spread
check('scatter x3 buckshot', planCast(gun(['scatter', 'buck'])).shots[0].count, 15);
check('reduce spread', planCast(gun(['tight', 'buck'])).shots[0].spread, 0);
check('gun spread adds in', planCast(gun(['bolt'], { spread: 6 })).shots[0].spread, 8);

// mana maths
check('efficient halves cost', planCast(gun(['cheap', 'slug'])).cost, 10);
check('cast delay from mods', planCast(gun(['fast', 'bolt'])).delay, 0.2 - 0.08 + 0.10);

// passives read off the whole gun wherever they sit
const pas = gunPassives(gun(['bolt', 'battery', 'recharge']));
check('battery mana', pas.manaMax, 60);
check('quick recharge', pas.rech, -0.33);

// generated guns always have something that shoots
let shooters = 0;
let rs = 12345; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 200; i++) {
  const g = makeGun(rnd, i / 200);
  if (g.slots.some(id => id && MODS[id].kind === 'shot')) shooters++;
}
check('200 random guns can all shoot', shooters, 200);

// a starting kit that works
const st = startingGuns();
check('starts with 2 guns, 2 empty slots', st.filter(Boolean).length, 2);
check('starter pick axe cuts with a buzzsaw', planCast(st[0]).shots[0].bore, 4);
check('starter pistol shoots', planCast(st[1]).shots.length, 1);

// --- mechanics taken from the wiki: multicast wrapping, recoil, wand speed ---
p = planCast(gun(['bolt', 'double', 'spark']));        // double sits last, needs 2 shots
check('first pull is just the bolt', p.shots.length, 1);
p = planCast(gun(['double', 'bolt']));                  // only one shot left before the end
check('multicast wraps to find its second shot', p.shots.length, 2);

p = planCast(gun(['heavy', 'slug']));
check('recoil adds up', p.shots[0].recoil, 45 + 50);
check('light shot softens recoil', planCast(gun(['light', 'slug'])).shots[0].recoil, 45 * 0.5);

check('wand speed multiplier applies', planCast(gun(['bolt'], { speedMul: 1.5 })).shots[0].speed, 540 * 1.5);
check('quad cast fires 4', planCast(gun(['quad', 'bolt', 'bolt', 'spark', 'spark'])).shots.length, 4);

// homing and piercing are now the expensive investments they are in Noita
check('homing costs a lot', MODS.homing.mana > 30, true);
check('piercing costs a lot', MODS.pierce.mana > 50, true);


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
