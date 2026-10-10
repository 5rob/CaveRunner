// CaveRunner Auto's context nav (src/auto/nav.js, AUTOBATTLER.md stage 8a): players → a player's menu → guns → a
// gun's mod slots; exo → a category → 5 slots; perks → 6 slots; stats; B (navBack) one level up, nothing at the top;
// refused taps (a locked player, an empty gun slot) change nothing; the row's cells and colour at each level.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

const run = G.newRun(5);
G.addPlayer(run);   // (needs a green gem: give one first)
if (run.players.length < 2) { G.bagAdd(run, { kind: 'green', n: 1 }); G.addPlayer(run); }
const pl = run.players[1];
pl.guns[0] = G.scratchPistol();
pl.guns[0].slots = pl.guns[0].slots.map(() => null);
pl.guns[0].slots[1] = 'bolt';
pl.exo.jet[0] = G.exoMod('jet', 2);
const row = n => G.navRow(n, run, G.MAX_PLAYERS);

let n = G.navStart();
let r = row(n);
check('the top: 4 circles, 2 players, 2 locked, no colour', n.level === 'players' && r.shape === 'circles' && r.cells.length === 4
  && r.cells.filter(c => c.dim).length === 2 && r.col === null, r);
check('B at the top does nothing', G.navBack(n).level === 'players');
check('a locked player: refused', G.navOpen(n, 3, run) === n);
n = G.navOpen(n, 1, run);
r = row(n);
check('player 2 tapped: his menu, Guns / Exo suit / Perks / Stats, in his colour', n.level === 'player' && n.p === 1
  && r.cells.map(c => c.open).join() === 'guns,exo,perks,stats' && r.col === pl.col, r);
n = G.navOpen(n, 'guns', run);
r = row(n);
check('Guns: 4 gun circles, the empty ones dim', n.level === 'guns' && r.cells.length === 4 && !r.cells[0].dim && r.cells[1].dim && r.cells[0].gun === pl.guns[0], r.cells.map(c => !!c.dim));
check('an empty gun slot: refused', G.navOpen(n, 1, run) === n);
n = G.navOpen(n, 0, run);
r = row(n);
check('a gun: its mod slots, the fitted bolt in slot 2', n.level === 'gun' && r.shape === 'slots' && r.cells.length === pl.guns[0].cap
  && r.cells[1].item && r.cells[1].item.id === 'bolt' && r.cells[0].item === null, r);
n = G.navBack(G.navBack(n));
check('B twice: the menu again', n.level === 'player' && n.p === 1);
n = G.navOpen(n, 'exo', run);
r = row(n);
check('Exo suit: the 4 categories', n.level === 'exo' && r.cells.map(c => c.open).join() === G.EXO_CATS.join());
check('a junk category: refused', G.navOpen(n, 'nope', run) === n);
n = G.navOpen(n, 'jet', run);
r = row(n);
check('Jetpack: 5 slots, the fitted one first', n.level === 'cat' && r.shape === 'slots' && r.cells.length === 5 && r.cells[0].item && r.cells[0].item.cat === 'jet', r);
n = G.navOpen(G.navBack(G.navBack(n)), 'perks', run);
r = row(n);
check('Perks: 6 slots', n.level === 'perks' && r.shape === 'slots' && r.cells.length === 6);
n = G.navOpen(G.navBack(n), 'stats', run);
check('Stats: the placeholder', row(n).shape === 'stats');
n = G.navBack(G.navBack(n));
r = row(n);
check('back at the top, the tapped player still marked', n.level === 'players' && r.cells[1].sel && !r.cells[0].sel, r);
check('a deeper level whose player is gone: shows the top', G.navRow({ level: 'perks', p: 3, g: 0, cat: 'hp' }, run, 4).cells.length === 4);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
