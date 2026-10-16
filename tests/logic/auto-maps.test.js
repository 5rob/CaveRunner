// CaveRunner Auto's maps (src/auto/maps.js): each map keeps its own level (up 1 on the end teleporter, back to 1 when
// everyone falls); map i + 1 is bought only once map i is beaten, with DEV.autoMapPrice gold (× autoMapGrow each map
// after); mapTier (run.tier) = level + map × autoMapStep; an old save (run.tier, no maps) becomes map 0 at that level;
// the hub's map machine: browsing with the stick, A picks an owned map, gold paid in goes to the next map, change back.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('names: THEMES in Title Case, Mossy Caves first', G.MAP_NAMES[0] === 'Mossy Caves' && G.MAP_NAMES.length === G.THEMES.length, G.MAP_NAMES.slice(0, 3));

const run = G.newRun(5);
check('a new run: map 0 owned and active at level 1, the rest locked', run.map === 0 && run.maps.length === G.MAP_NAMES.length
  && run.maps[0].owned && run.maps[0].level === 1 && run.maps.slice(1).every(m => !m.owned), run.maps[0]);
check('tier 1 at the start', run.tier === 1 && G.mapTier(run) === 1);
G.levelCleared(run); G.levelCleared(run);
check('two clears: level 3, beaten, best 2, tier 3', run.maps[0].level === 3 && run.maps[0].beaten && run.maps[0].best === 2 && run.tier === 3, run.maps[0]);
G.levelFailed(run);
check('everyone fell: back to level 1 (best and beaten kept)', run.maps[0].level === 1 && run.maps[0].best === 2 && run.maps[0].beaten && run.tier === 1, run.maps[0]);

// prices and unlocking
const P = G.DEV.autoMapPrice, grow0 = G.DEV.autoMapGrow;
check('price: map 0 free, map 1 the knob (1,000,000)', G.mapPrice(0) === 0 && G.mapPrice(1) === P && P === 1000000);
G.DEV.autoMapGrow = 2;
check('price: × autoMapGrow each map after the second', G.mapPrice(2) === P * 2 && G.mapPrice(3) === P * 4);
G.DEV.autoMapGrow = grow0;
const r2 = G.newRun(9);
check('map 1 can\'t be bought before map 0 is beaten', G.mapState(r2, 1) === 'beat' && G.payMap(r2, 500) === 500 && r2.maps[1].paid === 0);
check('map 2: locked further on', G.mapState(r2, 2) === 'locked');
G.levelCleared(r2);
check('map 0 beaten: map 1 takes gold', G.mapState(r2, 1) === 'buy');
check('part paid: kept, not owned', G.payMap(r2, 400000) === 0 && r2.maps[1].paid === 400000 && !r2.maps[1].owned);
check('paid off: owned, the change back', G.payMap(r2, 700000) === 100000 && r2.maps[1].owned && r2.maps[1].paid === P);
check('map 2 now needs map 1 beaten', G.mapState(r2, 2) === 'beat' && G.payMap(r2, 10) === 10);
check('a locked map can\'t be picked', !G.selectMap(r2, 2) && r2.map === 0);

// separate progress
G.levelCleared(r2);   // map 0 to level 3
check('map 0 at level 3 (tier 3)', r2.maps[0].level === 3 && r2.tier === 3);
check('pick map 1: its own level 1, tier 1 + autoMapStep', G.selectMap(r2, 1) && r2.map === 1 && r2.tier === 1 + G.DEV.autoMapStep, r2.tier);
const seed0 = G.levelSeed(r2);
G.levelCleared(r2); G.levelCleared(r2);
check('map 1 clears to level 3; map 0 untouched', r2.maps[1].level === 3 && r2.maps[0].level === 3 && r2.tier === 3 + G.DEV.autoMapStep);
check('a different level each step', G.levelSeed(r2) !== seed0);
G.levelFailed(r2);
check('map 1 falls back to 1; map 0 still 3', r2.maps[1].level === 1 && r2.maps[0].level === 3);
G.selectMap(r2, 0);
check('back to map 0: tier 3 again', r2.tier === 3 && G.mapLabel(r2) === 'Mossy Caves Lv 3', G.mapLabel(r2));


// the hub's map machine
const hr = G.newRun(11); G.levelCleared(hr); G.levelFailed(hr);   // map 0 beaten, back at level 1
const S = G.hubScene(190, 101, 1, hr.tier, hr.paid || (hr.paid = {}), hr), H = G.hubState(S);
const step = s => { for (let i = 0; i < s * 30; i++) G.titleStep(S, 1 / 30); };
check('the map machine sits between perk and exit', G.hubStopX('perk') < G.hubStopX('map') && G.hubStopX('map') < G.hubStopX('exit'));
step(2);
const L = S.runners[0];
L.x = G.hubStopX('map') - G.PW / 2; L.vx = 0; step(0.3);
check('at it: hubPayAt says map', G.hubPayAt(S) === 'map');
const y0 = L.y;
G.hubStick(S, { active: true, nx: 0, ny: 1, mag: 1, dy: 1 }); step(0.3);
check('stick down: browses to map 1 (one step per flick)', H.mapSel === 1, H.mapSel);
G.hubStick(S, { active: true, nx: 0, ny: -1, mag: 1, dy: -1 }); step(0.5);
check('stick up: back to map 0, and he doesn\'t jet', H.mapSel === 0 && Math.abs(L.y - y0) < 1, [H.mapSel, L.y - y0]);
G.hubStick(S, { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }); step(0.1);
G.hubStick(S, { active: true, nx: 0, ny: 1, mag: 1, dy: 1 }); step(0.2);
G.hubStick(S, { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }); step(0.1);
check('A on map 1 (not owned, map 0 beaten): pay', H.mapSel === 1 && G.hubMapA(S) === 'pay');
H.paid.map = 1200000; step(0.1);
check('gold in: map 1 owned, the change flies back', hr.maps[1].owned && H.back.some(b => b.kind === 'gold' && b.n === 200000), H.back);
check('A on map 1 now: pick', G.hubMapA(S) === 'pick');
check('picked: active, the hub\'s tier follows', G.hubMapPick(S) && hr.map === 1 && H.tier === hr.tier && hr.tier === 1 + G.DEV.autoMapStep, [hr.map, H.tier]);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
