// v0.0.141: a new run's guide hologram (world/guide.js): where it jumps out, typing a letter at a
// time, the welcome then the kit, and the rude line (no kit) when you run through it.
const G = require('../load');
const { guideNew, guideStep, guideX, guideSpeech, typedAt, typeTime, GUIDE_PAGES, GUIDE_RUDE, GUIDE_GIFTS,
  GUIDE_PAR, GUIDE_NEAR, LIGHT_X, guideSpot } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- typing ----
check('nothing typed at the start', typedAt('Hello.', 0, 30) === 0);
check('a letter every 1/cps', typedAt('Hello there', 3.5 / 30, 30) === 3);
check('all of it by the end', typedAt(GUIDE_PAGES[0], typeTime(GUIDE_PAGES[0], 30) + 0.01, 30) === GUIDE_PAGES[0].length);
check('a beat after each dot of "....."', typeTime('a.....b', 30) > typeTime('abcdefg', 30) * 3);
check('faster at a higher speed', typeTime(GUIDE_PAGES[1], 60) < typeTime(GUIDE_PAGES[1], 30) * 0.6);
check('the script, as the owner wrote it', GUIDE_PAGES[0].startsWith('Welcome real person.') && GUIDE_PAGES[2].includes('SELL it back')
  && GUIDE_PAGES[5] === 'Enjoy your Slice Of Life.' && GUIDE_PAGES[6].startsWith('And here is something to get you started'));
check('the kit: 150 gold, 2 red (v0.0.142), 1 green, Buzzsaw, Bolt, Double Cast, a level 5 gun of 3 slots',
  JSON.stringify(GUIDE_GIFTS) === JSON.stringify([{ gold: 150 }, { crystal: 'red' }, { crystal: 'red' }, { crystal: 'green' },
    { mod: 'saw' }, { mod: 'bolt' }, { mod: 'double' }, { gun: { lvl: 5, cap: 3 } }]));

// ---- the whole welcome, standing still ----
const I = (o = {}) => ({ pcx: 160, camX: 50, vw: 225, inShop: true, cps: 30, wait: 1.4, seen: 50, ...o });
// v0.0.142: it waits until its spot is `seen` inside the screen's right edge (it came at ~27 in before,
// its light mostly off screen). ON: the view just far enough along, you a bit left of its middle
const SPOT = LIGHT_X[2] - 20, ON = { camX: SPOT + 50 - 225, pcx: SPOT + 50 - 225 + 100 };
{
  const g = guideNew();
  let ev = [];
  for (let i = 0; i < 60; i++) ev.push(...guideStep(g, 1 / 60, I()));
  check('waits while its spot is off screen', g.st === 'wait' && !ev.length, g.st);
  ev = guideStep(g, 1 / 60, I({ camX: ON.camX - 1, pcx: ON.pcx - 1 }));
  check('and while it is only just on screen', g.st === 'wait' && !ev.length, g.st);
  ev = guideStep(g, 1 / 60, I(ON));
  check('jumps out once its spot is well on screen', g.st === 'appear' && ev[0].k === 'appear', ev);
  check('ahead of you', g.x > ON.pcx + 20, g.x);
  check('just inside the first dark section, under its tube', g.x === LIGHT_X[2] - 20 && g.x === guideSpot(g), g.x);
  check('and drifts with the hologram layer', guideX(g, g.cam0 + 100) === g.x + 100 * (1 - GUIDE_PAR));
  const all = [];
  let t = 0;
  for (; t < 200 && g.st !== 'gone'; t += 1 / 60) all.push(...guideStep(g, 1 / 60, I(ON)));
  const gifts = all.filter(e => e.k === 'gift').map(e => e.gift);
  check('it says every box', all.filter(e => e.k === 'talk').length === GUIDE_PAGES.length);
  check('then hands out the whole kit, in order', JSON.stringify(gifts) === JSON.stringify(GUIDE_GIFTS), gifts.length);
  check('and goes, letting the hall light', g.st === 'gone' && g.hold === Infinity, { st: g.st, t });
  check('nothing to say once gone', guideSpeech(g, 30).text === '');
}

// ---- the view lagging behind you: it jumps out as you come right up to it anyway ----
{
  const g = guideNew(), x = guideSpot(g);
  guideStep(g, 1 / 60, I({ camX: 0, pcx: x - GUIDE_NEAR - 2 }));
  check('not yet', g.st === 'wait');
  guideStep(g, 1 / 60, I({ camX: 0, pcx: x - GUIDE_NEAR + 1 }));
  check('then, just in front of you', g.st === 'appear' && g.x === x, g);
}

// ---- run through it ----
{
  const g = guideNew();
  guideStep(g, 1 / 60, I(ON));
  for (let i = 0; i < 200; i++) guideStep(g, 1 / 60, I(ON));
  check('talking', g.st === 'talk', g.st);
  const ev = guideStep(g, 1 / 60, I({ camX: ON.camX, pcx: guideX(g, ON.camX) + 1 }));
  check('run through it: rude', g.st === 'rude' && ev[0].k === 'rude' && g.say === GUIDE_RUDE, g.st);
  check('the rude line, typed', guideSpeech(g, 30).text === GUIDE_RUDE);
  const all = [];
  for (let i = 0; i < 2000 && g.st !== 'gone'; i++) all.push(...guideStep(g, 1 / 60, I({ pcx: 600, camX: 450 })));
  check('then gone, without the kit', g.st === 'gone' && !all.some(e => e.k === 'gift'), all.map(e => e.k));
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
