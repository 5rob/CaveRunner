const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function Game(')) +
  '\nreturn { MODS, planCast, resetGun, tracePath };')({ createElement: () => {} });
const { planCast, resetGun, tracePath } = api;
let pass = 0, fail = 0;
const check = (n, ok, x) => { if (!ok) fails(n); ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const fails = () => {};

// one shot, straight out of the planner with its mods applied
const shotOf = slots => planCast(resetGun({ name: 't', cap: slots.length, castDelay: 0.1,
  recharge: 1, manaMax: 9999, manaRegen: 0, spread: 0, multi: 1, shuffle: false,
  mana: 9999, speedMul: 1, slots })).shots[0];

const open = () => false;                        // nothing solid
const floorAt = y0 => (x, y) => y > y0;          // a floor
const pts = out => { const p = []; for (let i = 0; i < out.length; i += 2) p.push([out[i], out[i + 1]]); return p; };
const trace = (sh, nx, ny, solid, enemies) => pts(tracePath(sh, 0, 0, nx, ny, solid || open, enemies || [], []));

// --- a plain bolt flies straight ---
let pth = trace(shotOf(['bolt']), 1, 0);
check('a bolt goes straight', pth.every(q => Math.abs(q[1]) < 0.001), pth[pth.length - 1]);
check('and covers its range', pth[pth.length - 1][0] > 500, pth[pth.length - 1][0]);

// --- Speed Up makes the same shot reach further ---
const far = trace(shotOf(['speed', 'bolt']), 1, 0);
check('Speed Up reaches further', far[far.length - 1][0] > pth[pth.length - 1][0] * 2,
  { plain: Math.round(pth[pth.length - 1][0]), fast: Math.round(far[far.length - 1][0]) });

// --- Blast arcs under gravity ---
pth = trace(shotOf(['blast']), 1, 0);
const drops = pth.filter((q, i) => i > 1 && q[1] > pth[i - 1][1]).length;
check('a lobbed shot curves downward', pth[pth.length - 1][1] > 40 && drops > 10,
  { endY: Math.round(pth[pth.length - 1][1]) });
check('and the drop accelerates',
  (pth[pth.length - 1][1] - pth[pth.length - 2][1]) > (pth[2][1] - pth[1][1]), true);

// --- Heavy Shot slows it, so it falls more over the same distance ---
const heavy = trace(shotOf(['heavy', 'blast']), 1, 0);
check('Heavy Shot drops more over the same distance',
  heavy[heavy.length - 1][1] / Math.max(1, heavy[heavy.length - 1][0]) >
  pth[pth.length - 1][1] / Math.max(1, pth[pth.length - 1][0]), true);

// --- Accelerating starts slow and speeds up ---
pth = trace(shotOf(['accel', 'bolt']), 1, 0);
const step = i => pth[i][0] - pth[i - 1][0];
check('Accelerating gains speed along the path', step(pth.length - 1) > step(2) * 1.5,
  { first: step(2).toFixed(1), last: step(pth.length - 1).toFixed(1) });

// --- Bouncing reflects off a floor ---
pth = trace(shotOf(['bounce', 'bolt']), 0.7, 0.7, floorAt(120));
const lowest = Math.max(...pth.map(q => q[1]));
check('a bouncing shot comes back up', pth[pth.length - 1][1] < lowest - 5,
  { lowest: Math.round(lowest), end: Math.round(pth[pth.length - 1][1]) });

// --- without bounce it stops at the wall ---
pth = trace(shotOf(['bolt']), 0.7, 0.7, floorAt(120));
check('a plain shot stops at the rock', pth[pth.length - 1][1] <= 122, Math.round(pth[pth.length - 1][1]));

// --- Borer keeps going through it ---
pth = trace(shotOf(['borer', 'bolt']), 0.7, 0.7, floorAt(120));
check('a drilling shot carries on through', pth[pth.length - 1][1] > 200, Math.round(pth[pth.length - 1][1]));

// --- Homing curves toward an enemy: measure how close the line actually gets ---
const foe = { x: 300, ty: 120 };
const nearest = path => Math.min(...path.map(q => Math.hypot(q[0] - foe.x, q[1] - foe.ty)));
const straight = trace(shotOf(['bolt']), 1, 0, open, [foe]);
pth = trace(shotOf(['homing', 'bolt']), 1, 0, open, [foe]);
check('homing bends toward the enemy', nearest(pth) < nearest(straight) - 40,
  { homing: Math.round(nearest(pth)), plain: Math.round(nearest(straight)) });
check('a Seeker reaches it too', nearest(trace(shotOf(['seeker', 'bolt']), 1, 0, open, [foe])) < 10,
  Math.round(nearest(trace(shotOf(['seeker', 'bolt']), 1, 0, open, [foe]))));
check('with no enemy about, homing flies straight',
  Math.abs(trace(shotOf(['homing', 'bolt']), 1, 0, open, [])[20][1]) < 0.001, true);

// --- Short Fuse cuts the line short, Long Range extends it ---
const brief = trace(shotOf(['brief', 'bolt']), 1, 0);
const longr = trace(shotOf(['range', 'bolt']), 1, 0);
const plainEnd = trace(shotOf(['bolt']), 1, 0)[trace(shotOf(['bolt']), 1, 0).length - 1][0];
check('Short Fuse shortens the trace', brief[brief.length - 1][0] < plainEnd * 0.6,
  { brief: Math.round(brief[brief.length - 1][0]), plain: Math.round(plainEnd) });
check('Long Range lengthens it', longr[longr.length - 1][0] > brief[brief.length - 1][0] * 2,
  { brief: Math.round(brief[brief.length - 1][0]), long: Math.round(longr[longr.length - 1][0]) });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
