// Manual mode hand-back (owner, v2.0.16): a steered player stays on the stick DEV.autoCtlWait s after it rests, and teammates
// don't shove him while he's steered (that felt like something fighting the stick)
const G = require('../load');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok', m); };
const seed = 7, S = G.levelScene(200, seed, 1, undefined, G.newRun(seed).players);
for (let i = 0; i < 60; i++) G.titleStep(S, 1 / 60);
const r = S.runners[0];
G.levelControl(S, r.id, { active: true, nx: 1, ny: 0, mag: 1 });
for (let i = 0; i < 30; i++) G.titleStep(S, 1 / 60);
ok(G.ctlOn(r), 'steered while pushed');
G.levelControl(S, r.id, { active: false, nx: 0, ny: 0, mag: 0 });
let t = 0;
while (G.ctlOn(r) && t < 10) { G.titleStep(S, 1 / 60); t += 1 / 60; }
console.log('hand-back after', t.toFixed(2), 's; wait', G.DEV.autoCtlWait);
ok(Math.abs(t - G.DEV.autoCtlWait) < 0.1, 'autopilot takes him back after DEV.autoCtlWait');
// a teammate on top of the steered one: only the teammate moves (a steered player can stand still, stick barely rested)
G.levelControl(S, r.id, { active: false, nx: 0, ny: 0, mag: 0 });
r.ctlIdle = 0;
G.sceneAddRunner(S);
const o = S.runners.find(q => q !== r && !q.out);
if (o) {
  o.x = r.x + 4; o.y = r.y; o.mode = r.mode;
  const x0 = r.x;
  G.titleStep(S, 1 / 60);
  ok(Math.abs(r.x - x0) < 2, 'steered one not shoved (moved ' + (r.x - x0).toFixed(2) + ')');
} else ok(false, 'no teammate');
process.exit(fail ? 1 : 0);
