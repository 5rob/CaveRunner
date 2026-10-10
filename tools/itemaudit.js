// The item audit for the owner (CaveRunner Auto, 2026-10-11): every gun mod, perk and exo mod with its description and
// stats, each list split into works now / could work / wouldn't (the PM's judgement in NOTE, PW, EX). Also the browsable
// page (from tools/itemaudit.html, the rows in at /*ROWS*/): a notes box and a bin per item, and "Copy all edited module
// notes" that hands the PM the owner's changes as text.
//   node tools/itemaudit.js docs/auto-item-audit.txt docs/auto-item-audit.html
const fs = require('fs');
const path = require('path');
const G = require('../tests/load');
const out = [];
const P = s => out.push(s);
/** @type {any[]} */
const ROWS = [];
let CUR = { sec: '', sub: '', verdict: '' };
const SKIP = new Set(['name', 'kind', 'glyph', 'col', 'info', 'id', 'look', 'light', 'lightR', 'tint', 'icon', 'art', 'snd', 'trail', 'hue', 'tag', 'tier', 'base']);
// the stats by their names in the game (owner: not the code's names). A perk's are multipliers on yours; a shot's are its own
const LABEL = { mana: 'Mana cost', dmg: 'Damage', speed: 'Speed', spread: 'Spread', delay: 'Cast delay', d: 'Cast delay', rech: 'Recharge time',
  size: 'Size', life: 'Lifetime', recoil: 'Kick', grav: 'Gravity', drag: 'Air drag', pit: 'Hole it digs', wig: 'Wiggle', count: 'Projectiles',
  bounce: 'Bounces', bounceE: 'Speed kept per bounce', pierce: 'Pierces', accel: 'Acceleration', vmax: 'Top speed', explode: 'Blast radius',
  lifeBoom: 'Explodes when it runs out', fire: 'Sets things alight', knock: 'Knockback', arc: 'Throws lightning arcs', chain: 'Chain jumps',
  eat: 'Eats rock (radius)', bore: 'Bores through rock', pull: 'Pull strength', reach: 'Muzzle reach', hidden: 'No visible shot',
  setDelay: 'Sets cast delay to', homing: 'Homing strength', homeR: 'Homing range', drift: 'Drifts about', pop: 'Bursts into', tele: 'Teleports you',
  boost: 'Damage', manaMul: 'Mana cost', multi: 'Extra spells cast', myriad: 'Copies of the next spell', off: 'Copies another spell',
  manaMax: 'Max mana', manaRegen: 'Mana regen', hp: 'Costs health', timer: 'Timer', draw: 'Draws extra spells', embers: 'Embers', fuse: 'Fuse',
  r: 'Radius', beam: 'Beam', auto: 'Fires by itself', crit: 'Critical chance', hpAdd: 'Max health', hpMul: 'Max health', heal: 'Healing',
  gold: 'Gold value', goldPull: 'Gold pull range', walk: 'Walk and fly speed', jet: 'Jet thrust', fuel: 'Jet fuel', refuel: 'Jet refill speed',
  lives: 'Extra lives', shield: 'Shield', ghost: 'Ghost helper', contact: 'Contact damage', close: 'Close-call crits', invis: 'Invisible to creatures',
  repel: 'Pushes shots away', seeAll: 'No fog', radarEnemy: 'Enemy radar', radarItem: 'Mod radar', radarWand: 'Gun radar', tinker: 'Edit guns anywhere',
  pinpointer: 'Aims for you', trajectory: 'Aim line', fireImm: 'Fire immune', minimap: 'Mini-map', carrot: 'Carrot level' };
const FLAG = new Set(['lifeBoom', 'fire', 'arc', 'hidden', 'drift', 'tele', 'auto', 'shield', 'ghost', 'contact', 'close', 'invis', 'repel', 'seeAll',
  'radarEnemy', 'radarItem', 'radarWand', 'tinker', 'pinpointer', 'trajectory', 'fireImm', 'minimap', 'beam', 'bore']);
const MUL = new Set(['dmg', 'speed', 'spread', 'recoil', 'delay', 'rech', 'walk', 'jet', 'hpMul', 'heal', 'gold', 'goldPull', 'fuel', 'refuel', 'mana']);
const SEC = new Set(['delay', 'life', 'setDelay', 'timer', 'fuse']);
const num = v => String(+v.toFixed(3));
const sgn = v => (v > 0 ? '+' : '') + num(v);
/** @param {string} k @param {number} v @param {boolean} perk */
const fmtVal = (k, v, perk) => {
  if (FLAG.has(k) && v === 1) return '';
  if (perk && MUL.has(k)) return '×' + num(v);
  if (k === 'crit') return '+' + Math.round(v * 100) + '%';
  if (k === 'd' || k === 'rech') return sgn(v) + 's';
  if (k === 'boost' || k === 'manaMul' || k === 'bounceE') return '×' + num(v);
  if (k === 'spread') return num(v) + '°';
  if (k === 'hpAdd' || k === 'manaMax' || k === 'manaRegen' || (k === 'bounce' && perk)) return '+' + num(v);
  return num(v) + (SEC.has(k) ? 's' : '');
};
// what each stat is about (the page colours them by it, owner: to spot them at a glance)
const CATS = {
  dmg: ['dmg', 'boost', 'crit', 'close', 'contact', 'explode', 'knock', 'pierce', 'chain', 'arc', 'fire', 'lifeBoom', 'ghost', 'count', 'embers'],
  cost: ['mana', 'manaMul', 'manaMax', 'manaRegen', 'hp'],
  time: ['delay', 'd', 'rech', 'setDelay', 'timer', 'fuse', 'multi', 'draw', 'myriad', 'off'],
  flight: ['speed', 'accel', 'vmax', 'grav', 'drag', 'wig', 'spread', 'homing', 'homeR', 'drift', 'bounce', 'bounceE', 'life', 'reach', 'pop'],
  rock: ['size', 'pit', 'eat', 'bore', 'pull', 'r', 'beam'],
  you: ['walk', 'jet', 'fuel', 'refuel', 'hpAdd', 'hpMul', 'heal', 'lives', 'shield', 'invis', 'repel', 'fireImm', 'gold', 'goldPull', 'carrot', 'tele', 'recoil'],
};
const CAT_OF = Object.fromEntries(Object.entries(CATS).flatMap(([c, ks]) => ks.map(k => [k, c])));
/** a stat as [label, value, category] @param {string} k @param {number} v @param {boolean} perk */
const fmtStat = (k, v, perk) => [LABEL[k] || k, fmtVal(k, v, perk), CAT_OF[k] || 'info'];
/** @param {any} o @param {boolean} [perk] */
const stats = (o, perk = false) => Object.entries(o).filter(([k, v]) => !SKIP.has(k) && (typeof v === 'number' || typeof v === 'boolean')).map(([k, v]) => fmtStat(k, +v, perk));
/** @param {any[]} st */
const statText = st => st.map(([l, v]) => l + (v ? ' ' + v : '')).join(', ');
// the game's own icon colours (the bag's): a mod its family's, a perk the perk machine's green, an exo mod the exo machine's teal
const PERK_HUE = '#3dff7a', EXO_HUE = '#3fe6d6';
const iconsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'auto', 'icons.js'), 'utf8').replace(/\r\n/g, '\n');
const NAV_ICONS = eval('(' + (iconsSrc.match(/export const NAV_ICONS = (\{[\s\S]*?\n\});/) || [])[1] + ')');
const line = (name, info, st, note, id, glyph, col) => {
  ROWS.push({ ...CUR, id, name, info: info || '', stats: st || [], note: note || '', glyph: glyph || '', col: col || '' });
  P('- ' + name + ' — ' + (info || '') + (st && st.length ? ' [' + statText(st) + ']' : '') + (note ? '  >> ' + note : ''));
};
const TODO = new Set(G.GUN_TODO);
const NOTE = {
  boom: 'a blast placed where the gun aims', brim: 'as boom', crystal: 'mines on the cave floor', dormant: 'set off by blasts', crystal_t: 'as crystal', dormant_t: 'as dormant',
  stillc: 'a slowing circle', shieldc: 'eats enemy shots', vigour: 'heals the team standing in it', storm: 'lightning cloud', vacfield: 'pulls creatures and gold', glitter: 'a patch of blasts',
  knock: 'shove creatures', damper: 'only if guns get a kick', crit: 'triple-damage chance', spiral: 'a wavy path', follow: 'shots come back to the player', discrim: 'needs a target picker; maybe "only creatures"',
  eater: 'tunnels through rock (a rock clearer!)', gpower: 'spends gold for damage', cluster: 'bursts into bomblets',
  followaim: 'aiming is automatic: nothing to follow', autoaim: 'aiming is already automatic', aimassist: 'no aim stick in Auto', auto: 'guns already fire by themselves',
};
const NO = new Set(['followaim', 'autoaim', 'aimassist', 'auto']);
const KIND = { shot: 'Shots (what a gun fires)', mod: 'Modifiers (change the next shot)', passive: 'Passives (always on while fitted)', static: 'Statics and fields (placed, they stay a while)', util: 'Utilities' };
P('CAVERUNNER AUTO — ITEM AUDIT (v1.0.34, 2026-10-11)');
P('Each list split into: WORKS NOW / COULD WORK (needs building) / WOULDN\'T WORK (and why).');
P('Numbers in [ ] are the item\'s stats as they are now. Add your notes after each line.');
P('');
P('================ GUN MODS (' + Object.keys(G.MODS).length + ') ================');
for (const kind of Object.keys(KIND)) {
  const ids = Object.keys(G.MODS).filter(id => G.MODS[id].kind === kind);
  if (!ids.length) continue;
  P(''); P('--- ' + KIND[kind].toUpperCase() + ' ---');
  const groups = [['Works now', ids.filter(id => !TODO.has(id))], ['Could work', ids.filter(id => TODO.has(id) && !NO.has(id))], ['Wouldn\'t work', ids.filter(id => NO.has(id))]];
  for (const [g, list] of groups) {
    if (!list.length) continue;
    P(''); P(g.toUpperCase() + ':'); CUR = { sec: 'Gun mods', sub: KIND[kind], verdict: g };
    for (const id of list) { const m = G.MODS[id]; line(m.name, m.info, stats(m), TODO.has(id) ? NOTE[id] : '', 'mod:' + id, m.glyph, G.famCol(id)); }
  }
}
P(''); P('================ PERKS (' + Object.keys(G.PERKS).filter(id => !G.PERKS[id].stat).length + ', 6 slots per player) ================');
P('Right now only the max-health part of a perk does anything in Auto.');
const PW = {
  health: ['Works now', ''], glass: ['Works now', 'only the half health; the damage boost does nothing yet'],
  ghost: ['Could work', 'a spirit beside the player'], gold: ['Could work', 'gold already flies to the team'], bounce: ['Could work', 'shots can bounce'], close: ['Could work', ''], conc: ['Could work', ''],
  contact: ['Could work', ''], crit: ['Could work', 'needs crits in the shot model'], life: ['Could work', 'one get-up per level'], knock: ['Could work', 'no gun kick in Auto: would shove creatures instead'],
  lev: ['Could work', 'jet speed'], fireimm: ['Could work', 'fire exists in levels'], move: ['Could work', ''], proj: ['Could work', ''], wands: ['Could work', ''], greed: ['Could work', ''], homing: ['Could work', 'homing exists in the shot model'],
  invis: ['Could work', 'creatures notice later'], trail: ['Could work', ''], shield: ['Could work', 'your look: light-blue glow, flashes off on a hit, back when ready'], pinpoint: ['Could work', 'aim is automatic already: could keep only the speed/spread part'],
  repel: ['Could work', ''], unlimited: ['Could work', 'guns have mana in Auto'], hearts: ['Could work', 'only if Auto gets healing (vigour circles, hearts)'],
  eye: ['Wouldn\'t work', 'no fog in Auto'], eradar: ['Wouldn\'t work', 'the screen shows everything near'], iradar: ['Wouldn\'t work', 'items are vacuumed up'], wradar: ['Wouldn\'t work', 'no guns lying in the cave'],
  minimap: ['Wouldn\'t work', 'the level only scrolls one way'], tinker: ['Wouldn\'t work', 'the bag works everywhere already'], sight: ['Wouldn\'t work', 'no aim line: aim is automatic'],
};
for (const g of ['Works now', 'Could work', 'Wouldn\'t work']) {
  P(''); P(g.toUpperCase() + ':'); CUR = { sec: 'Perks', sub: 'Perks (6 slots per player)', verdict: g };
  for (const id of Object.keys(G.PERKS)) { const k = G.PERKS[id]; if (k.stat || !PW[id] || PW[id][0] !== g) continue; line(k.name, k.info, stats(k, true), PW[id][1], 'perk:' + id, k.glyph, PERK_HUE); }
}
const miss = Object.keys(G.PERKS).filter(id => !G.PERKS[id].stat && !PW[id]); if (miss.length) throw new Error('unsorted perks ' + miss);
P(''); P('================ EXO SUIT MODS (4 categories x tiers I–V, 5 slots each; they add up) ================');
const EX = {
  hp: ['Works now', '', 'More maximum health, and it comes full.'],
  speed: ['Could work', 'walk and jet speed', 'Walk and fly faster.'],
  jet: ['Wouldn\'t work', 'as is: Auto\'s jetpack has no fuel. Needs fuel added, or turn it into jet power', 'A bigger tank, and it refills faster.'],
  carrot: ['Could work', 'partly: the camera is fixed and there\'s no torch or aim line; only "creatures notice you from further" fits', 'The camera pulls back, the torch reaches further, the aim line runs longer — and creatures notice you from further off.'],
};
for (const cat of G.EXO_CATS) {
  P(''); P(G.EXO_NAMES[cat] + ': ' + EX[cat][0].toUpperCase() + (EX[cat][1] ? '  >> ' + EX[cat][1] : ''));
  const vals = G.EXO_STATS[cat].map(st => { const S = G.STAT_PERKS[st]; return [(LABEL[S.field] || S.name) + ' by tier I–V', S.vals.map(v => S.field === 'hpAdd' || S.field === 'carrot' ? '+' + v : '×' + v).join(' / '), CAT_OF[S.field] || 'info']; });
  for (const v of vals) P('  ' + v[0] + ': ' + v[1]);
  ROWS.push({ sec: 'Exo suit', sub: 'Exo suit mods (5 slots per category, tiers I–V; they add up)', verdict: EX[cat][0], id: 'exo:' + cat, name: G.EXO_NAMES[cat],
    info: EX[cat][2], stats: vals, note: EX[cat][1], glyph: G.EXO_GLYPH[cat], col: EXO_HUE, pix: NAV_ICONS[cat] });
}
P(''); P('Not in Auto\'s exo suit (from the old game): Gold Vacuum (Gold pull range by tier I–V: ×' + G.STAT_PERKS.pull.vals.join(' / ×') + ').');
fs.writeFileSync(process.argv[2], out.join('\n') + '\n');
console.log(out.length + ' lines');
if (process.argv[3]) {
  const tpl = fs.readFileSync(path.join(__dirname, 'itemaudit.html'), 'utf8');
  fs.writeFileSync(process.argv[3], tpl.replace('/*ROWS*/[]', () => JSON.stringify(ROWS).replace(/</g, '\\u003c')));
  console.log(ROWS.length + ' rows -> ' + process.argv[3]);
}
