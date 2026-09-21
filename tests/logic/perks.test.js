// Perks, and the two hidden rooms a floor hides them in. Everything here is pure: the
// perk table and perkBag() are plain data, and makeLevel is a function of its seed, so the
// rooms can be found, flood-filled to and taken apart without a browser.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const g = new Function('React', shim + upto +
  'return { makeLevel, PERKS, PERK_IDS, perkBag, CW, CH, CELL, PLAYER_HP, SHOP_TOP, SHOP_FLOOR, SHOP_ROOF };')(
  { createElement: () => {} });
const { makeLevel, PERKS, PERK_IDS, perkBag, CW, CH, CELL, PLAYER_HP, SHOP_TOP, SHOP_FLOOR, SHOP_ROOF } = g;

let fails = 0;
const check = (name, cond, note) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${note ? ': ' + note : ''}`); }
  else console.log(`  ok  ${name}${note ? ': ' + note : ''}`);
};

// ---- the table itself ----
console.log(`${PERK_IDS.length} perks`);
const bare = PERK_IDS.filter(k => !PERKS[k].name || !PERKS[k].glyph || !PERKS[k].info);
check('every perk has a name, a glyph and a line explaining it', bare.length === 0, bare);
const names = PERK_IDS.map(k => PERKS[k].name);
check('no two perks share a name', new Set(names).size === names.length);
check('there are thirty-one of them', PERK_IDS.length === 31, PERK_IDS.length);

// ---- the bag ----
const bag = perkBag([]);
check('an empty bag is all multipliers at one', bag.dmg === 1 && bag.speed === 1 && bag.walk === 1);
check('and nothing flagged', bag.shield === 0 && bag.seeAll === 0 && bag.tinker === 0);
check('and max health is what you start with', bag.maxHp === PLAYER_HP, bag.maxHp);

const strong = perkBag(['health', 'hearts', 'glass']);
check('Extra Health adds 50 before Glass Cannon halves it',
  strong.maxHp === Math.round((PLAYER_HP + 50) * 0.5), strong.maxHp);
check('and it does not touch damage', strong.dmg === 2.5 && strong.heal === 1.5, strong);

const conc = perkBag(['conc']);
check('Concentrated Spells buys damage with delay and kick',
  conc.dmg === 1.25 && conc.spread === 0.5 && conc.recoil === 1.25 && conc.delay === 1.15, conc);
const wide = perkBag(['conc', 'crit', 'bounce', 'knock', 'proj', 'wands']);
check('and the rest stack on top', wide.recoil === 1.25 * 1.5 && wide.delay === 1.15 * 0.75,
  { recoil: wide.recoil, delay: wide.delay });
check('crit and bounce are counted, not multiplied',
  Math.abs(wide.crit - 0.15) < 1e-9 && wide.bounce === 1, { crit: wide.crit, bounce: wide.bounce });
check('Faster Wands speeds the cast and the recharge together',
  wide.rech === 0.75 && wide.delay < 1, { rech: wide.rech });

const flags = perkBag(['invis', 'tinker', 'eye', 'wradar', 'iradar', 'eradar', 'repel', 'shield', 'trail', 'contact', 'pinpoint']);
check('every flag perk sets its flag',
  ['invis', 'tinker', 'seeAll', 'radarWand', 'radarItem', 'radarEnemy', 'repel', 'shield',
    'trail', 'contact', 'pinpointer'].every(f => flags[f] === 1), flags);
check('and mana is still untouched by them', flags.mana === 1, flags.mana);
check('Unlimited Spells is unlimited however many times you have it',
  perkBag(['unlimited', 'unlimited', 'conc']).mana === 0, perkBag(['unlimited', 'conc']).mana);
check('a perk nobody knows about is ignored', perkBag(['nonsense']).dmg === 1);
check('every perk moves something in the bag',
  PERK_IDS.every(k => {
    const one = perkBag([k]);
    return JSON.stringify(one) !== JSON.stringify(bag);
  }), PERK_IDS.filter(k => JSON.stringify(perkBag([k])) === JSON.stringify(bag)));

// ---- the rooms ----
let perks = 0, hearts = 0, unreachable = 0, unknown = 0, owned = 0, buried = 0, thin = 0;
for (let seed = 1; seed <= 20; seed++) {
  const lv = makeLevel(seed, 1);
  const { mat, rooms, start } = lv;
  if (!rooms || rooms.length !== 2) { fails++; console.log(`FAIL seed ${seed}: ${rooms ? rooms.length : 0} rooms`); continue; }
  const perk = rooms.find(r => r.kind === 'perk'), heart = rooms.find(r => r.kind === 'heart');
  if (perk) perks++; if (heart) hearts++;
  if (perk && !PERK_IDS.includes(perk.id)) unknown++;

  // the player fits where the room's prize is, and the cell under it is solid
  for (const r of rooms) {
    const cx = Math.round(r.x / CELL), cy = Math.round(r.y / CELL);
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if (mat[(cy + dy) * CW + cx + dx]) buried++;
    if (mat[(cy + 4) * CW + cx] === undefined) thin++;
  }

  // flood-fill the cave the way the player moves, from the spawn in the shop, and see
  // whether each room is on the list
  const pw = 6, ph = 11;
  const free = new Uint8Array(CW * CH);
  for (let x = 0; x < CW; x++) {
    let run = 0;
    for (let y = CH - 1; y >= 0; y--) {
      run = mat[y * CW + x] ? 0 : run + 1;
      if (run >= ph) free[y * CW + x] = 1;
    }
  }
  const ok = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++) {
    let run = 0;
    for (let x = CW - 1; x >= 0; x--) {
      run = free[y * CW + x] ? run + 1 : 0;
      if (run >= pw) ok[y * CW + x] = 1;
    }
  }
  const sx = Math.round(start.x / CELL), sy = Math.round(start.y / CELL);
  const seen = new Uint8Array(CW * CH);
  const q = [[sx, sy]]; seen[sy * CW + sx] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, i = ny * CW + nx;
      if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || seen[i] || !ok[i]) continue;
      seen[i] = 1; q.push([nx, ny]);
    }
  }
  for (const r of rooms) {
    const cx = Math.round(r.x / CELL), cy = Math.round(r.y / CELL);
    let got = false;
    for (let dy = -5; dy <= 5 && !got; dy++)
      for (let dx = -5; dx <= 5; dx++) if (seen[(cy + dy) * CW + cx + dx]) { got = true; break; }
    if (!got) unreachable++;
  }

  // and the perk in it is not one you are already carrying
  const lv2 = makeLevel(seed, 1, [perk.id]);          // that one is already yours
  const p2 = lv2.rooms.find(r => r.kind === 'perk');
  if (p2.id === perk.id) owned++;
}
check('every floor has a perk room', perks === 20, `${perks}/20`);
check('every floor has a heart room', hearts === 20, `${hearts}/20`);
check('and the perk in it is always one of the table', unknown === 0, `${unknown} unknown`);
check('nothing is buried in the room: the middle of it is open', buried === 0, `${buried} solid cells there`);
check('both rooms can be reached from the shop', unreachable === 0, `${unreachable} rooms walled off`);
check('and a room never offers a perk you already have',
  owned === 0, `${owned}/20 offered one that was excluded`);

// ---- loot sits on the ground ----
let hanging = 0, loot = 0;
for (let seed = 1; seed <= 20; seed++) {
  const lv = makeLevel(seed, 1);
  for (const q of lv.pickups) {
    loot++;
    const cx = Math.round(q.x / CELL), cy = Math.round((q.y + 9) / CELL);
    if (!lv.mat[cy * CW + cx]) hanging++;
  }
}
console.log(`  ${loot} pickups over 20 floors, ${hanging} of them with nothing under them`);
check('every pickup in the cave is sitting on something', hanging === 0, `${hanging} in mid air`);

// ---- Extra Item in Holy Mountain opens a wider shop ----
const four = makeLevel(3, 1).stock.length;
const five = makeLevel(3, 1, ['holyitem']).stock.length;
check('a shop offers four things', four === 5, `${four} with the free heal`);   // 4 + the heal
check('and five with Extra Item in Holy Mountain', five === 6, `${five} with the free heal`);
const xs = makeLevel(3, 1, ['holyitem']).stock.filter(s => s.kind !== 'heal').map(s => Math.round(s.x));
check('the wider row is still centred on the room',
  Math.abs((xs[0] + xs[xs.length - 1]) / 2 - (CW / 2) * CELL) < 1, xs);

console.log(fails ? `\n${fails} FAILED` : '\nperks: all checks passed');
process.exit(fails ? 1 : 0);