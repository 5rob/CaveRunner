// CaveRunner Auto (owner): a pickup taken into the bag flies a copy of its tile into the slot it went into. The pure
// parts: bagSlotOf (the slot an item just added sits in: its stack's, a new slot, a gun's own), itemEdgeCol (the tile's
// outline by group, shared by the bag and the canvas), camTo (camAt's inverse: a scene point to the view), and the
// scene's onTake hook firing once, with the item and the point it was taken at, when a hub pickup reaches the player.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const mod = Object.keys(G.MODS).find(k => !G.MODS[k].off && G.MODS[k].glyph);
{
  const run = G.newRun(3);
  const used = run.bag.filter(Boolean).length;
  G.bagAdd(run, { kind: 'gold', n: 5 });
  G.bagAdd(run, { kind: 'mod', id: mod, n: 1 });
  const a = G.bagSlotOf(run, { kind: 'mod', id: mod, n: 1 });
  check('a new mod: the slot it went into', a >= 0 && run.bag[a] && run.bag[a].id === mod, { a, used });
  G.bagAdd(run, { kind: 'mod', id: mod, n: 1 });
  check('the same mod again: onto its stack, the same slot', G.bagSlotOf(run, { kind: 'mod', id: mod, n: 1 }) === a && run.bag[a].n === 2);
  const gun = { name: 'x' }, it = { kind: 'gun', gun, n: 1 };
  G.bagAdd(run, it);
  const gi = G.bagSlotOf(run, it);
  check('a gun: the slot holding that gun', gi >= 0 && run.bag[gi].gun === gun && gi !== a, gi);
  check('not in the bag: -1', G.bagSlotOf(run, { kind: 'perk', id: 'nope', n: 1 }) === -1);
}
check('outline: a mod its family colour, an exo mod the exo machine\'s, gold the spend grey',
  G.itemEdgeCol({ kind: 'mod', id: mod, n: 1 }) === G.famCol(mod) && G.itemEdgeCol({ kind: 'exo', cat: 'hp', tier: 1, n: 1 }) === G.HUB_MACHINES.exo.hue
  && G.itemEdgeCol({ kind: 'gold', n: 1 }) === G.ITEM_SPEND);
check('tiles: mods, exo mods, perks; not guns, gold, gems', G.tileItem({ kind: 'mod', n: 1 }) && G.tileItem({ kind: 'exo', n: 1 }) && G.tileItem({ kind: 'perk', n: 1 })
  && !G.tileItem({ kind: 'gun', n: 1 }) && !G.tileItem({ kind: 'gold', n: 1 }) && !G.tileItem({ kind: 'red', n: 1 }));
{
  const C = G.titleCam(60, 120);
  C.z = 0.7; C.x = 140; C.y = 70;
  const v = G.camTo(C, 100, 50), b = G.camAt(C, v.x, v.y);
  check('camTo undoes camAt', Math.abs(b.x - 100) < 1e-9 && Math.abs(b.y - 50) < 1e-9, { v, b });
}
// the hub: a mod pickup next to player 1 is taken, onTake fires once with it
{
  const run = G.newRun(5);
  const S = G.hubScene(200, 5, 1, 1, {});
  for (let t = 0; t < 3; t += 1 / 60) G.titleStep(S, 1 / 60);
  const got = [];
  S.hub.fits = () => true;
  S.hub.take = (_S, it) => !G.bagAdd(run, it);
  S.onTake = (it, x, y) => got.push({ it, x, y });
  const L = S.runners[0], it = { kind: 'mod', id: mod, n: 1 };
  (S.loot || (S.loot = [])).push({ x: S.scroll + L.x + 30, y: L.y, vx: 0, vy: 0, it, col: '#fff', t: 1, nopull: 0 });
  for (let i = 0; i < 300 && !got.length; i++) G.titleStep(S, 1 / 60);
  check('a hub pickup reaches the player: taken, onTake once with the item', got.length === 1 && got[0].it === it && !S.loot.length, got.length);
  check('… at a point near him (scene x as drawn)', got.length === 1 && Math.abs(got[0].x - (L.x + G.PW / 2)) < 20, got[0] && { x: got[0].x, px: L.x });
  check('… and it is in the bag', G.bagSlotOf(run, it) >= 0);
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
