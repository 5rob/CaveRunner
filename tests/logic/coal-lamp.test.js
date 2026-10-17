// (owner, v2.0.17) a hanging lamp hit by a player's real shot pops: fire thrown out, fuel near it alight (titlescene.js popLamp);
// and one whose hold is cut falls and breaks the same way
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const mk = () => {
  const S = G.levelScene(200, 5, 1, undefined, G.newRun(5).players, 2, null, true);
  for (let i = 0; i < 30; i++) G.titleStep(S, 1 / 60);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.props.length = 0; S.foes.length = 0; S.still = false;
  return S;
};
const S = mk();
const r = S.runners[0], lx = r.x + 60, ly = r.y - 30;
const lamp = { k: 'lamp', st: 'hanglamp', ox: lx + S.scroll, x: lx, y: ly - 10, len: 10, seed: 0.3, side: 1, burn: 0, ac: 0, ar: 0, rust: true };
S.props.push(lamp);
const p0 = S.lampsPopped || 0;
S.shots.push({ x: lx - 30, y: ly + 4, vx: 400, vy: 0, size: 2, col: '#fff', look: 'bullet', life: 1, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, real: true, dmg: 5, by: 0 });
for (let i = 0; i < 30; i++) G.titleStep(S, 1 / 60);
check('a shot pops the lamp', lamp.gone === true && (S.lampsPopped || 0) > p0, [lamp.gone, lamp.x, S.lampsPopped]);
check('fire thrown out (embers)', S.parts.some(p => p.kind === 'ember') || S.fire.length > 0, S.fire.length);
// a fast bullet (1200/s: 20 units a frame, the lantern is 7 wide) still finds it
const S2 = mk(), r2 = S2.runners[0], lamp2 = Object.assign({}, lamp, { gone: false, x: r2.x + 60, ox: r2.x + 60 + S2.scroll, y: r2.y - 40 });
S2.props.push(lamp2);
S2.shots.push({ x: lamp2.x - 31, y: lamp2.y + lamp2.len + 4, vx: 1200, vy: 0, size: 1, col: '#fff', look: 'bullet', life: 1, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, real: true, dmg: 5, by: 0 });
for (let i = 0; i < 10; i++) G.titleStep(S2, 1 / 60);
check('a fast bullet pops it too', lamp2.gone === true);
// its hold gone: it falls, breaks on landing, fire
const S3 = mk(), r3 = S3.runners[0], lamp3 = Object.assign({}, lamp, { gone: false, x: r3.x + 40, ox: r3.x + 40 + S3.scroll, y: r3.y - 40, fall: true, vy: 0 });
S3.props.push(lamp3);
for (let i = 0; i < 180 && !lamp3.gone; i++) G.titleStep(S3, 1 / 60);
check('a dropped lantern breaks on landing', lamp3.gone === true);
process.exit(fails ? 1 : 0);
