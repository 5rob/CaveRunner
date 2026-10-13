// The spider zone (owner, after v1.0.74; art/titlescene.js spiderRock / spiderBeam): the open cave with rock scattered
// through its air, in three looks (rocks, vines, beams), orb webs strung in it (world/orbweb.js), and mines the spiders
// took over (Z.spid). Each run headless through a real level: the rock is there, the webs, and the team gets through it
// with a clearing gun, as after a level's wall: never blocked, never stuck waiting for fuel (owner after v1.0.74: a flyer
// waiting for fuel against the rock hung there forever; he comes down to land now).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
Object.assign(D, { autoFoeDmg: 0, autoWallMax: 0, autoLvlPace: 2.5 });   // (no free stretch: rock counts as rock from the start, the team's saws clear it)
check('a zone kind of its own', G.TITLE_ZONES.includes('spider'));
const kinds = new Set(), spid = [];
for (let s = 1; s < 120; s++) for (const Z of G.levelPlan(s, undefined, 0).zp.z) { if (Z.sv) kinds.add(Z.sv); if (Z.spid) spid.push(s); }
check('all three looks turn up', ['rocks', 'vines', 'beams'].every(k => kinds.has(k)), [...kinds]);
check('some mines are the spiders\'', spid.length > 3, spid.length);
// the first level of each look with a spider zone early on
const pickSeed = sv => { for (let s = 1; s < 400; s++) { const z = G.levelPlan(s, undefined, 0).zp.z.filter(q => !q.flat); const i = z.findIndex(q => q.z === 'spider' && q.sv === sv); if (i >= 0 && i < 3) return [s, z[i]]; } return [0, null]; };
for (const sv of ['rocks', 'vines', 'beams']) {
  const [seed, Z] = pickSeed(sv);
  const run = G.newRun(seed, () => 0.4), plan = G.levelPlan(seed, undefined, 0);
  run.players.forEach(p => { const g = p.guns[0], k = g.slots.indexOf(null); g.slots[k < 0 ? g.slots.length - 1 : k] = 'saw'; });
  const S = G.levelScene(300, seed, 2, plan, run.players, 1), L = G.levelState(S);
  let f = 0, blockedF = 0, waitF = 0, rock = 0, beam = 0, sampled = false;
  const mid = (Z.x0 + Z.x1) / 2;
  for (; f < 3000 && G.levelTeamX(S) < Z.x1 + 40; f++) {
    G.titleStep(S, dt);
    if (L.blocked) blockedF++;
    if (S.fuelWait != null && S.t - S.fuelWait < 0.1) waitF++;
    if (!sampled && G.levelTeamX(S) >= mid) {
      sampled = true;
      // the zone's columns on screen: rock in the open air between its roof and floor, and timber
      for (let wx = Math.max(Z.x0 + 30, S.scroll); wx < Math.min(Z.x1 - 30, S.scroll + G.TITLE_VW); wx += G.TCELL) {
        const c = Math.floor(wx / G.TCELL), cy = G.titleCeil(wx, S), fy = G.titleFloor(wx, S);
        for (let y = cy + 30; y < fy - 30; y += G.TCELL) {
          const m = G.titleCell(S, c, Math.floor(y / G.TCELL));
          if (G.TITLE_SOLID[m]) rock++;
          if (m === G.TM.BEAM || m === G.TM.BEAMD) beam++;
        }
      }
    }
  }
  const orbs = new Set(S.webs.filter(w => w.orb).map(w => w.orb)).size;
  check(`${sv} (seed ${seed}): rock scattered through its open air`, rock > 20, rock);
  if (sv === 'beams') check(`${sv}: old timbering stands in it`, beam > 20, beam);
  if (sv === 'vines') check(`${sv}: vines hang in it`, S.props.filter(p => p.st === 'vine' && p.ox > Z.x0 && p.ox < Z.x1).length > 20);
  check(`${sv}: orb webs strung`, (S.orbN || 0) > 0, S.orbN || 0);
  check(`${sv}: the team gets through it, never blocked for long`, G.levelTeamX(S) >= Z.x1 + 40 && blockedF < 60 && waitF < 150, { f, x: G.levelTeamX(S), blockedF, waitF, orbs });
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
