// v71 bag screen: the pull sequence the slot grid animates, the red->green stat quality,
// and the +/- a gun's mods make to its own stats.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { fireSimNew, fireSimStep, fireSimGauges, pullSteps, statQual, gunModDeltas, resetGun, effRecharge, GUN_RANGE, DEV, DEV_META };')({ createElement: () => {} });

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const gun = (slots, o) => G.resetGun(Object.assign({ cap: slots.length, slots, castDelay: 0.2, recharge: 0.5,
  manaMax: 500, manaRegen: 100, spread: 2, multi: 1, shuffle: false, mana: 500, speedMul: 1 }, o || {}));

// empty slots are skipped, and each pull gets its own number
let s = G.pullSteps(gun(['bolt', null, 'bolt', null, null, 'slug']));
check('empty slots are skipped, one pull per shot', JSON.stringify(s) ===
  JSON.stringify([{ slot: 0, pull: 0 }, { slot: 2, pull: 1 }, { slot: 5, pull: 2 }]), s);
s = G.pullSteps(gun(['double', 'dmg_up', 'bolt', null, 'bolt', 'slug']));
check('a multicast and its modifier share one pull', s.filter(x => x.pull === 0).map(x => x.slot).join() === '0,1,2,4' &&
  s.find(x => x.slot === 5).pull === 1, s);
s = G.pullSteps(gun(['bolt', 'dmg_up']));
check('a trailing modifier is never cast', s.length === 1 && !s.some(x => x.slot === 1), s);
check('a shuffled gun has no fixed sequence', G.pullSteps(gun(['bolt', 'bolt'], { shuffle: true })) === null);
const big = new Array(25).fill('bolt');
s = G.pullSteps(gun(big));
check('a 25-slot gun gets all 25 pulls', s.length === 25 && s[24].pull === 24, s.length);

// quality: 0 worst end, 1 best end
check('stat quality runs worst 0 to best 1', G.statQual('cap', 2) === 0 && G.statQual('cap', 25) === 1 &&
  G.statQual('castDelay', 1.5) === 0 && G.statQual('castDelay', 0.01) === 1 && Math.abs(G.statQual('manaMax', 525) - 0.5) < 1e-9);
check('out-of-range values clamp', G.statQual('castDelay', 3) === 0 && G.statQual('spread', -1) === 1);
check('double cast and order are yes/no', G.statQual('multi', 2) === 1 && G.statQual('multi', 1) === 0 &&
  G.statQual('shuffle', false) === 1 && G.statQual('shuffle', true) === 0);

// mod deltas
let d = G.gunModDeltas(gun(['bolt', 'bolt']));
check('bare shots only add their own cast delay', ['recharge', 'manaMax', 'manaRegen', 'spread', 'speedMul']
  .every(k => Math.abs(d[k]) < 1e-9) && Math.abs(d.castDelay - 0.1) < 1e-9, d);   // Bolt's own delay is 0.1s
const boltDelay = d.castDelay;
const g1 = gun(['heavy', 'bolt']);
d = G.gunModDeltas(g1);
check('Heavy Shot slows the shots', d.speedMul < 0, d.speedMul);
const fastG = gun(['fast', 'bolt']);
d = G.gunModDeltas(fastG);
check('Fast Cast takes cast delay off', Math.abs(d.castDelay - (boltDelay - 0.08)) < 1e-9, d.castDelay);
check('recharge delta is effRecharge minus the gun\'s own', Math.abs(d.recharge - (G.effRecharge(fastG) - fastG.recharge)) < 1e-9, d.recharge);
check('an empty gun reports zeros', Object.values(G.gunModDeltas(gun([null, null]))).every(v => v === 0));


// the fire preview: the trigger held down, at the gun's real pace
{
  const g = gun(['bolt', null, 'bolt', 'slug'], { castDelay: 0.2, recharge: 0.5, manaMax: 100, manaRegen: 0 });
  const S = G.fireSimNew(g);
  const log = [];
  let t = 0, last = null;
  for (; t < 3; t += 0.01) {
    G.fireSimStep(S, 0.01);
    if (S.lit && S.lit !== last) { last = S.lit; log.push({ t: +t.toFixed(2), slots: S.lit.slots.join(), pull: S.lit.pull, mana: Math.round(S.mana) }); }
  }
  check('fires the pulls in slot order, skipping the empty slot', log.slice(0, 3).map(x => x.slots).join('|') === '0|2|3', log.slice(0, 4));
  check('each pull has its own number, reset after recharge', log.slice(0, 4).map(x => x.pull).join() === '0,1,2,0', log.slice(0, 4));
  const gap1 = log[1].t - log[0].t, gapR = log[3].t - log[2].t;
  check('pulls are a cast delay apart (0.2s + Bolt 0.1s)', Math.abs(gap1 - 0.3) < 0.03, gap1);
  check('a full cycle waits out the recharge too (it runs alongside the last delay)', Math.abs(gapR - 0.5) < 0.03, { gap1, gapR });
  check('each pull drains its mana cost', log[0].mana < 100 && log[1].mana < log[0].mana, log.map(x => x.mana));
  for (let i = 0; i < 1000; i++) G.fireSimStep(S, 0.01);   // well past running dry
  const before = S.fired;
  for (let i = 0; i < 300; i++) G.fireSimStep(S, 0.01);
  check('it stops when mana runs out and regen is zero', S.fired === before && S.fired < 40, S.fired);
  check('the real gun is never touched', g.idx === 0 && g.rechT === 0);
}
{
  const g = gun(['bolt'], { castDelay: 0.4, recharge: 0.8, manaMax: 100, manaRegen: 50 });
  const S = G.fireSimNew(g);
  G.fireSimStep(S, 0.01);
  let k = G.fireSimGauges(S);
  check('just fired: recharge bar empty, mana dipped', k.recharge < 0.05 && k.mana < 1, k);
  for (let i = 0; i < 40; i++) G.fireSimStep(S, 0.01);
  k = G.fireSimGauges(S);
  check('halfway through recharge the bar is about half', Math.abs(k.recharge - 0.5) < 0.1, k);
  const S2 = G.fireSimNew(gun(['bolt', 'bolt'], { castDelay: 0.4 }));
  G.fireSimStep(S2, 0.01);
  for (let i = 0; i < 25; i++) G.fireSimStep(S2, 0.01);
  k = G.fireSimGauges(S2);
  check('cast delay bar refills over the pull\'s delay', k.castDelay > 0.4 && k.castDelay < 0.6, k);
  const S3 = G.fireSimNew(gun(['dmg_up', 'homing']));
  for (let i = 0; i < 300; i++) G.fireSimStep(S3, 0.01);
  check('a gun with nothing to fire lights nothing', S3.fired === 0);
}

// the dev knob exists
check('Bag fire preview speed is a dev knob', G.DEV_META.some(m => m.k === 'bagSpeed' && m.g === 'ui') && G.DEV.bagSpeed > 0);

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
