// The owner's mana mods (after v1.0.83): Recharge Battery (passive: mana to full each reload, -40 max; art/scenegun.js gunPull),
// Mana Spring (Circle of Vigour's twin: fills the gun in hand of each player inside; titlescene.js vigourStep) and Mana Burst
// (the next spell bursts where it ends, giving mana to the players near it; titlescene.js manaBurst).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
G.DEV.autoFoeElites = 0;
G.DEV.autoOrbChance = 0;

for (const id of ['rechbat', 'manaspring', 'manaburst']) check(id + ' is a mod, off GUN_TODO', !!G.MODS[id] && !G.GUN_TODO.includes(id));

// Recharge Battery
{
  const g = G.resetGun({ name: 't', cap: 2, castDelay: 0, recharge: 0.5, manaMax: 100, manaRegen: 0, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 100, slots: ['rechbat', 'bolt'] });
  G.gunTick(g, 0.01);
  check('-40 max mana', Math.round(g.mana) === 60, g.mana);
  g.mana = 10;
  let wrapped = false;
  for (let i = 0; i < 20 && !wrapped; i++) { g.delayT = 0; g.rechT = 0; const p = G.gunPull(g); wrapped = !!p && g.rechT > 0; }
  check('reloading: mana back to full (60)', wrapped && Math.round(g.mana) === 60, [wrapped, g.mana]);
}

// Mana Spring: one player, Questions Later + Mana Spring; his gun's regen 0, so only the spring fills it
{
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.slots = ['auto', 'manaspring']; g.cap = 2; g.manaRegen = 0; G.resetGun(g);
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
  const sg = S.team[0].guns[S.team[0].active];
  let c = null;
  for (let i = 0; i < 600 && !c; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); c = S.shots.find(q => q.sid === 'manaspring') || null; }
  check('he casts the spring', !!c && c.mana > 0, c && c.mana);
  if (c) {
    const r = S.runners[0];
    c.x = r.x + G.PW / 2; c.y = r.y + G.PH / 2; c.life = 4;
    sg.mana = 0; sg.manaRegen = 0;
    for (let i = 0; i < 30; i++) { S.foes.length = 0; c.x = r.x + G.PW / 2; c.y = r.y + G.PH / 2; G.titleStep(S, 1 / 60); }
    check('standing in it, his gun\'s mana fills', sg.mana > 5, sg.mana);
    check('… and his health untouched by it (not a Vigour)', c.sid === 'manaspring');
  }
}

// Mana Burst: Mana Burst + Spark Bolt carries manaB; a shot with it ending by a player fills his gun
{
  const g = G.resetGun({ name: 't', cap: 2, castDelay: 0, recharge: 0.5, manaMax: 999, manaRegen: 0, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 999, slots: ['manaburst', 'bolt'] });
  const sh = G.planCast(g).shots[0];
  check('the spell carries the burst', sh.manaB === 30, sh.manaB);
  const run = G.newRun(3), pl = run.players[0];
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1)), r = S.runners[0];
  const sg = S.team[0].guns[S.team[0].active];
  for (let i = 0; i < 10; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
  S.shots.length = 0;
  const [s] = G.shotsOf(sh, 0, r.x + G.PW / 2 + 10, r.y + G.PH / 2, () => 0.5, 0);
  s.vx = 0; s.vy = 0; s.grav = 0; s.life = 0.01;
  S.shots.push(s);
  sg.mana = 0; sg.manaRegen = 0;
  for (let i = 0; i < 2; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
  check('where it ends, the player near gets mana', sg.mana >= 25, sg.mana);
  check('… the burst drawn', S.booms.some(b => b.sid === 'manaburst'));
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
