// The item audit for the owner (CaveRunner Auto, 2026-10-11): every gun mod, perk and exo mod with its description and
// stats, each list split into works now / could work / wouldn't (the PM's judgement in NOTE, PW, EX).
//   node tools/itemaudit.js docs/auto-item-audit.txt
const G = require('../tests/load');
const out = [];
const P = s => out.push(s);
const SKIP = new Set(['name', 'kind', 'glyph', 'col', 'info', 'id', 'look', 'light', 'lightR', 'tint', 'icon', 'art', 'snd', 'trail', 'hue', 'tag', 'tier', 'base']);
const stats = o => Object.entries(o).filter(([k, v]) => !SKIP.has(k) && (typeof v === 'number' || typeof v === 'boolean')).map(([k, v]) => k + ' ' + (typeof v === 'number' ? +v.toFixed(3) : v)).join(', ');
const line = (name, info, st, note) => P('- ' + name + ' — ' + (info || '') + (st ? ' [' + st + ']' : '') + (note ? '  >> ' + note : ''));
const TODO = new Set(G.GUN_TODO);
const NOTE = {
  boom: 'a blast placed where the gun aims', brim: 'as boom', crystal: 'mines on the cave floor', dormant: 'set off by blasts', crystal_t: 'as crystal', dormant_t: 'as dormant',
  stillc: 'a slowing circle', shieldc: 'eats enemy shots', vigour: 'heals the team standing in it', storm: 'lightning cloud', vacfield: 'pulls creatures and gold', glitter: 'a patch of blasts',
  knock: 'shove creatures', damper: 'only if guns get a kick', crit: 'triple-damage chance', spiral: 'a wavy path', follow: 'shots come back to the player', discrim: 'needs a target picker; maybe "only creatures"',
  eater: 'tunnels through rock (a rock clearer!)', gpower: 'spends gold for damage', cluster: 'bursts into bomblets',
  followaim: 'aiming is automatic: nothing to follow', autoaim: 'aiming is already automatic', aimassist: 'no aim stick in Auto', auto: 'guns already fire by themselves',
};
const NO = new Set(['followaim', 'autoaim', 'aimassist', 'auto']);
const KIND = { shot: 'SHOTS (what a gun fires)', mod: 'MODIFIERS (change the next shot)', passive: 'PASSIVES (always on while fitted)', static: 'STATICS AND FIELDS (placed, they stay a while)', util: 'UTILITIES' };
P('CAVERUNNER AUTO — ITEM AUDIT (v1.0.34, 2026-10-11)');
P('Each list split into: WORKS NOW / COULD WORK (needs building) / WOULDN\'T WORK (and why).');
P('Numbers in [ ] are the item\'s stats as they are now. Add your notes after each line.');
P('');
P('================ GUN MODS (' + Object.keys(G.MODS).length + ') ================');
for (const kind of Object.keys(KIND)) {
  const ids = Object.keys(G.MODS).filter(id => G.MODS[id].kind === kind);
  if (!ids.length) continue;
  P(''); P('--- ' + KIND[kind] + ' ---');
  const groups = [['WORKS NOW', ids.filter(id => !TODO.has(id))], ['COULD WORK', ids.filter(id => TODO.has(id) && !NO.has(id))], ['WOULDN\'T WORK', ids.filter(id => NO.has(id))]];
  for (const [g, list] of groups) { if (!list.length) continue; P(''); P(g + ':'); for (const id of list) { const m = G.MODS[id]; line(m.name, m.info, stats(m), TODO.has(id) ? NOTE[id] : ''); } }
}
P(''); P('================ PERKS (' + Object.keys(G.PERKS).filter(id => !G.PERKS[id].stat).length + ', 6 slots per player) ================');
P('Right now only the max-health part of a perk does anything in Auto.');
const PW = {
  health: ['WORKS NOW', ''], glass: ['WORKS NOW', 'only the half health; the damage boost does nothing yet'],
  ghost: ['COULD', 'a spirit beside the player'], gold: ['COULD', 'gold already flies to the team'], bounce: ['COULD', 'shots can bounce'], close: ['COULD', ''], conc: ['COULD', ''],
  contact: ['COULD', ''], crit: ['COULD', 'needs crits in the shot model'], life: ['COULD', 'one get-up per level'], knock: ['COULD', 'no gun kick in Auto: would shove creatures instead'],
  lev: ['COULD', 'jet speed'], fireimm: ['COULD', 'fire exists in levels'], move: ['COULD', ''], proj: ['COULD', ''], wands: ['COULD', ''], greed: ['COULD', ''], homing: ['COULD', 'homing exists in the shot model'],
  invis: ['COULD', 'creatures notice later'], trail: ['COULD', ''], shield: ['COULD', 'your look: light-blue glow, flashes off on a hit, back when ready'], pinpoint: ['COULD', 'aim is automatic already: could keep only the speed/spread part'],
  repel: ['COULD', ''], unlimited: ['COULD', 'guns have mana in Auto'], hearts: ['COULD', 'only if Auto gets healing (vigour circles, hearts)'],
  eye: ['NO', 'no fog in Auto'], eradar: ['NO', 'the screen shows everything near'], iradar: ['NO', 'items are vacuumed up'], wradar: ['NO', 'no guns lying in the cave'],
  minimap: ['NO', 'the level only scrolls one way'], tinker: ['NO', 'the bag works everywhere already'], sight: ['NO', 'no aim line: aim is automatic'],
};
for (const [g, key] of [['WORKS NOW', 'WORKS NOW'], ['COULD WORK', 'COULD'], ['WOULDN\'T WORK', 'NO']]) {
  P(''); P(g + ':');
  for (const id of Object.keys(G.PERKS)) { const k = G.PERKS[id]; if (k.stat || !PW[id] || PW[id][0] !== key) continue; line(k.name, k.info, stats(k), PW[id][1]); }
}
const miss = Object.keys(G.PERKS).filter(id => !G.PERKS[id].stat && !PW[id]); if (miss.length) throw new Error('unsorted perks ' + miss);
P(''); P('================ EXO SUIT MODS (4 categories x tiers I–V, 5 slots each; they add up) ================');
const EX = { hp: ['WORKS NOW', ''], speed: ['COULD WORK', 'walk and jet speed'], jet: ['WOULDN\'T WORK (as is)', 'Auto\'s jetpack has no fuel: needs fuel added, or turn it into jet power'], carrot: ['COULD WORK (partly)', 'the camera is fixed and there\'s no torch or aim line; only "creatures notice you from further" fits'] };
for (const cat of G.EXO_CATS) {
  P(''); P(G.EXO_NAMES[cat] + ': ' + EX[cat][0] + (EX[cat][1] ? '  >> ' + EX[cat][1] : ''));
  for (const st of G.EXO_STATS[cat]) { const S = G.STAT_PERKS[st]; P('  ' + S.name + ' (' + S.field + '): I–V = ' + S.vals.join(' / ')); }
}
P(''); P('Not in Auto\'s exo suit (from the old game): Gold Vacuum (goldPull: ' + G.STAT_PERKS.pull.vals.join(' / ') + ').');
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
console.log(out.length + ' lines');
